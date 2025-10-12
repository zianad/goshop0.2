import React, { useState, useRef } from 'react';
import type { User, Store } from '../types';
import { TrashIcon, UserPlusIcon, EditIcon, FileDownIcon, UploadIcon, DatabaseZapIcon, StoreIcon } from './Icons';
import { translations } from '../translations';
import * as api from '../api';

type TFunction = (key: keyof typeof translations.fr, options?: { [key: string]: string | number }) => string;

interface UserManagementProps {
  storeId: string;
  users: User[];
  addUser: (user: Omit<User, 'id'>) => Promise<User | undefined>;
  updateUser: (user: User) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  activeUser: User;
  store: Store;
  onUpdateStore: (updatedStoreData: Partial<Store>) => Promise<void>;
  t: TFunction;
}

const UserManagement: React.FC<UserManagementProps> = ({ storeId, users, addUser, updateUser, deleteUser, activeUser, store, onUpdateStore, t }) => {
  const [newUser, setNewUser] = useState({ name: '', pin: '' });
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [newPin, setNewPin] = useState('');
  const [feedback, setFeedback] = useState<{type: 'success' | 'error', message: string} | null>(null);
  
  const [currentPassword, setCurrentPassword] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  
  const [storeName, setStoreName] = useState(store.name);
  const [storeAddress, setStoreAddress] = useState(store.address || '');
  const [storeIce, setStoreIce] = useState(store.ice || '');
  const [storeLogo, setStoreLogo] = useState(store.logo || '');
  const [logoPreview, setLogoPreview] = useState(store.logo || '');


  const restoreInputRef = useRef<HTMLInputElement>(null);
  const restoreTextRef = useRef<HTMLTextAreaElement>(null);

  const clearFeedback = () => setTimeout(() => setFeedback(null), 4000);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setNewUser(prev => ({ ...prev, [id]: value }));
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    const trimmedName = newUser.name.trim();

    if (!trimmedName || !newUser.pin) {
      setFeedback({ type: 'error', message: t('fillAllFields') });
      clearFeedback();
      return;
    }
    if (newUser.pin.length < 4) {
      setFeedback({ type: 'error', message: t('pinMustBe4Chars') });
      clearFeedback();
      return;
    }
    if (users.some(u => u.name.toLowerCase() === trimmedName.toLowerCase())) {
        setFeedback({ type: 'error', message: t('userExistsError', {name: trimmedName})});
        clearFeedback();
        return;
    }

    await addUser({
      name: trimmedName,
      pin: newUser.pin,
      role: 'seller',
      storeId,
    });
    setNewUser({ name: '', pin: '' });
    setFeedback({type: 'success', message: t('userAddedSuccess', { name: trimmedName })});
    clearFeedback();
  };

  const handleOpenEditModal = (user: User) => {
    setEditingUser(user);
    setNewPin(''); // Reset pin input for the modal
  };

  const handleUpdateUserPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    if (!editingUser) return;
    if (newPin.length < 4) {
      setFeedback({ type: 'error', message: t('pinMustBe4Chars') });
      clearFeedback();
      return;
    }

    await updateUser({ ...editingUser, pin: newPin });
    setFeedback({ type: 'success', message: t('pinUpdatedForUser', { name: editingUser.name }) });
    setEditingUser(null);
    clearFeedback();
  };

  const handleDeleteUser = async (user: User) => {
    if (user.role === 'admin') {
      alert(t('cannotDeleteAdmin'));
      return;
    }
    if (window.confirm(t('confirmUserDelete', { name: user.name }))) {
      await deleteUser(user.id);
    }
  };

  const handleAdminPasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    if (activeUser.password !== currentPassword) {
        setFeedback({type: 'error', message: t('currentPasswordIncorrect')});
        clearFeedback();
        return;
    }
    if (!newAdminPassword) {
        setFeedback({type: 'error', message: t('newPasswordEmpty')});
        clearFeedback();
        return;
    }
    if (newAdminPassword !== confirmNewPassword) {
        setFeedback({type: 'error', message: t('passwordsDoNotMatch')});
        clearFeedback();
        return;
    }
    
    await updateUser({ ...activeUser, password: newAdminPassword });
    setFeedback({ type: 'success', message: t('passwordChangedSuccess') });
    setCurrentPassword('');
    setNewAdminPassword('');
    setConfirmNewPassword('');
    clearFeedback();
  };

  const handleStoreUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    try {
      await onUpdateStore({
        name: storeName,
        address: storeAddress,
        ice: storeIce,
        logo: storeLogo,
      });
      setFeedback({ type: 'success', message: t('storeUpdateSuccess') });
    } catch {
      setFeedback({ type: 'error', message: t('storeUpdateError') });
    }
    clearFeedback();
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setStoreLogo(result);
        setLogoPreview(result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleBackup = async () => {
    try {
        const dbContent = await api.getDatabaseContents();
        const blob = new Blob([dbContent], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const date = new Date().toISOString().split('T')[0];
        link.download = `pos-backup-${storeId}-${date}.json`;
        link.href = url;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    } catch (e) {
        alert('Backup failed.');
        console.error(e);
    }
  };

  const handleRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = async (event) => {
            const content = event.target?.result as string;
            if (window.confirm(t('restoreConfirm'))) {
                try {
                    const restoredStoreInfo = await api.restoreDatabase(content);
                    if (restoredStoreInfo) {
                        localStorage.setItem('pos-license', JSON.stringify({ storeId: restoredStoreInfo.id }));
                        alert(t('restoreSuccess'));
                        window.location.reload();
                    } else {
                        throw new Error('restoreError');
                    }
                } catch (err: any) {
                    if (err.message === 'jsonParseError') {
                        alert(t('jsonParseError'));
                    } else {
                        const errorMessageKey = (err.message || 'restoreError') as keyof typeof translations.fr;
                        alert(t(errorMessageKey in translations.fr ? errorMessageKey : 'restoreError'));
                    }
                }
            }
        };
        reader.readAsText(file);
    }
    if (e.target) e.target.value = '';
  };
  
  const handleRestoreFromText = async () => {
    const restoreText = restoreTextRef.current?.value;
    if (!restoreText || !restoreText.trim()) {
        alert(t('pasteBackupContent'));
        return;
    }
    if (window.confirm(t('restoreConfirm'))) {
        try {
            const restoredStoreInfo = await api.restoreDatabase(restoreText);
            if (restoredStoreInfo) {
                localStorage.setItem('pos-license', JSON.stringify({ storeId: restoredStoreInfo.id }));
                alert(t('restoreSuccess'));
                window.location.reload();
            } else {
                throw new Error('restoreError');
            }
        } catch (err: any) {
            if (err.message === 'jsonParseError') {
                alert(t('jsonParseError'));
            } else {
                const errorMessageKey = (err.message || 'restoreError') as keyof typeof translations.fr;
                alert(t(errorMessageKey in translations.fr ? errorMessageKey : 'restoreError'));
            }
        }
    }
  };
  
  const admin = users.find(u => u.role === 'admin');

  return (
    <div className="space-y-6">
      {feedback && (
          <div className={`p-4 rounded-lg text-sm font-semibold ${feedback.type === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'}`}>
              {feedback.message}
          </div>
      )}

      {/* Store Settings Section */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg">
        <h2 className="text-2xl font-bold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2"><StoreIcon />{t('storeSettings')}</h2>
        <form onSubmit={handleStoreUpdate} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('storeNameLabel')}</label>
                <input type="text" value={storeName} onChange={e => setStoreName(e.target.value)} className="w-full p-2 border rounded-lg bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-slate-100 dark:border-slate-600" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('storeAddress')}</label>
                <input type="text" value={storeAddress} onChange={e => setStoreAddress(e.target.value)} className="w-full p-2 border rounded-lg bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-slate-100 dark:border-slate-600" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('storeICE')}</label>
                <input type="text" value={storeIce} onChange={e => setStoreIce(e.target.value)} className="w-full p-2 border rounded-lg bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-slate-100 dark:border-slate-600" />
              </div>
            </div>
            <div className="flex flex-col items-center justify-center p-4 border-2 border-dashed rounded-lg dark:border-slate-600">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('storeLogoLabel')}</label>
              <img src={logoPreview || `https://via.placeholder.com/150/f3f4f6/6b7280?text=${t('logoPreview')}`} alt={t('logoPreview')} className="w-32 h-32 object-cover rounded-lg mb-4 bg-gray-200" />
              <input type="file" id="storeLogoFile" accept="image/*" onChange={handleLogoChange} className="text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 dark:file:bg-teal-900/50 dark:file:text-teal-300 dark:hover:file:bg-teal-900" />
            </div>
          </div>
          <button type="submit" className="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors">{t('saveStoreChanges')}</button>
        </form>
      </div>


      {/* Admin Section */}
      {admin && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg">
            <h2 className="text-2xl font-bold text-slate-700 dark:text-slate-200 mb-4">{t('admin')}: {admin.name}</h2>
            <form onSubmit={handleAdminPasswordChange} className="space-y-4">
                <h3 className="font-semibold text-slate-600 dark:text-slate-300">{t('changePassword')}</h3>
                <div className="grid md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('currentPassword')}</label>
                        <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className="w-full p-2 border rounded-lg bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-slate-100 dark:border-slate-600" required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('newPassword')}</label>
                        <input type="password" value={newAdminPassword} onChange={e => setNewAdminPassword(e.target.value)} className="w-full p-2 border rounded-lg bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-slate-100 dark:border-slate-600" required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('confirmNewPassword')}</label>
                        <input type="password" value={confirmNewPassword} onChange={e => setConfirmNewPassword(e.target.value)} className="w-full p-2 border rounded-lg bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-slate-100 dark:border-slate-600" required />
                    </div>
                </div>
                <button type="submit" className="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors">{t('saveChanges')}</button>
            </form>
        </div>
      )}

      {/* Seller Management Section */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg">
        <h2 className="text-2xl font-bold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2"><UserPlusIcon />{t('addSeller')}</h2>
        <form onSubmit={handleAddUser} className="grid sm:grid-cols-3 gap-4 items-end">
            <div className="sm:col-span-1">
                <label htmlFor="name" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">{t('userName')}</label>
                <input type="text" id="name" value={newUser.name} onChange={handleInputChange} className="w-full px-4 py-2 border rounded-lg bg-gray-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 dark:border-slate-600" required />
            </div>
            <div className="sm:col-span-1">
                <label htmlFor="pin" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">{t('pinMin4Digits')}</label>
                <input type="password" id="pin" value={newUser.pin} onChange={handleInputChange} className="w-full px-4 py-2 border rounded-lg bg-gray-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 dark:border-slate-600" required minLength={4} />
            </div>
            <button type="submit" className="w-full bg-teal-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-teal-700 transition-colors">
              {t('add')}
            </button>
        </form>
      </div>

      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg">
        <h2 className="text-2xl font-bold text-slate-700 dark:text-slate-200">{t('userList')}</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm text-left rtl:text-right text-slate-500 dark:text-slate-400">
            <thead className="text-xs text-slate-600 dark:text-slate-300 uppercase bg-gray-50 dark:bg-slate-700">
              <tr>
                <th scope="col" className="px-6 py-3">{t('name')}</th>
                <th scope="col" className="px-6 py-3">{t('role')}</th>
                <th scope="col" className="px-6 py-3 text-right rtl:text-left">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
              {users.map(user => (
                <tr key={user.id} className="bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700/50">
                  <th scope="row" className="px-6 py-4 font-medium text-slate-700 dark:text-slate-100 whitespace-nowrap">{user.name}</th>
                  <td className="px-6 py-4">{t(user.role)}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-4">
                      {user.role === 'seller' && (
                        <>
                          <button onClick={() => handleOpenEditModal(user)} className="text-cyan-600 hover:text-cyan-800 dark:text-cyan-400 dark:hover:text-cyan-300" title={t('resetPinFor', {name: user.name})}>
                            <EditIcon className="w-5 h-5"/>
                          </button>
                          <button onClick={() => handleDeleteUser(user)} className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300" title={t('delete')}>
                            <TrashIcon className="w-5 h-5"/>
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {activeUser.role === 'admin' && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg">
          <h2 className="text-2xl font-bold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2">
              <DatabaseZapIcon />{t('backupAndRestore')}
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
              <div className="border-2 border-dashed dark:border-slate-600 p-4 rounded-lg text-center flex flex-col items-center justify-center">
                  <h3 className="text-lg font-bold text-slate-600 dark:text-slate-300">{t('backupButton')}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 my-2">{t('backupDescription')}</p>
                  <button
                      onClick={handleBackup}
                      className="bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700 transition-colors inline-flex items-center gap-2"
                  >
                      <FileDownIcon className="w-5 h-5" />
                      {t('backupButton')}
                  </button>
              </div>
          </div>

          <div className="mt-6 border-t-2 border-dashed pt-6 dark:border-slate-700">
            <h3 className="text-xl font-bold text-red-600 dark:text-red-400 mb-2">{t('restoreButton')}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{t('restoreFromTextDescription')}</p>
            
            <textarea
                ref={restoreTextRef}
                placeholder={t('pasteBackupContent')}
                className="w-full h-48 p-2 border rounded-lg bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-slate-100 dark:border-slate-600 font-mono text-xs"
                aria-label={t('pasteBackupContent')}
            />
            
            <button
                onClick={handleRestoreFromText}
                className="mt-4 bg-red-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-700 transition-colors inline-flex items-center gap-2"
            >
                <UploadIcon className="w-5 h-5" />
                {t('restoreFromText')}
            </button>

            <details className="mt-4 text-sm">
                <summary className="cursor-pointer text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">{t('restoreFromFileAlternative')}</summary>
                <div className="mt-2 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                    <p className="text-slate-500 dark:text-slate-400 my-2">{t('restoreDescription')}</p>
                    <input type="file" ref={restoreInputRef} onChange={handleRestore} className="hidden" accept=".json,application/json" />
                    <button
                        onClick={() => restoreInputRef.current?.click()}
                        className="bg-gray-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-gray-600 transition-colors inline-flex items-center gap-2"
                    >
                        <UploadIcon className="w-5 h-5" />
                        {t('restoreButton')}
                    </button>
                </div>
            </details>
          </div>
      </div>
      )}
      
      {editingUser && (
        <div className="fixed inset-0 bg-slate-800 bg-opacity-75 flex justify-center items-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl max-w-md w-full p-6">
                <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200 mb-4">{t('resetPinFor', { name: editingUser.name })}</h3>
                <form onSubmit={handleUpdateUserPin}>
                    <label htmlFor="newPin" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">{t('newPin')}</label>
                    <input
                        id="newPin"
                        type="password"
                        value={newPin}
                        onChange={(e) => setNewPin(e.target.value)}
                        className="w-full px-4 py-2 border rounded-lg bg-gray-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 dark:border-slate-600"
                        required
                        minLength={4}
                        autoFocus
                    />
                    <div className="flex justify-end gap-3 mt-6">
                        <button type="button" onClick={() => setEditingUser(null)} className="bg-gray-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold py-2 px-4 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-500">{t('cancel')}</button>
                        <button type="submit" className="bg-teal-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-teal-700">{t('save')}</button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;