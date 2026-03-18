// ==================== AUTENTICACIÓN ====================

document.addEventListener('DOMContentLoaded', function() {
  // Verificar si hay sesión activa
  const usuario = API.getUsuarioActual();
  const loginLink = document.getElementById('login-link');
  
  if (loginLink) {
    if (usuario) {
      loginLink.textContent = usuario.nombre || 'Mi cuenta';
      loginLink.href = 'admin.html';
    } else {
      loginLink.textContent = 'Iniciar sesión';
      loginLink.href = 'login.html';
    }
  }
  
  // Formulario de login
  const formLogin = document.getElementById('form-login');
  if (formLogin) {
    formLogin.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      const email = document.getElementById('email').value;
      const clave = document.getElementById('clave').value;
      
      try {
        const resultado = await API.login(email, clave);
        API.mostrarExito('Sesión iniciada correctamente');
        setTimeout(() => {
          window.location.href = 'admin.html';
        }, 1000);
      } catch(error) {
        // Error ya mostrado por API
      }
    });
  }
  
  // Cerrar sesión
  const cerrarSesion = document.getElementById('cerrar-sesion');
  if (cerrarSesion) {
    cerrarSesion.addEventListener('click', function(e) {
      e.preventDefault();
      API.logout();
      window.location.href = 'index.html';
    });
  }
});

// ==================== NOTIFICACIONES ====================

async function activarNotificaciones() {
  if (!('Notification' in window)) {
    API.mostrarError('Tu navegador no soporta notificaciones');
    return;
  }
  
  try {
    const permiso = await Notification.requestPermission();
    
    if (permiso === 'granted') {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: 'TU_CLAVE_VAPID' // Reemplazar
      });
      
      await API.guardarTokenFCM(
        JSON.stringify(subscription),
        navigator.userAgent
      );
      
      API.mostrarExito('Notificaciones activadas');
    } else {
      API.mostrarError('Permiso denegado para notificaciones');
    }
  } catch(error) {
    console.error('Error activando notificaciones:', error);
    API.mostrarError('Error al activar notificaciones');
  }
}