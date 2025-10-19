import React, { useState, useEffect, useMemo, useCallback } from 'react';

// Import types
import type { 
  Store, User, Product, ProductVariant, Sale, Expense, Customer, Supplier, Category, Purchase, CartItem, Return, StockBatch, StoreTypeMap, VariantFormData 
} from './types';
import { Tab } from './types';


// Import hooks
import { useIndexedDBStore } from './hooks/useIndexedDBStore';
import { useLocalStorage } from './hooks/useLocalStorage';

// Import API functions
import * as api from './api';

// Import components
import Auth from './components/Auth';
import PointOfSale from './components/PointOfSale';
import ProductManagement from './components/ProductManagement';
import ServiceManagement from './components/ServiceManagement';
import FinanceAndReports from './components/FinanceAndReports';
import CustomerManagement from './components/CustomerManagement';
import SupplierManagement from './components/SupplierManagement';
import CategoryManagement from './components/CategoryManagement';
import UserManagement from './components/UserManagement';
import TrialBanner from './components/TrialBanner';
import SuperAdminLanding from './components/SuperAdminLanding';
import SuperAdminDashboard from './components/SuperAdminDashboard';
import PrintableInvoice from './components/PrintableInvoice';
import PrintableReturnReceipt from './components/PrintableReturnReceipt';
// FIX: Import the LowStockAlert component to resolve the 'Cannot find name' error.
import LowStockAlert from './components/LowStockAlert';
import { Logo } from './components/Logo';
import { 
  ShoppingCartIcon, BoxIcon, CoinsIcon, UsersIcon, TruckIcon, TagIcon, SettingsIcon, 
  LogoutIcon, SunIcon, MoonIcon, SparklesIcon
} from './components/Icons';

// Import translations and helpers
import { translations } from './translations';

type Language = 'fr' | 'ar';
type Theme = 'light' | 'dark';

const App: React.FC = () => {
  // --- STATE MANAGEMENT ---
  
  // Auth & Session State
  const [activeStore, setActiveStore] = useLocalStorage<Store | null>('pos-active-store', null);
  const [activeUser, setActiveUser] = useLocalStorage<User | null>('pos-active-user', null);
  const [isSuperAdmin, setIsSuperAdmin] = useLocalStorage('pos-is-super-admin', false);
  const [superAdminView, setSuperAdminView] = useLocalStorage<'landing' | 'dashboard'>('pos-super-admin-view', 'landing');
  
  // UI State
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Loading...');
  const [activeTab, setActiveTab] = useState<keyof typeof Tab>('POS');
  const [language, setLanguage] = useLocalStorage<Language>('pos-language', 'fr');
  const [theme, setTheme] = useLocalStorage<Theme>('theme', 'light');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [printingSale, setPrintingSale] = useState<{ sale: Sale, mode: 'invoice' | 'orderForm' } | null>(null);
  const [printingReturn, setPrintingReturn] = useState<Return | null>(null);

  // Translation function
  const t = useCallback((key: keyof typeof translations.fr, options?: { [key: string]: string | number }) => {
    let text = (translations[language] && translations[language][key]) ? translations[language][key] : translations.fr[key];
    if (options) {
      Object.keys(options).forEach(k => {
        text = text.replace(`{${k}}`, String(options[k]));
      });
    }
    return text;
  }, [language]);

  // Data Stores (IndexedDB)
  const productsStore = useIndexedDBStore<Product>('products');
  const variantsStore = useIndexedDBStore<ProductVariant>('productVariants');
  const salesStore = useIndexedDBStore<Sale>('sales');
  const expensesStore = useIndexedDBStore<Expense>('expenses');
  const usersStore = useIndexedDBStore<User>('users');
  const returnsStore = useIndexedDBStore<Return>('returns');
  const storesStore = useIndexedDBStore<Store>('stores');
  const customersStore = useIndexedDBStore<Customer>('customers');
  const suppliersStore = useIndexedDBStore<Supplier>('suppliers');
  const categoriesStore = useIndexedDBStore<Category>('categories');
  const purchasesStore = useIndexedDBStore<Purchase>('purchases');
  const stockBatchesStore = useIndexedDBStore<StockBatch>('stockBatches');
  
  // --- DERIVED STATE (MEMOS) ---

  const stockMap = useMemo(() => {
    const map = new Map<string, number>();
    stockBatchesStore.data.forEach(batch => {
      map.set(batch.variantId, (map.get(batch.variantId) || 0) + batch.quantity);
    });
    salesStore.data.forEach(sale => {
      sale.items.forEach(item => {
        if (item.type === 'good' && !item.isCustom) {
          map.set(item.id, (map.get(item.id) || 0) - item.quantity);
        }
      });
    });
    returnsStore.data.forEach(ret => {
      ret.items.forEach(item => {
        if (item.type === 'good' && !item.isCustom) {
          map.set(item.id, (map.get(item.id) || 0) + item.quantity);
        }
      });
    });
    return map;
  }, [stockBatchesStore.data, salesStore.data, returnsStore.data]);

  const variantMap = useMemo(() => new Map(variantsStore.data.map(v => [v.id, v])), [variantsStore.data]);
  const variantsByProduct = useMemo(() => {
    const map = new Map<string, ProductVariant[]>();
    variantsStore.data.forEach(v => {
      const existing = map.get(v.productId) || [];
      existing.push(v);
      map.set(v.productId, existing);
    });
    return map;
  }, [variantsStore.data]);

  const barcodeMap = useMemo(() => {
    const map = new Map<string, ProductVariant>();
    variantsStore.data.forEach(v => {
      if (v.barcode) map.set(v.barcode, v);
    });
    return map;
  }, [variantsStore.data]);
  
  const lowStockVariants = useMemo(() => {
    return variantsStore.data.filter(v => (stockMap.get(v.id) || 0) <= v.lowStockThreshold);
  }, [variantsStore.data, stockMap]);

  // --- EFFECTS ---

  // Theme management
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);
  
  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  // Initial loading check
  useEffect(() => {
    if (!activeUser && !isSuperAdmin) {
      setIsLoading(false);
    }
  }, [activeUser, isSuperAdmin]);

  // Data sync on store change
  const syncDataForStore = useCallback(async (storeId: string) => {
    setIsLoading(true);
    const delay = (ms: number) => new Promise(res => setTimeout(res, ms));
    try {
      const dataSources: { key: keyof StoreTypeMap; name: string; fetch: (id: string) => Promise<any[]>; store: ReturnType<typeof useIndexedDBStore<any>>; }[] = [
        { key: 'products', name: t('products'), fetch: api.getProducts, store: productsStore },
        { key: 'productVariants', name: t('variants'), fetch: api.getProductVariants, store: variantsStore },
        { key: 'sales', name: t('sales'), fetch: api.getSales, store: salesStore },
        { key: 'expenses', name: t('expenses'), fetch: api.getExpenses, store: expensesStore },
        { key: 'users', name: t('userList'), fetch: api.getUsers, store: usersStore },
        { key: 'returns', name: t('returnHistory'), fetch: api.getReturns, store: returnsStore },
        { key: 'customers', name: t('customers'), fetch: api.getCustomers, store: customersStore },
        { key: 'suppliers', name: t('suppliers'), fetch: api.getSuppliers, store: suppliersStore },
        { key: 'categories', name: t('categories'), fetch: api.getCategories, store: categoriesStore },
        { key: 'purchases', name: t('allPurchasesHistory'), fetch: api.getPurchases, store: purchasesStore },
        { key: 'stockBatches', name: t('stock'), fetch: api.getStockBatches, store: stockBatchesStore },
      ];
      
      // Sequentially fetch and store data to avoid resource exhaustion
      for (const ds of dataSources) {
        setLoadingMessage(`${t('loading')} ${ds.name}...`);
        const fetchedData = await ds.fetch(storeId);
        await ds.store.clear();
        if (fetchedData && fetchedData.length > 0) {
          await ds.store.bulkAdd(fetchedData);
        }
        await delay(100); // Give the browser a moment to breathe
      }
      
      if (activeStore) {
        await storesStore.clear();
        await storesStore.add(activeStore);
      }
      
    } catch (error: any) {
      console.error("Failed to sync data:", error);
      alert(t('failedToFetchError_CORS'));
    } finally {
      setIsLoading(false);
      setLoadingMessage(t('loading')); // Reset on completion/failure
    }
  }, [activeStore, t, productsStore, variantsStore, salesStore, expensesStore, usersStore, returnsStore, storesStore, customersStore, suppliersStore, categoriesStore, purchasesStore, stockBatchesStore]);
  
  useEffect(() => {
    if(activeStore?.id) {
      const checkData = async () => {
        const dbProducts = productsStore.data;
        if (dbProducts.length === 0 || (dbProducts[0] && dbProducts[0].storeId !== activeStore.id)) {
            syncDataForStore(activeStore.id);
        } else {
            setIsLoading(false);
        }
      };
      checkData();
    }
  }, [activeStore?.id, productsStore.data, syncDataForStore]);


  // --- AUTH HANDLERS ---
  
  const handleLoginSuccess = useCallback((user: User, store: Store) => {
    setActiveStore(store);
    setActiveUser(user);
    setIsSuperAdmin(false);
    setIsLoading(true); // Will trigger data sync
  }, [setActiveStore, setActiveUser, setIsSuperAdmin]);

  const handleSuperAdminLogin = useCallback(() => {
    setIsSuperAdmin(true);
    setSuperAdminView('landing');
    setActiveStore(null);
    setActiveUser(null);
    setIsLoading(false);
  }, [setIsSuperAdmin, setSuperAdminView, setActiveStore, setActiveUser]);

  const handleLogout = useCallback(() => {
    const allStores = [productsStore, variantsStore, salesStore, expensesStore, usersStore, returnsStore, storesStore, customersStore, suppliersStore, categoriesStore, purchasesStore, stockBatchesStore];
    Promise.all(allStores.map(s => s.clear())).then(() => {
        setActiveStore(null);
        setActiveUser(null);
        setIsSuperAdmin(false);
        localStorage.removeItem('pos-license');
        setCart([]);
    });
  }, [setActiveStore, setActiveUser, setIsSuperAdmin, productsStore, variantsStore, salesStore, expensesStore, usersStore, returnsStore, storesStore, customersStore, suppliersStore, categoriesStore, purchasesStore, stockBatchesStore]);

  const handleLoginAsStoreAdmin = useCallback((user: User, store: Store) => {
    setIsSuperAdmin(false);
    setActiveStore(store);
    setActiveUser(user);
    setIsLoading(true);
  }, [setIsSuperAdmin, setActiveStore, setActiveUser]);
  

  // --- DATA HANDLERS (CRUD) ---

  const handleAddProduct = useCallback(async (productData: Omit<Product, 'id'>, variantsData: (Omit<ProductVariant, 'id'|'productId'|'storeId'> & {stockQuantity?: number})[]) => {
    const { product, variants, stockBatches } = await api.addProductWithVariants(productData, variantsData);
    await productsStore.add(product);
    await variantsStore.bulkAdd(variants);
    if (stockBatches.length > 0) {
      await stockBatchesStore.bulkAdd(stockBatches);
    }
    return { product, variants };
  }, [productsStore, variantsStore, stockBatchesStore]);
  
  const handleUpdateProduct = useCallback(async (productData: Product, variantsData: VariantFormData[]) => {
    const { updatedVariants, newVariants, deletedVariantIds, newStockBatches } = await api.updateProductWithVariants(productData, variantsData);
    await productsStore.update(productData);
    for (const v of updatedVariants) await variantsStore.update(v);
    if(newVariants.length > 0) await variantsStore.bulkAdd(newVariants);
    for (const id of deletedVariantIds) await variantsStore.remove(id);
    if (newStockBatches.length > 0) await stockBatchesStore.bulkAdd(newStockBatches);
  }, [productsStore, variantsStore, stockBatchesStore]);

  const handleDeleteProduct = useCallback(async (id: string) => {
    await api.deleteProduct(id);
    const associatedVariants = variantsStore.data.filter(v => v.productId === id);
    for (const v of associatedVariants) {
        const associatedBatches = stockBatchesStore.data.filter(sb => sb.variantId === v.id);
        for(const sb of associatedBatches) {
            await stockBatchesStore.remove(sb.id);
        }
        await variantsStore.remove(v.id);
    }
    await productsStore.remove(id);
  }, [productsStore, variantsStore, stockBatchesStore]);
  
  const handleAddService = useCallback(async (serviceData: Omit<Product, 'id'>) => {
    const { product, variants } = await api.addProductWithVariants(serviceData, []);
    await productsStore.add(product);
    return { product, variants };
  }, [productsStore]);

  const handleUpdateService = useCallback(async (service: Product) => {
    await api.updateProductWithVariants(service, []); // No variants for service
    await productsStore.update(service);
  }, [productsStore]);

  const handleDeleteService = handleDeleteProduct;
  
  const handleCompleteSale = useCallback(async (downPayment: number, customerId: string | undefined, finalTotal: number, printMode: 'invoice' | 'orderForm') => {
    if (!activeUser || !activeStore) return;
    const newSale = await api.completeSale(cart, downPayment, customerId, finalTotal, activeUser.id, activeStore.id);
    await salesStore.add(newSale);
    setPrintingSale({ sale: newSale, mode: printMode });
    setCart([]);
  }, [cart, activeUser, activeStore, salesStore]);
  
  const handleProcessReturn = useCallback(async (itemsToReturn: CartItem[]) => {
    if (!activeUser || !activeStore) return;
    const newReturn = await api.processReturn(itemsToReturn, activeUser.id, activeStore.id);
    await returnsStore.add(newReturn);
    
    const stockBatchesToAdd: Omit<StockBatch, 'id'>[] = [];
    for (const item of itemsToReturn) {
      if (item.type === 'good' && !item.isCustom) {
        stockBatchesToAdd.push({
          variantId: item.id,
          quantity: item.quantity,
          purchasePrice: item.purchasePrice || 0,
          createdAt: new Date().toISOString(),
          storeId: activeStore.id,
        });
      }
    }
    if (stockBatchesToAdd.length > 0) {
      // In a real scenario you would have a bulk add endpoint in api.ts
      for (const batch of stockBatchesToAdd) {
        const newBatch = await api.addStockBatch(batch);
        await stockBatchesStore.add(newBatch);
      }
    }
    setPrintingReturn(newReturn);
    setCart([]);
  }, [activeUser, activeStore, returnsStore, stockBatchesStore]);

  const handlePayCustomerDebt = useCallback(async (customerId: string, amount: number) => {
    if (!activeUser || !activeStore) return;
    const paymentSale = await api.payCustomerDebt(customerId, amount, activeUser.id, activeStore.id);
    await salesStore.add(paymentSale);
  }, [activeUser, activeStore, salesStore]);
  
  const handleAddStockToVariant = useCallback(async (data: { variantId: string; quantity: number; purchasePrice: number; sellingPrice: number; supplierId: string | undefined; }) => {
    const { purchase, newStockBatch, updatedVariant } = await api.addStock(data);
    await purchasesStore.add(purchase);
    await stockBatchesStore.add(newStockBatch);
    await variantsStore.update(updatedVariant);
  }, [purchasesStore, stockBatchesStore, variantsStore]);
  
  // Generic handlers using imported functions
  const makeHandler = <T extends {id:string}>(apiFn: (item: any) => Promise<any>, store: ReturnType<typeof useIndexedDBStore<T>>, action: 'add' | 'update' | 'remove') => {
    return async (item: T | Omit<T, 'id'> | string) => {
        const result = await apiFn(item as any);
        if (action === 'add') await store.add(result);
        if (action === 'update') await store.update(item as T);
        if (action === 'remove') await store.remove(item as string);
        return result;
    };
  };

  const handleAddCustomer = makeHandler(api.addCustomer, customersStore, 'add');
  const handleDeleteCustomer = makeHandler(api.deleteCustomer, customersStore, 'remove');
  const handleAddSupplier = makeHandler(api.addSupplier, suppliersStore, 'add');
  const handleDeleteSupplier = makeHandler(api.deleteSupplier, suppliersStore, 'remove');
  const handleAddCategory = makeHandler(api.addCategory, categoriesStore, 'add');
  const handleUpdateCategory = makeHandler(api.updateCategory, categoriesStore, 'update');
  const handleDeleteCategory = makeHandler(api.deleteCategory, categoriesStore, 'remove');
  const handleAddUser = makeHandler(api.addUser, usersStore, 'add');
  const handleUpdateUser = makeHandler(api.updateUser, usersStore, 'update');
  const handleDeleteUser = makeHandler(api.deleteUser, usersStore, 'remove');
  const handleAddExpense = makeHandler(api.addExpense, expensesStore, 'add');
  const handleUpdateExpense = makeHandler(api.updateExpense, expensesStore, 'update');
  const handleDeleteExpense = makeHandler(api.deleteExpense, expensesStore, 'remove');
  const handleDeleteReturn = makeHandler(api.deleteReturn, returnsStore, 'remove');
  const handleDeleteAllReturns = async () => {
    if (!activeStore) return;
    await api.deleteAllReturns(activeStore.id);
    await returnsStore.clear();
  };
  const handleUpdatePurchase = makeHandler(api.updatePurchase, purchasesStore, 'update');

  const handleAddPurchase = useCallback(async (purchase: Omit<Purchase, 'id'>) => {
    const { newPurchase, newStockBatches } = await api.addPurchase(purchase);
    await purchasesStore.add(newPurchase);
    await stockBatchesStore.bulkAdd(newStockBatches);
  }, [purchasesStore, stockBatchesStore]);

  // --- BACKUP & RESTORE ---

  const handleBackup = useCallback(async () => {
    const dataToBackup: Partial<StoreTypeMap> = {
      stores: storesStore.data, users: usersStore.data, products: productsStore.data, productVariants: variantsStore.data,
      sales: salesStore.data, expenses: expensesStore.data, customers: customersStore.data, suppliers: suppliersStore.data,
      categories: categoriesStore.data, purchases: purchasesStore.data, stockBatches: stockBatchesStore.data, returns: returnsStore.data,
    };
    const jsonString = JSON.stringify(dataToBackup, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `goshop-backup-${activeStore?.name.replace(/\s/g, '_')}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [activeStore, storesStore, usersStore, productsStore, variantsStore, salesStore, expensesStore, customersStore, suppliersStore, categoriesStore, purchasesStore, stockBatchesStore, returnsStore]);

  const handleRestore = useCallback(async (backupJson: string) => {
    if (!window.confirm(t('restoreConfirm'))) return;
    try {
        const trimmedJson = backupJson.trim();
        if (!trimmedJson) {
            throw new Error("Pasted content is empty.");
        }
        const backupData = JSON.parse(trimmedJson);

        if (typeof backupData !== 'object' || backupData === null || Array.isArray(backupData)) {
            throw new Error("Invalid backup format. The backup must be a JSON object containing keys like 'products', 'customers', etc.");
        }
        
        const allStoresMap: { [key in keyof StoreTypeMap]?: ReturnType<typeof useIndexedDBStore<any>> } = {
            products: productsStore, productVariants: variantsStore, sales: salesStore, expenses: expensesStore, users: usersStore,
            returns: returnsStore, stores: storesStore, customers: customersStore, suppliers: suppliersStore, categories: categoriesStore,
            purchases: purchasesStore, stockBatches: stockBatchesStore
        };

        setIsLoading(true);
        setLoadingMessage(t('restoreButton'));
        
        let restoredSomething = false;

        for (const key in backupData) {
            if (Object.prototype.hasOwnProperty.call(backupData, key) && key in allStoresMap) {
                const storeKey = key as keyof StoreTypeMap;
                const store = allStoresMap[storeKey];
                const dataToRestore = backupData[storeKey];

                if (store && Array.isArray(dataToRestore)) {
                    await store.clear();
                    await store.bulkAdd(dataToRestore);
                    restoredSomething = true;
                }
            }
        }
        
        if (!restoredSomething) {
            throw new Error("Backup file contains no recognizable data to restore (e.g., 'products', 'customers').");
        }

        alert(t('restoreSuccess'));
        window.location.reload();

    } catch (error: any) {
        console.error("Restore failed:", error);
        const errorMessage = error instanceof SyntaxError 
            ? t('jsonParseError') 
            : `${t('restoreError')}${error.message ? `: ${error.message}` : ''}`;
        alert(errorMessage);
    } finally {
        setIsLoading(false);
    }
}, [
    t, productsStore, variantsStore, salesStore, expensesStore, usersStore,
    returnsStore, storesStore, customersStore, suppliersStore, categoriesStore,
    purchasesStore, stockBatchesStore
]);
  
  const handleUpdateStore = useCallback(async (updatedData: Partial<Store>) => {
      if (!activeStore) return;
      const updatedStore = { ...activeStore, ...updatedData };
      const result = await api.updateStore(updatedStore);
      setActiveStore(result);
  }, [activeStore, setActiveStore]);

  // --- RENDER LOGIC ---

  if (isLoading && (!activeStore || !activeUser)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-slate-900">
        <Logo url={activeStore?.logo} className="w-48 h-auto mb-4 animate-pulse" />
        <p className="text-slate-600 dark:text-slate-300 font-semibold">{loadingMessage}</p>
      </div>
    );
  }

  if (isSuperAdmin) {
    return superAdminView === 'dashboard'
      ? <SuperAdminDashboard onLoginAsStoreAdmin={handleLoginAsStoreAdmin} onLogout={handleLogout} onGoBack={() => setSuperAdminView('landing')} t={t} language={language} setLanguage={setLanguage} theme={theme} toggleTheme={toggleTheme} />
      : <SuperAdminLanding onLoginAsStoreAdmin={handleLoginAsStoreAdmin} onGoToDashboard={() => setSuperAdminView('dashboard')} onLogout={handleLogout} t={t} language={language} setLanguage={setLanguage} theme={theme} toggleTheme={toggleTheme} />;
  }
  
  if (!activeUser || !activeStore) {
    return <Auth onLoginSuccess={handleLoginSuccess} onSuperAdminLogin={handleSuperAdminLogin} t={t} language={language} setLanguage={setLanguage} theme={theme} toggleTheme={toggleTheme} />;
  }
  
  const renderActiveTab = () => {
    const storeId = activeStore.id;
    switch (activeTab) {
      case 'POS': return <PointOfSale store={activeStore} user={activeUser} products={productsStore.data} variants={variantsStore.data} customers={customersStore.data} categories={categoriesStore.data} sales={salesStore.data} stockMap={stockMap} variantMap={variantMap} variantsByProduct={variantsByProduct} barcodeMap={barcodeMap} cart={cart} setCart={setCart} completeSale={handleCompleteSale} processReturn={handleProcessReturn} payCustomerDebt={handlePayCustomerDebt} t={t} language={language}/>;
      case 'Products': return <ProductManagement storeId={storeId} products={productsStore.data.filter(p=>p.type === 'good')} variants={variantsStore.data} suppliers={suppliersStore.data} categories={categoriesStore.data} stockMap={stockMap} addProduct={handleAddProduct} updateProduct={handleUpdateProduct} deleteProduct={handleDeleteProduct} addStockToVariant={handleAddStockToVariant} t={t} language={language}/>;
      case 'Services': return <ServiceManagement storeId={storeId} services={productsStore.data.filter(p=>p.type === 'service')} addService={handleAddService} updateService={handleUpdateService} deleteService={handleDeleteService} t={t}/>;
      case 'Finance': return <FinanceAndReports storeId={storeId} sales={salesStore.data} expenses={expensesStore.data} purchases={purchasesStore.data} suppliers={suppliersStore.data} returns={returnsStore.data} customers={customersStore.data} users={usersStore.data} addProduct={handleAddProduct} addExpense={handleAddExpense} updateExpense={handleUpdateExpense} deleteExpense={handleDeleteExpense} deleteReturn={handleDeleteReturn} deleteAllReturns={handleDeleteAllReturns} onReprintInvoice={(sale) => setPrintingSale({ sale, mode: 'invoice' })} t={t} language={language} theme={theme} />;
      case 'Customers': return <CustomerManagement storeId={storeId} customers={customersStore.data} sales={salesStore.data} addCustomer={handleAddCustomer} deleteCustomer={handleDeleteCustomer} payCustomerDebt={handlePayCustomerDebt} t={t} language={language} />;
      case 'Suppliers': return <SupplierManagement storeId={storeId} suppliers={suppliersStore.data} products={productsStore.data} variants={variantsStore.data} purchases={purchasesStore.data} categories={categoriesStore.data} addSupplier={handleAddSupplier} deleteSupplier={handleDeleteSupplier} addPurchase={handleAddPurchase} updatePurchase={handleUpdatePurchase} addProduct={handleAddProduct} t={t} language={language}/>;
      case 'Categories': return <CategoryManagement storeId={storeId} categories={categoriesStore.data} addCategory={handleAddCategory} updateCategory={handleUpdateCategory} deleteCategory={handleDeleteCategory} t={t} language={language} />;
      case 'Settings': return <UserManagement activeUser={activeUser} store={activeStore} storeId={storeId} users={usersStore.data} addUser={handleAddUser} updateUser={handleUpdateUser} deleteUser={handleDeleteUser} onUpdateStore={handleUpdateStore} onBackup={handleBackup} onRestore={handleRestore} t={t}/>;
      default: return null;
    }
  };

  const navItems = [
    { name: 'POS', icon: ShoppingCartIcon, label: t('pos') }, { name: 'Products', icon: BoxIcon, label: t('products') },
    { name: 'Services', icon: SparklesIcon, label: t('services') }, { name: 'Finance', icon: CoinsIcon, label: t('finance') },
    { name: 'Customers', icon: UsersIcon, label: t('customers') }, { name: 'Suppliers', icon: TruckIcon, label: t('suppliers') },
    { name: 'Categories', icon: TagIcon, label: t('categories') }, { name: 'Settings', icon: SettingsIcon, label: t('settings') },
  ];

  return (
    <div className={`min-h-screen flex flex-col md:flex-row ${language === 'ar' ? 'rtl' : 'ltr'}`}>
      {printingSale && <PrintableInvoice sale={printingSale.sale} mode={printingSale.mode} onClose={() => setPrintingSale(null)} store={activeStore} customers={customersStore.data} t={t} language={language} />}
      {printingReturn && <PrintableReturnReceipt returnObject={printingReturn} onClose={() => setPrintingReturn(null)} store={activeStore} t={t} language={language} />}
      
      {activeStore && <TrialBanner store={activeStore} t={t} />}
      
      <aside className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 w-full md:w-64 flex-shrink-0 shadow-lg md:shadow-none border-b-2 md:border-b-0 md:border-r-2 dark:border-slate-700">
        <div className="p-4 flex flex-col h-full">
            <div className="flex items-center justify-between gap-2 mb-6">
                <Logo url={activeStore.logo} className="w-12 h-12 rounded-lg object-cover" />
                <div className="flex-grow">
                  <h1 className="font-bold text-lg leading-tight">{activeStore.name}</h1>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{t('welcome')} {activeUser.name}</p>
                </div>
            </div>
          <nav className="flex-grow">
            <ul className="flex flex-row md:flex-col gap-2 flex-wrap justify-center">
              {navItems.map(item => (
                <li key={item.name}>
                  <button onClick={() => setActiveTab(item.name as keyof typeof Tab)} className={`w-full flex items-center gap-3 p-3 rounded-lg text-sm font-semibold transition-colors ${activeTab === item.name ? 'bg-teal-500 text-white shadow' : 'hover:bg-gray-100 dark:hover:bg-slate-700'}`}>
                    <item.icon className="w-5 h-5" />
                    <span className="hidden md:inline">{item.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>
          <div className="mt-auto pt-4 border-t border-gray-200 dark:border-slate-700 space-y-2">
            <div className="flex items-center justify-around">
               <button onClick={toggleTheme} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
                  {theme === 'light' ? <MoonIcon className="w-5 h-5"/> : <SunIcon className="w-5 h-5" />}
               </button>
                <button onClick={() => setLanguage(language === 'fr' ? 'ar' : 'fr')} className="font-bold p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
                    {language === 'fr' ? 'AR' : 'FR'}
                </button>
            </div>
            <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 p-3 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/50 rounded-lg font-semibold transition-colors">
                <LogoutIcon className="w-5 h-5"/>
                <span className="hidden md:inline">{t('logout')}</span>
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 p-4 sm:p-6 bg-gray-100 dark:bg-slate-900 overflow-y-auto h-[calc(100vh-160px)] md:h-auto">
        {lowStockVariants.length > 0 && activeTab === 'Products' && (
          <LowStockAlert products={productsStore.data} variants={lowStockVariants} suppliers={suppliersStore.data} t={t} />
        )}
        {isLoading ? (
             <div className="flex flex-col items-center justify-center h-full">
                <Logo url={activeStore?.logo} className="w-32 h-32 mb-4 animate-pulse" />
                <p className="text-slate-600 dark:text-slate-300 font-semibold">{loadingMessage}</p>
            </div>
        ) : renderActiveTab() }
      </main>
    </div>
  );
};

export default App;