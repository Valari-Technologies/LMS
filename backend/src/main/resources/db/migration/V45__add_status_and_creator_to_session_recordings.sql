-- Flyway migration V45: Add verification status and creator to session recordings
ALTER TABLE session_recordings
    ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'PUBLISHED',
    ADD COLUMN IF NOT EXISTS uploaded_by_id BIGINT REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_session_recordings_status ON session_recordings(status);
