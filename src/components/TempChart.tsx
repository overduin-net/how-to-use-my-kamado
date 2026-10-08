import type { Reading } from '../types';

interface Props {
  history: Reading[];
  pitTarget?: number;
  coreTarget?: number;
}

const W = 640;
const H = 240;
const PAD = { l: 38, r: 12, t: 12, b: 24 };

function segments(history: Reading[], field: 'pit' | 'core', x: (t: number) => number, y: (v: number) => number) {
  const parts: string[] = [];
  let current = '';
  for (const r of history) {
    const v = r[field];
    if (Number.isNaN(v)) {
      if (current) parts.push(current);
      current = '';
      continue;
    }
    current += `${current ? 'L' : 'M'}${x(r.t).toFixed(1)} ${y(v).toFixed(1)} `;
  }
  if (current) parts.push(current);
  return parts;
}

/** Live temperature chart: dome (pit) and core with dashed target lines. */
export function TempChart({ history, pitTarget, coreTarget }: Props) {
  const tMax = Math.max(60, history.length ? history[history.length - 1].t : 0);
  const maxVal = Math.max(140, (pitTarget ?? 0) + 30, ...history.map((r) => (Number.isNaN(r.pit) ? 0 : r.pit + 15)));
  const yMax = Math.ceil(maxVal / 50) * 50;
  const x = (t: number) => PAD.l + (t / tMax) * (W - PAD.l - PAD.r);
  const y = (v: number) => H - PAD.b - (v / yMax) * (H - PAD.t - PAD.b);
  const pit = segments(history, 'pit', x, y);
  const core = segments(history, 'core', x, y);
  const hourStep = tMax > 480 ? 120 : tMax > 180 ? 60 : 30;

  return (
    <svg className="temp-chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      {Array.from({ length: yMax / 50 + 1 }).map((_, i) => (
        <g key={i}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(i * 50)} y2={y(i * 50)} className="chart-grid" />
          <text x={PAD.l - 6} y={y(i * 50) + 4} textAnchor="end" className="chart-axis">{i * 50}°</text>
        </g>
      ))}
      {Array.from({ length: Math.floor(tMax / hourStep) + 1 }).map((_, i) => (
        <text key={i} x={x(i * hourStep)} y={H - 6} textAnchor="middle" className="chart-axis">
          {i * hourStep >= 60 ? `${(i * hourStep) / 60}u` : `${i * hourStep}m`}
        </text>
      ))}
      {pitTarget && <line x1={PAD.l} x2={W - PAD.r} y1={y(pitTarget)} y2={y(pitTarget)} className="target pit" />}
      {coreTarget && <line x1={PAD.l} x2={W - PAD.r} y1={y(coreTarget)} y2={y(coreTarget)} className="target core" />}
      {pit.map((d, i) => (
        <path key={`p${i}`} d={d} className="line pit" />
      ))}
      {core.map((d, i) => (
        <path key={`c${i}`} d={d} className="line core" />
      ))}
    </svg>
  );
}
