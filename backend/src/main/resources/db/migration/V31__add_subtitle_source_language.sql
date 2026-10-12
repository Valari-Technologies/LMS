-- V31__add_subtitle_source_language.sql
-- Adds source language tracking for subtitle translation pipeline.
-- Supports Tamil (ta) -> English (en) as primary flow, extensible for future languages.

ALTER TABLE contents
    ADD COLUMN IF NOT EXISTS subtitle_source_language VARCHAR(10);

COMMENT ON COLUMN contents.subtitle_source_language IS
    'Detected source language of the video audio (e.g., ta = Tamil, hi = Hindi, en = English). NULL = not yet detected.';

COMMENT ON COLUMN contents.subtitle_language IS
    'Output subtitle language (always en = English for current pipeline).';

-- Index for efficient querying by source language (e.g., find all Tamil videos)
CREATE INDEX IF NOT EXISTS idx_contents_subtitle_source_lang ON contents(subtitle_source_language)
    WHERE subtitle_source_language IS NOT NULL;
