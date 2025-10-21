import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { Store, User, Tab, Product, ProductVariant, Category, Supplier, CartItem, Sale, Expense, Return, Purchase, PurchaseItem, VariantFormData } from './types';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useSessionStorage } from './hooks/useSessionStorage';
import { useIndexedDBStore } from './hooks/useIndexedDBStore';
import * as api from './api';

// Components
import PointOfSale from './components/PointOfSale';
import ProductManagement from './components/ProductManagement';
import ServiceManagement from './components/ServiceManagement';
import FinanceAndReports from './components/FinanceAndReports';
import CustomerManagement from './components/CustomerManagement';
import SupplierManagement from './components/SupplierManagement';
import CategoryManagement from './components/CategoryManagement';
import UserManagement from './components/UserManagement';
import LowStockAlert from './components/LowStockAlert';
import PrintableInvoice from './components/PrintableInvoice';
import PrintableReturnReceipt from './components/PrintableReturnReceipt';
import Auth from './components/Auth';
import SuperAdminLanding from './components/SuperAdminLanding';
import SuperAdminDashboard from './components/SuperAdminDashboard';
import TrialBanner from './components/TrialBanner';
import { Logo } from './components/Logo';

// Icons
import { BoxIcon, CoinsIcon, HistoryIcon, LogoutIcon, SettingsIcon, ShoppingCartIcon, StoreIcon, TagIcon, TruckIcon, UsersIcon, SparklesIcon } from './components/Icons';

import { translations } from './translations';

type Language = 'fr' | 'ar';
type Theme = 'light' | 'dark';

const App: React.FC = () => {
    // App-wide state
    const [language, setLanguage] = useLocalStorage<Language>('pos-language', 'fr');
    const [theme, setTheme] = useLocalStorage<Theme>('pos-theme', 'light');
    const [activeUser, setActiveUser] = useSessionStorage<User | null>('pos-active-user', null);
    const [activeStore, setActiveStore] = useSessionStorage<Store | null>('pos-active-store', null);
    const [activeTab, setActiveTab] = useSessionStorage<Tab>('pos-active-tab', Tab.POS);
    const [isSuperAdmin, setIsSuperAdmin] = useSessionStorage<boolean>('pos-is-super-admin', false);
    
    // UI State
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [printableSale, setPrintableSale] = useState<{ sale: Sale; mode: 'invoice' | 'orderForm' } | null>(null);
    const [printableReturn, setPrintableReturn] = useState<Return | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const t = useCallback((key: keyof typeof translations.fr, options?: { [key: string]: string | number }) => {
        let translation = translations[language][key] || translations.fr[key] || key;
        if (options) {
            Object.keys(options).forEach(optionKey => {
                translation = translation.replace(`{${optionKey}}`, String(options[optionKey]));
            });
        }
        return translation;
    }, [language]);

    useEffect(() => {
        document.documentElement.lang = language;
        document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
        document.documentElement.classList.toggle('dark', theme === 'dark');
        setIsLoading(false);
    }, [language, theme]);

    // Data Stores using IndexedDB
    const { data: products, setData: setProducts, add: addProductDB, update: updateProductDB, remove: removeProductDB, bulkAdd: bulkAddProductsDB } = useIndexedDBStore<Product>('products');
    const { data: variants, setData: setVariants, add: addVariantDB, update: updateVariantDB, remove: removeVariantDB, bulkAdd: bulkAddVariantsDB } = useIndexedDBStore<ProductVariant>('productVariants');
    const { data: sales, setData: setSales, add: addSaleDB, clear: clearSalesDB } = useIndexedDBStore<Sale>('sales');
    const { data: expenses, setData: setExpenses, add: addExpenseDB, update: updateExpenseDB, remove: removeExpenseDB, clear: clearExpensesDB } = useIndexedDBStore<Expense>('expenses');
    const { data: users, setData: setUsers, add: addUserDB, update: updateUserDB, remove: removeUserDB } = useIndexedDBStore<User>('users');
    const { data: returns, setData: setReturns, add: addReturnDB, remove: removeReturnDB, clear: clearReturnsDB } = useIndexedDBStore<Return>('returns');
    const { data: stores, setData: setStores, update: updateStoreDB } = useIndexedDBStore<Store>('stores');
    const { data: customers, setData: setCustomers, add: addCustomerDB, remove: removeCustomerDB } = useIndexedDBStore<Customer>('customers');
    const { data: suppliers, setData: setSuppliers, add: addSupplierDB, remove: removeSupplierDB } = useIndexedDBStore<Supplier>('suppliers');
    const { data: categories, setData: setCategories, add: addCategoryDB, update: updateCategoryDB, remove: removeCategoryDB } = useIndexedDBStore<Category>('categories');
    const { data: purchases, setData: setPurchases, add: addPurchaseDB, update: updatePurchaseDB } = useIndexedDBStore<Purchase>('purchases');
    const { data: stockBatches, setData: setStockBatches, add: addStockBatchDB, bulkAdd: bulkAddStockBatchesDB } = useIndexedDBStore<StockBatch>('stockBatches');

    // POS state
    const [cart, setCart] = useState<CartItem[]>([]);

    // Derived data for performance
    const { stockMap, variantMap, variantsByProduct, barcodeMap } = useMemo(() => {
        const stock = new Map<string, number>();
        const vMap = new Map<string, ProductVariant>();
        const vByP = new Map<string, ProductVariant[]>();
        const bMap = new Map<string, ProductVariant>();

        stockBatches.forEach(batch => {
            stock.set(batch.variantId, (stock.get(batch.variantId) || 0) + batch.quantity);
        });
        sales.forEach(sale => {
            sale.items.forEach(item => {
                if (item.type === 'good') {
                    stock.set(item.id, (stock.get(item.id) || 0) - item.quantity);
                }
            });
        });
        returns.forEach(ret => {
            ret.items.forEach(item => {
                if (item.type === 'good') {
                    stock.set(item.id, (stock.get(item.id) || 0) + item.quantity);
                }
            });
        });

        variants.forEach(variant => {
            vMap.set(variant.id, variant);
            if (variant.barcode) bMap.set(variant.barcode, variant);
            const existing = vByP.get(variant.productId) || [];
            existing.push(variant);
            vByP.set(variant.productId, existing);
        });

        return { stockMap: stock, variantMap: vMap, variantsByProduct: vByP, barcodeMap: bMap };
    }, [stockBatches, sales, returns, variants]);

    const lowStockVariants = useMemo(() =>
        variants.filter(v => (stockMap.get(v.id) || 0) <= v.lowStockThreshold),
    [variants, stockMap]);

    const services = useMemo(() => products.filter(p => p.type === 'service'), [products]);

    // Data mutation functions
    const addProductHandler = async (productData: Omit<Product, 'id'>, variantsData: Omit<VariantFormData, 'stockQuantity'>[]) => {
        const newProduct: Product = { ...productData, id: crypto.randomUUID() };
        await addProductDB(newProduct);

        const newVariants: ProductVariant[] = [];
        const newStockBatches: StockBatch[] = [];

        for (const v of variantsData) {
            const variant: ProductVariant = {
                ...v,
                id: crypto.randomUUID(),
                storeId: newProduct.storeId,
                productId: newProduct.id,
            };
            newVariants.push(variant);
            
            const originalVariant = (productData as any).variants?.find((ov: any) => ov.id === v.id);
            const stockQuantity = originalVariant?.stockQuantity ?? 0;

            if (stockQuantity > 0) {
                newStockBatches.push({
                    id: crypto.randomUUID(),
                    storeId: newProduct.storeId,
                    variantId: variant.id,
                    quantity: stockQuantity,
                    purchasePrice: v.purchasePrice,
                    createdAt: new Date().toISOString(),
                });
            }
        }
        await bulkAddVariantsDB(newVariants);
        if (newStockBatches.length > 0) {
            await bulkAddStockBatchesDB(newStockBatches);
        }

        return { product: newProduct, variants: newVariants };
    };
    
    const updateProductHandler = async (productData: Product, variantsData: VariantFormData[]) => {
        await updateProductDB(productData);
        
        const existingVariantIds = new Set((variantsByProduct.get(productData.id) || []).map(v => v.id));
        const updatedVariantIds = new Set(variantsData.filter(v => v.id).map(v => v.id));

        // Delete variants that are no longer present
        for (const id of existingVariantIds) {
            if (!updatedVariantIds.has(id)) {
                await removeVariantDB(id);
            }
        }

        for (const v of variantsData) {
            if (v.id) { // Existing variant
                const { stockQuantity, ...variantToUpdate } = v;
                await updateVariantDB(variantToUpdate as ProductVariant);
            } else { // New variant
                const { stockQuantity, ...variantToAdd } = v;
                const newVariant: ProductVariant = {
                    ...variantToAdd,
                    id: crypto.randomUUID(),
                    storeId: productData.storeId,
                    productId: productData.id
                };
                await addVariantDB(newVariant);
                if (stockQuantity > 0) {
                    await addStockBatchDB({
                        id: crypto.randomUUID(),
                        storeId: productData.storeId,
                        variantId: newVariant.id,
                        quantity: stockQuantity,
                        purchasePrice: newVariant.purchasePrice,
                        createdAt: new Date().toISOString(),
                    });
                }
            }
        }
    };
    
    const deleteProductHandler = async (id: string) => {
        const variantsToDelete = variantsByProduct.get(id) || [];
        for (const v of variantsToDelete) {
            await removeVariantDB(v.id);
        }
        await removeProductDB(id);
    };

    const addStockToVariantHandler = async (data: { variantId: string; quantity: number; purchasePrice: number; sellingPrice: number; supplierId: string | undefined; }) => {
        const { variantId, quantity, purchasePrice, sellingPrice, supplierId } = data;
        await addStockBatchDB({
            id: crypto.randomUUID(),
            storeId: activeStore!.id,
            variantId,
            quantity,
            purchasePrice,
            createdAt: new Date().toISOString(),
        });
        
        const variant = variantMap.get(variantId);
        if (variant && (variant.price !== sellingPrice || variant.purchasePrice !== purchasePrice)) {
            await updateVariantDB({ ...variant, price: sellingPrice, purchasePrice });
        }
    };
    
    const completeSaleHandler = async (downPayment: number, customerId: string | undefined, finalTotal: number, printMode: 'invoice' | 'orderForm') => {
        const profit = cart.reduce((acc, item) => {
            const cost = item.purchasePrice || item.price; // Fallback for services/custom
            return acc + (item.price - cost) * item.quantity;
        }, 0);

        const newSale: Sale = {
            id: crypto.randomUUID(),
            storeId: activeStore!.id,
            userId: activeUser!.id,
            date: new Date().toISOString(),
            items: cart,
            total: finalTotal,
            downPayment: downPayment,
            remainingAmount: finalTotal - downPayment,
            profit,
            customerId
        };

        await addSaleDB(newSale);
        setPrintableSale({ sale: newSale, mode: printMode });
        setCart([]);
    };
    
    const processReturnHandler = async (itemsToReturn: CartItem[]) => {
        const refundAmount = itemsToReturn.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const profitLost = itemsToReturn.reduce((sum, item) => {
            if (item.purchasePrice) {
                return sum + (item.price - item.purchasePrice) * item.quantity;
            }
            return sum;
        }, 0);

        const newReturn: Return = {
            id: crypto.randomUUID(),
            storeId: activeStore!.id,
            userId: activeUser!.id,
            date: new Date().toISOString(),
            items: itemsToReturn,
            refundAmount,
            profitLost
        };

        await addReturnDB(newReturn);
        setPrintableReturn(newReturn);
        setCart([]);
    };
    
    const payCustomerDebtHandler = async (customerId: string, amount: number) => {
        const paymentAsSale: Sale = {
            id: crypto.randomUUID(),
            storeId: activeStore!.id,
            userId: activeUser!.id,
            date: new Date().toISOString(),
            items: [],
            total: -amount, // Negative total for payment
            downPayment: -amount,
            remainingAmount: 0,
            profit: 0,
            customerId,
        };
        await addSaleDB(paymentAsSale);
    };

    const handleLoginSuccess = (user: User, store: Store) => {
        setActiveUser(user);
        setActiveStore(store);
        setIsSuperAdmin(false);
    };
    
    const handleLogout = () => {
        setActiveUser(null);
        setActiveStore(null);
        setIsSuperAdmin(false);
        // Also clear session storage explicitly
        sessionStorage.removeItem('pos-active-user');
        sessionStorage.removeItem('pos-active-store');
        sessionStorage.removeItem('pos-is-super-admin');
        sessionStorage.removeItem('pos-active-tab');
    };
    
    const handleSuperAdminLogin = () => {
        setIsSuperAdmin(true);
        setActiveUser(null);
        setActiveStore(null);
    };
    
    const addServiceHandler = async (serviceData: Omit<Product, 'id'>) => {
        return addProductHandler(serviceData, []);
    };
    
    const updateServiceHandler = async (serviceData: Product) => {
        return updateProductDB(serviceData);
    };

    // Render logic
    if (isLoading) {
        return <div className="flex justify-center items-center h-screen bg-slate-100 dark:bg-slate-900"><div className="text-xl font-bold text-slate-700 dark:text-slate-200">{t('loading')}...</div></div>;
    }
    
    if (isSuperAdmin) {
        return (
            <SuperAdminLanding
                onLoginAsStoreAdmin={handleLoginSuccess}
                onGoToDashboard={() => setActiveTab('SuperAdminDashboard' as any)}
                onLogout={handleLogout}
                t={t}
                language={language}
                setLanguage={setLanguage}
                theme={theme}
                toggleTheme={() => setTheme(p => p === 'light' ? 'dark' : 'light')}
            />
        );
    }
    
    if (activeTab === ('SuperAdminDashboard' as any)) { // A bit of a hack for navigation
         return (
            <SuperAdminDashboard
                onLoginAsStoreAdmin={handleLoginSuccess}
                onLogout={handleLogout}
                onGoBack={() => setActiveTab(Tab.POS)}
                t={t}
                language={language}
                setLanguage={setLanguage}
                theme={theme}
                toggleTheme={() => setTheme(p => p === 'light' ? 'dark' : 'light')}
            />
        );
    }

    if (!activeUser || !activeStore) {
        return <Auth onLoginSuccess={handleLoginSuccess} onSuperAdminLogin={handleSuperAdminLogin} t={t} language={language} setLanguage={setLanguage} theme={theme} toggleTheme={() => setTheme(p => p === 'light' ? 'dark' : 'light')} />;
    }

    const NavItem = ({ tab, icon: Icon, label }: { tab: Tab, icon: React.FC<{ className?: string }>, label: string }) => (
        <li>
            <a href="#" onClick={() => { setActiveTab(tab); setIsSidebarOpen(false); }} className={`flex items-center p-2 text-base font-normal rounded-lg transition-all ${activeTab === tab ? 'bg-teal-100 dark:bg-slate-700 text-teal-700 dark:text-slate-100' : 'text-slate-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700'}`}>
                <Icon className="w-6 h-6" />
                <span className="ml-3 rtl:mr-3 rtl:ml-0">{label}</span>
            </a>
        </li>
    );

    const renderActiveTab = () => {
        switch (activeTab) {
            case Tab.POS: return <PointOfSale store={activeStore} user={activeUser} products={products} variants={variants} customers={customers} categories={categories} sales={sales} stockMap={stockMap} variantMap={variantMap} variantsByProduct={variantsByProduct} barcodeMap={barcodeMap} cart={cart} setCart={setCart} completeSale={completeSaleHandler} processReturn={processReturnHandler} payCustomerDebt={payCustomerDebtHandler} t={t} language={language} />;
            case Tab.Products: return <ProductManagement storeId={activeStore.id} products={products.filter(p => p.type === 'good')} variants={variants} suppliers={suppliers} categories={categories} stockMap={stockMap} addProduct={addProductHandler} updateProduct={updateProductHandler} deleteProduct={deleteProductHandler} addStockToVariant={addStockToVariantHandler} t={t} language={language} />;
            case Tab.Services: return <ServiceManagement storeId={activeStore.id} services={services} addService={addServiceHandler} updateService={updateServiceHandler} deleteService={deleteProductHandler} t={t} />;
            case Tab.Finance: return <FinanceAndReports storeId={activeStore.id} sales={sales} expenses={expenses} purchases={purchases} suppliers={suppliers} returns={returns} customers={customers} users={users} addExpense={addExpenseDB} updateExpense={updateExpenseDB} deleteExpense={removeExpenseDB} deleteReturn={removeReturnDB} deleteAllReturns={clearReturnsDB} t={t} language={language} theme={theme} onReprintInvoice={(sale) => setPrintableSale({ sale, mode: 'invoice'})}/>;
            case Tab.Customers: return <CustomerManagement storeId={activeStore.id} customers={customers} sales={sales} addCustomer={addCustomerDB} deleteCustomer={removeCustomerDB} payCustomerDebt={payCustomerDebtHandler} t={t} language={language} />;
            case Tab.Suppliers: return <SupplierManagement storeId={activeStore.id} suppliers={suppliers} purchases={purchases} products={products} variants={variants} addSupplier={addSupplierDB} deleteSupplier={removeSupplierDB} addPurchase={async (p, i) => {await addPurchaseDB(p)}} paySupplierDebt={async (id, a) => {}} addProduct={addProductHandler} t={t} language={language} />;
            case Tab.Categories: return <CategoryManagement storeId={activeStore.id} categories={categories} addCategory={addCategoryDB} updateCategory={updateCategoryDB} deleteCategory={removeCategoryDB} t={t} language={language} />;
            case Tab.Settings: return <UserManagement activeUser={activeUser} store={activeStore} storeId={activeStore.id} users={users} addUser={addUserDB} updateUser={updateUserDB} deleteUser={removeUserDB} onUpdateStore={(d) => updateStoreDB({...activeStore, ...d})} onBackup={()=>{}} onRestore={async ()=>{}} t={t} />;
            default: return null;
        }
    };

    return (
        <div className="bg-slate-100 dark:bg-slate-900 min-h-screen">
            {printableSale && <PrintableInvoice sale={printableSale.sale} mode={printableSale.mode} onClose={() => setPrintableSale(null)} store={activeStore} customers={customers} t={t} language={language} />}
            {printableReturn && <PrintableReturnReceipt returnObject={printableReturn} onClose={() => setPrintableReturn(null)} store={activeStore} t={t} language={language} />}
            <TrialBanner store={activeStore} t={t} />

            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} type="button" className="inline-flex items-center p-2 mt-2 ml-3 rtl:mr-3 rtl:ml-0 text-sm text-gray-500 rounded-lg sm:hidden hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:text-gray-400 dark:hover:bg-gray-700 dark:focus:ring-gray-600">
                <span className="sr-only">Open sidebar</span>
                <svg className="w-6 h-6" aria-hidden="true" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path clipRule="evenodd" fillRule="evenodd" d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zm0 10.5a.75.75 0 01.75-.75h7.5a.75.75 0 010 1.5h-7.5a.75.75 0 01-.75-.75zM2 10a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 10z"></path></svg>
            </button>

            <aside className={`fixed top-0 left-0 rtl:right-0 rtl:left-auto z-40 w-64 h-screen transition-transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} sm:translate-x-0`} aria-label="Sidebar">
                <div className="h-full px-3 py-4 overflow-y-auto bg-white dark:bg-slate-800 shadow-lg">
                    <div className="flex items-center pl-2.5 mb-5">
                       <Logo url={activeStore.logo} className="h-8 w-auto mr-3 rtl:ml-3 rtl:mr-0 rounded" />
                        <span className="self-center text-xl font-semibold whitespace-nowrap dark:text-white">{activeStore.name}</span>
                    </div>
                    <ul className="space-y-2">
                        <NavItem tab={Tab.POS} icon={ShoppingCartIcon} label={t('pos')} />
                        <NavItem tab={Tab.Products} icon={BoxIcon} label={t('products')} />
                        <NavItem tab={Tab.Services} icon={SparklesIcon} label={t('services')} />
                        <NavItem tab={Tab.Finance} icon={CoinsIcon} label={t('finance')} />
                        <hr className="my-2 border-slate-200 dark:border-slate-700"/>
                        <NavItem tab={Tab.Customers} icon={UsersIcon} label={t('customers')} />
                        <NavItem tab={Tab.Suppliers} icon={TruckIcon} label={t('suppliers')} />
                        <NavItem tab={Tab.Categories} icon={TagIcon} label={t('categories')} />
                         <hr className="my-2 border-slate-200 dark:border-slate-700"/>
                        <NavItem tab={Tab.Settings} icon={SettingsIcon} label={t('settings')} />
                    </ul>
                     <div className="absolute bottom-4 left-3 right-3">
                         <div className="p-3 text-center bg-slate-100 dark:bg-slate-700/50 rounded-lg">
                            <p className="font-bold text-sm text-slate-700 dark:text-slate-200">{activeUser.name}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{t(activeUser.role)}</p>
                         </div>
                        <button onClick={handleLogout} className="w-full mt-2 flex items-center justify-center p-2 text-sm font-normal text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50">
                            <LogoutIcon className="w-5 h-5" />
                            <span className="ml-3 rtl:mr-3 rtl:ml-0">{t('logout')}</span>
                        </button>
                    </div>
                </div>
            </aside>

            <main className="p-4 sm:ml-64 rtl:sm:mr-64 rtl:sm:ml-0">
                <div className="mt-4">
                    {lowStockVariants.length > 0 && activeTab === Tab.Products && (
                        <LowStockAlert products={products} variants={lowStockVariants} suppliers={suppliers} t={t} />
                    )}
                    {renderActiveTab()}
                </div>
            </main>
        </div>
    );
};

export default App;
