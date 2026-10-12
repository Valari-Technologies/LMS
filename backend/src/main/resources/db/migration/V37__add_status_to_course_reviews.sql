-- ============================================================
-- V37: Add status column to course_reviews for Super Admin publication approval
-- ============================================================

ALTER TABLE course_reviews 
ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'published';

ALTER TABLE course_reviews 
ALTER COLUMN status SET DEFAULT 'pending';

CREATE INDEX IF NOT EXISTS idx_course_reviews_status ON course_reviews(status);
