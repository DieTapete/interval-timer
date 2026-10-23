export const C = {
  bg: '#0f1115',
  surface: '#1a1d24',
  surface2: '#242833',
  border: '#2e333f',
  text: '#e6e8ec',
  muted: '#8b90a0',
  accent: '#4f8cff',
  accent2: '#38d39f',
  warn: '#ffb02e',
  danger: '#ff5c5c',
  radius: 14,
} as const;

export const PHASE_COLORS = [
  '',          // no override — runner uses work/rest/prep defaults
  '#4f8cff',  // blue
  '#38d39f',  // green
  '#ffb02e',  // amber
  '#ff5c5c',  // red
  '#a78bfa',  // purple
  '#fb923c',  // orange
  '#22d3ee',  // cyan
];
