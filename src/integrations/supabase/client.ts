import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const supabaseUrl = "https://sghfarqdducpbuatthyh.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNnaGZhcnFkZHVjcGJ1YXR0aHloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzI1NzE3NzcsImV4cCI6MjA0ODE0Nzc3N30.cNTNRE_npTnRRyXvX8K81yy_hjH2Cl0AmsaIVUZgeJA";

export const supabase = createClient<Database>(supabaseUrl, supabaseKey);