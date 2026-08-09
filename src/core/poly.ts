/**
 * Polynomial arithmetic and expression parsing.
 *
 * Stands in for MATLAB's `str2sym` -> `expand` -> `sym2poly` chain from
 * bodewithgraphing.m:18-19. Coefficients are ordered highest-degree-first,
 * matching `sym2poly`: [30, 14160000, 0] is 30*s^2 + 14160000*s.
 */

export type Poly = number[];

/** Drop leading (highest-degree) zero coefficients; always leaves at least one. */
export function trim(p: Poly): Poly {
  let i = 0;
  while (i < p.length - 1 && p[i] === 0) i++;
  return p.slice(i);
}

export function add(a: Poly, b: Poly): Poly {
  const n = Math.max(a.length, b.length);
  const out = new Array<number>(n).fill(0);
  // Highest-degree-first, so align at the tail.
  for (let i = 0; i < a.length; i++) out[n - a.length + i] += a[i];
  for (let i = 0; i < b.length; i++) out[n - b.length + i] += b[i];
  return out;
}

export function neg(a: Poly): Poly {
  // `c === 0 ? 0 : -c` keeps negative zero out of the coefficient array, where
  // it would otherwise surface in the displayed polynomial.
  return a.map((c) => (c === 0 ? 0 : -c));
}

/**
 * Convolution. Works identically for highest-first and lowest-first ordering:
 * the coefficient of the product at index i+j is the sum of a[i]*b[j].
 */
export function mul(a: Poly, b: Poly): Poly {
  const out = new Array<number>(a.length + b.length - 1).fill(0);
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) out[i + j] += a[i] * b[j];
  }
  return out;
}

export function isConstant(p: Poly): boolean {
  return trim(p).length === 1;
}

export function constantValue(p: Poly): number {
  return trim(p)[0];
}

export function pow(base: Poly, exponent: number): Poly {
  if (isConstant(base)) {
    // A numeric base takes any real exponent: 96000^2, 10^-3, 2^0.5.
    return [Math.pow(constantValue(base), exponent)];
  }
  if (!Number.isInteger(exponent) || exponent < 0) {
    throw new ParseError(
      `Exponent on an expression in s must be a non-negative integer, got ${exponent}`,
    );
  }
  let out: Poly = [1];
  for (let i = 0; i < exponent; i++) out = mul(out, base);
  return out;
}

export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ParseError';
  }
}

/**
 * Parse a transfer-function expression in s into polynomial coefficients.
 *
 * Accepts the grammar the MATLAB tool actually takes: numbers, the variable
 * `s`, `+ - * / ^`, parentheses and unary sign. Multiplication must be
 * explicit, as in MATLAB. Division is permitted only by a constant --
 * `sym2poly` likewise refuses a rational expression.
 */
export function parsePoly(input: string): Poly {
  const p = new Parser(input);
  const result = p.parseExpression();
  p.expectEnd();
  return trim(result);
}

class Parser {
  private i = 0;

  constructor(private readonly src: string) {}

  parseExpression(): Poly {
    let left = this.parseTerm();
    for (;;) {
      const op = this.peekOperator('+-');
      if (!op) return left;
      this.i++;
      const right = this.parseTerm();
      left = op === '+' ? add(left, right) : add(left, neg(right));
    }
  }

  private parseTerm(): Poly {
    let left = this.parseUnary();
    for (;;) {
      const op = this.peekOperator('*/');
      if (!op) return left;
      this.i++;
      const right = this.parseUnary();
      if (op === '*') {
        left = mul(left, right);
      } else {
        if (!isConstant(right)) {
          throw new ParseError(
            `Cannot divide by an expression in s (near position ${this.i}). ` +
              `Put the denominator in the denominator field instead.`,
          );
        }
        const d = constantValue(right);
        if (d === 0) throw new ParseError('Division by zero');
        left = left.map((c) => c / d);
      }
    }
  }

  private parseUnary(): Poly {
    const op = this.peekOperator('+-');
    if (op) {
      this.i++;
      const operand = this.parseUnary();
      return op === '-' ? neg(operand) : operand;
    }
    return this.parsePower();
  }

  private parsePower(): Poly {
    const base = this.parsePrimary();
    if (this.peekOperator('^')) {
      this.i++;
      // Right-associative, and the exponent may carry its own sign: 10^-3.
      const exponent = this.parseUnary();
      if (!isConstant(exponent)) {
        throw new ParseError(`Exponent must be a constant (near position ${this.i})`);
      }
      return pow(base, constantValue(exponent));
    }
    return base;
  }

  private parsePrimary(): Poly {
    this.skipSpace();
    if (this.i >= this.src.length) {
      throw new ParseError('Unexpected end of expression');
    }
    const ch = this.src[this.i];

    if (ch === '(') {
      this.i++;
      const inner = this.parseExpression();
      this.skipSpace();
      if (this.src[this.i] !== ')') {
        throw new ParseError(`Expected ')' at position ${this.i}`);
      }
      this.i++;
      return inner;
    }

    if (ch === 's' || ch === 'S') {
      // Reject identifiers like `sin` or `s1` rather than silently reading `s`.
      const next = this.src[this.i + 1];
      if (next !== undefined && /[A-Za-z0-9_]/.test(next)) {
        throw new ParseError(
          `Unknown symbol at position ${this.i}. Only the variable 's' is supported.`,
        );
      }
      this.i++;
      return [1, 0]; // s
    }

    const numMatch = /^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(this.src.slice(this.i));
    if (numMatch) {
      this.i += numMatch[0].length;
      return [Number(numMatch[0])];
    }

    throw new ParseError(`Unexpected character '${ch}' at position ${this.i}`);
  }

  private peekOperator(ops: string): string | null {
    this.skipSpace();
    const ch = this.src[this.i];
    return ch !== undefined && ops.includes(ch) ? ch : null;
  }

  private skipSpace(): void {
    while (this.i < this.src.length && /\s/.test(this.src[this.i])) this.i++;
  }

  expectEnd(): void {
    this.skipSpace();
    if (this.i < this.src.length) {
      throw new ParseError(
        `Unexpected '${this.src[this.i]}' at position ${this.i} (trailing input)`,
      );
    }
  }
}
