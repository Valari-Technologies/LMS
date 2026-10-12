CREATE TABLE IF NOT EXISTS community_member_status (
    id BIGSERIAL PRIMARY KEY,
    course_id BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_disabled BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT uq_cms_course_user UNIQUE (course_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_cms_course_user ON community_member_status(course_id, user_id);
