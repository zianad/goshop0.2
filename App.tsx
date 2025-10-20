import React, { useState, useEffect, useMemo, useCallback } from 'react';
// FIX: Added StockBatch and VariantFormData to the type imports.
import type { Store, User, Product, ProductVariant, Sale, Expense, Customer, Supplier, Category, Purchase, CartItem, Return, StockBatch, Tab as TabType, VariantFormData, StoreTypeMap } from './types.ts';
import { Tab } from './types.ts';
import { translations } from './translations.ts';
import Auth from './components/Auth.tsx';
import SuperAdminLanding from './components/SuperAdminLanding.tsx';
import SuperAdminDashboard from './components/SuperAdminDashboard.tsx';
import PointOfSale from './components/PointOfSale.tsx';
import ProductManagement from './components/ProductManagement.tsx';
import FinanceAndReports from './components/FinanceAndReports.tsx';
import CustomerManagement from './components/CustomerManagement.tsx';
import SupplierManagement from './components/SupplierManagement.tsx';
import CategoryManagement from './components/CategoryManagement.tsx';
import ServiceManagement from './components/ServiceManagement.tsx';
// FIX: Changed to a named import as PrintableInvoice does not have a default export.
import PrintableInvoice from './components/PrintableInvoice.tsx';
import PrintableReturnReceipt from './components/PrintableReturnReceipt.tsx';
import LowStockAlert from './components/LowStockAlert.tsx';
import TrialBanner from './components/TrialBanner.tsx';
// FIX: Import the UserManagement component.
import UserManagement from './components/UserManagement.tsx';
import { useLocalStorage } from './hooks/useLocalStorage.ts';
import { useIndexedDBStore } from './hooks/useIndexedDBStore.ts';
// FIX: Corrected import path to be relative.
import * as api from './api.ts';
import { BoxIcon, CoinsIcon, HistoryIcon, LogoutIcon, SettingsIcon, ShoppingCartIcon, StoreIcon, TagIcon, TruckIcon, UsersIcon } from './components/Icons.tsx';

type AuthState = 'unauthenticated' | 'authenticated' | 'super_admin_landing' | 'super_admin_dashboard';
type Language = 'fr' | 'ar';
type Theme = 'light' | 'dark';

const TabButton: React.FC<{
    icon: React.ReactNode;
    label: string;
    isActive: boolean;
    onClick: () => void;
}> = ({ icon, label, isActive, onClick }) => (
    <button
        onClick={onClick}
        className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-lg transition-colors ${
            isActive
                ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-200'
                : 'text-slate-600 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-700'
        }`}
    >
        {icon}
        <span>{label}</span>
    </button>
);


const App: React.FC = () => {
    const [authState, setAuthState] = useState<AuthState>('unauthenticated');
    const [activeTab, setActiveTab] = useState<TabType>(Tab.POS);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [currentStore, setCurrentStore] = useState<Store | null>(null);
    const [language, setLanguage] = useLocalStorage<Language>('pos-lang', 'fr');
    const [theme, setTheme] = useLocalStorage<Theme>('pos-theme', 'light');

    const [isDataLoading, setIsDataLoading] = useState(true);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [printingSale, setPrintingSale] = useState<{ sale: Sale; mode: 'invoice' | 'orderForm' } | null>(null);
    const [printingReturn, setPrintingReturn] = useState<Return | null>(null);

    // IndexedDB data hooks
    const { data: products, setData: setProducts, add: addProductToDb, update: updateProductInDb, remove: removeProductFromDb, clear: clearProductsDb } = useIndexedDBStore<Product>('products');
    const { data: variants, setData: setVariants, add: addVariantToDb, update: updateVariantInDb, remove: removeVariantFromDb, clear: clearVariantsDb, bulkAdd: bulkAddVariantsToDb } = useIndexedDBStore<ProductVariant>('productVariants');
    const { data: sales, setData: setSales, add: addSaleToDb, clear: clearSalesDb } = useIndexedDBStore<Sale>('sales');
    const { data: expenses, setData: setExpenses, add: addExpenseToDb, update: updateExpenseInDb, remove: removeExpenseFromDb, clear: clearExpensesDb } = useIndexedDBStore<Expense>('expenses');
    const { data: customers, setData: setCustomers, add: addCustomerToDb, remove: removeCustomerFromDb, clear: clearCustomersDb } = useIndexedDBStore<Customer>('customers');
    const { data: suppliers, setData: setSuppliers, add: addSupplierToDb, remove: removeSupplierFromDb, clear: clearSuppliersDb } = useIndexedDBStore<Supplier>('suppliers');
    const { data: categories, setData: setCategories, add: addCategoryToDb, update: updateCategoryInDb, remove: removeCategoryFromDb, clear: clearCategoriesDb } = useIndexedDBStore<Category>('categories');
    const { data: purchases, setData: setPurchases, add: addPurchaseToDb, update: updatePurchaseInDb, clear: clearPurchasesDb } = useIndexedDBStore<Purchase>('purchases');
    const { data: stockBatches, setData: setStockBatches, add: addStockBatchToDb, bulkAdd: bulkAddStockBatchesToDb, clear: clearStockBatchesDb } = useIndexedDBStore<StockBatch>('stockBatches');
    const { data: returns, setData: setReturns, add: addReturnToDb, remove: removeReturnFromDb, clear: clearReturnsDb } = useIndexedDBStore<Return>('returns');
    const { data: users, setData: setUsers, add: addUserToDb, update: updateUserInDb, remove: removeUserFromDb, clear: clearUsersDb } = useIndexedDBStore<User>('users');

    const t = useCallback((key: keyof typeof translations.fr, options?: { [key: string]: string | number }) => {
        let text = translations[language][key] || translations.fr[key];
        if (options) {
            Object.keys(options).forEach(k => {
                text = text.replace(`{${k}}`, String(options[k]));
            });
        }
        return text;
    }, [language]);

    useEffect(() => {
        document.documentElement.lang = language;
        document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
        document.documentElement.classList.toggle('dark', theme === 'dark');
    }, [language, theme]);

    const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

    const stockMap = useMemo(() => {
        const map = new Map<string, number>();
        stockBatches.forEach(batch => {
            const currentStock = map.get(batch.variantId) || 0;
            map.set(batch.variantId, currentStock + batch.quantity);
        });
        sales.forEach(sale => {
            if (sale?.items) {
                sale.items.forEach(item => {
                    if (item?.type === 'good') {
                        const currentStock = map.get(item.id) || 0;
                        map.set(item.id, currentStock - item.quantity);
                    }
                });
            }
        });
        returns.forEach(ret => {
            if (ret?.items) {
                ret.items.forEach(item => {
                    if (item?.type === 'good') {
                        const currentStock = map.get(item.id) || 0;
                        map.set(item.id, currentStock + item.quantity);
                    }
                })
            }
        })
        return map;
    }, [stockBatches, sales, returns]);

    const variantMap = useMemo(() => new Map(variants.map(v => [v.id, v])), [variants]);
    const variantsByProduct = useMemo(() => {
        const map = new Map<string, ProductVariant[]>();
        variants.forEach(v => {
            const existing = map.get(v.productId) || [];
            existing.push(v);
            map.set(v.productId, existing);
        });
        return map;
    }, [variants]);
    const barcodeMap = useMemo(() => new Map(variants.filter(v => v.barcode).map(v => [v.barcode!, v])), [variants]);
    const lowStockVariants = useMemo(() => variants.filter(v => (stockMap.get(v.id) || 0) <= v.lowStockThreshold), [variants, stockMap]);

    const loadInitialData = async (storeId: string) => {
        setIsDataLoading(true);
        try {
            const [
                productsData, variantsData, salesData, expensesData,
                customersData, suppliersData, categoriesData, purchasesData,
                stockBatchesData, returnsData, usersData
            ] = await Promise.all([
                api.getProducts(storeId), api.getProductVariants(storeId), api.getSales(storeId),
                api.getExpenses(storeId), api.getCustomers(storeId), api.getSuppliers(storeId),
                api.getCategories(storeId), api.getPurchases(storeId), api.getStockBatches(storeId),
                api.getReturns(storeId), api.getUsers(storeId),
            ]);
            setProducts(productsData); setVariants(variantsData); setSales(salesData); setExpenses(expensesData);
            setCustomers(customersData); setSuppliers(suppliersData); setCategories(categoriesData); setPurchases(purchasesData);
            setStockBatches(stockBatchesData); setReturns(returnsData); setUsers(usersData);
        } catch (error) {
            console.error("Failed to load initial data:", error);
            alert("Error loading store data. Please check your connection and try again.");
        } finally {
            setIsDataLoading(false);
        }
    };
    
    const onLoginSuccess = (user: User, store: Store) => {
        setCurrentUser(user);
        setCurrentStore(store);
        loadInitialData(store.id);
        setAuthState('authenticated');
    };
    
    const onSuperAdminLogin = () => setAuthState('super_admin_landing');
    
    const handleLogout = async () => {
        setAuthState('unauthenticated');
        setCurrentUser(null);
        setCurrentStore(null);
        // Clear all local data
        await Promise.all([
            clearProductsDb(), clearVariantsDb(), clearSalesDb(), clearExpensesDb(),
            clearCustomersDb(), clearSuppliersDb(), clearCategoriesDb(), clearPurchasesDb(),
            clearStockBatchesDb(), clearReturnsDb(), clearUsersDb()
        ]);
    };

    const handleSuperAdminLogout = () => {
      setAuthState('unauthenticated');
    };

    const handleSuperAdminLoginAsStore = (user: User, store: Store) => {
      onLoginSuccess(user, store);
    }

    const clearAllDataAndLogout = () => {
        localStorage.removeItem('pos-license');
        handleLogout();
    }
    
    const handleBackup = () => {
        if (!currentStore) return;
        const backupData: Partial<StoreTypeMap> = {
            stores: [currentStore],
            users,
            products,
            productVariants: variants,
            sales,
            expenses,
            customers,
            suppliers,
            categories,
            purchases,
            stockBatches,
            returns,
        };

        const jsonString = JSON.stringify(backupData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `goshop-backup-${currentStore.name.replace(/\s/g, '_')}-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleRestore = async (backupJsonString: string) => {
        if (!window.confirm(t('restoreConfirm'))) {
            return;
        }

        try {
            const backupData: Partial<StoreTypeMap> = JSON.parse(backupJsonString);
            
            if (!backupData.stores || !Array.isArray(backupData.stores) || backupData.stores.length === 0) {
                throw new Error(t('invalidBackupStructure'));
            }
            
            if (backupData.stores[0].id !== currentStore!.id) {
                throw new Error(t('restoreStoreIdMismatchError', { storeName: currentStore!.name }));
            }

            const DB_NAME = 'pos-app-db';
            const request = indexedDB.open(DB_NAME);

            request.onsuccess = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                const storeNames = Object.keys(backupData) as (keyof StoreTypeMap)[];
                const validStoreNames = storeNames.filter(name => db.objectStoreNames.contains(name));
                
                const tx = db.transaction(validStoreNames, 'readwrite');
                
                tx.oncomplete = () => {
                    localStorage.setItem('pos-license', JSON.stringify({ storeId: backupData.stores![0].id }));
                    alert(t('restoreSuccess'));
                    window.location.reload();
                };
                
                tx.onerror = (event) => {
                    console.error("Restore transaction error:", (event.target as IDBRequest).error);
                    alert(t('restoreError'));
                };

                validStoreNames.forEach(storeName => {
                    const dataToRestore = backupData[storeName];
                    if (dataToRestore && Array.isArray(dataToRestore)) {
                        const store = tx.objectStore(storeName);
                        store.clear();
                        dataToRestore.forEach((item: any) => {
                            store.put(item);
                        });
                    }
                });
            };

            request.onerror = () => {
                 alert(t('restoreError'));
            };
            
        } catch (error) {
            console.error("Restore failed:", error);
            if (error instanceof SyntaxError) {
                alert(t('jsonParseError'));
            } else {
                alert((error as Error).message || t('restoreError'));
            }
        }
    };


    // Handlers to be passed down
    const handleAddProduct = async (productData: Omit<Product, 'id'>, variantsData: (Omit<ProductVariant, 'id'|'productId'|'storeId'> & {stockQuantity?: number})[]) => {
      const { product, variants, stockBatches } = await api.addProductWithVariants(productData, variantsData);
      addProductToDb(product);
      bulkAddVariantsToDb(variants);
      bulkAddStockBatchesToDb(stockBatches);
      return { product, variants };
    };

    // FIX: Changed variantsData type to VariantFormData[] to match the prop type in ProductManagement.
    const handleUpdateProduct = async (productData: Product, variantsData: VariantFormData[]) => {
      const { updatedVariants, newVariants, deletedVariantIds, newStockBatches } = await api.updateProductWithVariants(productData, variantsData);
      updateProductInDb(productData);
      updatedVariants.forEach(v => updateVariantInDb(v));
      newVariants.forEach(v => addVariantToDb(v));
      deletedVariantIds.forEach(id => removeVariantFromDb(id));
      bulkAddStockBatchesToDb(newStockBatches);
    };

    const handleDeleteProduct = async (productId: string) => {
      await api.deleteProduct(productId);
      removeProductFromDb(productId);
      const variantsToDelete = variants.filter(v => v.productId === productId);
      variantsToDelete.forEach(v => removeVariantFromDb(v.id));
    };

    const handleAddStockToVariant = async (data: { variantId: string; quantity: number; purchasePrice: number; sellingPrice: number; supplierId: string | undefined; }) => {
        const { purchase, newStockBatch, updatedVariant } = await api.addStock(data);
        addPurchaseToDb(purchase);
        addStockBatchToDb(newStockBatch);
        updateVariantInDb(updatedVariant);
    };

    const handleCompleteSale = async (downPayment: number, customerId: string | undefined, finalTotal: number, printMode: 'invoice' | 'orderForm') => {
        const newSale = await api.completeSale(cart, downPayment, customerId, finalTotal, currentUser!.id, currentStore!.id);
        addSaleToDb(newSale);
        setPrintingSale({ sale: newSale, mode: printMode });
        setCart([]);
    };
    
    const handleProcessReturn = async (itemsToReturn: CartItem[]) => {
        if (!currentUser || !currentStore) return;
        const newReturn = await api.processReturn(itemsToReturn, currentUser.id, currentStore.id);
        addReturnToDb(newReturn);
        setPrintingReturn(newReturn);
        setCart([]);
    };

    const handlePayCustomerDebt = async (customerId: string, amount: number) => {
        if (!currentUser || !currentStore) return;
        const paymentSale = await api.payCustomerDebt(customerId, amount, currentUser.id, currentStore.id);
        addSaleToDb(paymentSale);
    };

    const handleAddExpense = async (expense: Omit<Expense, 'id'>) => {
        const newExpense = await api.addExpense(expense);
        if (newExpense) addExpenseToDb(newExpense);
        return newExpense;
    };
    const handleUpdateExpense = async (expense: Expense) => {
        await api.updateExpense(expense);
        updateExpenseInDb(expense);
    };
    const handleDeleteExpense = async (id: string) => {
        await api.deleteExpense(id);
        removeExpenseFromDb(id);
    };
    const handleDeleteReturn = async (id: string) => {
        await api.deleteReturn(id);
        removeReturnFromDb(id);
    };
    const handleDeleteAllReturns = async () => {
        if (!currentStore) return;
        await api.deleteAllReturns(currentStore.id);
        clearReturnsDb();
    };

    const handleAddCustomer = async (customer: Omit<Customer, 'id'>) => {
        const newCustomer = await api.addCustomer(customer);
        if (newCustomer) addCustomerToDb(newCustomer);
        return newCustomer;
    };
    const handleDeleteCustomer = async (id: string) => {
        await api.deleteCustomer(id);
        removeCustomerFromDb(id);
    };
    
    const handleAddSupplier = async (supplier: Omit<Supplier, 'id'>) => {
        const newSupplier = await api.addSupplier(supplier);
        if (newSupplier) addSupplierToDb(newSupplier);
        return newSupplier;
    };
    const handleDeleteSupplier = async (id: string) => {
        await api.deleteSupplier(id);
        removeSupplierFromDb(id);
    };
    const handleAddPurchase = async (purchase: Omit<Purchase, 'id'>) => {
        const {newPurchase, newStockBatches} = await api.addPurchase(purchase);
        addPurchaseToDb(newPurchase);
        bulkAddStockBatchesToDb(newStockBatches);
    };
     const handlePaySupplierDebt = async (supplierId: string, amount: number) => {
        const paymentPurchase = {
            storeId: currentStore!.id,
            supplierId: supplierId,
            date: new Date().toISOString(),
            items: [],
            totalAmount: 0,
            reference: `Paiement de dette de ${amount}`,
            amountPaid: -amount,
            remainingAmount: -amount,
            paymentMethod: 'cash',
        };
        await handleAddPurchase(paymentPurchase);
    };

    const handleAddCategory = async (category: Omit<Category, 'id'>) => {
        const newCategory = await api.addCategory(category);
        if(newCategory) addCategoryToDb(newCategory);
        return newCategory;
    };
    const handleUpdateCategory = async (category: Category) => {
        await api.updateCategory(category);
        updateCategoryInDb(category);
    };
    const handleDeleteCategory = async (id: string) => {
        await api.deleteCategory(id);
        removeCategoryFromDb(id);
    };
    
    const handleAddService = async (service: Omit<Product, 'id'>) => {
        return handleAddProduct(service, []);
    };
    const handleUpdateService = async (service: Product) => {
        return handleUpdateProduct(service, []);
    };
    const handleDeleteService = async (id: string) => {
        return handleDeleteProduct(id);
    };

    const handleAddUser = async (user: Omit<User, 'id'>) => {
        const newUser = await api.addUser(user);
        if(newUser) addUserToDb(newUser);
        return newUser;
    };
    const handleUpdateUser = async (user: User) => {
        await api.updateUser(user);
        updateUserInDb(user);
    };
    const handleDeleteUser = async (id: string) => {
        await api.deleteUser(id);
        removeUserFromDb(id);
    };
    const handleUpdateStore = async (storeData: Partial<Store>) => {
        if(!currentStore) return;
        const updatedStore = await api.updateStore({ ...currentStore, ...storeData });
        setCurrentStore(updatedStore);
    }
    

    const renderContent = () => {
        if (!currentStore || !currentUser) return null;
        switch (activeTab) {
            case Tab.POS:
                return <PointOfSale store={currentStore} user={currentUser} products={products} variants={variants} customers={customers} categories={categories} sales={sales} stockMap={stockMap} variantMap={variantMap} variantsByProduct={variantsByProduct} barcodeMap={barcodeMap} cart={cart} setCart={setCart} completeSale={handleCompleteSale} processReturn={handleProcessReturn} payCustomerDebt={handlePayCustomerDebt} t={t} language={language} />;
            case Tab.Products:
                return <ProductManagement storeId={currentStore.id} products={products.filter(p => p.type === 'good')} variants={variants} suppliers={suppliers} categories={categories} stockMap={stockMap} addProduct={handleAddProduct} updateProduct={handleUpdateProduct} deleteProduct={handleDeleteProduct} addStockToVariant={handleAddStockToVariant} t={t} language={language} />;
            case Tab.Services:
                return <ServiceManagement storeId={currentStore.id} services={products.filter(p => p.type === 'service')} addService={handleAddService} updateService={handleUpdateService} deleteService={handleDeleteService} t={t} />;
            case Tab.Finance:
                return <FinanceAndReports storeId={currentStore.id} sales={sales} expenses={expenses} purchases={purchases} suppliers={suppliers} returns={returns} customers={customers} users={users} addExpense={handleAddExpense} updateExpense={handleUpdateExpense} deleteExpense={handleDeleteExpense} deleteReturn={handleDeleteReturn} deleteAllReturns={handleDeleteAllReturns} t={t} language={language} theme={theme} onReprintInvoice={(sale) => setPrintingSale({ sale, mode: 'invoice'})} addProduct={handleAddProduct} />;
            case Tab.Customers:
                return <CustomerManagement storeId={currentStore.id} customers={customers} sales={sales} addCustomer={handleAddCustomer} deleteCustomer={handleDeleteCustomer} payCustomerDebt={handlePayCustomerDebt} t={t} language={language} />;
            case Tab.Suppliers:
                return <SupplierManagement storeId={currentStore.id} suppliers={suppliers} purchases={purchases} products={products} variants={variants} categories={categories} addSupplier={handleAddSupplier} deleteSupplier={handleDeleteSupplier} addPurchase={handleAddPurchase} paySupplierDebt={handlePaySupplierDebt} addProduct={handleAddProduct} t={t} language={language} />;
            case Tab.Categories:
                return <CategoryManagement storeId={currentStore.id} categories={categories} addCategory={handleAddCategory} updateCategory={handleUpdateCategory} deleteCategory={handleDeleteCategory} t={t} language={language} />;
            case Tab.Settings:
                 return <UserManagement activeUser={currentUser} store={currentStore} storeId={currentStore.id} users={users} addUser={handleAddUser} updateUser={handleUpdateUser} deleteUser={handleDeleteUser} onUpdateStore={handleUpdateStore} onBackup={handleBackup} onRestore={handleRestore} t={t} />;
            default:
                return <PointOfSale store={currentStore} user={currentUser} products={products} variants={variants} customers={customers} categories={categories} sales={sales} stockMap={stockMap} variantMap={variantMap} variantsByProduct={variantsByProduct} barcodeMap={barcodeMap} cart={cart} setCart={setCart} completeSale={handleCompleteSale} processReturn={handleProcessReturn} payCustomerDebt={handlePayCustomerDebt} t={t} language={language} />;
        }
    };
    
    if (isDataLoading && authState === 'authenticated') {
        return <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-slate-900"><div className="text-xl font-semibold text-slate-700 dark:text-slate-200">{t('loading')}...</div></div>;
    }

    if (authState === 'unauthenticated') {
        return <Auth onLoginSuccess={onLoginSuccess} onSuperAdminLogin={onSuperAdminLogin} t={t} language={language} setLanguage={setLanguage} theme={theme} toggleTheme={toggleTheme} />;
    }

    if (authState === 'super_admin_landing') {
        return <SuperAdminLanding onLoginAsStoreAdmin={handleSuperAdminLoginAsStore} onGoToDashboard={() => setAuthState('super_admin_dashboard')} onLogout={handleSuperAdminLogout} t={t} language={language} setLanguage={setLanguage} theme={theme} toggleTheme={toggleTheme} />;
    }

    if (authState === 'super_admin_dashboard') {
        return <SuperAdminDashboard onLoginAsStoreAdmin={handleSuperAdminLoginAsStore} onLogout={handleSuperAdminLogout} onGoBack={() => setAuthState('super_admin_landing')} t={t} language={language} setLanguage={setLanguage} theme={theme} toggleTheme={toggleTheme} />;
    }

    if (!currentUser || !currentStore) {
        return null; 
    }
    
    return (
        <div className={`flex h-screen bg-gray-100 dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-sans`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
            {printingSale && <PrintableInvoice sale={printingSale.sale} mode={printingSale.mode} store={currentStore} customers={customers} onClose={() => setPrintingSale(null)} t={t} language={language} />}
            {printingReturn && <PrintableReturnReceipt returnObject={printingReturn} store={currentStore} onClose={() => setPrintingReturn(null)} t={t} language={language} />}

            {/* Sidebar */}
            <aside className="w-64 bg-white dark:bg-slate-800 shadow-lg flex flex-col p-4 space-y-2">
                <div className="text-center py-4 border-b border-gray-200 dark:border-slate-700">
                    <h1 className="text-2xl font-bold text-teal-600 dark:text-teal-400">Go-shop</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{currentStore.name}</p>
                </div>
                
                <nav className="flex-grow">
                    <TabButton icon={<ShoppingCartIcon className="w-5 h-5"/>} label={t('pos')} isActive={activeTab === Tab.POS} onClick={() => setActiveTab(Tab.POS)}/>
                    <TabButton icon={<BoxIcon className="w-5 h-5"/>} label={t('products')} isActive={activeTab === Tab.Products} onClick={() => setActiveTab(Tab.Products)}/>
                    <TabButton icon={<StoreIcon className="w-5 h-5"/>} label={t('services')} isActive={activeTab === Tab.Services} onClick={() => setActiveTab(Tab.Services)}/>
                    <TabButton icon={<CoinsIcon className="w-5 h-5"/>} label={t('finance')} isActive={activeTab === Tab.Finance} onClick={() => setActiveTab(Tab.Finance)}/>
                    <TabButton icon={<UsersIcon className="w-5 h-5"/>} label={t('customers')} isActive={activeTab === Tab.Customers} onClick={() => setActiveTab(Tab.Customers)}/>
                    <TabButton icon={<TruckIcon className="w-5 h-5"/>} label={t('suppliers')} isActive={activeTab === Tab.Suppliers} onClick={() => setActiveTab(Tab.Suppliers)}/>
                    <TabButton icon={<TagIcon className="w-5 h-5"/>} label={t('categories')} isActive={activeTab === Tab.Categories} onClick={() => setActiveTab(Tab.Categories)}/>
                </nav>
                
                <div className="pt-4 border-t border-gray-200 dark:border-slate-700">
                    {currentUser.role === 'admin' && <TabButton icon={<SettingsIcon className="w-5 h-5"/>} label={t('settings')} isActive={activeTab === Tab.Settings} onClick={() => setActiveTab(Tab.Settings)}/>}
                    <div className="p-2 text-center text-xs text-slate-400">
                        <p>{t('welcome')}, {currentUser.name}</p>
                        <p>({t(currentUser.role)})</p>
                    </div>
                    <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold bg-red-50 hover:bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 dark:hover:bg-red-900 rounded-lg">
                        <LogoutIcon className="w-5 h-5"/> {t('logout')}
                    </button>
                </div>
            </aside>
            
            {/* Main Content */}
            <main className="flex-1 flex flex-col overflow-hidden">
                <TrialBanner store={currentStore} t={t} />
                <div className="flex-1 p-6 overflow-y-auto">
                    {lowStockVariants.length > 0 && activeTab === Tab.Products && <LowStockAlert products={products} variants={lowStockVariants} suppliers={suppliers} t={t} />}
                    {renderContent()}
                </div>
            </main>
        </div>
    );
};

export default App;
