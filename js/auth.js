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

    return data;
  }

};