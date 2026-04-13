// ==================== AUTENTICACIÓN ====================

document.addEventListener('DOMContentLoaded', function () {
  // Verificar si hay usuario logueado para el link de login
  const usuario = API.getUsuarioActual();
  const loginLink = document.getElementById('login-link');
  if (loginLink) {
    if (usuario) {
      loginLink.textContent = usuario.nombre || 'Mi cuenta';
      loginLink.href = '/avisos-jardines/admin.html';

      if (cerrarSesion) cerrarSesion.style.display = 'inline';
    } else {
      loginLink.textContent = 'Iniciar sesión';
      loginLink.href = '/avisos-jardines/login.html';

      if (cerrarSesion) cerrarSesion.style.display = 'none';
    }
  }

  // Formulario de login
  const formLogin = document.getElementById('form-login');
  if (formLogin) {
    formLogin.addEventListener('submit', async function (e) {
      e.preventDefault();

      const email = document.getElementById('email');
      const password = document.getElementById('password');

      // Verificar que los elementos existen
      if (!email || !password) {
        API.mostrarError('Error en el formulario');
        return;
      }

      const emailValue = email.value.trim();
      const passwordValue = password.value;

      if (!emailValue || !passwordValue) {
        API.mostrarError('Completa todos los campos');
        return;
      }

      try {
        const resultado = await API.login(emailValue, passwordValue);
        if (resultado && resultado.api_key) {
          API.mostrarExito('Sesión iniciada correctamente');
          setTimeout(() => {
            window.location.href = '/avisos-jardines/admin.html';
          }, 1500);
        }
      } catch (error) {
        API.mostrarError('Credenciales incorrectas: ' + error.message);
      }
    });
  }

  // Cerrar sesión
  const cerrarSesion = document.getElementById('cerrar-sesion');
  if (cerrarSesion) {
    cerrarSesion.addEventListener('click', function (e) {
      e.preventDefault();
      API.logout();
      window.location.href = '/avisos-jardines/index.html';
    });
  }
});

// ==================== NOTIFICACIONES ====================
async function activarNotificaciones() {
  if (!('Notification' in window)) {
    API.mostrarError('Tu navegador no soporta notificaciones');
    return;
  }

  const permiso = await Notification.requestPermission();
  if (permiso === 'granted') {
    API.mostrarExito('Notificaciones activadas');
  } else {
    API.mostrarError('Permiso denegado para notificaciones');
  }
}

function inicializarHeaderAuth() {
  const usuario = API.getUsuarioActual();
  const loginLink = document.getElementById('login-link');
  const cerrarSesion = document.getElementById('cerrar-sesion');

  if (loginLink) {
    if (usuario) {
      loginLink.textContent = usuario.nombre || 'Mi cuenta';
      loginLink.href = '/avisos-jardines/admin.html';

      if (cerrarSesion) cerrarSesion.style.display = 'inline';
    } else {
      loginLink.textContent = 'Iniciar sesión';
      loginLink.href = '/avisos-jardines/login.html';

      if (cerrarSesion) cerrarSesion.style.display = 'none';
    }
  }

  if (cerrarSesion) {
    cerrarSesion.addEventListener('click', function(e) {
      e.preventDefault();
      API.logout();
      window.location.href = '/avisos-jardines/index.html';
    });
  }
}