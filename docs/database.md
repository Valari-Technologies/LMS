# Database Documentation

PostgreSQL. Schema owned by Flyway migrations in
`backend/src/main/resources/db/migration/`. This document reflects
`V1__initial_schema.sql` exactly — if a later migration changes anything,
update this file in the same commit.

## Differences from the supplied ERD

None in table/relationship structure. Three tables were **added** beyond the
ERD's explicit list because the SRS requires functionality the ERD didn't
give a table for; each is documented in `docs/TRD.md` section 7:

- `email_verification_tokens`, `password_reset_tokens`, `refresh_tokens` —
  required by SRS section 5 (verification, reset, refresh-token auth) but
  not drawn in the ERD. Necessary to implement auth at all.
- `media_assets` — reconciles the SRS's conceptual "MediaAsset" with the
  ERD; see TRD section 7.

No ERD table or relationship was removed or restructured.

## Tables

### users
Purpose: all accounts (students and admins).

| Column | Type | Null | Notes |
|---|---|---|---|
| id | BIGSERIAL | PK | |
| name | VARCHAR(100) | NOT NULL | |
| email | VARCHAR(100) | NOT NULL | UNIQUE, indexed |
| password_hash | VARCHAR(255) | NOT NULL | BCrypt |
| role | VARCHAR(20) | NOT NULL | CHECK IN ('student','admin') |
| status | VARCHAR(20) | NOT NULL | CHECK IN ('active','disabled'), default 'active' |
| profile_image | VARCHAR(255) | NULL | |
| email_verified | BOOLEAN | NOT NULL | default FALSE |
| created_at / updated_at | TIMESTAMP | NOT NULL | UTC |

Relationships: 1:N → enrollments, notifications, audit_logs, progress.

### categories
id, name, description, status (`active`/`archived`), timestamps.
Relationship: 1:N → courses.

### courses
id, name, short_desc, description, thumbnail, category_id (FK → categories),
level, duration, language, prerequisites, learning_outcomes, status
(`draft`/`published`/`archived`), version (INTEGER, default 1), created_by
(FK → users), timestamps. Indexed on category_id, status.

### sections
id, course_id (FK → courses, CASCADE), title, description, display_order,
status, timestamps. Indexed on course_id.

### contents
id, section_id (FK → sections, CASCADE), title, description, content_type
(CHECK IN VIDEO/PDF/IMAGE/DOWNLOAD/EXTERNAL_LINK), display_order,
completion_rule, **media_reference** *(added in V3 — see below)*, status,
timestamps. Indexed on section_id.

**V3 migration note**: the supplied ERD's `contents` table had no column
for what to actually render. `media_reference` (nullable VARCHAR) holds a
StorageService path for VIDEO/PDF/IMAGE/DOWNLOAD, or the raw URL for
EXTERNAL_LINK. Documented per SRS section 82 rather than silently added —
see the migration file's header comment and `docs/TRD.md` section 7.

### resources
id, content_id (FK → contents, CASCADE), type, name, url, display_order,
created_at. Indexed on content_id.

### media_assets *(added — see above)*
id, filename, mime_type, file_size, storage_path, uploaded_by (FK → users),
created_at.

### enrollments
id, student_id (FK → users), course_id (FK → courses), status
(`active`/`removed`), enrolled_at, removed_at. Indexed on student_id,
course_id. **Partial unique index** `(student_id, course_id) WHERE status =
'active'` prevents duplicate active enrollment while still allowing
historical `removed` rows to coexist (SRS sections 15, 77).

### progress
id, student_id (FK → users), content_id (FK → contents), progress_percent
(NUMERIC 5,2), video_position (INTEGER, seconds), completed (BOOLEAN),
completed_at, last_accessed_at. UNIQUE(student_id, content_id). Indexed on
student_id and content_id separately for the "my progress across all
courses" and "who has completed this content" query directions.

### live_sessions
id, course_id (FK → courses), section_id (FK → sections, nullable —
optional section association per SRS 34), title, description, scheduled_at,
end_time, meeting_url, status (`upcoming`/`live`/`completed`/`cancelled`),
timestamps.

### session_recordings
id, session_id (FK → live_sessions, CASCADE), url, duration, created_at.

### notifications
id, user_id (FK → users), title, message, type (CHECK IN
ENROLLMENT/COURSE/LIVE_CLASS/SYSTEM), read (BOOLEAN), created_at. Indexed on
user_id.

### audit_logs
id, user_id (FK → users, nullable — system-initiated actions have no user),
action, entity_type, entity_id, details (TEXT), created_at. Indexed on
user_id, entity_type, entity_id. No update/delete path exposed by the API.

### email_verification_tokens / password_reset_tokens *(added)*
id, user_id (FK → users, CASCADE), token (UNIQUE), expires_at, used_at
(NULL until consumed — enforces single-use), created_at.

### refresh_tokens *(added)*
id, user_id (FK → users, CASCADE), token (UNIQUE), expires_at, revoked
(BOOLEAN), created_at.

## Indexes (matches SRS section 47 exactly)

users.email · courses.category_id · courses.status · enrollments.student_id
· enrollments.course_id · progress.student_id · progress.content_id ·
sections.course_id · contents.section_id · notifications.user_id ·
audit_logs.user_id · audit_logs.entity_type · audit_logs.entity_id
