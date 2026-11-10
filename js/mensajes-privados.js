/* Mensajería privada de El Barrio. Solo disponible para sesiones Supabase autenticadas. */
(function () {
  'use strict';
  if (window.__elBarrioMensajesPrivados) return;
  window.__elBarrioMensajesPrivados = true;

  const esc = (value) => String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const fecha = (value) => {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('es-MX', {
      hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short'
    });
  };

  let client = null;
  let usuario = null;
  let canal = null;
  let intervalo = null;
  let peerActual = null;
  let enviando = false;
  let modal = null;

  function estilos() {
    if (document.getElementById('eb-mensajes-styles')) return;
    const style = document.createElement('style');
    style.id = 'eb-mensajes-styles';
    style.textContent = `
      #chartOnline .presence-copy{min-width:0;flex:1}
      #chartOnline .presence-copy>div{min-width:0}
      #onlineUsersList{display:flex;flex-wrap:wrap;gap:7px;margin-top:9px}
      .eb-online-user{display:inline-flex;align-items:center;gap:7px;max-width:100%;padding:6px 10px;border:1px solid #dce6ed;border-radius:999px;background:rgba(255,255,255,.82);color:#34495e;font-family:inherit;font-size:12px;font-weight:600;line-height:1.2;cursor:pointer;transition:background .18s,border-color .18s,transform .18s}
      .eb-online-user:hover{background:#fff8e9;border-color:#d4a043;transform:translateY(-1px)}
      .eb-online-user:focus-visible,.eb-inbox-button:focus-visible,.eb-chat-close:focus-visible,.eb-chat-send:focus-visible{outline:3px solid rgba(52,152,219,.35);outline-offset:2px}
      .eb-online-user:disabled{cursor:default;opacity:.65;transform:none}
      .eb-online-dot{width:7px;height:7px;flex:0 0 7px;border-radius:50%;background:#2b9a68}
      .eb-online-self{background:#f3f6f8}
      .eb-inbox-button{margin-top:10px;padding:6px 11px;border:1px solid #d4a043;border-radius:999px;background:#fff;color:#34495e;font-size:12px;font-weight:700;cursor:pointer}
      .eb-chat-overlay[hidden]{display:none!important}.eb-chat-overlay{position:fixed;inset:0;z-index:99990;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(18,32,46,.48);backdrop-filter:blur(5px)}
      .eb-chat-modal{display:flex;flex-direction:column;width:min(560px,100%);height:min(680px,88vh);overflow:hidden;border:1px solid rgba(255,255,255,.7);border-radius:18px;background:#f8fafb;box-shadow:0 24px 70px rgba(18,32,46,.28)}
      .eb-chat-head{display:flex;align-items:center;gap:12px;padding:15px 17px;background:#2c3e50;color:#fff}
      .eb-chat-head-copy{min-width:0;flex:1}
      .eb-chat-head strong{display:block;font-size:15px}
      .eb-chat-head small{display:block;margin-top:3px;color:#cbd6df;font-size:11px}
      .eb-chat-close{width:34px;height:34px;border:1px solid rgba(255,255,255,.25);border-radius:50%;background:transparent;color:#fff;font-size:20px;cursor:pointer}
      .eb-chat-back{border:0;background:transparent;color:#f5b042;font-size:13px;font-weight:700;cursor:pointer}
      .eb-chat-body{flex:1;min-height:0;overflow:auto;padding:16px}
      .eb-chat-empty{padding:28px 12px;text-align:center;color:#718092;font-size:13px}
      .eb-chat-contact{display:flex;align-items:center;gap:10px;width:100%;padding:12px;border:0;border-bottom:1px solid #e6edf1;background:transparent;text-align:left;cursor:pointer}
      .eb-chat-contact:hover{background:#eef4f7}
      .eb-chat-contact-main{min-width:0;flex:1}
      .eb-chat-contact strong,.eb-chat-contact small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .eb-chat-contact small{margin-top:4px;color:#758493;font-size:11px}
      .eb-chat-unread{min-width:20px;padding:3px 6px;border-radius:99px;background:#d4a043;color:#fff;text-align:center;font-size:10px;font-weight:800}
      .eb-chat-messages{display:flex;flex-direction:column;gap:9px}
      .eb-chat-bubble{max-width:84%;padding:9px 12px;border-radius:14px;background:#fff;border:1px solid #e1e9ee;color:#34495e;font-size:13px;line-height:1.45;overflow-wrap:anywhere}
      .eb-chat-bubble.mine{align-self:flex-end;background:#eaf3f8;border-color:#d2e3ee}
      .eb-chat-time{display:block;margin-top:5px;color:#82909b;font-size:10px;text-align:right}
      .eb-chat-compose{display:flex;align-items:flex-end;gap:9px;padding:12px;border-top:1px solid #e0e8ed;background:#fff}
      .eb-chat-compose textarea{flex:1;min-height:42px;max-height:110px;resize:vertical;padding:10px 12px;border:1px solid #d7e1e8;border-radius:12px;font-family:inherit;font-size:13px;line-height:1.4;color:#34495e}
      .eb-chat-send{padding:10px 15px;border:0;border-radius:11px;background:#2c3e50;color:#fff;font-size:12px;font-weight:700;cursor:pointer}
      .eb-chat-send:disabled{opacity:.5;cursor:wait}
      .eb-chat-note{padding:8px 14px;color:#82909b;text-align:center;font-size:10px}
      @media(max-width:520px){.eb-chat-overlay{padding:0;align-items:stretch}.eb-chat-modal{width:100%;height:100%;max-height:100%;border-radius:0}.eb-online-user{font-size:11px}}
      @media(prefers-reduced-motion:reduce){.eb-online-user{transition:none}}
    `;
    document.head.appendChild(style);
  }

  async function obtenerSesion() {
    if (!localStorage.getItem('api_key')) return false;
    if (typeof window.obtenerSupabaseClient !== 'function') return false;
    client = await window.obtenerSupabaseClient();
    const { data, error } = await client.auth.getUser();
    if (error || !data?.user) return false;
    usuario = data.user;
    return true;
  }

  function asegurarModal() {
    if (modal) return modal;
    modal = document.createElement('div');
    modal.className = 'eb-chat-overlay';
    modal.hidden = true;
    modal.innerHTML = `
      <section class="eb-chat-modal" role="dialog" aria-modal="true" aria-label="Mensajes privados">
        <header class="eb-chat-head">
          <button type="button" class="eb-chat-back" hidden>‹ Mensajes</button>
          <div class="eb-chat-head-copy"><strong class="eb-chat-title">Mis mensajes</strong><small class="eb-chat-subtitle">Conversaciones privadas</small></div>
          <button type="button" class="eb-chat-close" aria-label="Cerrar">×</button>
        </header>
        <main class="eb-chat-body"></main>
        <form class="eb-chat-compose" hidden>
          <textarea maxlength="2000" rows="1" placeholder="Escribe un mensaje…" aria-label="Escribe un mensaje"></textarea>
          <button class="eb-chat-send" type="submit">Enviar</button>
        </form>
        <div class="eb-chat-note">Tus mensajes solo son visibles para ti y la persona destinataria.</div>
      </section>`;
    document.body.appendChild(modal);
    modal.querySelector('.eb-chat-close').addEventListener('click', cerrarModal);
    modal.addEventListener('click', e => { if (e.target === modal) cerrarModal(); });
    modal.querySelector('.eb-chat-back').addEventListener('click', mostrarBandeja);
    modal.querySelector('.eb-chat-compose').addEventListener('submit', enviarMensaje);
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.hidden) cerrarModal(); });
    return modal;
  }

  function abrirModal() {
    asegurarModal();
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
  }
  function cerrarModal() {
    if (!modal) return;
    modal.hidden = true;
    document.body.style.overflow = '';
    peerActual = null;
  }

  function mostrarListaVacia(texto) {
    const body = modal.querySelector('.eb-chat-body');
    body.innerHTML = '<div class="eb-chat-empty"></div>';
    body.firstElementChild.textContent = texto;
  }

  async function mostrarBandeja() {
    peerActual = null;
    const body = modal.querySelector('.eb-chat-body');
    const compose = modal.querySelector('.eb-chat-compose');
    modal.querySelector('.eb-chat-title').textContent = 'Mis mensajes';
    modal.querySelector('.eb-chat-subtitle').textContent = 'Conversaciones privadas';
    modal.querySelector('.eb-chat-back').hidden = true;
    compose.hidden = true;
    mostrarListaVacia('Cargando conversaciones…');
    const { data, error } = await client.rpc('obtener_conversaciones_privadas');
    if (error) { mostrarListaVacia('No fue posible cargar tus conversaciones.'); console.warn('Bandeja privada:', error); return; }
    body.innerHTML = '';
    if (!data?.length) { mostrarListaVacia('Todavía no tienes conversaciones. Selecciona a alguien conectado para iniciar una.'); return; }
    data.forEach(item => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'eb-chat-contact';
      const main = document.createElement('span');
      main.className = 'eb-chat-contact-main';
      const name = document.createElement('strong');
      name.textContent = item.nombre || 'Vecino';
      const preview = document.createElement('small');
      preview.textContent = (item.ultimo_mensaje || '').slice(0, 100) + ' · ' + fecha(item.ultima_fecha);
      main.append(name, preview);
      button.append(main);
      if (Number(item.mensajes_no_leidos) > 0) {
        const unread = document.createElement('span');
        unread.className = 'eb-chat-unread';
        unread.textContent = String(item.mensajes_no_leidos);
        button.append(unread);
      }
      button.addEventListener('click', () => abrirConversacion({ id: item.usuario_id, nombre: item.nombre }));
      body.append(button);
    });
  }

  async function abrirConversacion(peer) {
    if (!peer?.id || peer.id === usuario.id) return;
    peerActual = peer;
    abrirModal();
    modal.querySelector('.eb-chat-title').textContent = peer.nombre || 'Conversación';
    modal.querySelector('.eb-chat-subtitle').textContent = 'Mensaje privado';
    modal.querySelector('.eb-chat-back').hidden = false;
    modal.querySelector('.eb-chat-compose').hidden = false;
    modal.querySelector('.eb-chat-compose textarea').focus();
    await cargarMensajes();
    await client.rpc('marcar_mensajes_leidos', { p_remitente_id: peer.id });
  }

  async function cargarMensajes() {
    if (!peerActual) return;
    const body = modal.querySelector('.eb-chat-body');
    const peerId = peerActual.id;
    const { data, error } = await client.from('mensajes_privados')
      .select('id,remitente_id,destinatario_id,contenido,created_at')
      .or('and(remitente_id.eq.' + usuario.id + ',destinatario_id.eq.' + peerId + '),and(remitente_id.eq.' + peerId + ',destinatario_id.eq.' + usuario.id + ')')
      .order('created_at', { ascending: true }).limit(150);
    if (!peerActual || peerActual.id !== peerId) return;
    if (error) { mostrarListaVacia('No fue posible cargar esta conversación.'); console.warn('Mensajes privados:', error); return; }
    body.innerHTML = '';
    if (!data?.length) { mostrarListaVacia('Inicia la conversación con un mensaje.'); return; }
    const list = document.createElement('div');
    list.className = 'eb-chat-messages';
    data.forEach(message => {
      const bubble = document.createElement('div');
      bubble.className = 'eb-chat-bubble' + (message.remitente_id === usuario.id ? ' mine' : '');
      bubble.append(document.createTextNode(message.contenido));
      const time = document.createElement('span');
      time.className = 'eb-chat-time';
      time.textContent = fecha(message.created_at);
      bubble.append(time);
      list.append(bubble);
    });
    body.append(list);
    body.scrollTop = body.scrollHeight;
  }

  async function enviarMensaje(event) {
    event.preventDefault();
    if (enviando || !peerActual) return;
    const input = modal.querySelector('.eb-chat-compose textarea');
    const button = modal.querySelector('.eb-chat-send');
    const contenido = input.value.trim();
    if (!contenido) return;
    enviando = true;
    button.disabled = true;
    try {
      const { error } = await client.from('mensajes_privados').insert({
        remitente_id: usuario.id,
        destinatario_id: peerActual.id,
        contenido
      });
      if (error) throw error;
      input.value = '';
      await cargarMensajes();
    } catch (error) {
      console.warn('No se pudo enviar el mensaje privado:', error);
      if (typeof window.mostrarError === 'function') window.mostrarError('No se pudo enviar el mensaje. Intenta nuevamente.');
      else alert('No se pudo enviar el mensaje. Intenta nuevamente.');
    } finally {
      enviando = false;
      button.disabled = false;
      input.focus();
    }
  }

  async function cargarUsuariosConectados() {
    const panel = document.getElementById('chartOnline');
    const lista = document.getElementById('onlineUsersList');
    const badge = document.getElementById('onlineCount');
    if (!panel || !lista || !badge) return;
    if (!usuario || !client) {
      lista.textContent = 'Inicia sesión para consultar quién está conectado.';
      return;
    }
    const { data, error } = await client.rpc('obtener_usuarios_conectados');
    if (error) {
      lista.textContent = 'No fue posible consultar las conexiones en este momento.';
      console.warn('Usuarios conectados:', error);
      return;
    }
    const usuarios = Array.isArray(data) ? data : [];
    badge.textContent = usuarios.length + (usuarios.length === 1 ? ' conectado' : ' conectados');
    lista.dataset.mensajesDirectos = '1';
    lista.innerHTML = '';
    const otros = usuarios.filter(item => item.usuario_id !== usuario.id);
    if (!otros.length) {
      const note = document.createElement('span');
      note.className = 'eb-chat-empty-inline';
      note.textContent = usuarios.length ? 'Eres la única persona conectada por ahora.' : 'No hay usuarios conectados en este momento.';
      note.style.cssText = 'color:#718092;font-size:12px';
      lista.append(note);
    } else {
      otros.forEach(item => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'eb-online-user';
        button.dataset.userId = item.usuario_id;
        const dot = document.createElement('span');
        dot.className = 'eb-online-dot';
        const name = document.createElement('span');
        name.textContent = item.nombre || 'Vecino';
        button.append(dot, name);
        button.addEventListener('click', () => abrirConversacion({ id: item.usuario_id, nombre: item.nombre }));
        lista.append(button);
      });
    }
  }

  function instalarBotonBandeja() {
    const panel = document.getElementById('chartOnline');
    if (!panel || panel.querySelector('.eb-inbox-button')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'eb-inbox-button';
    button.textContent = 'Mis mensajes';
    button.addEventListener('click', async () => {
      abrirModal();
      await mostrarBandeja();
    });
    panel.querySelector('.presence-copy > div')?.append(button);
  }

  function instalarRealtime() {
    if (canal || !client || !usuario) return;
    canal = client.channel('elbarrio-mensajes-' + usuario.id);
    const actualizar = payload => {
      const message = payload?.new;
      if (!message) return;
      if (peerActual && (message.remitente_id === peerActual.id || message.destinatario_id === peerActual.id)) {
        cargarMensajes();
        if (message.destinatario_id === usuario.id) client.rpc('marcar_mensajes_leidos', { p_remitente_id: peerActual.id });
      } else if (modal && !modal.hidden && !peerActual) {
        mostrarBandeja();
      }
    };
    canal
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes_privados', filter: 'destinatario_id=eq.' + usuario.id }, actualizar)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes_privados', filter: 'remitente_id=eq.' + usuario.id }, actualizar)
      .subscribe(status => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') console.warn('Canal de mensajes privados:', status);
      });
  }

  async function iniciar() {
    estilos();
    if (!(await obtenerSesion())) {
      const list = document.getElementById('onlineUsersList');
      if (list) list.textContent = 'Inicia sesión para ver y contactar a los usuarios conectados.';
      return;
    }
    instalarBotonBandeja();
    instalarRealtime();
    await cargarUsuariosConectados();
    if (intervalo) clearInterval(intervalo);
    intervalo = window.setInterval(() => {
      if (!document.hidden) cargarUsuariosConectados();
    }, 20000);
  }

  function esperarPanel() {
    if (document.getElementById('chartOnline')) { iniciar(); return; }
    const observer = new MutationObserver(() => {
      if (document.getElementById('chartOnline')) {
        observer.disconnect();
        iniciar();
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', esperarPanel, { once: true });
  else esperarPanel();
})();
