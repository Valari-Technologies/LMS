-- V11: Promo Banner table for high-converting marketing section after course catalog
CREATE TABLE IF NOT EXISTS promo_banners (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    subtitle TEXT,
    bg_color VARCHAR(100) DEFAULT '#1c1d29',
    text_color VARCHAR(50) DEFAULT '#ffffff',
    accent_color VARCHAR(50) DEFAULT '#a855f7',
    image_url VARCHAR(1024),
    secondary_image_url VARCHAR(1024),
    image_alignment VARCHAR(20) DEFAULT 'right',
    cta_text VARCHAR(100) DEFAULT 'Subscribe now',
    cta_link VARCHAR(255) DEFAULT '/student/courses',
    cta_bg_color VARCHAR(50) DEFAULT '#ffffff',
    cta_text_color VARCHAR(50) DEFAULT '#1c1d29',
    secondary_link_text VARCHAR(100) DEFAULT 'Learn more',
    secondary_link_url VARCHAR(255) DEFAULT '/student/courses',
    features_json TEXT,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Seed initial promo banner matching reference design (idempotent)
INSERT INTO promo_banners (
    title,
    subtitle,
    bg_color,
    text_color,
    accent_color,
    image_url,
    secondary_image_url,
    image_alignment,
    cta_text,
    cta_link,
    cta_bg_color,
    cta_text_color,
    secondary_link_text,
    secondary_link_url,
    features_json,
    is_active
) 
SELECT
    'Build your career with a Personal Plan subscription',
    'Subscribers save an average of ₹4,000+ in their first month, stop paying per course. Join 5 lakh+ learners, starting at ₹500/month.',
    '#1c1d29',
    '#ffffff',
    '#a855f7',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=400&q=80',
    'right',
    'Subscribe now',
    '/student/courses',
    '#ffffff',
    '#1c1d29',
    'Learn more',
    '/student/courses',
    '[{"icon":"star","text":"Get access to 28,000+ top-rated courses"},{"icon":"lightbulb","text":"Learn from 9,000+ expert instructors"},{"icon":"tv","text":"Dev, IT, Business, Design and 50+ more topics"},{"icon":"trophy","text":"Certification prep for AWS, Microsoft, PMI, and more"}]',
    true
WHERE NOT EXISTS (SELECT 1 FROM promo_banners LIMIT 1);
