-- ============================================================
-- Flyway Migration V32: Contact Messages & Support Inquiries
-- ============================================================

CREATE TABLE IF NOT EXISTS contact_messages (
    id                      BIGSERIAL PRIMARY KEY,
    name                    VARCHAR(255) NOT NULL,
    email                   VARCHAR(255) NOT NULL,
    subject                 VARCHAR(255) NOT NULL,
    message                 TEXT NOT NULL,
    status                  VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    user_id                 BIGINT REFERENCES users(id) ON DELETE SET NULL,
    ip_address              VARCHAR(100),
    user_agent              TEXT,
    reply_message           TEXT,
    replied_by              BIGINT REFERENCES users(id) ON DELETE SET NULL,
    replied_by_name         VARCHAR(255),
    replied_at              TIMESTAMP WITH TIME ZONE,
    created_at              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contact_messages_status ON contact_messages(status);
CREATE INDEX IF NOT EXISTS idx_contact_messages_email ON contact_messages(email);
CREATE INDEX IF NOT EXISTS idx_contact_messages_user_id ON contact_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_contact_messages_created_at ON contact_messages(created_at DESC);
