import React, { useEffect } from 'react';
import type { CartItem, Store } from '../types';
import { translations } from '../translations';
import { PrinterIcon, XIcon } from './Icons';

type Language = 'fr' | 'ar';
type TFunction = (key: keyof typeof translations.fr, options?: { [key: string]: string | number }) => string;

interface PrintableCartProps {
  cart: CartItem[];
  onClose: () => void;
  store: Store;
  t: TFunction;
  language: Language;
}

const PrintableCart: React.FC<PrintableCartProps> = ({ cart, onClose, store, t, language }) => {
  useEffect(() => {
    // Automatically trigger print dialog
    const timer = setTimeout(() => window.print(), 300);
    return () => clearTimeout(timer);
  }, []);

  const handlePrint = () => {
    window.print();
  };
  
  const subtotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const locale = language === 'ar' ? 'ar-MA' : 'fr-FR';

  return (
    <div className="fixed inset-0 bg-slate-700 bg-opacity-75 flex justify-center items-center z-50">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl max-w-md w-full">
        <div id="printable-cart" className="p-6 text-slate-700 bg-white dark:bg-white dark:text-slate-800" dir={language === 'ar' ? 'rtl' : 'ltr'}>
            <div className="text-center mb-6">
                <h1 className="text-2xl font-bold">{t('orderFormTitle')}</h1>
                <p className="text-sm font-semibold">{store.name}</p>
                {store.address && <p className="text-xs">{store.address}</p>}
                <p className="text-xs">{t('date')}: {new Date().toLocaleString(locale)}</p>
            </div>

            <table className="w-full text-sm mb-4 border-collapse">
                <thead>
                    <tr className="bg-slate-100">
                        <th className="border border-slate-300 p-2 text-right rtl:text-left font-bold">{t('productColumn')}</th>
                        <th className="border border-slate-300 p-2 text-center font-bold">{t('quantity')}</th>
                        <th className="border border-slate-300 p-2 text-center font-bold">{t('price')}</th>
                        <th className="border border-slate-300 p-2 text-center font-bold">{t('total')}</th>
                    </tr>
                </thead>
                <tbody>
                    {cart.map(item => (
                        <tr key={item.id}>
                            <td className="border border-slate-300 p-2 text-right rtl:text-left">{item.name}</td>
                            <td className="border border-slate-300 p-2 text-center">{item.quantity}</td>
                            <td className="border border-slate-300 p-2 text-center">{item.price.toFixed(2)}</td>
                            <td className="border border-slate-300 p-2 text-center font-semibold">{(item.price * item.quantity).toFixed(2)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <div className="w-full mt-4 text-sm">
                 <div className="grid grid-cols-2 gap-x-4">
                    <div className="col-start-2">
                        <div className="flex justify-between py-2 font-bold text-lg border-t-2 border-slate-400 mt-1">
                            <span>{t('total')}:</span>
                            <span>{subtotal.toFixed(2)} DH</span>
                        </div>
                    </div>
                </div>
            </div>
            
            <p className="text-center text-xs mt-6">{t('thankYou')}</p>
        </div>
        <div className="p-4 bg-gray-50 dark:bg-slate-700/50 border-t dark:border-slate-700 flex justify-end gap-3">
          <button onClick={onClose} className="bg-gray-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold py-2 px-4 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-500">
            {t('close')}
          </button>
          <button onClick={handlePrint} className="bg-teal-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-teal-700">
            {t('print')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PrintableCart;
