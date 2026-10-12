-- ============================================================
-- V36: Course Reviews and Ratings
-- ============================================================

CREATE TABLE IF NOT EXISTS course_reviews (
    id              BIGSERIAL PRIMARY KEY,
    course_id       BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating          INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment         TEXT,
    created_at      TIMESTAMP NOT NULL DEFAULT now(),
    updated_at      TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT uq_course_user_review UNIQUE (course_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_course_reviews_course_id ON course_reviews(course_id);
CREATE INDEX IF NOT EXISTS idx_course_reviews_user_id ON course_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_course_reviews_rating ON course_reviews(rating);
CREATE INDEX IF NOT EXISTS idx_course_reviews_created_at ON course_reviews(created_at DESC);
