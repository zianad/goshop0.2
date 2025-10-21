import React, { useState } from 'react';
import { translations } from '../translations';
import { DeveloperLogo } from './DeveloperLogo';
import { SunIcon, MoonIcon } from './Icons';

type Language = 'fr' | 'ar';
type Theme = 'light' | 'dark';
type TFunction = (key: keyof typeof translations.fr) => string;

interface GlobalLoginProps {
    onLicenseSubmit: (licenseKey: string) => Promise<void>;
    onSuperAdminLogin: () => void;
    t: TFunction;
    language: Language;
    setLanguage: (lang: Language) => void;
    theme: Theme;
    toggleTheme: () => void;
}

const SUPER_ADMIN_PIN = 'Abzn11241984';

const GlobalLogin: React.FC<GlobalLoginProps> = ({
    onLicenseSubmit,
    onSuperAdminLogin,
    t,
    language,
    setLanguage,
    theme,
    toggleTheme
}) => {
    const [licenseKey, setLicenseKey] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);
        const trimmedKey = licenseKey.trim();

        if (!trimmedKey) {
            setError(t('fillAllFieldsError'));
            setIsLoading(false);
            return;
        }

        if (trimmedKey === SUPER_ADMIN_PIN) {
            onSuperAdminLogin();
            return;
        }

        try {
            await onLicenseSubmit(trimmedKey);
        } catch (err: any) {
             const errorMessage = t((err.message || 'unknownError') as keyof typeof translations.fr) || err.message;
            setError(errorMessage);
            setIsLoading(false);
        }
        // Don't set isLoading to false on success, as the parent component will change the view.
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-slate-900 p-4">
            <div className="absolute top-4 right-4 rtl:right-auto rtl:left-4 flex items-center gap-3">
                <button onClick={toggleTheme} title="Toggle theme" className="p-2 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
                    {theme === 'light' ? <MoonIcon className="w-5 h-5"/> : <SunIcon className="w-5 h-5" />}
                </button>
                <button onClick={() => setLanguage(language === 'fr' ? 'ar' : 'fr')} className="px-4 py-2 text-sm font-bold bg-white dark:bg-slate-800 text-teal-600 dark:text-teal-300 border border-gray-300 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
                    {language === 'fr' ? 'العربية' : 'Français'}
                </button>
            </div>
            <div className="text-center mb-8">
                <DeveloperLogo className="w-80 h-auto mx-auto" />
                 <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    <p>by Eventhorizon solution</p>
                    <p>0622119357</p>
                </div>
            </div>
            <div className="p-8 bg-white dark:bg-slate-800 rounded-xl shadow-lg max-w-sm w-full text-center">
                {error && <p className="text-red-500 dark:text-red-400 text-sm mb-4 bg-red-50 dark:bg-red-900/30 p-3 rounded-lg">{error}</p>}
                
                <form onSubmit={handleSubmit} className="space-y-4">
                    <h2 className="text-2xl font-bold text-slate-700 dark:text-slate-200">{t('activateYourCompany')}</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{t('enterLicenseKey')}</p>
                    <div>
                        <label htmlFor="licenseKey" className="sr-only">{t('licenseKey')}</label>
                        <input 
                          id="licenseKey" 
                          type="text" 
                          value={licenseKey} 
                          onChange={e => setLicenseKey(e.target.value)} 
                          placeholder={t('licenseKey')} 
                          className="w-full px-4 py-3 border rounded-lg text-center bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-slate-100 dark:border-slate-600" 
                          required 
                          autoFocus
                        />
                    </div>
                    <button type="submit" disabled={isLoading} className="w-full bg-teal-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-teal-700 disabled:bg-gray-400">
                        {isLoading ? `${t('loading')}...` : t('activate')}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default GlobalLogin;
