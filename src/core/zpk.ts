/**
 * Classification of zeros and poles into real terms and conjugate pairs, and
 * the derived approximation parameters.
 *
 * 1:1 port of process_zp / process_single_zp / compute_params
 * (bodewithgraphing.m:103-158).
 */

import type { Complex } from './roots';

export interface Classified {
  real: number[];
  /** One representative per conjugate pair — cz(i,1) in the MATLAB source. */
  complexPairs: Complex[];
}

export interface SystemParams {
  numZeroOrigin: number;
  numPoleOrigin: number;
  /** Adjusted low-frequency gain, compute_params' K. */
  K: number;
}

/**
 * MATLAB tests `imag(zp(i)) == 0` exactly. roots.ts already snaps near-real
 * roots to exactly real, so this stays an exact test — see SYM_TOL there.
 */
export function processSingleZp(zp: Complex[]): Classified {
  const real: number[] = [];
  const complexPairs: Complex[] = [];
  const processed = new Array<boolean>(zp.length).fill(false);

  for (let i = 0; i < zp.length; i++) {
    if (processed[i]) continue;
    if (zp[i].im === 0) {
      real.push(zp[i].re);
      processed[i] = true;
      continue;
    }
    const conjIdx = zp.findIndex(
      (z, j) =>
        !processed[j] &&
        j !== i &&
        Math.hypot(z.re - zp[i].re, z.im + zp[i].im) < 1e-6,
    );
    if (conjIdx === -1) throw new Error('Complex pole/zero without conjugate pair');
    complexPairs.push(zp[i]);
    processed[i] = true;
    processed[conjIdx] = true;
  }

  return { real, complexPairs };
}

export function processZp(zeros: Complex[], poles: Complex[]) {
  return { z: processSingleZp(zeros), p: processSingleZp(poles) };
}

export function computeParams(z: Classified, p: Classified, k: number): SystemParams {
  const numZeroOrigin = z.real.filter((r) => r === 0).length;
  const numPoleOrigin = p.real.filter((r) => r === 0).length;

  const productOf = (c: Classified): number => {
    let product = c.real.filter((r) => r !== 0).reduce((acc, r) => acc * Math.abs(r), 1);
    for (const pair of c.complexPairs) {
      const wn = Math.hypot(pair.re, pair.im); // natural frequency
      product *= wn * wn;
    }
    return product;
  };

  return {
    numZeroOrigin,
    numPoleOrigin,
    K: Math.abs(k) * productOf(z) / productOf(p),
  };
}
