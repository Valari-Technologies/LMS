-- V10: Add subtitle_progress column to contents table
-- Tracks 0–100% generation progress for Tamil→English subtitle jobs

ALTER TABLE contents
    ADD COLUMN IF NOT EXISTS subtitle_progress INT NOT NULL DEFAULT 0;
