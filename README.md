# Bode Plot Approximation Tool

## Overview
This MATLAB tool provides an interactive and accurate way to approximate and analyze Bode plots for linear time-invariant (LTI) systems. It allows users to input a transfer function in a natural symbolic format (e.g., `30*s*(s-472000)`), computes the magnitude and phase characteristics, and generates professional-quality Bode plots _(in progress)_. Additionally, it enables users to evaluate the system's response at specific frequencies, including magnitude, phase, and their respective slopes.

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
