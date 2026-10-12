-- V18: Add last_active_at column to users table for student activity tracking
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP WITH TIME ZONE;
