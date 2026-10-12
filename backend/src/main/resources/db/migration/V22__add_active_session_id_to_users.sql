-- Migration V22: Add active_session_id to users table to enforce single active session per user account
ALTER TABLE users ADD COLUMN IF NOT EXISTS active_session_id VARCHAR(100);
