function bode_approximator()
    % Initialize symbolic variable
    syms s;
    
    % Get transfer function from user
    num_str = input('Enter numerator (e.g., 30*s*(s-472000)): ', 's');
    den_str = input('Enter denominator (e.g., (s+31000)*(s^2+2*0.2*96000*s+96000^2)): ', 's');
    
    % Convert to symbolic polynomials
    try
        num_sym = expand(str2sym(num_str));
        den_sym = expand(str2sym(den_str));
    catch
        error('Invalid input format. Use s as variable and MATLAB syntax.');
    end
    
    % Convert to polynomial coefficients
    num = sym2poly(num_sym);
    den = sym2poly(den_sym);
    
    % Create transfer function
    sys = tf(num, den);
    
    % Extract zeros, poles, and gain
    [z, p, k] = zpkdata(sys, 'v');
    
    % Process zeros and poles
    [real_z, complex_z_pairs, real_p, complex_p_pairs] = process_zp(z, p);
    
    % Compute origin counts and adjusted gain K for the approximation
    [num_zero_origin, num_pole_origin, K] = compute_params(real_z, real_p, complex_z_pairs, complex_p_pairs, k);
    
    %% Immediate Bode Plot Comparison
    % Define a frequency range starting very near 0 (1e-3 rad/s) up to 1e6 rad/s.
    % (Since semilog scales cannot include 0 exactly, we use 1e-3 rad/s as the low end.)
    w = logspace(-3, 6, 1000);
    
    % Preallocate arrays for approximated magnitude and phase values
    approx_mag = zeros(size(w));
    approx_phase = zeros(size(w));
    
    % Compute the approximated magnitude and phase over the frequency range
    for i = 1:length(w)
        approx_mag(i) = compute_magnitude(w(i), K, num_zero_origin, num_pole_origin, real_z, complex_z_pairs, real_p, complex_p_pairs);
        approx_phase(i) = compute_phase(w(i), k, num_zero_origin, num_pole_origin, real_z, complex_z_pairs, real_p, complex_p_pairs);
    end
    
    % Compute exact frequency response using bode() (convert magnitude to dB)
    [mag_exact, phase_exact, ~] = bode(sys, w);
    mag_exact = squeeze(20*log10(mag_exact));
    phase_exact = squeeze(phase_exact);
    
    % Plot both the exact and approximated Bode plots
    figure;
    
    % Magnitude plot
    subplot(2,1,1);
    semilogx(w, mag_exact, 'b', 'LineWidth',1.5); hold on;
    semilogx(w, approx_mag, 'r--', 'LineWidth',1.5);
    grid on;
    title('Bode Plot Comparison (Magnitude)');
    xlabel('Frequency (rad/s)');
    ylabel('Magnitude (dB)');
    legend('Exact','Approximation','Location','Best');
    
    % Phase plot
    subplot(2,1,2);
    semilogx(w, phase_exact, 'b', 'LineWidth',1.5); hold on;
    semilogx(w, approx_phase, 'r--', 'LineWidth',1.5);
    grid on;
    title('Bode Plot Comparison (Phase)');
    xlabel('Frequency (rad/s)');
    ylabel('Phase (degrees)');
    legend('Exact','Approximation','Location','Best');
    
    %% Interactive Frequency Calculation
    while true
        w_eval = input('Enter test frequency (rad/s) or "exit" to quit: ', 's');
        if strcmpi(w_eval, 'exit')
            break;
        end
        w_eval = str2double(w_eval);
        if isnan(w_eval)
            continue;
        end
        
        % Compute approximated magnitude and phase
        mag_dB = compute_magnitude(w_eval, K, num_zero_origin, num_pole_origin, real_z, complex_z_pairs, real_p, complex_p_pairs);
        phase_deg = compute_phase(w_eval, k, num_zero_origin, num_pole_origin, real_z, complex_z_pairs, real_p, complex_p_pairs);
        
        % Compute slopes (magnitude and phase)
        [mag_slope, phase_slope] = compute_slopes(w_eval, K, k, num_zero_origin, num_pole_origin, real_z, complex_z_pairs, real_p, complex_p_pairs);
        
        % Display results
        fprintf('\nAt w = %.6f rad/s:\n', w_eval);
        fprintf('Approximate Magnitude: %.6f dB\n', mag_dB);
        fprintf('Magnitude Slope:      %.2f dB/dec\n', mag_slope);
        fprintf('Approximate Phase:    %.6f°\n', phase_deg);
        fprintf('Phase Slope:          %.2f°/dec\n\n', phase_slope);
    end
end

function [real_z, complex_z_pairs, real_p, complex_p_pairs] = process_zp(z, p)
    % Process zeros
    [real_z, complex_z_pairs] = process_single_zp(z);
    % Process poles
    [real_p, complex_p_pairs] = process_single_zp(p);
end

function [real_part, complex_pairs] = process_single_zp(zp)
    real_part = [];
    complex_pairs = [];
    zp = zp(:);
    processed = false(size(zp));
    
    for i = 1:length(zp)
        if ~processed(i)
            if imag(zp(i)) == 0
                real_part = [real_part; zp(i)];
                processed(i) = true;
            else
                conj_idx = find(abs(zp - conj(zp(i))) < 1e-6 & ~processed, 1);
                if ~isempty(conj_idx)
                    complex_pairs = [complex_pairs; [zp(i), zp(conj_idx)]];
                    processed([i, conj_idx]) = true;
                else
                    error('Complex pole/zero without conjugate pair');
                end
            end
        end
    end
end

function [num_zero_origin, num_pole_origin, K] = compute_params(real_z, real_p, cz, cp, k)
    % Count origin terms
    num_zero_origin = sum(real_z == 0);
    num_pole_origin = sum(real_p == 0);
    
    % Remove origin terms
    real_z_non_origin = real_z(real_z ~= 0);
    real_p_non_origin = real_p(real_p ~= 0);
    
    % Compute products (handle complex pairs as ω² terms)
    product_z = prod(abs(real_z_non_origin));
    for i = 1:size(cz, 1)
        wz = abs(cz(i, 1)); % Natural frequency of complex zero pair
        product_z = product_z * wz^2;
    end
    
    product_p = prod(abs(real_p_non_origin));
    for i = 1:size(cp, 1)
        wp = abs(cp(i, 1)); % Natural frequency of complex pole pair
        product_p = product_p * wp^2;
    end
    
    % Calculate adjusted gain K for the approximation
    K = abs(k) * product_z / product_p;
end

function mag_dB = compute_magnitude(w, K, nz_orig, np_orig, rz, cz, rp, cp)
    mag_dB = 20*log10(K) + (nz_orig - np_orig)*20*log10(w);
    
    % Real zeros
    rz_non_origin = rz(rz ~= 0);
    for wz = abs(rz_non_origin)'
        if w >= wz
            mag_dB = mag_dB + 20*log10(w/wz);
        end
    end
    
    % Complex zeros
    for i = 1:size(cz, 1)
        wz = abs(cz(i, 1)); % Natural frequency
        if w >= wz
            mag_dB = mag_dB + 40*log10(w/wz);
        end
    end
    
    % Real poles
    rp_non_origin = rp(rp ~= 0);
    for wp = abs(rp_non_origin)'
        if w >= wp
            mag_dB = mag_dB - 20*log10(w/wp);
        end
    end
    
    % Complex poles
    for i = 1:size(cp, 1)
        wp = abs(cp(i, 1)); % Natural frequency
        if w >= wp
            mag_dB = mag_dB - 40*log10(w/wp);
        end
    end
end

function phase = compute_phase(w, k, num_zero_origin, num_pole_origin, rz, cz, rp, cp)
    phase = (num_zero_origin - num_pole_origin) * 90;
    if k < 0
        phase = phase - 180;
    end
    
    % Real zeros
    rz_non_origin = rz(rz ~= 0);
    for z = rz_non_origin'
        wz = abs(z);
        is_lhp = real(z) < 0;
        phase = phase + real_zero_phase(w, wz, is_lhp);
    end
    
    % Complex zeros
    for i = 1:size(cz, 1)
        z = cz(i, 1);
        wz = abs(z);
        zeta = -real(z)/wz;
        is_lhp = real(z) < 0;
        phase = phase + complex_zero_phase(w, wz, zeta, is_lhp);
    end
    
    % Real poles
    rp_non_origin = rp(rp ~= 0);
    for p = rp_non_origin'
        wp = abs(p);
        is_lhp = real(p) < 0;
        phase = phase + real_pole_phase(w, wp, is_lhp);
    end
    
    % Complex poles
    for i = 1:size(cp, 1)
        p = cp(i, 1);
        wp = abs(p);
        zeta = -real(p)/wp;
        is_lhp = real(p) < 0;
        phase = phase + complex_pole_phase(w, wp, zeta, is_lhp);
    end
    
    % Wrap phase to [-180°, 180°]
    phase = mod(phase + 180, 360) - 180;
end

function [mag_slope, phase_slope] = compute_slopes(w, K, k, num_zero_origin, num_pole_origin, rz, cz, rp, cp)
    % Analytic slope calculation for magnitude
    mag_slope = (num_zero_origin - num_pole_origin) * 20; % Initial slope from origin terms
    
    % Real zeros
    rz_non_origin = rz(rz ~= 0);
    for wz = abs(rz_non_origin)'
        if w >= wz
            mag_slope = mag_slope + 20;
        end
    end
    
    % Complex zeros
    for i = 1:size(cz, 1)
        wz = abs(cz(i, 1));
        if w >= wz
            mag_slope = mag_slope + 40;
        end
    end
    
    % Real poles
    rp_non_origin = rp(rp ~= 0);
    for wp = abs(rp_non_origin)'
        if w >= wp
            mag_slope = mag_slope - 20;
        end
    end
    
    % Complex poles
    for i = 1:size(cp, 1)
        wp = abs(cp(i, 1));
        if w >= wp
            mag_slope = mag_slope - 40;
        end
    end
    
    % Phase slope (numerical differentiation)
    dw = w * 1e-4 + eps;
    w_perturbed = w + dw;
    phase = compute_phase(w, k, num_zero_origin, num_pole_origin, rz, cz, rp, cp);
    phase_p = compute_phase(w_perturbed, k, num_zero_origin, num_pole_origin, rz, cz, rp, cp);
    phase_slope = (phase_p - phase) / (log10(w_perturbed) - log10(w));
end

function phase = real_zero_phase(w, wz, is_lhp)
    low = wz / 10;
    high = wz * 10;
    phase_sign = 1 - 2*~is_lhp;
    
    if w < low
        phase = 0;
    elseif w > high
        phase = 90 * phase_sign;
    else
        phase = 90 * phase_sign * (log10(w) - log10(low)) / (log10(high) - log10(low));
    end
end

function phase = complex_zero_phase(w, wz, zeta, is_lhp)
    phase_sign = 1 - 2*~is_lhp;
    w1 = wz * 10^(-zeta);
    w2 = wz * 10^zeta;
    
    if w < w1
        phase = 0;
    elseif w > w2
        phase = 180 * phase_sign;
    else
        phase = 180 * phase_sign * (log10(w) - log10(w1)) / (log10(w2) - log10(w1));
    end
end

function phase = real_pole_phase(w, wp, is_lhp)
    low = wp / 10;
    high = wp * 10;
    phase_sign = 1 - 2*~is_lhp;
    
    if w < low
        phase = 0;
    elseif w > high
        phase = -90 * phase_sign;
    else
        phase = -90 * phase_sign * (log10(w) - log10(low)) / (log10(high) - log10(low));
    end
end

function phase = complex_pole_phase(w, wp, zeta, is_lhp)
    phase_sign = 1 - 2*~is_lhp;
    w1 = wp * 10^(-zeta);
    w2 = wp * 10^zeta;
    
    if w < w1
        phase = 0;
    elseif w > w2
        phase = -180 * phase_sign;
    else
        phase = -180 * phase_sign * (log10(w) - log10(w1)) / (log10(w2) - log10(w1));
    end
end
