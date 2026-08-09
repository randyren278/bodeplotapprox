/**
 * The straight-line asymptotic approximation.
 *
 * 1:1 port of compute_magnitude, compute_phase, compute_slopes and the four
 * phase-asymptote helpers (bodewithgraphing.m:160-338). Same constants, same
 * break rules, same rounding behaviour. Two quirks are reproduced
 * deliberately rather than corrected — see KNOWN PARITY ARTIFACTS in README.md.
 */

import type { Classified, SystemParams } from './zpk';

export interface Model {
  z: Classified;
  p: Classified;
  params: SystemParams;
  /** zpk leading-coefficient gain, `k` in the MATLAB source. */
  k: number;
}

const log10 = Math.log10;

export function computeMagnitude(w: number, m: Model): number {
  const { numZeroOrigin, numPoleOrigin, K } = m.params;
  let magDb = 20 * log10(K) + (numZeroOrigin - numPoleOrigin) * 20 * log10(w);

  for (const z of m.z.real) {
    if (z === 0) continue;
    const wz = Math.abs(z);
    if (w >= wz) magDb += 20 * log10(w / wz);
  }
  for (const pair of m.z.complexPairs) {
    const wz = Math.hypot(pair.re, pair.im);
    if (w >= wz) magDb += 40 * log10(w / wz);
  }
  for (const p of m.p.real) {
    if (p === 0) continue;
    const wp = Math.abs(p);
    if (w >= wp) magDb -= 20 * log10(w / wp);
  }
  for (const pair of m.p.complexPairs) {
    const wp = Math.hypot(pair.re, pair.im);
    if (w >= wp) magDb -= 40 * log10(w / wp);
  }
  return magDb;
}

export function computePhase(w: number, m: Model): number {
  const { numZeroOrigin, numPoleOrigin } = m.params;
  let phase = (numZeroOrigin - numPoleOrigin) * 90;
  if (m.k < 0) phase -= 180;

  for (const z of m.z.real) {
    if (z === 0) continue;
    phase += realZeroPhase(w, Math.abs(z), z < 0);
  }
  for (const pair of m.z.complexPairs) {
    const wz = Math.hypot(pair.re, pair.im);
    phase += complexZeroPhase(w, wz, -pair.re / wz, pair.re < 0);
  }
  for (const p of m.p.real) {
    if (p === 0) continue;
    phase += realPolePhase(w, Math.abs(p), p < 0);
  }
  for (const pair of m.p.complexPairs) {
    const wp = Math.hypot(pair.re, pair.im);
    phase += complexPolePhase(w, wp, -pair.re / wp, pair.re < 0);
  }

  return wrap180(phase);
}

/** MATLAB's `mod(phase + 180, 360) - 180`. */
export function wrap180(phase: number): number {
  return (((phase + 180) % 360) + 360) % 360 - 180;
}

export interface Slopes {
  magSlope: number;
  phaseSlope: number;
}

export function computeSlopes(w: number, m: Model): Slopes {
  const { numZeroOrigin, numPoleOrigin } = m.params;
  let magSlope = (numZeroOrigin - numPoleOrigin) * 20;

  for (const z of m.z.real) {
    if (z === 0) continue;
    if (w >= Math.abs(z)) magSlope += 20;
  }
  for (const pair of m.z.complexPairs) {
    if (w >= Math.hypot(pair.re, pair.im)) magSlope += 40;
  }
  for (const p of m.p.real) {
    if (p === 0) continue;
    if (w >= Math.abs(p)) magSlope -= 20;
  }
  for (const pair of m.p.complexPairs) {
    if (w >= Math.hypot(pair.re, pair.im)) magSlope -= 40;
  }

  // Phase slope by forward difference, as in the original.
  const dw = w * 1e-4 + Number.EPSILON;
  const wPerturbed = w + dw;
  const phaseSlope =
    (computePhase(wPerturbed, m) - computePhase(w, m)) / (log10(wPerturbed) - log10(w));

  return { magSlope, phaseSlope };
}

/* ---- phase asymptote helpers (bodewithgraphing.m:284-338) ---- */

export function realZeroPhase(w: number, wz: number, isLhp: boolean): number {
  const low = wz / 10;
  const high = wz * 10;
  const sign = isLhp ? 1 : -1;
  if (w < low) return 0;
  if (w > high) return 90 * sign;
  return 90 * sign * ((log10(w) - log10(low)) / (log10(high) - log10(low)));
}

export function complexZeroPhase(w: number, wz: number, zeta: number, isLhp: boolean): number {
  const sign = isLhp ? 1 : -1;
  const w1 = wz * Math.pow(10, -zeta);
  const w2 = wz * Math.pow(10, zeta);
  if (w < w1) return 0;
  if (w > w2) return 180 * sign;
  return 180 * sign * ((log10(w) - log10(w1)) / (log10(w2) - log10(w1)));
}

export function realPolePhase(w: number, wp: number, isLhp: boolean): number {
  const low = wp / 10;
  const high = wp * 10;
  const sign = isLhp ? 1 : -1;
  if (w < low) return 0;
  if (w > high) return -90 * sign;
  return -90 * sign * ((log10(w) - log10(low)) / (log10(high) - log10(low)));
}

export function complexPolePhase(w: number, wp: number, zeta: number, isLhp: boolean): number {
  const sign = isLhp ? 1 : -1;
  const w1 = wp * Math.pow(10, -zeta);
  const w2 = wp * Math.pow(10, zeta);
  if (w < w1) return 0;
  if (w > w2) return -180 * sign;
  return -180 * sign * ((log10(w) - log10(w1)) / (log10(w2) - log10(w1)));
}
