
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import type { Expense, Sale, Product, ProductVariant, CartItem, Return, Customer, Purchase, Supplier, User } from '../types.ts';
import { exportToPdf, filterByDateRange } from '../utils/helpers.ts';
import { FileDownIcon, TrashIcon, EditIcon, SparklesIcon, UsersIcon, PrinterIcon, XIcon, ArrowLeftIcon, ArrowRightIcon } from './Icons.tsx';
import { translations } from '../translations.ts';

type Language = 'fr' | 'ar';
type TFunction = (key: keyof typeof translations.fr, options?: { [key: string]: string | number }) => string;
type Theme = 'light' | 'dark';

const COLORS = ['#26A69A', '#4DD0E1', '#EF5350', '#FFB74D', '#80CBC4', '#A0AEC0'];
const DARK_COLORS = ['#2dd4bf', '#67e8f9', '#f87171', '#fbbf24', '#5eead4', '#94a3b8'];


interface FinanceAndReportsProps {
  storeId: string;
  sales: Sale[];
  expenses: Expense[];
  purchases: Purchase[];
  suppliers: Supplier[];
  returns: Return[];
  customers: Customer[];
  users: User[];
  addProduct: (product: Omit<Product, 'id'>, variants: (Omit<ProductVariant, 'id'|'productId'|'storeId'> & { stockQuantity?: number })[]) => Promise<{ product: Product, variants: ProductVariant[] }>;
  addExpense: (expense: Omit<Expense, 'id'>) => Promise<Expense | undefined>;
  updateExpense: (expense: Expense) => Promise<void>;
  deleteExpense: (expenseId: string) => Promise<void>;
  deleteReturn: (returnId: string) => Promise<void>;
  deleteAllReturns: () => Promise<void>;
  t: TFunction;
  language: Language;
  theme: Theme;
  onReprintInvoice: (sale: Sale) => void;
}

const CustomItemsModal: React.FC<{
    onClose: () => void;
    total: number;
    sales: Sale[];
    customers: Customer[];
    onReprintInvoice: (sale: Sale) => void;
    t: TFunction;
    language: Language;
}> = ({ onClose, total, sales, customers, onReprintInvoice, t, language }) => {
    const locale = language === 'ar' ? 'ar-MA' : 'fr-FR';
    return (
        <div className="fixed inset-0 bg-slate-800 bg-opacity-75 flex justify-center items-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl max-w-4xl w-full p-6 max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200">{t('customItemsDetails')}</h3>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"><XIcon className="w-6 h-6"/></button>
                </div>

                <div className="bg-purple-100 dark:bg-purple-900/50 p-4 rounded-lg text-purple-800 dark:text-purple-200 mb-4">
                    <p className="font-bold">{t('totalCustomRevenue')}</p>
                    <p className="text-2xl font-extrabold">{total.toFixed(2)} DH</p>
                </div>

                <div className="flex-grow overflow-y-auto pr-2 space-y-3">
                    <h4 className="font-bold text-lg text-slate-600 dark:text-slate-300 mt-2">{t('invoiceHistory')}</h4>
                     {sales.length > 0 ? sales.slice().reverse().map(sale => (
                      <li key={sale.id} className="p-4 border dark:border-slate-700 rounded-lg list-none">
                          <div className="flex justify-between items-center">
                              <div>
                                  <p className="font-bold text-slate-800 dark:text-slate-200">{t('invoiceNumber')} {sale.id.slice(-6)}</p>
                                  <p className="text-sm text-slate-500 dark:text-slate-400">{new Date(sale.date).toLocaleString(locale)}</p>
                              </div>
                              <div className="flex items-center gap-4">
                                <div className="text-left rtl:text-right">
                                   <p className="font-bold text-lg text-cyan-600 dark:text-cyan-400">{sale.total.toFixed(2)} DH</p>
                                   <p className="text-xs text-slate-500 dark:text-slate-400">{t('profitLabel')}: {sale.profit.toFixed(2)} DH</p>
                                </div>
                                <button onClick={() => onReprintInvoice(sale)} className="text-slate-500 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 p-2 rounded-full hover:bg-teal-100 dark:hover:bg-teal-900/50 transition-colors" title={t('print')}>
                                    <PrinterIcon className="w-5 h-5"/>
                                </button>
                              </div>
                          </div>
                          <details className="mt-2 text-sm">
                            <summary className="cursor-pointer text-cyan-700 dark:text-cyan-400 font-semibold hover:text-cyan-800">{t('viewDetails')}</summary>
                            <div className="mt-2 space-y-3 pr-4 rtl:pl-4 rtl:pr-0 border-r-2 rtl:border-l-2 rtl:border-r-0 border-cyan-200 dark:border-cyan-500/30 text-slate-600 dark:text-slate-300">
                                <p><strong>{t('customer')}:</strong> {customers.find(c => c.id === sale.customerId)?.name || t('cashCustomer')}</p>
                                <p className="font-semibold">{t('customItemsInSale')}:</p>
                                <ul className="mt-2 space-y-1 pt-2 border-t border-dashed dark:border-slate-600">
                                    {sale.items.filter(i => i.isCustom).map(item => (
                                        <li key={item.id} className="flex justify-between items-center">
                                            <span className="flex items-center gap-2">
                                                <SparklesIcon className="w-4 h-4 text-purple-500 dark:text-purple-400" />
                                                {item.name} (x{item.quantity})
                                            </span>
                                            <span>{(item.price * item.quantity).toFixed(2)} DH</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                          </details>
                      </li>
                  )) : <p className="text-center text-slate-500 py-8">{t('noSalesForPeriod')}</p>}
                </div>

                <div className="pt-4 mt-4 border-t dark:border-slate-700 flex justify-end">
                    <button onClick={onClose} className="bg-gray-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold py-2 px-4 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-500">{t('close')}</button>
                </div>
            </div>
        </div>
    );
};

const EditExpenseModal: React.FC<{
    expense: Expense;
    onSave: (expense: Expense) => Promise<void>;
    onClose: () => void;
    t: TFunction;
}> = ({ expense, onSave, onClose, t }) => {
    const [editedExpense, setEditedExpense] = useState(expense);
    const [isSaving, setIsSaving] = useState(false);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { id, value } = e.target;
        setEditedExpense(prev => ({ ...prev, [id]: value }));
    };

    const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setEditedExpense(prev => ({...prev, amount: parseFloat(e.target.value) || 0}));
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        await onSave(editedExpense);
        setIsSaving(false);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-slate-800 bg-opacity-75 flex justify-center items-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl max-w-md w-full p-6">
                {/* FIX: Use 'manageExpenses' key for the translation, as 'expenses' is not a valid key. */}
                <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200 mb-4">{t('edit')} {t('manageExpenses')}</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="description" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">{t('description')}</label>
                        <input
                            type="text"
                            id="description"
                            value={editedExpense.description}
                            onChange={handleInputChange}
                            className="w-full px-4 py-2 border rounded-lg bg-gray-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 dark:border-slate-600"
                            required
                        />
                    </div>
                    <div>
                        <label htmlFor="amount" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">{t('amount')} (DH)</label>
                        <input
                            type="number"
                            id="amount"
                            value={editedExpense.amount}
                            onChange={handleAmountChange}
                            min="0"
                            step="0.01"
                            className="w-full px-4 py-2 border rounded-lg bg-gray-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 dark:border-slate-600"
                            required
                        />
                    </div>
                    <div className="flex justify-end gap-3 mt-6">
                        <button type="button" onClick={onClose} className="bg-gray-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold py-2 px-4 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-500">{t('cancel')}</button>
                        <button type="submit" disabled={isSaving} className="bg-teal-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-teal-700 disabled:bg-gray-400">
                            {/* FIX: Use template literal for 'saving' state, as 'saving' is not a valid translation key. */}
                            {isSaving ? `${t('save')}...` : t('save')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const SALES_HISTORY_PAGE_SIZE = 10;

const FinanceAndReports: React.FC<FinanceAndReportsProps> = ({ storeId, sales, expenses, purchases, suppliers, returns, customers, users, addExpense, updateExpense, deleteExpense, deleteReturn, deleteAllReturns, t, language, theme, onReprintInvoice }) => {
  const [dateRange, setDateRange] = useState('all');
  const [customRange, setCustomRange] = useState({ start: '', end: '' });
  const [view, setView] = useState<'overview' | 'debts' | 'returns' | 'expenses' | 'allPurchases' | 'supplierDebts' | 'sellerReports'>('overview');
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [showCustomItemsModal, setShowCustomItemsModal] = useState(false);
  const [salesHistoryPage, setSalesHistoryPage] = useState(1);
  
  const locale = language === 'ar' ? 'ar-MA' : 'fr-FR';

  useEffect(() => {
    setSalesHistoryPage(1);
  }, [dateRange, customRange]);

  const chartColors = useMemo(() => {
    if (theme === 'dark') {
      return {
        pie: DARK_COLORS,
        tick: '#94a3b8', // slate-400
        grid: 'rgba(94, 112, 131, 0.2)',
        tooltip: {
          backgroundColor: '#1e293b', // slate-800
          borderColor: '#334155', // slate-700
          color: '#e2e8f0' // slate-200
        },
        legend: '#e2e8f0',
        bar: '#2dd4bf' // teal-400
      };
    }
    return {
      pie: COLORS,
      tick: '#475569', // slate-600
      grid: '#e2e8f0',
      tooltip: {
        backgroundColor: '#ffffff',
        borderColor: '#e2e8f0',
        color: '#1e293b'
      },
      legend: '#334155',
      bar: '#26A69A'
    };
  }, [theme]);


  const filteredSales = useMemo(() => filterByDateRange(sales, dateRange, customRange), [sales, dateRange, customRange]);
  const filteredExpenses = useMemo(() => filterByDateRange(expenses, dateRange, customRange).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()), [expenses, dateRange, customRange]);
  const filteredReturns = useMemo(() => filterByDateRange(returns, dateRange, customRange), [returns, dateRange, customRange]);
  const filteredPurchases = useMemo(() => filterByDateRange(purchases, dateRange, customRange), [purchases, dateRange, customRange]);

  const { totalRevenue, totalReturnsAmount, netRevenue, totalExpenses, netProfit, totalCustomerDebts, debtsByCustomer, totalCostOfGoods, totalSupplierDebt, debtsBySupplier, totalCustomItemSales } = useMemo(() => {
    let totalRevenue = 0; // Will be non-custom items revenue
    let totalCustomItemSales = 0;
    
    filteredSales.forEach(sale => {
        const saleTotal = sale.total;
        const nonCustomItemsTotal = sale.items
            .filter(item => !item.isCustom)
            .reduce((sum, item) => sum + item.price * item.quantity, 0);
        
        // This logic ensures if manual total was used, it's pro-rated
        const customItemsTotal = saleTotal - nonCustomItemsTotal;
        
        totalCustomItemSales += customItemsTotal;
        totalRevenue += nonCustomItemsTotal;
    });
    
    let totalReturnsAmount = 0; // for non-custom items
    filteredReturns.forEach(ret => {
        ret.items.forEach(item => {
            if (!item.isCustom) {
                totalReturnsAmount += item.price * item.quantity;
            }
        });
    });
    
    const netRevenue = totalRevenue - totalReturnsAmount;
    
    const totalExpenses = filteredExpenses.reduce((acc, expense) => acc + expense.amount, 0);
    
    const totalProfitFromSales = filteredSales.reduce((acc, sale) => acc + sale.profit, 0);
    const totalProfitLostFromReturns = filteredReturns.reduce((acc, ret) => acc + ret.profitLost, 0);
    const netProfit = totalProfitFromSales - totalProfitLostFromReturns - totalExpenses;

    // Debts are calculated from ALL sales/purchases, not just the filtered date range
    const customerDebtsMap = new Map<string, { customer: Customer; debt: number }>();
    let totalCustomerDebts = 0;
    sales.forEach(sale => {
        if (sale.customerId && sale.remainingAmount > 0) {
            totalCustomerDebts += sale.remainingAmount;
            const customer = customers.find(c => c.id === sale.customerId);
            if (customer) {
                const currentDebt = customerDebtsMap.get(sale.customerId)?.debt || 0;
                customerDebtsMap.set(sale.customerId, { customer, debt: currentDebt + sale.remainingAmount });
            }
        }
    });

    const supplierDebtsMap = new Map<string, { supplier: Supplier; debt: number }>();
    let totalSupplierDebt = 0;
    purchases.forEach(purchase => {
        if (purchase.remainingAmount > 0) {
            totalSupplierDebt += purchase.remainingAmount;
            const supplier = suppliers.find(s => s.id === purchase.supplierId);
            if(supplier) {
                const currentDebt = supplierDebtsMap.get(purchase.supplierId)?.debt || 0;
                supplierDebtsMap.set(purchase.supplierId, { supplier, debt: currentDebt + purchase.remainingAmount });
            }
        }
    });

    const totalCostOfGoods = purchases.reduce((acc, p) => acc + p.totalAmount, 0);
    
    return { 
        totalRevenue, totalReturnsAmount, netRevenue, totalExpenses, netProfit, 
        totalCustomerDebts, debtsByCustomer: Array.from(customerDebtsMap.values()).sort((a,b) => b.debt - a.debt),
        totalCostOfGoods, totalSupplierDebt, debtsBySupplier: Array.from(supplierDebtsMap.values()).sort((a,b) => b.debt - a.debt),
        totalCustomItemSales
    };
  }, [filteredSales, filteredExpenses, filteredReturns, sales, customers, purchases, suppliers]);

  const salesByDay = useMemo(() => {
    const data: { [key: string]: number } = {};
    const dayFormat: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit' };
    filteredSales.forEach(sale => {
      const day = new Date(sale.date).toLocaleDateString(locale, dayFormat);
      if (!data[day]) data[day] = 0;
      
      const nonCustomTotal = sale.items
        .filter(item => !item.isCustom)
        .reduce((sum, item) => sum + item.price * item.quantity, 0);
      data[day] += nonCustomTotal;
    });

    filteredReturns.forEach(ret => {
        const day = new Date(ret.date).toLocaleDateString(locale, dayFormat);
        if (data[day]) {
            const nonCustomReturnAmount = ret.items
                .filter(item => !item.isCustom)
                .reduce((sum, item) => sum + item.price * item.quantity, 0);
            data[day] -= nonCustomReturnAmount;
        }
        if(data[day] < 0) data[day] = 0; // Prevent negative bars
    });

    return Object.entries(data).map(([name, total]) => ({ name, [t('sales')]: total })).reverse();
  }, [filteredSales, filteredReturns, locale, t]);

  const topSellingVariants = useMemo(() => {
    const variantSales: { [key: string]: { name: string; quantity: number } } = {};
    filteredSales.forEach(sale => {
        sale.items.forEach(item => {
            if (item.type === 'good') {
                if(!variantSales[item.id]) variantSales[item.id] = { name: item.name, quantity: 0 };
                variantSales[item.id].quantity += item.quantity;
            }
        });
    });

    filteredReturns.forEach(ret => {
        ret.items.forEach(item => {
            if(item.type === 'good' && variantSales[item.id]) {
                variantSales[item.id].quantity -= item.quantity;
            }
        });
    });

    return Object.values(variantSales)
        .filter(({ quantity }) => quantity > 0)
        .map(({ name, quantity }) => ({ name, value: quantity }))
        .sort((a,b) => b.value - a.value)
        .slice(0, 6);
  }, [filteredSales, filteredReturns]);

  const salesForHistoryView = useMemo(() => {
      return filteredSales.filter(sale => !sale.items.some(item => item.isCustom)).slice().reverse();
  }, [filteredSales]);

  const customItemSales = useMemo(() => {
      return filteredSales.filter(sale => sale.items.some(item => item.isCustom));
  }, [filteredSales]);

  const ExpensesView = () => {
    const [newExpense, setNewExpense] = useState({ description: '', amount: '' });
    const descriptionInputRef = useRef<HTMLInputElement>(null);

    const handleAddExpense = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newExpense.description || !newExpense.amount) {
            alert(t('fillAllFields'));
            return;
        }
        await addExpense({
            storeId,
            description: newExpense.description,
            amount: parseFloat(newExpense.amount),
            date: new Date().toISOString(),
        });
        setNewExpense({ description: '', amount: '' });
        descriptionInputRef.current?.focus();
    };

    const handleDeleteExpense = (id: string) => {
        deleteExpense(id);
    };

    const handleExport = () => {
        const headers = [t('date'), t('description'), t('amount')];
        const data = filteredExpenses.map(exp => [
            new Date(exp.date).toLocaleDateString(locale),
            exp.description,
            `${exp.amount.toFixed(2)} DH`
        ]);
        exportToPdf(t('expenseHistory'), headers, data, 'expenses_report', language, t('noDataToExport'));
    };
    
    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg">
             <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-slate-700 dark:text-slate-200">{t('manageExpenses')}</h2>
                <button onClick={() => setView('overview')} className="bg-gray-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold py-2 px-4 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-600">
                    &larr; {t('goBack')}
                </button>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1">
                    <h3 className="font-bold text-lg text-slate-600 dark:text-slate-300 mb-3">{t('addExpense')}</h3>
                    <form onSubmit={handleAddExpense} className="space-y-4">
                        <div>
                            <label htmlFor="exp-description" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">{t('description')}</label>
                            <input
                                ref={descriptionInputRef}
                                type="text"
                                id="exp-description"
                                value={newExpense.description}
                                onChange={e => setNewExpense({ ...newExpense, description: e.target.value })}
                                className="w-full px-4 py-2 border rounded-lg bg-gray-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 dark:border-slate-600"
                                required
                            />
                        </div>
                        <div>
                            <label htmlFor="exp-amount" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">{t('amount')} (DH)</label>
                            <input
                                type="number"
                                id="exp-amount"
                                value={newExpense.amount}
                                onChange={e => setNewExpense({ ...newExpense, amount: e.target.value })}
                                min="0"
                                step="0.01"
                                className="w-full px-4 py-2 border rounded-lg bg-gray-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 dark:border-slate-600"
                                required
                            />
                        </div>
                        <button type="submit" className="w-full bg-teal-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-teal-700 transition-colors">{t('addExpense')}</button>
                    </form>
                </div>
                <div className="lg:col-span-2">
                     <div className="flex justify-between items-center mb-3">
                        <h3 className="font-bold text-lg text-slate-600 dark:text-slate-300">{t('expenseHistory')}</h3>
                        <button onClick={handleExport} className="bg-cyan-600 text-white font-semibold py-1 px-3 rounded-lg hover:bg-cyan-700 transition-colors flex items-center gap-2 text-xs">
                            <FileDownIcon className="w-4 h-4"/> {t('exportToPdf')}
                        </button>
                    </div>
                    <div className="max-h-96 overflow-y-auto pl-2 space-y-3">
                        {filteredExpenses.length > 0 ? filteredExpenses.map(exp => (
                            <div key={exp.id} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700">
                                <div>
                                    <p className="font-semibold text-slate-700 dark:text-slate-200">{exp.description}</p>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">{new Date(exp.date).toLocaleDateString(locale)}</p>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="font-bold text-red-600 dark:text-red-400">{exp.amount.toFixed(2)} DH</span>
                                    <button onClick={() => setEditingExpense(exp)} className="text-cyan-600 dark:text-cyan-400 hover:text-cyan-800 dark:hover:text-cyan-300"><EditIcon className="w-5 h-5"/></button>
                                    <button onClick={() => handleDeleteExpense(exp.id)} className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"><TrashIcon className="w-5 h-5"/></button>
                                </div>
                            </div>
                        )) : <p className="text-center text-slate-500 dark:text-slate-400 py-8">{t('noExpensesForPeriod')}</p>}
                    </div>
                </div>
            </div>
        </div>
    );
  }
  
  const DebtsView = () => (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg">
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-slate-700 dark:text-slate-200">{t('debtorCustomers')}</h2>
             <div className="flex items-center gap-4">
                <button onClick={() => {
                    const headers = [t('name'), t('phone'), t('debtAmount')];
                    const data = debtsByCustomer.map(d => [d.customer.name, d.customer.phone, `${d.debt.toFixed(2)} DH`]);
                    exportToPdf(t('debtorCustomers'), headers, data, 'customer_debts', language, t('noDataToExport'));
                }} className="bg-cyan-600 text-white font-semibold py-2 px-3 rounded-lg hover:bg-cyan-700 transition-colors flex items-center gap-2 text-sm">
                    <FileDownIcon className="w-4 h-4"/> {t('exportToPdf')}
                </button>
                <button onClick={() => setView('overview')} className="bg-gray-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold py-2 px-4 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-600">
                    &larr; {t('goBack')}
                </button>
            </div>
        </div>
        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-sm text-right rtl:text-right text-slate-500 dark:text-slate-400">
             <thead className="text-xs text-slate-600 dark:text-slate-300 uppercase bg-gray-50 dark:bg-slate-700 sticky top-0">
                <tr>
                  <th scope="col" className="px-6 py-3">{t('name')}</th>
                  <th scope="col" className="px-6 py-3">{t('phone')}</th>
                  <th scope="col" className="px-6 py-3">{t('debtAmount')}</th>
                </tr>
              </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
              {debtsByCustomer.length > 0 ? debtsByCustomer.map(({ customer, debt }) => (
                <tr key={customer.id} className="bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700/50">
                  <th scope="row" className="px-6 py-4 font-medium text-slate-700 dark:text-slate-100 whitespace-nowrap">{customer.name}</th>
                  <td className="px-6 py-4">{customer.phone}</td>
                  <td className="px-6 py-4 font-bold text-red-600 dark:text-red-400">
                    {debt.toFixed(2)} DH
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={3} className="text-center text-slate-500 dark:text-slate-400 py-8">{t('noDebtorCustomers')}</td>
                </tr>
              )}
            </tbody>
           </table>
        </div>
    </div>
  );

  const ReturnsView = () => (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg">
        <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
            <h2 className="text-2xl font-bold text-slate-700 dark:text-slate-200">{t('returnHistory')}</h2>
            <div className="flex items-center gap-4 flex-wrap">
                <button onClick={() => {
                    const headers = [t('returnId'), t('date'), t('refundAmount'), t('profitLost'), t('itemsLabel')];
                    const data = filteredReturns.map(r => [
                        r.id.slice(-6),
                        new Date(r.date).toLocaleString(locale),
                        `${r.refundAmount.toFixed(2)} DH`,
                        `${r.profitLost.toFixed(2)} DH`,
                        r.items.map(i => `${i.name} (x${i.quantity})`).join(', ')
                    ]);
                    exportToPdf(t('returnHistory'), headers, data, 'returns_report', language, t('noDataToExport'));
                }} className="bg-gray-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold py-2 px-3 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors flex items-center gap-2 text-sm">
                    <FileDownIcon className="w-4 h-4"/> {t('exportToPdf')}
                </button>
                <button onClick={deleteAllReturns} className="bg-red-600 text-white font-semibold py-2 px-3 rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2 text-sm">
                    <TrashIcon className="w-4 h-4"/> {t('deleteHistory')}
                </button>
                <button onClick={() => setView('overview')} className="bg-gray-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold py-2 px-4 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-600">
                    &larr; {t('goBack')}
                </button>
            </div>
        </div>
        <div className="max-h-96 overflow-y-auto pl-2">
          <ul className="space-y-4">
              {filteredReturns.length > 0 ? filteredReturns.slice().reverse().map(ret => (
                  <li key={ret.id} className="p-4 border dark:border-slate-700 rounded-lg bg-orange-50 dark:bg-orange-900/20">
                      <div className="flex justify-between items-start">
                          <div>
                              <p className="font-bold text-slate-800 dark:text-slate-200">{t('returnId')} {ret.id.slice(-6)}</p>
                              <p className="text-sm text-slate-500 dark:text-slate-400">{new Date(ret.date).toLocaleString(locale)}</p>
                          </div>
                          <div className="text-left rtl:text-right">
                             <p className="font-bold text-lg text-orange-600 dark:text-orange-400">{ret.refundAmount.toFixed(2)} DH</p>
                             <p className="text-xs text-slate-500 dark:text-slate-400">{t('profitLost')}: {ret.profitLost.toFixed(2)} DH</p>
                          </div>
                      </div>
                      <div className="flex justify-end mt-2">
                        <button onClick={() => deleteReturn(ret.id)} className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-xs font-semibold flex items-center gap-1">
                            <TrashIcon className="w-4 h-4"/> {t('delete')}
                        </button>
                      </div>
                      <details className="mt-2 text-sm">
                        <summary className="cursor-pointer text-orange-700 dark:text-orange-400 font-semibold hover:text-orange-800">{t('returnedItems')}</summary>
                        <ul className="mt-2 space-y-1 pt-2 pr-4 rtl:pl-4 rtl:pr-0 border-r-2 rtl:border-l-2 rtl:border-r-0 border-orange-200 dark:border-orange-500/30">
                            {ret.items.map(item => (
                                <li key={item.id} className="flex justify-between items-center text-slate-700 dark:text-slate-300">
                                    <span className="flex items-center gap-2">
                                        {item.type === 'service' && <SparklesIcon className="w-4 h-4 text-purple-500 dark:text-purple-400" />}
                                        {item.name} (x{item.quantity})
                                    </span>
                                    <span>{(item.price * item.quantity).toFixed(2)} DH</span>
                                </li>
                            ))}
                        </ul>
                      </details>
                  </li>
              )) : <p className="text-center text-slate-500 dark:text-slate-400 py-8">{t('noReturnsForPeriod')}</p>}
          </ul>
        </div>
    </div>
  );

  const AllPurchasesView = () => (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg">
      <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
        <h2 className="text-2xl font-bold text-slate-700 dark:text-slate-200">{t('allPurchasesHistory')}</h2>
        <div className="flex items-center gap-4">
          <button onClick={() => {
              const headers = [t('date'), t('suppliers'), t('reference'), t('totalAmount'), t('amountPaid'), t('remainingAmountLabel'), t('paymentMethod')];
              const data = filteredPurchases.map(p => [
                  new Date(p.date).toLocaleDateString(locale),
                  suppliers.find(s => s.id === p.supplierId)?.name || 'N/A',
                  p.reference && p.reference.startsWith('purchase_ref_') ? t(p.reference as any) : (p.reference || ''),
                  `${p.totalAmount.toFixed(2)} DH`,
                  `${p.amountPaid.toFixed(2)} DH`,
                  `${p.remainingAmount.toFixed(2)} DH`,
                  t(p.paymentMethod as keyof typeof translations.fr)
              ]);
              exportToPdf(t('allPurchasesHistory'), headers, data, 'all_purchases_report', language, t('noDataToExport'));
          }} className="bg-cyan-600 text-white font-semibold py-2 px-3 rounded-lg hover:bg-cyan-700 transition-colors flex items-center gap-2 text-sm">
            <FileDownIcon className="w-4 h-4"/> {t('exportToPdf')}
          </button>
          <button onClick={() => setView('overview')} className="bg-gray-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold py-2 px-4 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-600">
            &larr; {t('goBack')}
          </button>
        </div>
      </div>
      <div className="max-h-[60vh] overflow-y-auto pr-2">
        {filteredPurchases.length > 0 ? (
          <ul className="space-y-4">
            {filteredPurchases.slice().reverse().map(p => (
              <li key={p.id} className="bg-gray-50 dark:bg-slate-800/50 p-4 rounded-lg">
                <div className="flex justify-between items-start mb-2 flex-wrap gap-2">
                  <div>
                    {/* FIX: Use 'suppliers' key for the translation, as 'supplier' is not a valid key. */}
                    <p className="font-bold text-slate-800 dark:text-slate-200">{t('suppliers')}: {suppliers.find(s => s.id === p.supplierId)?.name || 'N/A'}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{t('date')}: {new Date(p.date).toLocaleDateString(locale)}</p>
                    {p.reference && <p className="text-sm text-slate-500 dark:text-slate-400">{t('reference')}: {(p.reference.startsWith('purchase_ref_') ? t(p.reference as any) : p.reference)}</p>}
                  </div>
                  <div className='text-right rtl:text-left'>
                    <p className="font-bold text-teal-600 dark:text-teal-400 text-lg">{p.totalAmount.toFixed(2)} DH</p>
                    {p.remainingAmount > 0 && <span className="text-xs font-semibold px-2 py-1 rounded-full bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300">{t('remainingDebt')}: {p.remainingAmount.toFixed(2)} DH</span>}
                  </div>
                </div>
                <details>
                  <summary className="text-sm font-semibold text-teal-700 dark:text-teal-400 cursor-pointer">{t('purchaseDetails')}</summary>
                   <table className="w-full text-sm mt-2 border-collapse">
                    <thead className="text-slate-600 dark:text-slate-300">
                      <tr className="bg-slate-200 dark:bg-slate-700">
                        {/* FIX: Use 'products' key for the translation, as 'product' is not a valid key. */}
                        <th className="p-2 text-start rtl:text-right font-semibold">{t('products')}</th>
                        <th className="p-2 text-center font-semibold">{t('quantity')}</th>
                        <th className="p-2 text-center font-semibold">{t('purchasePrice')}</th>
                        <th className="p-2 text-start rtl:text-right font-semibold">{t('total')}</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-slate-800">
                      {p.items.map((item, index) => (
                        <tr key={index} className="border-b border-gray-200 dark:border-slate-700 last:border-b-0">
                          <td className="p-2 text-start rtl:text-right font-medium text-slate-800 dark:text-slate-200">{item.productName} - {item.variantName}</td>
                          <td className="p-2 text-center">
                            <span className="font-bold text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-700 px-3 py-1 rounded-md inline-block min-w-[4ch]">
                                {item.quantity}
                            </span>
                          </td>
                          <td className="p-2 text-center">
                             <span className="font-semibold text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-700 px-3 py-1 rounded-md inline-block">
                                {item.purchasePrice.toFixed(2)} DH
                            </span>
                          </td>
                          <td className="p-2 text-start rtl:text-right">
                            <span className="font-bold text-white bg-blue-600 px-3 py-1 rounded-md inline-block">
                                {(item.quantity * item.purchasePrice).toFixed(2)} DH
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              </li>
            ))}
          </ul>
        ) : <p className="text-center text-slate-500 dark:text-slate-400 py-16">{t('noPurchasesRecorded')}</p>}
      </div>
    </div>
  );

  const SupplierDebtsView = () => (
      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg">
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-slate-700 dark:text-slate-200">{t('supplierDebtsList')}</h2>
             <div className="flex items-center gap-4">
                <button onClick={() => {
                    const headers = [t('suppliers'), t('phone'), t('debtAmount')];
                    const data = debtsBySupplier.map(d => [d.supplier.name, d.supplier.phone, `${d.debt.toFixed(2)} DH`]);
                    exportToPdf(t('supplierDebtsList'), headers, data, 'supplier_debts_report', language, t('noDataToExport'));
                }} className="bg-cyan-600 text-white font-semibold py-2 px-3 rounded-lg hover:bg-cyan-700 transition-colors flex items-center gap-2 text-sm">
                    <FileDownIcon className="w-4 h-4"/> {t('exportToPdf')}
                </button>
                <button onClick={() => setView('overview')} className="bg-gray-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold py-2 px-4 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-600">
                    &larr; {t('goBack')}
                </button>
            </div>
        </div>
        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-sm text-right rtl:text-right text-slate-500 dark:text-slate-400">
             <thead className="text-xs text-slate-600 dark:text-slate-300 uppercase bg-gray-50 dark:bg-slate-700 sticky top-0">
                <tr>
                  {/* FIX: Use 'suppliers' key for the translation, as 'supplier' is not a valid key. */}
                  <th scope="col" className="px-6 py-3">{t('suppliers')}</th>
                  <th scope="col" className="px-6 py-3">{t('phone')}</th>
                  <th scope="col" className="px-6 py-3">{t('debtAmount')}</th>
                </tr>
              </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
              {debtsBySupplier.length > 0 ? debtsBySupplier.map(({ supplier, debt }) => (
                <tr key={supplier.id} className="bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700/50">
                  <th scope="row" className="px-6 py-4 font-medium text-slate-700 dark:text-slate-100 whitespace-nowrap">{supplier.name}</th>
                  <td className="px-6 py-4">{supplier.phone}</td>
                  <td className="px-6 py-4 font-bold text-red-600 dark:text-red-400">
                    {debt.toFixed(2)} DH
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={3} className="text-center text-slate-500 dark:text-slate-400 py-8">{t('noSupplierDebt')}</td>
                </tr>
              )}
            </tbody>
           </table>
        </div>
    </div>
  );
  
  const SellerReportsView = () => {
    const [selectedUserId, setSelectedUserId] = useState<string>('');
    
    const { reportSales, reportReturns, kpis } = useMemo(() => {
        let salesToFilter = filteredSales;
        let returnsToFilter = filteredReturns;
        
        if (selectedUserId) {
            salesToFilter = salesToFilter.filter(s => s.userId === selectedUserId);
            returnsToFilter = returnsToFilter.filter(r => r.userId === selectedUserId);
        }

        const totalSales = salesToFilter.reduce((sum, s) => sum + s.total, 0);
        const totalReturns = returnsToFilter.reduce((sum, r) => sum + r.refundAmount, 0);
        
        return {
            reportSales: salesToFilter,
            reportReturns: returnsToFilter,
            kpis: {
                totalSales,
                totalReturns,
                netActivity: totalSales - totalReturns,
                salesCount: salesToFilter.length,
                returnsCount: returnsToFilter.length
            }
        };
    }, [filteredSales, filteredReturns, selectedUserId]);

    const combinedTransactions = useMemo(() => {
        const salesTx = reportSales.map(s => ({...s, type: 'sale' as const}));
        const returnsTx = reportReturns.map(r => ({...r, type: 'return' as const}));
        return [...salesTx, ...returnsTx].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [reportSales, reportReturns]);

    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg">
            <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
                <h2 className="text-2xl font-bold text-slate-700 dark:text-slate-200">{t('sellerReportsAndZReport')}</h2>
                <div className="flex items-center gap-4">
                    <select
                        value={selectedUserId}
                        onChange={e => setSelectedUserId(e.target.value)}
                        className="p-2 border rounded-lg bg-gray-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 dark:border-slate-600"
                    >
                        <option value="">{t('all')}</option>
                        {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                     <button onClick={() => setView('overview')} className="bg-gray-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold py-2 px-4 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-600">
                        &larr; {t('goBack')}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                 <div className="bg-teal-100 dark:bg-teal-900/50 p-4 rounded-xl text-teal-800 dark:text-teal-200">
                    <h3 className="font-bold text-md">{t('netActivity')}</h3>
                    <p className="text-2xl font-extrabold">{kpis.netActivity.toFixed(2)} <span className="text-md font-medium">DH</span></p>
                </div>
                 <div className="bg-green-100 dark:bg-green-900/50 p-4 rounded-xl text-green-800 dark:text-green-200">
                    <h3 className="font-bold text-md">{t('totalSales')}</h3>
                    <p className="text-2xl font-extrabold">{kpis.totalSales.toFixed(2)} <span className="text-md font-medium">DH</span></p>
                    <p className="text-xs">{t('numberOfSales', { count: kpis.salesCount })}</p>
                </div>
                 <div className="bg-orange-100 dark:bg-orange-900/50 p-4 rounded-xl text-orange-800 dark:text-orange-200">
                    <h3 className="font-bold text-md">{t('totalReturns')}</h3>
                    <p className="text-2xl font-extrabold">{kpis.totalReturns.toFixed(2)} <span className="text-md font-medium">DH</span></p>
                    <p className="text-xs">{t('numberOfReturns', { count: kpis.returnsCount })}</p>
                </div>
            </div>
            
            <h3 className="font-bold text-lg text-slate-600 dark:text-slate-300 mb-3">{t('transactionList')}</h3>
            <div className="max-h-[50vh] overflow-y-auto pr-2">
                {combinedTransactions.length > 0 ? (
                    <table className="w-full text-sm text-right rtl:text-right text-slate-500 dark:text-slate-400">
                        <thead className="text-xs text-slate-600 dark:text-slate-300 uppercase bg-gray-50 dark:bg-slate-700 sticky top-0">
                            <tr>
                                <th scope="col" className="px-6 py-3">{t('date')}</th>
                                <th scope="col" className="px-6 py-3">{t('transactionType')}</th>
                                <th scope="col" className="px-6 py-3">{t('amount')}</th>
                                {/* FIX: Use 'viewDetails' key for the translation, as 'details' is not a valid key. */}
                                <th scope="col" className="px-6 py-3">{t('viewDetails')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                            {combinedTransactions.map(tx => (
                                <tr key={`${tx.type}-${tx.id}`} className="bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                    <td className="px-6 py-4">{new Date(tx.date).toLocaleString(locale)}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${tx.type === 'sale' ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' : 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300'}`}>
                                            {/* FIX: Use appropriate translation keys for 'sale' and 'return' types. */}
                                            {t(tx.type === 'sale' ? 'sales' : 'returnMode')}
                                        </span>
                                    </td>
                                    <td className={`px-6 py-4 font-bold ${tx.type === 'sale' ? 'text-green-700 dark:text-green-400' : 'text-orange-700 dark:text-orange-400'}`}>
                                        {tx.type === 'sale' ? tx.total.toFixed(2) : tx.refundAmount.toFixed(2)} DH
                                    </td>
                                    <td className="px-6 py-4">
                                        <details className="text-xs">
                                            <summary className="cursor-pointer font-semibold text-cyan-700 dark:text-cyan-400">{tx.items.length} {t('itemsLabel')}</summary>
                                            <ul className="mt-1 text-slate-600 dark:text-slate-300">
                                                {tx.items.map((item, i) => <li key={i}>{item.name} (x{item.quantity})</li>)}
                                            </ul>
                                        </details>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : <p className="text-center text-slate-500 dark:text-slate-400 py-8">{t('noTransactionsForSeller')}</p>}
            </div>
        </div>
    );
  };


  const OverviewView = () => {
    const totalSalesPages = Math.ceil(salesForHistoryView.length / SALES_HISTORY_PAGE_SIZE);
    const paginatedSales = salesForHistoryView.slice((salesHistoryPage - 1) * SALES_HISTORY_PAGE_SIZE, salesHistoryPage * SALES_HISTORY_PAGE_SIZE);

    return (
      <div className="space-y-6">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-lg flex flex-wrap items-center gap-4">
            <h3 className="font-bold text-gray-700 dark:text-gray-300">{t('filterByPeriod')}</h3>
            <select value={dateRange} onChange={e => setDateRange(e.target.value)} className="p-2 border rounded-lg bg-gray-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 dark:border-slate-600">
                <option value="all">{t('all')}</option>
                <option value="today">{t('today')}</option>
                <option value="week">{t('thisWeek')}</option>
                <option value="month">{t('thisMonth')}</option>
                <option value="custom">{t('customRange')}</option>
            </select>
            {dateRange === 'custom' && (
                <div className="flex gap-2">
                    <input type="date" value={customRange.start} onChange={e => setCustomRange({...customRange, start: e.target.value})} className="p-2 border rounded-lg bg-gray-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 dark:border-slate-600"/>
                    <input type="date" value={customRange.end} onChange={e => setCustomRange({...customRange, end: e.target.value})} className="p-2 border rounded-lg bg-gray-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 dark:border-slate-600"/>
                </div>
            )}
        </div>

        <div className="relative">
             <button
                onClick={() => setShowCustomItemsModal(true)}
                className="absolute top-2 right-2 rtl:right-auto rtl:left-2 z-10 bg-purple-600 text-white rounded-full w-10 h-10 flex items-center justify-center shadow-lg hover:bg-purple-700 transition-transform hover:scale-110"
                title={t('customItemsDetails')}
              >
                <SparklesIcon className="w-6 h-6" />
              </button>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              <div className="bg-teal-100 dark:bg-teal-900/50 p-6 rounded-xl shadow text-teal-800 dark:text-teal-200">
                <h3 className="font-bold text-lg">{t('netRevenue')}</h3>
                <p className="text-3xl font-extrabold">{netRevenue.toFixed(2)} <span className="text-lg font-medium">DH</span></p>
                <p className="text-xs opacity-80">{t('totalRevenueMinusReturns')}</p>
              </div>
              <div className="bg-cyan-100 dark:bg-cyan-900/50 p-6 rounded-xl shadow text-cyan-800 dark:text-cyan-200">
                <h3 className="font-bold text-lg">{t('netProfit')}</h3>
                <p className="text-3xl font-extrabold">{netProfit.toFixed(2)} <span className="text-lg font-medium">DH</span></p>
                <p className="text-xs opacity-80">{t('realizedProfitMinusExpenses')}</p>
              </div>
              <div 
                  className="bg-yellow-100 dark:bg-yellow-900/50 p-6 rounded-xl shadow text-yellow-800 dark:text-yellow-200 cursor-pointer hover:ring-2 ring-yellow-400 transition-all"
                  onClick={() => setView('debts')}
              >
                <h3 className="font-bold text-lg">{t('customerDebts')}</h3>
                <p className="text-3xl font-extrabold">{totalCustomerDebts.toFixed(2)} <span className="text-lg font-medium">DH</span></p>
                <p className="text-xs opacity-80">{t('clickToViewDetails')}</p>
              </div>
               <div 
                  className="bg-red-100 dark:bg-red-900/50 p-6 rounded-xl shadow text-red-800 dark:text-red-200 cursor-pointer hover:ring-2 ring-red-400 transition-all"
                  onClick={() => setView('supplierDebts')}
              >
                <h3 className="font-bold text-lg">{t('totalSupplierDebt')}</h3>
                <p className="text-3xl font-extrabold">{totalSupplierDebt.toFixed(2)} <span className="text-lg font-medium">DH</span></p>
                <p className="text-xs opacity-80">{t('clickToViewDetails')}</p>
              </div>
              <div 
                className="bg-red-100/70 dark:bg-red-900/30 p-6 rounded-xl shadow text-red-900 dark:text-red-300 cursor-pointer hover:ring-2 ring-red-400 transition-all"
                onClick={() => setView('expenses')}>
                <h3 className="font-bold text-lg">{t('totalExpenses')}</h3>
                <p className="text-3xl font-extrabold">{totalExpenses.toFixed(2)} <span className="text-lg font-medium">DH</span></p>
                <p className="text-xs opacity-80">{t('clickToViewDetails')}</p>
              </div>
              <div 
                className="bg-purple-100 dark:bg-purple-900/50 p-6 rounded-xl shadow text-purple-800 dark:text-purple-200 cursor-pointer hover:ring-2 ring-purple-400 transition-all"
                onClick={() => setView('allPurchases')}>
                <h3 className="font-bold text-lg">{t('totalCostOfGoods')}</h3>
                <p className="text-3xl font-extrabold">{totalCostOfGoods.toFixed(2)} <span className="text-lg font-medium">DH</span></p>
                <p className="text-xs opacity-80">{t('clickToViewDetails')}</p>
              </div>
              <div 
                className="col-span-2 md:col-span-1 lg:col-span-1 bg-blue-100 dark:bg-blue-900/50 p-6 rounded-xl shadow text-blue-800 dark:text-blue-200 cursor-pointer hover:ring-2 ring-blue-400 transition-all"
                onClick={() => setView('sellerReports')}>
                <h3 className="font-bold text-lg flex items-center gap-2"><UsersIcon /> {t('sellerReportsAndZReport')}</h3>
                <p className="text-3xl font-extrabold">{sales.length} <span className="text-lg font-medium">{t('sales')}</span></p>
                <p className="text-xs opacity-80">{t('clickToViewDetails')}</p>
              </div>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-2xl font-bold text-slate-700 dark:text-slate-200">{t('salesPerformance')}</h2>
                  <button onClick={() => {
                      const headers = [t('date'), t('sales')];
                      const data = salesByDay.map(d => [d.name, `${((d[t('sales')] as number) || 0).toFixed(2)} DH`]);
                      exportToPdf(t('salesPerformance'), headers, data, 'daily_sales_performance', language, t('noDataToExport'));
                  }} className="bg-gray-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold py-1 px-3 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors flex items-center gap-2 text-xs">
                      <FileDownIcon className="w-4 h-4"/> {t('exportToPdf')}
                  </button>
                </div>
              <div style={{ width: '100%', height: 300 }}>
                  <ResponsiveContainer>
                      <BarChart data={salesByDay} margin={{ top: 5, right: 0, left: 0, bottom: 5 }}>
                          <CartesianGrid stroke={chartColors.grid} />
                          <XAxis dataKey="name" tick={{ fill: chartColors.tick, fontSize: 12 }} />
                          <YAxis tick={{ fill: chartColors.tick, fontSize: 12 }} tickFormatter={(value) => `${value}`} />
                          <Tooltip 
                            contentStyle={chartColors.tooltip} 
                            labelStyle={{ color: chartColors.tooltip.color }}
                            formatter={(value: number) => [`${value.toFixed(2)} DH`, t('sales')]} 
                           />
                          <Legend wrapperStyle={{ color: chartColors.legend }} />
                          <Bar dataKey={t('sales')} fill={chartColors.bar} />
                      </BarChart>
                  </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-2xl font-bold text-slate-700 dark:text-slate-200">{t('topSellingProducts')}</h2>
                  <button onClick={() => {
                        const headers = [t('products'), t('quantity')];
                        const data = topSellingVariants.map(p => [p.name, p.value]);
                        exportToPdf(t('topSellingProducts'), headers, data, 'top_selling_products', language, t('noDataToExport'));
                  }} className="bg-gray-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold py-1 px-3 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors flex items-center gap-2 text-xs">
                      <FileDownIcon className="w-4 h-4"/> {t('exportToPdf')}
                  </button>
                </div>
              <div style={{ width: '100%', height: 300 }}>
                   <ResponsiveContainer>
                      <PieChart>
                          <Pie data={topSellingVariants} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} fill="#8884d8" label={{ fill: chartColors.legend }}>
                               {topSellingVariants.map((entry, index) => <Cell key={`cell-${index}`} fill={chartColors.pie[index % chartColors.pie.length]} />)}
                          </Pie>
                          <Tooltip 
                            contentStyle={chartColors.tooltip} 
                            formatter={(value:number, name:string) => [`${value} ${t('units')}`, name]}/>
                          <Legend wrapperStyle={{ color: chartColors.legend }}/>
                      </PieChart>
                  </ResponsiveContainer>
              </div>
            </div>
        </div>
        
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg">
          <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-slate-700 dark:text-slate-200">{t('salesHistory')}</h2>
              <button onClick={() => {
                  const headers = [t('invoiceNumber'), t('date'), t('customer'), t('total'), t('profitLabel'), t('itemsLabel')];
                  const data = salesForHistoryView.slice().reverse().map(sale => [
                    sale.id.slice(-6).toUpperCase(),
                    new Date(sale.date).toLocaleString(locale),
                    customers.find(c => c.id === sale.customerId)?.name || t('cashCustomer'),
                    `${sale.total.toFixed(2)} DH`,
                    `${sale.profit.toFixed(2)} DH`,
                    sale.items.map(i => `${i.name} (x${i.quantity})`).join(', ')
                  ]);
                  exportToPdf(t('salesHistory'), headers, data, 'sales_history', language, t('noDataToExport'));
              }} className="bg-cyan-600 text-white font-semibold py-2 px-3 rounded-lg hover:bg-cyan-700 transition-colors flex items-center gap-2 text-sm">
                  <FileDownIcon className="w-4 h-4"/> {t('exportToPdf')}
              </button>
          </div>
          <div className="max-h-96 overflow-y-auto pl-2">
              <ul className="space-y-4">
                  {paginatedSales.length > 0 ? paginatedSales.map(sale => (
                      <li key={sale.id} className="p-4 border dark:border-slate-700 rounded-lg">
                          <div className="flex justify-between items-center">
                              <div>
                                  <p className="font-bold text-slate-800 dark:text-slate-200">{t('invoiceNumber')} {sale.id.slice(-6)}</p>
                                  <p className="text-sm text-slate-500 dark:text-slate-400">{new Date(sale.date).toLocaleString(locale)}</p>
                              </div>
                              <div className="flex items-center gap-4">
                                <div className="text-left rtl:text-right">
                                   <p className="font-bold text-lg text-cyan-600 dark:text-cyan-400">{sale.total.toFixed(2)} DH</p>
                                   {/* FIX: Use 'profitLabel' key for the translation, as 'profit' is not a valid key. */}
                                   <p className="text-xs text-slate-500 dark:text-slate-400">{t('profitLabel')}: {sale.profit.toFixed(2)} DH</p>
                                </div>
                                <button onClick={() => onReprintInvoice(sale)} className="text-slate-500 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 p-2 rounded-full hover:bg-teal-100 dark:hover:bg-teal-900/50 transition-colors" title={t('print')}>
                                    <PrinterIcon className="w-5 h-5"/>
                                </button>
                              </div>
                          </div>
                          <details className="mt-2 text-sm">
                            <summary className="cursor-pointer text-cyan-700 dark:text-cyan-400 font-semibold hover:text-cyan-800">{t('viewDetails')}</summary>
                            <div className="mt-2 space-y-3 pr-4 rtl:pl-4 rtl:pr-0 border-r-2 rtl:border-l-2 rtl:border-r-0 border-cyan-200 dark:border-cyan-500/30 text-slate-600 dark:text-slate-300">
                                <ul className="space-y-1">
                                    <li><strong>{t('billNumber')}</strong> {sale.id.toUpperCase()}</li>
                                    {sale.customerId && customers.find(c => c.id === sale.customerId) && (
                                        <li><strong>{t('customer')}:</strong> {customers.find(c => c.id === sale.customerId)?.name}</li>
                                    )}
                                    {sale.discount && sale.discount > 0 && (
                                      <li className="font-semibold">
                                          <strong>{t('discount')}:</strong> <span className="text-red-600 dark:text-red-400">-{sale.discount.toFixed(2)} DH</span>
                                      </li>
                                    )}
                                    {sale.remainingAmount > 0 && (
                                        <li className="font-semibold">
                                            <strong>{t('remainingAmountLabel')}</strong> <span className="text-red-600 dark:text-red-400">{sale.remainingAmount.toFixed(2)} DH</span>
                                        </li>
                                    )}
                                </ul>
                                <ul className="mt-2 space-y-1 pt-2 border-t border-dashed dark:border-slate-600">
                                    {sale.items.map(item => (
                                        <li key={item.id} className="flex justify-between items-center">
                                            <span className="flex items-center gap-2">
                                                {item.type === 'service' && <SparklesIcon className="w-4 h-4 text-purple-500 dark:text-purple-400" />}
                                                {item.name} (x{item.quantity})
                                            </span>
                                            <span>{(item.price * item.quantity).toFixed(2)} DH</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                          </details>
                      </li>
                  )) : <p className="text-center text-slate-500 dark:text-slate-400 py-8">{t('noSalesForPeriod')}</p>}
              </ul>
          </div>
            {totalSalesPages > 1 && (
                <div className="pt-4 flex justify-center items-center gap-4 border-t border-slate-200 dark:border-slate-700 mt-4">
                    <button onClick={() => setSalesHistoryPage(p => Math.max(1, p - 1))} disabled={salesHistoryPage === 1} className="p-2 bg-gray-200 dark:bg-slate-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300 dark:hover:bg-slate-600" aria-label={t('previous')}>
                        <ArrowLeftIcon className="w-5 h-5" />
                    </button>
                    <span className="font-semibold text-slate-600 dark:text-slate-300">
                        {t('page')} {salesHistoryPage} / {totalSalesPages}
                    </span>
                    <button onClick={() => setSalesHistoryPage(p => Math.min(totalSalesPages, p + 1))} disabled={salesHistoryPage === totalSalesPages} className="p-2 bg-gray-200 dark:bg-slate-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300 dark:hover:bg-slate-600" aria-label={t('next')}>
                        <ArrowRightIcon className="w-5 h-5" />
                    </button>
                </div>
            )}
        </div>
    </div>
  );
  };

  return (
    <div className="space-y-6">
        {editingExpense && (
            <EditExpenseModal 
                expense={editingExpense}
                onClose={() => setEditingExpense(null)}
                onSave={updateExpense}
                t={t}
            />
        )}
        {showCustomItemsModal && (
            <CustomItemsModal
                onClose={() => setShowCustomItemsModal(false)}
                total={totalCustomItemSales}
                sales={customItemSales}
                customers={customers}
                onReprintInvoice={onReprintInvoice}
                t={t}
                language={language}
            />
        )}
        {view === 'overview' && <OverviewView />}
        {view === 'debts' && <DebtsView />}
        {view === 'returns' && <ReturnsView />}
        {view === 'expenses' && <ExpensesView />}
        {view === 'allPurchases' && <AllPurchasesView />}
        {view === 'supplierDebts' && <SupplierDebtsView />}
        {view === 'sellerReports' && <SellerReportsView />}
    </div>
  );
};

export default FinanceAndReports;
