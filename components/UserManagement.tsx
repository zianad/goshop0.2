
import React, { useState, useRef } from 'react';
import type { User, Store } from '../types';
import { SettingsIcon, UserPlusIcon, TrashIcon, KeyIcon, UploadIcon, DatabaseZapIcon } from './Icons';
import { translations } from '../translations';
import { getDatabaseContents, restoreDatabase } from '../api';

type TFunction = (key: keyof typeof translations.fr, options?: { [key: string]: string | number }) => string;

interface UserManagementProps {
  activeUser: User;
  store: Store;
  storeId: string;
  users: User[];
  addUser: (user: Omit<User, 'id'>) => Promise<User | undefined>;
  updateUser: (user: User) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  onUpdateStore: (updatedStoreData: Partial<Store>) => Promise<void>;
  t: TFunction;
}

const UserManagement: React.FC<UserManagementProps> = ({ activeUser, store, storeId, users, addUser, updateUser, deleteUser, onUpdateStore, t }) => {
  // User management state
  const [newUser, setNewUser] = useState({ name: '', pin: '', role: 'seller' as 'seller' | 'admin' });
  const [editingPins, setEditingPins] = useState<{ [key: string]: string }>({});
  
  // Store settings state
  const [storeDetails, setStoreDetails] = useState({
    name: store.name,
    address: store.address || '',
    ice: store.ice || '',
    logo: store.logo || ''
  });
  const [logoPreview, setLogoPreview] = useState<string | null>(store.logo || null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Admin password change state
  const [passwordChange, setPasswordChange] = useState({ current: '', new: '', confirm: '' });

  // Feedback state
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error', message: string, section: 'users' | 'store' | 'password' | 'backup' } | null>(null);
  
  const restoreFileInputRef = useRef<HTMLInputElement>(null);
  const [restoreText, setRestoreText] = useState('');

  const showFeedback = (type: 'success' | 'error', message: string, section: 'users' | 'store' | 'password' | 'backup') => {
    setFeedback({ type, message, section });
    setTimeout(() => setFeedback(null), 5000);
  };

  // User management handlers
  const handleUserInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { id, value } = e.target;
    setNewUser(prev => ({ ...prev, [id]: value }));
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.name || !newUser.pin) {
      showFeedback('error', t('fillAllFields'), 'users');
      return;
    }
    if (newUser.pin.length < 4) {
      showFeedback('error', t('pinMin4Digits'), 'users');
      return;
    }
    if (users.some(u => u.name.toLowerCase() === newUser.name.trim().toLowerCase())) {
        showFeedback('error', t('userExistsError', { name: newUser.name.trim() }), 'users');
        return;
    }

    await addUser({ ...newUser, storeId });
    setNewUser({ name: '', pin: '', role: 'seller' });
    showFeedback('success', t('userAddedSuccess', { name: newUser.name }), 'users');
  };
  
  const handlePinChange = (userId: string, pin: string) => {
    setEditingPins(prev => ({...prev, [userId]: pin}));
  };

  const handleUpdateUserPin = async (user: User) => {
    const newPin = editingPins[user.id];
    if (!newPin || newPin.length < 4) {
      showFeedback('error', t('pinMin4Digits'), 'users');
      return;
    }
    await updateUser({ ...user, pin: newPin });
    setEditingPins(prev => {
        const next = {...prev};
        delete next[user.id];
        return next;
    });
    showFeedback('success', t('pinUpdatedForUser', { name: user.name }), 'users');
  };

  const handleDeleteUser = async (user: User) => {
    if (user.role === 'admin') {
      showFeedback('error', t('cannotDeleteAdmin'), 'users');
      return;
    }
    if (window.confirm(t('confirmUserDelete', { name: user.name }))) {
      await deleteUser(user.id);
    }
  };

  // Store settings handlers
  const handleStoreInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setStoreDetails(prev => ({...prev, [id]: value}));
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setStoreDetails(prev => ({...prev, logo: result}));
        setLogoPreview(result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveStore = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
        await onUpdateStore(storeDetails);
        showFeedback('success', t('storeUpdateSuccess'), 'store');
    } catch(e) {
        showFeedback('error', t('storeUpdateError'), 'store');
    }
  };
  
  // Password change handlers
  const handlePasswordInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setPasswordChange(prev => ({ ...prev, [id]: value }));
  };
  
  const handleChangePassword = async (e: React.FormEvent) => {
      e.preventDefault();
      if(activeUser.password !== passwordChange.current) {
          showFeedback('error', t('currentPasswordIncorrect'), 'password');
          return;
      }
      if(!passwordChange.new) {
          showFeedback('error', t('newPasswordEmpty'), 'password');
          return;
      }
      if(passwordChange.new !== passwordChange.confirm) {
          showFeedback('error', t('passwordsDoNotMatch'), 'password');
          return;
      }

      await updateUser({ ...activeUser, password: passwordChange.new });
      setPasswordChange({ current: '', new: '', confirm: '' });
      showFeedback('success', t('passwordChangedSuccess'), 'password');
  };

  // Backup & Restore Handlers
  const handleBackup = async () => {
    try {
      const content = await getDatabaseContents();
      const blob = new Blob([content], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `goshop_backup_${store.id}_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      showFeedback('error', e.message, 'backup');
    }
  };

  const handleRestoreFromFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          if (typeof event.target?.result !== 'string') throw new Error('Invalid file');
          await performRestore(event.target.result);
        } catch (e: any) {
          showFeedback('error', t((e.message || 'restoreError') as keyof typeof translations.fr), 'backup');
        }
      };
      reader.readAsText(file);
    }
  };

  const handleRestoreFromText = async () => {
      if(!restoreText) return;
      await performRestore(restoreText);
  }

  const performRestore = async (content: string) => {
     if (window.confirm(t('restoreConfirm'))) {
        try {
          const result = await restoreDatabase(content);
          if (result && result.id) {
            alert(t('restoreSuccess'));
            localStorage.removeItem('pos-license');
            window.location.reload();
          } else {
            throw new Error('restoreError');
          }
        } catch (e: any) {
            showFeedback('error', t(e.message as keyof typeof translations.fr) || e.message, 'backup');
        }
      }
  }


  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* USER MANAGEMENT */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg">
        <h2 className="text-2xl font-bold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2"><UserPlusIcon />{t('add')} {t('seller')}</h2>
        <form onSubmit={handleAddUser} className="grid sm:grid-cols-3 gap-4 items-end">
          <input type="hidden" id="role" value="seller" />
          <div className="sm:col-span-1">
            <label htmlFor="name" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">{t('userName')}</label>
            <input type="text" id="name" value={newUser.name} onChange={handleUserInputChange} className="w-full px-4 py-2 border rounded-lg bg-gray-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 dark:border-slate-600" required />
          </div>
          <div className="sm:col-span-1">
            <label htmlFor="pin" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">{t('pinMin4Digits')}</label>
            <input type="password" id="pin" value={newUser.pin} onChange={handleUserInputChange} className="w-full px-4 py-2 border rounded-lg bg-gray-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 dark:border-slate-600" required />
          </div>
          <button type="submit" className="w-full bg-teal-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-teal-700 transition-colors">{t('add')}</button>
        </form>
        {feedback && feedback.section === 'users' && (
            <div className={`mt-4 p-3 rounded-lg text-sm font-semibold ${feedback.type === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'}`}>
                {feedback.message}
            </div>
        )}
        <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200 mt-8 mb-4">{t('userList')}</h3>
        <div className="space-y-3">
            {users.map(user => (
              <div key={user.id} className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg flex justify-between items-center gap-4 flex-wrap">
                  <div>
                      <p className="font-bold text-slate-800 dark:text-slate-200">{user.name}</p>
                      <p className={`text-xs font-semibold px-2 py-0.5 rounded-full inline-block ${user.role === 'admin' ? 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/50 dark:text-cyan-300' : 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300'}`}>{t(user.role)}</p>
                  </div>
                   {user.role === 'seller' && (
                       <div className="flex items-center gap-2">
                           <input type="password" placeholder={t('resetPinFor', { name: user.name })} onChange={(e) => handlePinChange(user.id, e.target.value)} className="w-48 px-3 py-2 border rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 dark:border-slate-600 text-sm"/>
                           <button onClick={() => handleUpdateUserPin(user)} disabled={!editingPins[user.id]} className="bg-blue-600 text-white font-semibold py-2 px-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 text-sm">{t('save')}</button>
                           <button onClick={() => handleDeleteUser(user)} className="text-red-500 hover:text-red-700 p-2 rounded-full hover:bg-red-100 dark:hover:bg-red-900/50"><TrashIcon className="w-5 h-5"/></button>
                       </div>
                   )}
              </div>
            ))}
        </div>
      </div>

      {/* ADMIN PASSWORD CHANGE */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg">
        <h2 className="text-2xl font-bold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2"><KeyIcon />{t('changePassword')}</h2>
        <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="grid sm:grid-cols-3 gap-4">
                <input type="password" id="current" placeholder={t('currentPassword')} value={passwordChange.current} onChange={handlePasswordInputChange} className="w-full px-4 py-2 border rounded-lg bg-gray-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 dark:border-slate-600" required />
                <input type="password" id="new" placeholder={t('newPassword')} value={passwordChange.new} onChange={handlePasswordInputChange} className="w-full px-4 py-2 border rounded-lg bg-gray-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 dark:border-slate-600" required />
                <input type="password" id="confirm" placeholder={t('confirmNewPassword')} value={passwordChange.confirm} onChange={handlePasswordInputChange} className="w-full px-4 py-2 border rounded-lg bg-gray-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 dark:border-slate-600" required />
            </div>
             <button type="submit" className="w-full sm:w-auto bg-teal-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-teal-700">{t('changePassword')}</button>
        </form>
         {feedback && feedback.section === 'password' && (
            <div className={`mt-4 p-3 rounded-lg text-sm font-semibold ${feedback.type === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'}`}>
                {feedback.message}
            </div>
        )}
      </div>

      {/* STORE SETTINGS */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg">
        <h2 className="text-2xl font-bold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2"><SettingsIcon />{t('storeSettings')}</h2>
        <form onSubmit={handleSaveStore} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
                 <div>
                    <label htmlFor="name" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">{t('storeNameLabel')}</label>
                    <input type="text" id="name" value={storeDetails.name} onChange={handleStoreInputChange} className="w-full px-4 py-2 border rounded-lg bg-gray-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 dark:border-slate-600" required />
                 </div>
                 <div>
                    <label htmlFor="address" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">{t('storeAddress')}</label>
                    <input type="text" id="address" value={storeDetails.address} onChange={handleStoreInputChange} className="w-full px-4 py-2 border rounded-lg bg-gray-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 dark:border-slate-600" />
                 </div>
                 <div>
                    <label htmlFor="ice" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">{t('storeICE')}</label>
                    <input type="text" id="ice" value={storeDetails.ice} onChange={handleStoreInputChange} className="w-full px-4 py-2 border rounded-lg bg-gray-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 dark:border-slate-600" />
                 </div>
                 <div className="flex items-center gap-4">
                    {logoPreview && <img src={logoPreview} alt={t('logoPreview')} className="w-16 h-16 rounded-lg object-cover bg-slate-200" />}
                    <div>
                        <label htmlFor="logo" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">{t('storeLogoLabel')}</label>
                        <input type="file" id="logo" accept="image/*" ref={logoInputRef} onChange={handleLogoChange} className="text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 dark:file:bg-teal-900/50 dark:file:text-teal-300 dark:hover:file:bg-teal-900"/>
                    </div>
                 </div>
            </div>
            <button type="submit" className="w-full sm:w-auto bg-teal-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-teal-700">{t('saveStoreChanges')}</button>
        </form>
        {feedback && feedback.section === 'store' && (
            <div className={`mt-4 p-3 rounded-lg text-sm font-semibold ${feedback.type === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'}`}>
                {feedback.message}
            </div>
        )}
      </div>
      
      {/* BACKUP & RESTORE */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg">
        <h2 className="text-2xl font-bold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2"><DatabaseZapIcon />{t('backupAndRestore')}</h2>
        {feedback && feedback.section === 'backup' && (
            <div className={`mb-4 p-3 rounded-lg text-sm font-semibold ${feedback.type === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'}`}>
                {feedback.message}
            </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                <h3 className="font-bold text-slate-700 dark:text-slate-200">{t('backupButton')}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 my-2">{t('backupDescription')}</p>
                <button onClick={handleBackup} className="bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-blue-700 text-sm">{t('backupButton')}</button>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg space-y-3">
                <h3 className="font-bold text-slate-700 dark:text-slate-200">{t('restoreButton')}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">{t('restoreDescription')}</p>
                
                 <div>
                    <h4 className="font-semibold text-slate-600 dark:text-slate-300 text-sm">{t('restoreFromText')}</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">{t('restoreFromTextDescription')}</p>
                    <textarea value={restoreText} onChange={(e) => setRestoreText(e.target.value)} placeholder={t('pasteBackupContent')} className="w-full h-24 p-2 border rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 dark:border-slate-600 text-xs font-mono"></textarea>
                    <button onClick={handleRestoreFromText} className="w-full bg-orange-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-orange-700 text-sm mt-2">{t('restoreButton')}</button>
                 </div>
                
                 <div className="text-center text-xs text-slate-500 dark:text-slate-400 py-2">{t('restoreFromFileAlternative')}</div>

                <button onClick={() => restoreFileInputRef.current?.click()} className="w-full bg-red-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-red-700 flex items-center gap-2 justify-center text-sm">
                    <UploadIcon className="w-4 h-4" /> {t('restoreButton')}
                </button>
                <input type="file" accept=".json" ref={restoreFileInputRef} onChange={handleRestoreFromFile} className="hidden" />
            </div>
        </div>
      </div>
    </div>
  );
};

export default UserManagement;
