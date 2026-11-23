-- V43: Course Selling Plans & Tiered Pricing Support
-- Supports 3 distinct course selling models:
-- 1. LIVE_ONLY (Only Live Section)
-- 2. FULL_ACCESS (Live + Recording Videos)
-- 3. RECORDED_ONLY (Recording Videos Only)

ALTER TABLE courses ADD COLUMN IF NOT EXISTS selling_plans TEXT;
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS plan_type VARCHAR(50) DEFAULT 'FULL_ACCESS';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS plan_type VARCHAR(50);
