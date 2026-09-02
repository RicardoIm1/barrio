console.log('🔵 auth.js cargando...');

const Auth = {

  async login(email, password) {

    console.log('🔵 Auth.login ejecutándose');

    const { data, error } =
      await supabaseClient.auth.signInWithPassword({
        email,
        password
      });

    console.log('🔵 Resultado Supabase:', { data, error });

    if (error) {
      throw error;
    }

    // ==========================================================
    // COMPATIBILIDAD TEMPORAL CON EL PANEL ADMINISTRATIVO
    // La fuente de verdad sigue siendo Supabase Auth.
    // Estos datos permiten que el código antiguo del panel
    // reconozca la sesión mientras migramos API.js.
    // ==========================================================
    const user = data.user;
    const session = data.session;

    if (user) {
      const usuarioCompatibilidad = {
        id: user.id,
        email: user.email,
        nombre: user.user_metadata?.nombre || user.user_metadata?.name || user.email?.split('@')[0] || 'Usuario',
        rol: user.user_metadata?.rol || user.app_metadata?.rol || 'usuario'
      };

      localStorage.setItem(
        'usuario',
        JSON.stringify(usuarioCompatibilidad)
      );

      if (session?.access_token) {
        localStorage.setItem('api_key', session.access_token);
      }

      console.log('🟢 Sesión Supabase reconocida por el panel:', usuarioCompatibilidad);
    }

    return data;
  },

  async requireAuth() {
    const { data, error } = await supabaseClient.auth.getSession();

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

    // Mantener sincronizada la representación temporal del panel.
    localStorage.setItem('usuario', JSON.stringify(usuario));
    localStorage.setItem('api_key', session.access_token);

    return usuario;
  },

  async logout() {
    const { error } = await supabaseClient.auth.signOut();

    if (error) {
      console.error('❌ Error cerrando sesión:', error);
      throw error;
    }

    localStorage.removeItem('usuario');
    localStorage.removeItem('api_key');

    console.log('🔓 Sesión Supabase cerrada');
  }

};