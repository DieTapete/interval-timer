import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
} from 'react-native';
import { C } from '../colors';
import { useApp } from '../context/AppContext';
import { dateKey } from '../utils';

const DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

interface Props {
  onResumeSession: () => void;
}

export default function CalendarScreen({ onResumeSession }: Props) {
  const { log, programs, timers, session, deleteLog } = useApp();
  const now = new Date();
  const [calY, setCalY] = useState(now.getFullYear());
  const [calM, setCalM] = useState(now.getMonth());
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<number | null>(null);

  const shiftMonth = useCallback((n: number) => {
    setCalY((y) => {
      let m2 = calM + n;
      if (m2 < 0) { setCalM(11); return y - 1; }
      if (m2 > 11) { setCalM(0); return y + 1; }
      setCalM(m2);
      return y;
    });
    setSelected(null);
    setDetail(null);
  }, [calM]);

  const calLabel = () =>
    new Date(calY, calM, 1).toLocaleString(undefined, { month: 'long', year: 'numeric' });

  const todayKey = dateKey(now);
  const pendingKey = session ? dateKey(new Date(session.startedTs)) : null;

  const calCells = () => {
    const first = new Date(calY, calM, 1);
    const lead = (first.getDay() + 6) % 7;
    const days = new Date(calY, calM + 1, 0).getDate();
    const cells: Array<null | {
      day: number; key: string; isToday: boolean;
      sessions: typeof log; hasPending: boolean;
    }> = [];
    for (let i = 0; i < lead; i++) cells.push(null);
    for (let day = 1; day <= days; day++) {
      const key =
        calY + '-' + String(calM + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
      cells.push({
        day,
        key,
        isToday: key === todayKey,
        sessions: log.filter((l) => l.date === key),
        hasPending: key === pendingKey,
      });
    }
    return cells;
  };

  const totalSessions = log.length;
  const thisMonthCount = log.filter((l) => {
    const d = new Date(l.ts);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
  const currentStreak = () => {
    if (!log.length) return 0;
    const days = new Set(log.map((l) => l.date));
    let streak = 0;
    const d = new Date();
    while (days.has(dateKey(d))) { streak++; d.setDate(d.getDate() - 1); }
    if (streak === 0) {
      d.setDate(now.getDate() - 1);
      while (days.has(dateKey(d))) { streak++; d.setDate(d.getDate() - 1); }
    }
    return streak;
  };

  const selectedItems = () => {
    if (!selected) return [];
    const items = log
      .filter((l) => l.date === selected)
      .sort((a, b) => b.ts - a.ts)
      .map((l) => ({ ...l, pending: false as boolean, exDone: [] as boolean[], timerIds: [] as string[] }));
    if (session) {
      const pk = dateKey(new Date(session.startedTs));
      if (pk === selected) {
        items.unshift({
          ts: session.startedTs,
          name: session.name,
          programId: session.programId,
          date: pk,
          pending: true,
          exDone: [...session.exDone],
          timerIds: [...session.timerIds],
        });
      }
    }
    return items;
  };

  const sessionTimers = (item: ReturnType<typeof selectedItems>[number]) => {
    if (item.pending) {
      return item.timerIds.map((id, i) => ({
        name: timers.find((t) => t.id === id)?.name ?? '(deleted)',
        done: item.exDone[i],
      }));
    }
    const prog = programs.find((p) => p.id === item.programId);
    if (prog) {
      return prog.timerIds.map((id) => ({
        name: timers.find((t) => t.id === id)?.name ?? '(deleted)',
        done: true,
      }));
    }
    return [];
  };

  const recentLog = [...log].sort((a, b) => b.ts - a.ts).slice(0, 12);
  const cells = calCells();

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content}>
      {/* Stats */}
      <View style={s.card}>
        <View style={s.statRow}>
          <View style={s.stat}>
            <Text style={s.statN}>{totalSessions}</Text>
            <Text style={s.statL}>Sessions</Text>
          </View>
          <View style={s.stat}>
            <Text style={s.statN}>{currentStreak()}</Text>
            <Text style={s.statL}>Day streak</Text>
          </View>
          <View style={s.stat}>
            <Text style={s.statN}>{thisMonthCount}</Text>
            <Text style={s.statL}>This month</Text>
          </View>
        </View>
      </View>

      {/* Calendar */}
      <View style={s.card}>
        <View style={s.calHead}>
          <TouchableOpacity style={s.calNavBtn} onPress={() => shiftMonth(-1)}>
            <Text style={{ color: C.text }}>‹</Text>
          </TouchableOpacity>
          <Text style={{ color: C.text, fontWeight: '700' }}>{calLabel()}</Text>
          <TouchableOpacity style={s.calNavBtn} onPress={() => shiftMonth(1)}>
            <Text style={{ color: C.text }}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={s.calGrid}>
          {DAYS.map((d) => (
            <View key={d} style={s.calDow}>
              <Text style={[s.muted, { fontSize: 11, fontWeight: '700', textAlign: 'center' }]}>{d}</Text>
            </View>
          ))}
          {cells.map((cell, i) =>
            cell === null ? (
              <View key={`e${i}`} style={s.calEmpty} />
            ) : (
              <TouchableOpacity
                key={cell.key}
                style={[
                  s.calCell,
                  cell.isToday && s.calCellToday,
                  (cell.sessions.length || cell.hasPending) && s.calCellHas,
                  selected === cell.key && s.calCellSelected,
                ]}
                onPress={() => {
                  setSelected((prev) => (prev === cell.key ? null : cell.key));
                  setDetail(null);
                }}
              >
                <Text style={[s.calDayNum, (cell.sessions.length || cell.hasPending) && { color: C.text }]}>
                  {cell.day}
                </Text>
                <View style={s.dots}>
                  {cell.sessions.slice(0, 6).map((_, si) => (
                    <View key={si} style={s.dot} />
                  ))}
                  {cell.hasPending && <View style={[s.dot, { backgroundColor: C.warn }]} />}
                </View>
              </TouchableOpacity>
            ),
          )}
        </View>

        <View style={[s.row, { marginTop: 12 }]}>
          <View style={[s.dot, { backgroundColor: C.accent2 }]} />
          <Text style={s.muted}> completed  </Text>
          <View style={[s.dot, { backgroundColor: C.warn }]} />
          <Text style={s.muted}> in progress</Text>
        </View>
      </View>

      {/* Day detail / recent log */}
      <View style={s.card}>
        {selected ? (
          <>
            <View style={[s.row, { justifyContent: 'space-between', marginBottom: 12 }]}>
              <Text style={s.cardTitle}>
                {(() => {
                  const [y, m, d] = selected.split('-');
                  return new Date(+y, +m - 1, +d).toLocaleDateString(undefined, {
                    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
                  });
                })()}
              </Text>
              <TouchableOpacity onPress={() => setSelected(null)}>
                <Text style={s.muted}>✕ Clear</Text>
              </TouchableOpacity>
            </View>
            {selectedItems().length === 0 && (
              <Text style={[s.muted, { textAlign: 'center', paddingVertical: 20 }]}>
                No sessions on this day.
              </Text>
            )}
            {selectedItems().map((item) => {
              const trs = sessionTimers(item);
              const isOpen = detail === item.ts;
              return (
                <View key={item.ts}>
                  <TouchableOpacity
                    style={[s.listItem, item.pending && { borderColor: C.warn }]}
                    onPress={() => setDetail((d) => (d === item.ts ? null : item.ts))}
                  >
                    <View style={{ flex: 1 }}>
                      <View style={[s.row, { gap: 6 }]}>
                        {item.pending && (
                          <View style={[s.dot, { backgroundColor: C.warn, flexShrink: 0 }]} />
                        )}
                        <Text style={s.itemName}>{item.name}</Text>
                      </View>
                      <Text style={s.itemSub}>{new Date(item.ts).toLocaleString()}</Text>
                      {item.pending && <Text style={[s.itemSub, { color: C.warn }]}>· In progress</Text>}
                    </View>
                    <View style={[s.row, { gap: 6 }]}>
                      {item.pending ? (
                        <TouchableOpacity
                          style={[s.btn, s.btnGreen, s.btnSm]}
                          onPress={(e) => { e.stopPropagation?.(); onResumeSession(); }}
                        >
                          <Text style={{ color: '#08221a', fontWeight: '700', fontSize: 12 }}>▶ Resume</Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          style={[s.btn, s.btnDanger, s.btnSm]}
                          onPress={(e) => { e.stopPropagation?.(); deleteLog(item.ts); }}
                        >
                          <Text style={{ color: C.danger, fontSize: 12 }}>✕</Text>
                        </TouchableOpacity>
                      )}
                      {trs.length > 0 && (
                        <Text style={s.muted}>{isOpen ? '▲' : '▼'}</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                  {isOpen && trs.length > 0 && (
                    <View style={s.detailBox}>
                      {trs.map((tr, ti) => (
                        <View key={ti} style={[s.row, { gap: 8, paddingVertical: 4 }]}>
                          <View style={[s.exNum, tr.done && { backgroundColor: C.accent2 }]}>
                            <Text style={{ fontSize: 10, fontWeight: '800', color: tr.done ? '#08221a' : C.muted }}>
                              {tr.done ? '✓' : '○'}
                            </Text>
                          </View>
                          <Text style={{ fontSize: 13, color: tr.done ? C.text : C.muted }}>{tr.name}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
          </>
        ) : (
          <>
            <Text style={s.cardTitle}>Recent sessions</Text>
            {recentLog.length === 0 && (
              <Text style={[s.muted, { textAlign: 'center', paddingVertical: 20 }]}>
                Complete a program to see it here.
              </Text>
            )}
            {recentLog.map((item) => {
              const prog = programs.find((p) => p.id === item.programId);
              const trs = prog
                ? prog.timerIds.map((id) => ({ name: timers.find((t) => t.id === id)?.name ?? '(deleted)', done: true }))
                : [];
              const isOpen = detail === item.ts;
              return (
                <View key={item.ts}>
                  <TouchableOpacity
                    style={s.listItem}
                    onPress={() => setDetail((d) => (d === item.ts ? null : item.ts))}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={s.itemName}>{item.name}</Text>
                      <Text style={s.itemSub}>{new Date(item.ts).toLocaleString()}</Text>
                    </View>
                    <View style={[s.row, { gap: 6 }]}>
                      <TouchableOpacity
                        style={[s.btn, s.btnDanger, s.btnSm]}
                        onPress={(e) => { e.stopPropagation?.(); deleteLog(item.ts); }}
                      >
                        <Text style={{ color: C.danger, fontSize: 12 }}>✕</Text>
                      </TouchableOpacity>
                      {trs.length > 0 && <Text style={s.muted}>{isOpen ? '▲' : '▼'}</Text>}
                    </View>
                  </TouchableOpacity>
                  {isOpen && trs.length > 0 && (
                    <View style={s.detailBox}>
                      {trs.map((tr, ti) => (
                        <View key={ti} style={[s.row, { gap: 8, paddingVertical: 4 }]}>
                          <View style={[s.exNum, { backgroundColor: C.accent2 }]}>
                            <Text style={{ fontSize: 10, fontWeight: '800', color: '#08221a' }}>✓</Text>
                          </View>
                          <Text style={{ fontSize: 13, color: C.text }}>{tr.name}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
          </>
        )}
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
  muted: { color: C.muted, fontSize: 13 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  statRow: { flexDirection: 'row', gap: 10 },
  stat: {
    flex: 1,
    backgroundColor: C.surface2,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  statN: { fontSize: 24, fontWeight: '800', color: C.text },
  statL: { fontSize: 11, color: C.muted },
  calHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  calNavBtn: {
    paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: 'transparent',
    borderWidth: 1, borderColor: C.border, borderRadius: 8,
  },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  calDow: { width: '13%', paddingBottom: 4 },
  calCell: {
    width: '13%',
    aspectRatio: 1,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 9,
    backgroundColor: C.bg,
    padding: 4,
    position: 'relative',
  },
  calEmpty: { width: '13%', aspectRatio: 1 },
  calCellToday: { borderColor: C.accent },
  calCellHas: { backgroundColor: C.surface2 },
  calCellSelected: { borderColor: C.accent, borderWidth: 2, backgroundColor: C.surface2 },
  calDayNum: { fontSize: 11, color: C.muted },
  dots: { flexDirection: 'row', flexWrap: 'wrap', gap: 2, position: 'absolute', bottom: 3, left: 3 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.accent2 },
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
  btn: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: C.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGreen: { backgroundColor: C.accent2 },
  btnDanger: { backgroundColor: 'transparent', borderWidth: 1, borderColor: C.border },
  btnSm: { paddingHorizontal: 10, paddingVertical: 6 },
  detailBox: {
    backgroundColor: C.surface2,
    borderWidth: 1,
    borderColor: C.border,
    borderTopWidth: 0,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: -2,
    marginBottom: 2,
  },
  exNum: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: C.surface,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
