console.log('🔵 auth.js cargando...');

async function obtenerSupabaseClient() {
  if (typeof supabaseClient !== 'undefined' && supabaseClient) return supabaseClient;

  if (window.__elBarrioSupabaseClient) return window.__elBarrioSupabaseClient;

  if (!window.supabase) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      script.onload = resolve;
      script.onerror = () => reject(new Error('No se pudo cargar Supabase JS'));
      document.head.appendChild(script);
    });
  }

  const SUPABASE_URL = 'https://gnjaumpjerbbwlkcgxqa.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJ3b3RzZWFwZXJvY2h1c2VzZCIsInJlZiI6ImduamF1bXBqZXJiYndsa2NneHFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5MjQ5ODksImV4cCI6MjEwMzUwMDk4OX0.B6QRJN4gg1NuTmv-RyFBeWQaTmlFUoOYDZlkYaiFUjU';

  window.__elBarrioSupabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
  );

  console.log('✅ Cliente Supabase creado desde auth.js');
  return window.__elBarrioSupabaseClient;
}

const Auth = {
  async login(email, password) {
    console.log('🔵 Auth.login ejecutándose');
    const client = await obtenerSupabaseClient();
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    console.log('🔵 Resultado Supabase:', { data, error });
    if (error) throw error;

    const user = data?.user;
    const session = data?.session;

    if (user) {
      const usuarioCompatibilidad = {
        id: user.id,
        email: user.email,
        nombre: user.user_metadata?.nombre || user.user_metadata?.name || user.email?.split('@')[0] || 'Usuario',
        rol: user.user_metadata?.rol || user.app_metadata?.rol || 'usuario'
      };

      localStorage.setItem('usuario', JSON.stringify(usuarioCompatibilidad));
      if (session?.access_token) localStorage.setItem('api_key', session.access_token);
      console.log('🟢 Sesión Supabase reconocida por el panel:', usuarioCompatibilidad);
    }

    return data;
  },

  async requireAuth() {
    const client = await obtenerSupabaseClient();
    const { data, error } = await client.auth.getSession();

    if (error) {
      console.error('❌ Error comprobando sesión:', error);
      return null;
    }

    const session = data?.session;
    if (!session?.user) {
      console.warn('🔒 No existe sesión Supabase activa');
      return null;
    }

    const user = session.user;
    const usuario = {
      id: user.id,
      email: user.email,
      nombre: user.user_metadata?.nombre || user.user_metadata?.name || user.email?.split('@')[0] || 'Usuario',
      rol: user.user_metadata?.rol || user.app_metadata?.rol || 'usuario'
    };

    localStorage.setItem('usuario', JSON.stringify(usuario));
    localStorage.setItem('api_key', session.access_token);
    return usuario;
  },

  async logout() {
    const client = await obtenerSupabaseClient();
    const { error } = await client.auth.signOut();
    if (error) {
      console.error('❌ Error cerrando sesión:', error);
      throw error;
    }
    localStorage.removeItem('usuario');
    localStorage.removeItem('api_key');
    console.log('🔓 Sesión Supabase cerrada');
  }
};