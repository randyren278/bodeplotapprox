/**
 * Semilog Bode panel, hand-drawn SVG.
 *
 * Deliberately low-chrome: a single baseline axis, decade tick marks, two
 * y-labels bounding the range, and traces labelled at their own ends rather
 * than through a legend. No grid, no frame, no fill — the data carries the
 * shape. A chart library would have to be fought the entire way to get here.
 */

import type { Sample, Corner } from '../core/system';
import { sup } from '../ui/format';

const W = 900;
const H = 190;
const ML = 34;
const MR = 46;
const MT = 8;
const MB = 20;

/** Larger than any real step between adjacent samples, smaller than a 360 wrap. */
const WRAP_BREAK = 170;

function decadeLabel(d: number): string {
  if (d === 0) return '1';
  return `10${sup(d)}`;
}

function chooseStep(range: number, candidates: number[]): number {
  for (const c of candidates) if (range / c <= 6) return c;
  return candidates[candidates.length - 1];
}

export interface BodePlotProps {
  samples: Sample[];
  pick: (s: Sample) => { exact: number; approx: number };
  steps: number[];
  from: number;
  to: number;
  /** Break frequencies to tick on the axis; omitted on the phase panel. */
  corners?: Corner[];
  /** Probe frequency (rad/s) — draws the crosshair. */
  omega: number | null;
  onScrub: (w: number) => void;
}

export function BodePlot({ samples, pick, steps, from, to, corners, omega, onScrub }: BodePlotProps) {
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

  const decades: number[] = [];
  for (let d = Math.ceil(from); d <= Math.floor(to); d++) decades.push(d);

  const lastExact = values.length ? values[values.length - 1].exact : 0;
  const lastApprox = values.length ? values[values.length - 1].approx : 0;
  const eY = py(Number.isFinite(lastExact) ? lastExact : lo);
  const aY = py(Number.isFinite(lastApprox) ? lastApprox : lo);
  // Nudge the two end labels apart when the traces converge.
  const push = Math.abs(eY - aY) < 11 ? 6 : 0;

  const scrub = (clientX: number, el: SVGSVGElement) => {
    const rect = el.getBoundingClientRect();
    const x = (clientX - rect.left) * (W / rect.width);
    if (x < ML || x > W - MR) return;
    onScrub(Math.pow(10, from + ((x - ML) / (W - ML - MR)) * (to - from)));
  };

  const cursorX = omega !== null && omega > 0 ? px(Math.log10(omega)) : null;
  const showCursor = cursorX !== null && cursorX >= ML && cursorX <= W - MR;
  const at = (get: (v: { exact: number; approx: number }) => number): number | null => {
    if (omega === null || !samples.length) return null;
    const lw = Math.log10(omega);
    let best = 0;
    let bd = Infinity;
    samples.forEach((s, i) => {
      const d = Math.abs(s.logW - lw);
      if (d < bd) { bd = d; best = i; }
    });
    const v = get(values[best]);
    return Number.isFinite(v) ? v : null;
  };
  const curE = showCursor ? at((v) => v.exact) : null;
  const curA = showCursor ? at((v) => v.approx) : null;

  return (
    <svg
      className="plot"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="Bode panel"
      onMouseMove={(e) => scrub(e.clientX, e.currentTarget)}
    >
      <line className="axis" x1={ML} y1={H - MB} x2={W - MR} y2={H - MB} />
      {decades.map((d) => (
        <line key={`t${d}`} className="tick-major" x1={px(d)} y1={H - MB} x2={px(d)} y2={H - MB + 3} />
      ))}
      {decades.filter((_, i) => i % 2 === 0).map((d) => (
        <text key={`x${d}`} className="tick" x={px(d)} y={H - MB + 13} textAnchor="middle">
          {decadeLabel(d)}
        </text>
      ))}
      {[lo, hi].map((v) => (
        <text key={`y${v}`} className="tick" x={ML - 6} y={py(v) + 3} textAnchor="end">
          {String(Math.round(v)).replace('-', '−')}
        </text>
      ))}

      {corners?.map((c) => {
        const lw = Math.log10(c.w);
        if (lw < from || lw > to) return null;
        return (
          <g key={c.label}>
            <line className="corner-tick" x1={px(lw)} y1={H - MB} x2={px(lw)} y2={H - MB + 6} />
            <text className="corner-label" x={px(lw)} y={H - MB + 17} textAnchor="middle">
              {c.label}
            </text>
          </g>
        );
      })}

      <path className="trace-exact" d={path((v) => v.exact)} />
      <path className="trace-approx" d={path((v) => v.approx)} />

      <text className="end-label exact" x={W - MR + 6} y={eY - push + 3.5}>exact</text>
      <text className="end-label approx" x={W - MR + 6} y={aY + push + 3.5}>approx</text>

      {showCursor && (
        <g>
          <line className="xhair-line" x1={cursorX} y1={MT} x2={cursorX} y2={H - MB} />
          {curE !== null && <circle className="xhair-dot-e" cx={cursorX} cy={py(curE)} r={2.4} />}
          {curA !== null && <circle className="xhair-dot-a" cx={cursorX} cy={py(curA)} r={2.4} />}
        </g>
      )}
    </svg>
  );
}
