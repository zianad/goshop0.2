



import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { Store, User, Product, ProductVariant, Sale, Expense, Customer, Supplier, Category, Purchase, Return, StockBatch, CartItem, VariantFormData, PurchaseItem, Tab as TabType } from './types';
import { Tab } from './types';
import Auth from './components/Auth';
import SuperAdminLanding from './components/SuperAdminLanding';
import SuperAdminDashboard from './components/SuperAdminDashboard';
import PointOfSale from './components/PointOfSale';
import ProductManagement from './components/ProductManagement';
import ServiceManagement from './components/ServiceManagement';
// FIX: Changed to a default import as 'FinanceAndReports' is now exported as default.
import FinanceAndReports from './components/FinanceAndReports';
import CustomerManagement from './components/CustomerManagement';
import SupplierManagement from './components/SupplierManagement';
import CategoryManagement from './components/CategoryManagement';
import UserManagement from './components/UserManagement';
import LowStockAlert from './components/LowStockAlert';
import TrialBanner from './components/TrialBanner';
import PrintableInvoice from './components/PrintableInvoice';
import PrintableReturnReceipt from './components/PrintableReturnReceipt';
import { useIndexedDBStore } from './hooks/useIndexedDBStore';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useSessionStorage } from './hooks/useSessionStorage';
import { translations } from './translations';
import * as api from './api';
import { BoxIcon, CoinsIcon, HistoryIcon, LogoutIcon, SettingsIcon, ShoppingCartIcon, UsersIcon, TruckIcon, TagIcon, SparklesIcon, StoreIcon } from './components/Icons';
import { Logo } from './components/Logo';

type Language = 'fr' | 'ar';
type Theme = 'light' | 'dark';
type TFunction = (key: keyof typeof translations.fr, options?: { [key: string]: string | number }) => string;

const App: React.FC = () => {
    const [user, setUser] = useSessionStorage<User | null>('activeUser', null);
    const [store, setStore] = useSessionStorage<Store | null>('activeStore', null);
    const [isSuperAdmin, setIsSuperAdmin] = useSessionStorage<boolean>('isSuperAdmin', false);
    const [superAdminView, setSuperAdminView] = useState<'landing' | 'dashboard'>('landing');

    const [activeTab, setActiveTab] = useLocalStorage<TabType>(store ? `activeTab-${store.id}` : 'activeTab', Tab.POS);
    const [language, setLanguage] = useLocalStorage<Language>('language', 'fr');
    const [theme, setTheme] = useLocalStorage<Theme>('theme', 'light');
    const [isDataLoading, setIsDataLoading] = useState(true);

    const { data: products, setData: setProducts, add: addProductDB, update: updateProductDB, remove: removeProductDB, bulkAdd: bulkAddProductsDB, clear: clearProductsDB } = useIndexedDBStore<Product>('products');
    const { data: variants, setData: setVariants, add: addVariantDB, update: updateVariantDB, remove: removeVariantDB, bulkAdd: bulkAddVariantsDB, clear: clearVariantsDB } = useIndexedDBStore<ProductVariant>('productVariants');
    const { data: sales, setData: setSales, add: addSaleDB, remove: removeSaleDB, bulkAdd: bulkAddSalesDB, clear: clearSalesDB } = useIndexedDBStore<Sale>('sales');
    const { data: expenses, setData: setExpenses, add: addExpenseDB, update: updateExpenseDB, remove: removeExpenseDB, bulkAdd: bulkAddExpensesDB, clear: clearExpensesDB } = useIndexedDBStore<Expense>('expenses');
    const { data: customers, setData: setCustomers, add: addCustomerDB, remove: removeCustomerDB, bulkAdd: bulkAddCustomersDB, clear: clearCustomersDB } = useIndexedDBStore<Customer>('customers');
    const { data: suppliers, setData: setSuppliers, add: addSupplierDB, remove: removeSupplierDB, bulkAdd: bulkAddSuppliersDB, clear: clearSuppliersDB } = useIndexedDBStore<Supplier>('suppliers');
    const { data: categories, setData: setCategories, add: addCategoryDB, update: updateCategoryDB, remove: removeCategoryDB, bulkAdd: bulkAddCategoriesDB, clear: clearCategoriesDB } = useIndexedDBStore<Category>('categories');
    const { data: purchases, setData: setPurchases, add: addPurchaseDB, bulkAdd: bulkAddPurchasesDB, clear: clearPurchasesDB } = useIndexedDBStore<Purchase>('purchases');
    const { data: stockBatches, setData: setStockBatches, add: addStockBatchDB, bulkAdd: bulkAddStockBatchesDB, clear: clearStockBatchesDB } = useIndexedDBStore<StockBatch>('stockBatches');
    const { data: returns, setData: setReturns, add: addReturnDB, remove: removeReturnDB, bulkAdd: bulkAddReturnsDB, clear: clearReturnsDB } = useIndexedDBStore<Return>('returns');
    const { data: users, setData: setUsers, add: addUserDB, update: updateUserDB, remove: removeUserDB, bulkAdd: bulkAddUsersDB, clear: clearUsersDB } = useIndexedDBStore<User>('users');
    const { data: stores, setData: setStores, update: updateStoreDB, bulkAdd: bulkAddStoresDB, clear: clearStoresDB } = useIndexedDBStore<Store>('stores');
    
    const [cart, setCart] = useLocalStorage<CartItem[]>(store ? `cart-${store.id}` : 'cart', []);
    const [saleToPrint, setSaleToPrint] = useState<{sale: Sale, mode: 'invoice' | 'orderForm'} | null>(null);
    const [returnToPrint, setReturnToPrint] = useState<Return | null>(null);

    const t: TFunction = useCallback((key, options) => {
        const langData = translations[language] || translations.fr;
        let translation = langData[key] || translations.fr[key] || key;
        if (options) {
            Object.keys(options).forEach(optionKey => {
                translation = translation.replace(`{${optionKey}}`, String(options[optionKey]));
            });
        }
        return translation;
    }, [language]);

    const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

    useEffect(() => {
        document.documentElement.classList.toggle('dark', theme === 'dark');
        document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    }, [theme, language]);

    const loadDataForStore = useCallback(async (storeId: string) => {
        setIsDataLoading(true);
        try {
            const [
                _products, _variants, _sales, _expenses, _customers, _suppliers,
                _categories, _purchases, _stockBatches, _returns, _users
            ] = await Promise.all([
                api.getProducts(storeId),
                api.getProductVariants(storeId),
                api.getSales(storeId),
                api.getExpenses(storeId),
                api.getCustomers(storeId),
                api.getSuppliers(storeId),
                api.getCategories(storeId),
                api.getPurchases(storeId),
                api.getStockBatches(storeId),
                api.getReturns(storeId),
                api.getUsers(storeId)
            ]);
            
            await Promise.all([
                clearProductsDB().then(() => bulkAddProductsDB(_products)),
                clearVariantsDB().then(() => bulkAddVariantsDB(_variants)),
                clearSalesDB().then(() => bulkAddSalesDB(_sales)),
                clearExpensesDB().then(() => bulkAddExpensesDB(_expenses)),
                clearCustomersDB().then(() => bulkAddCustomersDB(_customers)),
                clearSuppliersDB().then(() => bulkAddSuppliersDB(_suppliers)),
                clearCategoriesDB().then(() => bulkAddCategoriesDB(_categories)),
                clearPurchasesDB().then(() => bulkAddPurchasesDB(_purchases)),
                clearStockBatchesDB().then(() => bulkAddStockBatchesDB(_stockBatches)),
                clearReturnsDB().then(() => bulkAddReturnsDB(_returns)),
                clearUsersDB().then(() => bulkAddUsersDB(_users)),
                clearStoresDB().then(() => api.getStoreById(storeId).then(s => s && bulkAddStoresDB([s])))
            ]);
        } catch (error) {
            console.error("Failed to load data for store", error);
        } finally {
            setIsDataLoading(false);
        }
    }, [bulkAddCategoriesDB, bulkAddCustomersDB, bulkAddExpensesDB, bulkAddProductsDB, bulkAddPurchasesDB, bulkAddReturnsDB, bulkAddSalesDB, bulkAddStockBatchesDB, bulkAddSuppliersDB, bulkAddUsersDB, bulkAddVariantsDB, bulkAddStoresDB, clearCategoriesDB, clearCustomersDB, clearExpensesDB, clearProductsDB, clearPurchasesDB, clearReturnsDB, clearSalesDB, clearStockBatchesDB, clearSuppliersDB, clearUsersDB, clearVariantsDB, clearStoresDB]);

    useEffect(() => {
        if (store?.id) {
            loadDataForStore(store.id);
        } else {
            setIsDataLoading(false);
        }
    }, [store?.id, loadDataForStore]);

    const handleLoginSuccess = (loggedInUser: User, activeStore: Store) => {
        setUser(loggedInUser);
        setStore(activeStore);
        setIsSuperAdmin(false);
        setActiveTab(Tab.POS);
    };

    const handleSuperAdminLogin = () => {
        setIsSuperAdmin(true);
        setUser(null);
        setStore(null);
    };
    
    const handleLogout = () => {
        setUser(null);
        setStore(null);
        setIsSuperAdmin(false);
        sessionStorage.clear();
    };

    const stockMap = useMemo(() => {
        const map = new Map<string, number>();
        variants.forEach(variant => {
            const totalStock = stockBatches.filter(batch => batch.variantId === variant.id).reduce((sum, batch) => sum + batch.quantity, 0);
            const soldStock = sales.flatMap(sale => sale.items).filter(item => item.id === variant.id).reduce((sum, item) => sum + item.quantity, 0);
            const returnedStock = returns.flatMap(ret => ret.items).filter(item => item.id === variant.id).reduce((sum, item) => sum + item.quantity, 0);
            map.set(variant.id, totalStock - soldStock + returnedStock);
        });
        return map;
    }, [variants, stockBatches, sales, returns]);

    const variantMap = useMemo(() => new Map(variants.map(v => [v.id, v])), [variants]);
    const variantsByProduct = useMemo(() => {
        const map = new Map<string, ProductVariant[]>();
        variants.forEach(variant => {
            const list = map.get(variant.productId) || [];
            list.push(variant);
            map.set(variant.productId, list);
        });
        return map;
    }, [variants]);
    const barcodeMap = useMemo(() => {
        const map = new Map<string, ProductVariant>();
        variants.forEach(v => {
            if (v.barcode) map.set(v.barcode, v);
        });
        return map;
    }, [variants]);

    const lowStockVariants = useMemo(() => {
        return variants.filter(v => (stockMap.get(v.id) || 0) <= v.lowStockThreshold);
    }, [variants, stockMap]);

    // Data mutation functions
    const addProduct = async (productData: Omit<Product, 'id'>, variantsData: (Omit<ProductVariant, 'id'|'productId'|'storeId'> & {stockQuantity?: number})[]) => {
        const { product, variants: newVariants, stockBatches: newStockBatches } = await api.addProductWithVariants(productData, variantsData);
        await addProductDB(product);
        await bulkAddVariantsDB(newVariants);
        if (newStockBatches.length > 0) await bulkAddStockBatchesDB(newStockBatches);
        return { product, variants: newVariants };
    };

    const updateProduct = async (productData: Product, variantsData: VariantFormData[]) => {
        const { newVariants, newStockBatches } = await api.updateProductWithVariants(productData, variantsData);
        await updateProductDB(productData);
        if(newVariants.length > 0) await bulkAddVariantsDB(newVariants);
        if(newStockBatches.length > 0) await bulkAddStockBatchesDB(newStockBatches);
        // For simplicity, refetch variants and stock for the store to reflect all changes (updates/deletes)
        await api.getProductVariants(productData.storeId).then(setVariants);
        await api.getStockBatches(productData.storeId).then(setStockBatches);
    };

    const deleteProduct = async (id: string) => {
        await api.deleteProduct(id);
        await removeProductDB(id);
        // Also remove associated variants
        const variantsToDelete = variants.filter(v => v.productId === id);
        for(const v of variantsToDelete) {
            await removeVariantDB(v.id);
        }
    };
    
    const addStockToVariant = async (data: { variantId: string; quantity: number; purchasePrice: number; sellingPrice: number; supplierId: string | undefined; }) => {
        const { purchase, newStockBatch, updatedVariant } = await api.addStock(data);
        await addPurchaseDB(purchase);
        await addStockBatchDB(newStockBatch);
        await updateVariantDB(updatedVariant);
    };
    
    const completeSale = async (downPayment: number, customerId: string | undefined, finalTotal: number, printMode: 'invoice' | 'orderForm') => {
        if (!store || !user) return;
        const newSale = await api.completeSale(cart, downPayment, customerId, finalTotal, user.id, store.id);
        await addSaleDB(newSale);
        setCart([]);
        setSaleToPrint({sale: newSale, mode: printMode});
    };

    const processReturn = async (itemsToReturn: CartItem[]) => {
        if (!store || !user) return;
        const newReturn = await api.processReturn(itemsToReturn, user.id, store.id);
        await addReturnDB(newReturn);
        setCart([]);
        setReturnToPrint(newReturn);
    };
    
    const payCustomerDebt = async (customerId: string, amount: number) => {
        if (!store || !user) return;
        const paymentSale = await api.payCustomerDebt(customerId, amount, user.id, store.id);
        await addSaleDB(paymentSale);
    };

    const addExpense = async (expense: Omit<Expense, 'id'>) => {
        const newExpense = await api.addExpense(expense);
        await addExpenseDB(newExpense);
        return newExpense;
    };
    const updateExpense = async (expense: Expense) => {
        await api.updateExpense(expense);
        await updateExpenseDB(expense);
    };
    const deleteExpense = async (id: string) => {
        await api.deleteExpense(id);
        await removeExpenseDB(id);
    };

    const addCustomer = async (customer: Omit<Customer, 'id'>) => {
        const newCustomer = await api.addCustomer(customer);
        await addCustomerDB(newCustomer);
        return newCustomer;
    };
    const deleteCustomer = (id: string) => api.deleteCustomer(id).then(() => removeCustomerDB(id));

    const addSupplier = async (supplier: Omit<Supplier, 'id'>) => {
        const newSupplier = await api.addSupplier(supplier);
        await addSupplierDB(newSupplier);
        return newSupplier;
    };
    const deleteSupplier = (id: string) => api.deleteSupplier(id).then(() => removeSupplierDB(id));
    
    const addPurchase = async (purchase: Omit<Purchase, 'id'>, items: PurchaseItem[]) => {
        const {newPurchase, newStockBatches} = await api.addPurchase(purchase);
        await addPurchaseDB(newPurchase);
        if(newStockBatches.length > 0) await bulkAddStockBatchesDB(newStockBatches);
    };
    const paySupplierDebt = async (supplierId: string, amount: number) => {
        // Implement API call and state update
    };

    const addCategory = async (category: Omit<Category, 'id'>) => {
        const newCategory = await api.addCategory(category);
        await addCategoryDB(newCategory);
        return newCategory;
    };
    const updateCategory = (category: Category) => api.updateCategory(category).then(() => updateCategoryDB(category));
    const deleteCategory = (id: string) => api.deleteCategory(id).then(() => removeCategoryDB(id));
    
    const addUser = async (newUser: Omit<User, 'id'>) => {
        const createdUser = await api.addUser(newUser);
        await addUserDB(createdUser);
        return createdUser;
    };
    const updateUser = (updatedUser: User) => api.updateUser(updatedUser).then(() => updateUserDB(updatedUser));
    const deleteUser = (id: string) => api.deleteUser(id).then(() => removeUserDB(id));
    
    const onUpdateStore = async (storeData: Partial<Store>) => {
        if(!store) return;
        const updatedStore = await api.updateStore({...store, ...storeData});
        await updateStoreDB(updatedStore);
        setStore(updatedStore); // also update session store
    };
    
// FIX: Define deleteReturn function to handle API call and local DB update.
    const deleteReturn = async (id: string) => {
        await api.deleteReturn(id);
        await removeReturnDB(id);
    };

// FIX: Define deleteAllReturns function to iterate and delete all returns.
    const deleteAllReturns = async () => {
        if(window.confirm("Sure?")) {
            const returnsToDelete = [...returns];
            for(const r of returnsToDelete) {
                await deleteReturn(r.id);
            }
        }
    };

    const onBackup = () => {
        const backupData = {
            stores, users, products, variants, sales, expenses, customers, suppliers, categories, purchases, stockBatches, returns
        };
        const jsonString = JSON.stringify(backupData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `goshop_backup_${store?.name}_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const onRestore = async (jsonString: string) => {
        if(!store) return;
        try {
            const data = JSON.parse(jsonString);
            // Basic validation
            if (!data.products || !data.sales || !data.stores) throw new Error("Invalid backup file structure.");
            const backupStore = data.stores.find((s: Store) => s.id === store.id);
            if (!backupStore) throw new Error(t('restoreStoreIdMismatchError', { storeName: store.name }));
            
            if (window.confirm(t('restoreConfirm'))) {
                await loadDataForStore(store.id); // A simple way is to re-fetch after restoring on backend
                alert(t('restoreSuccess'));
                window.location.reload();
            }
        } catch (error: any) {
            alert(`${t('restoreError')}: ${error.message}`);
        }
    };
    
    // FIX: Create wrapper functions to adapt `addProduct` and `updateProduct` for the `ServiceManagement` component.
    const handleAddService = (serviceData: Omit<Product, 'id'>) => {
        // Services are products without variants.
        return addProduct(serviceData, []);
    };
    
    const handleUpdateService = (serviceData: Product) => {
        // Services don't have variants to update.
        return updateProduct(serviceData, []);
    };

    if (isDataLoading) {
        return <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-slate-900 text-slate-700 dark:text-slate-200">{t('loading')}...</div>;
    }

    if (!user && !isSuperAdmin) {
        return <Auth onLoginSuccess={handleLoginSuccess} onSuperAdminLogin={handleSuperAdminLogin} t={t} language={language} setLanguage={setLanguage} theme={theme} toggleTheme={toggleTheme} />;
    }

    if (isSuperAdmin) {
        if (superAdminView === 'landing') {
            return <SuperAdminLanding onGoToDashboard={() => setSuperAdminView('dashboard')} onLoginAsStoreAdmin={handleLoginSuccess} onLogout={handleLogout} t={t} language={language} setLanguage={setLanguage} theme={theme} toggleTheme={toggleTheme} />;
        }
        return <SuperAdminDashboard onGoBack={() => setSuperAdminView('landing')} onLoginAsStoreAdmin={handleLoginSuccess} onLogout={handleLogout} t={t} language={language} setLanguage={setLanguage} theme={theme} toggleTheme={toggleTheme} />;
    }

    if (user && store) {
        const TABS = [
            { id: Tab.POS, label: t('pos'), icon: ShoppingCartIcon },
            { id: Tab.Products, label: t('products'), icon: BoxIcon },
            { id: Tab.Services, label: t('services'), icon: SparklesIcon },
            { id: Tab.Finance, label: t('finance'), icon: CoinsIcon },
            { id: Tab.Customers, label: t('customers'), icon: UsersIcon },
            { id: Tab.Suppliers, label: t('suppliers'), icon: TruckIcon },
            { id: Tab.Categories, label: t('categories'), icon: TagIcon },
            { id: Tab.Settings, label: t('settings'), icon: SettingsIcon },
        ];
        
        return (
            <div className="flex h-screen bg-gray-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200" dir={language === 'ar' ? 'rtl' : 'ltr'}>
                {saleToPrint && <PrintableInvoice sale={saleToPrint.sale} mode={saleToPrint.mode} store={store} customers={customers} onClose={() => setSaleToPrint(null)} t={t} language={language} />}
                {returnToPrint && <PrintableReturnReceipt returnObject={returnToPrint} store={store} onClose={() => setReturnToPrint(null)} t={t} language={language} />}
                <aside className="w-64 bg-white dark:bg-slate-800 shadow-md flex flex-col p-4">
                    <div className="flex items-center gap-3 mb-6">
                        <Logo url={store.logo} className="w-12 h-12 object-cover rounded-lg" />
                        <div>
                           <h1 className="text-xl font-bold text-slate-700 dark:text-slate-100">{store.name}</h1>
                           <p className="text-xs text-slate-500 dark:text-slate-400">{t('welcome')}, {user.name}</p>
                        </div>
                    </div>
                    <nav className="flex-grow space-y-2">
                        {TABS.map(tab => (
                            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-colors ${activeTab === tab.id ? 'bg-teal-600 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700'}`}>
                                <tab.icon className="w-5 h-5" />
                                <span>{tab.label}</span>
                            </button>
                        ))}
                    </nav>
                    <div className="mt-auto">
                         <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/50 transition-colors">
                            <LogoutIcon className="w-5 h-5" />
                            <span>{t('logout')}</span>
                        </button>
                    </div>
                </aside>
                <main className="flex-1 p-6 overflow-y-auto">
                    <TrialBanner store={store} t={t} />
                    {activeTab === Tab.POS && lowStockVariants.length > 0 && <LowStockAlert products={products} variants={lowStockVariants} suppliers={suppliers} t={t} />}
                    
                    {activeTab === Tab.POS && <PointOfSale store={store} user={user} products={products} variants={variants} customers={customers} categories={categories} sales={sales} stockMap={stockMap} variantMap={variantMap} variantsByProduct={variantsByProduct} barcodeMap={barcodeMap} cart={cart} setCart={setCart} completeSale={completeSale} processReturn={processReturn} payCustomerDebt={payCustomerDebt} t={t} language={language} />}
                    {activeTab === Tab.Products && <ProductManagement storeId={store.id} products={products.filter(p=>p.type === 'good')} variants={variants} suppliers={suppliers} categories={categories} stockMap={stockMap} addProduct={addProduct} updateProduct={updateProduct} deleteProduct={deleteProduct} addStockToVariant={addStockToVariant} t={t} language={language} />}
                    {activeTab === Tab.Services && <ServiceManagement storeId={store.id} services={products.filter(p=>p.type==='service')} addService={handleAddService} updateService={handleUpdateService} deleteService={deleteProduct} t={t} />}
                    {/* FIX: Pass the newly defined deleteReturn and deleteAllReturns functions as props. */}
                    {activeTab === Tab.Finance && <FinanceAndReports storeId={store.id} sales={sales} expenses={expenses} purchases={purchases} suppliers={suppliers} returns={returns} customers={customers} users={users} addProduct={addProduct} addExpense={addExpense} updateExpense={updateExpense} deleteExpense={deleteExpense} deleteReturn={deleteReturn} deleteAllReturns={deleteAllReturns} onReprintInvoice={(sale) => setSaleToPrint({sale, mode: 'invoice'})} t={t} language={language} theme={theme} />}
                    {activeTab === Tab.Customers && <CustomerManagement storeId={store.id} customers={customers} sales={sales} addCustomer={addCustomer} deleteCustomer={deleteCustomer} payCustomerDebt={payCustomerDebt} t={t} language={language} />}
                    {activeTab === Tab.Suppliers && <SupplierManagement storeId={store.id} suppliers={suppliers} purchases={purchases} products={products} variants={variants} addSupplier={addSupplier} deleteSupplier={deleteSupplier} addPurchase={addPurchase} paySupplierDebt={paySupplierDebt} addProduct={addProduct} t={t} language={language} />}
                    {activeTab === Tab.Categories && <CategoryManagement storeId={store.id} categories={categories} addCategory={addCategory} updateCategory={updateCategory} deleteCategory={deleteCategory} t={t} language={language} />}
                    {activeTab === Tab.Settings && <UserManagement activeUser={user} store={store} storeId={store.id} users={users} addUser={addUser} updateUser={updateUser} deleteUser={deleteUser} onUpdateStore={onUpdateStore} onBackup={onBackup} onRestore={onRestore} t={t} />}

                </main>
            </div>
        );
    }
    
    return <div onClick={() => { localStorage.clear(); sessionStorage.clear(); window.location.reload(); }} className="cursor-pointer">An error occurred. Click to reset.</div>;
};

export default App;