-- V30__add_subtitle_fields.sql
-- Add subtitle tracking columns to contents table for automatic English WebVTT generation

ALTER TABLE contents
    ADD COLUMN IF NOT EXISTS subtitle_url VARCHAR(500),
    ADD COLUMN IF NOT EXISTS subtitle_status VARCHAR(30) DEFAULT 'PENDING',
    ADD COLUMN IF NOT EXISTS subtitle_language VARCHAR(10) DEFAULT 'en',
    ADD COLUMN IF NOT EXISTS subtitle_generated_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS subtitle_error TEXT;

CREATE INDEX IF NOT EXISTS idx_contents_subtitle_status ON contents(subtitle_status);
