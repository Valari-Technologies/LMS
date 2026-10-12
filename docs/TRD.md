# One Tutor — Technical Design Document (TRD)

## 1. System architecture

Modular monolith. One Spring Boot process, one PostgreSQL database, packages
organized by business domain (`auth`, `users`, `courses`, `enrollment`, etc.)
rather than by technical layer at the top level — each domain package then
internally separates controller/service/repository/entity/dto.

Rationale: the SRS explicitly asks for a modular monolith over microservices
for an MVP with a single organization and two roles. Splitting into services
now would add operational cost (service discovery, distributed transactions
for enrollment/progress consistency) with no corresponding benefit at this
scale. Module boundaries are kept clean specifically so that a future split
(e.g. extracting `media`/`live` behind their own service) is a refactor, not
a rewrite.

## 2. Backend architecture

- Controllers are thin: validate input (Bean Validation), delegate to a
  service, map the result to `ApiResponse<T>`.
- Services hold all business rules and are `@Transactional` where an
  operation must be atomic (enrollment creation, password reset + session
  revocation, etc.).
- Repositories are plain Spring Data JPA interfaces.
- Cross-cutting concerns (exceptions, API envelope) live in `common`.
- Integration boundaries (`StorageService`, `EmailService`,
  `LiveMeetingProvider`) are interfaces implemented by a concrete class
  chosen at the composition root (Spring bean wiring), so business logic
  never imports `java.nio.file` or a mail SDK directly.

## 3. Frontend architecture

Vite + React, route-based code organization (`pages/auth`, `pages/student`,
`pages/admin`). A single Axios instance (`api/client.js`) centralizes token
attachment and refresh-on-401 logic so every API call gets this behavior for
free. `AuthContext` is the single source of truth for "who is logged in" on
the client; it is always re-validated against `GET /users/me`, never trusted
from stale localStorage alone.

## 4. Database architecture

PostgreSQL, schema owned by Flyway (`V__*.sql` migrations) — `ddl-auto:
validate` in `application.yml` means Hibernate will refuse to start if the
entity mappings and the actual schema disagree, catching drift immediately
rather than silently auto-migrating production data.

## 5. Authentication

JWT access tokens (short-lived, 15 min default) signed with HMAC-SHA, stored
client-side in `localStorage`. Refresh tokens are **opaque random strings
persisted server-side** in `refresh_tokens`, not JWTs — this is a deliberate
deviation from "just use a long-lived JWT for refresh" because opaque,
DB-backed tokens can be individually revoked (logout, password reset) before
their natural expiry; a self-contained JWT cannot be un-issued without an
additional revocation-list mechanism anyway, so we skip straight to the
simpler, more auditable design. Refresh tokens rotate on every use.

## 6. Authorization

Enforced in two independent layers, with the backend as the only one that
matters for security:
1. `SecurityConfig` URL-pattern rules (coarse: `/api/v1/admin/**` requires
   `ROLE_ADMIN`).
2. Method-level `@PreAuthorize` / explicit ownership checks in services for
   fine-grained rules the URL pattern can't express (e.g. "a student may only
   read their own progress row") — to be added as those modules are built.

Frontend route guards (`routes/guards.jsx`) exist purely for UX; removing
them would degrade the experience but not create a security hole, because
every protected backend endpoint independently re-checks the caller's role
and ownership.

## 7. Course model / Content model / Enrollment model / Progress algorithm /
   Video progress strategy

**Not yet implemented in code.** Design decisions and reconciliation of the
SRS's conceptual entities (CourseVersion, MediaAsset, ContentProgress,
CourseProgress) against the supplied ERD's physical tables (`courses` with a
`version` int column, `contents`, `progress`) are recorded here in advance so
implementation is consistent when those phases start:

- **CourseVersion**: the ERD does not have a separate table; `courses.version`
  is an integer bumped on significant modification to a published course.
  Decision: keep it as an integer for MVP (matches ERD), NOT a separate
  table — a full version-history table is a valid future extension but is
  out of scope until a concrete requirement (e.g. "show me course v2 vs v3
  diff") demands it. This must be reconfirmed before the Courses phase
  begins.
- **MediaAsset**: implemented as `media_assets`, matching the ERD's
  intent for centralized, reusable media (SRS section 59). `resources.url`
  and `contents` reference storage paths returned by `MediaAsset`/`StorageService`.
- **ContentProgress / CourseProgress**: the ERD's `progress` table is
  per-(student, content). Course-level and section-level progress are
  **derived at read time** (completed contents / total contents in that
  course or section), never stored as a separate denormalized table, per
  SRS section 19–20's explicit instruction not to conflate video-time-watched
  with completion state.

## 8. Media storage

`StorageService` interface, `LocalStorageService` implementation (validates
MIME type, size, sanitizes filename, path-traversal-safe). Swapping to
S3/object storage later means adding an `ObjectStorageService` bean and
changing which one is `@Primary` — no caller changes.

## 9. Notification architecture

Not yet implemented. Planned: `NotificationService.notify(userId, type,
title, message)` called by other services on business events (new
enrollment, course published, live class starting), persists to
`notifications`, decoupled from any future email delivery.

## 10. Audit architecture

Not yet implemented. Planned: an `AuditService.log(actor, action,
entityType, entityId, details)` called explicitly from admin-mutating
service methods (not a generic AOP interceptor, to keep audit entries
meaningful rather than mechanical). `audit_logs` has no update/delete
endpoint by design — read-only via `GET /api/v1/admin/audit-logs`.

## 11. Error handling

`@RestControllerAdvice` (`GlobalExceptionHandler`) maps all handled exception
types to the standard `ApiError` envelope; unhandled exceptions are logged
server-side with full detail and returned to the client as a generic
`INTERNAL_ERROR` with no stack trace.

## 12. Security

See `docs/security.md`.

## 13. Deployment

See `docs/deployment.md`.

## 14. Future extension points

Confirmed non-goals for MVP per SRS section 61/81, with the seams already in
place: `enrollment` is not coupled to any payment concept (a future `Order`/
`Payment` flow would insert before enrollment creation, not inside it);
`live` is provider-agnostic via `LiveMeetingProvider`; `contents.content_type`
is a string enum specifically so new types (e.g. `QUIZ`) can be added without
a schema migration touching unrelated tables.
