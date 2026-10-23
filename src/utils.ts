import { Timer, Program, RunStep } from './types';

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function dateKey(d: Date): string {
  return (
    d.getFullYear() +
    '-' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getDate()).padStart(2, '0')
  );
}

export function fmt(s: number): string {
  s = Math.round(s);
  const m = Math.floor(s / 60);
  const x = s % 60;
  return m ? m + 'm ' + (x ? x + 's' : '') : x + 's';
}

export function fmtClock(s: number, total: number): string {
  if (total < 1) return Math.max(0, s).toFixed(1);
  s = Math.max(0, Math.ceil(s));
  if (total < 60) return String(s);
  const m = Math.floor(s / 60);
  const x = s % 60;
  return m + ':' + String(x).padStart(2, '0');
}

export function roundDuration(t: Pick<Timer, 'phases'>): number {
  return (t.phases || []).reduce((a, p) => a + (p.seconds || 0), 0);
}

export function timerDuration(t: Timer): number {
  return roundDuration(t) * Math.max(1, t.sets || 1);
}

export function programDuration(ids: string[], timers: Timer[]): number {
  return ids.reduce((a, id) => {
    const t = timers.find((x) => x.id === id);
    return a + (t ? timerDuration(t) : 0);
  }, 0);
}

export function buildSteps(timer: Timer): RunStep[] {
  const sets = Math.max(1, timer.sets || 1);
  const pps = timer.phases.length;
  const steps: RunStep[] = [
    {
      name: 'Get ready',
      seconds: 3,
      kind: 'prep',
      ctx: 'Starting',
      setNum: 0,
      phaseInSet: 0,
      phasesPerSet: pps,
      color: '',
    },
  ];
  for (let s = 1; s <= sets; s++) {
    timer.phases.forEach((ph, i) => {
      const isRest = /rest|pause|break/i.test(ph.name);
      steps.push({
        name: ph.name,
        seconds: ph.seconds,
        kind: isRest ? 'rest' : 'work',
        ctx: timer.name + (sets > 1 ? ' · set ' + s + '/' + sets : ''),
        setNum: s,
        phaseInSet: i,
        phasesPerSet: pps,
        color: ph.color || '',
      });
    });
  }
  return steps;
}
