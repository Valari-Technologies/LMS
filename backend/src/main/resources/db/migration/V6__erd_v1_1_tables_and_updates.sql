-- ============================================================
-- Flyway Migration V6: OneTutor ERD v1.1 Schema Alignment
-- Core + Media Library + Authentication Tables
-- ============================================================

-- 1. Media Assets: Update schema to include ERD v1.1 attributes
-- Rename filename to file_name if column filename exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'media_assets' AND column_name = 'filename'
    ) THEN
        ALTER TABLE media_assets RENAME COLUMN filename TO file_name;
    END IF;
END $$;

ALTER TABLE media_assets 
    ADD COLUMN IF NOT EXISTS original_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS file_type VARCHAR(50),
    ADD COLUMN IF NOT EXISTS thumbnail_path VARCHAR(255),
    ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT now();

-- Backfill original_name and file_type for existing records
UPDATE media_assets 
SET original_name = COALESCE(original_name, file_name),
    file_type = COALESCE(
        file_type, 
        CASE 
            WHEN mime_type LIKE 'video/%' THEN 'video'
            WHEN mime_type = 'application/pdf' THEN 'pdf'
            WHEN mime_type LIKE 'image/%' THEN 'image'
            ELSE 'file'
        END
    ),
    updated_at = COALESCE(updated_at, created_at)
WHERE original_name IS NULL OR file_type IS NULL;

-- 2. Content Resources: Create new table connecting contents to media_assets
CREATE TABLE IF NOT EXISTS content_resources (
    id              BIGSERIAL PRIMARY KEY,
    content_id      BIGINT NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
    media_asset_id  BIGINT REFERENCES media_assets(id) ON DELETE SET NULL,
    resource_type   VARCHAR(20) NOT NULL DEFAULT 'file' CHECK (resource_type IN ('file', 'link')),
    title           VARCHAR(200),
    description     TEXT,
    display_order   INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMP NOT NULL DEFAULT now(),
    updated_at      TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_content_resources_content ON content_resources(content_id);
CREATE INDEX IF NOT EXISTS idx_content_resources_media_asset ON content_resources(media_asset_id);

-- Migrate any existing records from legacy resources table to content_resources if table exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'resources') THEN
        INSERT INTO content_resources (content_id, resource_type, title, description, display_order, created_at, updated_at)
        SELECT 
            content_id,
            CASE WHEN lower(type) = 'link' THEN 'link' ELSE 'file' END,
            name,
            url,
            display_order,
            created_at,
            created_at
        FROM resources
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

-- 3. Session Recordings: Add media_asset_id and updated_at
ALTER TABLE session_recordings 
    ADD COLUMN IF NOT EXISTS media_asset_id BIGINT REFERENCES media_assets(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_session_recordings_media_asset ON session_recordings(media_asset_id);

-- 4. Email Verifications: Create table per ERD v1.1
CREATE TABLE IF NOT EXISTS email_verifications (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token       VARCHAR(255) NOT NULL UNIQUE,
    expires_at  TIMESTAMP NOT NULL,
    verified_at TIMESTAMP,
    created_at  TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_verifications_user ON email_verifications(user_id);

-- Backfill from legacy email_verification_tokens if exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'email_verification_tokens') THEN
        INSERT INTO email_verifications (id, user_id, token, expires_at, verified_at, created_at)
        SELECT id, user_id, token, expires_at, used_at, created_at 
        FROM email_verification_tokens
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

-- 5. Progress: Convert progress_percent to integer (0-100) per ERD
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'progress' AND column_name = 'progress_percent' AND data_type != 'integer'
    ) THEN
        ALTER TABLE progress ALTER COLUMN progress_percent TYPE INTEGER USING round(progress_percent)::INTEGER;
    END IF;
END $$;

-- 6. Contents: Update content_type check constraint to accommodate lowercase values and 'link', 'resource'
DO $$
BEGIN
    -- Drop existing content_type check constraint if present
    ALTER TABLE contents DROP CONSTRAINT IF EXISTS contents_content_type_check;
    
    -- Re-add check constraint supporting both legacy uppercase and new ERD types
    ALTER TABLE contents ADD CONSTRAINT contents_content_type_check 
        CHECK (content_type IN ('VIDEO', 'PDF', 'IMAGE', 'DOWNLOAD', 'EXTERNAL_LINK', 'video', 'pdf', 'image', 'link', 'resource'));
END $$;
