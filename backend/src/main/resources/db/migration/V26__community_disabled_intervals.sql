CREATE TABLE IF NOT EXISTS community_disabled_intervals (
    id BIGSERIAL PRIMARY KEY,
    course_id BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    disabled_at TIMESTAMP NOT NULL DEFAULT now(),
    enabled_at TIMESTAMP NULL
);

CREATE INDEX IF NOT EXISTS idx_cdi_course_user ON community_disabled_intervals(course_id, user_id);
