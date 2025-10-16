import { supabase } from './supabaseClient';
import type { Store, User, Product, ProductVariant, Sale, Expense, Customer, Supplier, Category, Purchase, CartItem, Return, StockBatch, VariantFormData } from './types';

// Helper to check for errors and throw them
const checkError = (error: any, context: string) => {
    if (error) {
        console.error(`Supabase error in ${context}:`, error);
        throw new Error(error.message);
    }
};

// ============================================================================
// STORE & AUTH FUNCTIONS
// ============================================================================

export const getStoreById = async (storeId: string): Promise<Store | null> => {
    const { data, error } = await supabase.from('stores').select('*').eq('id', storeId).single();
    checkError(error, 'getStoreById');
    return data;
};

export const getStoreByLicenseKey = async (licenseKey: string): Promise<Store | null> => {
    const { data, error } = await supabase.from('stores').select('*').eq('licenseKey', licenseKey).single();
    // Not throwing error here, as not found is a valid case during activation check.
    if (error && error.code !== 'PGRST116') { // PGRST116 is "exact one row not found"
        checkError(error, 'getStoreByLicenseKey');
    }
    return data;
};

export const login = async (store: Store, secret: string): Promise<{ user: User, store: Store }> => {
    if (!store.isActive) {
        throw new Error('storeDisabledError');
    }
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('storeId', store.id)
        .or(`password.eq.${secret},pin.eq.${secret}`);

    checkError(error, 'login');

    if (data && data.length > 0) {
        return { user: data[0], store };
    } else {
        throw new Error('invalidCredentialsError');
    }
};

export const verifyAndActivateStoreWithCode = async (storeId: string, activationCode: string): Promise<boolean> => {
    const MASTER_SECRET_KEY = 'GoShop-Activation-Key-Abzn-Secret-2024';
    if (!activationCode.startsWith('PERM-')) return false;

    try {
        const decoded = atob(activationCode.replace('PERM-', ''));
        const [decodedStoreId, secret] = decoded.split('::');
        
        if (decodedStoreId === storeId && secret === MASTER_SECRET_KEY) {
            const { error } = await supabase
                .from('stores')
                .update({ isActive: true, trialStartDate: null, licenseProof: new Date().toISOString() })
                .eq('id', storeId);
            checkError(error, 'verifyAndActivateStoreWithCode');
            return true;
        }
    } catch (e) {
        console.error("Activation code decoding failed", e);
    }
    return false;
};

// ============================================================================
// DATA FETCHING FUNCTIONS (GET ALL)
// ============================================================================

const getAllForStore = async <T>(table: string, storeId: string): Promise<T[]> => {
    const { data, error } = await supabase.from(table).select('*').eq('storeId', storeId);
    checkError(error, `getAllForStore (${table})`);
    return data || [];
};

export const getProducts = (storeId: string): Promise<Product[]> => getAllForStore<Product>('products', storeId);
export const getProductVariants = (storeId: string): Promise<ProductVariant[]> => getAllForStore<ProductVariant>('productVariants', storeId);
export const getSales = (storeId: string): Promise<Sale[]> => getAllForStore<Sale>('sales', storeId);
export const getExpenses = (storeId: string): Promise<Expense[]> => getAllForStore<Expense>('expenses', storeId);
export const getCustomers = (storeId: string): Promise<Customer[]> => getAllForStore<Customer>('customers', storeId);
export const getSuppliers = (storeId: string): Promise<Supplier[]> => getAllForStore<Supplier>('suppliers', storeId);
export const getCategories = (storeId: string): Promise<Category[]> => getAllForStore<Category>('categories', storeId);
export const getPurchases = (storeId: string): Promise<Purchase[]> => getAllForStore<Purchase>('purchases', storeId);
export const getStockBatches = (storeId: string): Promise<StockBatch[]> => getAllForStore<StockBatch>('stockBatches', storeId);
export const getReturns = (storeId: string): Promise<Return[]> => getAllForStore<Return>('returns', storeId);
export const getUsers = (storeId: string): Promise<User[]> => getAllForStore<User>('users', storeId);

// ============================================================================
// SUPER ADMIN FUNCTIONS
// ============================================================================

export const getAllStores = async (): Promise<Store[]> => {
    const { data, error } = await supabase.from('stores').select('*');
    checkError(error, 'getAllStores');
    return data || [];
};

export const getAllUsers = async (): Promise<User[]> => {
    const { data, error } = await supabase.from('users').select('*');
    checkError(error, 'getAllUsers');
    return data || [];
};

export const getAdminUserForStore = async (storeId: string): Promise<User | null> => {
    const { data, error } = await supabase.from('users').select('*').eq('storeId', storeId).eq('role', 'admin').single();
    checkError(error, 'getAdminUserForStore');
    return data;
};

export const createStoreAndAdmin = async (name: string, logo: string, adminPassword: string, adminEmail: string, trialDurationDays: number, address: string, ice: string, enableAiReceiptScan: boolean): Promise<{ store: Store, user: User, licenseKey: string }> => {
    const licenseKey = `GO-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const { data: storeData, error: storeError } = await supabase.from('stores').insert({ name, logo, licenseKey, trialDurationDays, address, ice, enableAiReceiptScan }).select().single();
    checkError(storeError, 'createStore');
    if (!storeData) throw new Error("Store creation failed");

    const { data: userData, error: userError } = await supabase.from('users').insert({ name: 'admin', email: adminEmail, password: adminPassword, role: 'admin', storeId: storeData.id }).select().single();
    checkError(userError, 'createAdmin');
    if (!userData) throw new Error("Admin creation failed");

    return { store: storeData, user: userData, licenseKey };
};

export const deleteStore = async (storeId: string): Promise<void> => {
    const { error } = await supabase.from('stores').delete().eq('id', storeId);
    checkError(error, 'deleteStore');
};

export const updateStore = async (store: Store | Partial<Store> & { id: string }): Promise<Store> => {
    const { data, error } = await supabase.from('stores').update(store).eq('id', store.id).select().single();
    checkError(error, 'updateStore');
    return data;
};

// ============================================================================
// GENERIC CRUD FUNCTIONS
// ============================================================================

const addSingle = async <T>(table: string, item: Omit<T, 'id'>): Promise<T> => {
    const { data, error } = await supabase.from(table).insert(item).select().single();
    checkError(error, `addSingle (${table})`);
    return data;
};

const updateSingle = async <T extends { id: string }>(table: string, item: T): Promise<void> => {
    const { error } = await supabase.from(table).update(item).eq('id', item.id);
    checkError(error, `updateSingle (${table})`);
};

const deleteSingle = async (table: string, id: string): Promise<void> => {
    const { error } = await supabase.from(table).delete().eq('id', id);
    checkError(error, `deleteSingle (${table})`);
};

// ============================================================================
// SPECIFIC HANDLERS
// ============================================================================

// --- Products & Variants ---

export const addProductWithVariants = async (productData: Omit<Product, 'id'>, variantsData: (Omit<ProductVariant, 'id'|'productId'|'storeId'> & {stockQuantity?: number})[]) => {
    const { data: product, error: productError } = await supabase.from('products').insert(productData).select().single();
    checkError(productError, 'addProductWithVariants (product)');
    if (!product) throw new Error("Product creation failed");

    const variantsToInsert = variantsData.map(v => ({
        ...v,
        productId: product.id,
        storeId: product.storeId,
    }));

    const { data: variants, error: variantError } = await supabase.from('productVariants').insert(variantsToInsert.map(({ stockQuantity, ...rest }) => rest)).select();
    checkError(variantError, 'addProductWithVariants (variants)');
    if (!variants) throw new Error("Variants creation failed");

    const stockBatchesToInsert = variants.map((v, i) => ({
        variantId: v.id,
        quantity: variantsData[i].stockQuantity || 0,
        purchasePrice: v.purchasePrice,
        storeId: product.storeId,
        createdAt: new Date().toISOString(),
    })).filter(sb => sb.quantity > 0);

    let stockBatches: StockBatch[] = [];
    if (stockBatchesToInsert.length > 0) {
        const { data: newStockBatches, error: stockError } = await supabase.from('stockBatches').insert(stockBatchesToInsert).select();
        checkError(stockError, 'addProductWithVariants (stock)');
        stockBatches = newStockBatches || [];
    }

    return { product, variants, stockBatches };
};

export const updateProductWithVariants = async (productData: Product, variantsData: VariantFormData[]) => {
    // 1. Update the product template
    const { error: productError } = await supabase.from('products').update(productData).eq('id', productData.id);
    checkError(productError, 'updateProductWithVariants (product)');

    const existingVariants = await getProductVariants(productData.storeId);
    const productVariants = existingVariants.filter(v => v.productId === productData.id);

    const variantsToUpdate: ProductVariant[] = [];
    const variantsToInsert: Omit<ProductVariant, 'id'>[] = [];
    const newStockBatches: Omit<StockBatch, 'id'>[] = [];

    for (const formData of variantsData) {
        if (formData.id) { // Existing variant
            const existing = productVariants.find(v => v.id === formData.id);
            if (existing) {
                variantsToUpdate.push({
                    ...existing,
                    ...formData,
                    id: formData.id,
                    priceSemiWholesale: formData.priceSemiWholesale || 0,
                    priceWholesale: formData.priceWholesale || 0,
                });
            }
        } else { // New variant
            variantsToInsert.push({
                ...formData,
                productId: productData.id,
                storeId: productData.storeId,
                priceSemiWholesale: formData.priceSemiWholesale || 0,
                priceWholesale: formData.priceWholesale || 0,
            });
        }
    }

    // 2. Update existing variants
    let updatedVariants: ProductVariant[] = [];
    if (variantsToUpdate.length > 0) {
        const { data, error } = await supabase.from('productVariants').upsert(variantsToUpdate).select();
        checkError(error, 'updateProductWithVariants (update variants)');
        updatedVariants = data || [];
    }

    // 3. Insert new variants
    let newVariants: ProductVariant[] = [];
    if (variantsToInsert.length > 0) {
        const { data, error } = await supabase.from('productVariants').insert(variantsToInsert.map(v => ({...v, stockQuantity: undefined}))).select();
        checkError(error, 'updateProductWithVariants (insert variants)');
        newVariants = data || [];
        
        // Add initial stock for new variants
        newVariants.forEach(nv => {
            const formData = variantsToInsert.find(v => v.name === nv.name);
            if(formData && 'stockQuantity' in formData && (formData as any).stockQuantity > 0){
                 newStockBatches.push({
                    variantId: nv.id,
                    quantity: (formData as any).stockQuantity,
                    purchasePrice: nv.purchasePrice,
                    storeId: productData.storeId,
                    createdAt: new Date().toISOString()
                });
            }
        });
    }

    // 4. Delete variants that are no longer in the list
    const deletedVariantIds = productVariants.filter(v => !variantsData.some(vd => vd.id === v.id)).map(v => v.id);
    if (deletedVariantIds.length > 0) {
        const { error } = await supabase.from('productVariants').delete().in('id', deletedVariantIds);
        checkError(error, 'updateProductWithVariants (delete variants)');
    }
    
    // 5. Add new stock batches
    if (newStockBatches.length > 0) {
        const { error } = await supabase.from('stockBatches').insert(newStockBatches);
        checkError(error, 'updateProductWithVariants (stock)');
    }

    return { updatedVariants, newVariants, deletedVariantIds, newStockBatches };
};


export const deleteProduct = (id: string) => deleteSingle('products', id);

// --- Stock & Purchases ---

export const addStock = async (data: { variantId: string; quantity: number; purchasePrice: number; sellingPrice: number; supplierId: string | undefined; }) => {
    const variant = (await supabase.from('productVariants').select('*').eq('id', data.variantId).single()).data;
    if (!variant) throw new Error("Variant not found");
    
    const purchaseItem: PurchaseItem = {
        variantId: data.variantId,
        productId: variant.productId,
        productName: '', // This will be enriched on client
        variantName: variant.name,
        quantity: data.quantity,
        purchasePrice: data.purchasePrice
    };

    const purchaseData: Omit<Purchase, 'id'> = {
        storeId: variant.storeId,
        supplierId: data.supplierId,
        date: new Date().toISOString(),
        items: [purchaseItem],
        totalAmount: data.quantity * data.purchasePrice,
        reference: 'purchase_ref_stock_adjustment',
        amountPaid: data.quantity * data.purchasePrice,
        remainingAmount: 0,
        paymentMethod: 'cash'
    };

    const { data: purchase, error: purchaseError } = await supabase.from('purchases').insert(purchaseData).select().single();
    checkError(purchaseError, 'addStock (purchase)');
    if (!purchase) throw new Error("Purchase creation failed");

    const stockBatchData = {
        variantId: data.variantId,
        quantity: data.quantity,
        purchasePrice: data.purchasePrice,
        storeId: variant.storeId,
        createdAt: new Date().toISOString()
    };
    
    const { data: newStockBatch, error: stockError } = await supabase.from('stockBatches').insert(stockBatchData).select().single();
    checkError(stockError, 'addStock (stock)');
    if (!newStockBatch) throw new Error("Stock batch creation failed");

    const updatedVariantData = { ...variant, purchasePrice: data.purchasePrice, price: data.sellingPrice };
    const { data: updatedVariant, error: variantError } = await supabase.from('productVariants').update(updatedVariantData).eq('id', data.variantId).select().single();
    checkError(variantError, 'addStock (variant update)');
    if (!updatedVariant) throw new Error("Variant update failed");

    return { purchase, newStockBatch, updatedVariant };
};

export const addPurchase = async (purchase: Omit<Purchase, 'id'>): Promise<{newPurchase: Purchase, newStockBatches: StockBatch[]}> => {
    const { data: newPurchase, error } = await supabase.from('purchases').insert(purchase).select().single();
    checkError(error, 'addPurchase');
    if (!newPurchase) throw new Error("Purchase creation failed");
    
    const stockBatchesToInsert = purchase.items.map(item => ({
        variantId: item.variantId,
        quantity: item.quantity,
        purchasePrice: item.purchasePrice,
        storeId: purchase.storeId,
        createdAt: purchase.date,
    }));

    const { data: newStockBatches, error: stockError } = await supabase.from('stockBatches').insert(stockBatchesToInsert).select();
    checkError(stockError, 'addPurchase (stock)');
    
    return { newPurchase, newStockBatches: newStockBatches || [] };
};

export const updatePurchase = (purchase: Purchase) => updateSingle('purchases', purchase);


// --- Sales & Returns ---
export const completeSale = async (cart: CartItem[], downPayment: number, customerId: string | undefined, finalTotal: number, userId: string, storeId: string): Promise<Sale> => {
    const profit = cart.reduce((acc, item) => {
        if(item.purchasePrice){
            return acc + (item.price - item.purchasePrice) * item.quantity;
        }
        return acc + item.price * item.quantity; // Assume 100% profit for services/custom
    }, 0);

    const sale: Omit<Sale, 'id'> = {
        storeId,
        userId,
        date: new Date().toISOString(),
        items: cart,
        total: finalTotal,
        downPayment,
        remainingAmount: finalTotal - downPayment,
        profit,
        customerId
    };

    return addSingle<Sale>('sales', sale);
};

export const processReturn = async (itemsToReturn: CartItem[], userId: string, storeId: string): Promise<Return> => {
    const refundAmount = itemsToReturn.reduce((acc, item) => acc + item.price * item.quantity, 0);
    const profitLost = itemsToReturn.reduce((acc, item) => {
        if(item.purchasePrice) {
            return acc + (item.price - item.purchasePrice) * item.quantity;
        }
        return acc;
    }, 0);
    
    const newReturn: Omit<Return, 'id'> = {
        storeId,
        userId,
        date: new Date().toISOString(),
        items: itemsToReturn,
        refundAmount,
        profitLost,
    };
    return addSingle<Return>('returns', newReturn);
};

export const payCustomerDebt = async (customerId: string, amount: number, userId: string, storeId: string): Promise<Sale> => {
    const sale: Omit<Sale, 'id'> = {
        storeId,
        userId,
        customerId,
        date: new Date().toISOString(),
        items: [{
            id: `debt_payment_${Date.now()}`,
            productId: `debt_payment_${Date.now()}`,
            storeId,
            name: `Paiement de dette`,
            price: amount,
            quantity: 1,
            type: 'service',
            image: '',
            isCustom: true
        }],
        total: 0, // It's a payment, not a sale of goods, so total is 0.
        downPayment: -amount, // Negative downpayment to reduce debt.
        remainingAmount: -amount,
        profit: 0
    };
    return addSingle<Sale>('sales', sale);
};

// --- Expenses ---
export const addExpense = (expense: Omit<Expense, 'id'>) => addSingle<Expense>('expenses', expense);
export const updateExpense = (expense: Expense) => updateSingle('expenses', expense);
export const deleteExpense = (id: string) => deleteSingle('expenses', id);

// --- Returns ---
export const deleteReturn = (id: string) => deleteSingle('returns', id);
export const deleteAllReturns = async (storeId: string): Promise<void> => {
    const { error } = await supabase.from('returns').delete().eq('storeId', storeId);
    checkError(error, 'deleteAllReturns');
};

// --- Customers ---
export const addCustomer = (customer: Omit<Customer, 'id'>) => addSingle<Customer>('customers', customer);
export const deleteCustomer = async (id: string) => {
    const { data: sales, error } = await supabase.from('sales').select('remainingAmount').eq('customerId', id);
    checkError(error, 'deleteCustomer (check debt)');
    const totalDebt = sales?.reduce((sum, s) => sum + s.remainingAmount, 0) || 0;
    if (totalDebt > 0) {
        throw new Error('customerDeleteErrorHasDebt');
    }
    await deleteSingle('customers', id);
};

// --- Suppliers ---
export const addSupplier = (supplier: Omit<Supplier, 'id'>) => addSingle<Supplier>('suppliers', supplier);
export const deleteSupplier = async (id: string) => {
    const { data: purchases, error } = await supabase.from('purchases').select('remainingAmount').eq('supplierId', id);
    checkError(error, 'deleteSupplier (check debt)');
    const totalDebt = purchases?.reduce((sum, p) => sum + p.remainingAmount, 0) || 0;
    if (totalDebt > 0) {
        throw new Error('supplierDeleteErrorHasDebt');
    }
    await deleteSingle('suppliers', id);
};

// --- Categories ---
export const addCategory = (category: Omit<Category, 'id'>) => addSingle<Category>('categories', category);
export const updateCategory = (category: Category) => updateSingle('categories', category);
export const deleteCategory = (id: string) => deleteSingle('categories', id);

// --- Users ---
export const addUser = (user: Omit<User, 'id'>) => addSingle<User>('users', user);
export const updateUser = (user: User) => updateSingle('users', user);
export const deleteUser = (id: string) => deleteSingle('users', id);
