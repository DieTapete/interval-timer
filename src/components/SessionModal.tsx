import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, Modal, Alert,
} from 'react-native';
import { C } from '../colors';
import { useApp } from '../context/AppContext';
import { fmt, timerDuration } from '../utils';
import { Timer } from '../types';

interface Props {
  visible: boolean;
  onClose: () => void;
  onStartExercise: (timer: Timer, exIndex: number) => void;
}

export default function SessionModal({ visible, onClose, onStartExercise }: Props) {
  const { timers, session, finishSession, abandonSession } = useApp();
  const [confirmAbandon, setConfirmAbandon] = useState(false);

  const sessionTimers = (session?.timerIds ?? [])
    .map((id) => timers.find((t) => t.id === id))
    .filter((t): t is Timer => Boolean(t));

  const doneCount = session?.exDone.filter(Boolean).length ?? 0;
  const total = session?.timerIds.length ?? 0;
  const allDone = doneCount === total && total > 0;

  const handleFinish = useCallback(() => {
    finishSession();
    onClose();
  }, [finishSession, onClose]);

  const handleAbandon = useCallback(() => {
    if (confirmAbandon) {
      abandonSession();
      onClose();
      setConfirmAbandon(false);
    } else {
      setConfirmAbandon(true);
      setTimeout(() => setConfirmAbandon(false), 3000);
    }
  }, [confirmAbandon, abandonSession, onClose]);

  if (!session) return null;

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent>
      <ScrollView style={s.root} contentContainerStyle={s.content}>
        <View style={s.top}>
          <TouchableOpacity style={s.backBtn} onPress={onClose}>
            <Text style={{ color: C.text }}>‹ Back</Text>
          </TouchableOpacity>
          <Text style={s.counter}>{doneCount} / {total}</Text>
        </View>

        <Text style={s.title}>{session.name}</Text>
        <Text style={s.muted}>Start each exercise when you're ready.</Text>

        {sessionTimers.map((t, i) => {
          const done = session.exDone[i];
          return (
            <View key={i} style={[s.exItem, done && s.exDone]}>
              <View style={[s.exNum, done && { backgroundColor: C.accent2 }]}>
                <Text style={{ fontWeight: '800', fontSize: 13, color: done ? '#08221a' : C.text }}>
                  {done ? '✓' : i + 1}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.exName}>{t.name}</Text>
                <Text style={s.exSub}>{t.sets || 1} sets  ·  {fmt(timerDuration(t))}</Text>
              </View>
              {!done ? (
                <TouchableOpacity style={[s.btn, s.btnGreen, s.btnSm]} onPress={() => onStartExercise(t, i)}>
                  <Text style={{ color: '#08221a', fontWeight: '700', fontSize: 13 }}>▶ Start</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={[s.btn, s.btnGhost, s.btnSm]} onPress={() => onStartExercise(t, i)}>
                  <Text style={{ color: C.text, fontSize: 13 }}>Redo</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}

        {allDone && (
          <View style={s.doneCard}>
            <Text style={s.doneText}>🎉 All exercises done!</Text>
            <TouchableOpacity style={[s.btn, s.btnGreen, { marginTop: 12 }]} onPress={handleFinish}>
              <Text style={{ color: '#08221a', fontWeight: '700', fontSize: 15 }}>Finish & log it</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ marginTop: 18 }}>
          <TouchableOpacity
            style={[s.btn, s.btnDanger, { alignSelf: 'flex-start' }]}
            onPress={handleAbandon}
          >
            <Text style={{ color: C.danger, fontSize: 13 }}>
              {confirmAbandon ? 'Sure? Discard progress' : 'Abandon program'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  content: { padding: 18, paddingBottom: 60 },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    marginTop: 8,
  },
  backBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
  },
  counter: { color: C.muted, fontSize: 14 },
  title: { fontSize: 26, fontWeight: '800', color: C.text, marginBottom: 4 },
  muted: { color: C.muted, fontSize: 14, marginBottom: 10 },
  exItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
  },
  exDone: { opacity: 0.6 },
  exNum: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: C.surface2,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  exName: { fontWeight: '700', fontSize: 15, color: C.text },
  exSub: { fontSize: 12, color: C.muted, marginTop: 2 },
  doneCard: {
    marginTop: 16,
    backgroundColor: C.surface2,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: C.radius,
    padding: 16,
    alignItems: 'center',
  },
  doneText: { fontSize: 22, fontWeight: '800', color: C.text },
  btn: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: C.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGreen: { backgroundColor: C.accent2 },
  btnGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: C.border },
  btnDanger: { backgroundColor: 'transparent', borderWidth: 1, borderColor: C.border },
  btnSm: { paddingHorizontal: 10, paddingVertical: 6 },
});
