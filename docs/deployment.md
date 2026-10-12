# Deployment

## Environments

Configuration is entirely environment-variable driven (`application.yml`
uses `${VAR:default}` everywhere) so the same JAR/build runs in dev,
staging, and production with no code changes — only different env values.
`DataSeeder` (which creates the dev admin) is restricted to `dev`/`default`/
`test` Spring profiles and will not run in a `prod` profile; set
`SPRING_PROFILES_ACTIVE=prod` in production and create the first admin
through a deliberate, audited process instead (once `/admin/admins` exists).

## Backend

Build: `mvn clean package` → runnable JAR in `backend/target/`.
Run: `java -jar onetutor-backend-0.1.0.jar` with the env vars from
`.env.example` set in the environment (not baked into the image/JAR).

Requires a reachable PostgreSQL instance; Flyway migrations run
automatically on startup — no manual migration step in any environment.

## Frontend

Build: `npm run build` → static assets in `frontend/dist/`. Serve behind any
static host or reverse proxy (Nginx, Caddy, a CDN). Set `VITE_API_BASE_URL`
at build time to point at the deployed backend's public URL.

## HTTPS

The application does not terminate TLS itself. Put it behind a reverse
proxy or load balancer (Nginx, Caddy, ALB, etc.) that terminates HTTPS and
forwards plain HTTP internally, and set `app.cors.allowed-origins` /
`APP_BASE_URL` to the HTTPS frontend origin.

## Storage

MVP uses local disk (`STORAGE_PATH`) — this only works for a single backend
instance with persistent local storage (not suitable for autoscaling/
ephemeral containers as-is). Before scaling horizontally, implement an
`ObjectStorageService` (S3-compatible) and switch the `@Primary`
`StorageService` bean — no other code changes needed, by design (see
`docs/TRD.md` section 8).

## Database

Use managed PostgreSQL with automated backups in production. Nothing in the
schema is Postgres-version-specific beyond standard SQL + partial unique
indexes (Postgres ≥ 9.2, so any current managed offering is fine).

## Monitoring

Not yet configured. Spring Boot Actuator's `/actuator/health` is exposed and
permitted through security config as a starting point for uptime checks;
wiring it to a real monitoring stack (Prometheus/Grafana, or a hosted APM)
is a deployment-phase task, not a code task.
