-- ============================================================
-- Flyway Migration V35: Category and Course Scoped Coupons
-- ============================================================

ALTER TABLE coupons ADD COLUMN IF NOT EXISTS scope VARCHAR(30) NOT NULL DEFAULT 'ALL_COURSES';
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS category_id BIGINT REFERENCES categories(id) ON DELETE SET NULL;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS course_id BIGINT REFERENCES courses(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS coupon_categories (
    coupon_id BIGINT NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
    category_id BIGINT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    PRIMARY KEY (coupon_id, category_id)
);

CREATE TABLE IF NOT EXISTS coupon_courses (
    coupon_id BIGINT NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
    course_id BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    PRIMARY KEY (coupon_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_coupons_scope ON coupons(scope);
CREATE INDEX IF NOT EXISTS idx_coupons_category_id ON coupons(category_id);
CREATE INDEX IF NOT EXISTS idx_coupons_course_id ON coupons(course_id);
