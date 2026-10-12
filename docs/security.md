# Security

## Implemented

- **Password hashing**: BCrypt via Spring Security's `BCryptPasswordEncoder`.
  Plaintext passwords are never persisted or logged.
- **JWT access tokens**: HMAC-signed, 15-minute default expiry
  (`app.jwt.access-expiration-ms`), carry `sub` (email), `uid`, `role`.
- **Refresh tokens**: opaque, random (32-byte, base64url), persisted
  server-side, rotated on every use, individually revocable (logout,
  password reset). Not JWTs — see `docs/TRD.md` section 5 for rationale.
- **RBAC**: enforced in `SecurityConfig` at the URL level and (as further
  modules are built) at the method level via ownership checks in services.
  Verified: a student token against `/api/v1/admin/**` returns 403.
- **CORS**: locked to `app.cors.allowed-origins` (defaults to the frontend
  dev origin only).
- **CSRF**: disabled — safe here because the API is fully stateless (no
  cookie-based session auth; the Bearer token is the only credential and
  is not automatically sent by the browser cross-site).
- **File upload validation** (`LocalStorageService`): MIME allowlist, size
  cap, filename sanitization, path-traversal guard on both upload and
  read/delete.
- **No secrets in source**: all credentials/secrets come from environment
  variables (`.env.example` documents every variable; `.env` is gitignored).
- **No stack traces / SQL errors in responses**: `GlobalExceptionHandler`
  returns a fixed `INTERNAL_ERROR` message for unhandled exceptions; full
  detail goes to the server log only.
- **Password reset security**: tokens are time-limited (1 hour), single-use
  (`used_at` checked), and resetting a password revokes all existing
  refresh tokens for that user.

## Not yet implemented / planned

- Method-level `@PreAuthorize` ownership checks for progress, enrollment,
  and student-detail endpoints (land alongside those modules).
- Rate limiting on `/auth/login` and `/auth/forgot-password` (recommended
  before production — e.g. bucket4j or a reverse-proxy rule).
- HTTPS termination (expected to be handled by the deployment's reverse
  proxy/load balancer — see `docs/deployment.md`; the app itself is
  HTTPS-ready but doesn't terminate TLS itself in dev).
- Signed/expiring media URLs (currently MVP-level authenticated access
  only, per SRS section 62 — explicitly deferred, not an oversight).

## Threat notes

- JWT secret (`JWT_SECRET`) must be a strong random value (≥32 bytes) in any
  non-dev environment — the `.env.example` placeholder is not safe to use
  as-is.
- Refresh token rotation means a leaked, already-used refresh token is
  useless to an attacker; but a leaked *unused* refresh token is a real risk
  window — logout/password-reset immediately revoke it, but there's no
  device-list/"log out other sessions" UI yet.
