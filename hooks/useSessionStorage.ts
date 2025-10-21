import { useState, useEffect, Dispatch, SetStateAction } from 'react';

function getValue<T>(key: string, initialValue: T | (() => T)) {
  const savedValue = sessionStorage.getItem(key);
  if (savedValue) {
    try {
      return JSON.parse(savedValue);
    } catch (error) {
      console.error('Error parsing JSON from sessionStorage', error);
      sessionStorage.removeItem(key);
    }
  }

  if (initialValue instanceof Function) return initialValue();
  return initialValue;
}

export function useSessionStorage<T>(key: string, initialValue: T | (() => T)): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    return getValue(key, initialValue);
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error('Error setting item to sessionStorage', error);
    }
  }, [key, value]);

  return [value, setValue];
}