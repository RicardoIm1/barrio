// Compatibilidad y limpieza de admin.html.
// No reemplaza la seguridad de Supabase/RLS. Solo evita trabajo innecesario en clientes normales.
(function () {
  'use strict';

  function rolActual() {
    try {
      const usuario = JSON.parse(localStorage.getItem('usuario') || 'null');
      return String(usuario?.rol || '').toLowerCase();
    } catch (_) {
      return '';
    }
  }

  function normalizarFechaEdicion() {
    const campo = document.getElementById('edit-fecha_evento');
    if (!campo || campo.type !== 'date') return;
    const valor = String(campo.value || '');
    if (valor.includes('T')) campo.value = valor.split('T')[0];
  }

  // El formulario puede ser rellenado por editarAviso() después de cargar este módulo.
  // Capturamos el setter de value únicamente para este input, conservando el comportamiento nativo.
  function protegerCampoFecha() {
    const campo = document.getElementById('edit-fecha_evento');
    if (!campo || campo.dataset.fechaNormalizada === '1') return;
    const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    if (!descriptor?.set || !descriptor?.get) return;
    Object.defineProperty(campo, 'value', {
      configurable: true,
      enumerable: descriptor.enumerable,
      get() { return descriptor.get.call(this); },
      set(valor) {
        const normalizado = this.type === 'date' && typeof valor === 'string' && valor.includes('T')
          ? valor.split('T')[0]
          : valor;
        descriptor.set.call(this, normalizado);
      }
    });
    campo.dataset.fechaNormalizada = '1';
    normalizarFechaEdicion();
  }

  function instalar() {
    protegerCampoFecha();

    // La pestaña de usuarios ya está protegida visualmente, pero este módulo
    // también evita una invocación pública accidental desde otros scripts.
    if (rolActual() !== 'admin' && typeof window.cargarUsuariosAdmin === 'function') {
      const original = window.cargarUsuariosAdmin;
      if (!original.__elBarrioNormalUserGuard) {
        const guardada = function () {
          if (rolActual() !== 'admin') return Promise.resolve();
          return original.apply(this, arguments);
        };
        guardada.__elBarrioNormalUserGuard = true;
        window.cargarUsuariosAdmin = guardada;
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', instalar, { once: true });
  } else {
    instalar();
  }

  // El modal puede crearse/reemplazarse dinámicamente.
  const observer = new MutationObserver(() => protegerCampoFecha());
  observer.observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(() => observer.disconnect(), 30000);
})();
