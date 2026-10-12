import React, { useState, useEffect } from 'react';
import oneTutorBrandImg from '../assets/images/oneTutorBrand.png';

export default function BrandLandingSplash({ duration = 1400 }) {
  const [visible, setVisible] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const timer1 = setTimeout(() => {
      setFadeOut(true);
    }, Math.max(200, duration - 400));

    const timer2 = setTimeout(() => {
      setVisible(false);
    }, duration);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [duration]);

  if (!visible) return null;

  return (
    <div className={`ot-landing-splash-overlay ${fadeOut ? 'fade-out' : ''}`}>
      <div className="ot-landing-splash-logo-wrap">
        <div className="ot-landing-splash-glow"></div>
        <img
          src={oneTutorBrandImg}
          alt="OneTutor Brand"
          className="ot-landing-splash-logo"
        />
      </div>

      <div className="ot-landing-splash-text">OneTutor</div>

      <div className="ot-landing-splash-bar-wrap">
        <div className="ot-landing-splash-bar-fill"></div>
      </div>
    </div>
  );
}
