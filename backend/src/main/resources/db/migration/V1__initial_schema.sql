-- ============================================================
-- ONE TUTOR LMS — Initial Schema
-- ============================================================

CREATE TABLE users (
    id              BIGSERIAL PRIMARY KEY,
    name            VARCHAR(100) NOT NULL,
    email           VARCHAR(100) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    role            VARCHAR(20)  NOT NULL CHECK (role IN ('student','admin')),
    status          VARCHAR(20)  NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
    profile_image   VARCHAR(255),
    email_verified  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMP NOT NULL DEFAULT now(),
    updated_at      TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX idx_users_email ON users(email);

CREATE TABLE email_verification_tokens (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token       VARCHAR(255) NOT NULL UNIQUE,
    expires_at  TIMESTAMP NOT NULL,
    used_at     TIMESTAMP,
    created_at  TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX idx_evt_user ON email_verification_tokens(user_id);

CREATE TABLE password_reset_tokens (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token       VARCHAR(255) NOT NULL UNIQUE,
    expires_at  TIMESTAMP NOT NULL,
    used_at     TIMESTAMP,
    created_at  TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX idx_prt_user ON password_reset_tokens(user_id);

CREATE TABLE refresh_tokens (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token       VARCHAR(500) NOT NULL UNIQUE,
    expires_at  TIMESTAMP NOT NULL,
    revoked     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX idx_rt_user ON refresh_tokens(user_id);

CREATE TABLE categories (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    description TEXT,
    status      VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
    created_at  TIMESTAMP NOT NULL DEFAULT now(),
    updated_at  TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE courses (
    id                  BIGSERIAL PRIMARY KEY,
    name                VARCHAR(200) NOT NULL,
    short_desc          VARCHAR(500),
    description         TEXT,
    thumbnail           VARCHAR(255),
    category_id         BIGINT REFERENCES categories(id),
    level               VARCHAR(50),
    duration            VARCHAR(50),
    language             VARCHAR(50),
    prerequisites       TEXT,
    learning_outcomes   TEXT,
    status              VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
    version             INTEGER NOT NULL DEFAULT 1,
    created_by          BIGINT REFERENCES users(id),
    created_at          TIMESTAMP NOT NULL DEFAULT now(),
    updated_at          TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX idx_courses_category ON courses(category_id);
CREATE INDEX idx_courses_status ON courses(status);

CREATE TABLE sections (
    id            BIGSERIAL PRIMARY KEY,
    course_id     BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    title         VARCHAR(200) NOT NULL,
    description   TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    status        VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
    created_at    TIMESTAMP NOT NULL DEFAULT now(),
    updated_at    TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX idx_sections_course ON sections(course_id);

CREATE TABLE contents (
    id               BIGSERIAL PRIMARY KEY,
    section_id       BIGINT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
    title            VARCHAR(200) NOT NULL,
    description      TEXT,
    content_type     VARCHAR(30) NOT NULL CHECK (content_type IN ('VIDEO','PDF','IMAGE','DOWNLOAD','EXTERNAL_LINK')),
    display_order    INTEGER NOT NULL DEFAULT 0,
    completion_rule  VARCHAR(50) NOT NULL DEFAULT 'DEFAULT',
    status           VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
    created_at       TIMESTAMP NOT NULL DEFAULT now(),
    updated_at       TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX idx_contents_section ON contents(section_id);

CREATE TABLE resources (
    id            BIGSERIAL PRIMARY KEY,
    content_id    BIGINT NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
    type          VARCHAR(30) NOT NULL,
    name          VARCHAR(200) NOT NULL,
    url           VARCHAR(500) NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at    TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX idx_resources_content ON resources(content_id);

CREATE TABLE media_assets (
    id          BIGSERIAL PRIMARY KEY,
    filename    VARCHAR(255) NOT NULL,
    mime_type   VARCHAR(100) NOT NULL,
    file_size   BIGINT NOT NULL,
    storage_path VARCHAR(500) NOT NULL,
    uploaded_by BIGINT REFERENCES users(id),
    created_at  TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE enrollments (
    id           BIGSERIAL PRIMARY KEY,
    student_id   BIGINT NOT NULL REFERENCES users(id),
    course_id    BIGINT NOT NULL REFERENCES courses(id),
    status       VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','removed')),
    enrolled_at  TIMESTAMP NOT NULL DEFAULT now(),
    removed_at   TIMESTAMP
);
CREATE INDEX idx_enrollments_student ON enrollments(student_id);
CREATE INDEX idx_enrollments_course ON enrollments(course_id);
-- Prevent duplicate ACTIVE enrollment for same student/course (partial unique index)
CREATE UNIQUE INDEX uq_enrollment_active ON enrollments(student_id, course_id) WHERE status = 'active';

CREATE TABLE progress (
    id                BIGSERIAL PRIMARY KEY,
    student_id        BIGINT NOT NULL REFERENCES users(id),
    content_id        BIGINT NOT NULL REFERENCES contents(id),
    progress_percent  NUMERIC(5,2) NOT NULL DEFAULT 0,
    video_position     INTEGER NOT NULL DEFAULT 0,
    completed         BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at      TIMESTAMP,
    last_accessed_at  TIMESTAMP NOT NULL DEFAULT now(),
    UNIQUE(student_id, content_id)
);
CREATE INDEX idx_progress_student ON progress(student_id);
CREATE INDEX idx_progress_content ON progress(content_id);

CREATE TABLE live_sessions (
    id            BIGSERIAL PRIMARY KEY,
    course_id     BIGINT NOT NULL REFERENCES courses(id),
    section_id    BIGINT REFERENCES sections(id),
    title         VARCHAR(200) NOT NULL,
    description   TEXT,
    scheduled_at  TIMESTAMP NOT NULL,
    end_time      TIMESTAMP,
    meeting_url   VARCHAR(500),
    status        VARCHAR(20) NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming','live','completed','cancelled')),
    created_at    TIMESTAMP NOT NULL DEFAULT now(),
    updated_at    TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX idx_live_sessions_course ON live_sessions(course_id);

CREATE TABLE session_recordings (
    id          BIGSERIAL PRIMARY KEY,
    session_id  BIGINT NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
    url         VARCHAR(500) NOT NULL,
    duration    INTEGER,
    created_at  TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE notifications (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(id),
    title       VARCHAR(200) NOT NULL,
    message     TEXT NOT NULL,
    type        VARCHAR(30) NOT NULL CHECK (type IN ('ENROLLMENT','COURSE','LIVE_CLASS','SYSTEM')),
    read        BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user ON notifications(user_id);

CREATE TABLE audit_logs (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT REFERENCES users(id),
    action      VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id   BIGINT,
    details     TEXT,
    created_at  TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_entity_type ON audit_logs(entity_type);
CREATE INDEX idx_audit_entity_id ON audit_logs(entity_id);
