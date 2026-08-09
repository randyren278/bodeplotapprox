/**
 * Semilog Bode panel, hand-drawn SVG.
 *
 * No chart library: the axis treatment, the hairline grid and the
 * exact-vs-approximation trace weights are the whole point of the design, and
 * a general-purpose library would be fought the entire way.
 */

import type { Sample } from '../core/system';

const W = 900;
const H = 236;
const ML = 54;
const MR = 14;
const MT = 12;
const MB = 28;

/** Larger than any real step between adjacent samples, but below a 360 wrap. */
const WRAP_BREAK = 170;

const SUPERSCRIPT: Record<string, string> = {
  '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
};

function decadeLabel(d: number): string {
  if (d === 0) return '1';
  if (d === 1) return '10';
  return `10${String(d).split('').map((c) => SUPERSCRIPT[c] ?? c).join('')}`;
}

function chooseStep(range: number, candidates: number[]): number {
  for (const c of candidates) {
    if (range / c <= 6) return c;
  }
  return candidates[candidates.length - 1];
}

export interface BodePlotProps {
  samples: Sample[];
  pick: (s: Sample) => { exact: number; approx: number };
  /** Allowed gridline spacings, smallest first. */
  steps: number[];
  from: number;
  to: number;
}

export function BodePlot({ samples, pick, steps, from, to }: BodePlotProps) {
  const values = samples.map(pick);

  const finite = values.flatMap((v) => [v.exact, v.approx]).filter(Number.isFinite);
  let lo = finite.length ? Math.min(...finite) : 0;
  let hi = finite.length ? Math.max(...finite) : 1;
  if (hi - lo < 1e-9) {
    lo -= 1;
    hi += 1;
  }
  const step = chooseStep(hi - lo, steps);
  lo = Math.floor(lo / step) * step;
  hi = Math.ceil(hi / step) * step;

  const px = (logW: number) => ML + ((logW - from) / (to - from)) * (W - ML - MR);
  const py = (v: number) => MT + ((hi - v) / (hi - lo)) * (H - MT - MB);

  /**
   * Start a fresh subpath at a non-finite sample or a phase wrap, so the
   * renderer never draws a vertical line across the discontinuity.
   */
  const path = (get: (v: { exact: number; approx: number }) => number): string => {
    let d = '';
    let prev: number | null = null;
    samples.forEach((s, i) => {
      const v = get(values[i]);
      if (!Number.isFinite(v)) {
        prev = null;
        return;
      }
      const cmd = prev === null || Math.abs(v - prev) > WRAP_BREAK ? 'M' : 'L';
      d += `${cmd}${px(s.logW).toFixed(1)} ${py(v).toFixed(1)} `;
      prev = v;
    });
    return d.trim();
  };

  const xTicks: number[] = [];
  for (let d = Math.ceil(from); d <= Math.floor(to); d++) xTicks.push(d);
  const yTicks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) yTicks.push(v);

  return (
    <svg className="plot" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Bode panel">
      {xTicks.map((d) => (
        <line key={`x${d}`} className="grid-line" x1={px(d)} y1={MT} x2={px(d)} y2={H - MB} />
      ))}
      {yTicks.map((v) => (
        <line key={`y${v}`} className="grid-line" x1={ML} y1={py(v)} x2={W - MR} y2={py(v)} />
      ))}
      <rect className="frame" x={ML} y={MT} width={W - ML - MR} height={H - MT - MB} />
      {xTicks.map((d) => (
        <text key={`xl${d}`} className="tick" x={px(d)} y={H - MB + 15} textAnchor="middle">
          {decadeLabel(d)}
        </text>
      ))}
      {yTicks.map((v) => (
        <text key={`yl${v}`} className="tick" x={ML - 8} y={py(v) + 3.5} textAnchor="end">
          {String(Math.round(v)).replace('-', '−')}
        </text>
      ))}
      <path className="trace-approx" d={path((v) => v.approx)} />
      <path className="trace-exact" d={path((v) => v.exact)} />
    </svg>
  );
}

export function Legend() {
  return (
    <div className="legend">
      <span>
        <i />
        Exact
      </span>
      <span className="ap">
        <i />
        Approximation
      </span>
    </div>
  );
}
