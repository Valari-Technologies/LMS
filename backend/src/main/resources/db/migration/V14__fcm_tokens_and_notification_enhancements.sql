-- V14: FCM Tokens, Notification enhancements (image, link, broad types), and Admin Broadcasts

-- 1. Create FCM device tokens table
CREATE TABLE IF NOT EXISTS fcm_tokens (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    device_type VARCHAR(50) NOT NULL DEFAULT 'web',
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fcm_tokens_user ON fcm_tokens(user_id);

-- 2. Enhance notifications table with image, action link, and expand type constraint
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS image_url VARCHAR(500);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS link_url VARCHAR(500);

-- 3. Create broadcast_notifications table to log admin manual notification history
CREATE TABLE IF NOT EXISTS broadcast_notifications (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'SYSTEM',
    image_url VARCHAR(500),
    link_url VARCHAR(500),
    target_role VARCHAR(50) NOT NULL DEFAULT 'ALL',
    recipient_count INT NOT NULL DEFAULT 0,
    fcm_success_count INT NOT NULL DEFAULT 0,
    fcm_failure_count INT NOT NULL DEFAULT 0,
    sent_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_broadcast_notifications_created ON broadcast_notifications(created_at DESC);
