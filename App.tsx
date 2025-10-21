import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { User, Store, Tab, Product, ProductVariant, Sale, Expense, Return, Customer, Supplier, Category, Purchase, CartItem, StockBatch, StoreTypeMap } from './types.ts';
import { translations } from './translations.ts';
import { useLocalStorage } from './hooks/useLocalStorage.ts';
import { useIndexedDBStore } from './hooks/useIndexedDBStore.ts';
import * as api from './api.ts';

// Main Components
import Sidebar from './components/Sidebar.tsx';
import PointOfSale from './components/PointOfSale.tsx';
import ProductManagement from './components/ProductManagement.tsx';
import ServiceManagement from './components/ServiceManagement.tsx';
import CategoryManagement from './components/CategoryManagement.tsx';
import CustomerManagement from './components/CustomerManagement.tsx';
import SupplierManagement from './components/SupplierManagement.tsx';
import FinanceAndReports from './components/FinanceAndReports.tsx';
import UserManagement from './components/UserManagement.tsx';
import LowStockAlert from './components/LowStockAlert.tsx';

// Auth Components
import GlobalLogin from './components/GlobalLogin.tsx';
import Auth from './components/Auth.tsx';
import SuperAdminLanding from './components/SuperAdminLanding.tsx';
import SuperAdminDashboard from './components/SuperAdminDashboard.tsx';
import TrialBanner from './components/TrialBanner.tsx';
import Login from './components/Login.tsx';
import PrintableInvoice from './components/PrintableInvoice.tsx';
import PrintableReturnReceipt from './components/PrintableReturnReceipt.tsx';

type Language = 'fr' | 'ar';
type Theme = 'light' | 'dark';
type AuthState = 'loading' | 'global_login' | 'store_login' | 'logged_in' | 'user_switching' | 'super_admin_landing' | 'super_admin_dashboard';

function App() {
  // --- App State ---
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [activeUser, setActiveUser] = useState<User | null>(null);
  const [activeStore, setActiveStore] = useState<Store | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>(Tab.POS);
  const [error, setError] = useState<string | null>(null);
  
  // --- UI State ---
  const [language, setLanguage] = useLocalStorage<Language>('pos-lang', 'fr');
  const [theme, setTheme] = useLocalStorage<Theme>('pos-theme', 'light');
  const [isSidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
  const [printingSale, setPrintingSale] = useState<{sale: Sale, mode: 'invoice' | 'orderForm'} | null>(null);
  const [printingReturn, setPrintingReturn] = useState<Return | null>(null);

  // --- Data Stores (via IndexedDB) ---
  const productsStore = useIndexedDBStore<Product>('products');
  const variantsStore = useIndexedDBStore<ProductVariant>('productVariants');
  const salesStore = useIndexedDBStore<Sale>('sales');
  const expensesStore = useIndexedDBStore<Expense>('expenses');
  const usersStore = useIndexedDBStore<User>('users');
  const returnsStore = useIndexedDBStore<Return>('returns');
  const customersStore = useIndexedDBStore<Customer>('customers');
  const suppliersStore = useIndexedDBStore<Supplier>('suppliers');
  const categoriesStore = useIndexedDBStore<Category>('categories');
  const purchasesStore = useIndexedDBStore<Purchase>('purchases');
  const stockBatchesStore = useIndexedDBStore<StockBatch>('stockBatches');

  const [cart, setCart] = useState<CartItem[]>([]);
  
  // --- Memoized Derived State ---
  const t = useCallback((key: keyof typeof translations.fr, options?: { [key: string]: string | number }) => {
    let translation = translations[language][key] || translations.fr[key];
    if (options) {
      Object.keys(options).forEach(optionKey => {
        translation = translation.replace(`{${optionKey}}`, String(options[optionKey]));
      });
    }
    return translation;
  }, [language]);

  const stockMap = useMemo(() => {
    const map = new Map<string, number>();
    stockBatchesStore.data.forEach(batch => {
      map.set(batch.variantId, (map.get(batch.variantId) || 0) + batch.quantity);
    });
    return map;
  }, [stockBatchesStore.data]);

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

  // --- Effects ---
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [language, theme]);

  const fetchInitialData = async (storeId: string) => {
      // In a real app, this would fetch from a backend API and populate IndexedDB.
      // For this offline-first example, we assume IndexedDB is the source of truth
      // after the first login. A sync mechanism would be needed for multi-device support.
      // For now, we just load from IDB which is done by the hooks.
      console.log("Pretending to fetch data for store:", storeId);
  }

  const checkAuth = useCallback(async () => {
    const sessionUser = sessionStorage.getItem('pos-user');
    const sessionStore = sessionStorage.getItem('pos-store');
    
    if (sessionUser && sessionStore) {
        setActiveUser(JSON.parse(sessionUser));
        const store = JSON.parse(sessionStore);
        setActiveStore(store);
        await fetchInitialData(store.id);
        setAuthState('logged_in');
    } else {
        const localLicense = localStorage.getItem('pos-license');
        if (localLicense) {
            try {
                const store = await api.getStoreById(JSON.parse(localLicense).storeId);
                if (store) {
                    setActiveStore(store);
                    setAuthState('store_login');
                } else {
                    localStorage.removeItem('pos-license');
                    setAuthState('global_login');
                }
            } catch (e) {
                localStorage.removeItem('pos-license');
                setAuthState('global_login');
            }
        } else {
            setAuthState('global_login');
        }
  }, []);

  useEffect(() => {
      if (authState === 'loading') {
          checkAuth();
      }
  }, [authState, checkAuth]);

  // --- Auth Handlers ---
  const handleLoginSuccess = async (user: User, store: Store) => {
      sessionStorage.setItem('pos-user', JSON.stringify(user));
      sessionStorage.setItem('pos-store', JSON.stringify(store));
      setActiveUser(user);
      setActiveStore(store);
      await fetchInitialData(store.id);
      setAuthState('logged_in');
  }
  
  const handleLogout = () => {
      sessionStorage.clear();
      // We don't clear localStorage license, so user doesn't have to re-enter it.
      setActiveUser(null);
      // Keep active store to go back to the correct login page
      setAuthState('store_login');
      // Full logout would be:
      // localStorage.removeItem('pos-license');
      // setActiveStore(null);
      // setAuthState('global_login');
  };

  const handleGlobalLoginSubmit = async (licenseKey: string) => {
      const store = await api.getStoreByLicenseKey(licenseKey);
      if(store) {
          localStorage.setItem('pos-license', JSON.stringify({ storeId: store.id }));
          setActiveStore(store);
          setAuthState('store_login');
      } else {
          throw new Error('invalidActivationCode');
      }
  };

  const clearAllData = async () => {
      await Promise.all([
          productsStore.clear(),
          variantsStore.clear(),
          salesStore.clear(),
          expensesStore.clear(),
          usersStore.clear(),
          returnsStore.clear(),
          customersStore.clear(),
          suppliersStore.clear(),
          categoriesStore.clear(),
          purchasesStore.clear(),
          stockBatchesStore.clear(),
      ]);
  }

  const handleBackup = () => {
      const backupData = {
          products: productsStore.data,
          productVariants: variantsStore.data,
          sales: salesStore.data,
          expenses: expensesStore.data,
          users: usersStore.data,
          returns: returnsStore.data,
          stores: [activeStore], // only the active store
          customers: customersStore.data,
          suppliers: suppliersStore.data,
          categories: categoriesStore.data,
          purchases: purchasesStore.data,
          stockBatches: stockBatchesStore.data,
      };
      const jsonString = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `goshop_backup_${activeStore?.name}_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
  };
  
  const handleRestore = async (jsonString: string) => {
      try {
          const data = JSON.parse(jsonString) as StoreTypeMap;
          if (data.stores[0]?.id !== activeStore?.id) {
              alert(t('restoreStoreIdMismatchError', { storeName: activeStore?.name || '' }));
              return;
          }
          if (window.confirm(t('restoreConfirm'))) {
              await clearAllData();
              await productsStore.bulkAdd(data.products);
              await variantsStore.bulkAdd(data.productVariants);
              await salesStore.bulkAdd(data.sales);
              await expensesStore.bulkAdd(data.expenses);
              await usersStore.bulkAdd(data.users);
              await returnsStore.bulkAdd(data.returns);
              await customersStore.bulkAdd(data.customers);
              await suppliersStore.bulkAdd(data.suppliers);
              await categoriesStore.bulkAdd(data.categories);
              await purchasesStore.bulkAdd(data.purchases);
              await stockBatchesStore.bulkAdd(data.stockBatches);
              alert(t('restoreSuccess'));
              window.location.reload();
          }
      } catch (e) {
          console.error("Restore failed", e);
          alert(`${t('restoreError')}: ${(e as Error).message}`);
      }
  };


  // --- Data Mutation Handlers (simplified examples) ---
  const completeSale = async (downPayment: number, customerId: string | undefined, finalTotal: number, printMode: 'invoice' | 'orderForm') => {
      if (!activeUser || !activeStore) return;
      const profit = cart.reduce((acc, item) => {
          const cost = item.purchasePrice || 0;
          return acc + (item.price - cost) * item.quantity;
      }, 0);

      const sale: Omit<Sale, 'id'> = {
          storeId: activeStore.id,
          userId: activeUser.id,
          date: new Date().toISOString(),
          items: cart,
          total: finalTotal,
          downPayment,
          remainingAmount: finalTotal - downPayment,
          profit,
          customerId,
      };

      // Add to sales
      const newSale = { ...sale, id: crypto.randomUUID() };
      await salesStore.add(newSale as Sale);
      
      // Update stock
      const newBatches: StockBatch[] = [];
      cart.forEach(item => {
          if (item.type === 'good') {
             newBatches.push({
                 id: crypto.randomUUID(),
                 storeId: activeStore.id,
                 variantId: item.id,
                 quantity: -item.quantity,
                 purchasePrice: 0, // Not relevant for sales
                 createdAt: new Date().toISOString(),
             });
          }
      });
      await stockBatchesStore.bulkAdd(newBatches);

      setPrintingSale({ sale: newSale as Sale, mode });
      setCart([]);
  };
  
  const processReturn = async (itemsToReturn: CartItem[]) => {
      if (!activeStore || !activeUser) return;
      const refundAmount = itemsToReturn.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const profitLost = itemsToReturn.reduce((sum, item) => {
          const cost = item.purchasePrice || 0;
          return sum + (item.price - cost) * item.quantity;
      }, 0);

      const returnObj: Omit<Return, 'id'> = {
          storeId: activeStore.id,
          userId: activeUser.id,
          date: new Date().toISOString(),
          items: itemsToReturn,
          refundAmount,
          profitLost,
      };
      
      const newReturn = { ...returnObj, id: crypto.randomUUID() };
      await returnsStore.add(newReturn as Return);

      const newBatches: StockBatch[] = [];
      itemsToReturn.forEach(item => {
          if (item.type === 'good') {
             newBatches.push({
                 id: crypto.randomUUID(),
                 storeId: activeStore.id,
                 variantId: item.id,
                 quantity: item.quantity, // Positive quantity for return
                 purchasePrice: 0,
                 createdAt: new Date().toISOString(),
             });
          }
      });
      await stockBatchesStore.bulkAdd(newBatches);

      setPrintingReturn(newReturn as Return);
      setCart([]);
  }

  // --- Render Logic ---
  const renderContent = () => {
    if (!activeStore || !activeUser) return null; // Should not happen in logged_in state

    switch (activeTab) {
      case Tab.POS:
        return <PointOfSale store={activeStore} user={activeUser} products={productsStore.data} variants={variantsStore.data} customers={customersStore.data} categories={categoriesStore.data} sales={salesStore.data} stockMap={stockMap} variantMap={variantMap} variantsByProduct={variantsByProduct} barcodeMap={barcodeMap} cart={cart} setCart={setCart} completeSale={completeSale} processReturn={processReturn} payCustomerDebt={async ()=>{}} t={t} language={language} />;
      case Tab.Products:
        return <ProductManagement storeId={activeStore.id} products={productsStore.data.filter(p=>p.type === 'good')} variants={variantsStore.data} suppliers={suppliersStore.data} categories={categoriesStore.data} stockMap={stockMap} addProduct={async ()=>{return {product: {} as Product, variants:[]}}} updateProduct={async ()=>{}} deleteProduct={async ()=>{}} addStockToVariant={async ()=>{}} t={t} language={language} />;
      case Tab.Services:
        return <ServiceManagement storeId={activeStore.id} services={productsStore.data.filter(p=>p.type === 'service')} addService={async ()=>{return {product: {} as Product, variants:[]}}} updateService={async ()=>{}} deleteService={async ()=>{}} t={t} />;
      case Tab.Categories:
        return <CategoryManagement storeId={activeStore.id} categories={categoriesStore.data} addCategory={async ()=>{return undefined}} updateCategory={async ()=>{}} deleteCategory={async ()=>{}} t={t} language={language} />;
      case Tab.Customers:
        return <CustomerManagement storeId={activeStore.id} customers={customersStore.data} sales={salesStore.data} addCustomer={async ()=>{return undefined}} deleteCustomer={async ()=>{}} payCustomerDebt={async ()=>{}} t={t} language={language} />;
      case Tab.Suppliers:
        return <SupplierManagement storeId={activeStore.id} suppliers={suppliersStore.data} purchases={purchasesStore.data} products={productsStore.data} variants={variantsStore.data} addSupplier={async ()=>{return undefined}} deleteSupplier={async ()=>{}} addPurchase={async ()=>{}} paySupplierDebt={async ()=>{}} addProduct={async ()=>{return {product: {} as Product, variants:[]}}} t={t} language={language}/>;
      case Tab.Finance:
        return <FinanceAndReports storeId={activeStore.id} sales={salesStore.data} expenses={expensesStore.data} purchases={purchasesStore.data} suppliers={suppliersStore.data} returns={returnsStore.data} customers={customersStore.data} users={usersStore.data} addProduct={async ()=>{return {product: {} as Product, variants:[]}}} addExpense={async ()=>{return undefined}} updateExpense={async ()=>{}} deleteExpense={async ()=>{}} deleteReturn={async ()=>{}} deleteAllReturns={async ()=>{}} t={t} language={language} theme={theme} onReprintInvoice={(sale) => setPrintingSale({sale, mode: 'invoice'})}/>;
      case Tab.Settings:
        return <UserManagement activeUser={activeUser} store={activeStore} storeId={activeStore.id} users={usersStore.data} addUser={async ()=>{return undefined}} updateUser={async ()=>{}} deleteUser={async ()=>{}} onUpdateStore={async ()=>{}} onBackup={handleBackup} onRestore={handleRestore} t={t} />;
      default:
        return <PointOfSale store={activeStore} user={activeUser} products={productsStore.data} variants={variantsStore.data} customers={customersStore.data} categories={categoriesStore.data} sales={salesStore.data} stockMap={stockMap} variantMap={variantMap} variantsByProduct={variantsByProduct} barcodeMap={barcodeMap} cart={cart} setCart={setCart} completeSale={completeSale} processReturn={processReturn} payCustomerDebt={async ()=>{}} t={t} language={language} />;
    }
  };

  const toggleTheme = () => setTheme(prev => (prev === 'light' ? 'dark' : 'light'));

  // --- Main Return ---
  if (authState === 'loading') {
    return <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-slate-900"><div className="text-xl font-semibold text-slate-600 dark:text-slate-300">Loading...</div></div>;
  }
  
  if (authState === 'global_login') {
      return <GlobalLogin onLicenseSubmit={handleGlobalLoginSubmit} onSuperAdminLogin={() => setAuthState('super_admin_landing')} t={t} language={language} setLanguage={setLanguage} theme={theme} toggleTheme={toggleTheme}/>;
  }
  
  if (authState === 'store_login' && activeStore) {
      return <Auth store={activeStore} onLoginSuccess={handleLoginSuccess} onSuperAdminLogin={() => setAuthState('super_admin_landing')} onBack={() => { localStorage.removeItem('pos-license'); setAuthState('global_login'); setActiveStore(null); }} t={t} language={language} setLanguage={setLanguage} theme={theme} toggleTheme={toggleTheme}/>
  }
  
  if (authState === 'super_admin_landing') {
      return <SuperAdminLanding onLoginAsStoreAdmin={handleLoginSuccess} onGoToDashboard={() => setAuthState('super_admin_dashboard')} onLogout={() => { setAuthState('global_login'); }} t={t} language={language} setLanguage={setLanguage} theme={theme} toggleTheme={toggleTheme}/>
  }
  
  if (authState === 'super_admin_dashboard') {
      return <SuperAdminDashboard onLoginAsStoreAdmin={handleLoginSuccess} onLogout={() => setAuthState('global_login')} onGoBack={() => setAuthState('super_admin_landing')} t={t} language={language} setLanguage={setLanguage} theme={theme} toggleTheme={toggleTheme}/>
  }
  
  if (authState === 'user_switching' && activeStore) {
      return <Login storeUsers={usersStore.data} onUserSelect={(user) => { setActiveUser(user); setAuthState('logged_in'); }} onCancel={handleLogout} t={t} />
  }

  if (authState === 'logged_in' && activeUser && activeStore) {
    return (
      <div className={`flex h-screen bg-gray-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 ${language === 'ar' ? 'rtl' : 'ltr'}`}>
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} user={activeUser} onLogout={handleLogout} onSwitchUser={() => setAuthState('user_switching')} isOpen={isSidebarOpen} setOpen={setSidebarOpen} t={t} />
        <main className="flex-1 flex flex-col overflow-hidden">
            <TrialBanner store={activeStore} t={t} />
            <div className="flex-1 overflow-x-hidden overflow-y-auto p-4 sm:p-6">
                {activeTab === Tab.POS && lowStockVariants.length > 0 && 
                  <LowStockAlert products={productsStore.data} variants={lowStockVariants} suppliers={suppliersStore.data} t={t} />
                }
                {renderContent()}
            </div>
        </main>
        {printingSale && <PrintableInvoice sale={printingSale.sale} mode={printingSale.mode} onClose={() => setPrintingSale(null)} store={activeStore} customers={customersStore.data} t={t} language={language} />}
        {printingReturn && <PrintableReturnReceipt returnObject={printingReturn} onClose={() => setPrintingReturn(null)} store={activeStore} t={t} language={language} />}
      </div>
    );
  }
  
  return <div onClick={() => { localStorage.clear(); sessionStorage.clear(); window.location.reload();}} className="cursor-pointer">An error occurred. Click to reset.</div>
}

export default App;
