
import React, { useState, useMemo, useEffect } from 'react';
import type { Customer, Sale } from '../types.ts';
import { UsersIcon, FileDownIcon, TrashIcon, PrinterIcon, FileTextIcon, HistoryIcon, XIcon, ArrowLeftIcon, ArrowRightIcon } from './Icons.tsx';
import { exportToPdf, setupPdfDoc } from '../utils/helpers.ts';
import { translations } from '../translations.ts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type Language = 'fr' | 'ar';
type TFunction = (key: keyof typeof translations.fr, options?: { [key: string]: string | number }) => string;

interface CustomerHistoryModalProps {
    customer: Customer;
    sales: Sale[];
    debt: number;
    onClose: () => void;
    t: TFunction;
    language: Language;
}

const CustomerHistoryModal: React.FC<CustomerHistoryModalProps> = ({ customer, sales, debt, onClose, t, language }) => {
    const customerSales = useMemo(() => {
        return sales.filter(s => s.customerId === customer.id).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [sales, customer.id]);

    const totalPurchases = useMemo(() => {
        return customerSales.reduce((sum, s) => sum + s.total, 0);
    }, [customerSales]);

    const handlePrintReport = () => {
        const doc = new jsPDF();
        setupPdfDoc(doc, language);

        // Header
        doc.setFontSize(18);
        const title = t('purchaseHistoryFor', { name: customer.name });
        doc.text(title, doc.internal.pageSize.getWidth() / 2, 20, { align: 'center' });

        // Customer Info & Summary
        doc.setFontSize(12);
        doc.text(`${t('customer')}: ${customer.name}`, 14, 30);
        doc.text(`${t('phone')}: ${customer.phone}`, 14, 36);
        doc.text(`${t('totalPurchases')}: ${totalPurchases.toFixed(2)} DH`, 14, 42);
        doc.text(`${t('currentDebt')}: ${debt.toFixed(2)} DH`, 14, 48);
        
        const tableBody: any[] = [];
        const locale = language === 'ar' ? 'ar-MA' : 'fr-FR';

        customerSales.forEach(sale => {
            const saleDate = new Date(sale.date).toLocaleDateString(locale);
             tableBody.push([
                {
                    content: `${t('invoiceNumber')} ${sale.id.slice(-6).toUpperCase()} | ${saleDate} | Total: ${sale.total.toFixed(2)} DH | ${t('remainingAmountLabel')}: ${sale.remainingAmount.toFixed(2)} DH`,
                    colSpan: 4,
                    styles: { fillColor: [220, 220, 220], textColor: 0, fontStyle: 'bold' }
                }
            ]);
            
            sale.items.forEach(item => {
                tableBody.push([
                    `  ${item.name}`,
                    item.quantity,
                    item.price.toFixed(2),
                    (item.price * item.quantity).toFixed(2)
                ]);
            });
        });

        autoTable(doc, {
            head: [[t('productColumn'), t('quantity'), t('price'), t('total')]],
            body: tableBody,
            startY: 55,
            theme: 'grid',
            styles: {
                font: 'Amiri',
                halign: language === 'ar' ? 'right' : 'left',
                cellPadding: 2,
                fontSize: 10
            },
            headStyles: {
                fillColor: [38, 166, 154], // teal-like color
                textColor: 255,
                halign: 'center',
            },
        });

        doc.save(`history_${customer.name.replace(/\s/g, '_')}.pdf`);
    };

    return (
        <div className="fixed inset-0 bg-slate-800 bg-opacity-75 flex justify-center items-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl max-w-4xl w-full p-6 max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200">{t('history', { name: customer.name })}</h3>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"><XIcon className="w-6 h-6"/></button>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4 text-center">
                    <div className="bg-blue-100 dark:bg-blue-900/50 p-4 rounded-lg text-blue-800 dark:text-blue-200">
                        <p className="font-bold">{t('totalPurchases')}</p>
                        <p className="text-2xl font-extrabold">{totalPurchases.toFixed(2)} DH</p>
                    </div>
                    <div className="bg-red-100 dark:bg-red-900/50 p-4 rounded-lg text-red-800 dark:text-red-200">
                        <p className="font-bold">{t('currentDebt')}</p>
                        <p className="text-2xl font-extrabold">{debt.toFixed(2)} DH</p>
                    </div>
                </div>

                <div className="flex-grow overflow-y-auto pr-2 space-y-3">
                    <h4 className="font-bold text-lg text-slate-600 dark:text-slate-300 mt-2">{t('invoiceHistory')}</h4>
                     {customerSales.length > 0 ? customerSales.map(sale => (
                      <li key={sale.id} className="p-4 border dark:border-slate-700 rounded-lg list-none">
                          <div className="flex justify-between items-center">
                              <div>
                                  <p className="font-bold text-slate-800 dark:text-slate-200">{t('invoiceNumber')} {sale.id.slice(-6).toUpperCase()}</p>
                                  <p className="text-sm text-slate-500 dark:text-slate-400">{new Date(sale.date).toLocaleString(language === 'ar' ? 'ar-MA' : 'fr-FR')}</p>
                              </div>
                              <div className="text-right rtl:text-left">
                                   <p className="font-bold text-lg text-cyan-600 dark:text-cyan-400">{sale.total.toFixed(2)} DH</p>
                                   {sale.remainingAmount > 0 && <p className="text-xs font-bold text-red-500 dark:text-red-400">{t('remainingAmountLabel')}: {sale.remainingAmount.toFixed(2)} DH</p>}
                              </div>
                          </div>
                          <details className="mt-2 text-sm">
                            <summary className="cursor-pointer text-cyan-700 dark:text-cyan-400 font-semibold hover:text-cyan-800">{t('viewDetails')}</summary>
                            <ul className="mt-2 space-y-1 pt-2 pr-4 rtl:pl-4 rtl:pr-0 border-r-2 rtl:border-l-2 rtl:border-r-0 border-cyan-200 dark:border-cyan-500/30 text-slate-600 dark:text-slate-300">
                                {sale.items.map(item => (
                                    <li key={item.id} className="flex justify-between items-center">
                                        <span>{item.name} (x{item.quantity})</span>
                                        <span>{(item.price * item.quantity).toFixed(2)} DH</span>
                                    </li>
                                ))}
                            </ul>
                          </details>
                      </li>
                  )) : <p className="text-center text-slate-500 py-8">{t('noInvoicesFound')}</p>}
                </div>

                <div className="pt-4 mt-4 border-t dark:border-slate-700 flex justify-end gap-3">
                    <button onClick={onClose} className="bg-gray-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold py-2 px-4 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-500">{t('close')}</button>
                    <button onClick={handlePrintReport} className="bg-teal-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-teal-700 flex items-center gap-2">
                        <PrinterIcon className="w-5 h-5"/> {t('printReport')}
                    </button>
                </div>
            </div>
        </div>
    );
};

interface ManageDebtModalProps {
    customer: Customer;
    debt: number;
    onClose: () => void;
    onPayDebt: (customerId: string, amount: number) => Promise<void>;
    t: TFunction;
}

const ManageDebtModal: React.FC<ManageDebtModalProps> = ({ customer, debt, onClose, onPayDebt, t }) => {
    const [amount, setAmount] = useState('');
    const [isPaying, setIsPaying] = useState(false);

    const handlePayDebt = async (e: React.FormEvent) => {
        e.preventDefault();
        const paymentAmount = parseFloat(amount);
        if (isNaN(paymentAmount) || paymentAmount <= 0 || paymentAmount > debt) {
            alert(t('enterValidPayment'));
            return;
        }
        setIsPaying(true);
        await onPayDebt(customer.id, paymentAmount);
        setIsPaying(false);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-slate-800 bg-opacity-75 flex justify-center items-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl max-w-md w-full p-6">
                <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200 mb-4">{t('manageDebt')} - {customer.name}</h3>
                <div className="p-3 bg-red-100 dark:bg-red-900/50 rounded-lg mb-4">
                    <p className="font-bold text-red-800 dark:text-red-300">{t('currentDebt')}</p>
                    <p className="text-2xl font-extrabold text-red-800 dark:text-red-300">{debt.toFixed(2)} DH</p>
                </div>
                <form onSubmit={handlePayDebt}>
                    <label htmlFor="amountToPay" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">{t('amount')}</label>
                    <input
                        id="amountToPay"
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="w-full px-4 py-2 border rounded-lg bg-gray-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 dark:border-slate-600"
                        min="0.01"
                        step="0.01"
                        max={debt}
                        required
                        autoFocus
                    />
                    <div className="flex justify-end gap-3 mt-6">
                        <button type="button" onClick={onClose} className="bg-gray-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold py-2 px-4 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-500">{t('cancel')}</button>
                        <button type="submit" disabled={isPaying} className="bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700 disabled:bg-gray-400">
                            {isPaying ? `${t('saving')}...` : t('save')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const ITEMS_PER_PAGE = 15;

interface CustomerManagementProps {
  storeId: string;
  customers: Customer[];
  sales: Sale[];
  addCustomer: (customer: Omit<Customer, 'id'>) => Promise<Customer | undefined>;
  deleteCustomer: (id: string) => Promise<void>;
  payCustomerDebt: (customerId: string, amount: number) => Promise<void>;
  t: TFunction;
  language: Language;
}

const CustomerManagement: React.FC<CustomerManagementProps> = ({ storeId, customers, sales, addCustomer, deleteCustomer, payCustomerDebt, t, language }) => {
    const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', email: '' });
    const [feedback, setFeedback] = useState<{type: 'success' | 'error', message: string} | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [historyForCustomer, setHistoryForCustomer] = useState<Customer | null>(null);
    const [debtForCustomer, setDebtForCustomer] = useState<Customer | null>(null);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery]);

    const customerData = useMemo(() => {
        const debts = new Map<string, number>();
        const totalPurchases = new Map<string, number>();
        sales.forEach(sale => {
            if (sale.customerId) {
                const currentDebt = debts.get(sale.customerId) || 0;
                debts.set(sale.customerId, currentDebt + sale.remainingAmount);
                if (sale.total > 0) { // Exclude debt payments from total purchases
                    const currentTotal = totalPurchases.get(sale.customerId) || 0;
                    totalPurchases.set(sale.customerId, currentTotal + sale.total);
                }
            }
        });
        return { debts, totalPurchases };
    }, [sales]);

    const filteredCustomers = useMemo(() => {
        if (!searchQuery) return customers;
        return customers.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [customers, searchQuery]);

    const paginatedCustomers = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredCustomers.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [filteredCustomers, currentPage]);

    const totalPages = Math.ceil(filteredCustomers.length / ITEMS_PER_PAGE);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setNewCustomer(prev => ({ ...prev, [e.target.id]: e.target.value }));
    };

    const handleAddCustomer = async (e: React.FormEvent) => {
        e.preventDefault();
        setFeedback(null);
        if (!newCustomer.name || !newCustomer.phone) {
            setFeedback({type: 'error', message: t('nameAndPhoneRequired')});
            return;
        }
        if (customers.some(c => c.phone === newCustomer.phone.trim())) {
            setFeedback({type: 'error', message: t('customerExistsError', { phone: newCustomer.phone.trim() })});
            return;
        }

        await addCustomer({ ...newCustomer, storeId });
        setNewCustomer({ name: '', phone: '', email: '' });
        setFeedback({type: 'success', message: t('customerAddedSuccess', { name: newCustomer.name })});
        setTimeout(() => setFeedback(null), 4000);
    };

    const handleDeleteCustomer = async (customer: Customer) => {
        setFeedback(null);
        if (window.confirm(t('confirmCustomerDelete', { name: customer.name }))) {
            try {
                await deleteCustomer(customer.id);
                setFeedback({ type: 'success', message: t('customerDeletedSuccess', { name: customer.name }) });
            } catch (error: any) {
                const debt = customerData.debts.get(customer.id) || 0;
                const errorMessage = t((error.message || 'customerDeleteError') as keyof typeof translations.fr, { name: customer.name, debt: debt.toFixed(2) });
                setFeedback({ type: 'error', message: errorMessage });
            }
            setTimeout(() => setFeedback(null), 5000);
        }
    };
    
    const handleExport = () => {
        const headers = [t('name'), t('phone'), t('email'), t('totalPurchases'), t('currentDebt')];
        const data = customers.map(c => [
            c.name,
            c.phone,
            c.email || 'N/A',
            (customerData.totalPurchases.get(c.id) || 0).toFixed(2),
            (customerData.debts.get(c.id) || 0).toFixed(2)
        ]);
        exportToPdf(t('customerList'), headers, data, 'customers_report', language, t('noDataToExport'));
    };

    return (
        <div className="space-y-6">
            {historyForCustomer && <CustomerHistoryModal customer={historyForCustomer} sales={sales} debt={customerData.debts.get(historyForCustomer.id) || 0} onClose={() => setHistoryForCustomer(null)} t={t} language={language} />}
            {debtForCustomer && <ManageDebtModal customer={debtForCustomer} debt={customerData.debts.get(debtForCustomer.id) || 0} onClose={() => setDebtForCustomer(null)} onPayDebt={payCustomerDebt} t={t} />}

            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg">
                <h2 className="text-2xl font-bold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2"><UsersIcon/>{t('addNewCustomer')}</h2>
                <form onSubmit={handleAddCustomer}>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                        <div className="md:col-span-1">
                            <label htmlFor="name" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">{t('name')}</label>
                            <input type="text" id="name" value={newCustomer.name} className="w-full px-4 py-2 border rounded-lg bg-gray-50 dark:bg-slate-700" onChange={handleInputChange} required />
                        </div>
                        <div className="md:col-span-1">
                            <label htmlFor="phone" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">{t('phone')}</label>
                            <input type="tel" id="phone" value={newCustomer.phone} className="w-full px-4 py-2 border rounded-lg bg-gray-50 dark:bg-slate-700" onChange={handleInputChange} required />
                        </div>
                        <div className="md:col-span-1">
                            <label htmlFor="email" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">{t('email')} ({t('optional')})</label>
                            <input type="email" id="email" value={newCustomer.email} className="w-full px-4 py-2 border rounded-lg bg-gray-50 dark:bg-slate-700" onChange={handleInputChange} />
                        </div>
                        <button type="submit" className="w-full bg-teal-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-teal-700">{t('add')}</button>
                    </div>
                </form>
                {feedback && (
                    <div className={`mt-4 p-3 rounded-lg text-sm font-semibold ${feedback.type === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'}`}>
                        {feedback.message}
                    </div>
                )}
            </div>

            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg">
                <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
                    <h2 className="text-2xl font-bold text-slate-700 dark:text-slate-200">{t('customerList')}</h2>
                    <div className="flex-grow max-w-sm">
                        <input
                          type="text"
                          placeholder={t('searchByName')}
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full px-4 py-2 border rounded-lg bg-gray-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 dark:border-slate-600"
                        />
                    </div>
                    <button onClick={handleExport} className="bg-cyan-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-cyan-700 flex items-center gap-2 text-sm">
                        <FileDownIcon className="w-4 h-4"/> {t('exportToPdf')}
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-right rtl:text-left text-slate-500 dark:text-slate-400">
                        <thead className="text-xs text-slate-600 dark:text-slate-300 uppercase bg-gray-50 dark:bg-slate-700">
                            <tr>
                                <th scope="col" className="px-6 py-3">{t('name')}</th>
                                <th scope="col" className="px-6 py-3">{t('phone')}</th>
                                <th scope="col" className="px-6 py-3">{t('totalPurchases')}</th>
                                <th scope="col" className="px-6 py-3">{t('currentDebt')}</th>
                                <th scope="col" className="px-6 py-3 text-left rtl:text-right">{t('actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedCustomers.map(customer => {
                                const debt = customerData.debts.get(customer.id) || 0;
                                const total = customerData.totalPurchases.get(customer.id) || 0;
                                return (
                                    <tr key={customer.id} className="bg-white dark:bg-slate-800 border-b dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                        <th scope="row" className="px-6 py-4 font-medium text-slate-700 dark:text-slate-100 whitespace-nowrap">{customer.name}</th>
                                        <td className="px-6 py-4">{customer.phone}</td>
                                        <td className="px-6 py-4">{total.toFixed(2)} DH</td>
                                        <td className={`px-6 py-4 font-bold ${debt > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>{debt.toFixed(2)} DH</td>
                                        <td className="px-6 py-4 text-left rtl:text-right">
                                            <div className="flex items-center gap-2">
                                                {debt > 0 && <button onClick={() => setDebtForCustomer(customer)} className="bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300 text-xs font-bold py-1 px-3 rounded-full hover:bg-green-200">{t('manageDebt')}</button>}
                                                <button onClick={() => setHistoryForCustomer(customer)} className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700" title={t('history', {name: ''})}><HistoryIcon className="w-5 h-5"/></button>
                                                <button onClick={() => handleDeleteCustomer(customer)} className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-1 rounded-full hover:bg-red-100 dark:hover:bg-red-900/50" title={t('delete')}><TrashIcon className="w-5 h-5"/></button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    {totalPages > 1 && (
                        <div className="pt-4 flex justify-center items-center gap-4 border-t border-slate-200 dark:border-slate-700 mt-4">
                            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 bg-gray-200 dark:bg-slate-700 rounded-lg disabled:opacity-50" aria-label={t('previous')}><ArrowLeftIcon className="w-5 h-5" /></button>
                            <span className="font-semibold text-slate-600 dark:text-slate-300">{t('page')} {currentPage} / {totalPages}</span>
                            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 bg-gray-200 dark:bg-slate-700 rounded-lg disabled:opacity-50" aria-label={t('next')}><ArrowRightIcon className="w-5 h-5" /></button>
                        </div>
                    )}
                    {paginatedCustomers.length === 0 && (
                        <p className="text-center text-slate-500 dark:text-slate-400 py-8">
                            {searchQuery ? t('noResultsFound') : t('noCustomersAdded')}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CustomerManagement;
