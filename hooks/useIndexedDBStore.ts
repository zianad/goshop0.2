import { useState, useEffect, useCallback } from 'react';
import type { StoreTypeMap } from '../types.ts';

const DB_NAME = 'pos-app-db';
const DB_VERSION = 2;

type StoreName = keyof StoreTypeMap;

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      Object.keys({
        products: [], productVariants: [], sales: [], expenses: [], users: [],
        returns: [], stores: [], customers: [], suppliers: [], categories: [],
        purchases: [], stockBatches: []
      } as StoreTypeMap).forEach(storeName => {
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, { keyPath: 'id' });
        }
      });
    };
  });
};

export function useIndexedDBStore<T extends { id: string }>(storeName: StoreName) {
  const [data, setData] = useState<T[]>([]);

  const getStore = useCallback(async (mode: IDBTransactionMode) => {
    const db = await openDB();
    return db.transaction(storeName, mode).objectStore(storeName);
  }, [storeName]);

  const getAll = useCallback(async () => {
    const store = await getStore('readonly');
    const request = store.getAll();
    return new Promise<T[]>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }, [getStore]);

  useEffect(() => {
    getAll().then(setData).catch(console.error);
  }, [getAll]);

  const add = useCallback(async (item: T) => {
    const store = await getStore('readwrite');
    const request = store.add(item);
    return new Promise<void>((resolve, reject) => {
      request.onsuccess = () => {
        setData(prev => [...prev, item]);
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }, [getStore]);

  const bulkAdd = useCallback(async (items: T[]) => {
      if (items.length === 0) return;
      const store = await getStore('readwrite');
      const transaction = store.transaction;
      items.forEach(item => store.add(item));
      
      return new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => {
            setData(prev => [...prev, ...items]);
            resolve();
        };
        transaction.onerror = () => reject(transaction.error);
      });
  }, [getStore]);

  const update = useCallback(async (item: T) => {
    const store = await getStore('readwrite');
    const request = store.put(item);
    return new Promise<void>((resolve, reject) => {
        request.onsuccess = () => {
            setData(prev => prev.map(d => d.id === item.id ? item : d));
            resolve();
        };
        request.onerror = () => reject(request.error);
    });
  }, [getStore]);

  const remove = useCallback(async (id: string) => {
    const store = await getStore('readwrite');
    const request = store.delete(id);
    return new Promise<void>((resolve, reject) => {
        request.onsuccess = () => {
            setData(prev => prev.filter(d => d.id !== id));
            resolve();
        };
        request.onerror = () => reject(request.error);
    });
  }, [getStore]);

  const clear = useCallback(async () => {
    const store = await getStore('readwrite');
    const request = store.clear();
    return new Promise<void>((resolve, reject) => {
        request.onsuccess = () => {
            setData([]);
            resolve();
        };
        request.onerror = () => reject(request.error);
    });
  }, [getStore]);

  return { data, setData, add, update, remove, clear, bulkAdd };
}