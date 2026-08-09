/**
 * Render smoke tests. The math suite proves the port; these prove the
 * components survive the inputs the port can hand them — including the
 * degenerate ones (parse errors, -Inf magnitudes, constant systems).
 */

import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import App from '../App';
import { BodePlot } from '../plot/BodePlot';
import { sweep, analyse } from '../core/system';
import { polyToString, rootLines, sci } from './format';

describe('App', () => {
  it('renders the default system without throwing', () => {
    const html = renderToString(<App />);
    expect(html).toContain('Bode Approx');
    expect(html).toContain('Magnitude');
    // The probe readout for the default w = 472000.
    expect(html).toContain('−83.9364 dB');
    expect(html).toContain('−20.00 dB/dec');
  });

  it('produces path data for both traces', () => {
    const html = renderToString(<App />);
    expect(html).toContain('trace-exact');
    expect(html).toContain('trace-approx');
    expect(html).not.toContain('NaN');
    expect(html).not.toContain('undefined');
  });
});

describe('BodePlot edge cases', () => {
  it('survives a magnitude of -Infinity (zero on the jw axis)', () => {
    // s^2+1 has zeros at +/-j, so |H| is exactly 0 at w = 1.
    const a = analyse('s^2+1', '(s+10)*(s+20)');
    const samples = sweep(a, 200, -1, 2);
    const html = renderToString(
      <BodePlot
        samples={samples}
        pick={(s) => ({ exact: s.exactMag, approx: s.approxMag })}
        steps={[5, 10, 20, 40]}
        from={-1}
        to={2}
      />,
    );
    expect(html).not.toContain('NaN');
    expect(html).not.toContain('Infinity');
  });

  it('survives a constant system with no variation to scale', () => {
    const a = analyse('5', '2');
    const samples = sweep(a, 50, -1, 1);
    const html = renderToString(
      <BodePlot
        samples={samples}
        pick={(s) => ({ exact: s.exactMag, approx: s.approxMag })}
        steps={[5, 10, 20]}
        from={-1}
        to={1}
      />,
    );
    expect(html).not.toContain('NaN');
  });
});

describe('format', () => {
  it('renders coefficients as a readable polynomial', () => {
    expect(polyToString([1, 10, 48, 64])).toBe('s^3 + 10s^2 + 48s + 64');
    expect(polyToString([30, -14160000, 0])).toBe('30s^2 − 1.4160e7s');
    expect(polyToString([0])).toBe('0');
  });

  it('collapses conjugate pairs onto one line', () => {
    const lines = rootLines([
      { re: -31000, im: 0 },
      { re: -19200, im: 94061.68 },
      { re: -19200, im: -94061.68 },
    ]);
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('±');
    // Both halves in the same notation, not "−19200 ± j9.4062e4".
    expect(lines[1]).toBe('−1.9200e4 ± j9.4062e4');
  });

  it('keeps repeated roots as separate lines', () => {
    const lines = rootLines([
      { re: -1, im: 0 },
      { re: -1, im: 0 },
      { re: -1, im: 0 },
    ]);
    expect(lines).toEqual(['−1', '−1', '−1']);
  });

  it('uses a real minus sign, not a hyphen', () => {
    expect(sci(-472000)).toBe('−4.7200e5');
    expect(sci(0)).toBe('0');
    expect(sci(31000)).toBe('31000');
  });
});
