package com.onetutor.auth.service;

import com.onetutor.users.repository.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Optional;

/**
 * Reads the Bearer access token on every request and, if valid,
 * populates the SecurityContext. This is the single point where
 * "who is the caller" is decided — controllers/services never trust
 * client-supplied identity outside of this.
 */
@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final UserRepository userRepository;

    public JwtAuthenticationFilter(JwtService jwtService, UserRepository userRepository) {
        this.jwtService = jwtService;
        this.userRepository = userRepository;
    }

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                     @NonNull HttpServletResponse response,
                                     @NonNull FilterChain filterChain) throws ServletException, IOException {
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            filterChain.doFilter(request, response);
            return;
        }

        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            String token = header.substring(7);
            if (jwtService.isValid(token)) {
                String email = jwtService.extractEmail(token);
                String tokenSid = jwtService.extractSessionId(token);

                Optional<com.onetutor.users.entity.User> userOpt = userRepository.findByEmail(email);
                if (userOpt.isPresent() && userOpt.get().isEnabled()) {
                    var user = userOpt.get();

                    // Single Active Device Session check: auto-initialize activeSessionId if null
                    if (user.getActiveSessionId() == null || user.getActiveSessionId().isBlank()) {
                        user.setActiveSessionId(java.util.UUID.randomUUID().toString());
                        userRepository.save(user);
                    }

                    if (tokenSid == null || !user.getActiveSessionId().equals(tokenSid)) {
                        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                        response.setContentType("application/json");
                        response.setCharacterEncoding("UTF-8");
                        String json = """
                                {
                                  "success": false,
                                  "code": "SESSION_EXPIRED_ANOTHER_DEVICE",
                                  "message": "Your account was signed in on another device. You have been logged out from this device."
                                }
                                """;
                        response.getWriter().write(json);
                        return;
                    }

                    java.time.Instant now = java.time.Instant.now();
                    if (user.getLastActiveAt() == null || user.getLastActiveAt().isBefore(now.minusSeconds(60))) {
                        user.setLastActiveAt(now);
                        userRepository.save(user);
                    }
                    var authToken = new UsernamePasswordAuthenticationToken(
                            user, null, user.getAuthorities());
                    authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(authToken);
                }
            }
        }
        filterChain.doFilter(request, response);
    }
}
