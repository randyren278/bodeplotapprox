import { describe, it, expect } from 'vitest';
import { parsePoly, mul, ParseError, type Poly } from './poly';
import { roots, zpkdata } from './roots';
import { processSingleZp, processZp, computeParams } from './zpk';
import { computeMagnitude, computePhase, computeSlopes } from './approx';
import { exactResponse } from './exact';
import { analyse, probe } from './system';

const NUM = '30*s*(s+472000)';
const DEN = '(s+31000)*(s^2+2*0.2*96000*s+96000^2)';

/* ---- 1. Parser ---- */

describe('parsePoly', () => {
  it('expands the README numerator', () => {
    expect(parsePoly(NUM)).toEqual([30, 14160000, 0]);
  });

  it('expands the README denominator', () => {
    expect(parsePoly(DEN)).toEqual([1, 69400, 10406400000, 285696000000000]);
  });

  it('handles the RHP form from the original README', () => {
    expect(parsePoly('30*s*(s-472000)')).toEqual([30, -14160000, 0]);
  });

  it('handles powers, unary minus and scientific notation', () => {
    expect(parsePoly('s^3')).toEqual([1, 0, 0, 0]);
    expect(parsePoly('-s^2')).toEqual([-1, 0, 0]);
    expect(parsePoly('(s+2)*(s^2+8*s+32)')).toEqual([1, 10, 48, 64]);
    expect(parsePoly('1e3')).toEqual([1000]);
    expect(parsePoly('10^-3')[0]).toBeCloseTo(0.001, 12);
  });

  it('applies precedence correctly', () => {
    // 2 + 3*s^2 rather than (2+3)*s^2 or (3*s)^2
    expect(parsePoly('2+3*s^2')).toEqual([3, 0, 2]);
  });

  it('divides by a constant', () => {
    expect(parsePoly('(s+10)/2')).toEqual([0.5, 5]);
  });

  it('rejects division by an expression in s', () => {
    expect(() => parsePoly('1/(s+1)')).toThrow(ParseError);
  });

  it('rejects unknown symbols and trailing junk', () => {
    expect(() => parsePoly('sin(s)')).toThrow(ParseError);
    expect(() => parsePoly('s + ')).toThrow(ParseError);
    expect(() => parsePoly('(s+1))')).toThrow(ParseError);
    expect(() => parsePoly('s^s')).toThrow(ParseError);
  });
});

/* ---- 2. Root round-trip (self-checking, no oracle needed) ---- */

function rebuild(k: number, rs: { re: number; im: number }[]): Poly {
  // k * prod(s - r) expanded back out.
  let acc: Poly = [k];
  for (const r of rs) acc = mul(acc, [1, -r.re]);
  return acc;
}

describe('roots round-trip', () => {
  const cases = [NUM, DEN, '(s+2)*(s^2+8*s+32)', 's^4+1', '5*(s+1)*(s+1)*(s+1)', 's^2+1'];

  for (const expr of cases) {
    it(`reconstructs ${expr}`, () => {
      const coeffs = parsePoly(expr);
      const rs = roots(coeffs);
      expect(rs.length).toBe(coeffs.length - 1);

      // Expand with complex arithmetic, then confirm the imaginary parts cancel.
      let re: number[] = [coeffs[0]];
      let im: number[] = [0];
      for (const r of rs) {
        const nre = new Array<number>(re.length + 1).fill(0);
        const nim = new Array<number>(re.length + 1).fill(0);
        for (let i = 0; i < re.length; i++) {
          nre[i] += re[i];
          nim[i] += im[i];
          nre[i + 1] += -(re[i] * r.re - im[i] * r.im);
          nim[i + 1] += -(re[i] * r.im + im[i] * r.re);
        }
        re = nre;
        im = nim;
      }
      const scale = Math.max(...coeffs.map(Math.abs));
      // 1e-5 rather than machine precision because a repeated root is
      // intrinsically ill-conditioned: an m-fold root can only be located to
      // about eps^(1/m). 5*(s+1)^3 below is the binding case at ~1e-6
      // relative, which is already better than that bound.
      for (let i = 0; i < coeffs.length; i++) {
        expect(Math.abs(re[i] - coeffs[i])).toBeLessThan(1e-5 * scale);
        expect(Math.abs(im[i])).toBeLessThan(1e-5 * scale);
      }
      // Unused, but keeps the simpler real-only helper honest for real-root cases.
      expect(rebuild(coeffs[0], rs).length).toBe(coeffs.length);
    });
  }
});

/* ---- 3. Known roots ---- */

describe('known roots', () => {
  it('finds -10 and -1000 and calls them real', () => {
    const rs = roots(parsePoly('(s+10)*(s+1000)'));
    const sorted = [...rs].sort((a, b) => a.re - b.re);
    expect(sorted[0].re).toBeCloseTo(-1000, 8);
    expect(sorted[1].re).toBeCloseTo(-10, 8);
    for (const r of rs) expect(r.im).toBe(0);

    const c = processSingleZp(rs);
    expect(c.real.length).toBe(2);
    expect(c.complexPairs.length).toBe(0);
  });

  it('peels roots at the origin off exactly', () => {
    const rs = roots(parsePoly('30*s*s*(s+5)'));
    expect(rs.filter((r) => r.re === 0 && r.im === 0).length).toBe(2);
    const c = processSingleZp(rs);
    expect(c.real.filter((r) => r === 0).length).toBe(2);
  });

  it('classifies the README denominator as one real pole and one pair', () => {
    const { poles } = zpkdata(parsePoly(NUM), parsePoly(DEN));
    const c = processSingleZp(poles);
    expect(c.real.length).toBe(1);
    expect(c.real[0]).toBeCloseTo(-31000, 6);
    expect(c.complexPairs.length).toBe(1);
    const pair = c.complexPairs[0];
    expect(Math.hypot(pair.re, pair.im)).toBeCloseTo(96000, 6);
    expect(-pair.re / Math.hypot(pair.re, pair.im)).toBeCloseTo(0.2, 9);
  });
});

/* ---- 4. Approximation port ---- */

describe('compute_magnitude / compute_phase', () => {
  const a = analyse(NUM, DEN);

  it('derives K and the origin counts', () => {
    expect(a.k).toBe(30);
    expect(a.model.params.numZeroOrigin).toBe(1);
    expect(a.model.params.numPoleOrigin).toBe(0);
    const expectedK = (30 * 472000) / (31000 * 96000 * 96000);
    expect(a.model.params.K).toBeCloseTo(expectedK, 20);
  });

  it('is 20log10(K) + 20log10(w) below every corner', () => {
    const K = a.model.params.K;
    for (const w of [1e-3, 1e-1, 1, 100]) {
      expect(computeMagnitude(w, a.model)).toBeCloseTo(20 * Math.log10(K) + 20 * Math.log10(w), 9);
    }
    // 20 dB/decade, so exactly 60 dB across three decades.
    expect(computeMagnitude(1, a.model) - computeMagnitude(1e-3, a.model)).toBeCloseTo(60, 9);
  });

  it('starts at +90 degrees from the zero at the origin', () => {
    expect(computePhase(1e-3, a.model)).toBeCloseTo(90, 9);
    expect(computePhase(1, a.model)).toBeCloseTo(90, 9);
  });

  it('lands on the mid-corner phase values the asymptote rules dictate', () => {
    // At w = 31000 the real pole is exactly half-way through its 2-decade ramp.
    expect(computePhase(31000, a.model)).toBeCloseTo(45, 9);
    // At w = 96000 the complex pair is half-way through its band: -180/2 = -90,
    // the real pole contributes its ramp value, the zero its own.
    expect(computePhase(472000, a.model)).toBeCloseTo(-135, 9);
  });

  it('applies -180 when the zpk gain is negative', () => {
    const neg = analyse('-1', '(s+1)');
    expect(neg.k).toBe(-1);
    expect(computePhase(1e-6, neg.model)).toBeCloseTo(-180, 9);
  });
});

/* ---- 5. Slope self-consistency ---- */

describe('compute_slopes', () => {
  const a = analyse(NUM, DEN);

  it('matches the numerical derivative of compute_magnitude away from corners', () => {
    for (const w of [1e-2, 1e3, 5e4, 2e5, 1e6]) {
      const { magSlope } = computeSlopes(w, a.model);
      const numeric =
        (computeMagnitude(w * 1.0001, a.model) - computeMagnitude(w, a.model)) /
        (Math.log10(w * 1.0001) - Math.log10(w));
      expect(magSlope).toBeCloseTo(numeric, 6);
    }
  });

  it('reports the expected slope in each band', () => {
    expect(computeSlopes(1e3, a.model).magSlope).toBe(20); // zero at origin only
    expect(computeSlopes(5e4, a.model).magSlope).toBe(0); // + real pole
    expect(computeSlopes(2e5, a.model).magSlope).toBe(-40); // + complex pair
    expect(computeSlopes(1e6, a.model).magSlope).toBe(-20); // + real zero
  });
});

/* ---- 6. Exact response ---- */

describe('exactResponse', () => {
  it('gives -3.0103 dB and -45 degrees for 1/(s+1) at w = 1', () => {
    const r = exactResponse(parsePoly('1'), parsePoly('s+1'), 1);
    expect(r.magDb).toBeCloseTo(-3.0103, 4);
    expect(r.phaseDeg).toBeCloseTo(-45, 9);
  });

  it('gives unity gain at DC for a normalised low-pass', () => {
    const r = exactResponse(parsePoly('1'), parsePoly('s+1'), 1e-6);
    expect(r.magDb).toBeCloseTo(0, 9);
    // -atan(1e-6) in degrees is -5.7e-5, so 3 decimal places is the honest bar.
    expect(r.phaseDeg).toBeCloseTo(0, 3);
  });

  it('rolls off at -20 dB/decade well past the corner', () => {
    const a = exactResponse(parsePoly('1'), parsePoly('s+1'), 1e3).magDb;
    const b = exactResponse(parsePoly('1'), parsePoly('s+1'), 1e4).magDb;
    expect(b - a).toBeCloseTo(-20, 2);
  });
});

/* ---- 7. Exact vs approximate cross-check ---- */

describe('exact vs approximation', () => {
  it('agrees within 0.1 dB a decade clear of every corner', () => {
    const a = analyse(NUM, DEN);
    // Corners at 3.1e4, 9.6e4, 4.72e5 — these points sit a decade away from all.
    for (const w of [1e-3, 1, 100, 3000, 1e7, 1e8]) {
      const ex = exactResponse(a.num, a.den, w).magDb;
      const ap = computeMagnitude(w, a.model);
      expect(Math.abs(ex - ap)).toBeLessThan(0.1);
    }
  });

  it('agrees on phase for an all-LHP system away from corners', () => {
    const a = analyse('1', '(s+100)');
    for (const w of [1, 1e4]) {
      const ex = exactResponse(a.num, a.den, w).phaseDeg;
      const ap = computePhase(w, a.model);
      expect(Math.abs(ex - ap)).toBeLessThan(6);
    }
  });
});

/* ---- Known parity artifact: locked in so a future change is deliberate ---- */

describe('KNOWN PARITY ARTIFACT: RHP phase offset', () => {
  it('is 180 degrees off for an odd number of RHP roots, as MATLAB is', () => {
    const a = analyse('30*s*(s-472000)', DEN);
    const w = 1e6;
    const ex = exactResponse(a.num, a.den, w).phaseDeg;
    const ap = computePhase(w, a.model);
    const wrapped = ((((ap - ex + 180) % 360) + 360) % 360) - 180;
    expect(180 - Math.abs(wrapped)).toBeLessThan(2);
    // Magnitude is unaffected by the bug.
    expect(Math.abs(exactResponse(a.num, a.den, 1e8).magDb - computeMagnitude(1e8, a.model)))
      .toBeLessThan(0.1);
  });
});

/* ---- probe() reproduces the MATLAB prompt-loop output ---- */

describe('probe', () => {
  it('returns the four values the prompt loop prints', () => {
    const a = analyse(NUM, DEN);
    const r = probe(a, 472000);
    expect(r.magDb).toBeCloseTo(-83.9364, 3);
    expect(r.magSlope).toBe(-20);
    expect(r.phaseDeg).toBeCloseTo(-135, 6);
    expect(r.phaseSlope).toBeCloseTo(45, 2);
  });
});

/* ---- processZp guards ---- */

describe('processZp', () => {
  it('throws when a complex root has no conjugate partner', () => {
    expect(() => processSingleZp([{ re: 1, im: 2 }])).toThrow(
      'Complex pole/zero without conjugate pair',
    );
  });

  it('computes K as |k| * prod(zeros) / prod(poles)', () => {
    const { zeros, poles, k } = zpkdata(parsePoly('2*(s+3)'), parsePoly('(s+4)*(s+5)'));
    const { z, p } = processZp(zeros, poles);
    expect(computeParams(z, p, k).K).toBeCloseTo((2 * 3) / (4 * 5), 12);
  });
});
