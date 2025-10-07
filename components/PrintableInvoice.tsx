import React, { useEffect, useMemo } from 'react';
import type { Sale, Customer, CartItem, Store } from '../types';
import { translations } from '../translations';
import { PrinterIcon, XIcon } from './Icons';

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
      const integerPart = Math.floor(num);
      const decimalPart = Math.round((num - integerPart) * 100);

      const units = ["", "UN", "DEUX", "TROIS", "QUATRE", "CINQ", "SIX", "SEPT", "HUIT", "NEUF"];
      const teens = ["DIX", "ONZE", "DOUZE", "TREIZE", "QUATORZE", "QUINZE", "SEIZE", "DIX-SEPT", "DIX-HUIT", "DIX-NEUF"];
      const tens = ["", "DIX", "VINGT", "TRENTE", "QUARANTE", "CINQUANTE", "SOIXANTE", "SOIXANTE-DIX", "QUATRE-VINGT", "QUATRE-VINGT-DIX"];

      const convertLessThanThousand = (n: number): string => {
          if (n === 0) return "";
          if (n < 10) return units[n];
          if (n < 20) return teens[n - 10];
          if (n < 100) {
              const ten = Math.floor(n / 10);
              const one = n % 10;
              if (ten === 7 || ten === 9) {
                  return tens[ten] + "-" + units[one];
              }
              let str = tens[ten];
               if (ten === 8 && one === 0) str += 'S';
              if (one > 0) str += (one === 1 && ten < 8 ? " ET " : "-") + units[one];
              return str;
          }
          if (n < 1000) {
              const hundred = Math.floor(n / 100);
              const rest = n % 100;
              let str = hundred > 1 ? units[hundred] + " CENT" : "CENT";
              if (rest === 0 && hundred > 1) str += 'S';
              if (rest > 0) str += " " + convertLessThanThousand(rest);
              return str;
          }
          return "";
      };

      if (num === 0) return "ZÉRO";
      let result = "";
      const thousands = Math.floor(integerPart / 1000);
      if (thousands > 0) {
          result += (thousands > 1 ? convertLessThanThousand(thousands) : "") + " MILLE ";
      }
      const rest = integerPart % 1000;
      if (rest > 0 || thousands === 0) {
          result += convertLessThanThousand(rest);
      }
      
      result = result.trim().replace("UN MILLE", "MILLE") + " DIRHAMS";
      
      if (decimalPart > 0) {
           result += " ET " + convertLessThanThousand(decimalPart) + " CENTIMES";
      }

      return result.toUpperCase().replace(/\s+/g, ' ');
  };

  const isInvoiceMode = mode === 'invoice';
  const title = isInvoiceMode ? t('invoiceTitle') : t('orderFormTitle');
  
  const { subTotal, totalHT, tvaAmount, totalTTC, amountForWords } = useMemo(() => {
    const finalAmountFromSale = sale.total;
    const ttc = finalAmountFromSale;
    const ht = isInvoiceMode ? ttc / 1.2 : ttc;
    const tva = isInvoiceMode ? ttc - ht : 0;
    
    // Subtotal needs to be calculated based on mode
    const sub = sale.items.reduce((sum, i) => {
        const itemPrice = isInvoiceMode ? (i.price / 1.2) : i.price;
        return sum + (itemPrice * i.quantity);
    }, 0);

    return {
      subTotal: sub,
      totalHT: ht,
      tvaAmount: tva,
      totalTTC: ttc,
      amountForWords: ttc, 
    };
  }, [sale, isInvoiceMode]);
  
  const totalInWords = toWords(amountForWords);


  return (
    <div className="fixed inset-0 bg-slate-700 bg-opacity-75 flex justify-center items-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full flex flex-col">
        <div id="printable-invoice" className="p-10 bg-white text-black font-sans text-sm">
            {/* Header */}
            <div className="flex justify-between items-start mb-8">
                <div>
                    <h1 className="font-bold text-2xl mb-2 text-black">{store.name || "CARRE FER"}</h1>
                    <p className="text-black">le : {new Date(sale.date).toLocaleDateString(locale)}</p>
                    {store.ice && <p className="text-black">ICE : {store.ice}</p>}
                </div>
                <div className="text-right">
                    <h2 className="font-bold text-lg text-black">{title} N°: {sale.id.slice(-8).toUpperCase()}</h2>
                    <div className="border border-black p-2 mt-2 min-w-[200px]">
                        <p className="text-black">{customer ? customer.name : 'Client Particulier'}</p>
                    </div>
                </div>
            </div>

            {/* Items Table */}
            <table className="w-full border-collapse mb-4">
                <thead>
                    <tr>
                        <th className="border-2 border-black p-1 text-left font-bold bg-gray-100 text-black">Désignation</th>
                        <th className="border-2 border-black p-1 text-center font-bold bg-gray-100 text-black w-24">Quantité</th>
                        <th className="border-2 border-black p-1 text-center font-bold bg-gray-100 text-black w-32">{isInvoiceMode ? t('prixHT') : t('price')}</th>
                        <th className="border-2 border-black p-1 text-center font-bold bg-gray-100 text-black w-32">{isInvoiceMode ? t('totalHT') : t('total')}</th>
                    </tr>
                </thead>
                <tbody>
                    {sale.items.map(item => {
                        const itemPrice = isInvoiceMode ? item.price / 1.2 : item.price;
                        return (
                            <tr key={item.id}>
                                <td className="border-2 border-black p-1 text-left text-black">{item.name}</td>
                                <td className="border-2 border-black p-1 text-center text-black">{item.quantity}</td>
                                <td className="border-2 border-black p-1 text-center text-black">{itemPrice.toFixed(2)}</td>
                                <td className="border-2 border-black p-1 text-center font-semibold text-black">{(itemPrice * item.quantity).toFixed(2)}</td>
                            </tr>
                        )
                    })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3} className="border-2 border-black p-1 text-right font-bold text-black">{t('total')}</td>
                    <td className="border-2 border-black p-1 text-center font-bold text-black">{subTotal.toFixed(2)}</td>
                  </tr>
                </tfoot>
            </table>
            
            {/* Footer */}
            <div className="flex justify-between items-start mt-8">
                <div className="w-2/3">
                    <p className="font-semibold text-black">{isInvoiceMode ? 'Arrêtée la présente facture à la somme de :' : 'Arrêtée le présent bon à la somme de :'}</p>
                    <p className="font-bold uppercase text-black">{totalInWords}</p>
                </div>
                <div className="w-1/3">
                   {isInvoiceMode ? (
                        <table className="w-full border-collapse">
                            <tbody>
                                <tr>
                                    <td className="border-2 border-black p-1 font-bold text-black">{t('totalHT')}</td>
                                    <td className="border-2 border-black p-1 text-right font-semibold text-black">{totalHT.toFixed(2)}</td>
                                </tr>
                                <tr>
                                    <td className="border-2 border-black p-1 font-bold text-black">{t('vat')}</td>
                                    <td className="border-2 border-black p-1 text-right font-semibold text-black">{tvaAmount.toFixed(2)}</td>
                                </tr>
                                <tr>
                                    <td className="border-2 border-black p-1 font-bold bg-gray-100 text-black">{t('totalTTC')}</td>
                                    <td className="border-2 border-black p-1 text-right font-bold bg-gray-100 text-black">{totalTTC.toFixed(2)}</td>
                                </tr>
                            </tbody>
                        </table>
                    ) : (
                         <table className="w-full border-collapse">
                            <tbody>
                                <tr>
                                    <td className="border-2 border-black p-1 font-bold bg-gray-100 text-black">{t('total')}</td>
                                    <td className="border-2 border-black p-1 text-right font-bold bg-gray-100 text-black">{totalTTC.toFixed(2)}</td>
                                </tr>
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
        <div className="p-4 bg-gray-100 border-t flex justify-end gap-3 print:hidden">
          <button onClick={onClose} className="flex items-center gap-2 bg-gray-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-gray-600 transition-colors">
            <XIcon className="w-5 h-5" />
            {t('close')}
          </button>
          <button onClick={handlePrint} className="flex items-center gap-2 bg-teal-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-teal-700 transition-colors">
            <PrinterIcon className="w-5 h-5" />
            {t('print')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PrintableInvoice;