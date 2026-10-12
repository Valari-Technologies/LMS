-- ============================================================
-- Flyway Migration V7: Community Chat
-- Per-course group chat for enrolled students and admins
-- ============================================================

CREATE TABLE IF NOT EXISTS community_messages (
    id              BIGSERIAL PRIMARY KEY,
    course_id       BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    sender_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content         TEXT,
    message_type    VARCHAR(20) NOT NULL DEFAULT 'text'
                        CHECK (message_type IN ('text','image','pdf','video','file')),
    media_asset_id  BIGINT REFERENCES media_assets(id) ON DELETE SET NULL,
    deleted         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMP NOT NULL DEFAULT now(),
    updated_at      TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_community_messages_course   ON community_messages(course_id);
CREATE INDEX IF NOT EXISTS idx_community_messages_sender   ON community_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_community_messages_course_id ON community_messages(course_id, id);
