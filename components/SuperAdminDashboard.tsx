import React, { useState, useMemo, useEffect } from 'react';
import type { Store, User } from '../types';
import { LogoutIcon, PlusIcon, TrashIcon, StoreIcon, UserPlusIcon, SunIcon, MoonIcon, SettingsIcon, ArrowLeftIcon, KeyIcon, SparklesIcon, ArrowRightIcon } from './Icons';
import { Logo } from './Logo';
import { translations } from '../translations';
import * as api from '../api';

type Language = 'fr' | 'ar';
type Theme = 'light' | 'dark';
type TFunction = (key: keyof typeof translations.fr, options?: { [key: string]: string | number }) => string;

interface SuperAdminDashboardProps {
    onLoginAsStoreAdmin: (user: User, store: Store) => void;
    onLogout: () => void;
    onGoBack: () => void;
    t: TFunction;
    language: Language;
    setLanguage: (lang: Language) => void;
    theme: Theme;
    toggleTheme: () => void;
}

const ToggleSwitch: React.FC<{ checked: boolean, onChange: () => void, labelOn: string, labelOff: string, title: string, disabled?: boolean }> = ({ checked, onChange, labelOn, labelOff, title, disabled = false }) => (
    <label className={`inline-flex items-center ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`} title={title}>
        <div className="relative">
            <input type="checkbox" checked={checked} onChange={onChange} className="sr-only peer" disabled={disabled} />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300 dark:peer-focus:ring-teal-800 rounded-full peer dark:bg-slate-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-teal-600"></div>
        </div>
        <span className={`ml-3 text-sm font-medium ${checked ? 'text-green-600 dark:text-green-400' : 'text-slate-500 dark:text-slate-400'}`}>
            {checked ? labelOn : labelOff}
        </span>
    </label>
);


const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({ onLoginAsStoreAdmin, onLogout, onGoBack, t, language, setLanguage, theme, toggleTheme }) => {
    const [stores, setStores] = useState<Store[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    
    const [newStore, setNewStore] = useState({ name: '', adminEmail: '', adminPassword: '', logo: '', trialDurationDays: 7, address: '', ice: '', enableAiReceiptScan: false });
    const [editingCredentials, setEditingCredentials] = useState<{ [userId: string]: string }>({});
    const [newSellerPins, setNewSellerPins] = useState<{ [storeId: string]: string }>({});
    const [lastGeneratedKey, setLastGeneratedKey] = useState<string | null>(null);
    const [lastGeneratedPassword, setLastGeneratedPassword] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [activationModal, setActivationModal] = useState<{ storeName: string; code: string } | null>(null);

    const MASTER_SECRET_KEY = 'GoShop-Activation-Key-Abzn-Secret-2024';
    
    const fetchData = async () => {
        setStores((await api.getAllStores()).sort((a, b) => a.name.localeCompare(b.name)));
        setUsers(await api.getAllUsers());
    };

    useEffect(() => {
        fetchData();
    }, []);
    
    const usersByStore = useMemo(() => {
        const grouped: { [storeId: string]: User[] } = {};
        for (const user of users) {
            if (!grouped[user.storeId]) {
                grouped[user.storeId] = [];
            }
            grouped[user.storeId].push(user);
        }
        return grouped;
    }, [users]);
    
    const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          const reader = new FileReader();
          reader.onloadend = () => {
            setNewStore(prev => ({ ...prev, logo: reader.result as string }));
          };
          reader.readAsDataURL(file);
        }
    };

    const handleAddStore = async (e: React.FormEvent) => {
        e.preventDefault();
        setLastGeneratedKey(null);
        setLastGeneratedPassword(null);
        if (!newStore.name || !newStore.adminPassword) {
            alert(t('fillAllFieldsError'));
            return;
        }

        const adminPassword = newStore.adminPassword;

        try {
            const { licenseKey } = await api.createStoreAndAdmin(newStore.name, newStore.logo, newStore.adminPassword, newStore.adminEmail, newStore.trialDurationDays, newStore.address, newStore.ice, newStore.enableAiReceiptScan);
            setLastGeneratedKey(licenseKey);
            setLastGeneratedPassword(adminPassword);
            setNewStore({ name: '', adminEmail: '', adminPassword: '', logo: '', trialDurationDays: 7, address: '', ice: '', enableAiReceiptScan: false });
            const fileInput = document.getElementById('logo') as HTMLInputElement;
            if(fileInput) fileInput.value = '';
            await fetchData();
        } catch (error: any) {
             alert(t(error.message as keyof typeof translations.fr) || error.message);
        }
    };

    const handleDeleteStore = async (storeId: string, storeName: string) => {
        if (window.confirm(t('deleteStoreConfirm', { storeName }))) {
            try {
                await api.deleteStore(storeId);
                alert(t('storeDeletedSuccess', { storeName }));
                await fetchData();
            } catch (error: any) {
                console.error("Failed to delete store:", error);
                alert(`${t('storeDeleteError')}: ${error.message}`);
            }
        }
    };
    
    const handleCredentialChange = (userId: string, value: string) => {
        setEditingCredentials(prev => ({ ...prev, [userId]: value }));
    };

    const handleSaveCredentials = async (storeId: string) => {
        const usersToUpdate = (usersByStore[storeId] || []).filter(u => editingCredentials[u.id] !== undefined && editingCredentials[u.id].trim() !== '');
        
        for (const user of usersToUpdate) {
             if (user.role === 'seller' && editingCredentials[user.id].length < 4) {
                alert(t('pinMustBe4Chars'));
                return;
            }
        }

        if (usersToUpdate.length === 0) return;
        
        for (const user of usersToUpdate) {
            const updatedUser = { ...user };
            if (user.role === 'admin') {
                updatedUser.password = editingCredentials[user.id];
            } else {
                updatedUser.pin = editingCredentials[user.id];
            }
            await api.updateUser(updatedUser);
        }
        
        setEditingCredentials(prev => {
            const next = {...prev};
            usersToUpdate.forEach(u => delete next[u.id]);
            return next;
        });
        alert(t('pinUpdateSuccess'));
        await fetchData();
    };
    
    const handleAddNewSeller = async (storeId: string) => {
        const pin = newSellerPins[storeId];
        if (!pin || pin.trim() === '' || pin.length < 4) {
            alert(t('pinMustBe4Chars'));
            return;
        }
        
        const sellerCount = (usersByStore[storeId] || []).filter(u => u.role === 'seller').length;
        const newUserName = `${t('seller')} ${sellerCount + 1}`;

        await api.addUser({ name: newUserName, pin, role: 'seller', storeId });
        setNewSellerPins(prev => ({ ...prev, [storeId]: '' }));
        await fetchData();
    };
    
    const handleToggleStoreStatus = async (store: Store) => {
        // If we are about to activate a store
        if (!store.isActive) {
            let trialExpired = false;
            if (store.trialStartDate) {
                const trialStart = new Date(store.trialStartDate);
                const expiryDate = new Date(trialStart);
                expiryDate.setDate(trialStart.getDate() + (store.trialDurationDays ?? 7));
                if (new Date() > expiryDate) {
                    trialExpired = true;
                }
            }

            // If the trial was expired, activating it grants a full license by removing the trial date.
            if (trialExpired) {
                 if (window.confirm(t('confirmPermanentActivation', { storeName: store.name }))) {
                    await api.updateStore({ ...store, isActive: true, trialStartDate: null });
                 } else {
                     return; // Do nothing if user cancels
                 }
            } else {
                // Otherwise, just activate it normally.
                await api.updateStore({ ...store, isActive: true });
            }
        } else {
            // Deactivating is always a simple toggle.
            await api.updateStore({ ...store, isActive: false });
        }
        
        await fetchData();
    };
    
    const handleToggleAiScan = async (store: Store) => {
        await api.updateStore({ ...store, enableAiReceiptScan: !store.enableAiReceiptScan });
        await fetchData();
    };

    const handleGenerateCode = (store: Store) => {
        const code = `PERM-${btoa(`${store.id}::${MASTER_SECRET_KEY}`)}`;
        setActivationModal({ storeName: store.name, code });
    };

    const handleCopyCode = () => {
        if (!activationModal) return;
        navigator.clipboard.writeText(activationModal.code);
        setCopied(true);
        setTimeout(() => {
            setCopied(false)
        }, 2000);
    };
    
    const handleCopyKey = () => {
        if (!lastGeneratedKey) return;
        navigator.clipboard.writeText(lastGeneratedKey);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const getTrialStatus = (store: Store) => {
        if (!store.licenseProof) {
            return <span className="text-xs font-bold px-2 py-1 rounded-full bg-orange-200 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300">{t('storeStatus_notActivated')}</span>;
        }
        
        if (store.trialStartDate) {
            const trialStart = new Date(store.trialStartDate);
            const expiryDate = new Date(trialStart);
            expiryDate.setDate(trialStart.getDate() + (store.trialDurationDays ?? 7));
            const remainingTime = expiryDate.getTime() - new Date().getTime();
            
            if (remainingTime > 0) {
                const remainingDays = Math.ceil(remainingTime / (1000 * 60 * 60 * 24));
                return <span className="text-xs font-bold px-2 py-1 rounded-full bg-yellow-200 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300">{t('trialDaysRemaining', { days: remainingDays })}</span>;
            } else {
                return <span className="text-xs font-bold px-2 py-1 rounded-full bg-red-200 text-red-800 dark:bg-red-900/50 dark:text-red-300">{t('trialEnded')}</span>;
            }
        }
        
        // trialStartDate is null, which means it's fully activated
        return <span className="text-xs font-bold px-2 py-1 rounded-full bg-green-200 text-green-800 dark:bg-green-900/50 dark:text-green-300">{t('storeStatus_licensed')}</span>;
    };
    
    const handleStoreLogin = async (store: Store) => {
        try {
            const admin = await api.getAdminUserForStore(store.id);
            if (admin) {
                onLoginAsStoreAdmin(admin, store);
            } else {
                alert(t('noAdminForStore'));
            }
        } catch (error: any) {
            console.error("Failed to login as admin:", error);
            alert(`${t('unknownError')}: ${error.message}`);
        }
    };

    const handleLoginToNewStore = () => {
        if (lastGeneratedKey) {
            const newStoreObject = stores.find(s => s.licenseKey === lastGeneratedKey);
            if (newStoreObject) {
                handleStoreLogin(newStoreObject);
            } else {
                alert("Store data not ready. Please wait a moment and try logging in from the main list.");
            }
        }
    };


    return (
        <div className="bg-gray-100 dark:bg-slate-900 min-h-screen">
            {activationModal && (
                <div className="fixed inset-0 bg-slate-800 bg-opacity-75 flex justify-center items-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl max-w-lg w-full p-6 text-center">
                        <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200 mb-2">{t('activationCodeForStore', { storeName: activationModal.storeName })}</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{t('copyAndSendToClient')}</p>
                        <div className="p-4 bg-slate-100 dark:bg-slate-700 rounded-lg flex items-center justify-between gap-4">
                            <p className="font-mono text-lg break-all text-slate-800 dark:text-slate-100">{activationModal.code}</p>
                            <button onClick={handleCopyCode} className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 px-3 rounded-lg text-sm shrink-0">
                                {copied ? t('copied') : t('copy')}
                            </button>
                        </div>
                        <button onClick={() => setActivationModal(null)} className="mt-6 bg-gray-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold py-2 px-4 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-500">
                            {t('close')}
                        </button>
                    </div>
                </div>
            )}
             <header className="bg-white dark:bg-slate-800 text-white p-4 shadow-lg sticky top-0 z-40">
                <div className="container mx-auto flex justify-between items-center">
                    <button onClick={onGoBack} className="flex items-center gap-2 px-3 py-2 text-sm font-semibold bg-gray-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200 hover:bg-gray-300 dark:hover:bg-slate-600 rounded-lg transition-colors">
                        <ArrowLeftIcon className="w-5 h-5"/>
                        <span>{t('backToPortal')}</span>
                    </button>
                    <h1 className="text-xl md:text-2xl font-bold text-slate-800 dark:text-slate-100">{t('superAdminDashboard')}</h1>
                    <div className="flex items-center gap-3">
                       <button onClick={toggleTheme} title="Toggle theme" className="p-2 bg-gray-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200 hover:bg-gray-300 dark:hover:bg-slate-600 rounded-lg transition-colors">
                          {theme === 'light' ? <MoonIcon className="w-5 h-5"/> : <SunIcon className="w-5 h-5" />}
                       </button>
                        <button onClick={() => setLanguage(language === 'fr' ? 'ar' : 'fr')} className="px-3 py-2 text-sm font-bold bg-gray-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200 hover:bg-gray-300 dark:hover:bg-slate-600 rounded-lg transition-colors">
                            {language === 'fr' ? 'AR' : 'FR'}
                        </button>
                       <button onClick={onLogout} title={t('logout')} className="flex items-center gap-2 px-3 py-2 text-sm font-semibold bg-red-500 hover:bg-red-600 rounded-lg transition-colors">
                          <LogoutIcon className="w-5 h-5"/>
                          <span className="hidden md:inline">{t('logout')}</span>
                       </button>
                    </div>
                </div>
            </header>
            
            <main className="container mx-auto p-4 sm:p-6 space-y-8">
                 {/* Add New Store Section */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg">
                    <h2 className="text-2xl font-bold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2"><StoreIcon/>{t('addStore')}</h2>
                    <form onSubmit={handleAddStore} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div className="flex flex-col items-center justify-center p-2 border-2 border-dashed rounded-lg dark:border-slate-600 row-span-2">
                                <Logo url={newStore.logo} className="w-32 h-32 object-cover rounded-lg mb-4 bg-gray-200 dark:bg-slate-700" />
                                <label htmlFor="logo" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('storeLogo')}</label>
                                <input type="file" id="logo" accept="image/*" onChange={handleLogoChange} className="text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 dark:file:bg-teal-900/50 dark:file:text-teal-300 dark:hover:file:bg-teal-900" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('storeName')}</label>
                                <input type="text" value={newStore.name} onChange={e => setNewStore({...newStore, name: e.target.value})} className="w-full p-2 border rounded-lg bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-slate-100 dark:border-slate-600" required />
                            </div>
                             <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('adminPassword')}</label>
                                <input type="password" value={newStore.adminPassword} onChange={e => setNewStore({...newStore, adminPassword: e.target.value})} className="w-full p-2 border rounded-lg bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-slate-100 dark:border-slate-600" required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('adminEmail')}</label>
                                <input type="email" value={newStore.adminEmail} onChange={e => setNewStore({...newStore, adminEmail: e.target.value})} className="w-full p-2 border rounded-lg bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-slate-100 dark:border-slate-600" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('trialPeriodDays')}</label>
                                <input type="number" min="0" value={newStore.trialDurationDays} onChange={e => setNewStore({...newStore, trialDurationDays: parseInt(e.target.value, 10) || 0})} className="w-full p-2 border rounded-lg bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-slate-100 dark:border-slate-600" required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('address')} ({t('optional')})</label>
                                <input type="text" value={newStore.address} onChange={e => setNewStore({...newStore, address: e.target.value})} className="w-full p-2 border rounded-lg bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-slate-100 dark:border-slate-600" />
                            </div>
                             <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('ice')} ({t('optional')})</label>
                                <input type="text" value={newStore.ice} onChange={e => setNewStore({...newStore, ice: e.target.value})} className="w-full p-2 border rounded-lg bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-slate-100 dark:border-slate-600" />
                            </div>
                             <div className="lg:col-span-3 flex items-center gap-4 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                                 <SparklesIcon className="w-8 h-8 text-purple-500 dark:text-purple-400" />
                                 <div>
                                    <h4 className="font-bold text-slate-700 dark:text-slate-200">{t('enableAiScan')}</h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">{t('aiScanFeatureDescription')}</p>
                                 </div>
                                <div className="ml-auto rtl:ml-0 rtl:mr-auto">
                                    <ToggleSwitch
                                        checked={newStore.enableAiReceiptScan}
                                        onChange={() => setNewStore(prev => ({...prev, enableAiReceiptScan: !prev.enableAiReceiptScan}))}
                                        labelOn={t('aiScanEnabled')}
                                        labelOff={t('aiScanDisabled')}
                                        title={t('enableAiScan')}
                                    />
                                </div>
                            </div>
                        </div>

                        <button type="submit" className="w-full md:w-auto bg-teal-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-teal-700 transition-colors flex items-center justify-center gap-2"><PlusIcon/>{t('addStoreButton')}</button>
                    </form>
                    {lastGeneratedKey && lastGeneratedPassword && (
                        <div className="mt-4 p-4 bg-green-100 dark:bg-green-900/50 rounded-lg text-green-800 dark:text-green-300">
                            <h3 className="font-bold">{t('storeCreatedSuccess')}</h3>
                            <div className="mt-2 space-y-4 text-sm">
                                <p><strong>{t('storeName')}:</strong> {stores.find(s => s.licenseKey === lastGeneratedKey)?.name}</p>
                                
                                <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded border border-yellow-300 dark:border-yellow-700">
                                    <p className="font-semibold">{t('adminPassword')}:</p>
                                    <p className="font-mono text-xl my-1">{lastGeneratedPassword}</p>
                                    <p className="text-xs">{t('useThisPasswordAfter')}</p>
                                </div>

                                <div>
                                    <p className="font-semibold mt-2">{t('licenseKey')}:</p>
                                    <p className="text-xs mb-1">{t('useThisToLoginFirst')}</p>
                                    <div className="flex items-center gap-4 p-3 bg-white dark:bg-slate-700 rounded-md">
                                        <p className="font-mono text-lg break-all flex-grow">{lastGeneratedKey}</p>
                                        <button onClick={handleCopyKey} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-3 rounded-lg text-sm">{copied ? t('copied') : t('copy')}</button>
                                    </div>
                                </div>
                            </div>
                             <button
                                onClick={handleLoginToNewStore}
                                className="mt-4 w-full bg-cyan-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-cyan-700 transition-colors flex items-center justify-center gap-2"
                            >
                                <ArrowRightIcon className="w-5 h-5" />
                                {t('loginAsAdmin')}
                            </button>
                        </div>
                    )}
                </div>

                {/* Manage Stores Section */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg">
                    <h2 className="text-2xl font-bold text-slate-700 dark:text-slate-200 mb-4">{t('manageStores')}</h2>
                    <div className="space-y-6">
                        {stores.length > 0 ? stores.map(store => {
                             const storeUsers = usersByStore[store.id] || [];
                             const adminUser = storeUsers.find(u => u.role === 'admin');
                             const sellers = storeUsers.filter(u => u.role === 'seller');
                            return (
                                <div key={store.id} className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl shadow-md border-l-4 dark:border-l-4 border-teal-500">
                                    <div className="flex justify-between items-start flex-wrap gap-4 mb-4">
                                        <div className="flex items-center gap-4">
                                            <Logo url={store.logo} className="w-16 h-16 rounded-lg bg-white object-cover" />
                                            <div>
                                                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">{store.name}</h3>
                                                <p className="text-sm font-mono text-slate-500 dark:text-slate-400">{t('licenseKey')}: {store.licenseKey}</p>
                                                <p className="text-sm text-slate-500 dark:text-slate-400">{t('trialDurationDisplay', { days: store.trialDurationDays })}</p>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-3">
                                            <div className="flex items-center gap-4">
                                                <ToggleSwitch
                                                    checked={store.isActive}
                                                    onChange={() => handleToggleStoreStatus(store)}
                                                    labelOn={t('storeStatus_active')}
                                                    labelOff={t('storeStatus_inactive')}
                                                    title={t('toggleStoreStatus')}
                                                />
                                                <button onClick={() => handleDeleteStore(store.id, store.name)} className="text-red-500 hover:text-red-700 p-2 rounded-full hover:bg-red-100 dark:hover:bg-red-900/50" title={t('deleteStore')}><TrashIcon/></button>
                                            </div>
                                            {getTrialStatus(store)}
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-4 pt-4 border-t-2 border-dashed dark:border-slate-700">
                                        <div className="flex items-center justify-between gap-4 p-3 bg-slate-100 dark:bg-slate-700/50 rounded-lg">
                                            <div className="flex items-center gap-2">
                                                <SparklesIcon className="w-5 h-5 text-purple-500" />
                                                <h4 className="font-bold text-slate-600 dark:text-slate-300">{t('enableAiScan')}</h4>
                                            </div>
                                             <ToggleSwitch
                                                checked={store.enableAiReceiptScan || false}
                                                onChange={() => handleToggleAiScan(store)}
                                                labelOn={t('aiScanEnabled')}
                                                labelOff={t('aiScanDisabled')}
                                                title={t('enableAiScan')}
                                            />
                                        </div>
                                        <h4 className="font-bold text-slate-600 dark:text-slate-300">{t('storeUsersAndPins')}</h4>
                                        <div className="space-y-3">
                                            {adminUser && (
                                                <div className="flex items-center gap-3">
                                                    <span className="font-semibold w-24">{t('admin')} ({adminUser.name})</span>
                                                    <input 
                                                        type="password" 
                                                        placeholder={t('newPassword')}
                                                        defaultValue=""
                                                        onChange={(e) => handleCredentialChange(adminUser.id, e.target.value)}
                                                        className="w-full md:w-48 p-2 border rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 dark:border-slate-600" />
                                                </div>
                                            )}
                                            {sellers.map(seller => (
                                                <div key={seller.id} className="flex items-center gap-3">
                                                    <span className="font-semibold w-24">{seller.name}</span>
                                                    <input 
                                                        type="password" 
                                                        placeholder={t('newPin')}
                                                        defaultValue=""
                                                        onChange={(e) => handleCredentialChange(seller.id, e.target.value)}
                                                        className="w-full md:w-48 p-2 border rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 dark:border-slate-600" />
                                                </div>
                                            ))}
                                        </div>
                                        <div className="flex justify-between items-center flex-wrap gap-4 mt-4">
                                            <button onClick={() => handleSaveCredentials(store.id)} className="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors text-sm">{t('saveChanges')}</button>
                                            <div className="flex items-center gap-2">
                                                <input
                                                  type="password"
                                                  placeholder={t('newSellerPinPlaceholder')}
                                                  value={newSellerPins[store.id] || ''}
                                                  onChange={(e) => setNewSellerPins(prev => ({...prev, [store.id]: e.target.value}))}
                                                  className="p-2 border rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 dark:border-slate-600 text-sm w-48"
                                                />
                                                <button onClick={() => handleAddNewSeller(store.id)} className="bg-teal-600 text-white font-bold py-2 px-3 rounded-lg hover:bg-teal-700 transition-colors flex items-center justify-center text-sm"><UserPlusIcon className="w-4 h-4 mr-1 rtl:ml-1 rtl:mr-0"/>{t('add')}</button>
                                            </div>
                                        </div>

                                        <div className="p-4 bg-slate-100 dark:bg-slate-700/50 rounded-lg mt-4">
                                            <h4 className="font-bold text-slate-600 dark:text-slate-300 mb-2 flex items-center gap-2"><SettingsIcon className="w-5 h-5" />{t('permanentActivation')}</h4>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">{t('permanentActivationDesc')}</p>
                                            <button 
                                                onClick={() => handleGenerateCode(store)}
                                                disabled={!store.licenseProof || !store.trialStartDate}
                                                className="bg-green-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-green-700 disabled:bg-gray-400 dark:disabled:bg-slate-600 transition-colors flex items-center gap-2 text-sm"
                                            >
                                                <KeyIcon className="w-4 h-4" />
                                                {t('generateActivationCode')}
                                            </button>
                                        </div>

                                    </div>
                                </div>
                            )
                        }) : <p className="text-center text-slate-500 dark:text-slate-400 py-8">{t('noStoresAdded')}</p>}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default SuperAdminDashboard;