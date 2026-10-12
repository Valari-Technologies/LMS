-- V29__allow_pending_approval_status.sql
-- Update status check constraints for sections and contents tables to include 'pending_approval'

ALTER TABLE sections DROP CONSTRAINT IF EXISTS sections_status_check;
ALTER TABLE sections ADD CONSTRAINT sections_status_check CHECK (status IN ('active', 'archived', 'pending_approval'));

ALTER TABLE contents DROP CONSTRAINT IF EXISTS contents_status_check;
ALTER TABLE contents ADD CONSTRAINT contents_status_check CHECK (status IN ('active', 'archived', 'pending_approval'));

