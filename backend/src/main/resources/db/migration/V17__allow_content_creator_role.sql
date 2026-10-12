-- V17__allow_content_creator_role.sql
-- Update users_role_check constraint to allow 'content_creator' role in PostgreSQL

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('student', 'admin', 'super_admin', 'content_creator'));
