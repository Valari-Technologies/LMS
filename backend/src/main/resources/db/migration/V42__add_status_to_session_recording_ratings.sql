-- ============================================================
-- V42: Add status column to session_recording_ratings for Admin moderation
-- ============================================================

ALTER TABLE session_recording_ratings 
ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'published';

ALTER TABLE session_recording_ratings 
ALTER COLUMN status SET DEFAULT 'pending';

CREATE INDEX IF NOT EXISTS idx_session_rec_ratings_status ON session_recording_ratings(status);

