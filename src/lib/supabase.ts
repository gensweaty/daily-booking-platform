import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Debug environment variables
console.log("Supabase URL:", supabaseUrl);
console.log("Supabase Anon Key:", supabaseAnonKey);

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce'
  },
  db: {
    schema: 'public'
  }
});

// Test connection and auth setup
const testConnection = async () => {
  try {
    const { data: authData } = await supabase.auth.getSession();
    console.log("Auth session test:", authData);
    
    const { data, error } = await supabase.from('profiles').select('*').limit(1);
    console.log("Supabase connection test:", { data, error });
    
    if (error) {
      console.error("Database connection error:", error);
    }
  } catch (err) {
    console.error("Supabase connection/auth error:", err);
  }
};

testConnection();