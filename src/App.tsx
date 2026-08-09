import { useMemo, useState } from 'react';
import { analyse, sweep, probe, type Analysis } from './core/system';
import { BodePlot, Legend } from './plot/BodePlot';
import { fixed, rootLines, sci, polyToString } from './ui/format';

const FROM = -3;
const TO = 6;

const DEFAULT_NUM = '30*s*(s+472000)';
const DEFAULT_DEN = '(s+31000)*(s^2+2*0.2*96000*s+96000^2)';

export default function App() {
  const [numStr, setNumStr] = useState(DEFAULT_NUM);
  const [denStr, setDenStr] = useState(DEFAULT_DEN);
  const [wStr, setWStr] = useState('472000');

  const parsed = useMemo((): { ok: true; value: Analysis } | { ok: false; error: string } => {
    try {
      return { ok: true, value: analyse(numStr, denStr) };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }, [numStr, denStr]);

  const samples = useMemo(
    () => (parsed.ok ? sweep(parsed.value, 1000, FROM, TO) : []),
    [parsed],
  );

  const w = Number(wStr);
  const readout = parsed.ok && Number.isFinite(w) && w > 0 ? probe(parsed.value, w) : null;

  return (
    <div className="page">
      <header className="masthead">
        <div>
          <div className="brand">Bode Approx</div>
          <p className="tagline">Straight-line asymptotes, and exactly how far off they are.</p>
        </div>
        <div className="masthead-meta">
          Asymptotic analysis
          <br />
          LTI · continuous-time
        </div>
      </header>

      <div className="grid">
        <div className="col">
          <section className="cell">
            <div className="cell-head">
              <span className="kicker">Transfer function</span>
              <span className="kicker">H(s)</span>
            </div>
            <div className="tf">
              <label className="tf-lab" htmlFor="num">
                num
              </label>
              <input
                id="num"
                className="tf-in"
                value={numStr}
                spellCheck={false}
                autoComplete="off"
                onChange={(e) => setNumStr(e.target.value)}
              />
              <div className="tf-bar" />
              <label className="tf-lab" htmlFor="den">
                den
              </label>
              <input
                id="den"
                className="tf-in"
                value={denStr}
                spellCheck={false}
                autoComplete="off"
                onChange={(e) => setDenStr(e.target.value)}
              />
            </div>
            {!parsed.ok && <p className="error">{parsed.error}</p>}
          </section>

          <section className="cell">
            <div className="cell-head">
              <span className="kicker">System</span>
            </div>
            {parsed.ok ? (
              <div className="rows">
                <span className="rl">Order</span>
                <span className="rv">
                  {parsed.value.num.length - 1} / {parsed.value.den.length - 1}
                </span>
                <span className="rl">Expanded</span>
                <span className="rv wrap">
                  {polyToString(parsed.value.num)}
                  <br />
                  <span className="over">{polyToString(parsed.value.den)}</span>
                </span>
                <span className="rl">Gain k</span>
                <span className="rv">{sci(parsed.value.k)}</span>
                <span className="rl">Zeros</span>
                <span className="rv">
                  {rootLines(parsed.value.zeros).map((l, i) => (
                    <span key={i} className="line">
                      {l}
                    </span>
                  ))}
                </span>
                <span className="rl">Poles</span>
                <span className="rv">
                  {rootLines(parsed.value.poles).map((l, i) => (
                    <span key={i} className="line">
                      {l}
                    </span>
                  ))}
                </span>
                <span className="rl">K</span>
                <span className="rv">{sci(parsed.value.model.params.K)}</span>
              </div>
            ) : (
              <p className="muted">—</p>
            )}
          </section>

          <section className="cell">
            <div className="cell-head">
              <span className="kicker">Frequency probe</span>
            </div>
            <div className="probe">
              <label className="probe-sym" htmlFor="w">
                ω
              </label>
              <input
                id="w"
                className="tf-in"
                value={wStr}
                spellCheck={false}
                autoComplete="off"
                onChange={(e) => setWStr(e.target.value)}
              />
              <span className="probe-unit">rad/s</span>
            </div>
            <div className="out">
              <span className="rl">Magnitude</span>
              <span className="rv">{readout ? `${fixed(readout.magDb, 4)} dB` : '—'}</span>
              <span className="rl">Mag slope</span>
              <span className="rv">
                {readout ? `${fixed(readout.magSlope, 2)} dB/dec` : '—'}
              </span>
              <span className="rl">Phase</span>
              <span className="rv">{readout ? `${fixed(readout.phaseDeg, 4)} °` : '—'}</span>
              <span className="rl">Phase slope</span>
              <span className="rv">
                {readout ? `${fixed(readout.phaseSlope, 2)} °/dec` : '—'}
              </span>
            </div>
          </section>
        </div>

        <div className="col">
          <section className="cell">
            <div className="cell-head">
              <span className="kicker ink">Magnitude</span>
              <span className="kicker">dB</span>
            </div>
            {samples.length > 0 ? (
              <BodePlot
                samples={samples}
                pick={(s) => ({ exact: s.exactMag, approx: s.approxMag })}
                steps={[5, 10, 20, 40, 60, 100, 200, 500, 1000]}
                from={FROM}
                to={TO}
              />
            ) : (
              <p className="muted">No system to plot.</p>
            )}
            <Legend />
          </section>

          <section className="cell">
            <div className="cell-head">
              <span className="kicker ink">Phase</span>
              <span className="kicker">deg</span>
            </div>
            {samples.length > 0 ? (
              <BodePlot
                samples={samples}
                pick={(s) => ({ exact: s.exactPhase, approx: s.approxPhase })}
                steps={[45, 90, 180]}
                from={FROM}
                to={TO}
              />
            ) : (
              <p className="muted">No system to plot.</p>
            )}
            <Legend />
          </section>
        </div>
      </div>

      <footer className="foot">
        <span>ω ∈ [10⁻³, 10⁶] rad/s · 1000 pts</span>
        <span>Ported from bodewithgraphing.m</span>
      </footer>
    </div>
  );
}
