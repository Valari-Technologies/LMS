package com.onetutor.config;

import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;

import java.util.List;

@Configuration
@ConfigurationPropertiesScan
public class AppConfig {

    @Bean
    public org.springframework.web.cors.CorsConfigurationSource corsConfigurationSource(org.springframework.core.env.Environment env) {
        String allowedOrigins = env.getProperty("app.cors.allowed-origins", "http://localhost:5173,http://localhost:5174,http://localhost:3000,http://127.0.0.1:5173,http://127.0.0.1:5174,https://*.vercel.app");

        CorsConfiguration config = new CorsConfiguration();
        for (String origin : allowedOrigins.split(",")) {
            if (!origin.trim().isEmpty()) {
                config.addAllowedOriginPattern(origin.trim());
            }
        }
        // Also allow any port on localhost / 127.0.0.1 for local development, vercel, and GitHub Pages
        config.addAllowedOriginPattern("http://localhost:*");
        config.addAllowedOriginPattern("http://127.0.0.1:*");
        config.addAllowedOriginPattern("https://*.vercel.app");
        config.addAllowedOriginPattern("https://*.github.io");
        config.addAllowedOriginPattern("https://valari-technologies.github.io");
        config.addAllowedOriginPattern("https://valari-technologies.github.io/*");
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setExposedHeaders(List.of("Authorization", "Content-Disposition"));
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }

    @Bean
    public CorsFilter corsFilter(org.springframework.web.cors.CorsConfigurationSource corsConfigurationSource) {
        return new CorsFilter(corsConfigurationSource);
    }
}
