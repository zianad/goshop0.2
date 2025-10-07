import React, { useState, useEffect } from 'react';
import type { Store, User } from '../types';
import * as api from '../api';
import { translations } from '../translations';
import { LogoutIcon, SunIcon, MoonIcon, StoreIcon, ArrowRightIcon, SettingsIcon } from './Icons';
import { DeveloperLogo } from './DeveloperLogo';

type Language = 'fr' | 'ar';
type Theme = 'light' | 'dark';
type TFunction = (key: keyof typeof translations.fr, options?: { [key: string]: string | number }) => string;

interface SuperAdminLandingProps {
    onLoginAsStoreAdmin: (user: User, store: Store) => void;
    onGoToDashboard: () => void;
    onLogout: () => void;
    t: TFunction;
    language: Language;
    setLanguage: (lang: Language) => void;
    theme: Theme;
    toggleTheme: () => void;
}

const SuperAdminLanding: React.FC<SuperAdminLandingProps> = ({ onLoginAsStoreAdmin, onGoToDashboard, onLogout, t, language, setLanguage, theme, toggleTheme }) => {
    const [stores, setStores] = useState<Store[]>([]);

    useEffect(() => {
        const fetchData = async () => {
            const storesData = await api.getAllStores();
            setStores(storesData.sort((a,b) => a.name.localeCompare(b.name)));
        };
        fetchData();
    }, []);

    const handleStoreLogin = async (store: Store) => {
        const admin = await api.getAdminUserForStore(store.id);
        if (admin) {
            onLoginAsStoreAdmin(admin, store);
        } else {
            alert(t('noAdminForStore'));
        }
    };
    
    return (
         <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-slate-900 p-4">
            <header className="absolute top-0 left-0 right-0 p-4">
                <div className="container mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-3">
                         <button onClick={toggleTheme} title="Toggle theme" className="p-2 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
                              {theme === 'light' ? <MoonIcon className="w-5 h-5"/> : <SunIcon className="w-5 h-5" />}
                         </button>
                         <button onClick={() => setLanguage(language === 'fr' ? 'ar' : 'fr')} className="px-4 py-2 text-sm font-bold bg-white dark:bg-slate-800 text-teal-600 dark:text-teal-300 border border-gray-300 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
                            {language === 'fr' ? 'العربية' : 'Français'}
                        </button>
                    </div>
                    <button onClick={onLogout} className="flex items-center gap-2 px-3 py-2 text-sm font-semibold bg-red-500 text-white hover:bg-red-600 rounded-lg transition-colors">
                        <LogoutIcon className="w-5 h-5"/>
                        <span>{t('logout')}</span>
                    </button>
                </div>
            </header>
            
            <div className="text-center w-full max-w-4xl">
                 <DeveloperLogo className="w-64 h-auto mx-auto mb-6" />
                 <div className="mb-6 text-sm text-slate-500 dark:text-slate-400">
                    <p>by Eventhorizon solution</p>
                    <p>0622119357</p>
                 </div>
                 <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-200 mb-8">{t('superAdminPortal')}</h1>
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Management Card */}
                    <div onClick={onGoToDashboard} className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg hover:shadow-2xl hover:scale-105 transition-all cursor-pointer">
                        <SettingsIcon className="w-12 h-12 text-teal-500 mx-auto mb-4" />
                        <h2 className="text-2xl font-bold text-slate-700 dark:text-slate-200">{t('manageAllStores')}</h2>
                        <p className="text-slate-500 dark:text-slate-400 mt-2">{t('manageAllStoresDesc')}</p>
                    </div>

                    {/* Login Card */}
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg">
                        <StoreIcon className="w-12 h-12 text-cyan-500 mx-auto mb-4" />
                        <h2 className="text-2xl font-bold text-slate-700 dark:text-slate-200">{t('loginToStore')}</h2>
                        <p className="text-slate-500 dark:text-slate-400 mt-2">{t('loginToStoreDesc')}</p>
                        <div className="mt-4 pt-4 border-t dark:border-slate-700">
                             <h3 className="font-semibold text-slate-600 dark:text-slate-300 mb-3">{t('selectStoreToLogin')}</h3>
                             <div className="max-h-60 overflow-y-auto space-y-2 pr-2">
                                {stores.length > 0 ? stores.map(store => (
                                    <button 
                                        key={store.id} 
                                        onClick={() => handleStoreLogin(store)}
                                        className="w-full text-left rtl:text-right flex justify-between items-center p-3 bg-gray-50 dark:bg-slate-700/50 hover:bg-teal-50 dark:hover:bg-slate-700 rounded-lg transition-colors"
                                    >
                                        <span className="font-bold text-slate-800 dark:text-slate-200">{store.name}</span>
                                        <span className="text-teal-600 dark:text-teal-400 font-bold flex items-center gap-1 text-sm">{t('loginAsAdmin')} <ArrowRightIcon className="w-4 h-4" /></span>
                                    </button>
                                )) : <p className="text-slate-500 dark:text-slate-400">{t('noStoresAdded')}</p>}
                             </div>
                        </div>
                    </div>
                 </div>
            </div>
        </div>
    );
};

export default SuperAdminLanding;