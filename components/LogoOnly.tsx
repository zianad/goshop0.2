import React from 'react';
import { Logo } from './Logo';

/**
 * A simple component to display just the application logo.
 * Useful for login screens or minimalist headers.
 */
export const LogoOnly = ({ className }: { className?: string }) => {
  return <Logo className={className} />;
};
