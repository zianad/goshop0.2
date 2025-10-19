import React, { useState, useEffect, useCallback } from 'react';
import { DeveloperLogo } from './DeveloperLogo.tsx';
import { translations } from '../translations.ts';
import * as api from '../api.ts';
import type { User, Store } from '../types.ts';
import { SunIcon, MoonIcon } from './Icons.tsx';

type Language = 'fr' | 'ar';
type Theme = 'light' | 'dark';
type TFunction = (key: keyof typeof translations.fr, options?: { [key: string]: string | number }) => string;

interface AuthProps {
  onLoginSuccess: (user: User, store: Store) => void;
  onSuperAdminLogin: () => void;
  t: TFunction;
  language: Language;
  setLanguage: (lang: Language) => void;
  theme: Theme;
  toggleTheme: () => void;
}

const SUPER_ADMIN_PIN = 'Abzn11241984';

type AuthStep = 'loading' | 'license_entry' | 'expired_trial' | 'login';

const Auth: React.FC<AuthProps> = ({ onLoginSuccess, onSuperAdminLogin, t, language, setLanguage, theme, toggleTheme }) => {
    const [step, setStep] = useState<AuthStep>('loading');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    
    const [licensedStore, setLicensedStore] = useState<Store | null>(null);
    const [loginSecret, setLoginSecret] = useState('');
    const [rememberMe, setRememberMe] = useState(false);
    const [activationCode, setActivationCode] = useState('');
    const [licenseKey, setLicenseKey] = useState('');

    const checkStoreOnMount = useCallback(async () => {
        setIsLoading(true);
        try {
            const storedLicense = localStorage.getItem('pos-license');
            if (!storedLicense) {
                setStep('license_entry');
                return;
            }

            // Existing user: validate store from local storage
            const localLicenseData: { storeId: string } = JSON.parse(storedLicense);
            const freshStoreData = await api.getStoreById(localLicenseData.storeId);
            
            if (freshStoreData) {
                // Check for trial expiration
                if (freshStoreData.trialStartDate) {
                    const trialStart = new Date(freshStoreData.trialStartDate);
                    const expiryDate = new Date(trialStart);
                    expiryDate.setDate(trialStart.getDate() + (freshStoreData.trialDurationDays ?? 7));
                    if (new Date() > expiryDate) {
                        setLicensedStore(freshStoreData);
                        setStep('expired_trial'); // Trial has ended, show activation screen
                    } else {
                        setLicensedStore(freshStoreData);
                        setStep('login'); // Trial is active
                    }
                } else {
                    setLicensedStore(freshStoreData);
                    setStep('login'); // Permanently activated
                }
            } else {
                 throw new Error('Store not found');
            }

        } catch (e: any) {
            localStorage.removeItem('pos-license');
            setError(t((e.message || 'unknownError') as keyof typeof translations.fr) || e.message);
            setStep('license_entry');
        } finally {
            setIsLoading(false);
        }
    }, [t]);

    useEffect(() => {
        if(step === 'loading') {
            checkStoreOnMount();
        }
    }, [checkStoreOnMount, step]);
    
    useEffect(() => {
        if (step === 'login' && licensedStore) {
            const rememberedSecret = localStorage.getItem(`pos-remembered-secret-${licensedStore.id}`);
            if (rememberedSecret) {
                setLoginSecret(rememberedSecret);
                setRememberMe(true);
            } else {
                setLoginSecret('');
                setRememberMe(false);
            }
        }
    }, [step, licensedStore]);


    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!licensedStore) {
            setError(t('unknownError'));
            setStep('license_entry');
            return;
        }

        setIsLoading(true);
        if (!loginSecret) {
            setError(t('fillAllFields'));
            setIsLoading(false);
            return;
        }
        
        try {
            if (loginSecret === SUPER_ADMIN_PIN) {
                onSuperAdminLogin();
                return;
            }

            const result = await api.login(licensedStore, loginSecret);
            if(rememberMe) {
                localStorage.setItem(`pos-remembered-secret-${licensedStore.id}`, loginSecret);
            } else {
                localStorage.removeItem(`pos-remembered-secret-${licensedStore.id}`);
            }
            onLoginSuccess(result.user, result.store);
        } catch(err: any) {
            let errorMessageKey: keyof typeof translations.fr | null = null;
            let fallbackMessage = t('unknownError');

            if (err && err.message) {
                const lowerCaseMessage = err.message.toLowerCase();
                
                // Check for specific API key / auth errors from Supabase
                if (lowerCaseMessage.includes('invalid api key') || lowerCaseMessage.includes('unauthorized')) {
                    errorMessageKey = 'invalidApiKeyError';
                }
                // Check for custom errors thrown from api.ts
                else if (err.message === 'storeNotFound' || err.message === 'storeDisabledError' || err.message === 'invalidCredentialsError') {
                    errorMessageKey = err.message as keyof typeof translations.fr;
                }
                
                // If it's not a known error, use the raw message as fallback
                fallbackMessage = err.message;
            }

            // Use the translated message if a key was found, otherwise use the fallback
            setError(errorMessageKey ? t(errorMessageKey) : fallbackMessage);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleActivateWithCode = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!licensedStore) return;
        setIsLoading(true);
        setError(null);
    
        try {
            const success = await api.verifyAndActivateStoreWithCode(licensedStore.id, activationCode);
            if (success) {
                alert(t('activationSuccessReload'));
                window.location.reload();
            } else {
                throw new Error('invalidActivationCode');
            }
        } catch (err: any) {
            const errorMessage = t(err.message as keyof typeof translations.fr) || err.message;
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleLicenseSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);
        const trimmedLicenseKey = licenseKey.trim();
        if (!trimmedLicenseKey) {
            setError(t('fillAllFields'));
            setIsLoading(false);
            return;
        }

        try {
            if (trimmedLicenseKey === SUPER_ADMIN_PIN) {
                onSuperAdminLogin();
                return;
            }

            const store = await api.getStoreByLicenseKey(trimmedLicenseKey);
            if (store) {
                const licenseInfoToStore = { storeId: store.id };
                localStorage.setItem('pos-license', JSON.stringify(licenseInfoToStore));
                setLicensedStore(store);
                if (store.trialStartDate) {
                     const trialStart = new Date(store.trialStartDate);
                     const expiryDate = new Date(trialStart);
                     expiryDate.setDate(trialStart.getDate() + (store.trialDurationDays ?? 7));
                     if (new Date() > expiryDate) {
                         setStep('expired_trial');
                     } else {
                         setStep('login');
                     }
                } else {
                     setStep('login');
                }
            } else {
                setError(t('invalidActivationCode'));
            }
        } catch (err: any) {
            console.error("Error activating store for the first time:", err);
            // The 406 error from Supabase during activation due to RLS policies is not a user-fixable error.
            // Show a user-friendly message that prompts them to check the key.
            if (err.message?.includes('406')) {
                 setError(t('invalidActivationCode'));
            } else {
                setError(t('unknownError'));
            }
        } finally {
            setIsLoading(false);
        }
    };

    const renderLoginForm = () => (
        <form onSubmit={handleLogin} className="space-y-4">
            <h2 className="text-2xl font-bold text-slate-700 dark:text-slate-200">{t('login')}</h2>
            {licensedStore ? (
                <>
                    <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{t('forStore', {storeName: licensedStore.name})}</p>
                    
                    <div>
                        <label htmlFor="loginSecret" className="sr-only">{t('passwordOrPin')}</label>
                        <input 
                          id="loginSecret" 
                          type="password" 
                          value={loginSecret} 
                          onChange={e => setLoginSecret(e.target.value)} 
                          placeholder={t('passwordOrPin')} 
                          className="w-full px-4 py-3 border rounded-lg text-center text-xl tracking-widest bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-slate-100 dark:border-slate-600" 
                          required 
                          autoFocus
                        />
                    </div>

                    <div className="flex items-center justify-start text-left rtl:text-right">
                        <input 
                            id="rememberMe" 
                            type="checkbox" 
                            checked={rememberMe}
                            onChange={(e) => setRememberMe(e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 dark:border-slate-500 text-teal-600 focus:ring-teal-500 bg-gray-100 dark:bg-slate-600"
                        />
                        <label htmlFor="rememberMe" className="ml-2 rtl:mr-2 rtl:ml-0 block text-sm text-gray-700 dark:text-gray-400 cursor-pointer">
                            {t('rememberPin')}
                        </label>
                    </div>
                </>
            ) : (
                <p className="text-slate-500 dark:text-slate-400">{t('loading')}...</p>
            )}
            
            <button type="submit" disabled={isLoading} className="w-full bg-teal-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-teal-700 disabled:bg-gray-400">{isLoading ? `${t('loading')}...` : t('login')}</button>
        </form>
    );

    const renderExpiredTrialForm = () => (
        <form onSubmit={handleActivateWithCode} className="space-y-4">
            <h2 className="text-2xl font-bold text-orange-600 dark:text-orange-400">{t('trialHasExpired')}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{t('contactAdminToActivate')}</p>
             <div>
                {/* FIX: Use 'enterActivationCode' key for the translation, as 'activationCode' is not a valid key. */}
                <label htmlFor="activationCode" className="sr-only">{t('enterActivationCode')}</label>
                <input 
                  id="activationCode" 
                  type="text" 
                  value={activationCode} 
                  onChange={e => setActivationCode(e.target.value)} 
                  placeholder={t('enterActivationCode')} 
                  className="w-full px-4 py-3 border rounded-lg text-center bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-slate-100 dark:border-slate-600" 
                  required 
                  autoFocus
                />
            </div>
            <button type="submit" disabled={isLoading} className="w-full bg-green-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-green-700 disabled:bg-gray-400">{isLoading ? `${t('loading')}...` : t('activateApplication')}</button>
        </form>
    );

    const renderLicenseForm = () => (
        <form onSubmit={handleLicenseSubmit} className="space-y-4">
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
            <button type="submit" disabled={isLoading} className="w-full bg-teal-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-teal-700 disabled:bg-gray-400">{isLoading ? `${t('loading')}...` : t('activate')}</button>
        </form>
    );

    const renderContent = () => {
        if (isLoading || step === 'loading') {
            return <p className="text-slate-500 dark:text-slate-400">{t('loading')}...</p>;
        }
        switch (step) {
            case 'license_entry':
                return renderLicenseForm();
            case 'login':
                return renderLoginForm();
            case 'expired_trial':
                return renderExpiredTrialForm();
            default:
                 return <button onClick={() => setStep('loading')} className="text-teal-600 hover:underline">{t('reactivationSuccess')}</button>;
        }
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
                
                {renderContent()}
            </div>
        </div>
    );
};

export default Auth;