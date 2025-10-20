import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  PointOfSale, ProductManagement, FinanceAndReports, CustomerManagement,
  SupplierManagement, CategoryManagement, ServiceManagement, UserManagement,
  Sidebar, Auth, SuperAdminDashboard, SuperAdminLanding
} from './components';
import type {
  Store, User, Product, ProductVariant, Sale, Expense, Customer, Supplier, Category,
  Purchase, CartItem, Return, StockBatch, VariantFormData, PurchaseItem
} from './types';
import { Tab } from './types';
import { useIndexedDBStore } from './hooks/useIndexedDBStore';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useSessionStorage } from './hooks/useSessionStorage';
import { translations } from './translations';
import * as api from './api';
import TrialBanner from './components/TrialBanner';
import PrintableInvoice from './components/PrintableInvoice';

function App() {
  const [theme, setTheme] = useLocalStorage<'light' | 'dark'>('theme',
    () => window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  );
  const [language, setLanguage] = useLocalStorage<'fr' | 'ar'>('language', 'fr');
  
  const [activeUser, setActiveUser] = useSessionStorage<User | null>('active-user', null);
  const [activeStore, setActiveStore] = useSessionStorage<Store | null>('active-store', null);
  const [isSuperAdmin, setIsSuperAdmin] = useSessionStorage<boolean>('is-super-admin', false);
  const [isSuperAdminDashboard, setIsSuperAdminDashboard] = useState(false);

  const [activeTab, setActiveTab] = useState<Tab>(Tab.POS);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isPrintingInvoice, setIsPrintingInvoice] = useState(false);
  const [saleToPrint, setSaleToPrint] = useState<Sale | null>(null);
  const [printMode, setPrintMode] = useState<'invoice' | 'orderForm'>('invoice');

  const t = useCallback((key: keyof typeof translations.fr, options?: { [key: string]: string | number }) => {
    let translation = translations[language][key] || translations.fr[key];
    if (options) {
      Object.keys(options).forEach(optionKey => {
        translation = translation.replace(`{${optionKey}}`, String(options[optionKey]));
      });
    }
    return translation;
  }, [language]);

  // Data Stores
  const storeId = activeStore?.id || '';
  const productsDB = useIndexedDBStore<Product>('products');
  const variantsDB = useIndexedDBStore<ProductVariant>('productVariants');
  const salesDB = useIndexedDBStore<Sale>('sales');
  const expensesDB = useIndexedDBStore<Expense>('expenses');
  const customersDB = useIndexedDBStore<Customer>('customers');
  const suppliersDB = useIndexedDBStore<Supplier>('suppliers');
  const categoriesDB = useIndexedDBStore<Category>('categories');
  const purchasesDB = useIndexedDBStore<Purchase>('purchases');
  const stockBatchesDB = useIndexedDBStore<StockBatch>('stockBatches');
  const returnsDB = useIndexedDBStore<Return>('returns');
  const usersDB = useIndexedDBStore<User>('users');
  const storesDB = useIndexedDBStore<Store>('stores');

  const fetchDataForStore = async (storeId: string) => {
    // A simple sync, clearing local and fetching fresh from remote
    await Promise.all([
      productsDB.clear(), variantsDB.clear(), salesDB.clear(), expensesDB.clear(),
      customersDB.clear(), suppliersDB.clear(), categoriesDB.clear(), purchasesDB.clear(),
      stockBatchesDB.clear(), returnsDB.clear(), usersDB.clear()
    ]);
    const [
      products, variants, sales, expenses, customers, suppliers, categories, purchases, stockBatches, returns, users
    ] = await Promise.all([
      api.getProducts(storeId), api.getProductVariants(storeId), api.getSales(storeId), api.getExpenses(storeId),
      api.getCustomers(storeId), api.getSuppliers(storeId), api.getCategories(storeId), api.getPurchases(storeId),
      api.getStockBatches(storeId), api.getReturns(storeId), api.getUsers(storeId)
    ]);
    await Promise.all([
      productsDB.bulkAdd(products), variantsDB.bulkAdd(variants), salesDB.bulkAdd(sales), expensesDB.bulkAdd(expenses),
      customersDB.bulkAdd(customers), suppliersDB.bulkAdd(suppliers), categoriesDB.bulkAdd(categories),
      purchasesDB.bulkAdd(purchases), stockBatchesDB.bulkAdd(stockBatches), returnsDB.bulkAdd(returns), usersDB.bulkAdd(users)
    ]);
  };
  
  const handleLoginSuccess = async (user: User, store: Store) => {
      setActiveUser(user);
      setActiveStore(store);
      await storesDB.clear();
      await storesDB.add(store);
      await fetchDataForStore(store.id);
  }

  const handleLogout = () => {
    setActiveUser(null);
    setActiveStore(null);
    setIsSuperAdmin(false);
    setIsSuperAdminDashboard(false);
    // Clear session storage just in case
    sessionStorage.removeItem('active-user');
    sessionStorage.removeItem('active-store');
    sessionStorage.removeItem('is-super-admin');
  };

  const stockMap = useMemo(() => {
    const map = new Map<string, number>();
    stockBatchesDB.data.forEach(batch => {
      map.set(batch.variantId, (map.get(batch.variantId) || 0) + batch.quantity);
    });
    salesDB.data.forEach(sale => {
      sale.items.forEach(item => {
        if (item.type === 'good') {
          map.set(item.id, (map.get(item.id) || 0) - item.quantity);
        }
      });
    });
    returnsDB.data.forEach(ret => {
      ret.items.forEach(item => {
        if (item.type === 'good') {
          map.set(item.id, (map.get(item.id) || 0) + item.quantity);
        }
      });
    });
    return map;
  }, [stockBatchesDB.data, salesDB.data, returnsDB.data]);
  
  const derivedMaps = useMemo(() => {
    const variantMap = new Map<string, ProductVariant>();
    const variantsByProduct = new Map<string, ProductVariant[]>();
    const barcodeMap = new Map<string, ProductVariant>();
    variantsDB.data.forEach(v => {
      variantMap.set(v.id, v);
      const existing = variantsByProduct.get(v.productId) || [];
      existing.push(v);
      variantsByProduct.set(v.productId, existing);
      if (v.barcode) {
        barcodeMap.set(v.barcode, v);
      }
    });
    return { variantMap, variantsByProduct, barcodeMap };
  }, [variantsDB.data]);


  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
  }, [theme, language]);

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  // --- CRUD Handlers ---
  const addProduct = async (productData: Omit<Product, 'id'>, variantsData: Omit<VariantFormData, 'stockQuantity'>[]) => {
    const { product, variants, stockBatches } = await api.addProductWithVariants(productData, variantsData);
    await productsDB.add(product);
    await variantsDB.bulkAdd(variants);
    await stockBatchesDB.bulkAdd(stockBatches);
    return { product, variants };
  };

  const updateProduct = async (productData: Product, variantsData: VariantFormData[]) => {
      const { updatedVariants, newVariants, deletedVariantIds, newStockBatches } = await api.updateProductWithVariants(productData, variantsData);
      await productsDB.update(productData);
      for(const v of updatedVariants) { await variantsDB.update(v); }
      await variantsDB.bulkAdd(newVariants);
      for (const id of deletedVariantIds) { await variantsDB.remove(id); }
      await stockBatchesDB.bulkAdd(newStockBatches);
  };

  const deleteProduct = async (id: string) => {
    await api.deleteProduct(id);
    await productsDB.remove(id);
    // Also remove associated variants and stock batches from local state
    const variantsToRemove = variantsDB.data.filter(v => v.productId === id);
    for(const variant of variantsToRemove) {
      await variantsDB.remove(variant.id);
      const batchesToRemove = stockBatchesDB.data.filter(sb => sb.variantId === variant.id);
      for(const batch of batchesToRemove) {
        await stockBatchesDB.remove(batch.id);
      }
    }
  };

  const addStockToVariant = async (data: { variantId: string; quantity: number; purchasePrice: number; sellingPrice: number; supplierId: string | undefined; }) => {
    const { purchase, newStockBatch, updatedVariant } = await api.addStock(data);
    await purchasesDB.add(purchase);
    await stockBatchesDB.add(newStockBatch);
    await variantsDB.update(updatedVariant);
  };
  
  const addPurchase = async (purchase: Omit<Purchase, 'id'>, items: PurchaseItem[]) => {
    const { newPurchase, newStockBatches } = await api.addPurchase({...purchase, items});
    await purchasesDB.add(newPurchase);
    await stockBatchesDB.bulkAdd(newStockBatches);
  }
  
  const paySupplierDebt = async (supplierId: string, amount: number) => {
      // Find oldest unpaid purchase and pay it off
      const supplierPurchases = purchasesDB.data
          .filter(p => p.supplierId === supplierId && p.remainingAmount > 0)
          .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      let remainingAmountToPay = amount;
      for (const purchase of supplierPurchases) {
          if (remainingAmountToPay <= 0) break;
          
          const paymentForThisPurchase = Math.min(remainingAmountToPay, purchase.remainingAmount);
          const updatedPurchase = {
              ...purchase,
              amountPaid: purchase.amountPaid + paymentForThisPurchase,
              remainingAmount: purchase.remainingAmount - paymentForThisPurchase,
          };
          
          await api.updatePurchase(updatedPurchase);
          await purchasesDB.update(updatedPurchase);
          
          remainingAmountToPay -= paymentForThisPurchase;
      }
  };

  const completeSale = async (downPayment: number, customerId: string | undefined, finalTotal: number, printMode: 'invoice' | 'orderForm') => {
    if (!activeUser || !activeStore) return;
    const newSale = await api.completeSale(cart, downPayment, customerId, finalTotal, activeUser.id, activeStore.id);
    await salesDB.add(newSale);
    setCart([]);
    setSaleToPrint(newSale);
    setPrintMode(printMode);
    setIsPrintingInvoice(true);
  };
  
  const processReturn = async (itemsToReturn: CartItem[]) => {
    if (!activeUser || !activeStore) return;
    const newReturn = await api.processReturn(itemsToReturn, activeUser.id, activeStore.id);
    await returnsDB.add(newReturn);
    setCart([]);
  };
  
  const payCustomerDebt = async (customerId: string, amount: number) => {
    if (!activeUser || !activeStore) return;
    const paymentSale = await api.payCustomerDebt(customerId, amount, activeUser.id, activeStore.id);
    await salesDB.add(paymentSale);
  };

  const addExpense = async (expense: Omit<Expense, 'id'>) => {
      const newExpense = await api.addExpense(expense);
      if (newExpense) await expensesDB.add(newExpense);
      return newExpense;
  };
  const updateExpense = async (expense: Expense) => { await api.updateExpense(expense); await expensesDB.update(expense); };
  const deleteExpense = async (id: string) => { await api.deleteExpense(id); await expensesDB.remove(id); };
  
  const addCustomer = async (customer: Omit<Customer, 'id'>) => {
    const newCustomer = await api.addCustomer(customer);
    if (newCustomer) await customersDB.add(newCustomer);
    return newCustomer;
  };
  const deleteCustomer = async (id: string) => { await api.deleteCustomer(id); await customersDB.remove(id); };

  const addSupplier = async (supplier: Omit<Supplier, 'id'>) => {
    const newSupplier = await api.addSupplier(supplier);
    if (newSupplier) await suppliersDB.add(newSupplier);
    return newSupplier;
  };
  const deleteSupplier = async (id: string) => { await api.deleteSupplier(id); await suppliersDB.remove(id); };
  
  const addCategory = async (category: Omit<Category, 'id'>) => {
    const newCategory = await api.addCategory(category);
    if (newCategory) await categoriesDB.add(newCategory);
    return newCategory;
  };
  const updateCategory = async (category: Category) => { await api.updateCategory(category); await categoriesDB.update(category); };
  const deleteCategory = async (id: string) => { await api.deleteCategory(id); await categoriesDB.remove(id); };

  const addUser = async (user: Omit<User, 'id'>) => {
    const newUser = await api.addUser(user);
    if (newUser) await usersDB.add(newUser);
    return newUser;
  };
  const updateUser = async (user: User) => { await api.updateUser(user); await usersDB.update(user); };
  const deleteUser = async (id: string) => { await api.deleteUser(id); await usersDB.remove(id); };

  const updateStore = async (storeData: Partial<Store>) => {
    if(!activeStore) return;
    const updatedStore = await api.updateStore({...activeStore, ...storeData});
    setActiveStore(updatedStore);
    await storesDB.update(updatedStore);
  }

  const handleBackup = () => {
    const backupData = {
        stores: storesDB.data,
        products: productsDB.data,
        productVariants: variantsDB.data,
        sales: salesDB.data,
        expenses: expensesDB.data,
        customers: customersDB.data,
        suppliers: suppliersDB.data,
        categories: categoriesDB.data,
        purchases: purchasesDB.data,
        stockBatches: stockBatchesDB.data,
        returns: returnsDB.data,
        users: usersDB.data,
    };
    const jsonString = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `goshop-backup-${activeStore?.name.replace(/\s/g, '_')}-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  
  const handleRestore = async (jsonString: string) => {
    if (!activeStore) return;
    try {
        const data = JSON.parse(jsonString);
        if (data.stores && data.stores[0]?.id !== activeStore.id) {
            alert(t('restoreStoreIdMismatchError', { storeName: activeStore.name }));
            return;
        }
        await Promise.all([
          // clear remote tables
        ]);
        await Promise.all([
          storesDB.clear(), productsDB.clear(), variantsDB.clear(), salesDB.clear(), expensesDB.clear(),
          customersDB.clear(), suppliersDB.clear(), categoriesDB.clear(), purchasesDB.clear(), stockBatchesDB.clear(),
          returnsDB.clear(), usersDB.clear()
        ]);
        // This is a simplified restore. A real-world one would be more complex, handling conflicts and IDs.
        // For now, it just re-populates the local DB. Remote sync is out of scope for this version.
        await storesDB.bulkAdd(data.stores || []);
        await productsDB.bulkAdd(data.products || []);
        await variantsDB.bulkAdd(data.productVariants || []);
        await salesDB.bulkAdd(data.sales || []);
        await expensesDB.bulkAdd(data.expenses || []);
        await customersDB.bulkAdd(data.customers || []);
        await suppliersDB.bulkAdd(data.suppliers || []);
        await categoriesDB.bulkAdd(data.categories || []);
        await purchasesDB.bulkAdd(data.purchases || []);
        await stockBatchesDB.bulkAdd(data.stockBatches || []);
        await returnsDB.bulkAdd(data.returns || []);
        await usersDB.bulkAdd(data.users || []);
        
        alert(t('restoreSuccess'));
        window.location.reload();
    } catch(e: any) {
        alert(`${t('restoreError')}: ${e.message}`);
    }
  };


  if (isSuperAdmin) {
    if (isSuperAdminDashboard) {
      return <SuperAdminDashboard 
        onLoginAsStoreAdmin={handleLoginSuccess}
        onLogout={handleLogout}
        onGoBack={() => setIsSuperAdminDashboard(false)}
        t={t}
        language={language}
        setLanguage={setLanguage}
        theme={theme}
        toggleTheme={toggleTheme}
      />;
    }
    return <SuperAdminLanding 
      onLoginAsStoreAdmin={handleLoginSuccess}
      onGoToDashboard={() => setIsSuperAdminDashboard(true)}
      onLogout={handleLogout}
      t={t}
      language={language}
      setLanguage={setLanguage}
      theme={theme}
      toggleTheme={toggleTheme}
    />;
  }
  
  if (!activeUser || !activeStore) {
    return <Auth 
      onLoginSuccess={handleLoginSuccess}
      onSuperAdminLogin={() => setIsSuperAdmin(true)}
      t={t} 
      language={language} 
      setLanguage={setLanguage} 
      theme={theme} 
      toggleTheme={toggleTheme} 
    />;
  }
  
  const renderTab = () => {
    switch (activeTab) {
      case Tab.POS: return <PointOfSale store={activeStore} user={activeUser} products={productsDB.data} variants={variantsDB.data} customers={customersDB.data} categories={categoriesDB.data} sales={salesDB.data} stockMap={stockMap} variantMap={derivedMaps.variantMap} variantsByProduct={derivedMaps.variantsByProduct} barcodeMap={derivedMaps.barcodeMap} cart={cart} setCart={setCart} completeSale={completeSale} processReturn={processReturn} payCustomerDebt={payCustomerDebt} t={t} language={language} />;
      case Tab.Products: return <ProductManagement storeId={storeId} products={productsDB.data.filter(p=>p.type === 'good')} variants={variantsDB.data} suppliers={suppliersDB.data} categories={categoriesDB.data} stockMap={stockMap} addProduct={addProduct} updateProduct={updateProduct} deleteProduct={deleteProduct} addStockToVariant={addStockToVariant} t={t} language={language} />;
      case Tab.Services: return <ServiceManagement storeId={storeId} services={productsDB.data.filter(p=>p.type === 'service')} addService={addProduct} updateService={updateProduct} deleteService={deleteProduct} t={t} />;
      case Tab.Finance: return <FinanceAndReports storeId={storeId} sales={salesDB.data} expenses={expensesDB.data} purchases={purchasesDB.data} suppliers={suppliersDB.data} returns={returnsDB.data} customers={customersDB.data} users={usersDB.data} addProduct={addProduct} addExpense={addExpense} updateExpense={updateExpense} deleteExpense={deleteExpense} deleteReturn={returnsDB.remove} deleteAllReturns={() => {}} onReprintInvoice={(sale) => { setSaleToPrint(sale); setPrintMode('invoice'); setIsPrintingInvoice(true); }} t={t} language={language} theme={theme} />;
      case Tab.Customers: return <CustomerManagement storeId={storeId} customers={customersDB.data} sales={salesDB.data} addCustomer={addCustomer} deleteCustomer={deleteCustomer} payCustomerDebt={payCustomerDebt} t={t} language={language} />;
      case Tab.Suppliers: return <SupplierManagement storeId={storeId} suppliers={suppliersDB.data} purchases={purchasesDB.data} addSupplier={addSupplier} deleteSupplier={deleteSupplier} addPurchase={addPurchase} paySupplierDebt={paySupplierDebt} products={productsDB.data} variants={variantsDB.data} addProduct={addProduct} t={t} language={language} />;
      case Tab.Categories: return <CategoryManagement storeId={storeId} categories={categoriesDB.data} addCategory={addCategory} updateCategory={updateCategory} deleteCategory={deleteCategory} t={t} language={language} />;
      case Tab.Settings: return <UserManagement activeUser={activeUser} store={activeStore} storeId={storeId} users={usersDB.data} addUser={addUser} updateUser={updateUser} deleteUser={deleteUser} onUpdateStore={updateStore} onBackup={handleBackup} onRestore={handleRestore} t={t} />;
      default: return null;
    }
  };

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-slate-900" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {isPrintingInvoice && saleToPrint && (
        <PrintableInvoice
          sale={saleToPrint}
          mode={printMode}
          store={activeStore}
          customers={customersDB.data}
          onClose={() => setIsPrintingInvoice(false)}
          t={t}
          language={language}
        />
      )}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} onLogout={handleLogout} user={activeUser} t={t} language={language} theme={theme} toggleTheme={toggleTheme} />
      <main className="flex-1 overflow-y-auto p-6">
        <TrialBanner store={activeStore} t={t} />
        {renderTab()}
      </main>
    </div>
  );
}

export default App;
