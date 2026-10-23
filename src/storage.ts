import AsyncStorage from '@react-native-async-storage/async-storage';
import { Timer, Program, LogEntry, Session } from './types';

const KEYS = {
  timers: 'it_timers',
  programs: 'it_programs',
  log: 'it_log',
  session: 'it_session',
};

async function loadJSON<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function loadAll(): Promise<{
  timers: Timer[];
  programs: Program[];
  log: LogEntry[];
  session: Session | null;
}> {
  const [timers, programs, log, session] = await Promise.all([
    loadJSON<Timer[]>(KEYS.timers, []),
    loadJSON<Program[]>(KEYS.programs, []),
    loadJSON<LogEntry[]>(KEYS.log, []),
    loadJSON<Session | null>(KEYS.session, null),
  ]);

  // migrate old format: per-phase sets → timer-level sets
  const migrated = timers.map((t) => {
    if (t.sets === undefined) {
      const maxSets = Math.max(1, ...t.phases.map((p: any) => p.sets || 1));
      return {
        ...t,
        sets: maxSets,
        phases: t.phases.map((p: any) => ({ name: p.name, seconds: p.seconds, color: p.color || '' })),
      };
    }
    return t;
  });

  return { timers: migrated, programs, log, session };
}

export async function saveData(timers: Timer[], programs: Program[], log: LogEntry[]): Promise<void> {
  await Promise.all([
    AsyncStorage.setItem(KEYS.timers, JSON.stringify(timers)),
    AsyncStorage.setItem(KEYS.programs, JSON.stringify(programs)),
    AsyncStorage.setItem(KEYS.log, JSON.stringify(log)),
  ]);
}

export async function saveSession(session: Session | null): Promise<void> {
  if (session) {
    await AsyncStorage.setItem(KEYS.session, JSON.stringify(session));
  } else {
    await AsyncStorage.removeItem(KEYS.session);
  }
}
