// ==================== AUTH ====================

document.addEventListener('DOMContentLoaded', function() {
  // Verificar si hay usuario autenticado
  const usuario = API.getUsuarioActual();
  const loginLink = document.getElementById('login-link');
  
  if (usuario && loginLink) {
    loginLink.textContent = `Hola, ${usuario.nombre}`;
    loginLink.href = '/avisos-jardines/admin.html';
  }
});

// Función para iniciar sesión (llamar desde formulario)
async function iniciarSesion(email, password) {
  try {
    const resultado = await API.login(email, password);
    
    if (resultado && resultado.usuario) {
      API.mostrarExito(`Bienvenido ${resultado.usuario.nombre}`);
      
      // Redirigir según rol
      if (resultado.usuario.rol === 'admin') {
        window.location.href = '/avisos-jardines/admin.html';
      } else {
        window.location.href = '/avisos-jardines/index.html';
      }
    }
  } catch (error) {
    console.error('Error en login:', error);
    API.mostrarError('Credenciales incorrectas');
  }
}

// Función para cerrar sesión
function cerrarSesion() {
  API.logout();
  window.location.href = '/avisos-jardines/index.html';
}