import { supabase } from './supabaseClient';
// Fix: Import the 'PurchaseItem' type to resolve the 'Cannot find name' error.
import type { Store, User, Product, ProductVariant, Sale, Expense, Customer, Supplier, Category, Purchase, PurchaseItem, Return, StockBatch, CartItem, StoreTypeMap, VariantFormData } from './types';

// Helper to handle potential Supabase errors
const handleSupabaseError = ({ error, data }: { error: any, data: any }, context: string) => {
    if (error) {
        // Don't throw for "single" queries that return 0 rows, as this is a valid case (e.g., no user found)
        if (error.code === 'PGRST116' && error.details.includes('0 rows')) {
          return null;
        }
        console.error(`Error in ${context}:`, error);
        throw error;
    }
    return data;
};

// =================================================================================
// STORE & AUTH API
// =================================================================================

export const getStoreById = async (storeId: string): Promise<Store | null> => {
    const { data, error } = await supabase.from('stores').select('*').eq('id', storeId).single();
    return handleSupabaseError({ data, error }, 'getStoreById');
};

export const getStoreByLicenseKey = async (licenseKey: string): Promise<Store | null> => {
    const { data, error } = await supabase.from('stores').select('*').eq('licenseKey', licenseKey).single();
    return handleSupabaseError({ data, error }, 'getStoreByLicenseKey');
};

export const updateStore = async (store: Partial<Store> & { id: string }): Promise<Store> => {
    const { id, ...updateData } = store;
    const { data, error } = await supabase.from('stores').update(updateData).eq('id', id).select().single();
    return handleSupabaseError({ data, error }, 'updateStore');
};

export const login = async (store: Store, secret: string): Promise<{ user: User, store: Store }> => {
    // Because user DB may not have storeId, we try to find any user with matching credentials.
    // This is less secure but necessary for compatibility with the user's schema.
    const { data, error } = await supabase.from('users')
        .select('*')
        .or(`password.eq.${secret},pin.eq.${secret}`)
        .limit(1) // Take the first match
        .single();
    
    if (error || !data) {
        console.error('Login error or no user found:', error);
        throw new Error('invalidCredentialsError');
    }
    if (!store.isActive) {
        throw new Error('storeDisabledError');
    }
    
    // Manually inject storeId for this session so the rest of the app works
    const userWithStoreId: User = { ...data, storeId: store.id };
    
    return { user: userWithStoreId, store };
};


export const verifyAndActivateStoreWithCode = async (storeId: string, code: string): Promise<boolean> => {
    const { data: store, error: storeError } = await supabase.from('stores').select('id').eq('id', storeId).single();
    if(storeError || !store) throw new Error('storeNotFound');

    // In a real app, the secret would be an env var on a serverless function
    const MASTER_SECRET_KEY = 'GoShop-Activation-Key-Abzn-Secret-2024';
    let decoded: string;
    try {
        decoded = atob(code.replace('PERM-', ''));
    } catch (e) {
        return false;
    }
    const [decodedStoreId, decodedSecret] = decoded.split('::');

    if (decodedStoreId === storeId && decodedSecret === MASTER_SECRET_KEY) {
        await updateStore({ id: storeId, isActive: true, trialStartDate: null });
        return true;
    }

    return false;
}

// =================================================================================
// DATA FETCHING API
// =================================================================================

const TABLES_IN_ORDER = [
  'stores', 'users', 'suppliers', 'customers', 'categories', 
  'products', 'productVariants', 
  'purchases', 'stockBatches',
  'sales', 'expenses', 'returns'
];

export const getStoreData = async (storeId: string): Promise<Partial<StoreTypeMap>> => {
  const tableNames: (keyof StoreTypeMap)[] = [
    'products', 'productVariants', 'sales', 'expenses', 'customers', 'suppliers', 'returns', 'categories', 'purchases', 'stockBatches'
  ];
  
  const promises = tableNames.map(tableName => {
      const snakeCaseTable = tableName.replace(/([A-Z])/g, "_$1").toLowerCase();
      // Gracefully handle if table doesn't exist
      return supabase.from(snakeCaseTable).select('*').eq('storeId', storeId)
        .then(({ data, error }) => {
            if (error && error.code === '42P01') { // '42P01' is undefined_table
                console.warn(`Table '${snakeCaseTable}' not found. Skipping.`);
                return { tableName, data: [] };
            }
            if (error) throw error;
            return { tableName, data };
        });
  });
  
  const results = await Promise.all(promises);
  
  const data: Partial<StoreTypeMap> = {};
  for (const result of results) {
    data[result.tableName as keyof StoreTypeMap] = result.data as any;
  }
  return data;
};

// =================================================================================
// CART API
// =================================================================================

export const saveCart = async (storeId: string, userId: string, cart: CartItem[]): Promise<void> => {
    const { error } = await supabase.from('user_carts').upsert({
        id: `${storeId}-${userId}`,
        storeId,
        userId,
        cart_data: cart
    }, { onConflict: 'id' });
    if(error) console.error("Error saving cart:", error);
};

export const loadCart = async (storeId: string, userId: string): Promise<CartItem[]> => {
    const { data, error } = await supabase.from('user_carts').select('cart_data').eq('id', `${storeId}-${userId}`).single();
    if (error || !data) return [];
    return data.cart_data || [];
};

export const clearCartFromDB = async (storeId: string, userId: string): Promise<void> => {
    await saveCart(storeId, userId, []);
}

// =================================================================================
// PRODUCTS & STOCK API
// =================================================================================

export const addProduct = async (
  productData: Omit<Product, 'id'>,
  variantsData: (Omit<VariantFormData, 'id' | 'stockQuantity'> & { stockQuantity?: number })[]
): Promise<{ product: Product; variants: ProductVariant[] }> => {
    const { data: newProduct, error: productError } = await supabase.from('products').insert(productData).select().single();
    if (productError) throw productError;

    const variantsToCreate = variantsData.map(v => ({
        ...v,
        productId: newProduct.id,
        storeId: productData.storeId,
    }));
    const { data: createdVariants, error: variantsError } = await supabase.from('product_variants').insert(variantsToCreate).select();
    if (variantsError) throw variantsError;
    
    const stockBatchesToCreate = variantsData
      .map((v, i) => ({
        storeId: productData.storeId,
        variantId: createdVariants[i].id,
        quantity: v.stockQuantity || 0,
        purchasePrice: v.purchasePrice,
        createdAt: new Date().toISOString(),
      }))
      .filter(sb => sb.quantity > 0);

    if (stockBatchesToCreate.length > 0) {
        const { error: stockError } = await supabase.from('stock_batches').insert(stockBatchesToCreate);
        if (stockError) {
             // Gracefully handle if stockBatches table doesn't exist
            if (stockError.code === '42P01') {
                console.warn("stock_batches table not found. Skipping initial stock creation.");
            } else {
                throw stockError;
            }
        }
    }

    return { product: newProduct, variants: createdVariants };
};

export const updateProduct = async (productData: Product, variantsData: VariantFormData[]): Promise<void> => {
    const { error: productError } = await supabase.from('products').update(productData).eq('id', productData.id);
    if(productError) throw productError;

    const upsertPromises = variantsData.map(v => {
        const { stockQuantity, ...variant } = v;
        const variantToUpsert = {
            ...variant,
            storeId: productData.storeId,
            productId: productData.id
        };
        return supabase.from('product_variants').upsert(variantToUpsert, { onConflict: 'id' });
    });
    
    await Promise.all(upsertPromises);
};

export const deleteProduct = async (productId: string): Promise<void> => {
    const { error } = await supabase.from('products').delete().eq('id', productId);
    if(error) throw error;
};

export const addStockAndUpdateVariant = async (storeId: string, variantId: string, quantity: number, purchasePrice: number, sellingPrice: number, supplierId: string | undefined): Promise<void> => {
    const { error: stockError } = await supabase.from('stock_batches').insert({
        storeId,
        variantId,
        quantity,
        purchasePrice,
        createdAt: new Date().toISOString()
    });
    // Gracefully handle if stockBatches table doesn't exist
    if (stockError && stockError.code !== '42P01') {
        throw stockError;
    }

    const { error: variantError } = await supabase.from('product_variants').update({ purchasePrice, price: sellingPrice }).eq('id', variantId);
    if(variantError) throw variantError;

    // Create a purchase record
    const { data: variant } = await supabase.from('product_variants').select('productId, name').eq('id', variantId).single();
    if(variant) {
        const { data: product } = await supabase.from('products').select('name').eq('id', variant.productId).single();
        if(product) {
            const purchaseItem: PurchaseItem = {
                variantId,
                productId: variant.productId,
                productName: product.name,
                variantName: variant.name,
                quantity,
                purchasePrice
            };
            await addPurchase({
                storeId,
                supplierId,
                date: new Date().toISOString(),
                items: [purchaseItem],
                totalAmount: quantity * purchasePrice,
                reference: 'purchase_ref_stock_adjustment',
                amountPaid: quantity * purchasePrice,
                remainingAmount: 0,
                paymentMethod: 'cash',
            });
        }
    }
};

// =================================================================================
// SALES & RETURNS API
// =================================================================================

export const completeSale = async (storeId: string, cart: CartItem[], downPayment: number, customerId: string | undefined, finalTotal: number, userId: string): Promise<Sale> => {
    const profit = cart.reduce((acc, item) => {
        const itemProfit = (item.price - (item.purchasePrice || item.price)) * item.quantity;
        return acc + itemProfit;
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
    
    const { data: newSale, error } = await supabase.from('sales').insert(sale).select().single();
    if(error) throw error;
    
    const stockUpdates = cart.filter(item => item.type === 'good' && !item.isCustom)
      .map(item => ({ variantId: item.id, quantity: -item.quantity }));

    for (const update of stockUpdates) {
        try {
            const { error: stockError } = await supabase.rpc('update_stock', {
                p_variant_id: update.variantId,
                p_quantity_change: update.quantity,
                p_store_id: storeId
            });
            if (stockError) throw stockError;
        } catch (rpcError: any) {
            // Gracefully handle if the RPC function or stock table doesn't exist
            if (rpcError.code === '42883' || rpcError.code === '42P01') {
                console.warn(`RPC function 'update_stock' or 'stock_batches' table not found. Skipping stock update for sale.`);
            } else {
                throw rpcError;
            }
        }
    }
    
    return newSale;
};

export const processReturn = async (storeId: string, itemsToReturn: CartItem[], userId: string): Promise<Return> => {
    const refundAmount = itemsToReturn.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const profitLost = itemsToReturn.reduce((sum, item) => sum + ((item.price - (item.purchasePrice || item.price)) * item.quantity), 0);

    const returnData: Omit<Return, 'id'> = {
        storeId,
        userId,
        date: new Date().toISOString(),
        items: itemsToReturn,
        refundAmount,
        profitLost,
    };
    
    const { data: newReturn, error } = await supabase.from('returns').insert(returnData).select().single();
    if(error) throw error;
    
    const stockUpdates = itemsToReturn.filter(item => item.type === 'good' && !item.isCustom)
      .map(item => ({ variantId: item.id, quantity: item.quantity, purchasePrice: item.purchasePrice || 0 }));

    const newStockBatches = stockUpdates.map(update => ({
        storeId,
        variantId: update.variantId,
        quantity: update.quantity,
        purchasePrice: update.purchasePrice,
        createdAt: new Date().toISOString(),
    }));

    if(newStockBatches.length > 0) {
        const { error: stockError } = await supabase.from('stock_batches').insert(newStockBatches);
        if (stockError && stockError.code !== '42P01') {
            console.error('Error adding stock back on return:', stockError);
            throw stockError;
        }
    }
    
    return newReturn;
};

export const deleteReturn = async (returnId: string): Promise<void> => {
    const { error } = await supabase.from('returns').delete().eq('id', returnId);
    if(error) throw error;
};

export const deleteAllReturns = async (storeId: string): Promise<void> => {
    const { error } = await supabase.from('returns').delete().eq('storeId', storeId);
    if(error) throw error;
};

export const payCustomerDebt = async (customerId: string, amount: number): Promise<void> => {
    const { data: customer } = await supabase.from('customers').select('storeId').eq('id', customerId).single();
    if(!customer) throw new Error("Customer not found");
    // Create a negative sale to record the payment
    const paymentRecord: Omit<Sale, 'id'> = {
        storeId: customer.storeId,
        userId: 'system', // or logged in user
        date: new Date().toISOString(),
        items: [],
        total: -amount,
        downPayment: -amount,
        remainingAmount: 0,
        profit: 0,
        customerId,
    };
    const { error } = await supabase.from('sales').insert(paymentRecord);
    if(error) throw error;
};


// =================================================================================
// EXPENSES API
// =================================================================================
export const addExpense = async (expense: Omit<Expense, 'id'>): Promise<Expense> => {
    const { data, error } = await supabase.from('expenses').insert(expense).select().single();
    return handleSupabaseError({data, error}, 'addExpense');
};
export const updateExpense = async (expense: Expense): Promise<void> => {
    const { error } = await supabase.from('expenses').update(expense).eq('id', expense.id);
    if(error) throw error;
};
export const deleteExpense = async (id: string): Promise<void> => {
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if(error) throw error;
};


// =================================================================================
// CUSTOMERS API
// =================================================================================
export const addCustomer = async (customer: Omit<Customer, 'id'>): Promise<Customer> => {
    const { data, error } = await supabase.from('customers').insert(customer).select().single();
    return handleSupabaseError({data, error}, 'addCustomer');
};
export const deleteCustomer = async (id: string): Promise<void> => {
    const { data: sales, error: salesError } = await supabase.from('sales').select('remainingAmount').eq('customerId', id);
    if (salesError) throw salesError;
    const totalDebt = sales.reduce((sum, sale) => sum + sale.remainingAmount, 0);

    if (totalDebt > 0) {
        throw new Error('customerDeleteErrorHasDebt');
    }

    const { error } = await supabase.from('customers').delete().eq('id', id);
    if(error) throw error;
};

// =================================================================================
// SUPPLIERS & PURCHASES API
// =================================================================================
export const addSupplier = async (supplier: Omit<Supplier, 'id'>): Promise<Supplier> => {
    const { data, error } = await supabase.from('suppliers').insert(supplier).select().single();
    return handleSupabaseError({data, error}, 'addSupplier');
};
export const deleteSupplier = async (id: string): Promise<void> => {
    const { data: purchases, error: purchaseError } = await supabase.from('purchases').select('remainingAmount').eq('supplierId', id);
    if(purchaseError) throw purchaseError;

    const totalDebt = purchases.reduce((sum, p) => sum + p.remainingAmount, 0);
    if(totalDebt > 0) {
        throw new Error('supplierDeleteErrorHasDebt');
    }
    const { error } = await supabase.from('suppliers').delete().eq('id', id);
    if(error) throw error;
};
export const addPurchase = async (purchase: Omit<Purchase, 'id'>): Promise<void> => {
    const { error } = await supabase.from('purchases').insert(purchase);
    if(error) throw error;

    // Add stock for each item
    const stockBatches = purchase.items.map(item => ({
        storeId: purchase.storeId,
        variantId: item.variantId,
        quantity: item.quantity,
        purchasePrice: item.purchasePrice,
        createdAt: purchase.date,
    }));
     if(stockBatches.length > 0) {
        const { error: stockError } = await supabase.from('stock_batches').insert(stockBatches);
        if (stockError && stockError.code !== '42P01') {
            console.error('Error adding stock from purchase:', stockError);
            throw stockError;
        }
    }
};
export const updatePurchase = async (purchase: Purchase): Promise<void> => {
    const { error } = await supabase.from('purchases').update(purchase).eq('id', purchase.id);
    if(error) throw error;
};

// =================================================================================
// CATEGORIES API
// =================================================================================
export const addCategory = async (category: Omit<Category, 'id'>): Promise<Category> => {
    const { data, error } = await supabase.from('categories').insert(category).select().single();
    return handleSupabaseError({data, error}, 'addCategory');
};
export const updateCategory = async (category: Category): Promise<void> => {
    const { error } = await supabase.from('categories').update(category).eq('id', category.id);
    if(error) throw error;
};
export const deleteCategory = async (id: string): Promise<void> => {
    const { error } = await supabase.from('categories').delete().eq('id', id);
    if(error) throw error;
};

// =================================================================================
// USERS API (for settings)
// =================================================================================
export const addUser = async (user: Omit<User, 'id'>): Promise<User> => {
    // This is a workaround for user's schema, which doesn't have store_id
    const { storeId, ...userToInsert } = user;
    const { data, error } = await supabase.from('users').insert(userToInsert).select().single();
    const result = handleSupabaseError({data, error}, 'addUser');
    // Re-attach storeId for client-side consistency
    return { ...result, storeId };
};
export const updateUser = async (user: User): Promise<void> => {
    // This is a workaround for user's schema, which doesn't have store_id
    const { storeId, ...userToUpdate } = user;
    const { error } = await supabase.from('users').update(userToUpdate).eq('id', user.id);
    if(error) throw error;
};
export const deleteUser = async (id: string): Promise<void> => {
    const { error } = await supabase.from('users').delete().eq('id', id);
    if(error) throw error;
};

// =================================================================================
// SUPER ADMIN API
// =================================================================================
export const getAllStores = async (): Promise<Store[]> => {
    const { data, error } = await supabase.from('stores').select('*');
    return handleSupabaseError({ data, error }, 'getAllStores');
};

export const getAllUsers = async (storeId?: string): Promise<User[]> => {
    // This function now ignores storeId for fetching, but re-attaches it if provided.
    // This is a workaround for the user's database schema not having a `store_id` on the `users` table.
    const { data, error } = await supabase.from('users').select('*');
    const users = handleSupabaseError({ data, error }, 'getAllUsers');
    if (storeId && users) {
        // Manually add storeId for this session so the rest of the app works
        return users.map((u: User) => ({ ...u, storeId }));
    }
    return users || [];
};

export const createStoreAndAdmin = async (storeName: string, logo: string, adminPass: string, adminEmail: string, trialDurationDays: number, address: string, ice: string, enableAiReceiptScan: boolean): Promise<{ store: Store, user: User, licenseKey: string }> => {
    const { data, error } = await supabase.rpc('create_store_and_admin', {
        p_store_name: storeName,
        p_logo: logo,
        p_admin_email: adminEmail,
        p_admin_password: adminPass,
        p_trial_duration: trialDurationDays,
        p_address: address,
        p_ice: ice,
        p_enable_ai_scan: enableAiReceiptScan,
    });
    if (error) throw error;
    return { store: data.store, user: data.user, licenseKey: data.store.licenseKey };
};

export const deleteStore = async (storeId: string): Promise<void> => {
    const { error } = await supabase.rpc('delete_store', { p_store_id: storeId });
    if (error) throw error;
};

export const getAdminUserForStore = async (storeId: string): Promise<User | null> => {
    // WORKAROUND for user's DB:
    // 1. The `users` table might not have a `store_id` column.
    // 2. The user might have multiple users with `role: 'admin'`.
    // The original `.single()` call would fail with "multiple rows returned".
    // This new logic fetches all admins and picks the first one to allow login.
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'admin');

    if (error) {
        console.error("Error fetching admin users:", error);
        throw error;
    }

    if (data && data.length > 0) {
        return data[0] as User; // Return the first admin found
    }

    return null; // No admin user found in the entire database
}

// =================================================================================
// BACKUP & RESTORE API
// =================================================================================

export const restoreDatabase = async (backupData: Partial<StoreTypeMap>, currentStoreId: string) => {
    console.log("Starting restore process...");

    // Determine which tables are in the backup file to process them.
    const tablesToProcess = TABLES_IN_ORDER.filter(t => backupData.hasOwnProperty(t));

    // Iterate backwards to delete dependencies first
    for (let i = tablesToProcess.length - 1; i >= 0; i--) {
        const tableName = tablesToProcess[i];
        const snakeCaseTable = tableName.replace(/([A-Z])/g, "_$1").toLowerCase();
        
        try {
            console.log(`Deleting data from ${snakeCaseTable}...`);
            const { error } = await supabase.from(snakeCaseTable).delete().eq('storeId', currentStoreId);
            if (error) {
                // Gracefully ignore if table doesn't exist
                if (error.code === '42P01') { 
                    console.warn(`Table '${snakeCaseTable}' not found for deletion. Skipping.`);
                } else {
                    throw error;
                }
            } else {
                console.log(`Successfully deleted data from ${snakeCaseTable}.`);
            }
        } catch (err) {
             console.error(`Error during deletion from ${snakeCaseTable}:`, err);
        }
    }
    
    // Iterate forwards to insert data respecting dependencies
    for (const tableName of tablesToProcess) {
        const dataToInsert = (backupData as any)[tableName];
        if (dataToInsert && Array.isArray(dataToInsert) && dataToInsert.length > 0) {
            const snakeCaseTable = tableName.replace(/([A-Z])/g, "_$1").toLowerCase();
            
            // Critical fix: Ensure all incoming data is associated with the CURRENT store
            const processedData = dataToInsert.map(item => {
                // Handle the schema mismatch for the 'users' table
                if (snakeCaseTable === 'users' && 'storeId' in item) {
                    const { storeId, ...rest } = item;
                    return rest;
                }
                 return { ...item, storeId: currentStoreId };
            });

            try {
                console.log(`Inserting ${processedData.length} records into ${snakeCaseTable}...`);
                // Insert in smaller chunks to avoid payload size limits
                const chunkSize = 100;
                for (let i = 0; i < processedData.length; i += chunkSize) {
                    const chunk = processedData.slice(i, i + chunkSize);
                    const { error } = await supabase.from(snakeCaseTable).insert(chunk);
                    if (error) {
                        // Gracefully ignore if table doesn't exist on insert as well
                        if (error.code === '42P01') { 
                            console.warn(`Table '${snakeCaseTable}' not found for insertion. Skipping entire table.`);
                            break; // Skip to next table
                        } else {
                            throw error;
                        }
                    }
                }
                 console.log(`Successfully inserted data into ${snakeCaseTable}.`);
            } catch (err) {
                 console.error(`Error inserting into ${snakeCaseTable}:`, err);
                 throw err;
            }
        }
    }

    console.log("Restore process finished.");
};