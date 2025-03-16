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
    
    % Compute origin counts and K
    [num_zero_origin, num_pole_origin, K] = compute_params(real_z, real_p, complex_z_pairs, complex_p_pairs, k);
    
    % Main evaluation loop
    while true
        w_eval = input('Enter test frequency (rad/s) or "exit" to quit: ', 's');
        if strcmpi(w_eval, 'exit')
            break;
        end
        w_eval = str2double(w_eval);
        if isnan(w_eval)
            continue;
        end
        
        % Compute magnitude and phase
        mag_dB = compute_magnitude(w_eval, K, num_zero_origin, num_pole_origin, real_z, complex_z_pairs, real_p, complex_p_pairs);
        phase_deg = compute_phase(w_eval, k, num_zero_origin, num_pole_origin, real_z, complex_z_pairs, real_p, complex_p_pairs);
        
        % Compute slopes
        [mag_slope, phase_slope] = compute_slopes(w_eval, K, k, num_zero_origin, num_pole_origin, real_z, complex_z_pairs, real_p, complex_p_pairs);
        
        % Display results
        fprintf('\nAt w = %.2f rad/s:\n', w_eval);
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
    
    % Calculate K
    K = abs(k) * product_z / product_p;
end

function mag_dB = compute_magnitude(w, K, nz_orig, np_orig, rz, cz, rp, cp)
    mag_dB = 20*log10(K) + (nz_orig - np_orig)*20*log10(w);
    
    % Real zeros
    rz_non_orig = rz(rz ~= 0);
    for wz = abs(rz_non_orig)'
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
    rp_non_orig = rp(rp ~= 0);
    for wp = abs(rp_non_orig)'
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
    rz_non_orig = rz(rz ~= 0);
    for z = rz_non_orig'
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
    rp_non_orig = rp(rp ~= 0);
    for p = rp_non_orig'
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
    rz_non_orig = rz(rz ~= 0);
    for wz = abs(rz_non_orig)'
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
    rp_non_orig = rp(rp ~= 0);
    for wp = abs(rp_non_orig)'
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
    
    % Phase slope calculation remains numerical (or implement analytic if needed)
    dw = w * 1e-4 + eps;
    w_perturbed = w + dw;
    phase = compute_phase(w, k, num_zero_origin, num_pole_origin, rz, cz, rp, cp);
    phase_p = compute_phase(w_perturbed, k, num_zero_origin, num_pole_origin, rz, cz, rp, cp);
    phase_slope = (phase_p - phase) / (log10(w_perturbed) - log10(w));
end

% Remaining helper functions unchanged from previous version
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