-- V12: Add secondary link color to promo_banners
ALTER TABLE promo_banners ADD COLUMN IF NOT EXISTS secondary_link_color VARCHAR(50) DEFAULT '#ffffff';
