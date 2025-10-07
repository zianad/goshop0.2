import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';
import type { Product, ProductVariant, CartItem, Sale, Expense, User, Return, Store, Customer, Supplier, Category, Purchase, StockBatch, StoreTypeMap } from './types';
import { IDBPDatabase, openDB } from 'idb';

const DB_NAME = 'pos-app-db';

async function getDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('keyval')) {
        db.createObjectStore('keyval');
      }
    },
  });
}

export async function saveCart(storeId: string, userId: string, cart: CartItem[]): Promise<void> {
    const db = await getDB();
    await db.put('keyval', cart, `cart-${storeId}-${userId}`);
}

export async function loadCart(storeId: string, userId: string): Promise<CartItem[]> {
    const db = await getDB();
    return (await db.get('keyval', `cart-${storeId}-${userId}`)) || [];
}
export async function clearCartFromDB(storeId: string, userId: string): Promise<void> {
    const db = await getDB();
    await db.delete('keyval', `cart-${storeId}-${userId}`);
}


export async function getStoreByLicenseKey(licenseKey: string): Promise<Store | null> {
    const { data, error } = await supabase.from('stores').select('*').eq('licenseKey', licenseKey).single();
    if (error) {
        console.error('Error fetching store by license key:', error);
        return null;
    }
    return data;
}

export async function getStoreById(storeId: string): Promise<Store | null> {
    const { data, error } = await supabase.from('stores').select('*').eq('id', storeId).single();
    if (error) throw new Error('storeNotFound');
    return data;
}

export async function verifyAndActivateStoreWithCode(storeId: string, activationCode: string): Promise<boolean> {
    const { data: store, error } = await supabase.from('stores').select('id, trialStartDate, licenseProof').eq('id', storeId).single();
    if (error || !store) return false;

    // The logic to verify the activation code would be here.
    // For this example, we assume any code starting with 'PERM-' is valid for simplicity.
    if (activationCode.startsWith('PERM-')) {
        await supabase.from('stores').update({ trialStartDate: null, isActive: true }).eq('id', storeId);
        return true;
    }
    return false;
}

export async function login(storeId: string, secret: string): Promise<{ user: User, store: Store }> {
    const { data: store, error: storeError } = await supabase.from('stores').select('*').eq('id', storeId).single();
    if (storeError || !store) {
        throw new Error('storeNotFound');
    }
    
    if (!store.isActive) {
        throw new Error('storeDisabledError');
    }

    // Try to log in as admin first (password)
    let { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('storeId', storeId)
        .eq('role', 'admin')
        .eq('password', secret)
        .single();

    // If not admin, try to log in as seller (pin)
    if (error || !user) {
        const { data: sellerUser, error: sellerError } = await supabase
            .from('users')
            .select('*')
            .eq('storeId', storeId)
            .eq('role', 'seller')
            .eq('pin', secret)
            .single();
        
        if (sellerError || !sellerUser) {
            throw new Error('invalidCredentialsError');
        }
        user = sellerUser;
    }

    return { user, store };
}

export async function getAllStores(): Promise<Store[]> {
    const { data, error } = await supabase.from('stores').select('*');
    if (error) {
        console.error('Error fetching stores:', error);
        return [];
    }
    return data;
}

export async function getAllUsers(): Promise<User[]> {
    const { data, error } = await supabase.from('users').select('*');
    if (error) {
        console.error('Error fetching users:', error);
        return [];
    }
    return data;
}

export async function getAdminUserForStore(storeId: string): Promise<User | null> {
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('store_id', storeId)
        .eq('role', 'admin')
        .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 means "exact one row not found", which is not an actual error for .single()
        console.error("Error fetching admin user for store:", error);
        // Re-throw the database error to be caught by the UI layer
        throw error;
    }
    // If there's no data but also no error, it means no user was found.
    // .single() returns data as null in this case, which is what we want.
    return data;
}

export async function createStoreAndAdmin(name: string, logo: string | undefined, adminPassword: string, adminEmail: string, trialDurationDays: number, address?: string, ice?: string, enableAiReceiptScan?: boolean): Promise<{ licenseKey: string }> {
    // Calling a database function (RPC) to perform the creation.
    // This is more secure and robust as it's an atomic transaction that bypasses client-side RLS issues.
    const { data, error } = await supabase.rpc('create_store_with_admin', {
        store_name: name,
        store_logo: logo,
        admin_password: adminPassword,
        admin_email: adminEmail,
        trial_days: trialDurationDays,
        store_address: address,
        store_ice: ice,
        enable_ai: enableAiReceiptScan
    });

    if (error) {
        console.error('Error creating store via RPC:', error);
        throw error;
    }
    
    // The RPC now handles both store and admin creation atomically and returns the license key string.
    // We wrap it in an object to match the expected return structure for the calling component.
    return { licenseKey: data };
}

export async function deleteStore(storeId: string): Promise<void> {
    // Calling a database function (RPC) to perform the deletion.
    // This is more secure and robust as it bypasses RLS and handles cascading deletes correctly.
    const { error } = await supabase.rpc('delete_store_and_data', {
        store_id_to_delete: storeId
    });

    if (error) {
        console.error(`Error deleting store ${storeId} via RPC:`, error);
        throw error;
    }
}


export async function updateUser(user: User): Promise<void> {
    const { error } = await supabase.from('users').update(user).eq('id', user.id);
    if (error) throw error;
}

export async function updateStore(store: Store): Promise<void> {
    const { error } = await supabase.from('stores').update(store).eq('id', store.id);
    if (error) throw error;
}

export async function addUser(user: Omit<User, 'id'>): Promise<User | undefined> {
    const { data, error } = await supabase.from('users').insert(user).select().single();
    if(error) throw error;
    return data;
}


// --- Main App Data Fetch ---
export async function getStoreData(storeId: string): Promise<Partial<StoreTypeMap>> {
    const tables: (keyof StoreTypeMap)[] = ['products', 'productVariants', 'sales', 'expenses', 'customers', 'suppliers', 'returns', 'categories', 'purchases', 'stockBatches'];
    const promises = tables.map(table =>
        supabase.from(table).select('*').eq('storeId', storeId)
    );

    const results = await Promise.all(promises);

    const data: Partial<StoreTypeMap> = {};
    results.forEach((result, index) => {
        if (result.error) {
            console.error(`Error fetching ${tables[index]}:`, result.error);
        } else {
            (data as any)[tables[index]] = result.data;
        }
    });

    return data;
}

// --- Product & Stock Management ---
export const addProduct = async (productData: Omit<Product, 'id'>, variantsData: (Omit<ProductVariant, 'id'|'productId'|'storeId'> & { stockQuantity?: number })[]) => {
    // 1. Insert the product
    const { data: product, error: productError } = await supabase
        .from('products')
        .insert(productData)
        .select()
        .single();
    if (productError) throw productError;

    if (variantsData.length === 0) {
        return { product, variants: [] };
    }
    
    // 2. Prepare variants and stock batches
    const variantsToInsert: Omit<ProductVariant, 'id'>[] = [];
    const stockBatchesToInsert: Omit<StockBatch, 'id'>[] = [];
    
    const createdVariants: ProductVariant[] = [];

    for(const v of variantsData) {
        const variantId = crypto.randomUUID();
        const { stockQuantity, ...variantDetails } = v;

        const newVariant: Omit<ProductVariant, 'id'> = {
            ...variantDetails,
            storeId: product.storeId,
            productId: product.id,
        };
        // We're inserting one by one to get the ID back for the stock batch
        const { data: createdVariant, error: variantError } = await supabase.from('productVariants').insert(newVariant).select().single();
        if(variantError) throw variantError;
        
        createdVariants.push(createdVariant);

        if (stockQuantity && stockQuantity > 0) {
            stockBatchesToInsert.push({
                storeId: product.storeId,
                variantId: createdVariant.id,
                quantity: stockQuantity,
                purchasePrice: variantDetails.purchasePrice,
                createdAt: new Date().toISOString()
            });
        }
    }
    
    // 3. Insert stock batches if any
    if (stockBatchesToInsert.length > 0) {
        const { error: stockError } = await supabase.from('stockBatches').insert(stockBatchesToInsert);
        if (stockError) throw stockError;
    }

    return { product, variants: createdVariants };
};

export const updateProduct = async (productData: Product, variantsData: (Partial<ProductVariant> & { stockQuantity?: number })[]) => {
    // 1. Update the product itself
    const { error: productError } = await supabase.from('products').update(productData).eq('id', productData.id);
    if(productError) throw productError;

    // 2. Figure out which variants are new, updated, or deleted
    const existingVariants = await supabase.from('productVariants').select('id').eq('productId', productData.id);
    if(existingVariants.error) throw existingVariants.error;
    
    const existingVariantIds = new Set(existingVariants.data.map(v => v.id));
    const incomingVariantIds = new Set(variantsData.map(v => v.id).filter(Boolean));
    
    const variantsToDelete = Array.from(existingVariantIds).filter(id => !incomingVariantIds.has(id));
    const variantsToUpdate = variantsData.filter(v => v.id && existingVariantIds.has(v.id));
    const variantsToAdd = variantsData.filter(v => !v.id);

    // 3. Perform DB operations
    if (variantsToDelete.length > 0) {
        await supabase.from('productVariants').delete().in('id', variantsToDelete);
        await supabase.from('stockBatches').delete().in('variantId', variantsToDelete);
    }
    if (variantsToUpdate.length > 0) {
        for (const variant of variantsToUpdate) {
            const { stockQuantity, ...variantDetails } = variant;
            await supabase.from('productVariants').update(variantDetails).eq('id', variantDetails.id!);
        }
    }
    if (variantsToAdd.length > 0) {
        for (const variant of variantsToAdd) {
            const { stockQuantity, ...variantDetails } = variant;
            const newVariantData: Omit<ProductVariant, 'id'> = {
                ...(variantDetails as Omit<ProductVariant, 'id'|'storeId'|'productId'>),
                storeId: productData.storeId,
                productId: productData.id
            };
            const { data: newVariant, error } = await supabase.from('productVariants').insert(newVariantData).select().single();
            if (error) throw error;
            
            if (stockQuantity && stockQuantity > 0) {
                await supabase.from('stockBatches').insert({
                    storeId: productData.storeId,
                    variantId: newVariant.id,
                    quantity: stockQuantity,
                    purchasePrice: newVariant.purchasePrice,
                    createdAt: new Date().toISOString()
                });
            }
        }
    }
};

export const deleteProduct = async (id: string) => {
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) throw error;
};

export const addStockAndUpdateVariant = async (storeId: string, variantId: string, quantity: number, purchasePrice: number, sellingPrice: number, supplierId: string | undefined) => {
    const { error: stockError } = await supabase.from('stockBatches').insert({
        storeId,
        variantId,
        quantity,
        purchasePrice,
        createdAt: new Date().toISOString()
    });
    if (stockError) throw stockError;
    
    // Also update the variant's purchase and selling price
    const { error: variantError } = await supabase.from('productVariants').update({
        purchasePrice: purchasePrice,
        price: sellingPrice
    }).eq('id', variantId);
    if(variantError) throw variantError;

     // Record the purchase
    const { data: variant, error: variantFetchError } = await supabase.from('productVariants').select('*, products(name)').eq('id', variantId).single();
    if (variantFetchError) { console.error("Could not fetch variant for purchase record:", variantFetchError); return; }

    const purchaseItem: Purchase['items'][0] = {
        variantId: variant.id,
        productId: variant.productId,
        productName: (variant.products as any)?.name || 'Unknown',
        variantName: variant.name,
        quantity: quantity,
        purchasePrice: purchasePrice
    };

    const totalAmount = quantity * purchasePrice;
    await addPurchase({
        storeId,
        supplierId,
        date: new Date().toISOString(),
        items: [purchaseItem],
        totalAmount: totalAmount,
        amountPaid: totalAmount, // Assume fully paid
        remainingAmount: 0,
        paymentMethod: 'cash',
        reference: 'purchase_ref_stock_adjustment'
    });
};


// --- Sales & Returns ---

export const completeSale = async (storeId: string, cart: CartItem[], downPayment: number, customerId: string | undefined, finalTotal: number, userId: string): Promise<Sale> => {
    const total = finalTotal;
    const profit = cart.reduce((acc, item) => {
        const itemProfit = (item.price - (item.purchasePrice || 0)) * item.quantity;
        return acc + (itemProfit > 0 ? itemProfit : 0);
    }, 0);

    const sale: Omit<Sale, 'id'> = {
        storeId,
        userId,
        date: new Date().toISOString(),
        items: cart,
        total: total,
        downPayment,
        remainingAmount: Math.max(0, total - downPayment),
        profit,
        customerId
    };
    
    // 1. Record the sale
    const { data: saleData, error: saleError } = await supabase.from('sales').insert(sale).select().single();
    if(saleError) throw saleError;
    
    // 2. Update stock
    const stockUpdates: Omit<StockBatch, 'id'>[] = [];
    cart.forEach(item => {
        if(item.type === 'good') {
            stockUpdates.push({
                storeId,
                variantId: item.id,
                quantity: -item.quantity,
                purchasePrice: item.purchasePrice || 0,
                createdAt: new Date().toISOString()
            });
        }
    });

    if (stockUpdates.length > 0) {
        const { error: stockError } = await supabase.from('stockBatches').insert(stockUpdates);
        if(stockError) throw stockError;
    }

    return saleData;
};

export const processReturn = async (storeId: string, itemsToReturn: CartItem[], userId: string): Promise<Return> => {
    const refundAmount = itemsToReturn.reduce((acc, item) => acc + item.price * item.quantity, 0);
    const profitLost = itemsToReturn.reduce((acc, item) => {
        const itemProfit = (item.price - (item.purchasePrice || 0)) * item.quantity;
        return acc + (itemProfit > 0 ? itemProfit : 0);
    }, 0);
    
    const returnRecord: Omit<Return, 'id'> = {
        storeId,
        userId,
        date: new Date().toISOString(),
        items: itemsToReturn,
        refundAmount,
        profitLost,
    };
    
    // 1. Record the return
    const { data: returnData, error: returnError } = await supabase.from('returns').insert(returnRecord).select().single();
    if (returnError) throw returnError;
    
    // 2. Update stock (add items back)
    const stockUpdates: Omit<StockBatch, 'id'>[] = [];
    itemsToReturn.forEach(item => {
        if(item.type === 'good') {
            stockUpdates.push({
                storeId,
                variantId: item.id,
                quantity: item.quantity,
                purchasePrice: item.purchasePrice || 0,
                createdAt: new Date().toISOString()
            });
        }
    });

    if (stockUpdates.length > 0) {
        const { error: stockError } = await supabase.from('stockBatches').insert(stockUpdates);
        if(stockError) throw stockError;
    }

    return returnData;
};

export const deleteReturn = async (returnId: string) => {
    await supabase.from('returns').delete().eq('id', returnId);
};

export const deleteAllReturns = async (storeId: string) => {
    await supabase.from('returns').delete().eq('storeId', storeId);
};

export const payCustomerDebt = async (customerId: string, amount: number) => {
    // This is a simplified implementation. A real system would create a payment transaction record.
    // Here, we'll find the oldest debt and reduce it.
    
    let amountToApply = amount;
    const { data: salesWithDebt, error } = await supabase
        .from('sales')
        .select('*')
        .eq('customerId', customerId)
        .gt('remainingAmount', 0)
        .order('date', { ascending: true });

    if(error) throw error;
    
    for (const sale of salesWithDebt) {
        if (amountToApply <= 0) break;
        
        const payment = Math.min(amountToApply, sale.remainingAmount);
        const newRemaining = sale.remainingAmount - payment;
        
        await supabase.from('sales').update({ remainingAmount: newRemaining }).eq('id', sale.id);
        
        amountToApply -= payment;
    }
};


// --- Generic CRUD ---
export const addExpense = async (expense: Omit<Expense, 'id'>): Promise<Expense | undefined> => {
    const { data, error } = await supabase.from('expenses').insert(expense).select().single();
    if(error) throw error;
    return data;
}
export const updateExpense = async (expense: Expense) => {
    await supabase.from('expenses').update(expense).eq('id', expense.id);
}
export const deleteExpense = async (id: string) => {
    await supabase.from('expenses').delete().eq('id', id);
}

export const addCustomer = async (customer: Omit<Customer, 'id'>): Promise<Customer | undefined> => {
     const { data, error } = await supabase.from('customers').insert(customer).select().single();
     if(error) throw error;
     return data;
}
export const deleteCustomer = async (id: string) => {
    const { data: sales, error: salesError } = await supabase.from('sales').select('remainingAmount').eq('customerId', id);
    if(salesError) throw salesError;
    const totalDebt = sales.reduce((sum, s) => sum + s.remainingAmount, 0);
    if(totalDebt > 0) {
        throw new Error('customerDeleteErrorHasDebt');
    }
    await supabase.from('customers').delete().eq('id', id);
}

export const addSupplier = async (supplier: Omit<Supplier, 'id'>): Promise<Supplier | undefined> => {
    const { data, error } = await supabase.from('suppliers').insert(supplier).select().single();
    if(error) throw error;
    return data;
}
export const deleteSupplier = async (id: string) => {
    const { data: purchases, error: purchaseError } = await supabase.from('purchases').select('remainingAmount').eq('supplierId', id);
    if (purchaseError) throw purchaseError;
    const totalDebt = purchases.reduce((sum, p) => sum + p.remainingAmount, 0);
    if (totalDebt > 0) {
        throw new Error('supplierDeleteErrorHasDebt');
    }
    await supabase.from('suppliers').delete().eq('id', id);
}

export const addCategory = async (category: Omit<Category, 'id'>): Promise<Category | undefined> => {
    const { data, error } = await supabase.from('categories').insert(category).select().single();
    if(error) throw error;
    return data;
}
export const updateCategory = async (category: Category) => {
    await supabase.from('categories').update(category).eq('id', category.id);
}
export const deleteCategory = async (id: string) => {
    const { data, error } = await supabase.from('products').select('id').eq('categoryId', id).limit(1);
    if (error) throw error;
    if (data.length > 0) {
        throw new Error('categoryDeleteError');
    }
    await supabase.from('categories').delete().eq('id', id);
}

export const addPurchase = async (purchase: Omit<Purchase, 'id'>) => {
    const { error: purchaseError } = await supabase.from('purchases').insert(purchase);
    if (purchaseError) throw purchaseError;

    // Add stock for each item in the purchase
    const stockUpdates = purchase.items.map(item => ({
        storeId: purchase.storeId,
        variantId: item.variantId,
        quantity: item.quantity,
        purchasePrice: item.purchasePrice,
        createdAt: purchase.date,
    }));
    const { error: stockError } = await supabase.from('stockBatches').insert(stockUpdates);
    if (stockError) throw stockError;
};

export const updatePurchase = async (purchase: Purchase) => {
    await supabase.from('purchases').update(purchase).eq('id', purchase.id);
};

export const deleteUser = async (id: string) => {
    await supabase.from('users').delete().eq('id', id);
};

// --- Backup & Restore ---

export const getDatabaseContents = async (): Promise<string> => {
    const { data: store, error: storeError } = await supabase.from('stores').select('*').eq('id', (await getStoreIdFromLicense())!).single();
    if (storeError) throw storeError;
    
    const allData = await getStoreData(store.id);
    const allUsers = await getAllUsers();
    
    const backup = {
      ...allData,
      users: allUsers.filter(u => u.storeId === store.id),
      stores: [store],
      storeId: store.id
    };
    
    return JSON.stringify(backup, null, 2);
};

const getStoreIdFromLicense = async (): Promise<string | null> => {
    const license = localStorage.getItem('pos-license');
    return license ? JSON.parse(license).storeId : null;
};

export const restoreDatabase = async (jsonContent: string): Promise<Store | null> => {
    const backup = JSON.parse(jsonContent);

    // 1. Basic Validation
    const requiredTables: (keyof StoreTypeMap)[] = ['stores', 'users', 'products', 'productVariants', 'sales', 'expenses', 'returns', 'customers', 'suppliers', 'categories', 'purchases', 'stockBatches'];
    const storeInfo = backup.stores?.find((s: Store) => s.id === backup.storeId);
    if (!backup.storeId || !storeInfo || !requiredTables.every(table => Array.isArray(backup[table]))) {
        throw new Error('restoreError');
    }
    const currentStoreId = backup.storeId;
    
    // 2. Data Sanitization & Remapping
    const backupUserIds = new Set(backup.users.map((u: User) => u.id));
    const adminUser = backup.users.find((u: User) => u.role === 'admin' && u.storeId === currentStoreId);

    if (!adminUser) {
        throw new Error('restoreError'); // No admin user found in backup for this store
    }
    const adminId = adminUser.id;

    // If a sale/return was made by a user no longer in the backup, re-assign it to the admin.
    const remappedSales = backup.sales.map((sale: Sale) => ({
        ...sale,
        userId: backupUserIds.has(sale.userId) ? sale.userId : adminId,
    }));
    const remappedReturns = backup.returns.map((ret: Return) => ({
        ...ret,
        userId: backupUserIds.has(ret.userId) ? ret.userId : adminId,
    }));
    
    // 3. Clear existing data for the store (in correct order to respect FK constraints)
    const tablesToDeleteFrom: (keyof StoreTypeMap)[] = [
        'returns', 'sales', 'stockBatches', 'purchases', 
        'productVariants', 'products', 'customers', 
        'suppliers', 'categories', 'users', 'expenses'
    ];
    for (const table of tablesToDeleteFrom) {
        const { error } = await supabase.from(table).delete().eq('storeId', currentStoreId);
        if (error) {
            console.error(`Error clearing table ${table}:`, error);
            throw new Error('restoreError');
        }
    }

    // 4. Insert new data (in correct order)
    const insertionOrder: (keyof StoreTypeMap)[] = [
        'users', 'suppliers', 'categories', 'customers', 'products', 'productVariants', 
        'stockBatches', 'purchases', 'expenses'
    ];
    
    await supabase.from('stores').upsert(storeInfo);

    for (const table of insertionOrder) {
        const dataToInsert = backup[table];
        if (dataToInsert && dataToInsert.length > 0) {
            const { error } = await supabase.from(table).insert(dataToInsert);
            if (error) {
                console.error(`Error restoring table ${table}:`, error);
                throw new Error('restoreError');
            }
        }
    }
    
    // Insert remapped sales and returns separately
    if (remappedSales?.length) {
        const { error } = await supabase.from('sales').insert(remappedSales);
        if(error) { console.error('Error restoring sales:', error); throw new Error('restoreError'); }
    }
    if (remappedReturns?.length) {
        const { error } = await supabase.from('returns').insert(remappedReturns);
        if(error) { console.error('Error restoring returns:', error); throw new Error('restoreError'); }
    }

    return storeInfo || null;
};