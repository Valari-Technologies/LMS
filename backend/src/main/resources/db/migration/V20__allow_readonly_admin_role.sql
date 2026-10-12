-- V20__allow_readonly_admin_role.sql
-- Update users_role_check constraint to allow 'readonly_admin' role in PostgreSQL

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('student', 'admin', 'super_admin', 'content_creator', 'readonly_admin'));
