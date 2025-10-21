import { supabase } from './supabaseClient';
import type { Store, User } from './types';

const MASTER_SECRET_KEY = 'GoShop-Activation-Key-Abzn-Secret-2024';

// Store functions
export const getAllStores = async (): Promise<Store[]> => {
    const { data, error } = await supabase.from('stores').select('*');
    if (error) throw error;
    return data || [];
};

export const getStoreById = async (storeId: string): Promise<Store | null> => {
    const { data, error } = await supabase.from('stores').select('*').eq('id', storeId).single();
    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
        console.error("Error fetching store by ID:", error);
        throw error;
    }
    return data;
};

export const getStoreByLicenseKey = async (licenseKey: string): Promise<Store | null> => {
    const { data, error } = await supabase.from('stores').select('*').eq('licenseKey', licenseKey).single();
    if (error && error.code !== 'PGRST116') {
        console.error("Error fetching store by license key:", error);
        throw new Error('invalidActivationCode');
    }
    return data;
};

export const createStoreAndAdmin = async (
    storeName: string, 
    logo: string,
    adminPassword: string,
    adminEmail: string,
    trialDurationDays: number,
    address: string,
    ice: string,
    enableAiReceiptScan: boolean
): Promise<{ store: Store; user: User; licenseKey: string; }> => {
    const licenseKey = `GS-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    
    // 1. Create Store
    const { data: storeData, error: storeError } = await supabase
        .from('stores')
        .insert({
            name: storeName,
            logo: logo || null,
            licenseKey,
            trialDurationDays,
            address: address || null,
            ice: ice || null,
            enableAiReceiptScan,
            isActive: false // Starts as inactive until activated
        })
        .select()
        .single();
    if (storeError) throw storeError;

    // 2. Create Admin for that store
    const { data: userData, error: userError } = await supabase
        .from('users')
        .insert({
            storeId: storeData.id,
            name: 'Admin',
            email: adminEmail || null,
            password: adminPassword,
            role: 'admin'
        })
        .select()
        .single();
    if (userError) throw userError;

    return { store: storeData, user: userData, licenseKey };
};

export const updateStore = async (store: Store): Promise<Store> => {
    const { data, error } = await supabase.from('stores').update(store).eq('id', store.id).select().single();
    if (error) throw error;
    return data;
};

export const deleteStore = async (storeId: string): Promise<void> => {
    // This assumes RLS and cascades are set up correctly in Supabase.
    // Manually deleting users first is safer if cascades aren't guaranteed.
    const { error: userError } = await supabase.from('users').delete().eq('storeId', storeId);
    if(userError) console.error("Error deleting users for store:", userError);

    const { error: storeError } = await supabase.from('stores').delete().eq('id', storeId);
    if (storeError) throw storeError;
};

export const verifyAndActivateStoreWithCode = async (storeId: string, code: string): Promise<boolean> => {
    if (!code.startsWith('PERM-')) return false;
    
    try {
        const decoded = atob(code.substring(5));
        const [decodedStoreId, secret] = decoded.split('::');
        
        if (decodedStoreId === storeId && secret === MASTER_SECRET_KEY) {
            await supabase.from('stores').update({
                isActive: true,
                trialStartDate: null, // Mark as permanently licensed
                trialDurationDays: 0
            }).eq('id', storeId);
            return true;
        }
    } catch (e) {
        console.error("Activation code decoding failed", e);
        return false;
    }
    return false;
};

// User functions
export const getAllUsers = async (): Promise<User[]> => {
    const { data, error } = await supabase.from('users').select('*');
    if (error) throw error;
    return data || [];
};

export const getAdminUserForStore = async (storeId: string): Promise<User | null> => {
    const { data, error } = await supabase.from('users').select('*').eq('storeId', storeId).eq('role', 'admin').single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
};

export const addUser = async (user: Omit<User, 'id'>): Promise<User> => {
    const { data, error } = await supabase.from('users').insert(user).select().single();
    if (error) throw error;
    return data;
};

export const updateUser = async (user: User): Promise<User> => {
    const { data, error } = await supabase.from('users').update(user).eq('id', user.id).select().single();
    if (error) throw error;
    return data;
};

// Auth function
export const login = async (store: Store, secret: string): Promise<{ user: User; store: Store; }> => {
    if (!store.isActive) {
        throw new Error('storeDisabledError');
    }
    
    const { data: users, error } = await supabase.from('users').select('*').eq('storeId', store.id);
    if (error) throw error;

    const user = users.find(u => (u.role === 'admin' && u.password === secret) || (u.role === 'seller' && u.pin === secret));

    if (!user) {
        throw new Error('invalidCredentialsError');
    }

    return { user, store };
};
