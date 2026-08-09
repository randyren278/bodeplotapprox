import { useEffect, useMemo, useRef, useState } from 'react';
import { analyse, sweep, probe, corners, type Analysis } from './core/system';
import { exactResponse } from './core/exact';
import { BodePlot } from './plot/BodePlot';
import { Sparkline } from './plot/Sparkline';
import { factoredSide, fixed, polyToString, rootLines, sci } from './ui/format';

const FROM = -3;
const TO = 6;

const DEFAULT_NUM = '30*s*(s+472000)';
const DEFAULT_DEN = '(s+31000)*(s^2+2*0.2*96000*s+96000^2)';
const THEME_KEY = 'bode-theme';

type Theme = 'light' | 'dark';

export default function App() {
  const [numStr, setNumStr] = useState(DEFAULT_NUM);
  const [denStr, setDenStr] = useState(DEFAULT_DEN);
  const [omega, setOmega] = useState<number>(472000);
  const [omegaText, setOmegaText] = useState('472000');
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark') setTheme(saved);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const parsed = useMemo(() => {
    try {
      return { ok: true as const, value: analyse(numStr, denStr) };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : String(e) };
    }
  }, [numStr, denStr]);

  /**
   * Keep the last system that parsed. While an expression is mid-edit and
   * temporarily invalid, the plots hold rather than blanking the page.
   */
  const lastGood = useRef<Analysis | null>(null);
  if (parsed.ok) lastGood.current = parsed.value;
  const a = parsed.ok ? parsed.value : lastGood.current;

  const samples = useMemo(() => (a ? sweep(a, 1000, FROM, TO) : []), [a]);
  const cornerList = useMemo(() => (a ? corners(a) : []), [a]);

  const magErr = useMemo(
    () => samples.map((s) => Math.abs(s.exactMag - s.approxMag)),
    [samples],
  );
  const phErr = useMemo(
    () => samples.map((s) => Math.abs(s.exactPhase - s.approxPhase)),
    [samples],
  );
  const maxOf = (xs: number[]) => (xs.length ? Math.max(...xs.filter(Number.isFinite)) : 0);

  const readout = a && Number.isFinite(omega) && omega > 0 ? probe(a, omega) : null;
  const exactAt = a && Number.isFinite(omega) && omega > 0
    ? exactResponse(a.num, a.den, omega)
    : null;

  const scrub = (w: number) => {
    setOmega(w);
    setOmegaText(sci(w).replace('−', '-'));
  };

  return (
    <div className="page">
      <header className="hdr">
        <div className="hdr-name">
          <b>bode</b> <span>· asymptotic approximation vs. exact response</span>
        </div>
        <div className="hdr-stat">
          <span>span <b>10⁻³–10⁶</b></span>
          <span>order <b>{a ? `${a.num.length - 1}/${a.den.length - 1}` : '—'}</b></span>
          <span className="theme-toggle">
            <button
              type="button"
              className={theme === 'light' ? 'active' : ''}
              onClick={() => setTheme('light')}
            >
              light
            </button>
            <span className="sep">/</span>
            <button
              type="button"
              className={theme === 'dark' ? 'active' : ''}
              onClick={() => setTheme('dark')}
            >
              dark
            </button>
          </span>
        </div>
      </header>

      <div className="body">
        <div className="rail">
          <section className="blk">
            <div className="blk-h">transfer function</div>

            <div className={`frac${parsed.ok ? '' : ' invalid'}`}>
              <div className="frac-n">{a ? factoredSide(a.model.z, a.model.params.numZeroOrigin, a.k) : '—'}</div>
              <div className="frac-bar" />
              <div className="frac-d">{a ? factoredSide(a.model.p, a.model.params.numPoleOrigin) : '—'}</div>
            </div>
            {a && (
              <div className="expanded">
                {polyToString(a.num)} &nbsp;/&nbsp; {polyToString(a.den)}
              </div>
            )}

            <div className="tf-row">
              <label className="tag" htmlFor="num">num</label>
              <input
                id="num"
                className={parsed.ok ? '' : 'bad'}
                value={numStr}
                spellCheck={false}
                autoComplete="off"
                onChange={(e) => setNumStr(e.target.value)}
              />
            </div>
            <div className="tf-div" />
            <div className="tf-row">
              <label className="tag" htmlFor="den">den</label>
              <input
                id="den"
                className={parsed.ok ? '' : 'bad'}
                value={denStr}
                spellCheck={false}
                autoComplete="off"
                onChange={(e) => setDenStr(e.target.value)}
              />
            </div>
            {!parsed.ok && <p className="err">{parsed.error}</p>}
          </section>

          <section className="blk">
            <div className="blk-h">poles / zeros</div>
            {a ? (
              <>
                {rootLines(a.zeros).map((l, i) => (
                  <div className="pz-line" key={`z${i}`}><span className="pz-tag">z</span>&nbsp; {l}</div>
                ))}
                {rootLines(a.poles).map((l, i) => (
                  <div className="pz-line" key={`p${i}`}><span className="pz-tag">p</span>&nbsp; {l}</div>
                ))}
              </>
            ) : (
              <div className="pz-line">—</div>
            )}
          </section>

          <section className="blk">
            <div className="blk-h">gain</div>
            <div className="kv">
              <span className="k">k</span><span className="v">{a ? sci(a.k) : '—'}</span>
              <span className="k">K</span><span className="v">{a ? sci(a.model.params.K) : '—'}</span>
            </div>
          </section>

          <section className="blk">
            <div className="blk-h">probe</div>
            <div className="probe">
              <label className="probe-sym" htmlFor="w">ω</label>
              <input
                id="w"
                value={omegaText}
                spellCheck={false}
                autoComplete="off"
                onChange={(e) => {
                  setOmegaText(e.target.value);
                  const v = Number(e.target.value);
                  if (Number.isFinite(v) && v > 0) setOmega(v);
                }}
              />
              <span className="probe-unit">rad/s</span>
            </div>
            <div className="kv out">
              <span className="k">exact mag</span>
              <span className="v">{exactAt ? `${fixed(exactAt.magDb, 4)} dB` : '—'}</span>
              <span className="k">approx mag</span>
              <span className="v accent">{readout ? `${fixed(readout.magDb, 4)} dB` : '—'}</span>
              <span className="k">mag slope</span>
              <span className="v accent">{readout ? `${fixed(readout.magSlope, 2)} dB/dec` : '—'}</span>
              <span className="k">approx phase</span>
              <span className="v accent">{readout ? `${fixed(readout.phaseDeg, 4)} °` : '—'}</span>
              <span className="k">phase slope</span>
              <span className="v accent">{readout ? `${fixed(readout.phaseSlope, 2)} °/dec` : '—'}</span>
            </div>
            <div className="probe-hint">or hover either plot</div>
          </section>
        </div>

        <div className="main">
          <section className="panel">
            <div className="panel-head"><span><b>magnitude</b> · dB</span></div>
            {samples.length > 0 ? (
              <BodePlot
                samples={samples}
                pick={(s) => ({ exact: s.exactMag, approx: s.approxMag })}
                steps={[5, 10, 20, 40, 60, 100, 200, 500, 1000]}
                from={FROM}
                to={TO}
                corners={cornerList}
                omega={omega}
                onScrub={scrub}
              />
            ) : (
              <p className="muted">No system to plot.</p>
            )}
            <div className="err-row">
              <span>|exact − approx|</span>
              <Sparkline values={magErr} />
              <span className="max">max {fixed(maxOf(magErr), 2)} dB</span>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head"><span><b>phase</b> · deg</span></div>
            {samples.length > 0 ? (
              <BodePlot
                samples={samples}
                pick={(s) => ({ exact: s.exactPhase, approx: s.approxPhase })}
                steps={[45, 90, 180]}
                from={FROM}
                to={TO}
                omega={omega}
                onScrub={scrub}
              />
            ) : (
              <p className="muted">No system to plot.</p>
            )}
            <div className="err-row">
              <span>|exact − approx|</span>
              <Sparkline values={phErr} />
              <span className="max">max {fixed(maxOf(phErr), 2)} °</span>
            </div>
          </section>
        </div>
      </div>

      <footer className="foot">
        <span>ported from bodewithgraphing.m</span>
        <span>1000 pts · logspace(−3, 6)</span>
      </footer>
    </div>
  );
}
