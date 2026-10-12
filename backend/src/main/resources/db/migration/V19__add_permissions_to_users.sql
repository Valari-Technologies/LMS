-- V19: Add permissions column to users table for granular navbar access and page permission level control
ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions TEXT;
