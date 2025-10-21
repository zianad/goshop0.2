import React, { useEffect, useMemo } from 'react';
import type { Sale, Customer, CartItem, Store } from '../types.ts';
import { translations } from '../translations.ts';
import { PrinterIcon, XIcon } from './Icons.tsx';

type Language = 'fr' | 'ar';
type TFunction = (key: keyof typeof translations.fr, options?: { [key: string]: string | number }) => string;


interface PrintableInvoiceProps {
  sale: Sale;
  mode: 'invoice' | 'orderForm';
  onClose: () => void;
  store: Store;
  customers: Customer[];
  t: TFunction;
  language: Language;
}

const PrintableInvoice: React.FC<PrintableInvoiceProps> = ({ sale, mode, onClose, store, customers, t, language }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
        window.print();
    }, 300); 

    return () => clearTimeout(timer);
  }, []);
  
  const handlePrint = () => {
    window.print();
  };
  
  const customer = sale.customerId ? customers.find(c => c.id === sale.customerId) : null;
  const locale = language === 'ar' ? 'ar-MA' : 'fr-FR';
  
  const toWords = (num: number): string => {
      if (language === 'ar') {
        // Arabic implementation would be complex, returning number for now.
        return num.toFixed(2);
      }
      const integerPart = Math.floor(num);
      const decimalPart = Math.round((num - integerPart) * 100);

      const units = ["", "UN", "DEUX", "TROIS", "QUATRE", "CINQ", "SIX", "SEPT", "HUIT", "NEUF"];
      const teens = ["DIX", "ONZE", "DOUZE", "TREIZE", "QUATORZE", "QUINZE", "SEIZE", "DIX-SEPT", "DIX-HUIT", "DIX-NEUF"];
      const tens = ["", "DIX", "VINGT", "TRENTE", "QUARANTE", "CINQUANTE", "SOIXANTE", "SOIXANTE-DIX", "QUATRE-VINGT", "QUATRE-VINGT-DIX"];

      const convertLessThanThousand = (n: number): string => {
          if (n === 0) return "";
          let str = "";
          if (n >= 100) {
              const hundreds = Math.floor(n/100);
              str += (hundreds > 1 ? units[hundreds] + " " : "") + "CENT" + (n % 100 === 0 && hundreds > 1 ? "S" : "");
              n %= 100;
              if (n > 0) str += " ";
          }
          if (n >= 20) {
              const ten = Math.floor(n/10);
              str += tens[ten];
              const one = n % 10;
              if (one > 0) str += (one === 1 && ten < 8 ? " ET " : "-") + units[one];
          } else if (n >= 10) {
              str += teens[n - 10];
          } else if (n > 0) {
              str += units[n];
          }
          return str;
      };

      if (num === 0) return "ZÉRO";
      let result = "";
      
      const millions = Math.floor(integerPart / 1000000);
      if (millions > 0) {
          result += convertLessThanThousand(millions) + " MILLION" + (millions > 1 ? "S" : "") + " ";
      }
      const thousands = Math.floor((integerPart % 1000000) / 1000);
      if (thousands > 0) {
          result += (thousands === 1 ? "" : convertLessThanThousand(thousands) + " ") + "MILLE ";
      }
      const rest = integerPart % 1000;
      if (rest > 0) {
          result += convertLessThanThousand(rest);
      }
      
      result = result.trim() + " DIRHAMS";

      if (decimalPart > 0) {
          result += " ET " + convertLessThanThousand(decimalPart) + " CENTIMES";
      }

      return result.toUpperCase();
  };

  const totalTTC = sale.total;
  const totalHT = mode === 'invoice' ? totalTTC / 1.2 : totalTTC;
  const tvaAmount = mode === 'invoice' ? totalTTC - totalHT : 0;
  const title = mode === 'invoice' ? t('invoiceTitle') : t('orderFormTitle');
  const amountInWords = toWords(totalTTC);
  
  return (
    <div className="fixed inset-0 bg-slate-700 bg-opacity-75 flex justify-center items-center z-50">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl max-w-md w-full">
        <div id="printable-invoice" className="p-6 text-slate-700 bg-white dark:bg-white dark:text-slate-800" dir={language === 'ar' ? 'rtl' : 'ltr'}>
            <div className="text-center mb-6">
                <h1 className="text-2xl font-bold">{title}</h1>
                <p className="text-sm font-semibold">{store.name}</p>
                {store.address ? <p className="text-xs">{store.address}</p> : <p className="text-xs">{t('invoiceAddress')}</p>}
                {store.ice && <p className="text-xs">ICE: {store.ice}</p>}
            </div>
            <div className="text-xs mb-4">
                <p><strong>{t('billNumber')}</strong> {sale.id.slice(-8).toUpperCase()}</p>
                <p><strong>{t('date')}:</strong> {new Date(sale.date).toLocaleString(locale)}</p>
                {customer && <p><strong>{t('customers')}:</strong> {customer.name}</p>}
            </div>
            <table className="w-full text-sm mb-4 border-collapse">
                <thead>
                    <tr className="bg-slate-100">
                        <th className="border border-slate-300 p-2 text-right rtl:text-left font-bold">{t('productColumn')}</th>
                        <th className="border border-slate-300 p-2 text-center font-bold">{t('quantity')}</th>
                        <th className="border border-slate-300 p-2 text-center font-bold">{mode === 'invoice' ? t('prixHT') : t('price')}</th>
                        <th className="border border-slate-300 p-2 text-center font-bold">{t('total')}</th>
                    </tr>
                </thead>
                <tbody>
                    {sale.items.map(item => (
                        <tr key={item.id}>
                            <td className="border border-slate-300 p-2 text-right rtl:text-left">{item.name}</td>
                            <td className="border border-slate-300 p-2 text-center">{item.quantity}</td>
                            <td className="border border-slate-300 p-2 text-center">{(mode === 'invoice' ? item.price / 1.2 : item.price).toFixed(2)}</td>
                            <td className="border border-slate-300 p-2 text-center font-semibold">{(item.price * item.quantity / (mode === 'invoice' ? 1.2 : 1)).toFixed(2)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <div className="w-full mt-4 text-sm">
                 <div className="grid grid-cols-2 gap-x-4">
                    <div className="col-start-2">
                        <div className="flex justify-between py-1">
                            <span>{t('totalHT')}:</span>
                            <span className="font-semibold">{totalHT.toFixed(2)} DH</span>
                        </div>
                        {mode === 'invoice' && (
                            <div className="flex justify-between py-1">
                                <span>{t('vat')}:</span>
                                <span className="font-semibold">{tvaAmount.toFixed(2)} DH</span>
                            </div>
                        )}
                        <div className="flex justify-between py-2 font-bold text-lg border-t-2 border-slate-400 mt-1">
                            <span>{t('totalTTC')}:</span>
                            <span>{totalTTC.toFixed(2)} DH</span>
                        </div>
                    </div>
                </div>
            </div>
            
            {mode === 'invoice' && language === 'fr' && (
                <p className="text-xs mt-4 p-2 bg-slate-100 rounded-md">Arrêté la présente facture à la somme de : {amountInWords}</p>
            )}

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

export default PrintableInvoice;