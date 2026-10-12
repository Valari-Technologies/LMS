-- ============================================================
-- Flyway Migration V33: Course Pricing & Payments
-- ============================================================

-- 1. Add pricing and subscription columns to courses table
ALTER TABLE courses ADD COLUMN IF NOT EXISTS pricing_type VARCHAR(30) NOT NULL DEFAULT 'free';
ALTER TABLE courses ADD COLUMN IF NOT EXISTS price NUMERIC(10, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS currency VARCHAR(10) NOT NULL DEFAULT 'INR';
ALTER TABLE courses ADD COLUMN IF NOT EXISTS subscription_period VARCHAR(30) NOT NULL DEFAULT 'lifetime';

-- 2. Create payments table for tracking student course purchases & subscriptions
CREATE TABLE IF NOT EXISTS payments (
    id                      BIGSERIAL PRIMARY KEY,
    student_id              BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id               BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    enrollment_id           BIGINT REFERENCES enrollments(id) ON DELETE SET NULL,
    amount                  NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    currency                VARCHAR(10) NOT NULL DEFAULT 'INR',
    payment_method          VARCHAR(50) NOT NULL DEFAULT 'CARD',
    transaction_id          VARCHAR(100) NOT NULL UNIQUE,
    status                  VARCHAR(30) NOT NULL DEFAULT 'SUCCESS',
    pricing_type            VARCHAR(30) NOT NULL DEFAULT 'subscription',
    subscription_period     VARCHAR(30) DEFAULT 'lifetime',
    payment_details         TEXT,
    created_at              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_student_id ON payments(student_id);
CREATE INDEX IF NOT EXISTS idx_payments_course_id ON payments(course_id);
CREATE INDEX IF NOT EXISTS idx_payments_transaction_id ON payments(transaction_id);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at DESC);

-- 3. Add payment reference and fee metadata to enrollments table
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS payment_id BIGINT REFERENCES payments(id) ON DELETE SET NULL;
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS pricing_type VARCHAR(30) DEFAULT 'free';
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(10, 2) DEFAULT 0.00;
