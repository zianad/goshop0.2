import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { Store, User, Tab, Product, ProductVariant, Customer, Supplier, Category, Sale, Expense, Return, Purchase, CartItem, StoreTypeMap } from './types';
import * as api from './api';

import { translations } from './translations';
import { HistoryIcon, BoxIcon, ShoppingCartIcon, CoinsIcon, SettingsIcon, UsersIcon, TruckIcon, TagIcon, StoreIcon } from './components/Icons';
import { DeveloperLogo } from './components/DeveloperLogo';

import Auth from './components/Auth';
import SuperAdminLanding from './components/SuperAdminLanding';
import SuperAdminDashboard from './components/SuperAdminDashboard';
import PointOfSale from './components/PointOfSale';
import ProductManagement from './components/ProductManagement';
import ServiceManagement from './components/ServiceManagement';
import CustomerManagement from './components/CustomerManagement';
import SupplierManagement from './components/SupplierManagement';
import CategoryManagement from './components/CategoryManagement';
import FinanceAndReports from './components/FinanceAndReports';
import UserManagement from './components/UserManagement';
import LowStockAlert from './components/LowStockAlert';
import PrintableInvoice from './components/PrintableInvoice';
import PrintableReturnReceipt from './components/PrintableReturnReceipt';
import TrialBanner from './components/TrialBanner';

type Language = 'fr' | 'ar';
type Theme = 'light' | 'dark';
type SuperAdminView = 'landing' | 'dashboard';

const App: React.FC = () => {
    // Auth & UI State
    const [user, setUser] = useState<User | null>(null);
    const [store, setStore] = useState<Store | null>(null);
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);
    const [superAdminView, setSuperAdminView] = useState<SuperAdminView>('landing');
    const [activeTab, setActiveTab] = useState<Tab>(Tab.POS);
    const [isLoading, setIsLoading] = useState(true);
    const [language, setLanguage] = useState<Language>('fr');
    const [theme, setTheme] = useState<Theme>('light');
    const [printableSale, setPrintableSale] = useState<{ sale: Sale; mode: 'invoice' | 'orderForm' } | null>(null);
    const [printableReturn, setPrintableReturn] = useState<Return | null>(null);
    const [cart, setCart] = useState<CartItem[]>([]);

    // Data State
    const [products, setProducts] = useState<Product[]>([]);
    const [variants, setVariants] = useState<ProductVariant[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [sales, setSales] = useState<Sale[]>([]);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [returns, setReturns] = useState<Return[]>([]);
    const [purchases, setPurchases] = useState<Purchase[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [stockBatches, setStockBatches] = useState<any[]>([]);

    // Memoized derived state
    const { stockMap, variantMap, variantsByProduct, barcodeMap, lowStockVariants } = useMemo(() => {
        const stockMap = new Map<string, number>();
        const variantMap = new Map<string, ProductVariant>();
        const variantsByProduct = new Map<string, ProductVariant[]>();
        const barcodeMap = new Map<string, ProductVariant>();

        variants.forEach(v => {
            variantMap.set(v.id, v);
            if (v.barcode) barcodeMap.set(v.barcode, v);
            
            const pVariants = variantsByProduct.get(v.productId) || [];
            pVariants.push(v);
            variantsByProduct.set(v.productId, pVariants);
        });

        stockBatches.forEach(batch => {
            const currentStock = stockMap.get(batch.variantId) || 0;
            stockMap.set(batch.variantId, currentStock + batch.quantity);
        });
        sales.forEach(sale => sale.items.forEach(item => {
            if (item.type === 'good' && !item.isCustom) {
                 const currentStock = stockMap.get(item.id) || 0;
                 stockMap.set(item.id, currentStock - item.quantity);
            }
        }));
        returns.forEach(ret => ret.items.forEach(item => {
             if (item.type === 'good' && !item.isCustom) {
                 const currentStock = stockMap.get(item.id) || 0;
                 stockMap.set(item.id, currentStock + item.quantity);
             }
        }));

        const lowStockVariants = variants.filter(v => (stockMap.get(v.id) || 0) <= v.lowStockThreshold);

        return { stockMap, variantMap, variantsByProduct, barcodeMap, lowStockVariants };
    }, [variants, stockBatches, sales, returns]);

    const t = useCallback((key: keyof typeof translations.fr, options?: { [key: string]: string | number }) => {
        let text = translations[language][key] || translations.fr[key] || key;
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
    }, [language]);

    useEffect(() => {
        document.documentElement.classList.toggle('dark', theme === 'dark');
    }, [theme]);

    const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

    const fetchDataForStore = async (storeId: string) => {
        setIsLoading(true);
        const data = await api.getStoreData(storeId);
        setProducts(data.products || []);
        setVariants(data.productVariants || []);
        setCustomers(data.customers || []);
        setSuppliers(data.suppliers || []);
        setCategories(data.categories || []);
        setSales(data.sales || []);
        setExpenses(data.expenses || []);
        setReturns(data.returns || []);
        setPurchases(data.purchases || []);
        setUsers(data.users || []);
        setStockBatches(data.stockBatches || []);
        setIsLoading(false);
    };

    const handleLoginSuccess = (loggedInUser: User, loggedInStore: Store) => {
        setUser(loggedInUser);
        setStore(loggedInStore);
        fetchDataForStore(loggedInStore.id);
    };

    const handleSuperAdminLogin = () => setIsSuperAdmin(true);

    const handleLogout = () => {
        setUser(null);
        setStore(null);
        setIsSuperAdmin(false);
        setSuperAdminView('landing');
    };

    const handleDataUpdate = async (updateFn: () => Promise<any>, tableName: keyof StoreTypeMap) => {
        await updateFn();
        // A simple re-fetch for the updated table. A more optimized approach would be to update state directly.
        if (store) {
            const { data, error } = await api.supabase.from(tableName).select('*').eq('storeId', store.id);
            if (error) console.error(error);
            else {
                switch (tableName) {
                    case 'products': setProducts(data as Product[]); break;
                    case 'productVariants': setVariants(data as ProductVariant[]); break;
                    case 'customers': setCustomers(data as Customer[]); break;
                    case 'suppliers': setSuppliers(data as Supplier[]); break;
                    case 'categories': setCategories(data as Category[]); break;
                    case 'sales': setSales(data as Sale[]); break;
                    case 'expenses': setExpenses(data as Expense[]); break;
                    case 'returns': setReturns(data as Return[]); break;
                    case 'purchases': setPurchases(data as Purchase[]); break;
                    case 'users': setUsers(data as User[]); break;
                    case 'stockBatches': setStockBatches(data as any[]); break;
                    default: fetchDataForStore(store.id); // fallback to full refresh
                }
            }
        }
    };
    
    // CRUD functions passed to components
    const addProduct = useCallback(async (productData: Omit<Product, 'id'>, variantsData: any[]) => {
        const { product, variants } = await api.addProductWithVariants(productData, variantsData);
        setProducts(p => [...p, product]);
        setVariants(v => [...v, ...variants]);
        return { product, variants };
    }, []);
    
    const updateProduct = useCallback(async (productData: Product, variantsData: any[]) => {
        if(store) {
            await api.updateProductWithVariants(productData, variantsData);
            fetchDataForStore(store.id); // simple refresh
        }
    }, [store]);

    const deleteProduct = useCallback((id: string) => handleDataUpdate(() => api.deleteProductAndVariants(id), 'products'), [store]);
    const addStockToVariant = useCallback(async (data: { variantId: string, quantity: number, purchasePrice: number, sellingPrice: number, supplierId: string | undefined }) => {
        if(!store) return;
        // Add to stock batches
        await api.addStockBatch({
            storeId: store.id,
            variantId: data.variantId,
            quantity: data.quantity,
            purchasePrice: data.purchasePrice,
            createdAt: new Date().toISOString()
        });
        // Optionally update variant prices
        const variant = variants.find(v => v.id === data.variantId);
        if(variant && (variant.price !== data.sellingPrice || variant.purchasePrice !== data.purchasePrice)) {
            await api.supabase.from('productVariants').update({ price: data.sellingPrice, purchasePrice: data.purchasePrice }).eq('id', data.variantId);
        }
        await fetchDataForStore(store.id);
    }, [store, variants]);

    const addService = useCallback(async (serviceData: Omit<Product, 'id'>) => {
        const { product, variants } = await api.addProductWithVariants(serviceData, []);
        setProducts(p => [...p, product]);
        return { product, variants };
    }, []);
    
    const updateService = useCallback(async (serviceData: Product) => {
        const { data, error } = await api.supabase.from('products').update(serviceData).eq('id', serviceData.id).select().single();
        if(error) throw error;
        setProducts(p => p.map(pr => pr.id === data.id ? data : pr));
    }, []);

    const completeSale = useCallback(async (downPayment: number, customerId: string | undefined, finalTotal: number, printMode: 'invoice' | 'orderForm') => {
        if (!store || !user || cart.length === 0) return;
        const profit = cart.reduce((acc, item) => acc + ((item.price - (item.purchasePrice || 0)) * item.quantity), 0);
        const sale: Omit<Sale, 'id'> = {
            storeId: store.id,
            userId: user.id,
            date: new Date().toISOString(),
            items: cart,
            total: finalTotal,
            downPayment,
            remainingAmount: finalTotal - downPayment,
            profit,
            customerId,
        };
        const newSale = await api.addSale(sale);
        setSales(s => [...s, newSale]);
        setPrintableSale({ sale: newSale, mode: printMode });
        setCart([]);
    }, [cart, store, user]);
    
    const processReturn = useCallback(async (itemsToReturn: CartItem[]) => {
        if(!store || !user || itemsToReturn.length === 0) return;
        const refundAmount = itemsToReturn.reduce((acc, item) => acc + item.price * item.quantity, 0);
        const profitLost = itemsToReturn.reduce((acc, item) => acc + ((item.price - (item.purchasePrice || 0)) * item.quantity), 0);
        const returnObj: Omit<Return, 'id'> = {
            storeId: store.id,
            userId: user.id,
            date: new Date().toISOString(),
            items: itemsToReturn,
            refundAmount,
            profitLost
        };
        const newReturn = await api.addReturn(returnObj);
        setReturns(r => [...r, newReturn]);
        setPrintableReturn(newReturn);
        setCart([]);
    }, [store, user]);

    const payCustomerDebt = useCallback(async (customerId: string, amount: number) => {
        if(!store || !user) return;
        // Create a "sale" record for the payment
        const paymentSale: Omit<Sale, 'id'> = {
            storeId: store.id,
            userId: user.id,
            date: new Date().toISOString(),
            items: [],
            total: 0,
            downPayment: -amount, // Negative down payment represents paying off debt
            remainingAmount: -amount,
            profit: 0,
            customerId,
        };
        await handleDataUpdate(() => api.addSale(paymentSale), 'sales');
    }, [store, user]);

    // Render Logic
    if (isLoading && !user && !isSuperAdmin) {
        return <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-slate-900"><DeveloperLogo className="w-80 h-auto" /></div>;
    }
    
    if (isSuperAdmin) {
        if(superAdminView === 'landing') {
            return <SuperAdminLanding onLoginAsStoreAdmin={handleLoginSuccess} onGoToDashboard={() => setSuperAdminView('dashboard')} onLogout={handleLogout} t={t} language={language} setLanguage={setLanguage} theme={theme} toggleTheme={toggleTheme} />;
        }
        return <SuperAdminDashboard onLoginAsStoreAdmin={handleLoginSuccess} onLogout={handleLogout} onGoBack={() => setSuperAdminView('landing')} t={t} language={language} setLanguage={setLanguage} theme={theme} toggleTheme={toggleTheme} />;
    }

    if (!user || !store) {
        return <Auth onLoginSuccess={handleLoginSuccess} onSuperAdminLogin={handleSuperAdminLogin} t={t} language={language} setLanguage={setLanguage} theme={theme} toggleTheme={toggleTheme} />;
    }

    const services = products.filter(p => p.type === 'service');
    const goods = products.filter(p => p.type === 'good');
    
    const tabs: { id: Tab, name: string, icon: React.FC<{className?:string}> }[] = [
        { id: Tab.POS, name: t('pos'), icon: ShoppingCartIcon },
        { id: Tab.Products, name: t('products'), icon: BoxIcon },
        { id: Tab.Services, name: t('services'), icon: SparklesIcon },
        { id: Tab.Finance, name: t('finance'), icon: CoinsIcon },
        { id: Tab.Customers, name: t('customers'), icon: UsersIcon },
        { id: Tab.Suppliers, name: t('suppliers'), icon: TruckIcon },
        { id: Tab.Categories, name: t('categories'), icon: TagIcon },
    ];
    if (user.role === 'admin') {
        tabs.push({ id: Tab.Settings, name: t('settings'), icon: SettingsIcon });
    }

    return (
        <div className="flex h-screen bg-gray-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200">
            {printableSale && <PrintableInvoice sale={printableSale.sale} mode={printableSale.mode} onClose={() => setPrintableSale(null)} store={store} customers={customers} t={t} language={language} />}
            {printableReturn && <PrintableReturnReceipt returnObject={printableReturn} onClose={() => setPrintableReturn(null)} store={store} t={t} language={language} />}
            
            <aside className="w-20 lg:w-64 bg-white dark:bg-slate-800 p-4 flex flex-col shadow-lg">
                <div className="flex items-center gap-2 mb-8 px-2">
                     <StoreIcon className="w-8 h-8 text-teal-500" />
                     <h1 className="text-xl font-bold hidden lg:block">{store.name}</h1>
                </div>
                <nav className="flex-grow space-y-2">
                    {tabs.map(tab => (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`w-full flex items-center gap-4 p-3 rounded-lg text-sm font-semibold transition-colors ${activeTab === tab.id ? 'bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300' : 'hover:bg-gray-100 dark:hover:bg-slate-700'}`}>
                            <tab.icon className="w-6 h-6" />
                            <span className="hidden lg:inline">{tab.name}</span>
                        </button>
                    ))}
                </nav>
                <div className="mt-auto">
                    <div className="p-2 text-center text-xs text-slate-500 dark:text-slate-400">
                       <p className="font-bold">{t('welcome')} {user.name}</p>
                    </div>
                    <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 p-3 bg-red-50 hover:bg-red-100 dark:bg-red-900/50 dark:hover:bg-red-900 text-red-700 dark:text-red-300 rounded-lg font-semibold transition-colors">
                        {t('logout')}
                    </button>
                </div>
            </aside>
            <main className="flex-1 flex flex-col">
                <TrialBanner store={store} t={t}/>
                <div className="p-6 overflow-y-auto h-full">
                    {activeTab === Tab.POS && lowStockVariants.length > 0 && <LowStockAlert products={products} variants={lowStockVariants} suppliers={suppliers} t={t} />}
                    
                    {isLoading ? <p>Loading...</p> : (
                        <>
                           {activeTab === Tab.POS && <PointOfSale store={store} user={user} products={products} variants={variants} customers={customers} categories={categories} sales={sales} stockMap={stockMap} variantMap={variantMap} variantsByProduct={variantsByProduct} barcodeMap={barcodeMap} cart={cart} setCart={setCart} completeSale={completeSale} processReturn={processReturn} payCustomerDebt={payCustomerDebt} t={t} language={language} />}
                           {activeTab === Tab.Products && <ProductManagement storeId={store.id} products={goods} variants={variants} suppliers={suppliers} categories={categories} stockMap={stockMap} addProduct={addProduct} updateProduct={updateProduct} deleteProduct={deleteProduct} addStockToVariant={addStockToVariant} t={t} language={language} />}
                           {activeTab === Tab.Services && <ServiceManagement storeId={store.id} services={services} addService={addService} updateService={updateService} deleteService={(id) => handleDataUpdate(() => api.deleteProductAndVariants(id), 'products')} t={t} />}
                           {activeTab === Tab.Finance && <FinanceAndReports storeId={store.id} sales={sales} expenses={expenses} purchases={purchases} suppliers={suppliers} returns={returns} customers={customers} users={users} addProduct={addProduct} addExpense={(item) => handleDataUpdate(() => api.addExpense(item), 'expenses')} updateExpense={(item) => handleDataUpdate(() => api.updateExpense(item), 'expenses')} deleteExpense={(id) => handleDataUpdate(() => api.deleteExpense(id), 'expenses')} deleteReturn={(id) => handleDataUpdate(() => api.deleteReturn(id), 'returns')} deleteAllReturns={() => { if(window.confirm('Sure?')) { Promise.all(returns.map(r => api.deleteReturn(r.id))).then(() => handleDataUpdate(async () => {}, 'returns')) } }} onReprintInvoice={(sale) => setPrintableSale({ sale, mode: 'invoice' })} t={t} language={language} theme={theme} />}
                           {activeTab === Tab.Customers && <CustomerManagement storeId={store.id} customers={customers} sales={sales} addCustomer={(item) => handleDataUpdate(() => api.addCustomer(item), 'customers')} deleteCustomer={(id) => handleDataUpdate(() => api.deleteCustomer(id), 'customers')} payCustomerDebt={payCustomerDebt} t={t} language={language} />}
                           {activeTab === Tab.Suppliers && <SupplierManagement storeId={store.id} suppliers={suppliers} products={products} variants={variants} purchases={purchases} categories={categories} addSupplier={(item) => handleDataUpdate(() => api.addSupplier(item), 'suppliers')} deleteSupplier={(id) => handleDataUpdate(() => api.deleteSupplier(id), 'suppliers')} addPurchase={(item) => handleDataUpdate(() => api.addPurchase(item), 'purchases')} updatePurchase={(item) => handleDataUpdate(() => api.updatePurchase(item), 'purchases')} addProduct={addProduct} t={t} language={language} />}
                           {activeTab === Tab.Categories && <CategoryManagement storeId={store.id} categories={categories} addCategory={(item) => handleDataUpdate(() => api.addCategory(item), 'categories')} updateCategory={(item) => handleDataUpdate(() => api.updateCategory(item), 'categories')} deleteCategory={(id) => handleDataUpdate(() => api.deleteCategory(id), 'categories')} t={t} language={language} />}
                           {activeTab === Tab.Settings && user.role === 'admin' && <UserManagement activeUser={user} store={store} storeId={store.id} users={users} addUser={(item) => handleDataUpdate(() => api.addUser(item), 'users')} updateUser={(item) => handleDataUpdate(() => api.updateUser(item), 'users')} deleteUser={(id) => handleDataUpdate(() => api.deleteUser(id), 'users')} onUpdateStore={async (data) => { const updated = await api.updateStore({...store, ...data}); setStore(updated); }} t={t} />}
                        </>
                    )}
                </div>
            </main>
        </div>
    );
};

export default App;
