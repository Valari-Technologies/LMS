package com.onetutor.config;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

import javax.sql.DataSource;
import java.net.URI;

/**
 * Robust DataSource configuration supporting:
 * 1. Standard Spring Boot JDBC URLs (jdbc:postgresql://...)
 * 2. Neon / Render / Heroku direct connection URIs (postgres://... or postgresql://...)
 * 3. Automatic SSL enforcement for Neon cloud PostgreSQL
 */
@Configuration
public class DataSourceConfig {

    private static final Logger log = LoggerFactory.getLogger(DataSourceConfig.class);

    @Value("${spring.datasource.url}")
    private String dbUrl;

    @Value("${spring.datasource.username:}")
    private String dbUsername;

    @Value("${spring.datasource.password:}")
    private String dbPassword;

    @Bean
    @Primary
    public DataSource dataSource() {
        HikariConfig config = new HikariConfig();

        String resolvedUrl = dbUrl;
        String resolvedUser = dbUsername;
        String resolvedPass = dbPassword;

        try {
            if (resolvedUrl != null && (resolvedUrl.startsWith("postgres://") || resolvedUrl.startsWith("postgresql://"))) {
                log.info("Detected postgresql:// or postgres:// URI format in DATABASE_URL. Normalizing for JDBC / Neon...");
                URI uri = new URI(resolvedUrl.replace("postgres://", "http://").replace("postgresql://", "http://"));

                String userInfo = uri.getUserInfo();
                if (userInfo != null) {
                    String[] userParts = userInfo.split(":", 2);
                    if (resolvedUser == null || resolvedUser.isBlank()) {
                        resolvedUser = userParts[0];
                    }
                    if ((resolvedPass == null || resolvedPass.isBlank()) && userParts.length > 1) {
                        resolvedPass = userParts[1];
                    }
                }

                int port = uri.getPort() == -1 ? 5432 : uri.getPort();
                String path = uri.getPath() != null ? uri.getPath() : "/onetutor";
                String query = uri.getQuery();

                resolvedUrl = "jdbc:postgresql://" + uri.getHost() + ":" + port + path + (query != null ? "?" + query : "");
            }
        } catch (Exception e) {
            log.warn("Could not parse DATABASE_URL as URI, using raw URL: {}", e.getMessage());
        }

        // Ensure sslmode=require for Neon cloud PostgreSQL if not already present
        if (resolvedUrl != null && resolvedUrl.contains("neon.tech") && !resolvedUrl.contains("sslmode=")) {
            resolvedUrl += (resolvedUrl.contains("?") ? "&" : "?") + "sslmode=require";
        }

        config.setJdbcUrl(resolvedUrl);
        if (resolvedUser != null && !resolvedUser.isBlank()) {
            config.setUsername(resolvedUser);
        }
        if (resolvedPass != null && !resolvedPass.isBlank()) {
            config.setPassword(resolvedPass);
        }

        config.setDriverClassName("org.postgresql.Driver");
        config.setMaximumPoolSize(10);
        config.setMinimumIdle(2);
        config.setIdleTimeout(300000);
        config.setMaxLifetime(600000);
        config.setConnectionTimeout(20000);

        log.info("Configured Hikari DataSource for JDBC URL: {}", 
                resolvedUrl != null ? resolvedUrl.replaceAll(":[^/@]+@", ":****@") : "none");

        return new HikariDataSource(config);
    }
}
