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
    const [activateImmediately, setActivateImmediately] = useState(true);
    const [editingCredentials, setEditingCredentials] = useState<{ [userId: string]: string }>({});
    const [newSellerPins, setNewSellerPins] = useState<{ [storeId: string]: string }>({});
    const [lastGeneratedKey, setLastGeneratedKey] = useState<string | null>(null);
    const [lastGeneratedPassword, setLastGeneratedPassword] = useState<string | null>(null);
    const [copiedIdentifier, setCopiedIdentifier] = useState<string | null>(null);
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
        const trialDays = newStore.trialDurationDays || 0;

        try {
            const { licenseKey } = await api.createStoreAndAdmin(newStore.name, newStore.logo, newStore.adminPassword, newStore.adminEmail, trialDays, newStore.address, newStore.ice, newStore.enableAiReceiptScan);
            
            if (activateImmediately) {
                const newStoreObject = await api.getStoreByLicenseKey(licenseKey);
                if (newStoreObject) {
                    const updatePayload: Partial<Store> = {
                        isActive: true,
                        licenseProof: new Date().toISOString(),
                        // If trial days is 0, grant a permanent license by setting trialStartDate to null
                        trialStartDate: trialDays > 0 ? new Date().toISOString() : null,
                    };
                    await api.updateStore({
                        ...newStoreObject,
                        ...updatePayload
                    });
                }
            }
            
            setLastGeneratedKey(licenseKey);
            setLastGeneratedPassword(adminPassword);
            setNewStore({ name: '', adminEmail: '', adminPassword: '', logo: '', trialDurationDays: 7, address: '', ice: '', enableAiReceiptScan: false });
            setActivateImmediately(true);
            const fileInput = document.getElementById('logo') as HTMLInputElement;
            if(fileInput) fileInput.value = '';
            await fetchData();
        } catch (error: any) {
             if (error instanceof TypeError && error.message === 'Failed to fetch') {
                alert(t('failedToFetchError_CORS'));
            } else {
                alert(t(error.message as keyof typeof translations.fr) || error.message);
            }
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
        setNewSellerPins(prev => ({...prev, [storeId]: ''}));
        alert(t('userAddedSuccess', {name: newUserName}));
        await fetchData();
    };

    const generateActivationCode = (store: Store) => {
        const trialStart = store.trialStartDate ? new Date(store.trialStartDate) : new Date();
        const expiryDate = new Date(trialStart);
        expiryDate.setDate(trialStart.getDate() + (store.trialDurationDays ?? 7));
        
        if(new Date() < expiryDate && store.trialStartDate !== null) {
            if(!window.confirm(t('confirmPermanentActivation', { storeName: store.name }))) {
                return;
            }
        }
        
        const code = `PERM-${btoa(`${store.id}::${MASTER_SECRET_KEY}`)}`;
        setActivationModal({ storeName: store.name, code });
    };

    const copyToClipboard = (text: string, identifier: string) => {
        navigator.clipboard.writeText(text);
        setCopiedIdentifier(identifier);
        setTimeout(() => setCopiedIdentifier(null), 2000);
    };

    const handleToggleStoreStatus = async (store: Store) => {
        try {
            const updatedStore = { ...store, isActive: !store.isActive };
            await api.updateStore(updatedStore);
            setStores(prev => prev.map(s => s.id === store.id ? updatedStore : s));
        } catch (error: any) {
            alert(`Error updating store status: ${error.message}`);
        }
    };
    
    const handleToggleAiScan = async (store: Store) => {
        try {
            const updatedStore = { ...store, enableAiReceiptScan: !store.enableAiReceiptScan };
            await api.updateStore(updatedStore);
            setStores(prev => prev.map(s => s.id === store.id ? updatedStore : s));
        } catch (error: any) {
            alert(`Error updating AI Scan status: ${error.message}`);
        }
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

  return (
    <>
    {activationModal && (
        <div className="fixed inset-0 bg-slate-800 bg-opacity-75 flex justify-center items-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl max-w-md w-full p-6 text-center">
                <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200 mb-2">{t('activationCodeForStore', { storeName: activationModal.storeName })}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{t('copyAndSendToClient')}</p>
                <div className="p-3 bg-gray-100 dark:bg-slate-700 rounded-lg font-mono text-lg break-all mb-4">
                    {activationModal.code}
                </div>
                 <button onClick={() => { copyToClipboard(activationModal.code, `code-${activationModal.storeName}`); }} className="bg-teal-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-teal-700 w-full mb-3">
                    {copiedIdentifier === `code-${activationModal.storeName}` ? t('copied') : t('copy')}
                </button>
                <button onClick={() => setActivationModal(null)} className="bg-gray-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold py-2 px-4 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-500 w-full">
                    {t('close')}
                </button>
            </div>
        </div>
    )}
    <div className="min-h-screen bg-gray-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 p-4 sm:p-6 lg:p-8">
        <header className="mb-8">
            <div className="container mx-auto flex justify-between items-center">
                <button onClick={onGoBack} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-lg transition-colors border dark:border-slate-700">
                    <ArrowLeftIcon className="w-5 h-5"/> {t('backToPortal')}
                </button>
                <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-200 hidden md:block">{t('superAdminDashboard')}</h1>
                <div className="flex items-center gap-3">
                    <button onClick={toggleTheme} title="Toggle theme" className="p-2 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
                        {theme === 'light' ? <MoonIcon className="w-5 h-5"/> : <SunIcon className="w-5 h-5" />}
                    </button>
                    <button onClick={() => setLanguage(language === 'fr' ? 'ar' : 'fr')} className="px-4 py-2 text-sm font-bold bg-white dark:bg-slate-800 text-teal-600 dark:text-teal-300 border border-gray-300 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
                       {language === 'fr' ? 'العربية' : 'Français'}
                   </button>
                   <button onClick={onLogout} className="flex items-center gap-2 px-3 py-2 text-sm font-semibold bg-red-500 text-white hover:bg-red-600 rounded-lg transition-colors">
                        <LogoutIcon className="w-5 h-5"/>
                        <span className="hidden sm:inline">{t('logout')}</span>
                    </button>
                </div>
            </div>
        </header>

        <div className="container mx-auto space-y-8">
             <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg">
                <h2 className="text-2xl font-bold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2"><StoreIcon />{t('addStore')}</h2>
                <form onSubmit={handleAddStore} className="space-y-4">
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div>
                           <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">{t('storeName')}</label>
                           <input type="text" value={newStore.name} onChange={e => setNewStore(p => ({...p, name: e.target.value}))} className="w-full px-4 py-2 border rounded-lg bg-gray-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 dark:border-slate-600" required/>
                        </div>
                         <div>
                           <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">{t('adminPassword')}</label>
                           <input type="text" value={newStore.adminPassword} onChange={e => setNewStore(p => ({...p, adminPassword: e.target.value}))} className="w-full px-4 py-2 border rounded-lg bg-gray-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 dark:border-slate-600" required/>
                        </div>
                        <div>
                           <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">{t('adminEmail')}</label>
                           <input type="email" value={newStore.adminEmail} onChange={e => setNewStore(p => ({...p, adminEmail: e.target.value}))} className="w-full px-4 py-2 border rounded-lg bg-gray-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 dark:border-slate-600" />
                        </div>
                        <div>
                           <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">{t('address')}</label>
                           <input type="text" value={newStore.address} onChange={e => setNewStore(p => ({...p, address: e.target.value}))} className="w-full px-4 py-2 border rounded-lg bg-gray-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 dark:border-slate-600" />
                        </div>
                         <div>
                           <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">{t('ice')}</label>
                           <input type="text" value={newStore.ice} onChange={e => setNewStore(p => ({...p, ice: e.target.value}))} className="w-full px-4 py-2 border rounded-lg bg-gray-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 dark:border-slate-600" />
                        </div>
                        <div>
                           <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">{t('trialPeriodDays')}</label>
                           <input type="number" value={newStore.trialDurationDays} onChange={e => setNewStore(p => ({...p, trialDurationDays: parseInt(e.target.value, 10)}))} min="0" className="w-full px-4 py-2 border rounded-lg bg-gray-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 dark:border-slate-600" required/>
                        </div>
                     </div>
                     <div className="flex items-center gap-4">
                        <label className="block text-sm font-medium text-slate-600 dark:text-slate-300">{t('storeLogoLabel')}</label>
                        <Logo url={newStore.logo} className="w-12 h-12 rounded-lg bg-gray-200 object-cover" />
                        <input type="file" id="logo" accept="image/*" onChange={handleLogoChange} className="text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 dark:file:bg-teal-900/50 dark:file:text-teal-300 dark:hover:file:bg-teal-900"/>
                    </div>
                    <div className="flex flex-wrap gap-6 pt-4">
                        <ToggleSwitch checked={activateImmediately} onChange={() => setActivateImmediately(!activateImmediately)} labelOn={t('activeOnCreation')} labelOff={t('inactiveOnCreation')} title={t('activateImmediatelyDesc')} />
                        <ToggleSwitch checked={newStore.enableAiReceiptScan} onChange={() => setNewStore(p => ({...p, enableAiReceiptScan: !p.enableAiReceiptScan}))} labelOn={t('aiScanEnabled')} labelOff={t('aiScanDisabled')} title={t('aiScanFeatureDescription')} />
                    </div>
                     <button type="submit" className="w-full md:w-auto bg-teal-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-teal-700 flex items-center justify-center gap-2">
                        <PlusIcon /> {t('addStoreButton')}
                    </button>
                </form>
             </div>

             {lastGeneratedKey && (
                <div className="bg-green-100 dark:bg-green-900/50 p-4 rounded-xl shadow-lg border border-green-300 dark:border-green-700">
                    <h3 className="text-xl font-bold text-green-800 dark:text-green-300 mb-2">{t('storeCreatedSuccess')}</h3>
                    <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-700 dark:text-slate-300">{t('licenseKey')}:</span>
                            <span className="font-mono bg-white dark:bg-slate-700 p-1 rounded">{lastGeneratedKey}</span>
                            <button onClick={() => copyToClipboard(lastGeneratedKey, 'key')} className="text-xs bg-gray-200 dark:bg-slate-600 p-1 rounded">{copiedIdentifier === 'key' ? t('copied') : t('copy')}</button>
                        </div>
                         <p className="text-xs text-slate-500 dark:text-slate-400">{t('useThisToLoginFirst')}</p>
                    </div>
                    {lastGeneratedPassword && (
                        <div className="space-y-2 text-sm mt-3 pt-3 border-t border-green-200 dark:border-green-800">
                            <div className="flex items-center gap-2">
                                <span className="font-semibold text-slate-700 dark:text-slate-300">{t('adminPassword')}:</span>
                                <span className="font-mono bg-white dark:bg-slate-700 p-1 rounded">{lastGeneratedPassword}</span>
                                <button onClick={() => copyToClipboard(lastGeneratedPassword, 'pw')} className="text-xs bg-gray-200 dark:bg-slate-600 p-1 rounded">{copiedIdentifier === 'pw' ? t('copied') : t('copy')}</button>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{t('useThisPasswordAfter')}</p>
                        </div>
                    )}
                </div>
             )}

            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg">
                <h2 className="text-2xl font-bold text-slate-700 dark:text-slate-200 mb-4">{t('manageStores')}</h2>
                <div className="space-y-6">
                    {stores.length > 0 ? stores.map(store => {
                        const storeUsers = usersByStore[store.id] || [];
                        const admin = storeUsers.find(u => u.role === 'admin');
                        const sellers = storeUsers.filter(u => u.role === 'seller');
                        
                        let statusText = t('storeStatus_notActivated');
                        let statusColor = 'bg-gray-200 text-gray-800';
                        if(store.isActive) {
                             if(store.trialStartDate) {
                                const trialStart = new Date(store.trialStartDate);
                                const expiryDate = new Date(trialStart);
                                expiryDate.setDate(trialStart.getDate() + (store.trialDurationDays ?? 7));
                                const remainingTime = expiryDate.getTime() - new Date().getTime();
                                if(remainingTime > 0) {
                                    const remainingDays = Math.ceil(remainingTime / (1000 * 60 * 60 * 24));
                                    statusText = t('trialDaysRemaining', {days: remainingDays});
                                    statusColor = 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-300';
                                } else {
                                     statusText = t('trialEnded');
                                     statusColor = 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300';
                                }
                             } else {
                                statusText = t('storeStatus_licensed');
                                statusColor = 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300';
                             }
                        }

                        return (
                             <details key={store.id} className="p-4 border dark:border-slate-700 rounded-lg">
                                <summary className="cursor-pointer flex justify-between items-center font-semibold text-slate-800 dark:text-slate-200">
                                    <div className="flex items-center gap-3">
                                        <Logo url={store.logo} className="w-10 h-10 rounded-lg bg-gray-200 object-cover" />
                                        <span className="font-bold text-lg">{store.name}</span>
                                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${statusColor}`}>{statusText}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button onClick={(e) => { e.preventDefault(); handleStoreLogin(store); }} className="text-sm bg-teal-600 text-white px-3 py-1 rounded-md hover:bg-teal-700">{t('loginAsAdmin')}</button>
                                        <button onClick={(e) => { e.preventDefault(); handleDeleteStore(store.id, store.name); }} className="text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-100 dark:hover:bg-red-900/50" title={t('deleteStore')}>
                                            <TrashIcon className="w-5 h-5"/>
                                        </button>
                                    </div>
                                </summary>

                                <div className="mt-4 pt-4 border-t dark:border-slate-700 space-y-4">
                                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                        <div className="space-y-2">
                                            <p><strong>{t('licenseKey')}:</strong> <span className="font-mono bg-gray-100 dark:bg-slate-700 p-1 rounded">{store.licenseKey}</span></p>
                                            <p><strong>{t('address')}:</strong> {store.address || 'N/A'}</p>
                                            <p><strong>{t('ice')}:</strong> {store.ice || 'N/A'}</p>
                                            <p><strong>{t('trialPeriodDays')}:</strong> {t('trialDurationDisplay', {days: store.trialDurationDays})}</p>
                                        </div>
                                         <div className="space-y-3">
                                            <ToggleSwitch checked={store.isActive} onChange={() => handleToggleStoreStatus(store)} labelOn={t('storeStatus_active')} labelOff={t('storeStatus_inactive')} title={t('toggleStoreStatus')} />
                                            <ToggleSwitch checked={store.enableAiReceiptScan || false} onChange={() => handleToggleAiScan(store)} labelOn={t('aiScanEnabled')} labelOff={t('aiScanDisabled')} title={t('aiScanFeatureDescription')} />
                                         </div>
                                     </div>
                                    
                                     {/* Users */}
                                     <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                                        <h4 className="font-bold text-slate-600 dark:text-slate-300 mb-3">{t('storeUsersAndPins')}</h4>
                                         <div className="space-y-3">
                                            {admin && (
                                                <div className="flex items-center justify-between">
                                                    <span className="font-semibold">{admin.name} ({t('admin')})</span>
                                                    <input type="text" placeholder={t('newPassword')} onChange={e => handleCredentialChange(admin.id, e.target.value)} className="w-40 text-sm p-1 border rounded bg-white dark:bg-slate-600 dark:border-slate-500" />
                                                </div>
                                            )}
                                            {sellers.map(seller => (
                                                 <div key={seller.id} className="flex items-center justify-between">
                                                    <span className="font-semibold">{seller.name}</span>
                                                    <input type="text" placeholder={t('newPin')} onChange={e => handleCredentialChange(seller.id, e.target.value)} className="w-40 text-sm p-1 border rounded bg-white dark:bg-slate-600 dark:border-slate-500" />
                                                </div>
                                            ))}
                                             <button onClick={() => handleSaveCredentials(store.id)} className="text-xs bg-blue-600 text-white font-semibold py-1 px-3 rounded-md hover:bg-blue-700">{t('saveChanges')}</button>
                                         </div>
                                         <div className="mt-4 pt-4 border-t dark:border-slate-600 flex items-center gap-2">
                                            <input type="text" value={newSellerPins[store.id] || ''} onChange={e => setNewSellerPins(p => ({...p, [store.id]: e.target.value}))} placeholder={t('newSellerPinPlaceholder')} className="flex-grow text-sm p-1 border rounded bg-white dark:bg-slate-600 dark:border-slate-500" />
                                            <button onClick={() => handleAddNewSeller(store.id)} className="text-xs bg-green-600 text-white font-semibold py-1 px-3 rounded-md hover:bg-green-700 flex items-center gap-1"><UserPlusIcon className="w-4 h-4"/> {t('addSeller')}</button>
                                         </div>
                                     </div>
                                     
                                     {/* Activation */}
                                     <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                                        <h4 className="font-bold text-slate-600 dark:text-slate-300 mb-2">{t('permanentActivation')}</h4>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">{t('permanentActivationDesc')}</p>
                                        <button onClick={() => generateActivationCode(store)} className="text-sm bg-orange-500 text-white font-semibold py-2 px-4 rounded-md hover:bg-orange-600 flex items-center gap-2">
                                            <KeyIcon className="w-4 h-4"/> {t('generateActivationCode')}
                                        </button>
                                     </div>
                                </div>
                            </details>
                        )
                    }) : <p className="text-center text-slate-500 dark:text-slate-400 py-8">{t('noStoresAdded')}</p>}
                </div>
            </div>
        </div>
    </div>
    </>
  );
};

export default SuperAdminDashboard;