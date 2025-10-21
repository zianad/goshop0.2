import React, { useState } from 'react';
import type { User } from '../types';
import { translations } from '../translations';

type TFunction = (key: keyof typeof translations.fr) => string;

interface LoginProps {
  storeUsers: User[];
  onUserSelect: (user: User) => void;
  onCancel: () => void;
  t: TFunction;
}

const Login: React.FC<LoginProps> = ({ storeUsers, onUserSelect, onCancel, t }) => {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const handleUserClick = (user: User) => {
    if (user.role === 'admin') {
      // Admins might need a password, but for simple switching, we can auto-login
      // Or implement password logic here if needed.
      onUserSelect(user);
    } else {
      setSelectedUser(user);
      setPin('');
      setError('');
    }
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedUser && selectedUser.pin === pin) {
      onUserSelect(selectedUser);
    } else {
      setError(t('invalidCredentialsError'));
      setPin('');
    }
  };
  
  const sellers = storeUsers.filter(u => u.role === 'seller');
  const admins = storeUsers.filter(u => u.role === 'admin');

  if (selectedUser) {
    return (
      <div className="fixed inset-0 bg-slate-800 bg-opacity-75 flex justify-center items-center z-50 p-4">
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl max-w-sm w-full p-6 text-center">
          <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200 mb-2">
            {t('welcome')} {selectedUser.name}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{t('pin')}</p>
          <form onSubmit={handlePinSubmit}>
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="w-full px-4 py-3 border rounded-lg text-center text-xl tracking-widest bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-slate-100 dark:border-slate-600"
              maxLength={4}
              autoFocus
            />
            {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
            <div className="flex gap-3 mt-6">
                 <button type="button" onClick={() => setSelectedUser(null)} className="w-full bg-gray-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold py-2 px-4 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-500">{t('goBack')}</button>
                <button type="submit" className="w-full bg-teal-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-teal-700">{t('login')}</button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-100 dark:bg-slate-900 flex flex-col justify-center items-center z-40 p-4">
       <div className="w-full max-w-md">
            <h2 className="text-3xl font-bold text-center text-slate-700 dark:text-slate-200 mb-6">{t('welcome')}</h2>
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg space-y-4">
                <div>
                    <h3 className="font-bold text-slate-600 dark:text-slate-300 mb-2">{t('seller')}s</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {sellers.map(user => (
                            <button key={user.id} onClick={() => handleUserClick(user)} className="p-4 bg-teal-500 hover:bg-teal-600 text-white font-bold rounded-lg transition-colors text-center">
                                {user.name}
                            </button>
                        ))}
                    </div>
                </div>
                 <div>
                    <h3 className="font-bold text-slate-600 dark:text-slate-300 mb-2">{t('admin')}s</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {admins.map(user => (
                            <button key={user.id} onClick={() => handleUserClick(user)} className="p-4 bg-slate-600 hover:bg-slate-700 text-white font-bold rounded-lg transition-colors text-center">
                                {user.name}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
            <div className="mt-6 text-center">
                 <button onClick={onCancel} className="text-sm text-slate-500 dark:text-slate-400 hover:underline">{t('logout')}</button>
            </div>
       </div>
    </div>
  );
};

export default Login;
