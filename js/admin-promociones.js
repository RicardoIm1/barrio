// ADMIN-PROMOCIONES.JS
// Acciones compactas de avisos: urgente, destacado y eliminar.
(function () {
  'use strict';

  const avisosCache = new Map();

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
    setTimeout(function () {
      t.style.opacity = '0';
      setTimeout(function () { t.remove(); }, 180);
    }, 2200);
  }

  window.elBarrioToast = toast;

  // Las acciones legacy de admin.js usan alert(). Lo convertimos en UNA sola toast.
  window.alert = function (mensaje) {
    const texto = String(mensaje ?? '');
    const error = /error|no se pudo|fall|rechaz|requiere permisos|obligatorio/i.test(texto);
    toast(texto, error ? 'error' : 'ok');
  };

  function valorVerdadero(v) {
    return v === true || v === 'true' || v === 'TRUE' || v === 1 || v === '1';
  }

  function obtenerId(fila) {
    if (fila?.dataset?.id) return String(fila.dataset.id);
    const match = (fila?.innerHTML || '').match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
    return match ? match[0] : null;
  }

  function cargarEstados() {
    if (!window.API || typeof window.API.peticion !== 'function') return;
    window.API.peticion('LISTAR_TODOS_AVISOS', {}, localStorage.getItem('api_key'))
      .then(function (respuesta) {
        let lista = [];
        if (respuesta?.data?.datos && Array.isArray(respuesta.data.datos)) lista = respuesta.data.datos;
        else if (respuesta?.data && Array.isArray(respuesta.data)) lista = respuesta.data;
        else if (respuesta?.datos && Array.isArray(respuesta.datos)) lista = respuesta.datos;
        lista.forEach(function (aviso) {
          if (aviso?.id) avisosCache.set(String(aviso.id), aviso);
        });
        prepararTabla();
      })
      .catch(function (error) {
        console.warn('No se pudieron cargar los estados de acciones:', error);
      });
  }

  function estiloBoton(boton, tipo, activo) {
    const estado = activo ? 'activo' : 'inactivo';
    boton.dataset.estado = estado;
    boton.style.setProperty('display', 'inline-flex', 'important');
    boton.style.setProperty('align-items', 'center', 'important');
    boton.style.setProperty('justify-content', 'center', 'important');
    boton.style.setProperty('width', '34px', 'important');
    boton.style.setProperty('min-width', '34px', 'important');
    boton.style.setProperty('max-width', '34px', 'important');
    boton.style.setProperty('height', '34px', 'important');
    boton.style.setProperty('padding', '0', 'important');
    boton.style.setProperty('margin', '0 2px', 'important');
    boton.style.setProperty('font-size', '16px', 'important');
    boton.style.setProperty('line-height', '1', 'important');
    boton.style.setProperty('border-radius', '9px', 'important');
    boton.style.setProperty('cursor', 'pointer', 'important');
    boton.style.setProperty('transition', 'all .15s ease', 'important');

    if (tipo === 'destacado') {
      boton.style.setProperty('background', activo ? '#fff3cd' : '#f8fafc', 'important');
      boton.style.setProperty('border', activo ? '1.5px solid #d4a043' : '1px solid #d7dde5', 'important');
      boton.style.setProperty('box-shadow', activo ? '0 2px 8px rgba(212,160,67,.20)' : 'none', 'important');
      boton.style.setProperty('opacity', activo ? '1' : '.55', 'important');
    } else if (tipo === 'urgente') {
      boton.style.setProperty('background', activo ? '#ffe5e5' : '#f8fafc', 'important');
      boton.style.setProperty('border', activo ? '1.5px solid #dc4646' : '1px solid #d7dde5', 'important');
      boton.style.setProperty('box-shadow', activo ? '0 2px 8px rgba(220,70,70,.20)' : 'none', 'important');
      boton.style.setProperty('opacity', activo ? '1' : '.55', 'important');
    } else {
      boton.style.setProperty('background', '#f8fafc', 'important');
      boton.style.setProperty('border', '1px solid #d7dde5', 'important');
      boton.style.setProperty('box-shadow', 'none', 'important');
      boton.style.setProperty('opacity', '1', 'important');
    }

    boton.onmouseenter = function () { boton.style.transform = 'translateY(-1px)'; };
    boton.onmouseleave = function () { boton.style.transform = 'translateY(0)'; };
  }

  function prepararBotonExistente(boton) {
    const texto = ((boton.textContent || '') + ' ' + (boton.title || '') + ' ' + (boton.getAttribute('aria-label') || '')).toLowerCase();

    if (/editar|edit(ar| aviso)?/.test(texto)) {
      boton.style.setProperty('display', 'none', 'important');
      return;
    }

    if (/destac/.test(texto)) {
      const activo = /quitar/.test(texto);
      boton.textContent = '⭐';
      boton.title = activo ? 'Quitar destacado' : 'Marcar como destacado';
      boton.setAttribute('aria-label', boton.title);
      estiloBoton(boton, 'destacado', activo);
      return;
    }

    if (/eliminar|borrar|delete/.test(texto)) {
      boton.textContent = '🗑️';
      boton.title = 'Eliminar aviso';
      boton.setAttribute('aria-label', boton.title);
      estiloBoton(boton, 'eliminar', false);
    }
  }

  function crearUrgente(fila, id, aviso) {
    const acciones = fila.querySelector('td:last-child');
    if (!acciones || !id || !aviso) return;

    let cont = acciones.querySelector('.acciones-botones');
    if (!cont) {
      cont = document.createElement('div');
      cont.className = 'acciones-botones';
      acciones.appendChild(cont);
    }
    cont.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:2px;';

    let boton = cont.querySelector('[data-admin-urgente="1"]');
    if (!boton) {
      boton = document.createElement('button');
      boton.type = 'button';
      boton.className = 'accion-btn accion-btn-urgente';
      boton.dataset.adminUrgente = '1';
      boton.textContent = '⚠️';
      cont.insertBefore(boton, cont.lastElementChild || null);

      boton.addEventListener('click', async function (e) {
        e.preventDefault();
        e.stopPropagation();
        const actual = avisosCache.get(String(id)) || aviso;
        const nuevo = !valorVerdadero(actual?.urgente);
        boton.disabled = true;
        try {
          const r = await window.API.peticion('ACTUALIZAR', {
            coleccion: 'AVISOS',
            id: id,
            datos: { urgente: nuevo }
          }, localStorage.getItem('api_key'));
          if (!r?.success) throw new Error(r?.error || 'No se pudo actualizar.');
          actual.urgente = nuevo;
          avisosCache.set(String(id), actual);
          actualizarBotonUrgente(boton, nuevo);
          toast(nuevo ? 'Aviso marcado como urgente.' : 'Urgente desactivado.');
        } catch (error) {
          console.error('Error actualizando urgente:', error);
          toast('No se pudo actualizar Urgente.', 'error');
        } finally {
          boton.disabled = false;
        }
      });
    }

    actualizarBotonUrgente(boton, valorVerdadero(aviso.urgente));
  }

  function actualizarBotonUrgente(boton, activo) {
    boton.textContent = '⚠️';
    boton.title = activo ? 'Quitar urgente' : 'Marcar como urgente';
    boton.setAttribute('aria-label', boton.title);
    estiloBoton(boton, 'urgente', activo);
  }

  function prepararFila(fila) {
    if (!fila) return;
    const id = obtenerId(fila);
    if (!id) return;
    const aviso = avisosCache.get(String(id));
    if (!aviso) return;

    const acciones = fila.querySelector('td:last-child');
    if (!acciones) return;

    fila.style.border = '';
    fila.style.borderRadius = '';
    fila.style.boxShadow = '';
    fila.style.transform = '';
    fila.style.transition = '';
    fila.style.cursor = 'pointer';

    acciones.style.whiteSpace = 'nowrap';
    acciones.style.textAlign = 'center';
    acciones.style.verticalAlign = 'middle';

    let cont = acciones.querySelector('.acciones-botones');
    if (!cont) {
      cont = document.createElement('div');
      cont.className = 'acciones-botones';
      acciones.appendChild(cont);
    }
    cont.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:2px;';

    cont.querySelectorAll('button').forEach(function (boton) {
      prepararBotonExistente(boton);
      boton.onclick = boton.onclick;
      boton.addEventListener('click', function (e) { e.stopPropagation(); });
    });

    crearUrgente(fila, id, aviso);

    fila.querySelectorAll('select, input, textarea, a, button').forEach(function (el) {
      el.addEventListener('click', function (e) { e.stopPropagation(); });
    });

    if (fila.dataset.adminRowClick !== '1') {
      fila.dataset.adminRowClick = '1';
      fila.addEventListener('click', function () {
        if (typeof window.editarAviso === 'function') window.editarAviso(id);
      });
    }
  }

  function prepararTabla() {
    document.querySelectorAll('.tabla-admin tbody tr').forEach(prepararFila);
  }

  let intentos = 0;
  const intervalo = setInterval(function () {
    prepararTabla();
    intentos++;
    if (intentos >= 40) clearInterval(intervalo);
  }, 250);

  document.addEventListener('DOMContentLoaded', function () {
    cargarEstados();
    prepararTabla();
  });

  if (document.readyState !== 'loading') {
    cargarEstados();
    prepararTabla();
  }
})();