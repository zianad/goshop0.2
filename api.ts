import { supabase } from './supabaseClient';
import type { Store, User, Product, ProductVariant, Sale, Expense, Customer, Supplier, Category, Purchase, Return, CartItem, StockBatch, StoreTypeMap, PurchaseItem, VariantFormData } from './types';

// Helper to convert keys from snake_case to camelCase
const toCamel = (s: string) => s.replace(/([-_][a-z])/ig, ($1) => $1.toUpperCase().replace('-', '').replace('_', ''));

const snakeToCamel = <T>(obj: any): T => {
    if (Array.isArray(obj)) {
        return obj.map(v => snakeToCamel(v)) as any;
    } else if (obj !== null && typeof obj === 'object') {
        return Object.keys(obj).reduce((acc, key) => {
            (acc as any)[toCamel(key)] = snakeToCamel(obj[key]);
            return acc;
        }, {} as T);
    }
    return obj;
};

// Helper to convert keys from camelCase to snake_case for insertion/updates
const toSnake = (s: string) => s.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);

const camelToSnake = (obj: any): any => {
    if (Array.isArray(obj)) {
        return obj.map(v => camelToSnake(v));
    } else if (obj !== null && typeof obj === 'object') {
        return Object.keys(obj).reduce((acc, key) => {
            (acc as any)[toSnake(key)] = camelToSnake(obj[key]);
            return acc;
        }, {} as any);
    }
    return obj;
};


// AUTH & STORE
export const getStoreByLicenseKey = async (licenseKey: string): Promise<Store | null> => {
    const { data, error } = await supabase.from('stores').select('*').eq('license_key', licenseKey).single();
    if (error) {
        if (error.code === 'PGRST116') { // "PostgREST error" "No rows found"
            return null;
        }
        throw error;
    }
    return data ? snakeToCamel(data) : null;
};

export const getStoreById = async (storeId: string): Promise<Store | null> => {
    const { data, error } = await supabase.from('stores').select('*').eq('id', storeId).single();
    if (error) {
        console.error('Error fetching store by ID:', error);
        return null;
    }
    return data ? snakeToCamel(data) : null;
};

export const login = async (store: Store, secret: string): Promise<{ user: User, store: Store }> => {
    if (!store.isActive) {
        throw new Error('storeDisabledError');
    }

    const { data: users, error } = await supabase
        .from('users')
        .select('*')
        .eq('store_id', store.id);

    if (error) throw error;

    const user = users.find(u => (u.role === 'admin' && u.password === secret) || (u.role === 'seller' && u.pin === secret));
    
    if (user) {
        return { user: snakeToCamel(user), store };
    } else {
        throw new Error('invalidCredentialsError');
    }
};

export const verifyAndActivateStoreWithCode = async (storeId: string, code: string): Promise<boolean> => {
    const MASTER_SECRET_KEY = 'GoShop-Activation-Key-Abzn-Secret-2024';

    if (!code.startsWith('PERM-')) return false;

    try {
        const decoded = atob(code.substring(5));
        const [decodedStoreId, decodedSecret] = decoded.split('::');

        if (decodedStoreId === storeId && decodedSecret === MASTER_SECRET_KEY) {
            const { error } = await supabase
                .from('stores')
                .update({ trial_start_date: null, is_active: true })
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


// CART
export const loadCart = async (storeId: string, userId: string): Promise<CartItem[]> => {
    const { data, error } = await supabase
        .from('carts')
        .select('cart_data')
        .eq('store_id', storeId)
        .eq('user_id', userId)
        .single();
    if (error || !data) {
        return [];
    }
    return data.cart_data as CartItem[] || [];
};

export const saveCart = async (storeId: string, userId: string, cart: CartItem[]): Promise<void> => {
    const { error } = await supabase
        .from('carts')
        .upsert({ store_id: storeId, user_id: userId, cart_data: cart }, { onConflict: 'store_id, user_id' });

    if (error) {
        console.error("Error saving cart:", error);
    }
};

export const clearCartFromDB = async (storeId: string, userId: string): Promise<void> => {
    await saveCart(storeId, userId, []);
};


// DATA FETCHING
export const getStoreData = async (storeId: string): Promise<Partial<StoreTypeMap>> => {
    const tableNames: (keyof StoreTypeMap)[] = ['products', 'productVariants', 'sales', 'expenses', 'customers', 'suppliers', 'returns', 'categories', 'purchases', 'stockBatches'];
    
    const queries = tableNames.map(tableName => {
        const snakeCaseTable = toSnake(tableName);
        return supabase.from(snakeCaseTable).select('*').eq('store_id', storeId);
    });

    const results = await Promise.all(queries);
    
    const data: Partial<StoreTypeMap> = {};
    results.forEach((result, index) => {
        if (result.error) {
            console.error(`Error fetching ${tableNames[index]}:`, result.error);
            (data as any)[tableNames[index]] = [];
        } else {
            (data as any)[tableNames[index]] = snakeToCamel(result.data);
        }
    });

    return data;
};

// SUPER ADMIN
export const getAllStores = async (): Promise<Store[]> => {
    const { data, error } = await supabase.from('stores').select('*');
    if (error) throw error;
    return snakeToCamel(data);
};

export const getAllUsers = async (): Promise<User[]> => {
    const { data, error } = await supabase.from('users').select('*');
    if (error) throw error;
    return snakeToCamel(data);
};

export const createStoreAndAdmin = async (name: string, logo: string | undefined, adminPassword: string, adminEmail: string | undefined, trialDurationDays: number, address: string | undefined, ice: string | undefined, enableAiReceiptScan: boolean): Promise<{ store: Store, user: User, licenseKey: string }> => {
    const licenseKey = crypto.randomUUID();
    const storePayload = {
        name,
        logo,
        license_key: licenseKey,
        is_active: false,
        trial_duration_days: trialDurationDays,
        address,
        ice,
        enable_ai_receipt_scan: enableAiReceiptScan,
    };
    const { data: storeData, error: storeError } = await supabase.from('stores').insert(storePayload).select().single();
    if (storeError) throw storeError;

    const store = snakeToCamel<Store>(storeData);

    const adminPayload = {
        name: 'admin',
        password: adminPassword,
        email: adminEmail,
        role: 'admin',
        store_id: store.id,
    };
    const { data: userData, error: userError } = await supabase.from('users').insert(adminPayload).select().single();
    if (userError) {
        // Rollback store creation if user creation fails
        await supabase.from('stores').delete().eq('id', store.id);
        throw userError;
    }
    const user = snakeToCamel<User>(userData);

    return { store, user, licenseKey };
};

export const deleteStore = async (storeId: string): Promise<void> => {
    // Assuming DB has cascade delete on store_id FKs
    const { error } = await supabase.from('stores').delete().eq('id', storeId);
    if (error) throw error;
};

export const updateStore = async (store: Partial<Store>): Promise<void> => {
    const { error } = await supabase.from('stores').update(camelToSnake(store)).eq('id', store.id);
    if (error) throw error;
};

export const getAdminUserForStore = async (storeId: string): Promise<User | null> => {
    const { data, error } = await supabase.from('users').select('*').eq('store_id', storeId).eq('role', 'admin').maybeSingle();
    if (error) {
      throw error;
    }
    return data ? snakeToCamel(data) : null;
};


// PRODUCT/SERVICE
export const addProduct = async (productData: Omit<Product, 'id'>, variantsData: (Omit<VariantFormData, 'stockQuantity'>)[]): Promise<{ product: Product, variants: ProductVariant[] }> => {
    // 1. Add product
    const { data: newProductData, error: productError } = await supabase.from('products').insert(camelToSnake(productData)).select().single();
    if (productError) throw productError;
    const newProduct = snakeToCamel<Product>(newProductData);

    if (!variantsData || variantsData.length === 0) {
        return { product: newProduct, variants: [] };
    }
    
    // 2. Add variants
    const variantsToInsert = variantsData.map(({ ...variant }) => ({
        ...camelToSnake(variant),
        product_id: newProduct.id,
        store_id: newProduct.storeId,
    }));
    const { data: newVariantsData, error: variantsError } = await supabase.from('product_variants').insert(variantsToInsert).select();
    if (variantsError) throw variantsError;
    const newVariants = snakeToCamel<ProductVariant[]>(newVariantsData);

    return { product: newProduct, variants: newVariants };
};

export const updateProduct = async (productData: Product, variantsData: (VariantFormData)[]): Promise<void> => {
    // 1. Update product
    const { error: productError } = await supabase.from('products').update(camelToSnake(productData)).eq('id', productData.id);
    if (productError) throw productError;

    // 2. Get existing variants from DB
    const { data: existingVariantsData, error: fetchError } = await supabase.from('product_variants').select('id').eq('product_id', productData.id);
    if (fetchError) throw fetchError;
    const existingVariantIds = existingVariantsData.map(v => v.id);
    
    // 3. Upsert variants
    const variantsToUpsert = variantsData.map(({ stockQuantity, ...variant }) => ({
        ...camelToSnake(variant),
        product_id: productData.id,
        store_id: productData.storeId,
    }));
    
    const { error: upsertError } = await supabase.from('product_variants').upsert(variantsToUpsert);
    if (upsertError) throw upsertError;
    
    // 4. Delete variants that were removed
    const newVariantIds = variantsData.map(v => v.id).filter(Boolean);
    const variantsToDelete = existingVariantIds.filter(id => !newVariantIds.includes(id));
    if (variantsToDelete.length > 0) {
        const { error: deleteError } = await supabase.from('product_variants').delete().in('id', variantsToDelete);
        if (deleteError) throw deleteError;
    }
};

export const deleteProduct = async (productId: string): Promise<void> => {
    const { error } = await supabase.from('products').delete().eq('id', productId);
    if (error) throw error;
};

export const addStockAndUpdateVariant = async (storeId: string, variantId: string, quantity: number, purchasePrice: number, sellingPrice: number, supplierId: string | undefined): Promise<void> => {
    // 1. Add stock batch
    const { error: stockError } = await supabase.from('stock_batches').insert({
        store_id: storeId,
        variant_id: variantId,
        quantity,
        purchase_price: purchasePrice,
    });
    if (stockError) throw stockError;

    // 2. Update variant prices
    const { error: variantError } = await supabase.from('product_variants').update({
        purchase_price: purchasePrice,
        price: sellingPrice
    }).eq('id', variantId);
    if (variantError) throw variantError;
    
    // 3. Create a purchase record for traceability
    const { data: variantData } = await supabase.from('product_variants').select('*, products(name)').eq('id', variantId).single();
    if (variantData) {
        const v = snakeToCamel<ProductVariant & { products: { name: string } }>(variantData);
        const purchase: Omit<Purchase, 'id'> = {
            storeId: storeId,
            supplierId: supplierId,
            date: new Date().toISOString(),
            items: [{
                variantId: v.id,
                productId: v.productId,
                productName: v.products.name,
                variantName: v.name,
                quantity: quantity,
                purchasePrice: purchasePrice
            }],
            totalAmount: quantity * purchasePrice,
            reference: 'purchase_ref_stock_adjustment',
            amountPaid: quantity * purchasePrice,
            remainingAmount: 0,
            paymentMethod: 'cash'
        };
        await addPurchase(purchase, false);
    }
};

// SALE / RETURN
export const completeSale = async (storeId: string, cart: CartItem[], downPayment: number, customerId: string | undefined, finalTotal: number, userId: string): Promise<Sale> => {
    const profit = cart.reduce((acc, item) => {
        if (item.purchasePrice != null) {
            return acc + (item.price - item.purchasePrice) * item.quantity;
        }
        return acc;
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
    
    const { data, error } = await supabase.from('sales').insert(camelToSnake(sale)).select().single();
    if (error) throw error;

    // Update stock
    const stockUpdates = cart.filter(item => item.type === 'good').map(item => ({
        store_id: storeId,
        variant_id: item.id,
        quantity: -item.quantity,
        purchase_price: item.purchasePrice || 0,
    }));

    if (stockUpdates.length > 0) {
        const { error: stockError } = await supabase.from('stock_batches').insert(stockUpdates);
        if (stockError) {
            // Should ideally rollback sale insertion in a transaction
            console.error('Stock update failed after sale:', stockError);
        }
    }

    return snakeToCamel(data);
};

export const processReturn = async (storeId: string, itemsToReturn: CartItem[], userId: string): Promise<Return> => {
    const refundAmount = itemsToReturn.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const profitLost = itemsToReturn.reduce((sum, item) => {
        if (item.purchasePrice != null) {
            return sum + (item.price - item.purchasePrice) * item.quantity;
        }
        return sum;
    }, 0);

    const returnData: Omit<Return, 'id'> = {
        storeId,
        userId,
        date: new Date().toISOString(),
        items: itemsToReturn,
        refundAmount,
        profitLost,
    };
    
    const { data, error } = await supabase.from('returns').insert(camelToSnake(returnData)).select().single();
    if (error) throw error;
    
    // Update stock
    const stockUpdates = itemsToReturn.filter(item => item.type === 'good').map(item => ({
        store_id: storeId,
        variant_id: item.id,
        quantity: item.quantity, // Positive quantity for return
        purchase_price: item.purchasePrice || 0,
    }));
    
    if (stockUpdates.length > 0) {
        const { error: stockError } = await supabase.from('stock_batches').insert(stockUpdates);
        if (stockError) console.error('Stock update failed after return:', stockError);
    }

    return snakeToCamel(data);
};

export const deleteReturn = async (returnId: string): Promise<void> => {
    const { error } = await supabase.from('returns').delete().eq('id', returnId);
    if (error) throw error;
};

export const deleteAllReturns = async (storeId: string): Promise<void> => {
    const { error } = await supabase.from('returns').delete().eq('store_id', storeId);
    if (error) throw error;
};


export const payCustomerDebt = async (customerId: string, amount: number): Promise<void> => {
    let amountToApply = amount;
    const { data: sales, error } = await supabase.from('sales').select('*').eq('customer_id', customerId).gt('remaining_amount', 0).order('date', { ascending: true });

    if (error) throw error;
    if (!sales) return;

    for (const sale of sales) {
        if (amountToApply <= 0) break;
        const payment = Math.min(amountToApply, sale.remaining_amount);
        
        const { error: updateError } = await supabase
            .from('sales')
            .update({
                remaining_amount: sale.remaining_amount - payment,
                down_payment: sale.down_payment + payment,
            })
            .eq('id', sale.id);
        
        if (updateError) throw updateError;
        amountToApply -= payment;
    }
};

// EXPENSE
export const addExpense = async (expense: Omit<Expense, 'id'>): Promise<Expense> => {
    const { data, error } = await supabase.from('expenses').insert(camelToSnake(expense)).select().single();
    if (error) throw error;
    return snakeToCamel(data);
};
export const updateExpense = async (expense: Expense): Promise<void> => {
    const { error } = await supabase.from('expenses').update(camelToSnake(expense)).eq('id', expense.id);
    if (error) throw error;
};
export const deleteExpense = async (expenseId: string): Promise<void> => {
    const { error } = await supabase.from('expenses').delete().eq('id', expenseId);
    if (error) throw error;
};

// CUSTOMER
export const addCustomer = async (customer: Omit<Customer, 'id'>): Promise<Customer> => {
    const { data, error } = await supabase.from('customers').insert(camelToSnake(customer)).select().single();
    if (error) throw error;
    return snakeToCamel(data);
};
export const deleteCustomer = async (customerId: string): Promise<void> => {
    const { data, error: debtError } = await supabase.from('sales').select('remaining_amount').eq('customer_id', customerId);
    if (debtError) throw debtError;

    const totalDebt = data.reduce((sum, sale) => sum + sale.remaining_amount, 0);
    if (totalDebt > 0) {
        throw new Error('customerDeleteErrorHasDebt');
    }
    const { error } = await supabase.from('customers').delete().eq('id', customerId);
    if (error) throw error;
};

// SUPPLIER
export const addSupplier = async (supplier: Omit<Supplier, 'id'>): Promise<Supplier> => {
    const { data, error } = await supabase.from('suppliers').insert(camelToSnake(supplier)).select().single();
    if (error) throw error;
    return snakeToCamel(data);
};
export const deleteSupplier = async (supplierId: string): Promise<void> => {
    const { data, error: debtError } = await supabase.from('purchases').select('remaining_amount').eq('supplier_id', supplierId);
    if (debtError) throw debtError;
    const totalDebt = data.reduce((sum, p) => sum + p.remaining_amount, 0);
    if(totalDebt > 0) {
        throw new Error('supplierDeleteErrorHasDebt');
    }
    const { error } = await supabase.from('suppliers').delete().eq('id', supplierId);
    if (error) throw error;
};

// CATEGORY
export const addCategory = async (category: Omit<Category, 'id'>): Promise<Category> => {
    const { data, error } = await supabase.from('categories').insert(camelToSnake(category)).select().single();
    if (error) throw error;
    return snakeToCamel(data);
};
export const updateCategory = async (category: Category): Promise<void> => {
    const { error } = await supabase.from('categories').update(camelToSnake(category)).eq('id', category.id);
    if (error) throw error;
};
export const deleteCategory = async (categoryId: string): Promise<void> => {
    // Check if category is used
    const { data, error: checkError } = await supabase.from('products').select('id').eq('category_id', categoryId).limit(1);
    if (checkError) throw checkError;
    if (data && data.length > 0) {
        throw new Error('categoryDeleteError');
    }
    const { error } = await supabase.from('categories').delete().eq('id', categoryId);
    if (error) throw error;
};

// PURCHASE
export const addPurchase = async (purchase: Omit<Purchase, 'id'>, updateStock = true): Promise<void> => {
    const { error } = await supabase.from('purchases').insert(camelToSnake(purchase));
    if (error) throw error;
    
    if (updateStock) {
        const stockBatches = purchase.items.map(item => ({
            store_id: purchase.storeId,
            variant_id: item.variantId,
            quantity: item.quantity,
            purchase_price: item.purchasePrice
        }));

        if (stockBatches.length > 0) {
            const { error: stockError } = await supabase.from('stock_batches').insert(stockBatches);
            if (stockError) throw stockError;
        }

        // Also update purchase price on variants
        for (const item of purchase.items) {
            await supabase.from('product_variants').update({ purchase_price: item.purchasePrice }).eq('id', item.variantId);
        }
    }
};
export const updatePurchase = async (purchase: Purchase): Promise<void> => {
    const { error } = await supabase.from('purchases').update(camelToSnake(purchase)).eq('id', purchase.id);
    if (error) throw error;
};

// USER
export const addUser = async (user: Omit<User, 'id'>): Promise<User> => {
    const { data, error } = await supabase.from('users').insert(camelToSnake(user)).select().single();
    if (error) throw error;
    return snakeToCamel(data);
};
export const updateUser = async (user: User): Promise<void> => {
    const { error } = await supabase.from('users').update(camelToSnake(user)).eq('id', user.id);
    if (error) throw error;
};
export const deleteUser = async (userId: string): Promise<void> => {
    const { error } = await supabase.from('users').delete().eq('id', userId);
    if (error) throw error;
};
