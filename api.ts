import { supabase } from './supabaseClient';
import type { Store, User, Product, ProductVariant, Sale, Expense, Return, Customer, Supplier, Category, Purchase, StockBatch, StoreTypeMap, CartItem } from './types';

// AUTH & STORE MANAGEMENT
export const getStoreByLicenseKey = async (licenseKey: string): Promise<Store | null> => {
    const { data, error } = await supabase.from('stores').select('*').eq('licenseKey', licenseKey).single();
    if (error && error.code !== 'PGRST116') { // PGRST116: "not a single row"
        console.error('getStoreByLicenseKey error:', error);
        throw new Error(error.message);
    }
    return data;
};

export const getStoreById = async (id: string): Promise<Store | null> => {
    const { data, error } = await supabase.from('stores').select('*').eq('id', id).single();
    if (error) throw new Error(error.message);
    return data;
}

export const login = async (store: Store, secret: string): Promise<{ user: User; store: Store }> => {
    if (!store.isActive) {
        throw new Error('storeDisabledError');
    }
    const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('storeId', store.id)
        .or(`pin.eq.${secret},password.eq.${secret}`)
        .single();
    
    if (error || !user) {
        throw new Error('invalidCredentialsError');
    }
    
    return { user, store };
};

export const verifyAndActivateStoreWithCode = async (storeId: string, code: string): Promise<boolean> => {
    if (!code.startsWith('PERM-')) return false;

    try {
        const decoded = atob(code.replace('PERM-', ''));
        const [decodedStoreId, secret] = decoded.split('::');

        if (decodedStoreId === storeId && secret === 'GoShop-Activation-Key-Abzn-Secret-2024') {
            const { error } = await supabase
                .from('stores')
                .update({ isActive: true, trialStartDate: null })
                .eq('id', storeId);

            if (error) throw error;
            return true;
        }
        return false;
    } catch (e) {
        console.error("Activation code verification failed", e);
        return false;
    }
}


// SUPER ADMIN FUNCTIONS
export const getAllStores = async (): Promise<Store[]> => {
    const { data, error } = await supabase.from('stores').select('*');
    if (error) throw new Error(error.message);
    return data || [];
};

export const getAllUsers = async (): Promise<User[]> => {
    const { data, error } = await supabase.from('users').select('*');
    if (error) throw new Error(error.message);
    return data || [];
};

export const getAdminUserForStore = async (storeId: string): Promise<User | null> => {
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('storeId', storeId)
        .eq('role', 'admin')
        .single();
    if (error && error.code !== 'PGRST116') throw new Error(error.message);
    return data;
};

export const createStoreAndAdmin = async (name: string, logo: string, adminPassword: string, adminEmail: string, trialDurationDays: number, address: string, ice: string, enableAiReceiptScan: boolean) => {
    const licenseKey = `gs-${crypto.randomUUID().split('-')[0]}-${crypto.randomUUID().split('-')[1]}`;
    
    const { data: storeData, error: storeError } = await supabase.from('stores').insert({
        name,
        logo,
        licenseKey,
        trialDurationDays,
        address,
        ice,
        enableAiReceiptScan,
        isActive: false
    }).select().single();

    if (storeError) throw new Error(storeError.message);

    const { error: userError } = await supabase.from('users').insert({
        storeId: storeData.id,
        name: 'Admin',
        email: adminEmail,
        password: adminPassword,
        role: 'admin'
    });

    if (userError) {
        await supabase.from('stores').delete().eq('id', storeData.id);
        throw new Error(userError.message);
    }
    
    return { store: storeData, licenseKey };
};

export const updateStore = async (store: Store): Promise<Store> => {
    const { data, error } = await supabase.from('stores').update(store).eq('id', store.id).select().single();
    if (error) throw new Error(error.message);
    return data;
};

export const deleteStore = async (storeId: string): Promise<void> => {
    // This assumes RLS policies with CASCADE are set up in Supabase to delete related data.
    const { error } = await supabase.from('stores').delete().eq('id', storeId);
    if (error) throw new Error(error.message);
};

export const updateUser = async (user: User): Promise<User> => {
    const { data, error } = await supabase.from('users').update(user).eq('id', user.id).select().single();
    if (error) throw new Error(error.message);
    return data;
};

export const addUser = async (user: Omit<User, 'id'>): Promise<User> => {
    const { data, error } = await supabase.from('users').insert(user).select().single();
    if (error) throw new Error(error.message);
    return data;
};

// DATA FETCHING
export const getStoreData = async (storeId: string): Promise<StoreTypeMap> => {
    const tableNames: (keyof StoreTypeMap)[] = ['products', 'productVariants', 'sales', 'expenses', 'users', 'returns', 'customers', 'suppliers', 'categories', 'purchases', 'stockBatches'];
    const promises = tableNames.map(tableName => supabase.from(tableName).select('*').eq('storeId', storeId));
    
    const results = await Promise.all(promises);
    
    const storeData = {} as StoreTypeMap;
    results.forEach((result, index) => {
        const tableName = tableNames[index];
        if (result.error) {
            console.error(`Error fetching ${tableName}:`, result.error);
            (storeData as any)[tableName] = []; // Return empty array on error
        } else {
            (storeData as any)[tableName] = result.data || [];
        }
    });

    // We also need the store object itself, which isn't part of StoreTypeMap
    const store = await getStoreById(storeId);
    if (store) {
        storeData.stores = [store];
    } else {
        storeData.stores = [];
    }
    
    return storeData;
};

// DATA MUTATIONS
const genericAdd = async <T extends { id?: string }>(table: keyof StoreTypeMap, item: Omit<T, 'id'>): Promise<T> => {
    const { data, error } = await supabase.from(table).insert(item).select().single();
    if (error) throw new Error(error.message);
    return data as T;
}

const genericUpdate = async <T extends { id: string }>(table: keyof StoreTypeMap, item: T): Promise<T> => {
    const { data, error } = await supabase.from(table).update(item).eq('id', item.id).select().single();
    if (error) throw new Error(error.message);
    return data as T;
}

const genericDelete = async (table: keyof StoreTypeMap, id: string): Promise<void> => {
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) throw new Error(error.message);
}

// Specific CRUD operations
export const addCategory = (item: Omit<Category, 'id'>) => genericAdd<Category>('categories', item);
export const updateCategory = (item: Category) => genericUpdate<Category>('categories', item);
export const deleteCategory = (id: string) => genericDelete('categories', id);

export const addCustomer = (item: Omit<Customer, 'id'>) => genericAdd<Customer>('customers', item);
export const deleteCustomer = (id: string) => genericDelete('customers', id);

export const addSupplier = (item: Omit<Supplier, 'id'>) => genericAdd<Supplier>('suppliers', item);
export const deleteSupplier = (id: string) => genericDelete('suppliers', id);

export const addExpense = (item: Omit<Expense, 'id'>) => genericAdd<Expense>('expenses', item);
export const updateExpense = (item: Expense) => genericUpdate<Expense>('expenses', item);
export const deleteExpense = (id: string) => genericDelete('expenses', id);

export const addPurchase = (item: Omit<Purchase, 'id'>) => genericAdd<Purchase>('purchases', item);
export const updatePurchase = (item: Purchase) => genericUpdate<Purchase>('purchases', item);

export const addReturn = (item: Omit<Return, 'id'>) => genericAdd<Return>('returns', item);
export const deleteReturn = (id: string) => genericDelete('returns', id);

export const addSale = (item: Omit<Sale, 'id'>) => genericAdd<Sale>('sales', item);

export const addProductWithVariants = async (productData: Omit<Product, 'id'>, variantsData: (Omit<ProductVariant, 'id'|'productId'|'storeId'> & { stockQuantity?: number })[]) => {
    const { data: product, error: productError } = await supabase.from('products').insert(productData).select().single();
    if (productError) throw productError;

    const variantsToInsert = variantsData.map(v => ({
        ...v,
        productId: product.id,
        storeId: product.storeId,
    }));

    const { data: variants, error: variantsError } = await supabase.from('productVariants').insert(variantsToInsert.map(({stockQuantity, ...rest}) => rest)).select();
    if (variantsError) {
        // Rollback product creation
        await supabase.from('products').delete().eq('id', product.id);
        throw variantsError;
    }
    
    // Add initial stock if provided
    const stockBatchesToInsert = variantsData.map((v, i) => ({
        storeId: product.storeId,
        variantId: variants[i].id,
        quantity: v.stockQuantity || 0,
        purchasePrice: v.purchasePrice,
        createdAt: new Date().toISOString()
    })).filter(sb => sb.quantity > 0);
    
    if(stockBatchesToInsert.length > 0) {
        const { error: stockError } = await supabase.from('stockBatches').insert(stockBatchesToInsert);
        if (stockError) console.error("Error adding initial stock:", stockError); // Non-critical, don't rollback
    }

    return { product, variants };
}

export const updateProductWithVariants = async (productData: Product, variantsData: (ProductVariant & { stockQuantity?: number })[]) => {
    const { error: productError } = await supabase.from('products').update(productData).eq('id', productData.id);
    if (productError) throw productError;

    // Separate new variants from existing ones
    const existingVariants = variantsData.filter(v => v.id);
    const newVariants = variantsData.filter(v => !v.id).map(v => ({
        ...v,
        productId: productData.id,
        storeId: productData.storeId,
    }));

    // Update existing variants
    for(const variant of existingVariants) {
        const { stockQuantity, ...rest } = variant;
        const { error } = await supabase.from('productVariants').update(rest).eq('id', variant.id);
        if(error) console.error(`Failed to update variant ${variant.id}`, error);
    }
    
    // Add new variants
    if (newVariants.length > 0) {
        const { error } = await supabase.from('productVariants').insert(newVariants.map(({stockQuantity, ...rest}) => rest));
        if (error) console.error('Failed to add new variants', error);
    }
}

export const deleteProductAndVariants = async (productId: string) => {
    // Supabase RLS with CASCADE is the preferred way, but this is a fallback.
    const { error: variantError } = await supabase.from('productVariants').delete().eq('productId', productId);
    if(variantError) throw variantError;
    const { error: productError } = await supabase.from('products').delete().eq('id', productId);
    if(productError) throw productError;
}

export const addStockBatch = (item: Omit<StockBatch, 'id'>) => genericAdd<StockBatch>('stockBatches', item);
