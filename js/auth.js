console.log('🔵 auth.js cargando...');

```javascript
// ==================== AUTH ====================

const Auth = {

  // 🔐 Login con Supabase Auth
  async login(email, password) {
    try {

      // 1. Autenticar contra Supabase Auth
      const { data: authData, error: authError } =
        await supabaseClient.auth.signInWithPassword({
          email: email,
          password: password
        });

      if (authError) {
        console.error('Error Supabase Auth:', authError);
        throw new Error('Credenciales inválidas');
      }

      if (!authData || !authData.user) {
        throw new Error('No se pudo obtener el usuario autenticado');
      }

      // 2. Obtener el perfil correspondiente desde public.usuarios
      const { data: usuario, error: usuarioError } =
        await supabaseClient
          .from('usuarios')
          .select('id, email, nombre, rol')
          .eq('id', authData.user.id)
          .single();

      if (usuarioError) {
        console.error('Error obteniendo perfil:', usuarioError);

        // Cerramos la sesión si existe Auth pero no encontramos
        // el registro correspondiente en public.usuarios.
        await supabaseClient.auth.signOut();

        throw new Error('No se encontró el perfil del usuario');
      }

      // 3. Mantener temporalmente el usuario en localStorage
      // para no romper el resto del frontend durante la migración.
      localStorage.setItem(
        'usuario',
        JSON.stringify(usuario)
      );

      // 4. Guardamos también el access token temporalmente
      // para compatibilidad durante la transición.
      if (authData.session?.access_token) {
        localStorage.setItem(
          'access_token',
          authData.session.access_token
        );
      }

      // 5. Avisamos al resto de la aplicación
      window.dispatchEvent(
        new CustomEvent('auth-change', {
          detail: {
            usuario: usuario
          }
        })
      );

      window.dispatchEvent(new Event('storage'));

      console.log('✅ Login Supabase exitoso:', usuario);

      // Mantenemos una estructura compatible con el código actual.
      return {
        usuario: usuario,
        session: authData.session,
        user: authData.user
      };

    } catch (error) {

      console.error('Error en login:', error);
      throw error;

    }
  },


  // 🚪 Logout con Supabase
  async logout() {

    try {

      const { error } =
        await supabaseClient.auth.signOut();

      if (error) {
        console.error('Error cerrando sesión Supabase:', error);
      }

    } catch (error) {

      console.error('Error en logout:', error);

    } finally {

      // Limpiamos los datos locales
      localStorage.removeItem('usuario');
      localStorage.removeItem('api_key');
      localStorage.removeItem('access_token');

      // Avisamos al resto de la aplicación
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(
        new CustomEvent('auth-change', {
          detail: {
            usuario: null
          }
        })
      );
    }
  },


  // 👤 Usuario actual
  getUsuario() {

    const raw = localStorage.getItem('usuario');

    try {

      return raw ? JSON.parse(raw) : null;

    } catch (e) {

      localStorage.removeItem('usuario');
      return null;

    }
  },


  // ✅ ¿Hay sesión?
  isLoggedIn() {
    return !!this.getUsuario();
  },


  // 🛡️ Protección básica
  requireAuth(redirect = '/login.html') {

    const usuario = this.getUsuario();

    if (!usuario) {
      window.location.href = redirect;
      return null;
    }

    return usuario;
  },


  // 👑 Protección por rol
  requireRole(rol, redirect = '/index.html') {

    const usuario = this.requireAuth();

    if (!usuario) return null;

    if (usuario.rol !== rol) {
      window.location.href = redirect;
      return null;
    }

    return usuario;
  }

};
```
