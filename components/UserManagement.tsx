import React, { useState, useMemo } from 'react';
import type { User, Store } from '../types';
import { UserPlusIcon, TrashIcon, KeyIcon, SettingsIcon, UploadIcon, FileDownIcon } from './Icons'; 
import { translations } from '../translations';

type TFunction = (key: keyof typeof translations.fr, options?: { [key: string]: string | number }) => string;

interface RestoreFromTextModalProps {
  onClose: () => void;
  onRestore: (jsonString: string) => Promise<void>;
  t: TFunction;
}

const RestoreFromTextModal: React.FC<RestoreFromTextModalProps> = ({ onClose, onRestore, t }) => {
    const [restoreText, setRestoreText] = useState('');

    const validation = useMemo(() => {
        if (!restoreText) {
            return { valid: false, message: '' };
        }
        try {
            const parsedData = JSON.parse(restoreText);
            if (typeof parsedData !== 'object' || parsedData === null) {
                return { valid: false, message: t('jsonInvalidNotObject') };
            }
            // Add a semantic check to ensure it's a valid backup file
            if (!parsedData.stores || !parsedData.users) {
                return { valid: false, message: t('invalidBackupStructure') };
            }
            return { valid: true, message: t('jsonValid') };
        } catch (error) {
            if (error instanceof SyntaxError) {
                 if(restoreText.trim().startsWith('import')) {
                    return { valid: false, message: t('jsonInvalidNotCode') };
                }
                return { valid: false, message: `${t('jsonInvalid')}: ${error.message}` };
            }
            return { valid: false, message: t('unknownError') };
        }
    }, [restoreText, t]);

    const handleRestoreClick = () => {
        if (validation.valid) {
            onRestore(restoreText);
        }
    };
    
    return (
        <div className="fixed inset-0 bg-slate-800 bg-opacity-75 flex justify-center items-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl max-w-2xl w-full p-6 flex flex-col max-h-[90vh]">
                <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200 mb-2">{t('restoreFromText')}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{t('restoreFromTextDesc')}</p>
                <textarea
                    value={restoreText}
                    onChange={(e) => setRestoreText(e.target.value)}
                    placeholder={t('pasteJsonHere')}
                    className="w-full flex-grow p-3 border rounded-lg bg-gray-50 dark:bg-slate-900 text-sm font-mono dark:border-slate-700 min-h-[300px] resize-none"
                    spellCheck="false"
                />
                 <div className="mt-2 text-sm font-semibold" style={{ minHeight: '1.25rem' }}>
                    {validation.message && (
                        <p className={validation.valid ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                            {validation.message}
                        </p>
                    )}
                </div>
                <div className="flex justify-end gap-3 mt-4">
                    <button onClick={onClose} className="bg-gray-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold py-2 px-4 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-500">{t('cancel')}</button>
                    <button onClick={handleRestoreClick} disabled={!validation.valid} className="bg-red-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-700 disabled:bg-gray-400 dark:disabled:bg-slate-500 disabled:cursor-not-allowed">
                        {t('restoreButton')}
                    </button>
                </div>
            </div>
        </div>
    );
};


interface UserManagementProps {
  activeUser: User;
  store: Store;
  storeId: string;
  users: User[];
  addUser: (user: Omit<User, 'id'>) => Promise<User | undefined>;
  updateUser: (user: User) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  onUpdateStore: (storeData: Partial<Store>) => Promise<void>;
  onBackup: () => void;
  onRestore: (jsonString: string) => Promise<void>;
  t: TFunction;
}

const UserManagement: React.FC<UserManagementProps> = ({
  activeUser,
  store,
  storeId,
  users,
  addUser,
  updateUser,
  deleteUser,
  onUpdateStore,
  onBackup,
  onRestore,
  t
}) => {
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [newUser, setNewUser] = useState({ name: '', role: 'seller' as 'admin' | 'seller', secret: '' });
  const [storeSettings, setStoreSettings] = useState<Partial<Store>>({
    name: store.name,
    address: store.address,
    ice: store.ice,
    enableAiReceiptScan: store.enableAiReceiptScan,
  });
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [showRestoreModal, setShowRestoreModal] = useState(false);


  const handleNewUserChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { id, value } = e.target;
    setNewUser(prev => ({ ...prev, [id]: value }));
  };
  
  const handleStoreSettingsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value, type, checked } = e.target;
    setStoreSettings(prev => ({...prev, [id]: type === 'checkbox' ? checked : value}));
  };

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.name || !newUser.secret) {
      showFeedback('error', t('fillAllFieldsError'));
      return;
    }
     if (users.some(u => u.name.toLowerCase() === newUser.name.trim().toLowerCase())) {
        showFeedback('error', t('userExistsError'));
        return;
    }

    const userToAdd: Omit<User, 'id'> = {
      storeId,
      name: newUser.name.trim(),
      role: newUser.role,
      ...(newUser.role === 'admin' ? { password: newUser.secret } : { pin: newUser.secret }),
    };

    const added = await addUser(userToAdd);
    if (added) {
      showFeedback('success', t('userAddedSuccess', { name: added.name }));
      setNewUser({ name: '', role: 'seller', secret: '' });
    }
  };

  const handleUpdateUser = async (user: User, newSecret: string) => {
    const updatedUser = {
      ...user,
      ...(user.role === 'admin' ? { password: newSecret } : { pin: newSecret }),
    };
    await updateUser(updatedUser);
    showFeedback('success', t('userUpdatedSuccess', { name: user.name }));
    setEditingUser(null);
  };

  const handleDeleteUser = async (user: User) => {
    if (user.id === activeUser.id) {
        alert("You cannot delete your own account.");
        return;
    }
    if (window.confirm(t('confirmUserDelete', { name: user.name }))) {
      try {
        await deleteUser(user.id);
        showFeedback('success', t('userDeletedSuccess', { name: user.name }));
      } catch (e) {
        showFeedback('error', t('userDeleteError'));
      }
    }
  };
  
  const handleUpdateStore = async (e: React.FormEvent) => {
    e.preventDefault();
    await onUpdateStore(storeSettings);
    showFeedback('success', t('storeUpdatedSuccess'));
  };
  
  return (
    <>
    {showRestoreModal && <RestoreFromTextModal onClose={() => setShowRestoreModal(false)} onRestore={onRestore} t={t} />}

    <div className="space-y-8">
      {feedback && (
        <div className={`fixed top-5 right-5 z-50 p-4 rounded-lg shadow-lg text-sm font-semibold ${feedback.type === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'}`}>
            {feedback.message}
        </div>
      )}

      {/* User Management */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg">
        <h2 className="text-2xl font-bold text-slate-700 dark:text-slate-200 mb-1">{t('userManagement')}</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{t('manageUsersAndPins')}</p>
        
        <form onSubmit={handleAddUser} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end p-4 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
           <div>
              <label htmlFor="name" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">{t('userName')}</label>
              <input type="text" id="name" value={newUser.name} onChange={handleNewUserChange} className="w-full px-4 py-2 border rounded-lg bg-white dark:bg-slate-700" required />
           </div>
           <div>
                <label htmlFor="role" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">{t('userRole')}</label>
                <select id="role" value={newUser.role} onChange={handleNewUserChange} className="w-full px-4 py-2 border rounded-lg bg-white dark:bg-slate-700">
                    <option value="seller">{t('seller')}</option>
                    <option value="admin">{t('admin')}</option>
                </select>
            </div>
            <div>
              <label htmlFor="secret" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">{newUser.role === 'admin' ? t('password') : t('pin')}</label>
              <input type="text" id="secret" value={newUser.secret} onChange={handleNewUserChange} placeholder={newUser.role === 'seller' ? t('pinInfo') : ''} className="w-full px-4 py-2 border rounded-lg bg-white dark:bg-slate-700" required />
            </div>
            <button type="submit" className="w-full bg-teal-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-teal-700 flex items-center justify-center gap-2">
                <UserPlusIcon className="w-5 h-5"/> {t('addUser')}
            </button>
        </form>

        <div className="mt-6">
            <h3 className="text-lg font-bold text-slate-600 dark:text-slate-300 mb-2">{t('userList')}</h3>
            <div className="space-y-2">
                {users.map(user => (
                    <div key={user.id} className="p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg flex justify-between items-center">
                        <div>
                           <p className="font-semibold text-slate-800 dark:text-slate-200">{user.name}</p>
                           <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{t(user.role)}</p>
                        </div>
                        <div className="flex items-center gap-3">
                           {editingUser?.id === user.id ? (
                               <input 
                                   type="text" 
                                   placeholder={t(user.role === 'admin' ? 'newPassword' : 'newPin')}
                                   onBlur={(e) => handleUpdateUser(user, e.target.value)}
                                   onKeyDown={(e) => e.key === 'Enter' && handleUpdateUser(user, (e.target as HTMLInputElement).value)}
                                   className="w-32 px-2 py-1 border rounded-md bg-white dark:bg-slate-600"
                                   autoFocus
                                />
                           ) : (
                                <button onClick={() => setEditingUser(user)} className="text-cyan-600 hover:text-cyan-800 dark:text-cyan-400 dark:hover:text-cyan-300" title={t('edit')}>
                                    <KeyIcon className="w-5 h-5"/>
                                </button>
                           )}
                           <button onClick={() => handleDeleteUser(user)} disabled={user.id === activeUser.id} className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed" title={t('delete')}>
                               <TrashIcon className="w-5 h-5"/>
                           </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      </div>
      
      {/* Store Settings */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg">
        <h2 className="text-2xl font-bold text-slate-700 dark:text-slate-200 mb-1">{t('storeSettings')}</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{t('updateStoreSettings')}</p>
        <form onSubmit={handleUpdateStore} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="name" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">{t('storeName')}</label>
                    <input type="text" id="name" value={storeSettings.name} onChange={handleStoreSettingsChange} className="w-full px-4 py-2 border rounded-lg bg-gray-50 dark:bg-slate-700" />
                </div>
                 <div>
                    <label htmlFor="address" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">{t('address')}</label>
                    <input type="text" id="address" value={storeSettings.address} onChange={handleStoreSettingsChange} className="w-full px-4 py-2 border rounded-lg bg-gray-50 dark:bg-slate-700" />
                </div>
                <div>
                    <label htmlFor="ice" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">{t('ice')}</label>
                    <input type="text" id="ice" value={storeSettings.ice} onChange={handleStoreSettingsChange} className="w-full px-4 py-2 border rounded-lg bg-gray-50 dark:bg-slate-700" />
                </div>
            </div>
             <div className="flex items-center gap-2 pt-2">
                <input type="checkbox" id="enableAiReceiptScan" checked={storeSettings.enableAiReceiptScan} onChange={handleStoreSettingsChange} className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
                <label htmlFor="enableAiReceiptScan" className="text-sm font-medium text-slate-600 dark:text-slate-300">{t('aiScanEnabled')}</label>
            </div>
            <button type="submit" className="w-full md:w-auto bg-blue-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2">
                <SettingsIcon className="w-5 h-5"/> {t('updateStore')}
            </button>
        </form>
      </div>

       {/* Data Management */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg">
        <h2 className="text-2xl font-bold text-slate-700 dark:text-slate-200 mb-1">{t('dataManagement')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
            <div className="p-4 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
                <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2"><FileDownIcon />{t('backupData')}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-3">{t('backupDataDesc')}</p>
                <button onClick={onBackup} className="w-full bg-green-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-green-700">{t('backupButton')}</button>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
                <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2"><UploadIcon />{t('restoreData')}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-3">{t('restoreDataDesc')}</p>
                <button onClick={() => setShowRestoreModal(true)} className="w-full bg-orange-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-orange-700">{t('restoreFromText')}</button>
            </div>
        </div>
      </div>

    </div>
    </>
  );
};

export default UserManagement;
