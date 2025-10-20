import React, { useState, useMemo, useEffect } from 'react';
import type { Supplier, Purchase, PurchaseItem, Product, ProductVariant } from '../types';
import { TruckIcon, FileDownIcon, TrashIcon, PlusIcon, PrinterIcon, HistoryIcon, XIcon, ArrowLeftIcon, ArrowRightIcon, BoxIcon } from './Icons';
import { exportToPdf, setupPdfDoc } from '../utils/helpers';
import { translations } from '../translations';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';


type Language = 'fr' | 'ar';
type TFunction = (key: keyof typeof translations.fr, options?: { [key: string]: string | number }) => string;

const ITEMS_PER_PAGE = 15;

interface SupplierManagementProps {
  storeId: string;
  suppliers: Supplier[];
  purchases: Purchase[];
  products: Product[];
  variants: ProductVariant[];
  addSupplier: (supplier: Omit<Supplier, 'id'>) => Promise<Supplier | undefined>;
  deleteSupplier: (id: string) => Promise<void>;
  addPurchase: (purchase: Omit<Purchase, 'id'>, items: PurchaseItem[]) => Promise<void>;
  paySupplierDebt: (supplierId: string, amount: number) => Promise<void>;
  addProduct: (productData: Omit<Product, 'id'>, variantsData: (Omit<ProductVariant, 'id'|'productId'|'storeId'> & {stockQuantity?: number})[]) => Promise<{ product: Product, variants: ProductVariant[] }>;
  t: TFunction;
  language: Language;
}

const SupplierManagement: React.FC<SupplierManagementProps> = ({ 
    storeId, suppliers, purchases, products, variants, 
    addSupplier, deleteSupplier, addPurchase, paySupplierDebt, addProduct, 
    t, language 
}) => {
    const [newSupplier, setNewSupplier] = useState({ name: '', phone: '', email: '' });
    const [feedback, setFeedback] = useState<{type: 'success' | 'error', message: string} | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery]);

    const supplierDebts = useMemo(() => {
        const debts = new Map<string, number>();
        purchases.forEach(purchase => {
            if (purchase.supplierId && purchase.remainingAmount > 0) {
                const currentDebt = debts.get(purchase.supplierId) || 0;
                debts.set(purchase.supplierId, currentDebt + purchase.remainingAmount);
            }
        });
        return debts;
    }, [purchases]);

    const filteredSuppliers = useMemo(() => {
        if (!searchQuery) return suppliers;
        return suppliers.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [suppliers, searchQuery]);

    const paginatedSuppliers = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredSuppliers.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [filteredSuppliers, currentPage]);

    const totalPages = Math.ceil(filteredSuppliers.length / ITEMS_PER_PAGE);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setNewSupplier(prev => ({ ...prev, [e.target.id]: e.target.value }));
    };

    const handleAddSupplier = async (e: React.FormEvent) => {
        e.preventDefault();
        setFeedback(null);
        if (!newSupplier.name || !newSupplier.phone) {
            setFeedback({type: 'error', message: t('nameAndPhoneRequired')});
            return;
        }
        if (suppliers.some(s => s.phone === newSupplier.phone.trim())) {
            setFeedback({type: 'error', message: t('supplierExistsError', { phone: newSupplier.phone.trim() })});
            return;
        }

        await addSupplier({ ...newSupplier, storeId });
        setNewSupplier({ name: '', phone: '', email: '' });
        setFeedback({type: 'success', message: t('supplierAddedSuccess', { name: newSupplier.name })});
        setTimeout(() => setFeedback(null), 4000);
    };

    const handleDeleteSupplier = async (supplier: Supplier) => {
        setFeedback(null);
        if (window.confirm(t('confirmSupplierDelete', { name: supplier.name }))) {
            try {
                await deleteSupplier(supplier.id);
                setFeedback({ type: 'success', message: t('supplierDeletedSuccess', { name: supplier.name }) });
            } catch (error: any) {
                const debt = supplierDebts.get(supplier.id) || 0;
                const errorMessage = t((error.message || 'supplierDeleteError') as keyof typeof translations.fr, { name: supplier.name, debt: debt.toFixed(2) });
                setFeedback({ type: 'error', message: errorMessage });
            }
            setTimeout(() => setFeedback(null), 5000);
        }
    };
    
    const handleExport = () => {
        const headers = [t('name'), t('phone'), t('email'), t('debt')];
        const data = suppliers.map(s => [
            s.name,
            s.phone,
            s.email || 'N/A',
            `${(supplierDebts.get(s.id) || 0).toFixed(2)} DH`
        ]);
        exportToPdf(t('supplierList'), headers, data, 'suppliers_report', language, t('noDataToExport'));
    };

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg">
                <h2 className="text-2xl font-bold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2"><TruckIcon/>{t('addNewSupplier')}</h2>
                <form onSubmit={handleAddSupplier}>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                        <div className="md:col-span-1">
                            <label htmlFor="name" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">{t('name')}</label>
                            <input type="text" id="name" value={newSupplier.name} className="w-full px-4 py-2 border rounded-lg bg-gray-50 dark:bg-slate-700" onChange={handleInputChange} required />
                        </div>
                        <div className="md:col-span-1">
                            <label htmlFor="phone" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">{t('phone')}</label>
                            <input type="tel" id="phone" value={newSupplier.phone} className="w-full px-4 py-2 border rounded-lg bg-gray-50 dark:bg-slate-700" onChange={handleInputChange} required />
                        </div>
                        <div className="md:col-span-1">
                            <label htmlFor="email" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">{t('email')} ({t('optional')})</label>
                            <input type="email" id="email" value={newSupplier.email} className="w-full px-4 py-2 border rounded-lg bg-gray-50 dark:bg-slate-700" onChange={handleInputChange} />
                        </div>
                        <button type="submit" className="w-full bg-teal-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-teal-700">{t('add')}</button>
                    </div>
                </form>
                {feedback && (
                    <div className={`mt-4 p-3 rounded-lg text-sm font-semibold ${feedback.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {feedback.message}
                    </div>
                )}
            </div>

            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg">
                <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
                    <h2 className="text-2xl font-bold text-slate-700 dark:text-slate-200">{t('supplierList')}</h2>
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
                                <th scope="col" className="px-6 py-3">{t('email')}</th>
                                <th scope="col" className="px-6 py-3">{t('supplierDebt')}</th>
                                <th scope="col" className="px-6 py-3 text-left rtl:text-right">{t('actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedSuppliers.map(supplier => {
                                const debt = supplierDebts.get(supplier.id) || 0;
                                return (
                                    <tr key={supplier.id} className="bg-white dark:bg-slate-800 border-b dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                        <th scope="row" className="px-6 py-4 font-medium text-slate-700 dark:text-slate-100 whitespace-nowrap">{supplier.name}</th>
                                        <td className="px-6 py-4">{supplier.phone}</td>
                                        <td className="px-6 py-4">{supplier.email || 'N/A'}</td>
                                        <td className={`px-6 py-4 font-bold ${debt > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>{debt.toFixed(2)} DH</td>
                                        <td className="px-6 py-4 text-left rtl:text-right">
                                            <div className="flex items-center gap-2">
                                                <button className="bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 text-xs font-bold py-1 px-3 rounded-full hover:bg-blue-200">{t('newPurchase')}</button>
                                                {debt > 0 && <button className="bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300 text-xs font-bold py-1 px-3 rounded-full hover:bg-green-200">{t('managePayments')}</button>}
                                                <button className="text-slate-500 hover:text-slate-700 p-1 rounded-full hover:bg-slate-100" title={t('history')}><HistoryIcon className="w-5 h-5"/></button>
                                                <button onClick={() => handleDeleteSupplier(supplier)} className="text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-100" title={t('delete')}><TrashIcon className="w-5 h-5"/></button>
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
                    {paginatedSuppliers.length === 0 && (
                        <p className="text-center text-slate-500 dark:text-slate-400 py-8">
                            {searchQuery ? t('noResultsFound') : t('noSuppliersAdded')}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SupplierManagement;
