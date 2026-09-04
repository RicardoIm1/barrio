// ==========================================================
// SUPABASE CLIENT
// ==========================================================

const SUPABASE_URL = 'https://gnjaumpjerbbwlkcgxqa.supabase.co';

const SUPABASE_ANON_KEY = 'sb_publishable_x01F_xzyh5b-sZdwhKh6FQ_OzQVxMpN';

// Una sola instancia compartida por toda la aplicación.
const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);

window.__elBarrioSupabaseClient = supabaseClient;
window.supabaseClient = supabaseClient;

console.log('✅ Supabase conectado:', supabaseClient);