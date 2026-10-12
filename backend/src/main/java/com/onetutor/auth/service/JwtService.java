package com.onetutor.auth.service;

import com.onetutor.config.JwtProperties;
import com.onetutor.users.entity.User;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

/**
 * Issues and validates short-lived JWT access tokens. Refresh tokens
 * are opaque random strings persisted server-side (see RefreshToken
 * entity) so they can be revoked on logout — a JWT-only refresh
 * token cannot be revoked before its natural expiry.
 */
@Service
public class JwtService {

    private final JwtProperties props;
    private final SecretKey key;

    public JwtService(JwtProperties props) {
        this.props = props;
        this.key = Keys.hmacShaKeyFor(props.getSecret().getBytes(StandardCharsets.UTF_8));
    }

    public String generateAccessToken(User user) {
        Date now = new Date();
        Date expiry = new Date(now.getTime() + props.getAccessExpirationMs());

        String sid = user.getActiveSessionId();
        if (sid == null || sid.isBlank()) {
            sid = java.util.UUID.randomUUID().toString();
            user.setActiveSessionId(sid);
        }

        return Jwts.builder()
                .subject(user.getEmail())
                .claim("uid", user.getId())
                .claim("role", user.getRole().name())
                .claim("sid", sid)
                .issuedAt(now)
                .expiration(expiry)
                .signWith(key)
                .compact();
    }

    public long getAccessExpirationSeconds() {
        return props.getAccessExpirationMs() / 1000;
    }

    public long getRefreshExpirationMs() {
        return props.getRefreshExpirationMs();
    }

    public Claims parseClaims(String token) {
        return Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public String extractEmail(String token) {
        return parseClaims(token).getSubject();
    }

    public String extractSessionId(String token) {
        try {
            Claims claims = parseClaims(token);
            return claims.get("sid", String.class);
        } catch (Exception e) {
            return null;
        }
    }

    public boolean isValid(String token) {
        try {
            Claims claims = parseClaims(token);
            return claims.getExpiration().after(new Date());
        } catch (Exception e) {
            return false;
        }
    }
}
