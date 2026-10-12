-- ============================================================
-- Flyway Migration V8: Community Message Edits and Read Receipts
-- ============================================================

-- 1. Add edited flag to community_messages
ALTER TABLE community_messages
    ADD COLUMN IF NOT EXISTS edited BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Create community_read_status table for tracking user read positions per course
CREATE TABLE IF NOT EXISTS community_read_status (
    id                   BIGSERIAL PRIMARY KEY,
    user_id              BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id            BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    last_read_message_id BIGINT NOT NULL DEFAULT 0,
    last_read_at         TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT uq_community_read_user_course UNIQUE (user_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_community_read_user_course ON community_read_status(user_id, course_id);
CREATE INDEX IF NOT EXISTS idx_community_read_course_msg  ON community_read_status(course_id, last_read_message_id);
