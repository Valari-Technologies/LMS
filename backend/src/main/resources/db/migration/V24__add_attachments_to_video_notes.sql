-- ============================================================
-- Flyway Migration V24: Add image_url, file_url, and file_name to video_notes
-- ============================================================

ALTER TABLE video_notes
    ADD COLUMN IF NOT EXISTS image_url TEXT,
    ADD COLUMN IF NOT EXISTS file_url TEXT,
    ADD COLUMN IF NOT EXISTS file_name VARCHAR(255);
