-- V4: Hero Banners table for dynamic marketing banners
CREATE TABLE IF NOT EXISTS hero_banners (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    subtitle TEXT,
    image_url VARCHAR(1024) NOT NULL,
    cloudinary_public_id VARCHAR(255),
    cta_text VARCHAR(100) DEFAULT 'Explore Courses',
    cta_link VARCHAR(255) DEFAULT '/student/courses',
    badge_text VARCHAR(100) DEFAULT 'Featured',
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hero_banners_active_order ON hero_banners (is_active, display_order);

-- Seed initial high-resolution Cloudinary / educational banners
INSERT INTO hero_banners (title, subtitle, image_url, cloudinary_public_id, cta_text, cta_link, badge_text, display_order, is_active)
VALUES 
(
    'Skills for your present (and your future)',
    'Technology and the modern software industry move fast. Master Java, Spring Boot, Microservices, and React with comprehensive hands-on courses.',
    'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=1920&q=80',
    'seed_banner_1',
    'Explore Course Catalog',
    '/student/courses',
    'Most Popular',
    0,
    true
),
(
    'Learn Full Stack & Cloud Architecture',
    'Build production-ready distributed applications with Spring Boot 3, PostgreSQL, Docker, and React. Taught by senior software architects.',
    'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1920&q=80',
    'seed_banner_2',
    'Start Learning Today',
    '/student/courses',
    'New Release',
    1,
    true
);
