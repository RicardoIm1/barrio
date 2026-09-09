// ADMIN-PROMOCIONES.JS
// UI compacta para acciones de avisos. Sin consultas adicionales ni observadores.
(function () {
  'use strict';

  function toast(mensaje, tipo) {
    let c = document.getElementById('elbarrio-toast-container');
    if (!c) {
      c = document.createElement('div');
      c.id = 'elbarrio-toast-container';
      c.style.cssText = 'position:fixed;right:20px;bottom:20px;z-index:99999;display:flex;flex-direction:column;gap:8px;pointer-events:none;max-width:420px;';
      document.body.appendChild(c);
    }
    const t = document.createElement('div');
    t.textContent = String(mensaje ?? '');
    t.style.cssText = 'padding:10px 14px;border-radius:10px;background:' + (tipo === 'error' ? '#aa2d2d' : '#1e242a') + ';color:#fff;box-shadow:0 6px 20px rgba(0,0,0,.18);font:600 13px system-ui,sans-serif;opacity:0;transition:opacity .15s ease;';
    c.appendChild(t);
    requestAnimationFrame(function () { t.style.opacity = '1'; });
    setTimeout(function () { t.style.opacity = '0'; setTimeout(function () { t.remove(); }, 180); }, 2200);
  }

  if (!window.__elBarrioAlertPatched) {
    window.alert = function (mensaje) {
      const texto = String(mensaje ?? '');
      const error = /error|no se pudo|fall|rechaz|requiere permisos|obligatorio/i.test(texto);
      toast(texto, error ? 'error' : 'ok');
    };
    window.__elBarrioAlertPatched = true;
  }

  function compactarBoton(boton) {
    const texto = ((boton.textContent || '') + ' ' + (boton.title || '') + ' ' + (boton.getAttribute('aria-label') || '')).toLowerCase();
    if (/editar|edit(ar| aviso)?/.test(texto)) {
      boton.style.setProperty('display', 'none', 'important');
      return;
    }

    if (/destac/.test(texto)) {
      boton.textContent = '⭐';
      boton.title = /quitar/.test(texto) ? 'Quitar destacado' : 'Marcar como destacado';
      boton.setAttribute('aria-label', boton.title);
    } else if (/urgent/.test(texto)) {
      boton.textContent = '⚠️';
      boton.title = /quitar/.test(texto) ? 'Quitar urgente' : 'Marcar como urgente';
      boton.setAttribute('aria-label', boton.title);
    } else if (/eliminar|borrar|delete/.test(texto)) {
      boton.textContent = '🗑️';
      boton.title = 'Eliminar aviso';
      boton.setAttribute('aria-label', boton.title);
    } else {
      return;
    }

    boton.style.setProperty('display', 'inline-flex', 'important');
    boton.style.setProperty('align-items', 'center', 'important');
    boton.style.setProperty('justify-content', 'center', 'important');
    boton.style.setProperty('width', '30px', 'important');
    boton.style.setProperty('min-width', '30px', 'important');
    boton.style.setProperty('max-width', '30px', 'important');
    boton.style.setProperty('height', '30px', 'important');
    boton.style.setProperty('padding', '0', 'important');
    boton.style.setProperty('margin', '0', 'important');
    boton.style.setProperty('font-size', '1rem', 'important');
    boton.style.setProperty('line-height', '1', 'important');
    boton.style.setProperty('border', '0', 'important');
    boton.style.setProperty('background', 'transparent', 'important');
    boton.style.setProperty('box-shadow', 'none', 'important');
    boton.style.setProperty('border-radius', '7px', 'important');
  }

  function prepararFila(fila) {
    if (!fila || fila.dataset.adminUiReady === '1') return;
    fila.dataset.adminUiReady = '1';

    fila.style.border = '';
    fila.style.borderRadius = '';
    fila.style.boxShadow = '';
    fila.style.transform = '';
    fila.style.transition = '';

    const acciones = fila.querySelector('td:last-child');
    if (acciones) {
      acciones.style.whiteSpace = 'nowrap';
      acciones.style.textAlign = 'center';
      acciones.style.verticalAlign = 'middle';
      acciones.querySelectorAll('button').forEach(function (boton) {
        compactarBoton(boton);
        boton.addEventListener('click', function (e) { e.stopPropagation(); });
      });
    }

    fila.querySelectorAll('select, input, textarea, a, button').forEach(function (el) {
      el.addEventListener('click', function (e) { e.stopPropagation(); });
    });

    fila.addEventListener('click', function () {
      const html = fila.innerHTML || '';
      const match = html.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
      if (match && typeof window.editarAviso === 'function') {
        window.editarAviso(match[0]);
      }
    });
  }

  function prepararTabla() {
    document.querySelectorAll('.tabla-admin tbody tr').forEach(prepararFila);
  }

  let intentos = 0;
  const intervalo = setInterval(function () {
    prepararTabla();
    intentos++;
    if (intentos >= 30) clearInterval(intervalo);
  }, 300);

  document.addEventListener('DOMContentLoaded', prepararTabla);
})();
