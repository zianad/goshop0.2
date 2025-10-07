import { createClient, SupabaseClient } from '@supabase/supabase-js';

// L'URL de votre projet Supabase. Vous la trouverez dans le tableau de bord de votre projet Supabase -> Paramètres du projet -> API.
const supabaseUrl: string = "https://kclntdmvpeykknjnndeb.supabase.co";

// --- IMPORTANT : AJOUTEZ VOTRE CLÉ API ICI ---
// Remplacez la chaîne de caractères ci-dessous par votre clé 'anon' publique Supabase (PAS la clé 'publishable').
// Vous pouvez la trouver dans le tableau de bord de votre projet Supabase -> Paramètres du projet -> API.
// La clé est une longue chaîne de caractères qui commence par "eyJ...".
const supabaseAnonKey: string = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjbG50ZG12cGV5a2tuam5uZGViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1OTk0MjEsImV4cCI6MjA3NTE3NTQyMX0.O49_JCNUZxPlp6EAqbZHUpJWYJGFBl63QsnmBICyphI";


/**
 * Checks if the Supabase credentials seem valid.
 * This is a basic check to ensure they are not placeholder empty strings.
 * @returns {boolean} True if credentials appear to be set, false otherwise.
 */
export function areSupabaseCredentialsSet(): boolean {
  // A Supabase anon key is a JWT and typically starts with "eyJ".
  // The placeholder is intentionally not a valid key.
  return !!(supabaseUrl && supabaseUrl.startsWith('http') && supabaseAnonKey && supabaseAnonKey.startsWith('eyJ'));
}

const initializeSupabase = (): SupabaseClient => {
  if (areSupabaseCredentialsSet()) {
    return createClient(supabaseUrl, supabaseAnonKey);
  }

  // This block will execute if the credentials are not set correctly.
  // It provides a clear error in the console and a mock Supabase client to prevent crashes.
  console.error("Supabase credentials are not set correctly in supabaseClient.ts! Please provide a valid URL and public anon key.");
  return new Proxy({}, {
    get: (target, prop) => {
      if (prop === 'channel') {
          return () => ({
              on: () => ({ 
                  subscribe: () => ({
                      unsubscribe: () => Promise.resolve('ok')
                  }) 
              }),
          });
      }
      if (prop === 'removeChannel') {
          return () => {};
      }
      if (prop === 'from') {
        return () => new Proxy({}, {
          get: () => () => Promise.resolve({ data: [], error: { message: 'Supabase not configured' }})
        });
      }
      return () => {};
    }
  }) as SupabaseClient;
};


export const supabase = initializeSupabase();