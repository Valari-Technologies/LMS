import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { resolveMediaUrl } from '../utils/mediaUtils';

export const ICON_MAP = {
  star: 'fa-solid fa-star',
  lightbulb: 'fa-solid fa-lightbulb',
  tv: 'fa-solid fa-tv',
  trophy: 'fa-solid fa-trophy',
  sparkles: 'fa-solid fa-wand-magic-sparkles',
  check: 'fa-solid fa-circle-check',
  rocket: 'fa-solid fa-rocket',
  shield: 'fa-solid fa-shield-halved',
  users: 'fa-solid fa-user-group',
  book: 'fa-solid fa-book-bookmark',
  laptop: 'fa-solid fa-laptop-code',
  award: 'fa-solid fa-award',
};

export function getFeatureIcon(iconKey) {
  const cls = ICON_MAP[iconKey] || ICON_MAP.star;
  return <i className={cls} style={{ fontSize: '0.88rem' }}></i>;
}

export default function PromoBannerSection({ banner, isPreview = false, previewMode = 'desktop' }) {
  const isBannerActive = banner && banner.active !== false && banner.active !== 'false';
  if (!banner || (!isBannerActive && !isPreview)) {
    return null;
  }

  const {
    title = 'Build your career with a Personal Plan subscription',
    subtitle = 'Subscribers save an average of ₹4,000+ in their first month, stop paying per course. Join 5 lakh+ learners, starting at ₹500/month.',
    bgColor = '#5A70D3',
    textColor = '#ffffff',
    accentColor = '#E8EBFA',
    imageUrl = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80',
    secondaryImageUrl = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=400&q=80',
    imageAlignment = 'right',
    ctaText = 'Subscribe now',
    ctaLink = '/student/courses',
    ctaBgColor = '#ffffff',
    ctaTextColor = '#5A70D3',
    secondaryLinkText = 'Learn more',
    secondaryLinkUrl = '/student/courses',
    secondaryLinkColor = '#ffffff',
    featuresColumns = 2,
    featuresJson,
  } = banner;

  let features = [];
  try {
    if (typeof featuresJson === 'string' && featuresJson.trim().length > 0) {
      features = JSON.parse(featuresJson);
    } else if (Array.isArray(featuresJson)) {
      features = featuresJson;
    }
  } catch (e) {
    features = [];
  }

  if (!features || features.length === 0) {
    features = [
      { icon: 'star', text: 'Get access to 28,000+ top-rated courses' },
      { icon: 'lightbulb', text: 'Learn from 9,000+ expert instructors' },
      { icon: 'tv', text: 'Dev, IT, Business, Design and 50+ more topics' },
      { icon: 'trophy', text: 'Certification prep for AWS, Microsoft, PMI, and more' },
    ];
  }

  const isLeft = imageAlignment === 'left';

  // Preview viewport width simulation
  const previewStyles = isPreview ? {
    width: previewMode === 'mobile' ? '375px' : previewMode === 'tablet' ? '720px' : '100%',
    maxWidth: '100%',
    margin: '0 auto',
    transition: 'width 0.3s ease',
  } : {};

  const [isMobileScreen, setIsMobileScreen] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768;
    }
    return false;
  });

  useEffect(() => {
    function handleResize() {
      setIsMobileScreen(window.innerWidth < 768);
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Stacked when in mobile/tablet preview OR when on a small screen in real mode
  const isStacked = (isPreview && (previewMode === 'mobile' || previewMode === 'tablet')) || (!isPreview && isMobileScreen);

  return (
    <section
      className="ud-promo-banner-wrapper"
      style={{
        width: '100%',
        maxWidth: isPreview ? '100%' : '1760px',
        margin: isPreview ? '0' : '44px auto 48px auto',
        padding: isPreview ? '0' : '0 24px',
        boxSizing: 'border-box',
        ...previewStyles,
      }}
    >
      <div
        className="ud-promo-banner-card"
        style={{
          background: bgColor || '#1c1d29',
          color: textColor || '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 16px 36px -12px rgba(15, 23, 42, 0.45), 0 4px 12px rgba(0, 0, 0, 0.2)',
          overflow: 'hidden',
          display: 'grid',
          gridTemplateColumns: isStacked ? '1fr' : 'repeat(auto-fit, minmax(320px, 1fr))',
          position: 'relative',
          border: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        {/* TEXT CONTENT COLUMN */}
        <div
          className="ud-promo-banner-content"
          style={{
            order: isLeft ? 2 : 1,
            padding: isStacked ? '32px 24px' : '48px 44px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            zIndex: 2,
          }}
        >
          {/* Title */}
          <h2
            style={{
              margin: '0 0 14px 0',
              fontSize: isStacked ? '1.5rem' : 'clamp(1.7rem, 2.3vw, 2.25rem)',
              fontWeight: 800,
              lineHeight: 1.25,
              letterSpacing: '-0.02em',
              color: textColor || '#ffffff',
            }}
          >
            {title}
          </h2>

          {/* Subtitle */}
          {subtitle && (
            <p
              style={{
                margin: '0 0 28px 0',
                fontSize: isStacked ? '0.9rem' : '0.97rem',
                lineHeight: 1.6,
                color: textColor || '#ffffff',
                opacity: 0.88,
                maxWidth: '560px',
              }}
            >
              {subtitle}
            </p>
          )}

          {/* Feature List (1, 2, or 3 Columns for large/medium, 1 column for small screens) */}
          <div
            className="ud-promo-features-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: isStacked
                ? '1fr'
                : Number(featuresColumns) === 1
                ? '1fr'
                : Number(featuresColumns) === 3
                ? 'repeat(3, 1fr)'
                : 'repeat(2, 1fr)',
              gap: isStacked || Number(featuresColumns) === 1 ? '12px 14px' : Number(featuresColumns) === 3 ? '12px 14px' : '14px 20px',
              marginBottom: '32px',
            }}
          >
            {features.map((feat, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: Number(featuresColumns) === 3 ? '8px' : '12px',
                }}
              >
                <div
                  style={{
                    width: Number(featuresColumns) === 3 ? '26px' : '32px',
                    height: Number(featuresColumns) === 3 ? '26px' : '32px',
                    minWidth: Number(featuresColumns) === 3 ? '26px' : '32px',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: accentColor || '#c084fc',
                    marginTop: '2px',
                    flexShrink: 0,
                  }}
                >
                  {getFeatureIcon(feat.icon)}
                </div>
                <span
                  style={{
                    fontSize: Number(featuresColumns) === 3 ? '0.82rem' : '0.88rem',
                    fontWeight: 600,
                    lineHeight: 1.45,
                    color: textColor || '#ffffff',
                    opacity: 0.95,
                    wordBreak: 'break-word',
                  }}
                >
                  {feat.text}
                </span>
              </div>
            ))}
          </div>

          {/* CTA Buttons Row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '20px',
              flexWrap: 'wrap',
            }}
          >
            {ctaText && (
              isPreview ? (
                <button
                  type="button"
                  style={{
                    background: ctaBgColor || '#ffffff',
                    color: ctaTextColor || '#1c1d29',
                    fontWeight: 700,
                    fontSize: '0.95rem',
                    padding: '13px 30px',
                    borderRadius: '6px',
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)',
                    transition: 'transform 0.15s ease, opacity 0.15s ease',
                  }}
                >
                  {ctaText}
                </button>
              ) : (
                <Link
                  to={ctaLink || '/student/courses'}
                  style={{
                    background: ctaBgColor || '#ffffff',
                    color: ctaTextColor || '#1c1d29',
                    fontWeight: 700,
                    fontSize: '0.95rem',
                    padding: '13px 30px',
                    borderRadius: '6px',
                    textDecoration: 'none',
                    display: 'inline-block',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)',
                    transition: 'transform 0.15s ease, opacity 0.15s ease',
                  }}
                >
                  {ctaText}
                </Link>
              )
            )}

            {secondaryLinkText && (
              isPreview ? (
                <span
                  style={{
                    color: secondaryLinkColor || textColor || '#ffffff',
                    fontWeight: 700,
                    fontSize: '0.92rem',
                    textDecoration: 'underline',
                    textUnderlineOffset: '4px',
                    cursor: 'pointer',
                    opacity: 0.95,
                  }}
                >
                  {secondaryLinkText}
                </span>
              ) : (
                <Link
                  to={secondaryLinkUrl || '/student/courses'}
                  style={{
                    color: secondaryLinkColor || textColor || '#ffffff',
                    fontWeight: 700,
                    fontSize: '0.92rem',
                    textDecoration: 'underline',
                    textUnderlineOffset: '4px',
                    opacity: 0.95,
                    transition: 'opacity 0.15s ease',
                  }}
                >
                  {secondaryLinkText}
                </Link>
              )
            )}
          </div>
        </div>

        {/* IMAGE VISUAL COLUMN */}
        <div
          className="ud-promo-banner-visual"
          style={{
            order: isLeft ? 1 : 2,
            padding: isStacked ? '0 24px 32px 24px' : '36px 36px 36px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: isStacked ? '240px' : '380px',
            position: 'relative',
          }}
        >
          {imageUrl ? (
            <div
              style={{
                width: '100%',
                maxWidth: '480px',
                height: isStacked ? '260px' : '340px',
                borderRadius: '14px',
                overflow: 'hidden',
                position: 'relative',
                boxShadow: '0 16px 36px rgba(0, 0, 0, 0.35)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                background: 'rgba(0, 0, 0, 0.2)',
              }}
            >
              <img
                src={resolveMediaUrl(imageUrl)}
                alt={title}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                }}
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            </div>
          ) : (
            // Fallback decorative graphic card
            <div
              style={{
                width: '100%',
                maxWidth: '420px',
                height: '280px',
                borderRadius: '14px',
                background: 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.01) 100%)',
                border: '1px dashed rgba(255, 255, 255, 0.2)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                color: 'rgba(255, 255, 255, 0.6)',
              }}
            >
              <i className="fa-regular fa-image" style={{ fontSize: '3rem', opacity: 0.5 }}></i>
              <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Promo Visual (Upload in Admin)</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
