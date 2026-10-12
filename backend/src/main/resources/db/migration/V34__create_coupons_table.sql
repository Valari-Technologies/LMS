-- ============================================================
-- Flyway Migration V34: Coupon Management & Redemptions
-- ============================================================

CREATE TABLE IF NOT EXISTS coupons (
    id                      BIGSERIAL PRIMARY KEY,
    code                    VARCHAR(50) NOT NULL UNIQUE,
    discount_type           VARCHAR(20) NOT NULL DEFAULT 'PERCENTAGE',
    discount_value          NUMERIC(10, 2) NOT NULL,
    min_purchase_amount     NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    max_discount_amount     NUMERIC(10, 2) DEFAULT NULL,
    start_date              TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    expiry_date             TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    usage_limit             INTEGER DEFAULT NULL,
    used_count              INTEGER NOT NULL DEFAULT 0,
    per_user_limit          INTEGER NOT NULL DEFAULT 1,
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    description             VARCHAR(255),
    created_by              BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupons_is_active ON coupons(is_active);
CREATE INDEX IF NOT EXISTS idx_coupons_expiry_date ON coupons(expiry_date);

CREATE TABLE IF NOT EXISTS coupon_redemptions (
    id                      BIGSERIAL PRIMARY KEY,
    coupon_id               BIGINT NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
    user_id                 BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    payment_id              BIGINT REFERENCES payments(id) ON DELETE SET NULL,
    discount_applied        NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    redeemed_at             TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_redemptions_coupon_id ON coupon_redemptions(coupon_id);
CREATE INDEX IF NOT EXISTS idx_redemptions_user_id ON coupon_redemptions(user_id);

-- Seed baseline popular coupons
INSERT INTO coupons (code, discount_type, discount_value, min_purchase_amount, is_active, description)
VALUES 
    ('ONETUTOR20', 'PERCENTAGE', 20.00, 0.00, true, '20% discount on all courses'),
    ('LEARN50', 'PERCENTAGE', 50.00, 0.00, true, 'Mega 50% discount for learners'),
    ('STUDENT50', 'PERCENTAGE', 50.00, 0.00, true, 'Special 50% student scholarship discount'),
    ('FLAT500', 'FLAT', 500.00, 1000.00, true, 'Flat ₹500 discount on orders above ₹1,000'),
    ('WELCOME10', 'PERCENTAGE', 10.00, 0.00, true, '10% welcome discount for new learners')
ON CONFLICT (code) DO NOTHING;
