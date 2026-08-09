# Bode Plot Approximation Tool

## Overview
This MATLAB tool provides an interactive and accurate way to approximate and analyze Bode plots for linear time-invariant (LTI) systems. It allows users to input a transfer function in a natural symbolic format (e.g., `30*s*(s-472000)`), computes the magnitude and phase characteristics, and generates professional-quality Bode plots _(in progress)_. Additionally, it enables users to evaluate the system's response at specific frequencies, including magnitude, phase, and their respective slopes.

There is now also a **browser version** that needs no MATLAB — see [Running It](#running-it).

---

## Running It

### Web (no MATLAB required)

```bash
npm install
npm start
```

Opens on `http://localhost:5173`. Everything runs client-side; there is no server and no
MATLAB dependency. `npm run build` produces a static bundle.

The web version is a **line-for-line TypeScript port** of `bodewithgraphing.m` — same
asymptote rules, same constants, same behaviour, including the quirks documented under
[Known Parity Artifacts](#known-parity-artifacts). The `.m` files are unmodified and remain
the reference implementation.

Three MATLAB built-ins are reimplemented in `src/core/` so no toolboxes are needed:

| MATLAB | Replacement | Purpose |
| --- | --- | --- |
| `str2sym` + `expand` + `sym2poly` | `poly.ts` | Parse an expression in `s` into polynomial coefficients |
| `roots` / `zpkdata` | `roots.ts` | Durand–Kerner root finding, and the zpk gain |
| `bode` | `exact.ts` | Exact response, `num(jω)/den(jω)` |

`npm test` runs the verification suite (40 tests) covering the parser, root round-trips,
the ported asymptote rules, slope self-consistency, and exact-vs-approximate agreement.

### MATLAB

Requires the Symbolic Math and Control System toolboxes.

```matlab
>> bodewithgraphing   % plot comparison + interactive frequency prompt
>> bodeplot           % interactive frequency prompt only
```

---

## Features
1. **Natural Input Format**:
   - Users can input transfer functions in a symbolic format (e.g., `30*s*(s-472000)` or `(s+2)*(s^2+8*s+32)`).
   - Handles real and complex poles/zeros, including those at the origin.

2. **Accurate Bode Plot Approximation**:
   - Computes magnitude (in dB) and phase (in degrees) across a wide frequency range.
   - Uses analytic slope calculations for precise results.

3. **Interactive Frequency Analysis**:
   - Users can input specific frequencies to evaluate the system's response.
   - Provides magnitude, phase, and their slopes at the specified frequency.

4. **Robust Handling of System Components**:
   - Supports real and complex poles/zeros.
   - Correctly accounts for right-half-plane (RHP) and left-half-plane (LHP) components.
   - Handles poles/zeros at the origin.

5. **Slope Calculation**:
   - Computes magnitude slope (dB/decade) and phase slope (degrees/decade) at any frequency.
   - Matches exact slope values for corner frequencies.

---

## How It Works
1. **Input Transfer Function**:
   - The user inputs the numerator and denominator of the transfer function in symbolic form.
   - Example:
     ```
     Numerator: 30*s*(s-472000)
     Denominator: (s+31000)*(s^2+2*0.2*96000*s+96000^2)
     ```

2. **System Analysis**:
   - The tool extracts poles, zeros, and gain from the transfer function.
   - Computes the low-frequency gain (`K`) and processes real/complex poles and zeros.

3. **Bode Plot Generation**:
   - Automatically determines the frequency range based on pole/zero locations.
   - Computes magnitude and phase across the frequency range.
   - Plots the Bode magnitude and phase diagrams.

4. **Interactive Testing**:
   - Users can input specific frequencies to evaluate the system's response.
   - The tool outputs:
     - Approximate magnitude (dB)
     - Magnitude slope (dB/decade)
     - Approximate phase (degrees)
     - Phase slope (degrees/decade)

---

## Example Usage
### Input:
```matlab
Enter numerator: 30*s*(s-472000)
Enter denominator: (s+31000)*(s^2+2*0.2*96000*s+96000^2)
```

---

## Known Parity Artifacts

Behaviours the web port **reproduces rather than fixes**, so that both versions agree. Each is
pinned by a test, so changing one has to be deliberate.

### 1. Systems with RHP poles/zeros are 180° off in phase

`compute_phase` applies its −180° correction only when the zpk gain `k` is negative. But a
right-half-plane real zero `(s − a)` contributes a negative factor at low frequency that never
reaches `k`, and `real_zero_phase` models only the 0 → −90° swing across the corner — not the
constant +180° such a factor carries. Any system with an **odd number of RHP poles or zeros**
therefore comes out a flat 180° away from the true phase at every frequency.

The example above is one: at ω = 10⁶ rad/s the approximation gives **+120.3°** where the exact
response is **−60.7°**. Magnitude is unaffected and tracks correctly.

### 2. Phase wrap

`compute_phase` wraps to [−180°, 180°]; MATLAB's `bode` returns unwrapped phase, so in the
MATLAB figure the two traces separate by 360° at high frequency. The web version wraps the exact
trace as well so the comparison reads. This is display-only — the ported approximation code is
untouched.

### 3. Complex-pair transition band

`complex_zero_phase` / `complex_pole_phase` use ω·10^∓ζ as the phase transition band, which
collapses to a step as ζ → 0. Reproduced as-is.
