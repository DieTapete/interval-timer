import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { AppProvider, useApp } from './src/context/AppContext';
import { C } from './src/colors';
import { buildSteps, dateKey } from './src/utils';
import { Timer, RunState, LogEntry } from './src/types';

import TimersScreen from './src/screens/TimersScreen';
import ProgramsScreen from './src/screens/ProgramsScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import RunnerModal from './src/components/RunnerModal';
import SessionModal from './src/components/SessionModal';

const Tab = createBottomTabNavigator();

function MainApp() {
  const { timers, programs, session, startProgram, markExDone, addLog, exportData, importData } = useApp();
  const insets = useSafeAreaInsets();

  const [run, setRun] = useState<RunState>({ active: false });
  const runRef = React.useRef(run);
  const [showSession, setShowSession] = useState(false);

  // Keep ref in sync so stable callbacks can read the latest run
  React.useEffect(() => { runRef.current = run; }, [run]);

  const setRunAndCheck = useCallback((r: RunState) => {
    setRun(r);
    if (!r.active && runRef.current.active) {
      if ((runRef.current as Extract<RunState, { active: true }>).returnTo === 'session') {
        setShowSession(true);
      }
    }
  }, []);

  const handleRunSingle = useCallback((timer: Timer) => {
    const steps = buildSteps(timer);
    const totalSets = Math.max(1, timer.sets || 1);
    setRun({
      active: true,
      finished: false,
      paused: true,
      returnTo: 'app',
      steps,
      idx: 0,
      remaining: steps[0].seconds,
      kind: steps[0].kind,
      phaseName: steps[0].name,
      contextLabel: steps[0].ctx,
      upNext: steps[1]?.name ?? '',
      pct: 0,
      setPct: 0,
      setNum: 0,
      totalSets,
      label: timer.name,
      logOnFinish: true,
      programId: null,
      exIndex: null,
    });
  }, []);

  const handleStartProgram = useCallback(
    (p: typeof programs[number]) => {
      const started = startProgram(p);
      if (started) setShowSession(true);
    },
    [startProgram],
  );

  const handleStartExercise = useCallback(
    (timer: Timer, exIndex: number) => {
      const steps = buildSteps(timer);
      const totalSets = Math.max(1, timer.sets || 1);
      setRun({
        active: true,
        finished: false,
        paused: true,
        returnTo: 'session',
        steps,
        idx: 0,
        remaining: steps[0].seconds,
        kind: steps[0].kind,
        phaseName: steps[0].name,
        contextLabel: steps[0].ctx,
        upNext: steps[1]?.name ?? '',
        pct: 0,
        setPct: 0,
        setNum: 0,
        totalSets,
        label: timer.name,
        logOnFinish: false,
        programId: session?.programId ?? null,
        exIndex,
      });
      setShowSession(false);
    },
    [session],
  );

  const handleRunFinished = useCallback(
    (logOnFinish: boolean, label: string, programId: string | null, exIndex: number | null) => {
      if (logOnFinish) {
        const entry: LogEntry = {
          ts: Date.now(),
          programId,
          name: label,
          date: dateKey(new Date()),
        };
        addLog(entry);
      }
      if (exIndex !== null) {
        markExDone(exIndex);
      }
    },
    [addLog, markExDone],
  );

  const timerTabProps = { onRunSingle: handleRunSingle };
  const programTabProps = {
    onStartProgram: handleStartProgram,
    onResumeSession: () => setShowSession(true),
  };
  const calendarTabProps = { onResumeSession: () => setShowSession(true) };

  // Resume banner shown on Programs tab when session exists and not in run
  const hasBanner = !!session && !showSession && !run.active;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
          <Text style={s.headerTitle}>
            Interval<Text style={{ color: C.accent }}>·</Text>Timer
          </Text>
          <Text style={s.version}>v1.0.0</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity style={s.headerBtn} onPress={exportData}>
            <Text style={{ color: C.text, fontSize: 12 }}>Export</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.headerBtn} onPress={importData}>
            <Text style={{ color: C.text, fontSize: 12 }}>Import</Text>
          </TouchableOpacity>
        </View>
      </View>

      <NavigationContainer>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            headerShown: false,
            tabBarStyle: {
              backgroundColor: C.surface,
              borderTopColor: C.border,
              height: 56 + insets.bottom,
              paddingBottom: insets.bottom,
            },
            tabBarActiveTintColor: C.accent,
            tabBarInactiveTintColor: C.muted,
            tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
            tabBarIcon: ({ color, size }) => {
              const icons: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
                Programs: 'list-outline',
                Timers: 'timer-outline',
                Calendar: 'calendar-outline',
              };
              return <Ionicons name={icons[route.name]} size={size} color={color} />;
            },
          })}
        >
          <Tab.Screen name="Programs">
            {() => <ProgramsScreen {...programTabProps} />}
          </Tab.Screen>
          <Tab.Screen name="Timers">
            {() => <TimersScreen {...timerTabProps} />}
          </Tab.Screen>
          <Tab.Screen name="Calendar">
            {() => <CalendarScreen {...calendarTabProps} />}
          </Tab.Screen>
        </Tab.Navigator>
      </NavigationContainer>

      {/* Resume banner — floats over tab bar when a session is in progress */}
      {hasBanner && (
        <TouchableOpacity
          style={[s.resumeBanner, { bottom: 56 + insets.bottom + 8 }]}
          onPress={() => setShowSession(true)}
        >
          <View style={{ flex: 1 }}>
            <Text style={s.resumeName}>▶ {session.name}</Text>
            <Text style={s.resumeSub}>
              {session.exDone.filter(Boolean).length} / {session.timerIds.length} exercises done — tap to resume
            </Text>
          </View>
          <View style={[s.resumeBtn]}>
            <Text style={{ color: '#08221a', fontWeight: '700', fontSize: 12 }}>Resume</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Runner modal */}
      {run.active && (
        <RunnerModal
          run={run}
          setRun={setRunAndCheck}
          onFinished={handleRunFinished}
        />
      )}

      {/* Session modal */}
      <SessionModal
        visible={showSession && !run.active}
        onClose={() => setShowSession(false)}
        onStartExercise={handleStartExercise}
      />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <MainApp />
      </AppProvider>
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  header: {
    backgroundColor: C.bg,
    paddingHorizontal: 16,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: C.text, letterSpacing: -0.3 },
  version: { fontSize: 11, color: C.muted },
  headerBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
  },
  resumeBanner: {
    position: 'absolute',
    left: 12,
    right: 12,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.accent2,
    borderRadius: C.radius,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  resumeName: { fontWeight: '700', fontSize: 14, color: C.text },
  resumeSub: { fontSize: 12, color: C.muted, marginTop: 2 },
  resumeBtn: {
    backgroundColor: C.accent2,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
});
