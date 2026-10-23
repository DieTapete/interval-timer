import React, { useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, Dimensions,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { C } from '../colors';
import { RunState } from '../types';
import { fmtClock } from '../utils';

const { width } = Dimensions.get('window');

interface Props {
  run: RunState;
  setRun: (r: RunState) => void;
  onFinished: (logOnFinish: boolean, label: string, programId: string | null, exIndex: number | null) => void;
}

export default function RunnerModal({ run, setRun, onFinished }: Props) {
  const runRef = useRef<RunState>(run);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastRef = useRef<number>(0);
  const finishedCallbackRef = useRef(onFinished);
  finishedCallbackRef.current = onFinished;

  // Keep ref in sync with state for use in the interval
  useEffect(() => {
    runRef.current = run;
  }, [run]);

  const stopTick = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  const advance = useCallback(() => {
    const cur = runRef.current;
    if (!cur.active) return;
    const nextIdx = cur.idx + 1;
    if (nextIdx >= cur.steps.length) {
      // Finish
      stopTick();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const next: RunState = { ...cur, finished: true };
      runRef.current = next;
      setRun(next);
      finishedCallbackRef.current(cur.logOnFinish, cur.label, cur.programId, cur.exIndex);
      return;
    }
    const step = cur.steps[nextIdx];
    const sn = step.setNum, pps = step.phasesPerSet, ts = cur.totalSets;
    const setPct = sn > 0 && pps > 0 && ts > 0
      ? ((sn - 1) * pps + step.phaseInSet) / (ts * pps) * 100
      : 0;

    const next: RunState = {
      ...cur,
      idx: nextIdx,
      remaining: step.seconds,
      kind: step.kind,
      phaseName: step.name,
      contextLabel: step.ctx,
      upNext: cur.steps[nextIdx + 1]?.name ?? '',
      pct: 0,
      setNum: step.setNum,
      setPct,
    };
    runRef.current = next;
    setRun(next);

    if (step.kind === 'rest') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else if (step.kind === 'work') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
  }, [stopTick]);

  const startTick = useCallback(() => {
    stopTick();
    lastRef.current = Date.now();
    tickRef.current = setInterval(() => {
      const r = runRef.current;
      if (!r.active || r.paused || r.finished) {
        lastRef.current = Date.now();
        return;
      }
      const now = Date.now();
      const dt = (now - lastRef.current) / 1000;
      lastRef.current = now;

      const newRemaining = r.remaining - dt;
      const cur = r.steps[r.idx];
      const pct = Math.min(100, (1 - newRemaining / cur.seconds) * 100);
      const sn = cur.setNum, pip = cur.phaseInSet, pps = cur.phasesPerSet, ts = r.totalSets;
      const setPct = sn > 0 && pps > 0 && ts > 0
        ? Math.min(100, ((sn - 1) * pps + pip + (1 - newRemaining / cur.seconds)) / (ts * pps) * 100)
        : r.setPct;

      // Countdown beeps at 3, 2, 1 — use haptics
      const prevCeil = Math.ceil(r.remaining);
      const newCeil = Math.ceil(newRemaining);
      if (newRemaining > 0 && newRemaining <= 3.999 && newCeil !== prevCeil) {
        Haptics.selectionAsync();
      }

      if (newRemaining <= 0) {
        advance();
        return;
      }

      const next: RunState = { ...r, remaining: newRemaining, pct, setPct };
      runRef.current = next;
      setRun(next);
    }, 50);
  }, [stopTick, advance]);

  // Start ticking whenever run becomes active
  useEffect(() => {
    if (run.active && !run.finished) {
      startTick();
    } else {
      stopTick();
    }
    return stopTick;
  }, [run.active, run.finished]);

  const togglePause = useCallback(() => {
    const r = runRef.current;
    if (!r.active) return;
    const next: RunState = { ...r, paused: !r.paused };
    runRef.current = next;
    setRun(next);
    if (!r.paused) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }, [setRun]);

  const skipPhase = useCallback(() => {
    const r = runRef.current;
    if (!r.active) return;
    const next: RunState = { ...r, remaining: 0 };
    runRef.current = next;
    // advance will be called by next tick
  }, []);

  const exitRun = useCallback(() => {
    stopTick();
    setRun({ active: false });
  }, [stopTick, setRun]);

  const startFromPrep = useCallback(() => {
    const r = runRef.current;
    if (!r.active) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const next: RunState = { ...r, paused: false };
    runRef.current = next;
    setRun(next);
  }, [setRun]);

  if (!run.active) return null;

  const activeRun = run;
  const step = activeRun.steps[activeRun.idx];

  const kindColor =
    activeRun.kind === 'rest' ? C.accent2 :
    activeRun.kind === 'prep' ? C.warn :
    C.accent;

  const bgColor = step?.color || C.bg;
  const borderColor = step?.color || kindColor;

  const isPreStart = activeRun.idx === 0 && activeRun.paused && activeRun.pct === 0;

  return (
    <Modal visible animationType="slide" statusBarTranslucent>
      <View style={[s.root, { backgroundColor: bgColor, borderColor }]}>
        {activeRun.finished ? (
          <View style={s.doneScreen}>
            <Text style={s.doneBig}>✓ Complete</Text>
            <Text style={s.muted}>{activeRun.label}</Text>
            <TouchableOpacity style={[s.btn, s.btnGreen, { marginTop: 22 }]} onPress={exitRun}>
              <Text style={{ color: '#08221a', fontWeight: '700', fontSize: 16 }}>
                {activeRun.returnTo === 'session' ? 'Back to program' : 'Done'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={s.inner}>
            <Text style={s.stage}>{activeRun.contextLabel}</Text>
            <Text style={s.phaseName}>{activeRun.phaseName}</Text>
            <Text style={[s.time, { color: step?.color ? '#fff' : kindColor }]}>
              {fmtClock(activeRun.remaining, step?.seconds ?? 0)}
            </Text>
            <Text style={s.upNext}>
              {activeRun.upNext ? 'Next: ' + activeRun.upNext : 'Last one!'}
            </Text>

            {/* Progress bar */}
            <View style={s.progressTrack}>
              <View style={[s.progressBar, { width: `${activeRun.pct}%`, backgroundColor: step?.color ? '#fff' : kindColor }]} />
            </View>

            {/* Sets progress */}
            {activeRun.totalSets > 1 && (
              <View style={[s.progressTrack, { marginTop: 8 }]}>
                <View style={[s.progressBar, { width: `${activeRun.setPct}%`, backgroundColor: C.accent2 }]} />
              </View>
            )}
            {activeRun.totalSets > 1 && (
              <View style={[s.row, { justifyContent: 'space-between', marginTop: 4 }]}>
                <Text style={s.muted}>Sets</Text>
                <Text style={s.muted}>{activeRun.setNum} / {activeRun.totalSets}</Text>
              </View>
            )}

            {isPreStart ? (
              <View style={[s.controls, { marginTop: 32 }]}>
                <TouchableOpacity style={[s.btn, s.btnGreen, { paddingHorizontal: 28, paddingVertical: 14 }]} onPress={startFromPrep}>
                  <Text style={{ color: '#08221a', fontWeight: '700', fontSize: 18 }}>▶ Start</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.btn, s.btnGhost]} onPress={exitRun}>
                  <Text style={{ color: C.text }}>
                    {activeRun.returnTo === 'session' ? '‹ Back' : 'Cancel'}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={[s.controls, { marginTop: 26 }]}>
                <TouchableOpacity style={[s.btn, s.btnGhost]} onPress={togglePause}>
                  <Text style={{ color: C.text }}>{activeRun.paused ? '▶ Resume' : '⏸ Pause'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.btn, s.btnGhost]} onPress={skipPhase}>
                  <Text style={{ color: C.text }}>⏭ Skip</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.btn, s.btnDanger]} onPress={exitRun}>
                  <Text style={{ color: C.danger }}>
                    {activeRun.returnTo === 'session' ? '‹ Back' : 'Stop'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 6,
  },
  inner: { width: '100%', maxWidth: 480, alignItems: 'center', padding: 24 },
  stage: {
    fontSize: 13,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: C.muted,
    marginBottom: 6,
  },
  phaseName: { fontSize: 30, fontWeight: '800', color: C.text, marginBottom: 8, textAlign: 'center' },
  time: {
    fontSize: 96,
    fontWeight: '800',
    lineHeight: 100,
    marginVertical: 8,
    fontVariant: ['tabular-nums'],
  },
  upNext: { color: C.muted, fontSize: 14, marginTop: 4, minHeight: 20 },
  progressTrack: {
    width: width - 80,
    maxWidth: 420,
    height: 8,
    backgroundColor: C.surface2,
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: 22,
  },
  progressBar: { height: '100%', borderRadius: 999 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  controls: { flexDirection: 'row', gap: 12, flexWrap: 'wrap', justifyContent: 'center' },
  btn: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: C.surface2,
  },
  btnGreen: { backgroundColor: C.accent2 },
  btnGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: C.border },
  btnDanger: { backgroundColor: 'transparent', borderWidth: 1, borderColor: C.border },
  doneScreen: { alignItems: 'center' },
  doneBig: { fontSize: 40, fontWeight: '800', color: C.text },
  muted: { color: C.muted, fontSize: 14, marginTop: 8 },
});
