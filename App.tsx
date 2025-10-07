import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { Product, ProductVariant, CartItem, Sale, Expense, User, Return, Store, Customer, Supplier, Category, Purchase, StockBatch } from './types';
import { Tab } from './types';
import { BoxIcon, ShoppingCartIcon, CoinsIcon, LogoutIcon, SettingsIcon, UsersIcon, TruckIcon, TagIcon, SparklesIcon, SunIcon, MoonIcon } from './components/Icons';
import ProductManagement from './components/ProductManagement';
import ServiceManagement from './components/ServiceManagement';
import PointOfSale from './components/PointOfSale';
import FinanceAndReports from './components/FinanceAndReports';
import UserManagement from './components/UserManagement';
import CustomerManagement from './components/CustomerManagement';
import SupplierManagement from './components/SupplierManagement';
import CategoryManagement from './components/CategoryManagement';
import LowStockAlert from './components/LowStockAlert';
import PrintableInvoice from './components/PrintableInvoice';
import PrintableReturnReceipt from './components/PrintableReturnReceipt';
import SuperAdminDashboard from './components/SuperAdminDashboard';
import SuperAdminLanding from './components/SuperAdminLanding';
import { Logo } from './components/Logo';
import { translations } from './translations';
import Auth from './components/Auth';
import * as api from './api';
import TrialBanner from './components/TrialBanner';
import { areSupabaseCredentialsSet, supabase } from './supabaseClient';

type Language = 'fr' | 'ar';
type Theme = 'light' | 'dark';
type TFunction = (key: keyof typeof translations.fr, options?: { [key: string]: string | number }) => string;

interface LanguageProps {
    t: TFunction;
    language: Language;
    setLanguage: (lang: Language) => void;
}

interface ThemeProps {
    theme: Theme;
    toggleTheme: () => void;
}

const ConfigErrorOverlay: React.FC<{ t: TFunction }> = ({ t }) => (
    <div className="fixed inset-0 bg-slate-900 z-[9999] flex items-center justify-center p-4" dir="ltr">
        <div className="bg-slate-800 border border-red-500/50 rounded-xl shadow-2xl max-w-3xl w-full p-8 text-slate-200">
            <h1 className="text-3xl font-bold text-red-500 mb-4">{t('supabaseConfigErrorTitle')}</h1>
            <p className="text-lg mb-6 text-slate-300">
                {t('supabaseConfigErrorSubtitle')}
            </p>
            <p className="mb-4 text-slate-300">
                {t('supabaseConfigErrorInstruction', { fileName: 'supabaseClient.ts' })}
            </p>
             <div className="p-4 mb-4 bg-yellow-900/50 border border-yellow-500/50 rounded-lg text-yellow-200 text-sm">
                <p>{t('supabaseConfigKeyWarning')}</p>
            </div>
            <pre className="bg-slate-900 text-left p-4 rounded-lg mb-6 text-sm overflow-x-auto border border-slate-700">
                <code className="text-slate-300 whitespace-pre">
                    <span className="text-slate-500">{t('supabaseConfigComment1')}</span><br/>
                    <span className="text-slate-500">{t('supabaseConfigComment2')}</span><br/>
                    <span className="text-slate-500">{t('supabaseConfigComment3')}</span><br/>
                    <span className="text-slate-500">{t('supabaseConfigComment4')}</span><br/>
                    <div className="bg-red-900/30 border-l-4 border-red-500 px-2 py-1 -mx-4">
                        <span className="text-cyan-400">const</span> supabaseAnonKey<span className="text-purple-400">:</span> <span className="text-green-400">string</span> <span className="text-purple-400">=</span> <span className="text-red-400">"COPIEZ_VOTRE_CLE_ANON_PUBLIQUE_SUPABASE_ICI"</span><span className="text-slate-500">;</span>
                    </div>
                </code>
            </pre>
            <p className="text-sm text-slate-400">
                {t('supabaseConfigErrorHint')}
            </p>
        </div>
    </div>
);

const MainApp: React.FC<{
    user: User;
    store: Store;
    onLogout: () => void;
    handleUpdateStore: (updatedStoreData: Partial<Store>) => Promise<void>;
} & LanguageProps & ThemeProps> = ({ user, store, onLogout, handleUpdateStore, t, language, setLanguage, theme, toggleTheme }) => {
  const [activeTab, setActiveTab] = useState<Tab>(user.role === 'admin' ? Tab.Finance : Tab.POS);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showPrintableInvoice, setShowPrintableInvoice] = useState<{ sale: Sale; mode: 'invoice' | 'orderForm' } | null>(null);
  const [showPrintableReturn, setShowPrintableReturn] = useState<Return | null>(null);
  
  // State for all store data
  const [products, setProducts] = useState<Product[]>([]);
  const [productVariants, setProductVariants] = useState<ProductVariant[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [returns, setReturns] = useState<Return[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [stockBatches, setStockBatches] = useState<StockBatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const cartLoadedRef = useRef(false);

  // Load persisted cart on login
  useEffect(() => {
    const loadCart = async () => {
        const savedCart = await api.loadCart(store.id, user.id);
        setCart(savedCart);
        cartLoadedRef.current = true;
    };
    loadCart();
  }, [store.id, user.id]);

  // Persist cart on change
  useEffect(() => {
      // Don't save the initial empty cart before it's been loaded from DB
      if (!cartLoadedRef.current) return;
      
      const saveCart = async () => {
          await api.saveCart(store.id, user.id, cart);
      };
      saveCart();
  }, [cart, store.id, user.id]);

  const fetchData = useCallback(async () => {
    if (!store.id) return;
    setIsLoading(true);
    const allData = await api.getStoreData(store.id);
    const allUsers = await api.getAllUsers();
    setProducts(allData.products || []);
    setProductVariants(allData.productVariants || []);
    setSales(allData.sales || []);
    setExpenses(allData.expenses || []);
    setUsers(allUsers.filter(u => u.storeId === store.id));
    setCustomers(allData.customers || []);
    setSuppliers(allData.suppliers || []);
    setReturns(allData.returns || []);
    const fetchedCategories = (allData.categories || []).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    setCategories(fetchedCategories);
    setPurchases(allData.purchases || []);
    setStockBatches(allData.stockBatches || []);
    setIsLoading(false);
  }, [store.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Real-time subscriptions
  useEffect(() => {
    if (!store.id) return;

    const subscription = supabase
      .channel(`public:store-changes-${store.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public' },
        (payload) => {
          console.log('Real-time change received!', payload);
          fetchData(); // Refetch all data on any change
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(subscription);
    };
  }, [store.id, fetchData]);


  const { goods, services, stockMap, lowStockVariants, variantsByProduct, variantMap, barcodeMap } = useMemo(() => {
    const stockMap = new Map<string, number>();
    stockBatches.forEach(batch => {
        stockMap.set(batch.variantId, (stockMap.get(batch.variantId) || 0) + batch.quantity);
    });

    const goods: Product[] = [];
    const services: Product[] = [];
    products.forEach(p => {
        if (p.type === 'service') {
            services.push(p);
        } else {
            goods.push(p);
        }
    });

    const lowStockVariants = productVariants.filter(v => {
        const currentStock = stockMap.get(v.id) || 0;
        return currentStock <= v.lowStockThreshold;
    });
    
    const variantsByProduct = new Map<string, ProductVariant[]>();
    productVariants.forEach(v => {
        const existing = variantsByProduct.get(v.productId) || [];
        existing.push(v);
        variantsByProduct.set(v.productId, existing);
    });
    
    const variantMap = new Map<string, ProductVariant>();
    productVariants.forEach(v => variantMap.set(v.id, v));

    const barcodeMap = new Map<string, ProductVariant>();
    productVariants.forEach(v => {
        if (v.barcode) barcodeMap.set(v.barcode, v);
    });

    return { goods, services, stockMap, lowStockVariants, variantsByProduct, variantMap, barcodeMap };
  }, [products, productVariants, stockBatches]);


  // Wrapper for API calls that refetches data
  const handleApiCall = async <T,>(apiFunction: (...args: any[]) => Promise<T>, ...args: any[]): Promise<T> => {
    try {
        const result = await apiFunction(...args);
        // Data will be refetched by real-time subscription, no need to call fetchData() manually
        return result;
    } catch (error: any) {
        console.error("API call failed:", error);
        const errorMessage = t((error.message || 'unknownError') as keyof typeof translations.fr, { name: args[1], debt: '...' });
        alert(`An error occurred: ${errorMessage}`);
        throw error; // Re-throw to allow callers to handle it further if needed
    }
  };

  const addProduct = async (productData: Omit<Product, 'id'>, variantsData: (Omit<ProductVariant, 'id'|'productId'|'storeId'> & { stockQuantity?: number})[]) => {
    return await handleApiCall(api.addProduct, productData, variantsData);
  };
  
  const updateProduct = async (productData: Product, variantsData: (Partial<ProductVariant> & { stockQuantity?: number })[]) => {
    await handleApiCall(api.updateProduct, productData, variantsData);
  };
  const deleteProduct = async (id: string) => {
    await handleApiCall(api.deleteProduct, id);
  };
  const addStockToVariant = async (data: { variantId: string; quantity: number; purchasePrice: number; sellingPrice: number; supplierId: string | undefined; }) => {
    await handleApiCall(api.addStockAndUpdateVariant, store.id, data.variantId, data.quantity, data.purchasePrice, data.sellingPrice, data.supplierId);
  }
  
  const addService = async (service: Omit<Product, 'id'>) => {
    return await handleApiCall(api.addProduct, service, []);
  };
  const updateService = async (service: Product) => {
    await handleApiCall(api.updateProduct, service, []);
  };
  const deleteService = async (id: string) => {
    await handleApiCall(api.deleteProduct, id);
  };

  const completeSale = async (downPayment: number, customerId: string | undefined, finalTotal: number, printMode: 'invoice' | 'orderForm') => {
      try {
          const sale = await handleApiCall(api.completeSale, store.id, cart, downPayment, customerId, finalTotal, user.id);
          if (sale) {
              setShowPrintableInvoice({ sale, mode: printMode });
          }
      } catch (error) {
          console.error("Sale completion failed:", error);
      }
  };
  
  const handleInvoiceClose = () => {
    setShowPrintableInvoice(null);
    setCart([]); // Clear the cart after the user is done with the invoice.
    api.clearCartFromDB(store.id, user.id);
  };

  const handleReprintInvoice = (sale: Sale) => {
    setShowPrintableInvoice({ sale, mode: 'invoice' });
  };

  const processReturn = async (itemsToReturn: CartItem[]) => {
    try {
      const newReturn = await handleApiCall(api.processReturn, store.id, itemsToReturn, user.id);
      if (newReturn) {
          setShowPrintableReturn(newReturn);
      }
    } catch(error) {
       console.error("Return processing failed:", error);
    }
  };
  const handleReturnReceiptClose = () => {
    setShowPrintableReturn(null);
    setCart([]); // Clear the cart after the user is done with the return receipt.
    api.clearCartFromDB(store.id, user.id);
  };

  const deleteReturn = async (returnId: string) => {
    await handleApiCall(api.deleteReturn, returnId);
  };
  const deleteAllReturns = async () => {
    await handleApiCall(api.deleteAllReturns, store.id);
  };
  const payCustomerDebt = async (customerId: string, amount: number) => {
    await handleApiCall(api.payCustomerDebt, customerId, amount);
  };

  const addExpense = async (expense: Omit<Expense, 'id'>) => {
      return await handleApiCall(api.addExpense, expense);
  };
  const updateExpense = async (expense: Expense) => {
    await handleApiCall(api.updateExpense, expense);
  };
  const deleteExpense = async (id: string) => {
    await handleApiCall(api.deleteExpense, id);
  };

  const addCustomer = async (customer: Omit<Customer, 'id'>) => {
      return await handleApiCall(api.addCustomer, customer);
  }
  const deleteCustomer = async (id: string) => {
    await handleApiCall(api.deleteCustomer, id);
  };

  const addSupplier = async (supplier: Omit<Supplier, 'id'>) => {
      return await handleApiCall(api.addSupplier, supplier);
  }
  const deleteSupplier = async (id: string) => {
    await handleApiCall(api.deleteSupplier, id);
  };
  const addCategory = async (category: Omit<Category, 'id'>) => {
      return await handleApiCall(api.addCategory, category);
  }
  const updateCategory = async (category: Category) => {
    await handleApiCall(api.updateCategory, category);
  };
  const deleteCategory = async (id: string) => {
    await handleApiCall(api.deleteCategory, id);
  };


  const addPurchase = async (purchase: Omit<Purchase, 'id'>) => {
    await handleApiCall(api.addPurchase, purchase);
  };
  const updatePurchase = async (purchase: Purchase) => {
    await handleApiCall(api.updatePurchase, purchase);
  };

  const addUser = async (user: Omit<User, 'id'>) => {
      return await handleApiCall(api.addUser, user);
  };
  const updateUser = async (updatedUser: User) => {
    await handleApiCall(api.updateUser, updatedUser);
  };
  const deleteUser = async (id: string) => {
    await handleApiCall(api.deleteUser, id);
  };


  const renderContent = () => {
    if(isLoading) {
        return <div className="text-center p-10 font-semibold text-slate-500 dark:text-slate-400">{t('loading')}...</div>
    }
      
    const commonProps = { 
        products, 
        variants: productVariants,
        customers, 
        categories,
        sales,
        t,
        language
    };
    const posProps = {
      ...commonProps,
      store,
      user,
      stockMap,
      variantMap,
      variantsByProduct,
      barcodeMap,
      cart,
      setCart,
      completeSale,
      processReturn,
      payCustomerDebt
    };
    
    if (user.role === 'seller') {
      return <PointOfSale {...posProps} />;
    }
    
    const tabComponents = {
        [Tab.POS]: <PointOfSale {...posProps} />,
        [Tab.Products]: <ProductManagement storeId={store.id} products={goods} variants={productVariants} suppliers={suppliers} categories={categories} stockMap={stockMap} addProduct={addProduct} updateProduct={updateProduct} deleteProduct={deleteProduct} addStockToVariant={addStockToVariant} t={t} language={language} />,
        [Tab.Services]: <ServiceManagement storeId={store.id} services={services} addService={addService} updateService={updateService} deleteService={deleteService} t={t} />,
        [Tab.Finance]: <FinanceAndReports storeId={store.id} sales={sales} expenses={expenses} returns={returns} purchases={purchases} suppliers={suppliers} users={users} addProduct={addProduct} addExpense={addExpense} updateExpense={updateExpense} deleteExpense={deleteExpense} customers={customers} deleteReturn={deleteReturn} deleteAllReturns={deleteAllReturns} t={t} language={language} theme={theme} onReprintInvoice={handleReprintInvoice} />,
        [Tab.Customers]: <CustomerManagement storeId={store.id} customers={customers} sales={sales} addCustomer={addCustomer} deleteCustomer={deleteCustomer} payCustomerDebt={payCustomerDebt} t={t} language={language} />,
        [Tab.Suppliers]: <SupplierManagement storeId={store.id} suppliers={suppliers} products={goods} variants={productVariants} purchases={purchases} categories={categories} addSupplier={addSupplier} deleteSupplier={deleteSupplier} addPurchase={addPurchase} updatePurchase={updatePurchase} addProduct={addProduct} t={t} language={language} />,
        [Tab.Categories]: <CategoryManagement storeId={store.id} categories={categories} addCategory={addCategory} updateCategory={updateCategory} deleteCategory={deleteCategory} t={t} language={language}/>,
        [Tab.Settings]: <UserManagement activeUser={user} store={store} storeId={store.id} users={users} addUser={addUser} updateUser={updateUser} deleteUser={deleteUser} onUpdateStore={handleUpdateStore} t={t} />,
    };

    return tabComponents[activeTab] || tabComponents[Tab.POS];
  };

  const NavButton = ({ tab, icon, label }: { tab: Tab, icon: React.ReactNode, label: string }) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-3 text-sm sm:text-base font-bold rounded-lg transition-colors ${activeTab === tab ? 'bg-white dark:bg-slate-900 text-teal-600 dark:text-teal-400 shadow-md' : 'bg-transparent text-teal-100 hover:bg-white/10'}`}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div className="bg-gray-100 dark:bg-slate-900 min-h-screen">
      <TrialBanner store={store} t={t} />
      <header className={`bg-teal-600 dark:bg-slate-800 text-white p-4 shadow-lg sticky z-50 ${store.trialStartDate ? 'top-8' : 'top-0'}`}>
        <div className="container mx-auto">
          <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
            <div className="flex items-center gap-4">
                <Logo url={store.logo} className="w-12 h-12 rounded-full bg-white object-cover" />
                <div>
                    <h1 className="text-2xl font-bold">{user.role === 'admin' ? t('adminDashboard') : t('pos')}</h1>
                    <p className="text-sm text-teal-200 dark:text-slate-400">{t('storeLabel')} {store.name}</p>
                </div>
            </div>
            <div className="flex items-center gap-3">
               <button onClick={toggleTheme} title="Toggle theme" className="p-2 bg-teal-700 dark:bg-slate-700 hover:bg-teal-800 dark:hover:bg-slate-600 rounded-lg transition-colors">
                  {theme === 'light' ? <MoonIcon className="w-5 h-5"/> : <SunIcon className="w-5 h-5" />}
               </button>
                <button onClick={() => setLanguage(language === 'fr' ? 'ar' : 'fr')} className="px-3 py-2 text-sm font-bold bg-teal-700 dark:bg-slate-700 hover:bg-teal-800 dark:hover:bg-slate-600 rounded-lg transition-colors">
                    {language === 'fr' ? 'AR' : 'FR'}
                </button>
               <span className="font-semibold hidden sm:block">{t('welcome')} {user.name}</span>
               <button onClick={onLogout} title={t('logout')} className="flex items-center gap-2 px-3 py-2 text-sm font-semibold bg-red-500 hover:bg-red-600 rounded-lg transition-colors">
                  <LogoutIcon className="w-5 h-5"/>
                  <span className="hidden md:inline">{t('logout')}</span>
               </button>
            </div>
          </div>
          {user.role === 'admin' && (
            <nav className="flex flex-wrap items-center gap-2 bg-teal-800/50 dark:bg-slate-700/50 rounded-xl p-2">
              <NavButton tab={Tab.POS} icon={<ShoppingCartIcon className="w-5 h-5"/>} label={t('pos')} />
              <NavButton tab={Tab.Products} icon={<BoxIcon className="w-5 h-5"/>} label={t('products')} />
              <NavButton tab={Tab.Services} icon={<SparklesIcon className="w-5 h-5"/>} label={t('services')} />
              <NavButton tab={Tab.Finance} icon={<CoinsIcon className="w-5 h-5"/>} label={t('finance')} />
              <NavButton tab={Tab.Customers} icon={<UsersIcon className="w-5 h-5"/>} label={t('customers')} />
              <NavButton tab={Tab.Suppliers} icon={<TruckIcon className="w-5 h-5"/>} label={t('suppliers')} />
              <NavButton tab={Tab.Categories} icon={<TagIcon className="w-5 h-5"/>} label={t('categories')} />
              <NavButton tab={Tab.Settings} icon={<SettingsIcon className="w-5 h-5"/>} label={t('settings')} />
            </nav>
          )}
        </div>
      </header>
      <main className="container mx-auto p-4 sm:p-6">
        <div className="space-y-4 mb-6">
            {user.role === 'admin' && lowStockVariants.length > 0 && (
              <LowStockAlert products={products} variants={lowStockVariants} suppliers={suppliers} t={t} />
            )}
        </div>
        {renderContent()}
      </main>
      {showPrintableInvoice && (
         <PrintableInvoice 
            sale={showPrintableInvoice.sale} 
            mode={showPrintableInvoice.mode}
            onClose={handleInvoiceClose} 
            store={store} 
            customers={customers || []} 
            t={t} 
            language={language}
         />
      )}
      {showPrintableReturn && (
         <PrintableReturnReceipt 
            returnObject={showPrintableReturn}
            onClose={handleReturnReceiptClose} 
            store={store} 
            t={t} 
            language={language}
         />
      )}
    </div>
  );
};

const App: React.FC = () => {
    const [language, setLanguage] = useState<Language>(() => (localStorage.getItem('language') as Language) || 'fr');

    const [auth, setAuth] = useState<{
        isAuthenticated: boolean;
        isSuperAdmin: boolean;
        user: User | null;
        store: Store | null;
    }>({
        isAuthenticated: false,
        isSuperAdmin: false,
        user: null,
        store: null,
    });
    
    const [superAdminView, setSuperAdminView] = useState<'landing' | 'dashboard'>('landing');

    const [theme, setTheme] = useState<Theme>(() => {
        if (localStorage.getItem('theme') === 'dark') return 'dark';
        if (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
        return 'light';
    });

    const t = useCallback((key: keyof typeof translations.fr, options?: { [key: string]: string | number }) => {
        let text = translations[language][key] || translations.fr[key] || key;
        if (options) {
            Object.keys(options).forEach(k => {
                const regex = new RegExp(`\\{${k}\\}`, 'g');
                text = text.replace(regex, String(options[k]));
            });
        }
        return text;
    }, [language]);

    useEffect(() => {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
    };
    
    useEffect(() => {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js').then(registration => {
                    console.log('SW registered: ', registration);
                }).catch(registrationError => {
                    console.log('SW registration failed: ', registrationError);
                });
            });
        }
    }, []);

    const handleSetLanguage = (lang: Language) => {
        setLanguage(lang);
        localStorage.setItem('language', lang);
    };

    useEffect(() => {
        document.documentElement.lang = language;
        document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
        document.title = t('appTitle');
    }, [language, t]);
    
    const handleLoginSuccess = (user: User, store: Store) => {
        setAuth({
            isAuthenticated: true,
            isSuperAdmin: false,
            user,
            store,
        });
    };
    
    const handleSuperAdminLogin = () => {
        setAuth({
            isAuthenticated: true,
            isSuperAdmin: true,
            user: null,
            store: null,
        });
        setSuperAdminView('landing');
    };

    const handleLogout = () => {
        setAuth({ isAuthenticated: false, isSuperAdmin: false, user: null, store: null });
        setSuperAdminView('landing');
    };

    const handleUpdateStore = async (updatedStoreData: Partial<Store>) => {
      if (!auth.store) return;
      const fullUpdatedStore = { ...auth.store, ...updatedStoreData };
      await api.updateStore(fullUpdatedStore); // Persist to DB
      setAuth(prev => ({ ...prev, store: fullUpdatedStore })); // Update state
    };
    
    const languageProps = { t, language, setLanguage: handleSetLanguage };
    const themeProps = { theme, toggleTheme };

    if (!areSupabaseCredentialsSet()) {
        return <ConfigErrorOverlay t={t} />;
    }

    if (!auth.isAuthenticated) {
        return <Auth onLoginSuccess={handleLoginSuccess} onSuperAdminLogin={handleSuperAdminLogin} {...languageProps} {...themeProps} />;
    }

    if (auth.isSuperAdmin) {
        if (superAdminView === 'landing') {
            return <SuperAdminLanding
                onLoginAsStoreAdmin={handleLoginSuccess}
                onGoToDashboard={() => setSuperAdminView('dashboard')}
                onLogout={handleLogout}
                {...languageProps}
                {...themeProps}
            />;
        }
        return <SuperAdminDashboard
            onLogout={handleLogout}
            onGoBack={() => setSuperAdminView('landing')}
            {...languageProps}
            {...themeProps}
        />;
    }

    if (auth.user && auth.store) {
        return <MainApp user={auth.user} store={auth.store} onLogout={handleLogout} handleUpdateStore={handleUpdateStore} {...languageProps} {...themeProps} />;
    }
    
    // Fallback, should not be reached
    return <Auth onLoginSuccess={handleLoginSuccess} onSuperAdminLogin={handleSuperAdminLogin} {...languageProps} {...themeProps} />;
};

export default App;