<a name="readme-top"></a>

<p align="center">
  <img src="public/favicon.svg" width="72" height="72" alt="bode — a corner-frequency break, marked">
</p>

<h1 align="center">bode</h1>

<p align="center"><i>Straight-line asymptotes, and exactly how far off they are.</i></p>

<p align="center">
  <a href="https://bode.randyren.org">Live</a> ·
  <a href="#running-it">Running It</a> ·
  <a href="#stack">Stack</a> ·
  <a href="#features">Features</a> ·
  <a href="#how-it-works">How It Works</a> ·
  <a href="#known-parity-artifacts">Known Parity Artifacts</a>
</p>

<p align="center">
  <a href="https://bode.randyren.org"><img src="https://img.shields.io/website?url=https%3A%2F%2Fbode.randyren.org&style=for-the-badge&label=bode.randyren.org&up_color=1d4ed8&down_color=9a2012" alt="live site status"></a>
  <img src="https://img.shields.io/badge/TypeScript-5.7-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/React-18-14140f?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React">
  <img src="https://img.shields.io/badge/Vite-8-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite">
  <img src="https://img.shields.io/badge/Deployed%20on-Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white" alt="Deployed on Vercel">
</p>

---

An asymptotic Bode plot approximator for linear time-invariant (LTI) systems. Enter a transfer
function in natural symbolic form — `30*s*(s+472000)` over `(s+31000)*(s^2+2*0.2*96000*s+96000^2)`
— and it derives poles, zeros and gain, draws the straight-line magnitude and phase asymptotes
against the exact response, and reports magnitude, phase, and their slopes at any test frequency.

> [!NOTE]
> **Two implementations, one algorithm.** `bodewithgraphing.m` / `bodeplot.m` are the original
> MATLAB tool and require the Symbolic Math and Control System toolboxes. The browser version at
> [bode.randyren.org](https://bode.randyren.org) is a line-for-line TypeScript port — same
> asymptote rules, same constants, no MATLAB or toolboxes needed. See [Running It](#running-it).

<p align="right"><a href="#readme-top">back to top ↑</a></p>

## Stack

<table>
  <tr><td><b>Live</b></td><td><a href="https://bode.randyren.org">bode.randyren.org</a> — static, client-side only, no server</td></tr>
  <tr><td><b>Frontend</b></td><td>React 18 · Vite 8 · TypeScript, hand-drawn SVG plots (no chart library)</td></tr>
  <tr><td><b>Source of truth</b></td><td><code>bodewithgraphing.m</code> — unmodified; the web port is checked against it</td></tr>
  <tr><td><b>Tests</b></td><td><code>npm test</code> — 53 Vitest cases: parser, root round-trips, asymptote values, slope self-consistency, exact-vs-approximate agreement</td></tr>
  <tr><td><b>Deploy</b></td><td>Vercel, git-connected — push to <code>main</code> ships production</td></tr>
</table>

<p align="right"><a href="#readme-top">back to top ↑</a></p>

## Running It

### Web (no MATLAB required)

```bash
npm install
npm start
```

Opens on `http://localhost:5173`. Everything runs client-side; there is no server and no
MATLAB dependency. `npm run build` produces a static bundle.

Three MATLAB built-ins are reimplemented in `src/core/` so no toolboxes are needed:

| MATLAB | Replacement | Purpose |
| --- | --- | --- |
| `str2sym` + `expand` + `sym2poly` | `poly.ts` | Parse an expression in `s` into polynomial coefficients |
| `roots` / `zpkdata` | `roots.ts` | Durand–Kerner root finding, and the zpk gain |
| `bode` | `exact.ts` | Exact response, `num(jω)/den(jω)` |

### MATLAB

Requires the Symbolic Math and Control System toolboxes.

```matlab
>> bodewithgraphing   % plot comparison + interactive frequency prompt
>> bodeplot           % interactive frequency prompt only
```

<p align="right"><a href="#readme-top">back to top ↑</a></p>

## Features

- **Natural input format** — `30*s*(s-472000)`, `(s+2)*(s^2+8*s+32)`; real and complex poles/zeros,
  including those at the origin.
- **Rendered H(s)** — the entered expression is shown back as a factored fraction plus its
  expanded polynomial, so you can confirm the parse before trusting the plot.
- **Exact vs. asymptotic overlay** — magnitude (dB) and phase (deg) across a wide frequency range,
  with a deviation sparkline showing where the approximation is weakest.
- **Frequency probe** — magnitude, phase, and their analytic slopes (dB/decade, °/decade) at any
  test frequency, live-linked to a crosshair on both plots.
- **Correct half-plane handling** — right-half-plane and left-half-plane poles/zeros are
  distinguished, including the case where that distinction breaks the approximation (see below).
- **Light and dark**, no flash on load.

<p align="right"><a href="#readme-top">back to top ↑</a></p>

## How It Works

1. **Parse.** The numerator and denominator are read as polynomials in `s`.
2. **Factor.** Poles, zeros and gain are extracted; the low-frequency gain `K` used by the
   approximation is computed from them.
3. **Sweep.** Magnitude and phase are computed across `logspace(-3, 6)`, both exactly (`H(jω)`)
   and via the straight-line asymptote rules.
4. **Probe.** At any chosen ω, the tool reports approximate magnitude, magnitude slope, approximate
   phase, and phase slope — the same four values the original MATLAB prompt loop printed.

<p align="right"><a href="#readme-top">back to top ↑</a></p>

## Known Parity Artifacts

Behaviours the web port **reproduces rather than fixes**, so that both versions agree. Each is
pinned by a test, so changing one has to be deliberate.

> [!WARNING]
> **Systems with an odd number of right-half-plane poles/zeros are 180° off in phase.**
> `compute_phase` applies its −180° correction only when the zpk gain `k` is negative. But a
> right-half-plane real zero `(s − a)` contributes a negative factor at low frequency that never
> reaches `k`, and `real_zero_phase` models only the 0 → −90° swing across the corner — not the
> constant +180° such a factor carries. `30*s*(s-472000)` is one such system: at ω = 10⁶ rad/s the
> approximation gives **+120.3°** where the exact response is **−60.7°**. Magnitude is unaffected.

**Phase wrap.** `compute_phase` wraps to [−180°, 180°]; MATLAB's `bode` returns unwrapped phase, so
in the MATLAB figure the two traces separate by 360° at high frequency. The web version wraps the
exact trace too so the comparison reads — display-only, the ported approximation code is untouched.

**Complex-pair transition band.** `complex_zero_phase` / `complex_pole_phase` use ω·10^∓ζ as the
phase transition band, which collapses to a step as ζ → 0. Reproduced as-is.

<p align="right"><a href="#readme-top">back to top ↑</a></p>
