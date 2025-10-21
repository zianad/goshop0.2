import React from 'react';
import type { Store } from '../types';
import { translations } from '../translations';
import { Logo } from './Logo';
import { ArrowRightIcon } from './Icons';

type TFunction = (key: keyof typeof translations.fr) => string;

interface StoreSelectorProps {
  stores: Store[];
  onSelectStore: (store: Store) => void;
  t: TFunction;
}

const StoreSelector: React.FC<StoreSelectorProps> = ({ stores, onSelectStore, t }) => {
  return (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg">
      <h2 className="text-2xl font-bold text-slate-700 dark:text-slate-200 mb-4">
        {t('selectStoreToLogin')}
      </h2>
      <div className="max-h-80 overflow-y-auto space-y-2 pr-2">
        {stores.length > 0 ? (
          stores.map(store => (
            <button
              key={store.id}
              onClick={() => onSelectStore(store)}
              className="w-full text-left rtl:text-right flex justify-between items-center p-3 bg-gray-50 dark:bg-slate-700/50 hover:bg-teal-50 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              <div className="flex items-center gap-3">
                <Logo url={store.logo} className="w-10 h-10 rounded-lg bg-gray-200 object-cover" />
                <span className="font-bold text-slate-800 dark:text-slate-200">{store.name}</span>
              </div>
              <span className="text-teal-600 dark:text-teal-400 font-bold flex items-center gap-1 text-sm">
                {t('loginAsAdmin')} <ArrowRightIcon className="w-4 h-4" />
              </span>
            </button>
          ))
        ) : (
          <p className="text-slate-500 dark:text-slate-400 text-center py-4">
            {t('noStoresAdded')}
          </p>
        )}
      </div>
    </div>
  );
};

export default StoreSelector;
