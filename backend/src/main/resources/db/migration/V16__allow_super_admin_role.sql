-- V16__allow_super_admin_role.sql
-- Update users_role_check constraint to allow 'super_admin' role in PostgreSQL

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('student', 'admin', 'super_admin'));
