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

  function actualizarAtmosferaModal() {
    if (!modal) return;
    const header = document.querySelector(".header[data-cielo]");
    if (!header) return;
    const cielo = header.dataset.cielo;
    if (cielo && modal.dataset.cielo !== cielo) modal.dataset.cielo = cielo;
  }

  function iniciarAtmosferaModal() {
    if (!modal || modal.dataset.atmosferaActiva === "true") return;
    modal.dataset.atmosferaActiva = "true";

    // El encabezado global mantiene el único reloj. El modal solo escucha su estado.
    const header = document.querySelector(".header");
    if (!header || !("MutationObserver" in window)) return;

    actualizarAtmosferaModal();
    const observer = new MutationObserver(actualizarAtmosferaModal);
    observer.observe(header, { attributes: true, attributeFilter: ["data-cielo"] });

    // El modal se conserva en el DOM y se oculta al cerrar; el observador
    // vive lo mismo que la página y solo escucha cambios en data-cielo.
  }

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
      .eb-inbox-button{margin-top:10px;padding:6px 11px;border:1px solid #d4a043;border-radius:999px;background:#fff;color:#34495e;font-size:12px;font-weight:700;cursor:pointer}\n      .eb-messages-guide{display:inline-flex;align-items:center;gap:5px;margin:10px 0 0 7px;padding:6px 10px;border:1px solid #dce6ed;border-radius:999px;background:rgba(255,255,255,.72);color:#527083;font-size:11px;font-weight:600;text-decoration:none;transition:background .18s,border-color .18s}\n      .eb-messages-guide:hover{background:#edf5f8;border-color:#9bb9c8;color:#2c5368}\n      .eb-messages-guide:focus-visible{outline:3px solid rgba(52,152,219,.35);outline-offset:2px}
      .eb-chat-overlay[hidden]{display:none!important}
      .eb-chat-overlay{position:fixed;inset:0;z-index:99990;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(25,39,52,.56);backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px)}
      .eb-chat-modal{position:relative;display:flex;flex-direction:column;width:min(570px,100%);height:min(700px,88vh);overflow:hidden;border:0;border-radius:22px;background:linear-gradient(180deg,#101b33 0%,#1d3152 62%,#405a78 100%);box-shadow:0 28px 90px rgba(22,39,54,.32),0 5px 18px rgba(22,39,54,.10);color:#2c3e50;isolation:isolate;transition:background 1600ms cubic-bezier(.22,.61,.36,1)}
      .eb-chat-modal:after{content:"";position:absolute;inset:0;z-index:0;pointer-events:none;opacity:.95;background-image:radial-gradient(circle at 8% 24%,#fff 0 1px,transparent 1.7px),radial-gradient(circle at 17% 68%,#dceaff 0 1px,transparent 1.8px),radial-gradient(circle at 29% 31%,#fff 0 1.2px,transparent 2px),radial-gradient(circle at 43% 73%,#fff 0 1px,transparent 1.8px),radial-gradient(circle at 54% 22%,#dceaff 0 1px,transparent 1.8px),radial-gradient(circle at 68% 52%,#fff 0 1.2px,transparent 2px),radial-gradient(circle at 78% 19%,#fff 0 1px,transparent 1.8px),radial-gradient(circle at 91% 65%,#dceaff 0 1px,transparent 1.8px);transition:opacity 1400ms ease}
      .eb-chat-modal[data-cielo="dia"]{background:linear-gradient(180deg,#9fc8e2 0%,#d4e6ed 72%,#edf1ef 100%)}
      .eb-chat-modal[data-cielo="amanecer"]{background:linear-gradient(180deg,#586d91 0%,#d59b9a 58%,#f4d2ad 100%)}
      .eb-chat-modal[data-cielo="atardecer"]{background:linear-gradient(180deg,#354567 0%,#a86d83 57%,#f0b98d 100%)}
      .eb-chat-modal[data-cielo="noche"]{background:linear-gradient(180deg,#101b33 0%,#1d3152 62%,#405a78 100%)}
      .eb-chat-modal[data-cielo="dia"]:after{opacity:.12}
      .eb-chat-modal[data-cielo="amanecer"]:after,.eb-chat-modal[data-cielo="atardecer"]:after{opacity:.5}
      .eb-chat-modal[data-cielo="noche"]:after{opacity:.95}
      .eb-chat-modal>*{position:relative;z-index:1}
      .eb-chat-head{position:relative;display:flex;align-items:center;gap:12px;min-height:76px;padding:17px 20px;background:rgba(28,48,72,.94);color:#fff}
      .eb-chat-head-copy{min-width:0;flex:1}
      .eb-chat-head strong{display:block;font-size:15px;font-weight:700;letter-spacing:.1px}
      .eb-chat-head small{display:block;margin-top:4px;color:rgba(239,245,249,.76);font-size:11px;letter-spacing:.2px}
      .eb-chat-close{display:grid;place-items:center;width:35px;height:35px;flex:0 0 35px;border:1px solid rgba(255,255,255,.22);border-radius:50%;background:rgba(255,255,255,.07);color:#fff;font-size:20px;line-height:1;cursor:pointer;transition:background .18s,border-color .18s,transform .18s}
      .eb-chat-close:hover{background:rgba(255,255,255,.16);border-color:rgba(255,255,255,.48);transform:rotate(90deg)}
      .eb-chat-back{padding:7px 10px;border:1px solid rgba(245,176,66,.35);border-radius:999px;background:rgba(245,176,66,.10);color:#f5c36f;font-size:12px;font-weight:700;cursor:pointer}
      .eb-chat-back:hover{background:rgba(245,176,66,.2)}
      .eb-chat-body{flex:1;min-height:0;overflow:auto;padding:20px;background:radial-gradient(ellipse at 10% 0%,rgba(52,152,219,.07),transparent 38%),linear-gradient(180deg,rgba(248,250,251,.88),rgba(244,247,249,.9));backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px);scrollbar-width:thin;scrollbar-color:#cbd6de transparent}
      .eb-chat-empty{max-width:340px;margin:42px auto;padding:20px 18px;border:1px solid #e5edf2;border-radius:16px;background:rgba(255,255,255,.78);color:#718092;text-align:center;font-size:13px;line-height:1.6;box-shadow:0 5px 18px rgba(44,62,80,.035)}
      .eb-chat-contact{display:flex;align-items:center;gap:12px;width:100%;padding:14px 13px;border:0;border-bottom:1px solid #e8eef2;background:transparent;color:#34495e;text-align:left;cursor:pointer;transition:background .18s,border-radius .18s}
      .eb-chat-contact:hover{border-radius:12px;background:#fff}
      .eb-chat-contact-main{min-width:0;flex:1}
      .eb-chat-contact strong,.eb-chat-contact small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .eb-chat-contact strong{font-size:13px}
      .eb-chat-contact small{margin-top:4px;color:#82909b;font-size:11px}
      .eb-chat-unread{min-width:21px;padding:4px 7px;border-radius:99px;background:#d4a043;color:#fff;text-align:center;font-size:10px;font-weight:800}
      .eb-chat-messages{display:flex;flex-direction:column;gap:11px;min-height:100%}
      .eb-chat-bubble{position:relative;max-width:82%;padding:11px 14px;border:1px solid #e3eaf0;border-radius:16px 16px 16px 5px;background:#fff;color:#34495e;font-size:13px;line-height:1.5;overflow-wrap:anywhere;box-shadow:0 2px 7px rgba(44,62,80,.035)}
      .eb-chat-bubble.mine{align-self:flex-end;border-color:#d8e7f0;border-radius:16px 16px 5px 16px;background:linear-gradient(145deg,#edf5f9,#e6f0f6)}
      .eb-chat-time{display:block;margin-top:6px;color:#91a0ab;font-size:10px;text-align:right}
      .eb-chat-compose{display:flex;flex-direction:column;align-items:stretch;gap:8px;padding:11px 13px;border-top:1px solid #e5edf2;background:rgba(255,255,255,.96)}
      .eb-chat-tools{display:flex;align-items:center;gap:5px;flex-wrap:wrap}
      .eb-chat-tool{display:grid;place-items:center;min-width:31px;height:30px;padding:0 8px;border:1px solid #e1e9ee;border-radius:8px;background:#fff;color:#40576a;font:600 12px inherit;cursor:pointer}
      .eb-chat-tool:hover{border-color:#b8ccd9;background:#f0f6f9}
      .eb-chat-compose-row{display:flex;align-items:flex-end;gap:9px}
      .eb-chat-compose-row textarea{flex:1;min-width:0}
      .eb-chat-emoji-wrap{position:relative}
      .eb-chat-emoji-picker{position:absolute;left:0;bottom:38px;z-index:5;display:grid;grid-template-columns:repeat(6,1fr);gap:3px;width:228px;padding:8px;border:1px solid #dce6ec;border-radius:13px;background:#fff;box-shadow:0 10px 30px rgba(35,55,70,.16)}
      .eb-chat-emoji-picker[hidden]{display:none}
      .eb-chat-emoji{display:grid;place-items:center;width:31px;height:31px;border:0;border-radius:7px;background:transparent;font-size:19px;cursor:pointer}
      .eb-chat-emoji:hover{background:#eef4f7}
      .eb-inbox-button{position:relative;display:inline-flex;align-items:center;gap:7px}
      .eb-inbox-count{display:none;min-width:19px;height:19px;align-items:center;justify-content:center;padding:0 5px;border-radius:99px;background:#e67e22;color:#fff;font-size:10px;font-weight:800;line-height:1}
      .eb-inbox-count.visible{display:inline-flex}
      .eb-chat-rich strong{font-weight:750;color:#263d50}
      .eb-chat-rich em{font-style:italic}
      .eb-chat-rich u{text-decoration:underline;text-decoration-color:#d4a043;text-underline-offset:2px}
      .eb-chat-rich s{text-decoration:line-through;color:#718092}
      .eb-chat-rich code{padding:1px 4px;border-radius:4px;background:#eef2f5;font-family:ui-monospace,monospace;font-size:.92em}
      .eb-chat-rich .eb-chat-list-line{display:block;padding-left:12px}
      .eb-chat-compose textarea{flex:1;min-width:0;min-height:44px;max-height:116px;resize:vertical;padding:11px 14px;border:1px solid #dce5eb;border-radius:14px;background:#f9fbfc;color:#34495e;font-family:inherit;font-size:13px;line-height:1.45;transition:border-color .18s,box-shadow .18s,background .18s}
      .eb-chat-compose textarea{flex:1;min-width:0;min-height:44px;max-height:116px;resize:vertical;padding:11px 14px;border:1px solid #dce5eb;border-radius:14px;background:#f9fbfc;color:#34495e;font-family:inherit;font-size:13px;line-height:1.45;transition:border-color .18s,box-shadow .18s,background .18s}
      .eb-chat-compose textarea::placeholder{color:#9aa8b2}
      .eb-chat-compose textarea:focus{outline:none;border-color:#7dacbf;background:#fff;box-shadow:0 0 0 3px rgba(52,152,219,.10)}
      .eb-chat-send{min-height:44px;padding:0 17px;border:1px solid #26394a;border-radius:13px;background:linear-gradient(135deg,#34495e,#2c3e50);color:#fff;font-size:12px;font-weight:700;letter-spacing:.15px;cursor:pointer;box-shadow:0 3px 8px rgba(44,62,80,.14);transition:transform .18s,box-shadow .18s,background .18s}
      .eb-chat-send:hover:not(:disabled){transform:translateY(-1px);background:linear-gradient(135deg,#3d5870,#34495e);box-shadow:0 5px 12px rgba(44,62,80,.2)}
      .eb-chat-send:disabled{opacity:.48;cursor:wait;box-shadow:none}
      .eb-chat-note{padding:9px 14px 11px;border-top:1px solid rgba(230,237,241,.65);background:rgba(255,255,255,.91);color:#718092;text-align:center;font-size:10px;letter-spacing:.1px;backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px)}
      .eb-chat-close:focus-visible,.eb-chat-back:focus-visible,.eb-chat-send:focus-visible,.eb-chat-compose textarea:focus-visible,.eb-chat-contact:focus-visible{outline:3px solid rgba(52,152,219,.28);outline-offset:2px}
      @media(max-width:520px){.eb-chat-overlay{padding:0;align-items:stretch}.eb-chat-modal{width:100%;height:100%;height:100dvh;max-height:100%;border:0;border-radius:0}.eb-chat-head{min-height:70px;padding:15px 16px}.eb-chat-body{padding:15px 13px}.eb-chat-compose{gap:8px;padding:10px}.eb-chat-compose-row textarea{font-size:16px}.eb-chat-send{padding:0 13px}.eb-chat-emoji-picker{left:auto;right:0}}
      @media(prefers-reduced-motion:reduce){.eb-online-user,.eb-chat-close,.eb-chat-contact,.eb-chat-send{transition:none}}
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


  const emojis = ['😀','😃','😄','😁','😆','😊','🙂','😉','😍','🥰','😘','😎','🤔','😂','🤣','😭','🙌','👏','👍','👎','❤️','🧡','💛','💚','💙','💜','✨','🔥','🎉','🙏','🐶','🐱','🌻','☀️','🌈','☕'];
  function aplicarFormato(tipo) {
    const input = modal.querySelector('.eb-chat-compose textarea');
    const marcas = {bold:['**','**'],italic:['*','*'],underline:['__','__'],strike:['~~','~~']};
    const par = marcas[tipo]; if (!par) return;
    const a=input.selectionStart,b=input.selectionEnd, seleccionado=input.value.slice(a,b);
    input.setRangeText(par[0]+(seleccionado||'texto')+par[1],a,b,'select');
    input.focus(); if(!seleccionado) input.setSelectionRange(a+par[0].length,a+par[0].length+5);
  }
  function renderContenido(texto) {
    const escapeHtml=v=>String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
    return String(texto||'').split('\n').map(linea=>{
      let safe=escapeHtml(linea);
      safe=safe.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/__(.+?)__/g,'<u>$1</u>').replace(/~~(.+?)~~/g,'<s>$1</s>').replace(/\*(.+?)\*/g,'<em>$1</em>').replace(/\x60([^\x60]+)\x60/g,'<code>$1</code>');
      if(/^\s*[-•]\s+/.test(linea)) safe='<span class="eb-chat-list-line">• '+safe.replace(/^\s*[-•]\s+/,'')+'</span>';
      return safe;
    }).join('<br>');
  }
  function actualizarContadorNoLeidos() {
    if(!client||!usuario)return Promise.resolve();
    return client.rpc('obtener_conversaciones_privadas').then(({data,error})=>{
      if(error){console.warn('Contador de mensajes no leídos:',error);return;}
      const total=(data||[]).reduce((sum,item)=>sum+Number(item.mensajes_no_leidos||0),0);
      const badge=document.querySelector('.eb-inbox-count');
      if(badge){badge.textContent=total>99?'99+':String(total);badge.classList.toggle('visible',total>0);badge.setAttribute('aria-label',total+' mensajes sin leer');}
    }).catch(error=>console.warn('Contador de mensajes no leídos:',error));
  }
  function configurarEditor() {
    const compose=modal.querySelector('.eb-chat-compose'), picker=compose.querySelector('.eb-chat-emoji-picker');
    compose.querySelectorAll('[data-format]').forEach(button=>button.addEventListener('click',()=>aplicarFormato(button.dataset.format)));
    const toggle=compose.querySelector('.eb-chat-emoji-toggle');
    emojis.forEach(emoji=>{
      const button=document.createElement('button');button.type='button';button.className='eb-chat-emoji';button.textContent=emoji;button.setAttribute('aria-label','Insertar '+emoji);
      button.addEventListener('click',()=>{const input=compose.querySelector('textarea'),a=input.selectionStart,b=input.selectionEnd;input.setRangeText(emoji,a,b,'end');input.focus();picker.hidden=true;});
      picker.append(button);
    });
    toggle.addEventListener('click',()=>{picker.hidden=!picker.hidden;});
    document.addEventListener('click',event=>{if(!compose.contains(event.target))picker.hidden=true;});
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
          <div class="eb-chat-tools" role="toolbar" aria-label="Formato del mensaje">
            <button type="button" class="eb-chat-tool" data-format="bold" aria-label="Negritas" title="Negritas"><strong>B</strong></button>
            <button type="button" class="eb-chat-tool" data-format="italic" aria-label="Cursiva" title="Cursiva"><em>I</em></button>
            <button type="button" class="eb-chat-tool" data-format="underline" aria-label="Subrayado" title="Subrayado"><u>U</u></button>
            <button type="button" class="eb-chat-tool" data-format="strike" aria-label="Tachado" title="Tachado"><s>S</s></button>
            <div class="eb-chat-emoji-wrap"><button type="button" class="eb-chat-tool eb-chat-emoji-toggle" aria-label="Insertar emoji" title="Emojis">☺</button><div class="eb-chat-emoji-picker" hidden aria-label="Selector de emojis"></div></div>
          </div>
          <div class="eb-chat-compose-row"><textarea maxlength="2000" rows="2" placeholder="Escribe un mensaje…" aria-label="Escribe un mensaje"></textarea><button class="eb-chat-send" type="submit">Enviar</button></div>
        </form>
        <div class="eb-chat-note">Tus mensajes solo son visibles para ti y la persona destinataria.</div>
      </section>`;
    document.body.appendChild(modal);
    iniciarAtmosferaModal();
    configurarEditor();
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
    await actualizarContadorNoLeidos();
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
      const content=document.createElement('div'); content.className='eb-chat-rich'; content.innerHTML=renderContenido(message.contenido); bubble.append(content);
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
      console.error('No se pudo enviar el mensaje privado:', error);
      const detalle = error?.message || error?.details || 'Error desconocido';
      const aviso = 'No se pudo enviar el mensaje: ' + detalle;
      if (typeof window.mostrarError === 'function') window.mostrarError(aviso);
      else alert(aviso);
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
    button.append(document.createTextNode('Mis mensajes'));
    const count=document.createElement('span');count.className='eb-inbox-count';count.setAttribute('aria-live','polite');button.append(count);
    button.addEventListener('click', async () => {
      abrirModal();
      await mostrarBandeja();
    });
    panel.querySelector('.presence-copy > div')?.append(button);
    actualizarContadorNoLeidos();
  }

  function instalarRealtime() {
    if (canal || !client || !usuario) return;
    canal = client.channel('elbarrio-mensajes-' + usuario.id);
    const actualizar = payload => {
      const message = payload?.new;
      if (!message) return;
      if (peerActual && (message.remitente_id === peerActual.id || message.destinatario_id === peerActual.id)) {
        cargarMensajes();
        if (message.destinatario_id === usuario.id) {
          client.rpc('marcar_mensajes_leidos', { p_remitente_id: peerActual.id })
            .then(() => actualizarContadorNoLeidos());
        }
      } else if (modal && !modal.hidden && !peerActual) {
        mostrarBandeja();
      }
      if (message.destinatario_id === usuario.id) actualizarContadorNoLeidos();
    };
    canal
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes_privados', filter: 'destinatario_id=eq.' + usuario.id }, actualizar)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes_privados', filter: 'remitente_id=eq.' + usuario.id }, actualizar)
      .subscribe(status => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') console.warn('Canal de mensajes privados:', status);
      });
  }

  async function abrirConversacionDesdeNotificacion() {
    const params = new URLSearchParams(window.location.search);
    const remitenteId = params.get('mensaje');
    if (!remitenteId) return;

    const { data, error } = await client.rpc('obtener_conversaciones_privadas');
    if (error) {
      console.warn('No se pudo abrir la conversación desde la notificación:', error);
      return;
    }

    // Solo se acepta un remitente que ya figure en la bandeja del usuario autenticado.
    const conversacion = (data || []).find(item => item.usuario_id === remitenteId);
    if (!conversacion) return;

    params.delete('mensaje');
    const query = params.toString();
    const nuevaUrl = window.location.pathname + (query ? '?' + query : '') + window.location.hash;
    window.history.replaceState({}, '', nuevaUrl);

    await abrirConversacion({
      id: conversacion.usuario_id,
      nombre: conversacion.nombre || 'Conversación'
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
    await abrirConversacionDesdeNotificacion();
    if (intervalo) clearInterval(intervalo);
    intervalo = window.setInterval(() => {
      if (!document.hidden) { cargarUsuariosConectados(); actualizarContadorNoLeidos(); }
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
