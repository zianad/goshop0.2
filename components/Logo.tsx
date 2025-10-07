import React from 'react';

// The fallback URL for the logo image if a custom one isn't provided.
const FALLBACK_LOGO_URL = 'https://storage.googleapis.com/appmaker-310316.appspot.com/user_4a0de5b0722a4666a2657c793742469a/app_primo_4f5f590457634f19b16ab20c918a38b2/1721066782500_834';

/**
 * A reusable component to display the application logo.
 * It displays a custom logo if a URL is provided, otherwise it shows a fallback.
 */
export const Logo = ({ url, className }: { url?: string; className?: string }) => {
  const logoSrc = url || FALLBACK_LOGO_URL;
  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
      e.currentTarget.src = FALLBACK_LOGO_URL;
  };
  
  return <img src={logoSrc} alt="Logo du magasin" className={className} onError={handleError} />;
};