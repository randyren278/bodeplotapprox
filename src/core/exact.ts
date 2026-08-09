/**
 * Exact frequency response — stands in for MATLAB's `bode`
 * (bodewithgraphing.m:49-51).
 *
 * H(jw) = num(jw) / den(jw). Nothing approximate about it, and no toolbox
 * required. Phase is the raw atan2 in degrees; wrapping for display is the
 * plot's decision, not this module's.
 */

import type { Poly } from './poly';
import { evalPolyImag } from './roots';

export interface Response {
  magDb: number;
  phaseDeg: number;
}

export function exactResponse(num: Poly, den: Poly, w: number): Response {
  const n = evalPolyImag(num, w);
  const d = evalPolyImag(den, w);
  const denom = d.re * d.re + d.im * d.im;
  const re = (n.re * d.re + n.im * d.im) / denom;
  const im = (n.im * d.re - n.re * d.im) / denom;
  return {
    magDb: 20 * Math.log10(Math.hypot(re, im)),
    phaseDeg: (Math.atan2(im, re) * 180) / Math.PI,
  };
}
