-- V40: Add subtitle support to live session recordings (auto English subtitles)
ALTER TABLE session_recordings ADD COLUMN IF NOT EXISTS subtitle_url VARCHAR(1000);
ALTER TABLE session_recordings ADD COLUMN IF NOT EXISTS subtitle_status VARCHAR(30) DEFAULT 'PENDING';
ALTER TABLE session_recordings ADD COLUMN IF NOT EXISTS subtitle_language VARCHAR(20) DEFAULT 'en';
ALTER TABLE session_recordings ADD COLUMN IF NOT EXISTS subtitle_progress INT DEFAULT 0;
