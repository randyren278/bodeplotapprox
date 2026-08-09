/**
 * Ties the pipeline together: expression strings in, everything the UI needs
 * out. Mirrors the setup block of bode_approximator (bodewithgraphing.m:1-46).
 */

import { parsePoly, type Poly } from './poly';
import { zpkdata, type Complex } from './roots';
import { processZp, computeParams } from './zpk';
import { computeMagnitude, computePhase, computeSlopes, wrap180, type Model } from './approx';
import { exactResponse } from './exact';

export interface Analysis {
  num: Poly;
  den: Poly;
  zeros: Complex[];
  poles: Complex[];
  k: number;
  model: Model;
}

export function analyse(numStr: string, denStr: string): Analysis {
  const num = parsePoly(numStr);
  const den = parsePoly(denStr);
  if (den.length === 1 && den[0] === 0) throw new Error('Denominator cannot be zero');
  if (num.length === 1 && num[0] === 0) throw new Error('Numerator cannot be zero');

  const { zeros, poles, k } = zpkdata(num, den);
  const { z, p } = processZp(zeros, poles);
  const params = computeParams(z, p, k);

  return { num, den, zeros, poles, k, model: { z, p, params, k } };
}

export interface Sample {
  logW: number;
  exactMag: number;
  exactPhase: number;
  approxMag: number;
  approxPhase: number;
}

/**
 * Sweep the same range the MATLAB source plots: logspace(-3, 6, 1000).
 *
 * The exact phase is wrapped to [-180, 180] to match compute_phase's own
 * wrap, so the two traces share one space. MATLAB's `bode` returns unwrapped
 * phase, which makes the curves drift 360 degrees apart at high frequency in
 * the original figure. This is a display choice only — exactResponse still
 * returns raw atan2.
 */
export function sweep(a: Analysis, points = 1000, from = -3, to = 6): Sample[] {
  const out: Sample[] = [];
  for (let i = 0; i < points; i++) {
    const logW = from + ((to - from) * i) / (points - 1);
    const w = Math.pow(10, logW);
    const ex = exactResponse(a.num, a.den, w);
    out.push({
      logW,
      exactMag: ex.magDb,
      exactPhase: wrap180(ex.phaseDeg),
      approxMag: computeMagnitude(w, a.model),
      approxPhase: computePhase(w, a.model),
    });
  }
  return out;
}

export interface Corner {
  /** Corner (break) frequency in rad/s — |root| for a real root, ωn for a pair. */
  w: number;
  label: string;
}

/**
 * Break frequencies, ascending. These are the only frequencies at which the
 * asymptotic magnitude changes slope, so they anchor the frequency axis.
 * Roots at the origin are excluded — they have no corner.
 */
export function corners(a: Analysis): Corner[] {
  const out: Corner[] = [];
  let zi = 0;
  let pi = 0;
  for (const r of a.model.z.real) if (r !== 0) out.push({ w: Math.abs(r), label: `z${++zi}` });
  for (const q of a.model.z.complexPairs) out.push({ w: Math.hypot(q.re, q.im), label: `z${++zi}` });
  for (const r of a.model.p.real) if (r !== 0) out.push({ w: Math.abs(r), label: `p${++pi}` });
  for (const q of a.model.p.complexPairs) out.push({ w: Math.hypot(q.re, q.im), label: `p${++pi}` });
  return out.sort((x, y) => x.w - y.w);
}

export interface Probe {
  magDb: number;
  magSlope: number;
  phaseDeg: number;
  phaseSlope: number;
}

/** The four values the MATLAB prompt loop prints (bodewithgraphing.m:95-99). */
export function probe(a: Analysis, w: number): Probe {
  const { magSlope, phaseSlope } = computeSlopes(w, a.model);
  return {
    magDb: computeMagnitude(w, a.model),
    magSlope,
    phaseDeg: computePhase(w, a.model),
    phaseSlope,
  };
}
