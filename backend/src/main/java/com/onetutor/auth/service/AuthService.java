package com.onetutor.auth.service;

import com.onetutor.auth.dto.*;
import com.onetutor.auth.entity.EmailOtp;
import com.onetutor.auth.entity.EmailVerification;
import com.onetutor.auth.entity.PasswordResetToken;
import com.onetutor.auth.entity.RefreshToken;
import com.onetutor.auth.repository.EmailOtpRepository;
import com.onetutor.auth.repository.EmailVerificationRepository;
import com.onetutor.auth.repository.PasswordResetTokenRepository;
import com.onetutor.auth.repository.RefreshTokenRepository;
import com.onetutor.common.email.EmailService;
import com.onetutor.common.exceptions.BadRequestException;
import com.onetutor.common.exceptions.ConflictException;
import com.onetutor.common.exceptions.UnauthorizedException;
import com.onetutor.users.entity.User;
import com.onetutor.users.entity.UserRole;
import com.onetutor.users.entity.UserStatus;
import com.onetutor.users.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.Map;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final EmailVerificationRepository verificationTokenRepository;
    private final PasswordResetTokenRepository resetTokenRepository;
    private final EmailOtpRepository emailOtpRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;
    private final EmailService emailService;
    private final String appBaseUrl;
    private final boolean loginAlertEnabled;
    private final String googleClientId;
    private final RestClient restClient;

    private static final SecureRandom RNG = new SecureRandom();

    public AuthService(UserRepository userRepository,
                        RefreshTokenRepository refreshTokenRepository,
                        EmailVerificationRepository verificationTokenRepository,
                        PasswordResetTokenRepository resetTokenRepository,
                        EmailOtpRepository emailOtpRepository,
                        PasswordEncoder passwordEncoder,
                        AuthenticationManager authenticationManager,
                        JwtService jwtService,
                        EmailService emailService,
                        @Value("${app.base-url}") String appBaseUrl,
                        @Value("${app.mail.login-alert-enabled:false}") boolean loginAlertEnabled,
                        @Value("${app.google.client-id:}") String googleClientId) {
        this.userRepository = userRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.verificationTokenRepository = verificationTokenRepository;
        this.resetTokenRepository = resetTokenRepository;
        this.emailOtpRepository = emailOtpRepository;
        this.passwordEncoder = passwordEncoder;
        this.authenticationManager = authenticationManager;
        this.jwtService = jwtService;
        this.emailService = emailService;
        this.appBaseUrl = appBaseUrl;
        this.loginAlertEnabled = loginAlertEnabled;
        this.googleClientId = googleClientId;
        this.restClient = RestClient.create();
    }

    @Transactional
    public void register(RegisterRequest req) {
        if (userRepository.existsByEmail(req.email().toLowerCase())) {
            throw new ConflictException("EMAIL_TAKEN", "An account with this email already exists");
        }

        User user = new User();
        user.setName(req.name());
        user.setEmail(req.email().toLowerCase());
        user.setPasswordHash(passwordEncoder.encode(req.password()));
        user.setRole(UserRole.student);
        user.setStatus(UserStatus.active);
        user.setEmailVerified(false);
        userRepository.save(user);

        issueVerificationEmail(user);
    }

    private void issueVerificationEmail(User user) {
        EmailVerification token = new EmailVerification();
        token.setUser(user);
        token.setToken(randomToken());
        token.setExpiresAt(Instant.now().plusSeconds(24 * 3600));
        verificationTokenRepository.save(token);

        String link = appBaseUrl + "/verify-email?token=" + token.getToken();
        emailService.sendVerificationEmail(user.getEmail(), user.getName(), link);
    }

    @Transactional
    public void verifyEmail(String rawToken) {
        EmailVerification token = verificationTokenRepository.findByToken(rawToken)
                .orElseThrow(() -> new BadRequestException("INVALID_TOKEN", "Verification link is invalid"));

        if (token.getVerifiedAt() != null) {
            throw new BadRequestException("TOKEN_ALREADY_USED", "This verification link was already used");
        }
        if (token.getExpiresAt().isBefore(Instant.now())) {
            throw new BadRequestException("TOKEN_EXPIRED", "This verification link has expired");
        }

        User user = token.getUser();
        user.setEmailVerified(true);
        userRepository.save(user);

        token.setVerifiedAt(Instant.now());
        verificationTokenRepository.save(token);
    }

    @Transactional
    public AuthResponse login(LoginRequest req) {
        try {
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(req.email().toLowerCase(), req.password()));
        } catch (BadCredentialsException e) {
            throw new UnauthorizedException("INVALID_CREDENTIALS", "Invalid email or password");
        }

        User user = userRepository.findByEmail(req.email().toLowerCase())
                .orElseThrow(() -> new UnauthorizedException("INVALID_CREDENTIALS", "Invalid email or password"));

        if (user.getStatus() == UserStatus.disabled) {
            throw new UnauthorizedException("ACCOUNT_DISABLED", "This account has been disabled");
        }

        return issueNewSessionTokens(user);
    }

    @Transactional
    public AuthResponse refresh(String rawRefreshToken) {
        RefreshToken stored = refreshTokenRepository.findByToken(rawRefreshToken)
                .orElseThrow(() -> new UnauthorizedException("INVALID_REFRESH_TOKEN", "Refresh token is invalid"));

        if (stored.isRevoked() || stored.getExpiresAt().isBefore(Instant.now())) {
            throw new UnauthorizedException("INVALID_REFRESH_TOKEN", "Refresh token is invalid or expired");
        }

        User user = stored.getUser();
        if (user.getStatus() == UserStatus.disabled) {
            throw new UnauthorizedException("ACCOUNT_DISABLED", "This account has been disabled");
        }

        // Rotate: revoke old, issue new
        stored.setRevoked(true);
        refreshTokenRepository.save(stored);

        return issueTokens(user);
    }

    @Transactional
    public void logout(String rawRefreshToken) {
        refreshTokenRepository.findByToken(rawRefreshToken).ifPresent(rt -> {
            rt.setRevoked(true);
            refreshTokenRepository.save(rt);
        });
    }

    @Transactional
    public void forgotPassword(String email) {
        userRepository.findByEmail(email.toLowerCase()).ifPresent(user -> {
            PasswordResetToken token = new PasswordResetToken();
            token.setUser(user);
            token.setToken(randomToken());
            token.setExpiresAt(Instant.now().plusSeconds(3600));
            resetTokenRepository.save(token);

            String link = appBaseUrl + "/reset-password?token=" + token.getToken();
            emailService.sendPasswordResetEmail(user.getEmail(), user.getName(), link);
        });
        // Always behave the same whether or not the email exists, to avoid
        // leaking which addresses are registered.
    }

    @Transactional
    public void resetPassword(String rawToken, String newPassword) {
        PasswordResetToken token = resetTokenRepository.findByToken(rawToken)
                .orElseThrow(() -> new BadRequestException("INVALID_TOKEN", "Reset link is invalid"));

        if (token.getUsedAt() != null) {
            throw new BadRequestException("TOKEN_ALREADY_USED", "This reset link was already used");
        }
        if (token.getExpiresAt().isBefore(Instant.now())) {
            throw new BadRequestException("TOKEN_EXPIRED", "This reset link has expired");
        }

        User user = token.getUser();
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        userRepository.save(user);

        token.setUsedAt(Instant.now());
        resetTokenRepository.save(token);

        // Revoke all existing refresh tokens on password change
        refreshTokenRepository.deleteByUserId(user.getId());
    }

    @Transactional
    public AuthResponse loginWithGoogle(GoogleAuthRequest req) {
        String normalizedEmail = req.email().toLowerCase().trim();
        String effectiveName = req.name() != null ? req.name().trim() : null;
        String effectivePicture = req.picture();

        // If Google Client ID is configured and an idToken is provided, verify with Google
        if (googleClientId != null && !googleClientId.isBlank() && req.idToken() != null && !req.idToken().isBlank()) {
            try {
                Map<String, Object> tokenInfo = restClient.get()
                        .uri("https://oauth2.googleapis.com/tokeninfo?id_token=" + req.idToken().trim())
                        .retrieve()
                        .body(new ParameterizedTypeReference<Map<String, Object>>() {});

                if (tokenInfo == null) {
                    throw new UnauthorizedException("INVALID_GOOGLE_TOKEN", "Google authentication token verification failed");
                }

                String aud = (String) tokenInfo.get("aud");
                if (aud == null || !aud.equals(googleClientId.trim())) {
                    throw new UnauthorizedException("INVALID_GOOGLE_AUDIENCE", "Google token audience mismatch");
                }

                String tokenEmail = (String) tokenInfo.get("email");
                if (tokenEmail != null && !tokenEmail.isBlank()) {
                    normalizedEmail = tokenEmail.toLowerCase().trim();
                }
                String tokenName = (String) tokenInfo.get("name");
                if (tokenName != null && !tokenName.isBlank()) {
                    effectiveName = tokenName.trim();
                }
                String tokenPic = (String) tokenInfo.get("picture");
                if (tokenPic != null && !tokenPic.isBlank()) {
                    effectivePicture = tokenPic;
                }
            } catch (UnauthorizedException e) {
                throw e;
            } catch (Exception e) {
                throw new UnauthorizedException("INVALID_GOOGLE_TOKEN", "Failed to verify Google token: " + e.getMessage());
            }
        }

        User user = userRepository.findByEmail(normalizedEmail).orElse(null);

        if (user != null) {
            if (user.getStatus() == UserStatus.disabled) {
                throw new UnauthorizedException("ACCOUNT_DISABLED", "This account has been disabled");
            }
            // Mark email as verified since Google verifies identity
            user.setEmailVerified(true);
            if (effectivePicture != null && !effectivePicture.isBlank()) {
                user.setProfileImage(effectivePicture);
            }
            userRepository.save(user);
            return issueNewSessionTokens(user);
        }

        // New student registration via Google
        User newUser = new User();
        newUser.setName(effectiveName != null && !effectiveName.isBlank() ? effectiveName : "Student");
        newUser.setEmail(normalizedEmail);
        newUser.setPasswordHash(passwordEncoder.encode(randomToken())); // Secure random password
        newUser.setRole(UserRole.student);
        newUser.setStatus(UserStatus.active);
        newUser.setEmailVerified(true);
        newUser.setProfileImage(effectivePicture);
        userRepository.save(newUser);

        return issueNewSessionTokens(newUser);
    }

    @Transactional
    public OtpResponse sendRegistrationOtp(String email) {
        String normalizedEmail = email.toLowerCase().trim();

        // If verified user already exists, reject
        userRepository.findByEmail(normalizedEmail).ifPresent(u -> {
            if (u.isEmailVerified()) {
                throw new ConflictException("EMAIL_ALREADY_REGISTERED", "An account with this email already exists");
            }
        });

        // Invalidate prior unused registration OTPs for this email
        List<EmailOtp> existing = emailOtpRepository.findByEmailIgnoreCaseAndPurposeAndUsedAtIsNull(normalizedEmail, "REGISTRATION");
        for (EmailOtp o : existing) {
            o.setUsedAt(Instant.now());
        }
        emailOtpRepository.saveAll(existing);

        // Generate 6-digit OTP
        String otp = String.format("%06d", RNG.nextInt(1000000));
        EmailOtp otpEntity = new EmailOtp();
        otpEntity.setEmail(normalizedEmail);
        otpEntity.setOtpCode(otp);
        otpEntity.setPurpose("REGISTRATION");
        otpEntity.setExpiresAt(Instant.now().plusSeconds(600)); // 10 minutes
        emailOtpRepository.save(otpEntity);

        emailService.sendOtpEmail(normalizedEmail, null, otp, "REGISTRATION");
        String devOtp = emailService.isMailConfigured() ? null : otp;
        return new OtpResponse("Verification code sent to your email", devOtp);
    }

    @Transactional
    public AuthResponse verifyRegistrationOtp(VerifyRegisterOtpRequest req) {
        String normalizedEmail = req.email().toLowerCase().trim();

        EmailOtp otpRecord = emailOtpRepository.findTopByEmailIgnoreCaseAndPurposeAndUsedAtIsNullOrderByCreatedAtDesc(normalizedEmail, "REGISTRATION")
                .orElseThrow(() -> new BadRequestException("INVALID_OTP", "Invalid or expired verification code"));

        if (otpRecord.getExpiresAt().isBefore(Instant.now())) {
            throw new BadRequestException("OTP_EXPIRED", "Verification code has expired. Please request a new code.");
        }

        if (!otpRecord.getOtpCode().equals(req.otp().trim())) {
            throw new BadRequestException("INVALID_OTP", "Invalid verification code. Please check and try again.");
        }

        otpRecord.setUsedAt(Instant.now());
        emailOtpRepository.save(otpRecord);

        // Create or activate student user
        User user = userRepository.findByEmail(normalizedEmail).orElse(null);
        if (user != null) {
            if (user.isEmailVerified()) {
                throw new ConflictException("EMAIL_ALREADY_REGISTERED", "An account with this email already exists");
            }
            user.setName(req.name().trim());
            user.setPasswordHash(passwordEncoder.encode(req.password()));
            user.setEmailVerified(true);
            user.setStatus(UserStatus.active);
            userRepository.save(user);
        } else {
            user = new User();
            user.setName(req.name().trim());
            user.setEmail(normalizedEmail);
            user.setPasswordHash(passwordEncoder.encode(req.password()));
            user.setRole(UserRole.student);
            user.setStatus(UserStatus.active);
            user.setEmailVerified(true);
            userRepository.save(user);
        }

        return issueNewSessionTokens(user);
    }

    @Transactional
    public OtpResponse sendPasswordResetOtp(String email) {
        String normalizedEmail = email.toLowerCase().trim();
        User user = userRepository.findByEmail(normalizedEmail).orElse(null);

        if (user == null) {
            // Uniform response to avoid leaking registered emails
            return new OtpResponse("If an account with that email exists, a verification code has been sent.", null);
        }

        List<EmailOtp> existing = emailOtpRepository.findByEmailIgnoreCaseAndPurposeAndUsedAtIsNull(normalizedEmail, "PASSWORD_RESET");
        for (EmailOtp o : existing) {
            o.setUsedAt(Instant.now());
        }
        emailOtpRepository.saveAll(existing);

        String otp = String.format("%06d", RNG.nextInt(1000000));
        EmailOtp otpEntity = new EmailOtp();
        otpEntity.setEmail(normalizedEmail);
        otpEntity.setOtpCode(otp);
        otpEntity.setPurpose("PASSWORD_RESET");
        otpEntity.setExpiresAt(Instant.now().plusSeconds(600)); // 10 minutes
        emailOtpRepository.save(otpEntity);

        emailService.sendOtpEmail(normalizedEmail, user.getName(), otp, "PASSWORD_RESET");
        String devResetOtp = emailService.isMailConfigured() ? null : otp;
        return new OtpResponse("Password reset code sent to your email", devResetOtp);
    }

    @Transactional
    public void verifyPasswordResetOtp(VerifyResetPasswordOtpRequest req) {
        String normalizedEmail = req.email().toLowerCase().trim();

        EmailOtp otpRecord = emailOtpRepository.findTopByEmailIgnoreCaseAndPurposeAndUsedAtIsNullOrderByCreatedAtDesc(normalizedEmail, "PASSWORD_RESET")
                .orElseThrow(() -> new BadRequestException("INVALID_OTP", "Invalid or expired verification code"));

        if (otpRecord.getExpiresAt().isBefore(Instant.now())) {
            throw new BadRequestException("OTP_EXPIRED", "Verification code has expired. Please request a new code.");
        }

        if (!otpRecord.getOtpCode().equals(req.otp().trim())) {
            throw new BadRequestException("INVALID_OTP", "Invalid verification code. Please check and try again.");
        }

        User user = userRepository.findByEmail(normalizedEmail)
                .orElseThrow(() -> new BadRequestException("USER_NOT_FOUND", "No user found with this email"));

        user.setPasswordHash(passwordEncoder.encode(req.newPassword()));
        userRepository.save(user);

        otpRecord.setUsedAt(Instant.now());
        emailOtpRepository.save(otpRecord);

        // Revoke active sessions on password change
        refreshTokenRepository.deleteByUserId(user.getId());
    }

    @Transactional
    public OtpResponse sendLoginOtp(String email) {
        String normalizedEmail = email.toLowerCase().trim();
        User user = userRepository.findByEmail(normalizedEmail)
                .orElseThrow(() -> new UnauthorizedException("USER_NOT_FOUND", "No registered account found with this email address"));

        if (user.getStatus() == UserStatus.disabled) {
            throw new UnauthorizedException("ACCOUNT_DISABLED", "This account has been disabled. Please contact support.");
        }

        // Invalidate prior unused LOGIN OTPs
        List<EmailOtp> existing = emailOtpRepository.findByEmailIgnoreCaseAndPurposeAndUsedAtIsNull(normalizedEmail, "LOGIN");
        for (EmailOtp o : existing) {
            o.setUsedAt(Instant.now());
        }
        emailOtpRepository.saveAll(existing);

        // Generate cryptographically secure 6-digit OTP
        String otp = String.format("%06d", RNG.nextInt(1000000));
        EmailOtp otpEntity = new EmailOtp();
        otpEntity.setEmail(normalizedEmail);
        otpEntity.setOtpCode(otp);
        otpEntity.setPurpose("LOGIN");
        otpEntity.setExpiresAt(Instant.now().plusSeconds(600)); // 10 minutes
        emailOtpRepository.save(otpEntity);

        emailService.sendLoginOtpEmail(normalizedEmail, user.getName(), otp);
        String devLoginOtp = emailService.isMailConfigured() ? null : otp;
        return new OtpResponse("Login verification code sent to your email", devLoginOtp);
    }

    @Transactional
    public AuthResponse verifyLoginOtp(VerifyLoginOtpRequest req) {
        String normalizedEmail = req.email().toLowerCase().trim();

        EmailOtp otpRecord = emailOtpRepository.findTopByEmailIgnoreCaseAndPurposeAndUsedAtIsNullOrderByCreatedAtDesc(normalizedEmail, "LOGIN")
                .orElseThrow(() -> new BadRequestException("INVALID_OTP", "Invalid or expired verification code"));

        if (otpRecord.getExpiresAt().isBefore(Instant.now())) {
            throw new BadRequestException("OTP_EXPIRED", "Verification code has expired. Please request a new code.");
        }

        if (!otpRecord.getOtpCode().equals(req.otp().trim())) {
            throw new BadRequestException("INVALID_OTP", "Invalid verification code. Please check and try again.");
        }

        User user = userRepository.findByEmail(normalizedEmail)
                .orElseThrow(() -> new UnauthorizedException("USER_NOT_FOUND", "No account found with this email address"));

        if (user.getStatus() == UserStatus.disabled) {
            throw new UnauthorizedException("ACCOUNT_DISABLED", "This account has been disabled");
        }

        otpRecord.setUsedAt(Instant.now());
        emailOtpRepository.save(otpRecord);

        // Mark verified on successful OTP sign-in if not already
        if (!user.isEmailVerified()) {
            user.setEmailVerified(true);
            userRepository.save(user);
        }

        if (loginAlertEnabled) {
            try {
                emailService.sendLoginAlertEmail(user.getEmail(), user.getName(),
                        Instant.now().toString(), null, "Web Browser");
            } catch (Exception ignored) {}
        }

        return issueNewSessionTokens(user);
    }

    public void sendTestEmail(String email) {
        String target = (email != null && !email.isBlank()) ? email.trim() : "admin@onetutor.local";
        emailService.sendTestEmail(target);
    }

    private AuthResponse issueNewSessionTokens(User user) {
        // Enforce Single Active Device Login: invalidate all prior refresh tokens for this user
        refreshTokenRepository.deleteByUserId(user.getId());

        // Generate a new active session UUID
        String newSessionId = java.util.UUID.randomUUID().toString();
        user.setActiveSessionId(newSessionId);
        userRepository.save(user);

        return issueTokens(user);
    }

    private AuthResponse issueTokens(User user) {
        String accessToken = jwtService.generateAccessToken(user);

        RefreshToken refreshToken = new RefreshToken();
        refreshToken.setUser(user);
        refreshToken.setToken(randomToken());
        refreshToken.setExpiresAt(Instant.now().plusMillis(jwtService.getRefreshExpirationMs()));
        refreshTokenRepository.save(refreshToken);

        UserSummary summary = new UserSummary(
                user.getId(), user.getName(), user.getEmail(),
                user.getRole().name(), user.isEmailVerified(), user.getProfileImage(), user.getPermissions());

        return new AuthResponse(accessToken, refreshToken.getToken(),
                jwtService.getAccessExpirationSeconds(), summary);
    }

    private String randomToken() {
        byte[] bytes = new byte[32];
        RNG.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
