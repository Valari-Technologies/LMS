-- ============================================================
-- Flyway Migration V21: Add audio_url and note_type to video_notes
-- ============================================================

ALTER TABLE video_notes
    ADD COLUMN IF NOT EXISTS audio_url TEXT,
    ADD COLUMN IF NOT EXISTS note_type VARCHAR(20) DEFAULT 'text';

ALTER TABLE video_notes ALTER COLUMN text DROP NOT NULL;
