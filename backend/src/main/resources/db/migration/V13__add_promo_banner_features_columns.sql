-- V13: Add features_columns layout selection to promo_banners
ALTER TABLE promo_banners ADD COLUMN IF NOT EXISTS features_columns INT DEFAULT 2;
