/**
 * Polynomial root finding — stands in for MATLAB's `roots` / `zpkdata`
 * (bodewithgraphing.m:22-25).
 *
 * Durand-Kerner (Weierstrass) iteration. Transfer functions here are low
 * order, so it converges in a few dozen iterations without the machinery of a
 * companion-matrix eigensolver.
 */

import { trim, type Poly } from './poly';

export interface Complex {
  re: number;
  im: number;
}

export interface Zpk {
  zeros: Complex[];
  poles: Complex[];
  k: number;
}

const MAX_ITER = 500;
const CONV_TOL = 1e-14;
/**
 * Relative tolerance for "this root is real" and "these two roots are a
 * conjugate pair". MATLAB's `roots` is backed by LAPACK on a real companion
 * matrix, so it returns exactly-real roots and exactly-conjugate pairs;
 * Durand-Kerner does not. process_zp compares with `imag(z) == 0` and an
 * absolute 1e-6 -- both of which a raw iterative result would fail on
 * coefficients of size 1e5. Symmetrising below restores the exactness that
 * the ported classification code assumes.
 */
const SYM_TOL = 1e-8;

function cSub(a: Complex, b: Complex): Complex {
  return { re: a.re - b.re, im: a.im - b.im };
}
function cMul(a: Complex, b: Complex): Complex {
  return { re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re };
}
function cDiv(a: Complex, b: Complex): Complex {
  const d = b.re * b.re + b.im * b.im;
  return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d };
}
function cAbs(a: Complex): number {
  return Math.hypot(a.re, a.im);
}

/** Evaluate a highest-degree-first polynomial at a complex point (Horner). */
export function evalPolyComplex(p: Poly, z: Complex): Complex {
  let acc: Complex = { re: 0, im: 0 };
  for (const c of p) acc = { re: acc.re * z.re - acc.im * z.im + c, im: acc.re * z.im + acc.im * z.re };
  return acc;
}

/** Evaluate at s = j*w without constructing an intermediate Complex per step. */
export function evalPolyImag(p: Poly, w: number): Complex {
  let re = 0;
  let im = 0;
  for (const c of p) {
    const nextRe = -im * w + c;
    im = re * w;
    re = nextRe;
  }
  return { re, im };
}

/**
 * Roots of a real polynomial, highest-degree-first.
 *
 * Roots at the origin are peeled off exactly rather than left to the
 * iteration: compute_params counts them with `sum(real_z == 0)`
 * (bodewithgraphing.m:136-137), which a returned 1e-13 would silently break.
 */
export function roots(coeffs: Poly): Complex[] {
  const a = trim(coeffs);
  if (a.length <= 1) return [];

  let end = a.length;
  const atOrigin: Complex[] = [];
  while (end > 1 && a[end - 1] === 0) {
    atOrigin.push({ re: 0, im: 0 });
    end--;
  }
  const reduced = a.slice(0, end);
  const degree = reduced.length - 1;
  if (degree === 0) return atOrigin;

  const monic = reduced.map((c) => c / reduced[0]);

  // Spread the initial guesses around a circle so no two start coincident.
  const seed: Complex = { re: 0.4, im: 0.9 };
  let z: Complex[] = [];
  let cur: Complex = { re: 1, im: 0 };
  for (let i = 0; i < degree; i++) {
    z.push(cur);
    cur = cMul(cur, seed);
  }

  for (let iter = 0; iter < MAX_ITER; iter++) {
    let maxStep = 0;
    const next = z.map((zi, i) => {
      let denom: Complex = { re: 1, im: 0 };
      for (let j = 0; j < degree; j++) {
        if (j !== i) denom = cMul(denom, cSub(zi, z[j]));
      }
      if (cAbs(denom) === 0) return zi;
      const step = cDiv(evalPolyComplex(monic, zi), denom);
      maxStep = Math.max(maxStep, cAbs(step));
      return cSub(zi, step);
    });
    z = next;
    const scale = Math.max(1, ...z.map(cAbs));
    if (maxStep < CONV_TOL * scale) break;
  }

  return [...symmetrise(z), ...atOrigin];
}

/**
 * A real polynomial has exactly-real roots and exactly-conjugate complex
 * pairs. Enforce that, so the classification ported from process_zp gets the
 * exactness it was written against. See SYM_TOL.
 */
function symmetrise(z: Complex[]): Complex[] {
  const scale = Math.max(1, ...z.map(cAbs));
  const out: Complex[] = z.map((r) =>
    Math.abs(r.im) <= SYM_TOL * Math.max(scale, Math.abs(r.re)) ? { re: r.re, im: 0 } : r,
  );

  const taken = new Array<boolean>(out.length).fill(false);
  for (let i = 0; i < out.length; i++) {
    if (taken[i] || out[i].im === 0) continue;
    let best = -1;
    let bestDist = Infinity;
    for (let j = i + 1; j < out.length; j++) {
      if (taken[j] || out[j].im === 0) continue;
      const d = cAbs(cSub(out[j], { re: out[i].re, im: -out[i].im }));
      if (d < bestDist) {
        bestDist = d;
        best = j;
      }
    }
    if (best < 0) continue;
    // Average the pair against its conjugate, then mirror it exactly.
    const re = (out[i].re + out[best].re) / 2;
    const im = (Math.abs(out[i].im) + Math.abs(out[best].im)) / 2;
    const sign = out[i].im >= 0 ? 1 : -1;
    out[i] = { re, im: sign * im };
    out[best] = { re, im: -sign * im };
    taken[i] = true;
    taken[best] = true;
  }
  return out;
}

/**
 * Zeros, poles and gain of num/den — the `tf` + `zpkdata` pair at
 * bodewithgraphing.m:22-25. k is the ratio of leading coefficients.
 */
export function zpkdata(num: Poly, den: Poly): Zpk {
  const n = trim(num);
  const d = trim(den);
  if (d.length === 1 && d[0] === 0) throw new Error('Denominator is zero');
  return { zeros: roots(n), poles: roots(d), k: n[0] / d[0] };
}
