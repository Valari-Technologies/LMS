-- Migration V23: Add Strict Sequential Video Watching & Playback Session tables

-- 1. Add fields to progress table
ALTER TABLE progress ADD COLUMN IF NOT EXISTS max_watched_position INT NOT NULL DEFAULT 0;
ALTER TABLE progress ADD COLUMN IF NOT EXISTS watched_seconds INT NOT NULL DEFAULT 0;
ALTER TABLE progress ADD COLUMN IF NOT EXISTS last_progress_at TIMESTAMP NULL;
ALTER TABLE progress ADD COLUMN IF NOT EXISTS playback_session_id VARCHAR(100) NULL;

-- 2. Add video learning rule settings to courses table
ALTER TABLE courses ADD COLUMN IF NOT EXISTS sequential_video_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS require_video_completion BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS sequential_lesson_unlocking BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS pause_on_tab_inactive BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS video_completion_threshold INT NOT NULL DEFAULT 95;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS progress_save_interval INT NOT NULL DEFAULT 8;

-- 3. Create video_playback_sessions table for server-side anti-cheat validation
CREATE TABLE IF NOT EXISTS video_playback_sessions (
    id BIGSERIAL PRIMARY KEY,
    session_id VARCHAR(100) NOT NULL UNIQUE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content_id BIGINT NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
    started_at TIMESTAMP NOT NULL,
    last_heartbeat_at TIMESTAMP NOT NULL,
    last_accepted_position INT NOT NULL DEFAULT 0,
    max_watched_position INT NOT NULL DEFAULT 0,
    playback_rate DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_playback_session_lookup ON video_playback_sessions(session_id, user_id, active);
