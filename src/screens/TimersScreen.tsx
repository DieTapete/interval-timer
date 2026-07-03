import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert,
} from 'react-native';
import { C, PHASE_COLORS } from '../colors';
import { useApp } from '../context/AppContext';
import { fmt, timerDuration, roundDuration, buildSteps } from '../utils';
import { Timer, Phase, RunState } from '../types';
import { uid } from '../utils';

const EMPTY_FORM = (): Omit<Timer, 'id'> => ({
  name: '',
  sets: 1,
  phases: [
    { name: 'Work', seconds: 30, color: '' },
    { name: 'Rest', seconds: 10, color: '' },
  ],
});

interface Props {
  onRunSingle: (timer: Timer) => void;
}

export default function TimersScreen({ onRunSingle }: Props) {
  const { timers, saveTimer, deleteTimer } = useApp();
  const [form, setForm] = useState<Omit<Timer, 'id'>>(EMPTY_FORM());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const scrollRef = React.useRef<ScrollView>(null);

  const resetForm = useCallback(() => {
    setForm(EMPTY_FORM());
    setEditingId(null);
  }, []);

  const editTimer = useCallback((t: Timer) => {
    setEditingId(t.id);
    setForm({ name: t.name, sets: t.sets, phases: t.phases.map((p) => ({ ...p })) });
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, []);

  const handleSave = useCallback(() => {
    if (!form.name.trim()) {
      Alert.alert('Name required', 'Give the timer a name.');
      return;
    }
    const phases = form.phases
      .filter((p) => p.seconds > 0)
      .map((p) => ({ name: p.name || 'Phase', seconds: +p.seconds, color: p.color || '' }));
    if (!phases.length) {
      Alert.alert('No phases', 'Add at least one phase with a positive duration.');
      return;
    }
    saveTimer({ name: form.name.trim(), sets: Math.max(1, form.sets || 1), phases }, editingId);
    resetForm();
  }, [form, editingId, saveTimer, resetForm]);

  const updatePhase = useCallback((i: number, field: keyof Phase, value: string | number) => {
    setForm((f) => {
      const phases = f.phases.map((p, idx) => (idx === i ? { ...p, [field]: value } : p));
      return { ...f, phases };
    });
  }, []);

  const addPhase = useCallback(() => {
    setForm((f) => ({
      ...f,
      phases: [...f.phases, { name: 'Rest', seconds: 10, color: '' }],
    }));
  }, []);

  const removePhase = useCallback((i: number) => {
    setForm((f) => ({ ...f, phases: f.phases.filter((_, idx) => idx !== i) }));
  }, []);

  return (
    <ScrollView ref={scrollRef} style={s.root} contentContainerStyle={s.content}>
      {/* Form card */}
      <View style={s.card}>
        <Text style={s.cardTitle}>{editingId ? 'Edit timer' : 'New timer'}</Text>

        <Text style={s.label}>Name</Text>
        <TextInput
          style={s.input}
          placeholder="e.g. Burpees"
          placeholderTextColor={C.muted}
          value={form.name}
          onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
        />

        <Text style={[s.label, { marginTop: 12 }]}>Sets</Text>
        <TextInput
          style={[s.input, { width: 100 }]}
          keyboardType="number-pad"
          value={String(form.sets)}
          onChangeText={(v) => setForm((f) => ({ ...f, sets: parseInt(v) || 1 }))}
        />

        <Text style={[s.label, { marginTop: 12 }]}>Phases (one round)</Text>
        {form.phases.map((ph, i) => (
          <View key={i} style={s.phaseRow}>
            <View style={{ flex: 1 }}>
              {i === 0 && <Text style={s.label}>Phase name</Text>}
              <TextInput
                style={s.input}
                placeholder="Work / Rest"
                placeholderTextColor={C.muted}
                value={ph.name}
                onChangeText={(v) => updatePhase(i, 'name', v)}
              />
            </View>
            <View style={{ width: 80, marginLeft: 8 }}>
              {i === 0 && <Text style={s.label}>Seconds</Text>}
              <TextInput
                style={s.input}
                keyboardType="decimal-pad"
                value={String(ph.seconds)}
                onChangeText={(v) => updatePhase(i, 'seconds', parseFloat(v) || 0)}
              />
            </View>
            <View style={{ marginLeft: 8, marginTop: i === 0 ? 18 : 0 }}>
              {/* Color swatches */}
              <View style={s.colorRow}>
                {PHASE_COLORS.slice(0, 5).map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[
                      s.colorSwatch,
                      { backgroundColor: c || C.surface2, borderColor: c || C.border },
                      ph.color === c && s.colorSwatchActive,
                    ]}
                    onPress={() => updatePhase(i, 'color', c)}
                  >
                    {!c && <Text style={{ color: C.muted, fontSize: 10 }}>✕</Text>}
                  </TouchableOpacity>
                ))}
              </View>
              <View style={s.colorRow}>
                {PHASE_COLORS.slice(5).map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[
                      s.colorSwatch,
                      { backgroundColor: c || C.surface2 },
                      ph.color === c && s.colorSwatchActive,
                    ]}
                    onPress={() => updatePhase(i, 'color', c)}
                  />
                ))}
              </View>
            </View>
            {form.phases.length > 1 && (
              <TouchableOpacity
                style={[s.iconBtn, { marginLeft: 8, marginTop: i === 0 ? 18 : 0 }]}
                onPress={() => removePhase(i)}
              >
                <Text style={{ color: C.danger, fontSize: 14 }}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}

        <TouchableOpacity style={[s.btn, s.btnGhost, { marginTop: 10, alignSelf: 'flex-start' }]} onPress={addPhase}>
          <Text style={{ color: C.text, fontSize: 13, fontWeight: '600' }}>+ Add phase</Text>
        </TouchableOpacity>

        <Text style={[s.muted, { marginTop: 12 }]}>
          One round: <Text style={s.bold}>{fmt(roundDuration(form))}</Text>
          {'  ·  '}Total ({form.sets || 1} sets):{' '}
          <Text style={s.bold}>{fmt(roundDuration(form) * Math.max(1, form.sets || 1))}</Text>
        </Text>

        <View style={[s.row, { marginTop: 14 }]}>
          <TouchableOpacity style={[s.btn, s.btnPrimary]} onPress={handleSave}>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Save timer</Text>
          </TouchableOpacity>
          {editingId && (
            <TouchableOpacity style={[s.btn, s.btnGhost]} onPress={resetForm}>
              <Text style={{ color: C.text, fontSize: 13 }}>Cancel</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Saved timers */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Saved timers</Text>
        {timers.length === 0 && (
          <Text style={[s.muted, { textAlign: 'center', paddingVertical: 20 }]}>
            No timers yet. Create one above.
          </Text>
        )}
        {timers.map((t) => (
          <View key={t.id} style={s.listItem}>
            <View style={{ flex: 1 }}>
              <Text style={s.itemName}>{t.name}</Text>
              <Text style={s.itemSub}>
                {t.sets || 1} sets
                {t.phases.map((ph) => `  ·  ${ph.name} ${ph.seconds}s`).join('')}
                {'  ·  '}{fmt(timerDuration(t))}
              </Text>
            </View>
            <View style={s.row}>
              <TouchableOpacity style={[s.btn, s.btnGreen, s.btnSm]} onPress={() => onRunSingle(t)}>
                <Text style={{ color: '#08221a', fontWeight: '700', fontSize: 13 }}>▶</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btn, s.btnSm]} onPress={() => editTimer(t)}>
                <Text style={{ color: C.text, fontSize: 13 }}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.btn, s.btnSm, s.btnDanger]}
                onPress={() => {
                  if (confirmId === t.id) {
                    deleteTimer(t.id);
                    setConfirmId(null);
                  } else {
                    setConfirmId(t.id);
                    setTimeout(() => setConfirmId(null), 3000);
                  }
                }}
              >
                <Text style={{ color: C.danger, fontSize: 13 }}>
                  {confirmId === t.id ? 'Sure?' : 'Del'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, paddingBottom: 80 },
  card: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: C.radius,
    padding: 16,
    marginTop: 14,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 12 },
  label: { fontSize: 12, color: C.muted, fontWeight: '600', marginBottom: 4 },
  input: {
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    color: C.text,
    paddingHorizontal: 11,
    paddingVertical: 9,
    fontSize: 14,
  },
  phaseRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 8 },
  colorRow: { flexDirection: 'row', gap: 4, marginBottom: 3 },
  colorSwatch: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorSwatchActive: { borderWidth: 2, borderColor: C.text },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  btn: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: C.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: { backgroundColor: C.accent },
  btnGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: C.border },
  btnGreen: { backgroundColor: C.accent2 },
  btnDanger: { backgroundColor: 'transparent', borderWidth: 1, borderColor: C.border },
  btnSm: { paddingHorizontal: 10, paddingVertical: 6 },
  iconBtn: {
    padding: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  muted: { color: C.muted, fontSize: 13 },
  bold: { fontWeight: '700', color: C.text },
  listItem: {
    backgroundColor: C.surface2,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  itemName: { fontWeight: '700', fontSize: 14, color: C.text },
  itemSub: { fontSize: 12, color: C.muted, marginTop: 2 },
});
