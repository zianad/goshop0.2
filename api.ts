import { supabase } from './supabaseClient.ts';
import type { Store, User, Product, ProductVariant, Sale, Expense, Return, Customer, Supplier, Category, Purchase, StockBatch, PurchaseItem, VariantFormData, CartItem } from './types.ts';

// Helper to handle Supabase errors
const handleSupabaseError = ({ error, data }: { error: any, data: any }, context: string) => {
    if (error) {
        console.error(`Error in ${context}:`, error);
        throw new Error(error.message);
    }
    return data;
};

// --- Store & Auth ---

export const getStoreByLicenseKey = async (licenseKey: string): Promise<Store | null> => {
    const { data, error } = await supabase.from('stores').select('*').eq('licenseKey', licenseKey).single();
    if (error && error.code !== 'PGRST116') { // PGRST116 is "No rows found"
        console.error('Error fetching store by license key:', error);
        throw error;
    }
    return data;
};

export const getStoreById = async (storeId: string): Promise<Store | null> => {
    const { data, error } = await supabase.from('stores').select('*').eq('id', storeId).single();
    if (error && error.code !== 'PGRST116') {
        console.error('Error fetching store by ID:', error);
        throw error;
    }
    return data;
};

export const login = async (store: Store, secret: string): Promise<{ user: User, store: Store }> => {
    if (!store.isActive) {
        throw new Error('storeDisabledError');
    }
    const { data, error } = await supabase.from('users').select('*').eq('storeId', store.id);
    handleSupabaseError({ error, data }, 'login fetch users');
    const user = data.find(u => u.password === secret || u.pin === secret);
    if (!user) {
        throw new Error('invalidCredentialsError');
    }
    return { user, store };
};

export const verifyAndActivateStoreWithCode = async (storeId: string, code: string): Promise<boolean> => {
    const MASTER_SECRET_KEY = 'GoShop-Activation-Key-Abzn-Secret-2024';
    try {
        const decoded = atob(code.replace('PERM-', ''));
        if (decoded === `${storeId}::${MASTER_SECRET_KEY}`) {
            const { error } = await supabase.from('stores').update({ 
                isActive: true, 
                trialStartDate: null, // Marks as permanently licensed
                trialDurationDays: 9999
            }).eq('id', storeId);

            if (error) throw error;
            return true;
        }
        return false;
    } catch (e) {
        console.error("Activation code verification failed:", e);
        throw new Error('invalidActivationCode');
    }
};

// --- Super Admin Functions ---

export const getAllStores = async (): Promise<Store[]> => {
    const { data, error } = await supabase.from('stores').select('*');
    return handleSupabaseError({ error, data }, 'getAllStores');
};

export const getAllUsers = async (): Promise<User[]> => {
    const { data, error } = await supabase.from('users').select('*');
    return handleSupabaseError({ error, data }, 'getAllUsers');
};

export const getAdminUserForStore = async (storeId: string): Promise<User | null> => {
    const { data, error } = await supabase.from('users').select('*').eq('storeId', storeId).eq('role', 'admin').limit(1).single();
    if (error && error.code !== 'PGRST116') {
        throw error;
    }
    return data;
};

export const createStoreAndAdmin = async (name: string, logo: string, adminPassword: string, adminEmail: string, trialDurationDays: number, address: string, ice: string, enableAiReceiptScan: boolean): Promise<{ store: Store, admin: User, licenseKey: string }> => {
    // Note: In a real production app, this should be a single transaction or an RPC call in Supabase for atomicity.
    const licenseKey = `GS-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const { data: storeData, error: storeError } = await supabase.from('stores').insert({
        name,
        logo,
        licenseKey,
        trialDurationDays,
        address,
        ice,
        enableAiReceiptScan,
        isActive: false // Start as inactive by default
    }).select().single();
    handleSupabaseError({ error: storeError, data: storeData }, 'createStore');
    
    const { data: adminData, error: adminError } = await supabase.from('users').insert({
        storeId: storeData.id,
        name: 'Admin',
        role: 'admin',
        password: adminPassword,
        email: adminEmail,
    }).select().single();
    handleSupabaseError({ error: adminError, data: adminData }, 'createAdmin');
    
    return { store: storeData, admin: adminData, licenseKey };
};

export const updateStore = async (store: Partial<Store> & { id: string }): Promise<void> => {
    const { error } = await supabase.from('stores').update(store).eq('id', store.id);
    handleSupabaseError({ error, data: null }, 'updateStore');
};

export const deleteStore = async (storeId: string): Promise<void> => {
    // Supabase RLS and cascades should handle deleting related data.
    const { error } = await supabase.from('stores').delete().eq('id', storeId);
    handleSupabaseError({ error, data: null }, 'deleteStore');
};

export const updateUser = async (user: User): Promise<void> => {
    const { error } = await supabase.from('users').update(user).eq('id', user.id);
    handleSupabaseError({ error, data: null }, 'updateUser');
};

export const addUser = async (user: Omit<User, 'id'>): Promise<User> => {
    const { data, error } = await supabase.from('users').insert(user).select().single();
    return handleSupabaseError({ error, data }, 'addUser');
};

// --- Customer and Supplier Deletion with Debt Check ---

export const deleteCustomer = async (customerId: string): Promise<void> => {
    const { data: sales, error: salesError } = await supabase.from('sales').select('remainingAmount').eq('customerId', customerId);
    handleSupabaseError({ error: salesError, data: sales }, 'deleteCustomer check debt');

    const totalDebt = sales.reduce((sum, sale) => sum + sale.remainingAmount, 0);
    if (totalDebt > 0) {
        throw new Error('customerDeleteErrorHasDebt');
    }

    const { error: deleteError } = await supabase.from('customers').delete().eq('id', customerId);
    handleSupabaseError({ error: deleteError, data: null }, 'deleteCustomer');
};

export const deleteSupplier = async (supplierId: string): Promise<void> => {
    const { data: purchases, error: purchasesError } = await supabase.from('purchases').select('remainingAmount').eq('supplierId', supplierId);
    handleSupabaseError({ error: purchasesError, data: purchases }, 'deleteSupplier check debt');

    const totalDebt = purchases.reduce((sum, p) => sum + p.remainingAmount, 0);
    if (totalDebt > 0) {
        throw new Error('supplierDeleteErrorHasDebt');
    }

    const { error: deleteError } = await supabase.from('suppliers').delete().eq('id', supplierId);
    handleSupabaseError({ error: deleteError, data: null }, 'deleteSupplier');
};
