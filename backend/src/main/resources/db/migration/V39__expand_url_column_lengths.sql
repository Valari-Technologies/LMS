-- ============================================================
-- Flyway Migration V39: Expand URL and Path Column Lengths
-- Guarantees support for Cloudinary CDN URLs across all entities
-- ============================================================

ALTER TABLE media_assets ALTER COLUMN storage_path TYPE VARCHAR(1000);
ALTER TABLE media_assets ALTER COLUMN thumbnail_path TYPE VARCHAR(500);

ALTER TABLE courses ALTER COLUMN thumbnail TYPE VARCHAR(1000);

ALTER TABLE users ALTER COLUMN profile_image TYPE VARCHAR(1000);

ALTER TABLE contents ALTER COLUMN media_reference TYPE VARCHAR(1000);
ALTER TABLE contents ALTER COLUMN subtitle_url TYPE VARCHAR(1000);
