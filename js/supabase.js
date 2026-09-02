// ==========================================================
// SUPABASE CLIENT
// ==========================================================

const SUPABASE_URL = 'https://gnjaumpjerbbwlkcgxqa.supabase.co';

const SUPABASE_ANON_KEY = 'sb_publishable_x01F_xzyh5b-sZdwhKh6FQ_OzQVxMpN';

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);

console.log('✅ Supabase conectado:', supabaseClient);