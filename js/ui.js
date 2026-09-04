// ==================== UI CORE ====================

(function inicializarUIBarrio(){
  function usuarioConSesion(){
    try{
      const apiUsuario = window.API && typeof window.API.getUsuarioActual === 'function' ? window.API.getUsuarioActual() : null;
      if(apiUsuario && (apiUsuario.id || apiUsuario.email)) return apiUsuario;
    }catch(e){}
    try{
      const u = JSON.parse(localStorage.getItem('usuario') || 'null');
      const key = localStorage.getItem('api_key');
      return u && key ? u : null;
    }catch(e){ return null; }
  }

  function toast(mensaje, tipo='info', duracion=3000){
    let contenedor=document.getElementById('elbarrio-toast-container');
    if(!contenedor){
      contenedor=document.createElement('div');
      contenedor.id='elbarrio-toast-container';
      contenedor.style.cssText='position:fixed;right:18px;bottom:18px;z-index:100000;display:flex;flex-direction:column;gap:10px;width:min(390px,calc(100vw - 36px));pointer-events:none;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;';
      document.body.appendChild(contenedor);
    }
    const t=document.createElement('div');
    const icono=tipo==='error'?'⚠️':tipo==='success'?'✓':'ℹ️';
    const fondo=tipo==='error'?'rgba(170,45,45,.96)':tipo==='success'?'rgba(38,125,73,.96)':'rgba(44,62,80,.96)';
    t.style.cssText='display:flex;align-items:center;gap:10px;padding:12px 15px;border-radius:14px;background:'+fondo+';color:#fff;box-shadow:0 10px 30px rgba(20,30,40,.24);font-size:13px;font-weight:650;line-height:1.35;opacity:0;transform:translateY(10px) scale(.98);transition:opacity .2s ease,transform .2s ease;pointer-events:auto;backdrop-filter:blur(10px);';
    const i=document.createElement('span');
    i.textContent=icono;
    i.style.cssText='width:24px;height:24px;display:inline-flex;align-items:center;justify-content:center;border-radius:50%;background:rgba(255,255,255,.15);font-size:14px;flex:0 0 24px;';
    const txt=document.createElement('span');
    txt.textContent=String(mensaje ?? '');
    t.append(i,txt);
    contenedor.appendChild(t);
    requestAnimationFrame(()=>{t.style.opacity='1';t.style.transform='translateY(0) scale(1)';});
    setTimeout(()=>{t.style.opacity='0';t.style.transform='translateY(8px) scale(.98)';setTimeout(()=>t.remove(),220);},duracion);
  }

  window.elBarrioToast=toast;

  // Todas las alertas antiguas de la interfaz pasan a ser toasts.
  if(!window.__elBarrioAlertPatchedGlobal){
    const alertaNativa=window.alert.bind(window);
    window.alert=function(mensaje){
      const texto=String(mensaje ?? '');
      const tipo=/error|obligatorio|no se pudo|no disponible|expirada|iniciar sesi[oó]n|requiere|fall[oó]|rechaz/i.test(texto)?'error':'info';
      toast(texto,tipo);
      console.log('🔔 El Barrio toast:',texto);
    };
    window.__elBarrioAlertPatchedGlobal=true;
    window.__elBarrioNativeAlert=alertaNativa;
  }

  // WhatsApp siempre requiere sesión activa, tanto para contactar al anunciante
  // como para contactar a El Barrio. Se interceptan enlaces y botones dinámicos.
  function protegerWhatsApp(event){
    const el=event.target?.closest?.('a[href*="wa.me/"],button.whatsapp-stat,button.whatsapp-admin,.whatsapp-btn,[onclick*="contactarAnunciante"],[onclick*="contactarElBarrio"]');
    if(!el) return;
    if(usuarioConSesion()) return;
    event.preventDefault();
    event.stopPropagation();
    if(event.stopImmediatePropagation) event.stopImmediatePropagation();
    toast('Para usar WhatsApp necesitas iniciar sesión en El Barrio.','error',3600);
    setTimeout(()=>{ if(!usuarioConSesion()) window.location.href='/login.html'; },700);
  }
  document.addEventListener('click',protegerWhatsApp,true);

  // Toast de confirmación para votos y comentarios exitosos, sin alterar la API.
  function instalarFeedback(){
    if(window.__elBarrioFeedbackInstalled || !window.API) return false;
    if(typeof window.API.votarAviso==='function' && !window.API.votarAviso.__elbarrioWrapped){
      const originalVotar=window.API.votarAviso;
      const wrappedVotar=async function(...args){
        try{
          const resultado=await originalVotar.apply(this,args);
          if(resultado?.success) toast(args[1]==='negativo'?'👎 Tu voto quedó registrado.':'👍 Tu voto quedó registrado.','success');
          return resultado;
        }catch(error){ throw error; }
      };
      wrappedVotar.__elbarrioWrapped=true;
      window.API.votarAviso=wrappedVotar;
    }
    if(typeof window.API.peticion==='function' && !window.API.peticion.__elbarrioWrapped){
      const originalPeticion=window.API.peticion;
      const wrappedPeticion=async function(accion,...args){
        const resultado=await originalPeticion.call(this,accion,...args);
        if(accion==='AGREGAR_COMENTARIO' && resultado?.success) toast('💬 Comentario publicado.','success');
        return resultado;
      };
      wrappedPeticion.__elbarrioWrapped=true;
      window.API.peticion=wrappedPeticion;
    }
    window.__elBarrioFeedbackInstalled=true;
    return true;
  }
  if(!instalarFeedback()){
    let intentos=0;
    const timer=setInterval(()=>{if(instalarFeedback() || ++intentos>40)clearInterval(timer);},100);
  }

  const UI = {
    async cargarHeader() {
      const container = document.getElementById('header-container');
      if (!container) return;
      try {
        const res = await fetch('/common/header.html?v=' + Date.now());
        if (!res.ok) throw new Error('Header no encontrado');
        const html = await res.text();
        container.innerHTML = html;
        const ejecutarHeader = () => {
          if (typeof window._headerActualizarBotones === 'function') window._headerActualizarBotones();
          if (typeof window.actualizarHeaderSesion === 'function') window.actualizarHeaderSesion();
        };
        setTimeout(ejecutarHeader, 50);
        setTimeout(ejecutarHeader, 150);
        setTimeout(ejecutarHeader, 300);
      } catch (error) {
        console.error('Error cargando header:', error);
      }
    },

    mostrarMensaje(mensaje, tipo = 'info') {
      const container = document.getElementById('mensaje-container');
      if (!container) { toast(mensaje,tipo==='error'?'error':tipo==='exito'?'success':'info'); return; }
      const clase = tipo === 'error' ? 'mensaje-error' : (tipo === 'exito' ? 'mensaje-exito' : 'mensaje-info');
      container.innerHTML = `<div class="mensaje ${clase}">${mensaje}</div>`;
      setTimeout(() => { if (container.innerHTML.includes(mensaje)) container.innerHTML = ''; }, 5000);
    },

    mostrarError(mensaje) { this.mostrarMensaje(mensaje, 'error'); },
    mostrarExito(mensaje) { this.mostrarMensaje(mensaje, 'exito'); },
    mostrarInfo(mensaje) { this.mostrarMensaje(mensaje, 'info'); },

    renderizarTablaAdmin(avisos) {
      const tablaCuerpo = document.getElementById('tabla-avisos-cuerpo');
      if (!tablaCuerpo) { console.error('❌ No se encontró el contenedor id="tabla-avisos-cuerpo" en el HTML'); return; }
      if (!avisos || avisos.length === 0) { tablaCuerpo.innerHTML = `<tr><td colspan="6" class="text-center">No hay avisos que coincidan con los filtros.</td></tr>`; return; }
      const usuarioActual = API.getUsuarioActual();
      const esAdmin = usuarioActual && usuarioActual.rol === 'admin';
      tablaCuerpo.innerHTML = avisos.map(aviso => {
        const tieneImagen = aviso.imagen_url && aviso.imagen_url.startsWith('http');
        const celdaImagen = tieneImagen ? `<img src="${aviso.imagen_url}" alt="Aviso" class="admin-preview-img" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px;">` : `<span style="font-size: 1.5rem;" title="Sin imagen">🖼️❌</span>`;
        let badgeClase = 'badge-pendiente';
        if (aviso.status === 'activo' || aviso.status === 'aprobado') badgeClase = 'badge-activo';
        if (aviso.status === 'rechazado') badgeClase = 'badge-rechazado';
        let accionesBotones = '';
        if (esAdmin) {
          if (aviso.status === 'pendiente') {
            accionesBotones = `<button class="btn-tabla btn-aprobar" onclick="UI.procesarAprobacion('${aviso.id}', 'aprobar')">✅ Aprobar</button><button class="btn-tabla btn-rechazar" onclick="UI.procesarAprobacion('${aviso.id}', 'rechazar')">❌ Rechazar</button>`;
          } else accionesBotones = `<span class="texto-bloqueado">Sin acciones</span>`;
        } else accionesBotones = `<span class="texto-bloqueado">Solo lectura</span>`;
        return `<tr id="fila-aviso-${aviso.id}"><td>${celdaImagen}</td><td><strong>${aviso.titulo || 'Sin título'}</strong><br><small style="color:#888;">${aviso.categoria}</small></td><td>${aviso.contacto || 'No provisto'}</td><td>${new Date(aviso.created_at).toLocaleDateString('es-MX')}</td><td><span class="badge-status ${badgeClase}">${aviso.status || 'pendiente'}</span></td><td><div class="acciones-tabla-flex">${accionesBotones}</div></td></tr>`;
      }).join('');
    },

    async procesarAprobacion(id, accion) {
      const apiKey = localStorage.getItem('api_key');
      if (!apiKey) { this.mostrarError('Sesión expirada. Por favor vuelve a iniciar sesión.'); return; }
      try {
        this.mostrarInfo(`Procesando solicitud...`);
        let resultado = accion === 'aprobar' ? await API.aprobarAviso(id, apiKey) : await API.rechazarAviso(id, apiKey);
        if (resultado && resultado.success) { this.mostrarExito(`✅ Aviso ${accion === 'aprobar' ? 'aprobado' : 'rechazado'} correctamente.`); if (typeof window.cargarMisAvisos === 'function') window.cargarMisAvisos(); else if (typeof cargarMisAvisos === 'function') cargarMisAvisos(); }
        else this.mostrarError(`Error en servidor: ${resultado?.error || 'No se pudo cambiar el estado.'}`);
      } catch (error) { console.error(`❌ Fallo crítico al procesar ${accion}:`, error); this.mostrarError('Error de red al intentar conectar con Supabase.'); }
    }
  };

  window.UI = UI;
  window.mostrarError = (msg) => UI.mostrarError(msg);
  window.mostrarExito = (msg) => UI.mostrarExito(msg);

  function actualizarHeaderPorSesion() {
    const usuarioStr = localStorage.getItem('usuario');
    const apiKey = localStorage.getItem('api_key');
    const loginLink = document.getElementById('login-link');
    const userArea = document.getElementById('user-area');
    const userNameSpan = document.getElementById('user-name');
    const cerrarBtn = document.getElementById('cerrar-sesion');
    if (!loginLink) { setTimeout(actualizarHeaderPorSesion, 200); return; }
    if (usuarioStr && apiKey) {
      try {
        const usuario = JSON.parse(usuarioStr);
        if (loginLink) loginLink.style.display = 'none';
        if (userArea) userArea.style.display = 'flex';
        if (userNameSpan) { userNameSpan.textContent = `👋 ${usuario.nombre || usuario.email || 'Usuario'}`; userNameSpan.style.cursor = 'pointer'; userNameSpan.onclick = () => { window.location.href = '/admin.html'; }; }
        if (cerrarBtn) {
          const nuevoCerrar = cerrarBtn.cloneNode(true);
          cerrarBtn.parentNode.replaceChild(nuevoCerrar, cerrarBtn);
          nuevoCerrar.addEventListener('click', function(e){ e.preventDefault(); localStorage.removeItem('usuario'); localStorage.removeItem('api_key'); window.location.href='/index.html'; });
        }
      } catch(e){ console.error('Error al actualizar header:',e); }
    } else {
      if (loginLink) loginLink.style.display = 'inline-flex';
      if (userArea) userArea.style.display = 'none';
    }
  }

  window.actualizarHeaderPorSesion = actualizarHeaderPorSesion;
})();
