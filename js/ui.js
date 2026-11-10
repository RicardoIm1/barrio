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

        // Una sola implementación para todas las páginas.
        window.inicializarAtmosferaHeader?.(container);


        this.inicializarMenuMovil(container);

        // Estos scripts se inicializan aquí: los scripts insertados con innerHTML no se ejecutan.
        const loginLink = container.querySelector('#login-link');
        const userArea = container.querySelector('#user-area');
        const userName = container.querySelector('#user-name');
        const logoutLink = container.querySelector('#cerrar-sesion');
        const usuario = usuarioConSesion();
        if (usuario) {
          if (loginLink) loginLink.style.display = 'none';
          if (userArea) userArea.style.display = 'flex';
          if (userName) {
            userName.textContent = '👋 ' + (usuario.nombre || usuario.email || 'Usuario');
            userName.classList.add('admin-link');
            userName.title = 'Abrir panel de administración';
            userName.setAttribute('role', 'link');
            userName.setAttribute('tabindex', '0');
            userName.onclick = () => { window.location.href = '/admin.html'; };
            userName.onkeydown = (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); window.location.href = '/admin.html'; } };
          }
        } else {
          if (loginLink) loginLink.style.display = 'inline-flex';
          if (userArea) userArea.style.display = 'none';
        }
        if (logoutLink && !logoutLink.dataset.logoutInit) {
          logoutLink.dataset.logoutInit = '1';
          logoutLink.addEventListener('click', async (event) => {
            event.preventDefault();
            try {
              let client = window.__elBarrioSupabaseClient || null;
              if (!client && typeof window.obtenerSupabaseClient === 'function') client = await window.obtenerSupabaseClient();
              if (client && client.auth && client.auth.signOut) await client.auth.signOut();
            } catch (error) {
              console.warn('No se pudo cerrar la sesión de Supabase:', error);
            } finally {
              localStorage.removeItem('usuario');
              localStorage.removeItem('api_key');
              window.location.href = '/index.html';
            }
          });
        }

        const buscadorHeader = container.querySelector('#buscador-input-header');
        const contenedorBuscador = buscadorHeader?.closest('.header-buscador');
        if (buscadorHeader && contenedorBuscador && !buscadorHeader.dataset.mobileSearchInit) {
          buscadorHeader.dataset.mobileSearchInit = '1';
          const mobile = () => window.matchMedia('(max-width: 768px)').matches;
          const collapse = () => contenedorBuscador.classList.remove('activo');
          const search = () => {
            window.currentSearchTerm = buscadorHeader.value;
            try { currentSearchTerm = buscadorHeader.value; } catch (_) {}
            if (typeof window.applyFiltersAndSearch === 'function') window.applyFiltersAndSearch();
          };
          const accept = () => { collapse(); buscadorHeader.blur(); };
          const cancel = () => { buscadorHeader.value = ''; search(); accept(); };
          buscadorHeader.addEventListener('focus', () => { if (mobile()) contenedorBuscador.classList.add('activo'); });
          buscadorHeader.addEventListener('input', search);
          buscadorHeader.addEventListener('keydown', e => {
            if (e.key === 'Enter') { e.preventDefault(); accept(); }
            if (e.key === 'Escape') { e.preventDefault(); cancel(); }
          });
          container.querySelector('#buscador-aceptar')?.addEventListener('click', accept);
          container.querySelector('#buscador-cancelar')?.addEventListener('click', cancel);
          document.addEventListener('pointerdown', e => {
            if (mobile() && !contenedorBuscador.contains(e.target)) collapse();
          });
        }
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

    inicializarMenuMovil(container = document) {
      const toggle = container.querySelector('#header-menu-toggle');
      const acciones = container.querySelector('#header-acciones');
      if (!toggle || !acciones || toggle.dataset.menuInit === '1') return;
      toggle.dataset.menuInit = '1';
      const cerrar = () => { acciones.classList.remove('menu-open'); toggle.setAttribute('aria-expanded', 'false'); toggle.setAttribute('aria-label', 'Abrir menú'); };
      toggle.addEventListener('click', () => {
        if (toggle.getAttribute('aria-expanded') === 'true') cerrar();
        else { acciones.classList.add('menu-open'); toggle.setAttribute('aria-expanded', 'true'); toggle.setAttribute('aria-label', 'Cerrar menú'); }
      });
      document.addEventListener('keydown', e => { if (e.key === 'Escape') cerrar(); });
      document.addEventListener('pointerdown', e => { if (!acciones.contains(e.target) && !toggle.contains(e.target)) cerrar(); });
      window.addEventListener('resize', () => { if (window.innerWidth > 768) cerrar(); });
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
        return `<tr id="fila-aviso-${aviso.id}"><td>${celdaImagen}</td><td><strong>${aviso.titulo || 'Sin título'}</strong><br><small style="color:#888;">${aviso.categoria}</small></td><td>${aviso.contacto || 'No provisto'}</td><td>${new Date(aviso.created_at).toLocaleDateString('es-MX', { timeZone: 'America/Bahia_Banderas' })}</td><td><span class="badge-status ${badgeClase}">${aviso.status || 'pendiente'}</span></td><td><div class="acciones-tabla-flex">${accionesBotones}</div></td></tr>`;
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


  // Componentes visuales compartidos: miniaturas de video y estados de carga.
  (function instalarComponentesVisuales(){
    if(window.__elBarrioComponentesVisuales) return;
    window.__elBarrioComponentesVisuales = true;

    const estilos = document.createElement('style');
    estilos.id = 'elbarrio-componentes-visuales';
    estilos.textContent = `
      .eb-video-thumb{position:relative;display:grid;place-items:center;width:100%;min-height:150px;aspect-ratio:16/9;overflow:hidden;border-radius:inherit;background:linear-gradient(135deg,#263b50,#49677f 58%,#25394d);color:#fff;isolation:isolate}
      .eb-video-thumb img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:-1}
      .eb-video-thumb:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(14,28,42,.04),rgba(14,28,42,.42));z-index:0}
      .eb-video-thumb .eb-video-play{position:relative;z-index:1;display:grid;place-items:center;width:54px;height:54px;padding-left:4px;border:1px solid rgba(255,255,255,.7);border-radius:50%;background:rgba(24,43,60,.62);box-shadow:0 5px 22px rgba(0,0,0,.2);font-size:22px;color:#fff}
      .eb-video-thumb .eb-video-label{position:absolute;right:10px;bottom:9px;z-index:1;padding:4px 8px;border-radius:6px;background:rgba(18,32,46,.76);color:#fff;font:700 10px/1 system-ui,sans-serif;letter-spacing:.1em}
      .eb-video-thumb.eb-video-clickable{cursor:pointer}
      .eb-video-thumb.eb-video-clickable:focus-visible{outline:3px solid #d4a043;outline-offset:3px}
      .eb-video-standard{background:linear-gradient(135deg,#263b50,#49677f);object-fit:contain}
      .cargando,.loading-state,.loading-trigger,.cargando-row td,[data-loading="true"],.loading-state-inline{position:relative}
      .cargando,.loading-state{display:flex;align-items:center;justify-content:center;gap:11px;min-height:76px;text-align:center}
      .cargando:before,.loading-state:before,.loading-state-inline:before,.cargando-row td:before{content:"";display:inline-block;width:19px;height:19px;flex:0 0 19px;border:2px solid rgba(52,73,94,.18);border-top-color:#3498db;border-right-color:#3498db;border-radius:50%;animation:eb-giro .78s linear infinite}
      .loading-trigger{min-height:36px;display:flex;align-items:center;justify-content:center}
      .loading-trigger:not([style*="display: none"]):after{content:"";width:17px;height:17px;border:2px solid rgba(52,73,94,.16);border-top-color:#3498db;border-radius:50%;animation:eb-giro .78s linear infinite}
      .cargando-row td:before{margin-right:9px;vertical-align:middle}
      [data-loading="true"]{cursor:wait}
      @keyframes eb-giro{to{transform:rotate(360deg)}}
      @media(prefers-reduced-motion:reduce){.cargando:before,.loading-state:before,.loading-state-inline:before,.cargando-row td:before,.loading-trigger:after{animation-duration:2.5s}}
    `;
    (document.head || document.documentElement).appendChild(estilos);

    function escaparHTML(valor){return String(valor||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
    function obtenerPoster(url, poster){
      if(poster && /^https?:\/\//i.test(poster)) return poster;
      const fuente=String(url||'');
      const yt=fuente.match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?.*v=|embed\/|shorts\/))([\w-]{11})/i);
      if(yt) return 'https://i.ytimg.com/vi/'+yt[1]+'/hqdefault.jpg';
      if(/res\.cloudinary\.com\//i.test(fuente) && /\/video\/upload\//i.test(fuente))
        return fuente.replace('/video/upload/','/video/upload/so_0,f_jpg/').replace(/\.(mp4|mov|webm|m4v)(?=([?#]|$))/i,'.jpg');
      return '';
    }
    function normalizarVideo(video){
      if(video.dataset.ebVisualNormalizado==='1') return;
      video.dataset.ebVisualNormalizado='1';
      const tarjeta=video.closest('.aviso-card,.tarjeta,.article-media,.article-media-video,#edit-vista-previa');
      const imagen=tarjeta?.querySelector('img:not(.eb-video-poster)')?.getAttribute('src');
      const poster=obtenerPoster(video.currentSrc||video.getAttribute('src')||video.querySelector('source')?.getAttribute('src'),video.getAttribute('poster')||video.dataset.poster||imagen);
      if(poster) video.setAttribute('poster',poster);
      video.classList.add('eb-video-standard');
    }
    function normalizarIframe(frame){
      if(frame.dataset.ebVisualNormalizado==='1') return;
      const src=frame.getAttribute('src')||'';
      if(!/(youtube(?:-nocookie)?\.com\/embed\/|player\.vimeo\.com\/video\/)/i.test(src)) return;
      const contexto=frame.closest('.aviso-video,.article-media-video,.article-media');
      if(!contexto || contexto.dataset.ebVideoThumb==='1') return;
      contexto.dataset.ebVideoThumb='1';
      const poster=obtenerPoster(src,contexto.querySelector('img')?.src);
      const thumb=document.createElement('button');
      thumb.type='button';thumb.className='eb-video-thumb eb-video-clickable';
      thumb.setAttribute('aria-label','Reproducir video');
      thumb.innerHTML=(poster?'<img alt="" loading="lazy" decoding="async" src="'+escaparHTML(poster)+'">':'')+'<span class="eb-video-play" aria-hidden="true">▶</span><span class="eb-video-label">VIDEO</span>';
      thumb.addEventListener('click',function(event){
        event.stopPropagation();
        const player=document.createElement('iframe');
        player.src=src+(src.includes('?')?'&':'?')+'autoplay=1';
        player.title=frame.title||'Video del aviso';
        player.allow=frame.allow||'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
        player.allowFullscreen=true;
        player.loading='lazy';
        player.style.cssText=frame.getAttribute('style')||'width:100%;height:100%;border:0;';
        contexto.replaceChildren(player);
      });
      frame.replaceWith(thumb);
    }
    function procesar(raiz){
      if(!raiz || raiz.nodeType!==1 && raiz!==document) return;
      if(raiz.matches?.('video')) normalizarVideo(raiz);
      raiz.querySelectorAll?.('video').forEach(normalizarVideo);
      if(raiz.matches?.('iframe')) normalizarIframe(raiz);
      raiz.querySelectorAll?.('iframe').forEach(normalizarIframe);
    }
    function iniciar(){
      procesar(document);
      if(window.MutationObserver){
        const observer=new MutationObserver(records=>records.forEach(record=>record.addedNodes.forEach(node=>{if(node.nodeType===1)procesar(node)})));
        observer.observe(document.body,{childList:true,subtree:true});
      }
    }
    window.ElBarrioUI=window.ElBarrioUI||{};
    window.ElBarrioUI.videoPoster=obtenerPoster;
    window.ElBarrioUI.loadingHTML=function(texto){return '<div class="loading-state"><span class="loading-state-text">'+escaparHTML(texto||'Cargando...')+'</span></div>'};
    window.ElBarrioUI.videoThumbnailHTML=function(url,poster,alt){
      const imagen=obtenerPoster(url,poster);
      return '<div class="eb-video-thumb" role="img" aria-label="'+escaparHTML(alt||'Vista previa de video')+'">'+(imagen?'<img src="'+escaparHTML(imagen)+'" alt="" loading="lazy" decoding="async">':'')+'<span class="eb-video-play" aria-hidden="true">▶</span><span class="eb-video-label">VIDEO</span></div>';
    };
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',iniciar,{once:true});else iniciar();
  })();

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
        if (userNameSpan) {
          userNameSpan.textContent = `👋 ${usuario.nombre || usuario.email || 'Usuario'}`;
          userNameSpan.classList.add('admin-link');
          userNameSpan.style.cursor = 'pointer';
          userNameSpan.title = 'Abrir panel de administración';
          userNameSpan.setAttribute('role', 'link');
          userNameSpan.setAttribute('tabindex', '0');
          userNameSpan.onclick = () => { window.location.href = '/admin.html'; };
          userNameSpan.onkeydown = (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); window.location.href = '/admin.html'; } };
        }
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
