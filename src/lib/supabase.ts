import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('As credenciais do Supabase não foram encontradas no arquivo .env');
}

// Cria a instância de conexão única que usaremos em todo o app
export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');