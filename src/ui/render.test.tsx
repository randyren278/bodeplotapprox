/**
 * Render smoke tests. The math suite proves the port; these prove the
 * components survive the inputs the port can hand them — including the
 * degenerate ones (parse errors, -Inf magnitudes, constant systems).
 */

import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import App from '../App';
import { BodePlot } from '../plot/BodePlot';
import { Sparkline } from '../plot/Sparkline';
import { sweep, analyse, corners } from '../core/system';
import { factoredSide, polyToString, rootLines, sci, sup } from './format';

describe('App', () => {
  it('renders the default system without throwing', () => {
    const html = renderToString(<App />);
    expect(html).toContain('bode');
    expect(html).toContain('magnitude');
    expect(html).toContain('transfer function');
  });

  it('shows the probe values the MATLAB prompt loop prints', () => {
    const html = renderToString(<App />);
    expect(html).toContain('−83.9364 dB');
    expect(html).toContain('−20.00 dB/dec');
    expect(html).toContain('−135.0000 °');
    expect(html).toContain('45.00 °/dec');
  });

  it('renders the factored transfer function under the heading', () => {
    const html = renderToString(<App />);
    expect(html).toContain('30 · s · (s + 4.7200e5)');
    expect(html).toContain('(s + 31000) · (s² + 38400s + 9.2160e9)');
  });

  it('produces path data for both traces and no bad numbers', () => {
    const html = renderToString(<App />);
    expect(html).toContain('trace-exact');
    expect(html).toContain('trace-approx');
    expect(html).not.toContain('NaN');
    expect(html).not.toContain('undefined');
  });

  it('defaults to light theme', () => {
    const html = renderToString(<App />);
    // The active class lands on the light button.
    expect(html).toMatch(/class="active"[^>]*>light|>light</);
  });
});

describe('BodePlot edge cases', () => {
  const base = {
    steps: [5, 10, 20, 40],
    from: -1,
    to: 2,
    omega: null,
    onScrub: () => {},
  };

  it('survives a magnitude of -Infinity (zero on the jw axis)', () => {
    // s^2+1 has zeros at +/-j, so |H| is exactly 0 at w = 1.
    const a = analyse('s^2+1', '(s+10)*(s+20)');
    const html = renderToString(
      <BodePlot {...base} samples={sweep(a, 200, -1, 2)} pick={(s) => ({ exact: s.exactMag, approx: s.approxMag })} />,
    );
    expect(html).not.toContain('NaN');
    expect(html).not.toContain('Infinity');
  });

  it('survives a constant system with no variation to scale', () => {
    const a = analyse('5', '2');
    const html = renderToString(
      <BodePlot {...base} samples={sweep(a, 50, -1, 1)} pick={(s) => ({ exact: s.exactMag, approx: s.approxMag })} />,
    );
    expect(html).not.toContain('NaN');
  });

  it('draws a crosshair when omega is set and inside the range', () => {
    const a = analyse('1', 's+1');
    const samples = sweep(a, 100, -1, 2);
    const on = renderToString(
      <BodePlot {...base} omega={10} samples={samples} pick={(s) => ({ exact: s.exactMag, approx: s.approxMag })} />,
    );
    const off = renderToString(
      <BodePlot {...base} omega={null} samples={samples} pick={(s) => ({ exact: s.exactMag, approx: s.approxMag })} />,
    );
    expect(on).toContain('xhair-line');
    expect(off).not.toContain('xhair-line');
  });

  it('ticks corner frequencies when given them', () => {
    const a = analyse('1', '(s+100)*(s+10000)');
    const html = renderToString(
      <BodePlot
        {...base}
        from={-3}
        to={6}
        corners={corners(a)}
        samples={sweep(a, 200, -3, 6)}
        pick={(s) => ({ exact: s.exactMag, approx: s.approxMag })}
      />,
    );
    expect(html).toContain('corner-label');
    expect(html).toContain('p1');
    expect(html).toContain('p2');
  });
});

describe('Sparkline', () => {
  it('renders a path and survives an all-zero series', () => {
    expect(renderToString(<Sparkline values={[0, 1, 4, 2]} />)).toContain('spark-line');
    const flat = renderToString(<Sparkline values={[0, 0, 0]} />);
    expect(flat).not.toContain('NaN');
  });

  it('survives non-finite entries', () => {
    const html = renderToString(<Sparkline values={[0, Infinity, 2, NaN]} />);
    expect(html).not.toContain('NaN');
    expect(html).not.toContain('Infinity');
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

  it('snaps root-finder float noise back to the integer', () => {
    // Durand-Kerner returns 31000.000000000004 for the README denominator.
    expect(sci(31000.000000000004)).toBe('31000');
  });

  it('renders superscripts', () => {
    expect(sup(2)).toBe('²');
    expect(sup(-3)).toBe('⁻³');
  });

  it('renders a complex pair as its real quadratic, not two linear factors', () => {
    const a = analyse('1', '(s^2+2*0.2*96000*s+96000^2)');
    expect(factoredSide(a.model.p, a.model.params.numPoleOrigin)).toBe(
      '(s² + 38400s + 9.2160e9)',
    );
  });

  it('omits a unit gain and renders origin order as a power', () => {
    const a = analyse('s*s', 's+1');
    expect(factoredSide(a.model.z, a.model.params.numZeroOrigin, a.k)).toBe('s²');
  });
});

describe('corners', () => {
  it('lists break frequencies ascending and skips roots at the origin', () => {
    const a = analyse('30*s*(s+472000)', '(s+31000)*(s^2+2*0.2*96000*s+96000^2)');
    const c = corners(a);
    expect(c.map((x) => x.label)).toEqual(['p1', 'p2', 'z1']);
    expect(c.map((x) => Math.round(x.w))).toEqual([31000, 96000, 472000]);
  });
});
