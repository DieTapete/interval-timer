import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, Modal, FlatList,
} from 'react-native';
import { C } from '../colors';
import { useApp } from '../context/AppContext';
import { fmt, timerDuration, programDuration } from '../utils';
import { Program } from '../types';

interface Props {
  onStartProgram: (p: Program) => void;
  onResumeSession: () => void;
}

export default function ProgramsScreen({ onStartProgram, onResumeSession }: Props) {
  const { timers, programs, log, session, saveProgram, deleteProgram } = useApp();
  const [form, setForm] = useState<Omit<Program, 'id'>>({ name: '', timerIds: [] });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const scrollRef = React.useRef<ScrollView>(null);

  const resetForm = useCallback(() => {
    setForm({ name: '', timerIds: [] });
    setEditingId(null);
  }, []);

  const editProgram = useCallback(
    (p: Program) => {
      setEditingId(p.id);
      setForm({ name: p.name, timerIds: [...p.timerIds] });
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    },
    [],
  );

  const handleSave = useCallback(() => {
    if (!form.name.trim()) {
      Alert.alert('Name required', 'Give the program a name.');
      return;
    }
    if (!form.timerIds.length) {
      Alert.alert('No timers', 'Add at least one timer.');
      return;
    }
    saveProgram({ name: form.name.trim(), timerIds: [...form.timerIds] }, editingId);
    resetForm();
  }, [form, editingId, saveProgram, resetForm]);

  const addTimer = useCallback((id: string) => {
    setForm((f) => ({ ...f, timerIds: [...f.timerIds, id] }));
    setPickerVisible(false);
  }, []);

  const moveTimer = useCallback((i: number, dir: number) => {
    setForm((f) => {
      const arr = [...f.timerIds];
      const j = i + dir;
      if (j < 0 || j >= arr.length) return f;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return { ...f, timerIds: arr };
    });
  }, []);

  const removeTimer = useCallback((i: number) => {
    setForm((f) => ({ ...f, timerIds: f.timerIds.filter((_, idx) => idx !== i) }));
  }, []);

  const completionCount = useCallback(
    (pid: string) => log.filter((l) => l.programId === pid).length,
    [log],
  );

  const timerName = useCallback(
    (id: string) => timers.find((t) => t.id === id)?.name ?? '(deleted)',
    [timers],
  );

  const totalForm = programDuration(form.timerIds, timers);

  return (
    <ScrollView ref={scrollRef} style={s.root} contentContainerStyle={s.content}>
      {/* Form card */}
      <View style={s.card}>
        <Text style={s.cardTitle}>{editingId ? 'Edit program' : 'New program'}</Text>

        <Text style={s.label}>Program name</Text>
        <TextInput
          style={s.input}
          placeholder="e.g. Morning Routine"
          placeholderTextColor={C.muted}
          value={form.name}
          onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
        />

        <View style={s.sep} />

        <Text style={[s.label, { marginBottom: 8 }]}>Add timers to this program</Text>
        {timers.length === 0 ? (
          <Text style={s.muted}>Create timers in the Timers tab first.</Text>
        ) : (
          <TouchableOpacity style={[s.btn, s.btnPrimary, { alignSelf: 'flex-start' }]} onPress={() => setPickerVisible(true)}>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>+ Add timer</Text>
          </TouchableOpacity>
        )}

        {form.timerIds.length === 0 && (
          <Text style={[s.muted, { marginTop: 10 }]}>No timers added yet.</Text>
        )}
        {form.timerIds.map((tid, idx) => (
          <View key={idx} style={s.chip}>
            <Text style={[s.muted, { flex: 1, fontSize: 13, color: C.text }]}>
              {idx + 1}. {timerName(tid)}
            </Text>
            <TouchableOpacity style={s.iconBtn} onPress={() => moveTimer(idx, -1)} disabled={idx === 0}>
              <Text style={{ color: idx === 0 ? C.border : C.text, fontSize: 13 }}>↑</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.iconBtn}
              onPress={() => moveTimer(idx, 1)}
              disabled={idx === form.timerIds.length - 1}
            >
              <Text style={{ color: idx === form.timerIds.length - 1 ? C.border : C.text, fontSize: 13 }}>↓</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.iconBtn} onPress={() => removeTimer(idx)}>
              <Text style={{ color: C.danger, fontSize: 13 }}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}

        {form.timerIds.length > 0 && (
          <Text style={[s.muted, { marginTop: 12 }]}>
            Total: <Text style={{ color: C.text, fontWeight: '700' }}>{fmt(totalForm)}</Text>
          </Text>
        )}

        <View style={[s.row, { marginTop: 14 }]}>
          <TouchableOpacity
            style={[s.btn, s.btnPrimary, (!form.name || !form.timerIds.length) && { opacity: 0.4 }]}
            onPress={handleSave}
            disabled={!form.name || !form.timerIds.length}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Save program</Text>
          </TouchableOpacity>
          {editingId && (
            <TouchableOpacity style={[s.btn, s.btnGhost]} onPress={resetForm}>
              <Text style={{ color: C.text, fontSize: 13 }}>Cancel</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Programs list */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Your programs</Text>
        {programs.length === 0 && (
          <Text style={[s.muted, { textAlign: 'center', paddingVertical: 20 }]}>
            No programs yet. Build one from your timers.
          </Text>
        )}
        {programs.map((p) => (
          <View key={p.id} style={s.listItem}>
            <View style={{ flex: 1 }}>
              <Text style={s.itemName}>{p.name}</Text>
              <Text style={s.itemSub}>
                {p.timerIds.length} timers  ·  {fmt(programDuration(p.timerIds, timers))}  ·  {completionCount(p.id)}× done
              </Text>
            </View>
            <View style={s.row}>
              {session && session.programId === p.id ? (
                <TouchableOpacity style={[s.btn, s.btnGreen, s.btnSm]} onPress={onResumeSession}>
                  <Text style={{ color: '#08221a', fontWeight: '700', fontSize: 13 }}>↻ Resume</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={[s.btn, s.btnGreen, s.btnSm]} onPress={() => onStartProgram(p)}>
                  <Text style={{ color: '#08221a', fontWeight: '700', fontSize: 13 }}>▶ Start</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={[s.btn, s.btnSm]} onPress={() => editProgram(p)}>
                <Text style={{ color: C.text, fontSize: 13 }}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.btn, s.btnSm, s.btnDanger]}
                onPress={() => {
                  if (confirmId === p.id) {
                    deleteProgram(p.id);
                    setConfirmId(null);
                  } else {
                    setConfirmId(p.id);
                    setTimeout(() => setConfirmId(null), 3000);
                  }
                }}
              >
                <Text style={{ color: C.danger, fontSize: 13 }}>
                  {confirmId === p.id ? 'Sure?' : 'Del'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>

      {/* Timer picker modal */}
      <Modal visible={pickerVisible} transparent animationType="slide" onRequestClose={() => setPickerVisible(false)}>
        <View style={s.pickerOverlay}>
          <View style={s.pickerSheet}>
            <View style={[s.row, { justifyContent: 'space-between', marginBottom: 12 }]}>
              <Text style={[s.cardTitle, { marginBottom: 0 }]}>Pick a timer</Text>
              <TouchableOpacity onPress={() => setPickerVisible(false)}>
                <Text style={{ color: C.muted, fontSize: 20 }}>✕</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={timers}
              keyExtractor={(t) => t.id}
              renderItem={({ item }) => (
                <TouchableOpacity style={s.listItem} onPress={() => addTimer(item.id)}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.itemName}>{item.name}</Text>
                    <Text style={s.itemSub}>{item.sets || 1} sets  ·  {fmt(timerDuration(item))}</Text>
                  </View>
                  <Text style={{ color: C.accent, fontSize: 20 }}>+</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
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
  sep: { height: 1, backgroundColor: C.border, marginVertical: 14 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
  },
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
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    backgroundColor: C.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '70%',
  },
});
