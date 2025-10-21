import { createClient, SupabaseClient } from '@supabase/supabase-js';

// INSTRUCTIONS (FR):
// 1. Allez sur votre tableau de bord Supabase: https://supabase.com/dashboard/project/_/settings/api
// 2. Copiez l'URL de votre projet (Project URL) et collez-la ci-dessous à la place de "VOTRE_URL_SUPABASE_ICI".
// 3. Copiez votre clé API "anon" publique (Project API Keys -> anon public) et collez-la ci-dessous à la place de "VOTRE_CLÉ_ANON_SUPABASE_ICI".

// INSTRUCTIONS (AR):
// ١. اذهب إلى لوحة تحكم مشروعك على Supabase: https://supabase.com/dashboard/project/_/settings/api
// ٢. انسخ "رابط المشروع" (Project URL) وألصقه في السطر التالي بدلاً من "VOTRE_URL_SUPABASE_ICI".
// ٣. انسخ مفتاح "anon" العام (Project API Keys -> anon public) وألصقه في السطر التالي بدلاً من "VOTRE_CLÉ_ANON_SUPABASE_ICI".

const supabaseUrl: string = "https://kclntdmvpeykknjnndeb.supabase.co";
const supabaseAnonKey: string = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjbG50ZG12cGV5a2tuam5uZGViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1OTk0MjEsImV4cCI6MjA3NTE3NTQyMX0.O49_JCNUZxPlp6EAqbZHUpJWYJGFBl63QsnmBICyphI";


/**
 * Checks if the Supabase credentials seem valid.
 * This is a basic check to ensure they are not placeholder empty strings.
 * @returns {boolean} True if credentials appear to be set, false otherwise.
 */
export function areSupabaseCredentialsSet(): boolean {
  // A real Supabase anon key is a JWT and typically starts with "eyJ".
  // The placeholder values will fail this check.
  return !!(
    supabaseUrl && 
    supabaseUrl.startsWith('http') && 
    supabaseAnonKey && 
    supabaseAnonKey.startsWith('eyJ')
  );
}

const initializeSupabase = (): SupabaseClient => {
  if (areSupabaseCredentialsSet()) {
    return createClient(supabaseUrl, supabaseAnonKey);
  }

  // This block will execute if the credentials are not set correctly.
  // It provides a clear error in the console and a mock Supabase client to prevent crashes.
  const errorMessage = `
  ********************************************************************************
  * ERREUR DE CONFIGURATION SUPABASE :                                           *
  * Les informations de connexion à Supabase ne sont pas configurées.            *
  * Veuillez modifier le fichier 'supabaseClient.ts' et ajouter votre URL        *
  * et votre clé 'anon' publique.                                                *
  *                                                                              *
  * خطأ في إعدادات SUPABASE:                                                       *
  * بيانات الاتصال بـ Supabase غير مهيأة.                                          *
  * الرجاء تعديل ملف 'supabaseClient.ts' وإضافة رابط المشروع ومفتاح 'anon' العام. *
  ********************************************************************************
  `;
  console.error(errorMessage);
  
  // Return a mock client to prevent the app from crashing entirely.
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