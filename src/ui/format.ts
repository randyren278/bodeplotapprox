import type { Complex } from '../core/roots';
import type { Classified } from '../core/zpk';

/** U+2212 MINUS SIGN — aligns with digits, unlike the hyphen. */
const MINUS = '−';

export function sign(s: string): string {
  return s.replace(/-/g, MINUS);
}

/** Compact scientific form: 4.7200e5, 0, 31000. */
export function sci(x: number, digits = 4): string {
  if (x === 0) return '0';
  if (!Number.isFinite(x)) return x > 0 ? '∞' : `${MINUS}∞`;
  // Durand-Kerner leaves float noise on exact roots (31000.000000000004);
  // snapping to 12 significant digits restores 31000 rather than 3.1000e4.
  x = Number(x.toPrecision(12));
  const abs = Math.abs(x);
  if (abs >= 1e-3 && abs < 1e5 && Number.isInteger(x)) return sign(String(x));
  return sign(x.toExponential(digits).replace('e+', 'e').replace('e-', 'e−'));
}

export function fixed(x: number, digits: number): string {
  if (!Number.isFinite(x)) return x > 0 ? '∞' : `${MINUS}∞`;
  return sign(x.toFixed(digits));
}

export function formatRoot(c: Complex): string {
  if (c.im === 0) return sci(c.re);
  const im = Math.abs(c.im);
  // Keep both halves in the same notation — "−19200 ± j9.4062e4" reads badly.
  const exponential = sci(c.re).includes('e') || sci(im).includes('e');
  const part = (x: number) => (exponential ? sign(x.toExponential(4).replace('e+', 'e').replace('e-', 'e−')) : sci(x));
  return `${part(c.re)} ± j${part(im)}`;
}

/** Zeros/poles as display lines, conjugate pairs collapsed onto one row. */
export function rootLines(rs: Complex[]): string[] {
  const lines: string[] = [];
  const used = new Array<boolean>(rs.length).fill(false);
  for (let i = 0; i < rs.length; i++) {
    if (used[i]) continue;
    used[i] = true;
    if (rs[i].im === 0) {
      lines.push(sci(rs[i].re));
      continue;
    }
    const partner = rs.findIndex(
      (r, j) => !used[j] && r.re === rs[i].re && r.im === -rs[i].im,
    );
    if (partner >= 0) used[partner] = true;
    lines.push(formatRoot(rs[i]));
  }
  return lines.length ? lines : ['none'];
}

/** Superscript digits, for s² / 10⁻³ without markup. */
export function sup(n: number | string): string {
  const map: Record<string, string> = {
    '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
    '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  };
  return String(n).split('').map((c) => map[c] ?? c).join('');
}

/**
 * One side of H(s) in factored form: gain · s^n · (s+a) · (s²+bs+c).
 *
 * Reads off the classified roots rather than the polynomial, so a complex
 * pair renders as its real quadratic instead of two conjugate linear terms.
 */
export function factoredSide(c: Classified, originCount: number, gain?: number): string {
  const parts: string[] = [];
  if (gain !== undefined && gain !== 1) parts.push(sci(gain));
  if (originCount === 1) parts.push('s');
  else if (originCount > 1) parts.push(`s${sup(originCount)}`);

  for (const r of c.real) {
    if (r === 0) continue;
    parts.push(`(s ${r < 0 ? '+' : MINUS} ${sci(Math.abs(r))})`);
  }
  for (const q of c.complexPairs) {
    const wn = Math.hypot(q.re, q.im);
    const b = -2 * q.re;
    parts.push(`(s${sup(2)} ${b >= 0 ? '+' : MINUS} ${sci(Math.abs(b))}s + ${sci(wn * wn)})`);
  }
  return parts.length ? parts.join(' · ') : '1';
}

/** Coefficient array back to a readable polynomial, highest degree first. */
export function polyToString(p: number[]): string {
  const n = p.length - 1;
  const terms: string[] = [];
  p.forEach((c, i) => {
    if (c === 0) return;
    const deg = n - i;
    const mag = Math.abs(c);
    const coefficient = mag === 1 && deg > 0 ? '' : sci(mag);
    const variable = deg === 0 ? '' : deg === 1 ? 's' : `s^${deg}`;
    terms.push(`${terms.length === 0 ? (c < 0 ? MINUS : '') : c < 0 ? ` ${MINUS} ` : ' + '}${coefficient}${variable}`);
  });
  return terms.length ? terms.join('') : '0';
}
