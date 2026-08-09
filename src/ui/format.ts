import type { Complex } from '../core/roots';

/** U+2212 MINUS SIGN — aligns with digits, unlike the hyphen. */
const MINUS = '−';

export function sign(s: string): string {
  return s.replace(/-/g, MINUS);
}

/** Compact scientific form: 4.7200e5, 0, 31000. */
export function sci(x: number, digits = 4): string {
  if (x === 0) return '0';
  if (!Number.isFinite(x)) return x > 0 ? '∞' : `${MINUS}∞`;
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
