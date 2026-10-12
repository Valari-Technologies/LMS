-- ============================================================
-- Flyway Migration V10: Student Video Notes Persistence
-- ============================================================

CREATE TABLE IF NOT EXISTS video_notes (
    id                      BIGSERIAL PRIMARY KEY,
    user_id                 BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content_id              BIGINT NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
    course_id               BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    text                    TEXT NOT NULL,
    video_timestamp_seconds DOUBLE PRECISION,
    video_timestamp         VARCHAR(20),
    created_at              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_video_notes_user_content ON video_notes(user_id, content_id);
CREATE INDEX IF NOT EXISTS idx_video_notes_user_course ON video_notes(user_id, course_id);
