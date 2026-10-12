package com.onetutor.config;

import com.onetutor.auth.service.JwtAuthenticationFilter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

/**
 * Stateless JWT security. This is the SINGLE source of truth for
 * authorization (SRS section 46) — the frontend route guards are a
 * UX convenience only, never a substitute for this.
 */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final UserDetailsService userDetailsService;

    public SecurityConfig(JwtAuthenticationFilter jwtAuthenticationFilter,
                           UserDetailsService userDetailsService) {
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
        this.userDetailsService = userDetailsService;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public DaoAuthenticationProvider authenticationProvider() {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider();
        provider.setUserDetailsService(userDetailsService);
        provider.setPasswordEncoder(passwordEncoder());
        return provider;
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http,
                                           org.springframework.web.cors.CorsConfigurationSource corsConfigurationSource) throws Exception {
        http
            .cors(cors -> cors.configurationSource(corsConfigurationSource))
            .csrf(csrf -> csrf.disable()) // stateless JWT API, no cookies used for auth
            .headers(headers -> headers.frameOptions(fo -> fo.disable()))
            .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .exceptionHandling(ex -> ex
                .authenticationEntryPoint((request, response, authException) -> {
                    response.setStatus(jakarta.servlet.http.HttpServletResponse.SC_UNAUTHORIZED);
                    response.setContentType(org.springframework.http.MediaType.APPLICATION_JSON_VALUE);
                    response.getWriter().write("{\"success\":false,\"error\":{\"code\":\"UNAUTHORIZED\",\"message\":\"Authentication required or session expired\"}}");
                })
                .accessDeniedHandler((request, response, accessDeniedException) -> {
                    response.setStatus(jakarta.servlet.http.HttpServletResponse.SC_FORBIDDEN);
                    response.setContentType(org.springframework.http.MediaType.APPLICATION_JSON_VALUE);
                    response.getWriter().write("{\"success\":false,\"error\":{\"code\":\"FORBIDDEN\",\"message\":\"Access denied\"}}");
                })
            )
            .authorizeHttpRequests(auth -> auth
                // Allow all CORS preflight OPTIONS requests unconditionally
                .requestMatchers(org.springframework.http.HttpMethod.OPTIONS, "/**").permitAll()
                // Internal error & forward dispatches must be permitted in Spring Security 6
                .dispatcherTypeMatchers(jakarta.servlet.DispatcherType.ERROR, jakarta.servlet.DispatcherType.FORWARD).permitAll()
                .requestMatchers("/error").permitAll()
                // Public endpoints
                .requestMatchers(
                        "/api/v1/auth/**",
                        "/api/v1/contact",
                        "/api/v1/contact/**",
                        "/api/v1/coupons/**",
                        "/api/v1/payments/razorpay/config",
                        "/api/v1/health",
                        "/api-docs/**",
                        "/swagger-ui/**",
                        "/swagger-ui.html",
                        "/actuator/health"
                ).permitAll()
                // Public catalog browsing & media file streaming
                .requestMatchers(org.springframework.http.HttpMethod.GET, "/api/v1/courses/**").permitAll()
                .requestMatchers(org.springframework.http.HttpMethod.GET, "/api/v1/categories/**").permitAll()
                .requestMatchers("/api/v1/media/files/**", "/api/v1/media/file", "/api/v1/media/file/**").permitAll()
                .requestMatchers(org.springframework.http.HttpMethod.GET, "/api/v1/banners/**").permitAll()
                // Student enrollment & progress & subtitles
                .requestMatchers(org.springframework.http.HttpMethod.POST, "/api/v1/courses/*/enroll").authenticated()
                .requestMatchers(org.springframework.http.HttpMethod.POST, "/api/v1/contents/*/session").authenticated()
                .requestMatchers(org.springframework.http.HttpMethod.PUT, "/api/v1/contents/*/progress").authenticated()
                .requestMatchers(org.springframework.http.HttpMethod.POST, "/api/v1/contents/*/complete").authenticated()
                .requestMatchers(org.springframework.http.HttpMethod.POST, "/api/v1/contents/*/auto-subtitles").permitAll()
                .requestMatchers(org.springframework.http.HttpMethod.GET, "/api/v1/contents/**").permitAll()
                // Student video notes (authenticated users can manage their own notes)
                .requestMatchers("/api/v1/contents/*/notes", "/api/v1/contents/*/notes/**").authenticated()
                .requestMatchers("/api/v1/courses/*/notes", "/api/v1/courses/*/notes/**").authenticated()
                .requestMatchers("/api/v1/notes", "/api/v1/notes/**").authenticated()
                // Student course ratings & reviews
                .requestMatchers("/api/v1/courses/*/reviews", "/api/v1/courses/*/reviews/**").authenticated()
                // Admin-only namespace & administrative mutations
                .requestMatchers(org.springframework.http.HttpMethod.POST, "/api/v1/courses/*/publish").hasAnyRole("ADMIN", "SUPER_ADMIN")
                .requestMatchers(org.springframework.http.HttpMethod.POST, "/api/v1/courses/*/unpublish").hasAnyRole("ADMIN", "SUPER_ADMIN")
                .requestMatchers("/api/v1/admin/**").hasAnyRole("ADMIN", "SUPER_ADMIN", "CONTENT_CREATOR", "READONLY_ADMIN")
                .requestMatchers(org.springframework.http.HttpMethod.POST, "/api/v1/courses/**").hasAnyRole("ADMIN", "SUPER_ADMIN", "CONTENT_CREATOR")
                .requestMatchers(org.springframework.http.HttpMethod.PUT, "/api/v1/courses/**").hasAnyRole("ADMIN", "SUPER_ADMIN", "CONTENT_CREATOR")
                .requestMatchers(org.springframework.http.HttpMethod.DELETE, "/api/v1/courses/**").hasAnyRole("ADMIN", "SUPER_ADMIN", "CONTENT_CREATOR")
                .requestMatchers(org.springframework.http.HttpMethod.POST, "/api/v1/sections/**").hasAnyRole("ADMIN", "SUPER_ADMIN", "CONTENT_CREATOR")
                .requestMatchers(org.springframework.http.HttpMethod.PUT, "/api/v1/sections/**").hasAnyRole("ADMIN", "SUPER_ADMIN", "CONTENT_CREATOR")
                .requestMatchers(org.springframework.http.HttpMethod.DELETE, "/api/v1/sections/**").hasAnyRole("ADMIN", "SUPER_ADMIN", "CONTENT_CREATOR")
                .requestMatchers(org.springframework.http.HttpMethod.POST, "/api/v1/contents/**").hasAnyRole("ADMIN", "SUPER_ADMIN", "CONTENT_CREATOR")
                .requestMatchers(org.springframework.http.HttpMethod.PUT, "/api/v1/contents/**").hasAnyRole("ADMIN", "SUPER_ADMIN", "CONTENT_CREATOR")
                .requestMatchers(org.springframework.http.HttpMethod.DELETE, "/api/v1/contents/**").hasAnyRole("ADMIN", "SUPER_ADMIN", "CONTENT_CREATOR")
                .requestMatchers(org.springframework.http.HttpMethod.POST, "/api/v1/categories/**").hasAnyRole("ADMIN", "SUPER_ADMIN", "CONTENT_CREATOR")
                .requestMatchers(org.springframework.http.HttpMethod.PUT, "/api/v1/categories/**").hasAnyRole("ADMIN", "SUPER_ADMIN", "CONTENT_CREATOR")
                .requestMatchers(org.springframework.http.HttpMethod.DELETE, "/api/v1/categories/**").hasAnyRole("ADMIN", "SUPER_ADMIN", "CONTENT_CREATOR")
                // General authenticated endpoints
                .requestMatchers("/api/v1/live-sessions/**").authenticated()
                .requestMatchers("/api/v1/notifications/**").authenticated()
                .requestMatchers("/api/v1/users/**").authenticated()
                // Community chat (enrollment check enforced in service)
                .requestMatchers("/api/v1/community", "/api/v1/community/**").authenticated()
                // Student media upload for community attachments
                .requestMatchers(org.springframework.http.HttpMethod.POST, "/api/v1/media/upload").authenticated()
                // Everything else requires authentication
                .anyRequest().authenticated()
            )
            .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}
