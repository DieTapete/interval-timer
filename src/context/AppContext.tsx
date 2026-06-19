import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { Alert, Share } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Timer, Program, LogEntry, Session } from '../types';
import { loadAll, saveData, saveSession as persistSession } from '../storage';
import { uid, dateKey } from '../utils';

interface AppContextValue {
  ready: boolean;
  timers: Timer[];
  programs: Program[];
  log: LogEntry[];
  session: Session | null;

  saveTimer: (form: Omit<Timer, 'id'>, editingId: string | null) => void;
  deleteTimer: (id: string) => void;

  saveProgram: (form: Omit<Program, 'id'>, editingId: string | null) => void;
  deleteProgram: (id: string) => void;

  startProgram: (p: Program) => boolean;
  finishSession: () => void;
  abandonSession: () => void;

  addLog: (entry: LogEntry) => void;
  markExDone: (exIndex: number) => void;
  deleteLog: (ts: number) => void;

  exportData: () => Promise<void>;
  importData: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [timers, setTimers] = useState<Timer[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [session, setSessionState] = useState<Session | null>(null);

  useEffect(() => {
    loadAll().then(({ timers: t, programs: p, log: l, session: s }) => {
      setTimers(t);
      setPrograms(p);
      setLog(l);
      setSessionState(s);
      setReady(true);
    });
  }, []);

  const persist = useCallback(
    (t: Timer[], p: Program[], l: LogEntry[]) => saveData(t, p, l),
    [],
  );

  const setSession = useCallback((s: Session | null) => {
    setSessionState(s);
    persistSession(s);
  }, []);

  const saveTimer = useCallback(
    (form: Omit<Timer, 'id'>, editingId: string | null) => {
      setTimers((prev) => {
        const next = editingId
          ? prev.map((t) => (t.id === editingId ? { ...form, id: editingId } : t))
          : [...prev, { ...form, id: uid() }];
        persist(next, programs, log);
        return next;
      });
    },
    [programs, log, persist],
  );

  const deleteTimer = useCallback(
    (id: string) => {
      setTimers((prev) => {
        const next = prev.filter((t) => t.id !== id);
        persist(next, programs, log);
        return next;
      });
    },
    [programs, log, persist],
  );

  const saveProgram = useCallback(
    (form: Omit<Program, 'id'>, editingId: string | null) => {
      setPrograms((prev) => {
        const next = editingId
          ? prev.map((p) => (p.id === editingId ? { ...form, id: editingId } : p))
          : [...prev, { ...form, id: uid() }];
        persist(timers, next, log);
        return next;
      });
    },
    [timers, log, persist],
  );

  const deleteProgram = useCallback(
    (id: string) => {
      setPrograms((prev) => {
        const next = prev.filter((p) => p.id !== id);
        persist(timers, next, log);
        return next;
      });
    },
    [timers, log, persist],
  );

  const startProgram = useCallback(
    (p: Program): boolean => {
      const validIds = p.timerIds.filter((id) => timers.find((t) => t.id === id));
      if (!validIds.length) {
        Alert.alert('No timers', 'This program has no valid timers.');
        return false;
      }
      setSession({
        programId: p.id,
        name: p.name,
        timerIds: validIds,
        exDone: validIds.map(() => false),
        startedTs: Date.now(),
      });
      return true;
    },
    [timers, setSession],
  );

  const finishSession = useCallback(() => {
    if (session && session.exDone.every(Boolean)) {
      setLog((prev) => {
        const next = [
          ...prev,
          {
            ts: Date.now(),
            programId: session.programId,
            name: session.name,
            date: dateKey(new Date()),
          },
        ];
        persist(timers, programs, next);
        return next;
      });
    }
    setSession(null);
  }, [session, timers, programs, persist, setSession]);

  const abandonSession = useCallback(() => {
    setSession(null);
  }, [setSession]);

  const addLog = useCallback(
    (entry: LogEntry) => {
      setLog((prev) => {
        const next = [...prev, entry];
        persist(timers, programs, next);
        return next;
      });
    },
    [timers, programs, persist],
  );

  const markExDone = useCallback(
    (exIndex: number) => {
      if (!session) return;
      const updated: Session = {
        ...session,
        exDone: session.exDone.map((v, i) => (i === exIndex ? true : v)),
      };
      setSession(updated);
    },
    [session, setSession],
  );

  const deleteLog = useCallback(
    (ts: number) => {
      setLog((prev) => {
        const next = prev.filter((l) => l.ts !== ts);
        persist(timers, programs, next);
        return next;
      });
    },
    [timers, programs, persist],
  );

  const exportData = useCallback(async () => {
    const data = JSON.stringify({ timers, programs, log }, null, 2);
    const path = FileSystem.cacheDirectory + 'interval-timer-data.json';
    await FileSystem.writeAsStringAsync(path, data, { encoding: FileSystem.EncodingType.UTF8 });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(path, { mimeType: 'application/json', UTI: 'public.json' });
    } else {
      await Share.share({ message: data });
    }
  }, [timers, programs, log]);

  const importData = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/json', 'public.json'],
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    const raw = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.UTF8 });
    let d: { timers?: Timer[]; programs?: Program[]; log?: LogEntry[] };
    try {
      d = JSON.parse(raw);
      if (!d || typeof d !== 'object') throw new Error('bad');
    } catch {
      Alert.alert('Import failed', 'The file is not valid Interval Timer data.');
      return;
    }

    const hasExisting = timers.length || programs.length || log.length;
    const mode = await new Promise<'replace' | 'merge' | 'cancel'>((resolve) => {
      if (!hasExisting) {
        resolve('replace');
        return;
      }
      Alert.alert('Import', 'How would you like to import?', [
        { text: 'Replace all', style: 'destructive', onPress: () => resolve('replace') },
        { text: 'Merge', onPress: () => resolve('merge') },
        { text: 'Cancel', style: 'cancel', onPress: () => resolve('cancel') },
      ]);
    });

    if (mode === 'cancel') return;

    if (mode === 'replace') {
      const t = d.timers || [];
      const p = d.programs || [];
      const l = d.log || [];
      setTimers(t);
      setPrograms(p);
      setLog(l);
      persist(t, p, l);
    } else {
      setTimers((prev) => {
        const ids = new Set(prev.map((t) => t.id));
        const merged = [...prev, ...(d.timers || []).filter((t) => !ids.has(t.id))];
        setPrograms((pp) => {
          const pids = new Set(pp.map((p) => p.id));
          const mergedP = [...pp, ...(d.programs || []).filter((p) => !pids.has(p.id))];
          setLog((ll) => {
            const ts = new Set(ll.map((l) => l.ts));
            const mergedL = [...ll, ...(d.log || []).filter((l) => !ts.has(l.ts))];
            persist(merged, mergedP, mergedL);
            return mergedL;
          });
          return mergedP;
        });
        return merged;
      });
    }

    Alert.alert(
      'Imported',
      `${d.timers?.length ?? 0} timers, ${d.programs?.length ?? 0} programs, ${d.log?.length ?? 0} sessions.`,
    );
  }, [timers, programs, log, persist]);

  const value: AppContextValue = {
    ready,
    timers,
    programs,
    log,
    session,
    saveTimer,
    deleteTimer,
    saveProgram,
    deleteProgram,
    startProgram,
    finishSession,
    abandonSession,
    addLog,
    markExDone,
    deleteLog,
    exportData,
    importData,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
