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

  window.elBarrioToast = toast;

  if (!window.__elBarrioAlertPatched) {
    window.alert = function (mensaje) {
      const texto = String(mensaje ?? '');
      const error = /error|no se pudo|fall|rechaz|requiere permisos|obligatorio/i.test(texto);
      toast(texto, error ? 'error' : 'ok');
    };
    window.__elBarrioAlertPatched = true;
  }

  function valorVerdadero(v) {
    return v === true || v === 'true' || v === 1 || v === '1';
  }

  function obtenerId(fila) {
    const match = (fila?.innerHTML || '').match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
    return match ? match[0] : null;
  }

  function obtenerAviso(id) {
    if (!Array.isArray(window.todosLosAvisos)) return null;
    return window.todosLosAvisos.find(function (a) { return String(a?.id) === String(id); }) || null;
  }

  function estiloBoton(boton, tipo, activo) {
    const estilos = {
      destacado: { fondo: activo ? 'rgba(212,160,67,.13)' : 'rgba(100,116,139,.08)', borde: activo ? 'rgba(212,160,67,.32)' : 'rgba(100,116,139,.18)', sombra: activo ? '0 2px 8px rgba(212,160,67,.12)' : 'none' },
      urgente: { fondo: activo ? 'rgba(220,70,70,.13)' : 'rgba(100,116,139,.08)', borde: activo ? 'rgba(220,70,70,.30)' : 'rgba(100,116,139,.18)', sombra: activo ? '0 2px 8px rgba(220,70,70,.12)' : 'none' },
      eliminar: { fondo: 'rgba(100,116,139,.07)', borde: 'rgba(100,116,139,.16)', sombra: 'none' }
    };
    const s = estilos[tipo] || estilos.eliminar;
    boton.style.setProperty('display', 'inline-flex', 'important');
    boton.style.setProperty('align-items', 'center', 'important');
    boton.style.setProperty('justify-content', 'center', 'important');
    boton.style.setProperty('width', '32px', 'important');
    boton.style.setProperty('min-width', '32px', 'important');
    boton.style.setProperty('max-width', '32px', 'important');
    boton.style.setProperty('height', '32px', 'important');
    boton.style.setProperty('padding', '0', 'important');
    boton.style.setProperty('margin', '0 2px', 'important');
    boton.style.setProperty('font-size', '15px', 'important');
    boton.style.setProperty('line-height', '1', 'important');
    boton.style.setProperty('border', '1px solid ' + s.borde, 'important');
    boton.style.setProperty('background', s.fondo, 'important');
    boton.style.setProperty('box-shadow', s.sombra, 'important');
    boton.style.setProperty('border-radius', '9px', 'important');
    boton.style.setProperty('cursor', 'pointer', 'important');
    boton.style.setProperty('transition', 'background .15s ease, border-color .15s ease, transform .15s ease', 'important');
    boton.onmouseenter = function () { boton.style.transform = 'translateY(-1px)'; };
    boton.onmouseleave = function () { boton.style.transform = 'translateY(0)'; };
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
      estiloBoton(boton, 'destacado', /quitar/.test(texto));
    } else if (/urgent/.test(texto)) {
      boton.textContent = '⚠️';
      boton.title = /quitar/.test(texto) ? 'Quitar urgente' : 'Marcar como urgente';
      boton.setAttribute('aria-label', boton.title);
      estiloBoton(boton, 'urgente', /quitar/.test(texto));
    } else if (/eliminar|borrar|delete/.test(texto)) {
      boton.textContent = '🗑️';
      boton.title = 'Eliminar aviso';
      boton.setAttribute('aria-label', boton.title);
      estiloBoton(boton, 'eliminar', false);
    } else {
      return;
    }
  }

  function crearUrgente(fila, id, aviso) {
    const acciones = fila.querySelector('td:last-child');
    if (!acciones || !id || !aviso) return;
    let cont = acciones.querySelector('.acciones-botones');
    if (!cont) {
      cont = document.createElement('div');
      cont.className = 'acciones-botones';
      cont.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:2px;';
      while (acciones.firstChild) cont.appendChild(acciones.firstChild);
      acciones.appendChild(cont);
    }

    if (cont.querySelector('[data-admin-urgente="1"]')) return;

    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'boton boton-chico accion-btn-urgente';
    boton.dataset.adminUrgente = '1';
    boton.textContent = '⚠️';
    boton.title = valorVerdadero(aviso.urgente) ? 'Quitar urgente' : 'Marcar como urgente';
    boton.setAttribute('aria-label', boton.title);
    estiloBoton(boton, 'urgente', valorVerdadero(aviso.urgente));

    boton.addEventListener('click', async function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (!window.API || typeof window.API.peticion !== 'function') {
        toast('No está disponible la API de administración.', 'error');
        return;
      }
      const actual = obtenerAviso(id);
      const nuevo = !valorVerdadero(actual?.urgente);
      boton.disabled = true;
      try {
        const r = await window.API.peticion('ACTUALIZAR', {
          coleccion: 'AVISOS',
          id: id,
          datos: { urgente: nuevo }
        }, localStorage.getItem('api_key'));
        if (!r?.success) throw new Error(r?.error || 'No se pudo actualizar.');
        if (actual) actual.urgente = nuevo;
        boton.textContent = '⚠️';
        boton.title = nuevo ? 'Quitar urgente' : 'Marcar como urgente';
        boton.setAttribute('aria-label', boton.title);
        estiloBoton(boton, 'urgente', nuevo);
        toast(nuevo ? 'Aviso marcado como urgente.' : 'Urgente desactivado.');
      } catch (error) {
        console.error('Error actualizando urgente:', error);
        toast('No se pudo actualizar Urgente.', 'error');
      } finally {
        boton.disabled = false;
      }
    });

    cont.appendChild(boton);
  }

  function prepararFila(fila) {
    if (!fila || fila.dataset.adminUiReady === '1') return;
    const acciones = fila.querySelector('td:last-child');
    const id = obtenerId(fila);
    const aviso = obtenerAviso(id);
    if (!id || !aviso) return;
    fila.dataset.adminUiReady = '1';
    fila.style.border = '';
    fila.style.borderRadius = '';
    fila.style.boxShadow = '';
    fila.style.transform = '';
    fila.style.transition = '';

    if (acciones) {
      acciones.style.whiteSpace = 'nowrap';
      acciones.style.textAlign = 'center';
      acciones.style.verticalAlign = 'middle';
      let cont = acciones.querySelector('.acciones-botones');
      if (!cont) {
        cont = document.createElement('div');
        cont.className = 'acciones-botones';
        cont.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:2px;';
        while (acciones.firstChild) cont.appendChild(acciones.firstChild);
        acciones.appendChild(cont);
      }
      cont.querySelectorAll('button').forEach(function (boton) {
        compactarBoton(boton);
        boton.addEventListener('click', function (e) { e.stopPropagation(); });
      });
      crearUrgente(fila, id, aviso);
    }

    fila.querySelectorAll('select, input, textarea, a, button').forEach(function (el) {
      el.addEventListener('click', function (e) { e.stopPropagation(); });
    });
    fila.addEventListener('click', function () {
      if (id && typeof window.editarAviso === 'function') window.editarAviso(id);
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
