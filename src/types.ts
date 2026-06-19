export interface Phase {
  name: string;
  seconds: number;
  color: string;
}

export interface Timer {
  id: string;
  name: string;
  sets: number;
  phases: Phase[];
}

export interface Program {
  id: string;
  name: string;
  timerIds: string[];
}

export interface LogEntry {
  ts: number;
  programId: string | null;
  name: string;
  date: string;
}

export interface Session {
  programId: string;
  name: string;
  timerIds: string[];
  exDone: boolean[];
  startedTs: number;
}

export interface RunStep {
  name: string;
  seconds: number;
  kind: 'prep' | 'work' | 'rest';
  ctx: string;
  setNum: number;
  phaseInSet: number;
  phasesPerSet: number;
  color: string;
}

export type RunState =
  | { active: false }
  | {
      active: true;
      finished: boolean;
      paused: boolean;
      returnTo: 'app' | 'session';
      steps: RunStep[];
      idx: number;
      remaining: number;
      kind: string;
      phaseName: string;
      contextLabel: string;
      upNext: string;
      pct: number;
      setPct: number;
      setNum: number;
      totalSets: number;
      label: string;
      logOnFinish: boolean;
      programId: string | null;
      exIndex: number | null;
    };
