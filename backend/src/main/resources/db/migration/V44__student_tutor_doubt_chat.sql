-- ============================================================
-- Flyway Migration V44: Student-Tutor Direct Doubt Chat
-- Dedicated 1-on-1 private doubt clearing between enrolled students and course instructors/tutors
-- ============================================================

CREATE TABLE IF NOT EXISTS tutor_doubt_messages (
    id               BIGSERIAL PRIMARY KEY,
    course_id        BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    student_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sender_id        BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content          TEXT,
    message_type     VARCHAR(20) NOT NULL DEFAULT 'text'
                         CHECK (message_type IN ('text','image','pdf','video','file')),
    media_asset_id   BIGINT REFERENCES media_assets(id) ON DELETE SET NULL,
    deleted          BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_by_admin BOOLEAN NOT NULL DEFAULT FALSE,
    edited           BOOLEAN NOT NULL DEFAULT FALSE,
    created_at       TIMESTAMP NOT NULL DEFAULT now(),
    updated_at       TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tutor_doubt_course_student ON tutor_doubt_messages(course_id, student_id);
CREATE INDEX IF NOT EXISTS idx_tutor_doubt_student ON tutor_doubt_messages(student_id);
CREATE INDEX IF NOT EXISTS idx_tutor_doubt_course ON tutor_doubt_messages(course_id);
CREATE INDEX IF NOT EXISTS idx_tutor_doubt_created_at ON tutor_doubt_messages(created_at);

CREATE TABLE IF NOT EXISTS tutor_doubt_read_status (
    id                   BIGSERIAL PRIMARY KEY,
    user_id              BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id            BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    student_id           BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_read_message_id BIGINT NOT NULL DEFAULT 0,
    last_read_at         TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT uq_tutor_doubt_read UNIQUE (user_id, course_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_tutor_doubt_read_user_course ON tutor_doubt_read_status(user_id, course_id, student_id);
