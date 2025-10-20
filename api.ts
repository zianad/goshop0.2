import { supabase } from './supabaseClient';
// FIX: Add 'PurchaseItem' to the type import to resolve a missing type error.
import type { Store, User, Product, ProductVariant, Sale, Expense, Customer, Supplier, Category, Purchase, CartItem, Return, StockBatch, VariantFormData, PurchaseItem } from './types';

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

const addSingle = async <T extends {id: any}>(table: string, item: Omit<T, 'id'>): Promise<T> => {
    const { data, error } = await supabase.from(table).insert(item).select().single();
    checkError(error, `addSingle (${table})`);
    return data;
};

const updateSingle = async <T extends { id: string }>(table: string, item: T): Promise<void> => {
    const { error } = await supabase.from(table).update(item as any).eq('id', item.id);
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
    const variantsToInsert: (Omit<VariantFormData, 'id' | 'stockQuantity'> & {productId: string, storeId: string})[] = [];
    const newStockBatchesToCreate: Omit<StockBatch, 'id'>[] = [];

    for (const formData of variantsData) {
        if (formData.id) { // Existing variant
            const existing = productVariants.find(v => v.id === formData.id);
            if (existing) {
                const { stockQuantity, ...rest } = formData;
                variantsToUpdate.push({
                    ...existing,
                    ...rest,
                    id: formData.id,
                    priceSemiWholesale: formData.priceSemiWholesale || 0,
                    priceWholesale: formData.priceWholesale || 0,
                });
            }
        } else { // New variant
            const { stockQuantity, ...rest } = formData;
            variantsToInsert.push({
                ...rest,
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
        const { data, error } = await supabase.from('productVariants').insert(variantsToInsert).select();
        checkError(error, 'updateProductWithVariants (insert variants)');
        newVariants = data || [];
        
        // Add initial stock for new variants
        newVariants.forEach(nv => {
            const formData = variantsData.find(v => !v.id && v.name === nv.name);
            if(formData && formData.stockQuantity > 0){
                 newStockBatchesToCreate.push({
                    variantId: nv.id,
                    quantity: formData.stockQuantity,
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
    
    // 5. Add new stock batches and get them back with IDs
    let insertedStockBatches: StockBatch[] = [];
    if (newStockBatchesToCreate.length > 0) {
        const { data, error } = await supabase.from('stockBatches').insert(newStockBatchesToCreate).select();
        checkError(error, 'updateProductWithVariants (stock)');
        insertedStockBatches = data || [];
    }

    return { updatedVariants, newVariants, deletedVariantIds, newStockBatches: insertedStockBatches };
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
    // FIX: Fixed a copy-paste error in the context string.
    checkError(purchaseError, 'addStock (purchase)');
    if(!purchase) throw new Error("Purchase creation failed in addStock");
    
    const stockBatchData: Omit<StockBatch, 'id'> = {
        variantId: data.variantId,
        quantity: data.quantity,
        purchasePrice: data.purchasePrice,
        storeId: variant.storeId,
        createdAt: new Date().toISOString(),
    };

    const { data: newStockBatch, error: stockError } = await supabase.from('stockBatches').insert(stockBatchData).select().single();
    checkError(stockError, 'addStock (stock batch)');
    if(!newStockBatch) throw new Error("Stock batch creation failed in addStock");

    const { data: updatedVariant, error: variantError } = await supabase.from('productVariants').update({ price: data.sellingPrice, purchasePrice: data.purchasePrice }).eq('id', data.variantId).select().single();
    checkError(variantError, 'addStock (variant update)');
    if (!updatedVariant) throw new Error("Variant update failed in addStock");

    return { purchase, newStockBatch, updatedVariant };
};

// FIX: Added missing addPurchase function
export const addPurchase = async (purchaseData: Omit<Purchase, 'id'>): Promise<{newPurchase: Purchase, newStockBatches: StockBatch[]}> => {
    const { data: newPurchase, error: purchaseError } = await supabase.from('purchases').insert(purchaseData).select().single();
    checkError(purchaseError, 'addPurchase');
    if (!newPurchase) throw new Error("Purchase creation failed");

    const newStockBatchesToCreate = purchaseData.items.map(item => ({
        variantId: item.variantId,
        quantity: item.quantity,
        purchasePrice: item.purchasePrice,
        storeId: purchaseData.storeId,
        createdAt: new Date().toISOString()
    }));

    const { data: newStockBatches, error: stockError } = await supabase.from('stockBatches').insert(newStockBatchesToCreate).select();
    checkError(stockError, 'addPurchase (stock batches)');

    return { newPurchase, newStockBatches: newStockBatches || [] };
}

// FIX: Added missing updatePurchase function
export const updatePurchase = (purchase: Purchase): Promise<void> => updateSingle<Purchase>('purchases', purchase);


// --- Sales & Returns ---

// FIX: Added missing completeSale function
export const completeSale = async (cart: CartItem[], downPayment: number, customerId: string | undefined, finalTotal: number, userId: string, storeId: string): Promise<Sale> => {
    const profit = cart.reduce((acc, item) => {
        const purchasePrice = item.purchasePrice || 0;
        return acc + (item.price - purchasePrice) * item.quantity;
    }, 0);

    const newSale: Omit<Sale, 'id'> = {
        storeId,
        userId,
        date: new Date().toISOString(),
        items: cart,
        total: finalTotal,
        downPayment: downPayment,
        remainingAmount: finalTotal - downPayment,
        profit,
        customerId
    };
    return addSingle<Sale>('sales', newSale);
};

// FIX: Added missing processReturn function
export const processReturn = async (itemsToReturn: CartItem[], userId: string, storeId: string): Promise<Return> => {
    const refundAmount = itemsToReturn.reduce((acc, item) => acc + item.price * item.quantity, 0);
    const profitLost = itemsToReturn.reduce((acc, item) => {
        const purchasePrice = item.purchasePrice || 0;
        return acc + (item.price - purchasePrice) * item.quantity;
    }, 0);

    const newReturn: Omit<Return, 'id'> = {
        storeId,
        userId,
        date: new Date().toISOString(),
        items: itemsToReturn,
        refundAmount,
        profitLost
    };
    return addSingle<Return>('returns', newReturn);
};

// FIX: Added missing payCustomerDebt function
export const payCustomerDebt = async (customerId: string, amount: number, userId: string, storeId: string): Promise<Sale> => {
    const paymentSale: Omit<Sale, 'id'> = {
        storeId,
        userId,
        customerId,
        date: new Date().toISOString(),
        items: [],
        total: 0,
        downPayment: amount,
        remainingAmount: -amount, // This will reduce the total debt when summing remainingAmounts
        profit: 0,
    };
    return addSingle<Sale>('sales', paymentSale);
};

// --- Expenses ---
// FIX: Added missing addExpense function
export const addExpense = (expense: Omit<Expense, 'id'>): Promise<Expense> => addSingle<Expense>('expenses', expense);
// FIX: Added missing updateExpense function
export const updateExpense = (expense: Expense): Promise<void> => updateSingle<Expense>('expenses', expense);
// FIX: Added missing deleteExpense function
export const deleteExpense = (id: string): Promise<void> => deleteSingle('expenses', id);

// --- Customers ---
// FIX: Added missing addCustomer function
export const addCustomer = (customer: Omit<Customer, 'id'>): Promise<Customer> => addSingle<Customer>('customers', customer);
// FIX: Added missing deleteCustomer function
export const deleteCustomer = async (id: string): Promise<void> => {
    // Check for outstanding debt before deleting
    const { data: sales, error } = await supabase.from('sales').select('remainingAmount').eq('customerId', id);
    checkError(error, 'deleteCustomer (check debt)');
    const totalDebt = sales?.reduce((acc, s) => acc + s.remainingAmount, 0) || 0;
    if (totalDebt > 0) {
        throw new Error('customerDeleteErrorHasDebt');
    }
    return deleteSingle('customers', id);
};

// --- Suppliers ---
// FIX: Added missing addSupplier function
export const addSupplier = (supplier: Omit<Supplier, 'id'>): Promise<Supplier> => addSingle<Supplier>('suppliers', supplier);
// FIX: Added missing deleteSupplier function
export const deleteSupplier = async (id: string): Promise<void> => {
    const { data: purchases, error } = await supabase.from('purchases').select('remainingAmount').eq('supplierId', id);
    checkError(error, 'deleteSupplier (check debt)');
    const totalDebt = purchases?.reduce((acc, p) => acc + p.remainingAmount, 0) || 0;
    if (totalDebt > 0) {
        throw new Error('supplierDeleteErrorHasDebt');
    }
    return deleteSingle('suppliers', id);
};

// --- Categories ---
// FIX: Added missing addCategory function
export const addCategory = (category: Omit<Category, 'id'>): Promise<Category> => addSingle<Category>('categories', category);
// FIX: Added missing updateCategory function
export const updateCategory = (category: Category): Promise<void> => updateSingle<Category>('categories', category);
// FIX: Added missing deleteCategory function
export const deleteCategory = (id: string): Promise<void> => deleteSingle('categories', id);

// --- Users ---
// FIX: Added missing addUser function
export const addUser = (user: Omit<User, 'id'>): Promise<User> => addSingle<User>('users', user);
// FIX: Added missing updateUser function
export const updateUser = (user: User): Promise<void> => updateSingle<User>('users', user);
// FIX: Added missing deleteUser function
export const deleteUser = (id: string): Promise<void> => deleteSingle('users', id);