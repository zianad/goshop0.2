import React from 'react';
import type { Store } from '../types';
import { translations } from '../translations';

type TFunction = (key: keyof typeof translations.fr, options?: { [key: string]: string | number }) => string;

interface TrialBannerProps {
  store: Store;
  t: TFunction;
}

const TrialBanner: React.FC<TrialBannerProps> = ({ store, t }) => {
  if (!store.trialStartDate) {
    return null;
  }

  const trialStart = new Date(store.trialStartDate);
  const expiryDate = new Date(trialStart);
  expiryDate.setDate(trialStart.getDate() + (store.trialDurationDays ?? 7));

  const remainingTime = expiryDate.getTime() - new Date().getTime();
  
  if (remainingTime <= 0) {
    return null; // The login logic will handle the block.
  }
  
  const remainingDays = Math.ceil(remainingTime / (1000 * 60 * 60 * 24));

  return (
    <div className="bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-200 text-center p-2 text-sm font-semibold sticky top-0 z-40">
      {t('trialDaysRemaining', { days: remainingDays })}
    </div>
  );
};

export default TrialBanner;