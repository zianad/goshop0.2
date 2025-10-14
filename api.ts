
import { supabase } from './supabaseClient';
import type {
  Store,
  User,
  Product,
  ProductVariant,
  Sale,
  Expense,
  Return,
  Customer,
  Supplier,
  Category,
  Purchase,
  StockBatch,
  CartItem,
  StoreTypeMap,
} from './types';

// Helper function to handle Supabase errors
const handleSupabaseError = ({ error, data }: { error: any; data: any }, entityName?: string) => {
  if (error) {
    console.error(`Error with ${entityName || 'request'}:`, error);
    if (error.message.includes("violates row-level security policy")) {
        throw new Error(`Permission denied for ${entityName || 'operation'}. Check RLS policies in Supabase.`);
    }
    if (error.code === '23503') { // foreign key violation
        if (entityName === 'customers') throw new Error('customerDeleteErrorHasDebt');
        if (entityName === 'suppliers') throw new Error('supplierDeleteErrorHasDebt');
        if (entityName === 'categories') throw new Error('categoryDeleteError');
    }
    throw new Error(error.message);
  }
  return data;
};

// =================================================================
// Store & Auth Functions
// =================================================================

export const getStoreById = async (storeId: string): Promise<Store | null> => {
  const { data, error } = await supabase.from('stores').select('*').eq('id', storeId).single();
  if (error && error.code !== 'PGRST116') { // PGRST116: "The result contains 0 rows"
    handleSupabaseError({ error, data }, 'stores');
  }
  return data;
};

export const getStoreByLicenseKey = async (licenseKey: string): Promise<Store | null> => {
  const { data, error } = await supabase.from('stores').select('*').eq('licenseKey', licenseKey).single();
  if (error && error.code !== 'PGRST116') {
      handleSupabaseError({error, data}, 'stores');
  }
  return data;
};

export const getAllStores = async (): Promise<Store[]> => {
    const { data, error } = await supabase.from('stores').select('*');
    return handleSupabaseError({ error, data }, 'stores');
};

export const updateStore = async (store: Partial<Store> & { id: string }): Promise<void> => {
    const { error } = await supabase.from('stores').update(store).eq('id', store.id);
    handleSupabaseError({ error, data: null }, 'stores');
};

export const verifyAndActivateStoreWithCode = async (storeId: string, activationCode: string): Promise<boolean> => {
    const { data, error } = await supabase.rpc('activate_store_with_code', {
        p_store_id: storeId,
        p_activation_code: activationCode
    });
    
    if (error) {
        console.error("RPC Error:", error);
        throw new Error('invalidActivationCode');
    }

    return data;
};


export const createStoreAndAdmin = async (
    name: string, 
    logo: string,
    adminPassword: string,
    adminEmail: string,
    trialDurationDays: number,
    address: string,
    ice: string,
    enableAiReceiptScan: boolean
) => {
    const { data, error } = await supabase.rpc('create_store_and_admin', {
        p_store_name: name,
        p_store_logo: logo,
        p_admin_password: adminPassword,
        p_admin_email: adminEmail,
        p_trial_duration_days: trialDurationDays,
        p_address: address,
        p_ice: ice,
        p_enable_ai_scan: enableAiReceiptScan,
    });
    
    if (error) {
        console.error('Error creating store and admin:', error);
        throw new Error(error.message);
    }
    
    return { licenseKey: data };
};

export const deleteStore = async (storeId: string): Promise<void> => {
    const { error } = await supabase.rpc('delete_store_and_data', { p_store_id: storeId });
    if (error) {
        console.error('Error deleting store:', error);
        throw new Error(error.message);
    }
};

export const login = async (store: Store, secret: string): Promise<{ user: User, store: Store }> => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('storeId', store.id)
      .or(`password.eq.${secret},pin.eq.${secret}`)
      .single();

    if (error || !data) {
        throw new Error('invalidCredentialsError');
    }
    
    if (!store.isActive) {
        throw new Error('storeDisabledError');
    }

    return { user: data, store };
};

// =================================================================
// User Functions
// =================================================================

export const getAllUsers = async (): Promise<User[]> => {
    const { data, error } = await supabase.from('users').select('*');
    return handleSupabaseError({ error, data }, 'users');
};

export const getAdminUserForStore = async (storeId: string): Promise<User | null> => {
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('storeId', storeId)
        .eq('role', 'admin')
        .single();
    if (error && error.code !== 'PGRST116') {
        handleSupabaseError({error, data}, 'users');
    }
    return data;
};

export const addUser = async (user: Omit<User, 'id'>): Promise<User | undefined> => {
    const { data, error } = await supabase.from('users').insert(user).select().single();
    return handleSupabaseError({ error, data }, 'users');
};

export const updateUser = async (user: User): Promise<void> => {
    const { error } = await supabase.from('users').update(user).eq('id', user.id);
    handleSupabaseError({ error, data: null }, 'users');
};

export const deleteUser = async (id: string): Promise<void> => {
    const { error } = await supabase.from('users').delete().eq('id', id);
    handleSupabaseError({ error, data: null }, 'users');
};

// =================================================================
// Cart Functions
// =================================================================

export const loadCart = async (storeId: string, userId: string): Promise<CartItem[]> => {
  const { data, error } = await supabase
    .from('carts')
    .select('cart_data')
    .eq('store_id', storeId)
    .eq('user_id', userId)
    .single();
  
  if (error && error.code !== 'PGRST116') {
      handleSupabaseError({ error, data }, 'carts');
  }

  return data?.cart_data || [];
};

export const saveCart = async (storeId: string, userId: string, cart: CartItem[]): Promise<void> => {
  const { error } = await supabase
    .from('carts')
    .upsert({ store_id: storeId, user_id: userId, cart_data: cart }, { onConflict: 'store_id, user_id' });
  
  handleSupabaseError({ error, data: null }, 'carts');
};

export const clearCartFromDB = async (storeId: string, userId: string): Promise<void> => {
    await saveCart(storeId, userId, []);
};

// =================================================================
// Data Fetching for a Store
// =================================================================

export const getStoreData = async (storeId: string): Promise<Partial<StoreTypeMap>> => {
    const tableNames: (keyof StoreTypeMap)[] = [
        'products', 'productVariants', 'sales', 'expenses', 'customers', 
        'suppliers', 'returns', 'categories', 'purchases', 'stockBatches'
    ];
    
    const promises = tableNames.map(tableName => 
        supabase.from(tableName).select('*').eq('storeId', storeId)
    );

    const results = await Promise.all(promises);
    const data: Partial<StoreTypeMap> = {};
    let hasError = false;

    results.forEach((res, index) => {
        if (res.error) {
            // Ignore error if table doesn't exist, it might be a new schema feature
            if (res.error.code !== '42P01') { // 42P01: undefined_table
              console.error(`Error fetching ${tableNames[index]}:`, res.error);
              hasError = true;
            } else {
              console.warn(`Table "${tableNames[index]}" not found, skipping.`);
              (data as any)[tableNames[index]] = [];
            }
        } else {
            const key = tableNames[index];
            (data as any)[key] = res.data;
        }
    });

    if (hasError) {
        throw new Error('Failed to fetch some store data.');
    }

    return data;
};

// =================================================================
// Product & Stock Functions
// =================================================================

export const addProduct = async (
    productData: Omit<Product, 'id'>, 
    variantsData: (Omit<ProductVariant, 'id' | 'productId' | 'storeId'> & { stockQuantity?: number })[]
): Promise<{ product: Product, variants: ProductVariant[] }> => {
    const { data, error } = await supabase.rpc('create_product_with_variants', {
        p_product_data: productData,
        p_variants_data: variantsData,
    });

    if (error) {
        console.error('Error in RPC create_product_with_variants', error);
        throw new Error(error.message);
    }
    
    return data;
};

export const updateProduct = async (
    productData: Product, 
    variantsData: (Partial<ProductVariant> & { stockQuantity?: number })[]
): Promise<void> => {
    const { error } = await supabase.rpc('update_product_with_variants', {
        p_product_data: productData,
        p_variants_data: variantsData,
    });
    
    if (error) {
        console.error('Error in RPC update_product_with_variants', error);
        throw new Error(error.message);
    }
};

export const deleteProduct = async (id: string): Promise<void> => {
    const { error } = await supabase.from('products').delete().eq('id', id);
    handleSupabaseError({ error, data: null }, 'products');
};

export const addStockAndUpdateVariant = async (
    storeId: string,
    variantId: string,
    quantity: number,
    purchasePrice: number,
    sellingPrice: number,
    supplierId: string | undefined
) => {
    const { error } = await supabase.rpc('add_stock_and_update_variant', {
        p_store_id: storeId,
        p_variant_id: variantId,
        p_quantity: quantity,
        p_purchase_price: purchasePrice,
        p_selling_price: sellingPrice,
        p_supplier_id: supplierId,
    });
    if (error) {
        console.error('Error adding stock:', error);
        throw new Error(error.message);
    }
};

// =================================================================
// Sales & Returns
// =================================================================

export const completeSale = async (
    storeId: string,
    cart: CartItem[],
    downPayment: number,
    customerId: string | undefined,
    finalTotal: number,
    userId: string
): Promise<Sale> => {
    const { data, error } = await supabase.rpc('complete_sale', {
        p_store_id: storeId,
        p_user_id: userId,
        p_cart_items: cart,
        p_down_payment: downPayment,
        p_customer_id: customerId,
        p_final_total: finalTotal,
    });
    
    if (error) {
        console.error('Error completing sale:', error);
        throw new Error(error.message);
    }
    
    return data;
};

export const processReturn = async (
    storeId: string,
    itemsToReturn: CartItem[],
    userId: string
): Promise<Return> => {
    const { data, error } = await supabase.rpc('process_return', {
        p_store_id: storeId,
        p_user_id: userId,
        p_return_items: itemsToReturn,
    });
    
    if (error) {
        console.error('Error processing return:', error);
        throw new Error(error.message);
    }

    return data;
};

export const deleteReturn = async (returnId: string): Promise<void> => {
    const { error } = await supabase.from('returns').delete().eq('id', returnId);
    handleSupabaseError({ error, data: null }, 'returns');
};

export const deleteAllReturns = async (storeId: string): Promise<void> => {
    const { error } = await supabase.from('returns').delete().eq('storeId', storeId);
    handleSupabaseError({ error, data: null }, 'returns');
};

export const payCustomerDebt = async (customerId: string, amount: number): Promise<void> => {
    const { error } = await supabase.rpc('pay_customer_debt', {
        p_customer_id: customerId,
        p_amount: amount,
    });

    if (error) {
        console.error('Error paying customer debt:', error);
        throw new Error(error.message);
    }
};

// =================================================================
// Expenses
// =================================================================

export const addExpense = async (expense: Omit<Expense, 'id'>): Promise<Expense | undefined> => {
    const { data, error } = await supabase.from('expenses').insert(expense).select().single();
    return handleSupabaseError({ error, data }, 'expenses');
};

export const updateExpense = async (expense: Expense): Promise<void> => {
    const { error } = await supabase.from('expenses').update(expense).eq('id', expense.id);
    handleSupabaseError({ error, data: null }, 'expenses');
};

export const deleteExpense = async (id: string): Promise<void> => {
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    handleSupabaseError({ error, data: null }, 'expenses');
};

// =================================================================
// Customers
// =================================================================
export const addCustomer = async (customer: Omit<Customer, 'id'>): Promise<Customer | undefined> => {
    const { data, error } = await supabase.from('customers').insert(customer).select().single();
    return handleSupabaseError({ error, data }, 'customers');
};

export const deleteCustomer = async (id: string): Promise<void> => {
    const { data, error } = await supabase.from('customers').delete().eq('id', id);
    handleSupabaseError({ error, data }, 'customers');
};

// =================================================================
// Suppliers
// =================================================================
export const addSupplier = async (supplier: Omit<Supplier, 'id'>): Promise<Supplier | undefined> => {
    const { data, error } = await supabase.from('suppliers').insert(supplier).select().single();
    return handleSupabaseError({ error, data }, 'suppliers');
};

export const deleteSupplier = async (id: string): Promise<void> => {
    const { data, error } = await supabase.from('suppliers').delete().eq('id', id);
    handleSupabaseError({ error, data }, 'suppliers');
};


// =================================================================
// Categories
// =================================================================
export const addCategory = async (category: Omit<Category, 'id'>): Promise<Category | undefined> => {
    const { data, error } = await supabase.from('categories').insert(category).select().single();
    return handleSupabaseError({ error, data }, 'categories');
};

export const updateCategory = async (category: Category): Promise<void> => {
    const { error } = await supabase.from('categories').update(category).eq('id', category.id);
    handleSupabaseError({ error, data: null }, 'categories');
};

export const deleteCategory = async (id: string): Promise<void> => {
    const { data, error } = await supabase.from('categories').delete().eq('id', id);
    handleSupabaseError({ error, data }, 'categories');
};

// =================================================================
// Purchases
// =================================================================

export const addPurchase = async (purchase: Omit<Purchase, 'id'>): Promise<void> => {
    const { error } = await supabase.rpc('add_purchase_and_stock', {
        p_purchase_data: purchase
    });
    if (error) {
        console.error('Error in RPC add_purchase_and_stock:', error);
        throw new Error(error.message);
    }
};

export const updatePurchase = async (purchase: Purchase): Promise<void> => {
    const { error } = await supabase.from('purchases').update(purchase).eq('id', purchase.id);
    handleSupabaseError({ error, data: null }, 'purchases');
};

// =================================================================
// Backup & Restore
// =================================================================

export const getDatabaseContents = async (): Promise<string> => {
    const { data, error } = await supabase.rpc('backup_database');
    if (error) {
        console.error('Error backing up database:', error);
        throw new Error(error.message);
    }
    // Pretty print the JSON with an indentation of 2 spaces
    return JSON.stringify(data, null, 2);
};


export const restoreDatabase = async (content: string): Promise<{id: string} | null> => {
    console.log("Starting database restore process...");
    let jsonData;
    try {
        let sanitizedContent = content.replace(/"logo"\s*:\s*"data:image\/[^"]*"/g, '"logo": ""');
        jsonData = JSON.parse(sanitizedContent);
        console.log("JSON content parsed successfully.");
    } catch (e) {
        console.error("JSON Parse Error:", e);
        throw new Error('jsonParseError');
    }

    if (!jsonData.stores || !Array.isArray(jsonData.stores) || jsonData.stores.length === 0) {
        throw new Error('restoreError');
    }
    
    const storeId = jsonData.stores[0]?.id;
    if (!storeId) {
        throw new Error('restoreError');
    }
    console.log(`Starting restore for store ID: ${storeId}`);

    const tablesInOrder: (keyof StoreTypeMap)[] = [
        'suppliers', 'customers', 'categories', 'users', 'products',
        'productVariants', 'purchases', 'stockBatches', 'sales',
        'returns', 'expenses'
    ];

    // --- DELETION PHASE ---
    console.log("--- Starting Deletion Phase ---");
    for (const tableName of [...tablesInOrder].reverse()) {
        if (!jsonData[tableName]) {
            console.log(`No data for table "${tableName}" in backup file. Skipping deletion.`);
            continue;
        }
        console.log(`Attempting to delete data from ${tableName}...`);
        const { error: deleteError } = await supabase.from(tableName).delete().eq('storeId', storeId);
        
        if (deleteError) {
             if (deleteError.message.includes('relation') && deleteError.message.includes('does not exist')) {
                 console.warn(`Table "${tableName}" does not exist in the database. Skipping deletion.`);
            } else {
                console.error(`Critical error deleting from ${tableName}:`, deleteError);
                throw new Error(`Erreur lors du vidage de la table ${tableName}: ${deleteError.message}`);
            }
        } else {
             console.log(`Successfully cleared ${tableName}.`);
        }
    }
    
    // --- STORE UPDATE PHASE ---
    console.log("--- Starting Store Update Phase ---");
    if (jsonData.stores && jsonData.stores.length > 0) {
        const { id, ...storeUpdateData } = jsonData.stores[0];
        storeUpdateData.trialStartDate = storeUpdateData.trialStartDate || null;
        storeUpdateData.licenseProof = storeUpdateData.licenseProof || null;
        const { error: storeUpdateError } = await supabase.from('stores').update(storeUpdateData).eq('id', id);
        if (storeUpdateError) throw new Error(`Failed to update store: ${storeUpdateError.message}`);
        console.log("Store details updated successfully.");
    }
    
    // --- INSERTION PHASE ---
    console.log("--- Starting Insertion Phase ---");
    for (const tableName of tablesInOrder) {
        const dataToInsert = (jsonData as any)[tableName];
        
        if (dataToInsert && Array.isArray(dataToInsert) && dataToInsert.length > 0) {
            console.log(`Attempting to insert ${dataToInsert.length} records into ${tableName}...`);
            const itemsWithStoreId = dataToInsert.map((item: any) => ({ ...item, storeId }));
            
            const chunkSize = 150;
            for (let i = 0; i < itemsWithStoreId.length; i += chunkSize) {
                const chunk = itemsWithStoreId.slice(i, i + chunkSize);
                console.log(`  - Inserting chunk ${Math.floor(i / chunkSize) + 1} of ${Math.ceil(itemsWithStoreId.length / chunkSize)} for ${tableName}...`);
                const { error: insertError } = await supabase.from(tableName).insert(chunk);
                
                if (insertError) {
                     if (insertError.message.includes('relation') && insertError.message.includes('does not exist')) {
                         console.warn(`Table "${tableName}" does not exist. Skipping insertion for this table.`);
                         break; 
                    } else if (insertError.code === '23503') { 
                        console.error(`Foreign key violation inserting into ${tableName}.`, { chunk, insertError });
                        throw new Error(`Erreur de restauration pour ${tableName}: une référence (ex: ID de produit, client) est introuvable. Détails: ${insertError.details}`);
                    } else {
                        console.error(`Critical error inserting into ${tableName}:`, insertError);
                        throw new Error(`Erreur de restauration pour ${tableName}: ${insertError.message}`);
                    }
                }
            }
             console.log(`Successfully inserted all records for ${tableName}.`);
        } else {
             console.log(`No data to insert for ${tableName}, skipping.`);
        }
    }

    console.log(`Restore completed successfully for store ID: ${storeId}`);
    return { id: storeId };
};
