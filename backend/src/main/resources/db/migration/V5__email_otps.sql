-- Migration V5: Create email_otps table for Registration and Password Reset verification
CREATE TABLE email_otps (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    otp_code VARCHAR(10) NOT NULL,
    purpose VARCHAR(50) NOT NULL, -- 'REGISTRATION' or 'PASSWORD_RESET'
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_email_otps_email_purpose ON email_otps(email, purpose);
CREATE INDEX idx_email_otps_created_at ON email_otps(created_at);
