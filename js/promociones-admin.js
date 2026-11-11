(() => {
  const $=s=>document.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=v=>v?new Date(v).toLocaleString('es-MX',{dateStyle:'medium',timeStyle:'short',timeZone:'America/Bahia_Banderas'}):'Pendiente';
  const status={
    solicitada:['Solicitada','wait'],en_revision:['En revisión','wait'],requiere_ajustes:['Requiere ajustes','bad'],
    autorizada:['Autorizada','good'],pago_reportado:['Pago reportado','wait'],pago_rechazado:['Pago rechazado','bad'],
    activacion_pendiente:['Pendiente de activación','wait'],activa:['Activa','good'],vencida:['Vencida',''],rechazada:['Rechazada','bad'],cancelada:['Cancelada','']
  };
  let client,admin,solicitudes=[],pagos=[],promociones=[],usuarios=new Map(),urls=new Map();

  function aviso(msg,error=false){const el=$('#promo-feedback');el.textContent=msg;el.classList.toggle('error',error);if(msg)setTimeout(()=>{if(el.textContent===msg)el.textContent='';},7000);}
  async function header(){try{const r=await fetch('/common/header.html');if(r.ok){$('#header-container').innerHTML=await r.text();window.inicializarAtmosferaHeader?.(document);}}catch(e){console.warn(e);}}
  async function firmarComprobantes(){
    urls.clear();
    for(const p of pagos){
      if(!p.comprobante_path)continue;
      const {data,error}=await client.storage.from('comprobantes-promocion').createSignedUrl(p.comprobante_path,600);
      if(!error&&data?.signedUrl)urls.set(p.id,data.signedUrl);
    }
  }
  async function cargar(){
    const [s,p,m,u]=await Promise.all([
      client.from('solicitudes_promocion').select('*').order('created_at',{ascending:false}),
      client.from('pagos_promocion').select('*').order('created_at',{ascending:false}),
      client.from('promociones').select('*').order('created_at',{ascending:false}),
      client.from('usuarios').select('id,nombre,email')
    ]);
    for(const r of [s,p,m,u])if(r.error)throw r.error;
    solicitudes=s.data||[];pagos=p.data||[];promociones=m.data||[];
    usuarios=new Map((u.data||[]).map(x=>[x.id,x]));
    await firmarComprobantes();
    render();
  }
  function userLabel(id){const u=usuarios.get(id);return u?(u.nombre||u.email||id):'Usuario';}
  function cardSolicitud(s){
    const st=status[s.estado]||[s.estado,''];
    const note=s.observaciones_admin||'';
    const actions=['solicitada','en_revision','requiere_ajustes'].includes(s.estado)
      ? '<textarea data-notes="'+esc(s.id)+'" placeholder="Observaciones o instrucciones de pago">'+esc(note)+'</textarea><div class="promo-admin-card-actions">'+
        '<button class="secondary" data-review="en_revision" data-id="'+esc(s.id)+'">En revisión</button>'+
        '<button class="secondary" data-review="requiere_ajustes" data-id="'+esc(s.id)+'">Solicitar ajustes</button>'+
        '<button data-review="autorizada" data-id="'+esc(s.id)+'">Autorizar</button>'+
        '<button class="danger" data-review="rechazada" data-id="'+esc(s.id)+'">Rechazar</button></div>'
      : note?'<p><strong>Observaciones:</strong> '+esc(note)+'</p>':'';
    return '<article class="promo-admin-card"><div class="promo-admin-card-top"><div><h3>'+esc(s.aviso_titulo_snapshot)+'</h3><p>'+esc(s.producto_nombre_snapshot)+' · '+esc(s.paquete_nombre_snapshot)+' · $'+Number(s.precio_snapshot).toFixed(2)+' MXN · '+Number(s.duracion_dias_snapshot)+' días</p><p>Propietario: '+esc(userLabel(s.usuario_id))+' · Categoría: '+esc(s.categoria_snapshot||'Sin categoría')+'</p><p>Solicitud: '+fmt(s.created_at)+'</p></div><span class="promo-state '+st[1]+'">'+esc(st[0])+'</span></div>'+actions+'</article>';
  }
  function cardPago(p){
    const s=solicitudes.find(x=>x.id===p.solicitud_id);
    const url=urls.get(p.id);
    return '<article class="promo-admin-card"><div class="promo-admin-card-top"><div><h3>'+esc(s?.aviso_titulo_snapshot||'Aviso no disponible')+'</h3><p>'+esc(s?.producto_nombre_snapshot||'Promoción')+' · $'+Number(p.importe).toFixed(2)+' MXN · '+esc(p.metodo)+'</p><p>Propietario: '+esc(userLabel(s?.usuario_id))+' · Reportado: '+fmt(p.fecha_reporte)+'</p><p>Referencia: '+esc(p.referencia||'No proporcionada')+'</p></div><span class="promo-state '+(p.estado==='verificado'?'good':p.estado==='rechazado'?'bad':'wait')+'">'+esc(p.estado)+'</span></div>'+
      (url?'<a class="receipt-link" href="'+esc(url)+'" target="_blank" rel="noopener">Abrir comprobante</a>':'<p>Comprobante no disponible.</p>')+
      (p.estado==='reportado'?'<div class="promo-admin-card-actions"><button data-payment="verificado" data-id="'+esc(p.id)+'">Verificar pago</button><button class="danger" data-payment="rechazado" data-id="'+esc(p.id)+'">Rechazar pago</button></div>':'')+'</article>';
  }
  function cardActivation(p){
    const st=status[p.estado]||[p.estado,''];
    return '<article class="promo-admin-card"><div class="promo-admin-card-top"><div><h3>'+esc(p.aviso_titulo_snapshot)+'</h3><p>'+esc(p.tipo.toUpperCase())+' · '+Number(p.duracion_dias)+' días · $'+Number(p.precio).toFixed(2)+' MXN</p><p>Propietario: '+esc(userLabel(p.usuario_id))+'</p></div><span class="promo-state '+st[1]+'">'+esc(st[0])+'</span></div><p>1. Abre el administrador original y marca únicamente el check de '+esc(p.tipo)+'.</p><p>2. Regresa aquí y registra la activación. El contador inicia en ese momento.</p><div class="promo-admin-card-actions"><a class="receipt-link" href="/admin.html" target="_blank" rel="noopener">Abrir administrador original</a><button data-activate="'+esc(p.id)+'">Registrar activación</button></div></article>';
  }
  function cardActive(p){
    const st=status[p.estado]||[p.estado,''];
    const conservar=!!p.conservar_al_vencer;
    return '<article class="promo-admin-card"><div class="promo-admin-card-top"><div><h3>'+esc(p.aviso_titulo_snapshot)+'</h3><p>'+esc(p.tipo.toUpperCase())+' · Inicio: '+fmt(p.fecha_inicio)+'</p><p>Vence: <strong>'+fmt(p.fecha_fin)+'</strong></p><p>Propietario: '+esc(userLabel(p.usuario_id))+'</p></div><span class="promo-state '+st[1]+'">'+esc(st[0])+'</span></div><label class="promo-preserve"><input type="checkbox" data-preserve="'+esc(p.id)+'" '+(conservar?'checked':'')+'> Conservar el distintivo al vencer</label><p>Si queda desmarcado, se retirará automáticamente al cumplirse el plazo.</p></article>';
  }
  function render(){
    const pendientes=solicitudes.filter(s=>['solicitada','en_revision','requiere_ajustes'].includes(s.estado));
    const pagosPendientes=pagos.filter(p=>p.estado==='reportado');
    const activacion=promociones.filter(p=>p.estado==='activacion_pendiente');
    const activas=promociones.filter(p=>p.estado==='activa');
    $('#count-review').textContent=pendientes.length;
    $('#count-payment').textContent=pagosPendientes.length;
    $('#count-activation').textContent=activacion.length;
    $('#count-active').textContent=activas.length;
    $('#admin-requests').innerHTML=solicitudes.length?solicitudes.map(cardSolicitud).join(''):'<p class="promo-admin-empty">No hay solicitudes.</p>';
    $('#admin-payments').innerHTML=pagos.length?pagos.map(cardPago).join(''):'<p class="promo-admin-empty">No hay comprobantes reportados.</p>';
    $('#admin-activation').innerHTML=activacion.length?activacion.map(cardActivation).join(''):'<p class="promo-admin-empty">No hay promociones pendientes de activación.</p>';
    $('#admin-active').innerHTML=activas.length?activas.map(cardActive).join(''):'<p class="promo-admin-empty">No hay promociones activas en este momento.</p>';
  }
  async function revisar(id,state){
    const note=document.querySelector('[data-notes="'+id+'"]')?.value||null;
    const {error}=await client.rpc('admin_revisar_solicitud_promocion',{p_solicitud_id:id,p_estado:state,p_observaciones:note});
    if(error)throw error;
    aviso('Solicitud actualizada: '+state+'.');await cargar();
  }
  async function validarPago(id,state){
    const note=window.prompt(state==='verificado'?'Observación de validación (opcional):':'Motivo del rechazo (opcional):')||null;
    const {error}=await client.rpc('admin_validar_pago_promocion',{p_pago_id:id,p_estado:state,p_observaciones:note});
    if(error)throw error;
    aviso(state==='verificado'?'Pago verificado. La promoción quedó pendiente de activación manual.':'Pago rechazado.');await cargar();
  }
  async function activar(id){
    const {data,error}=await client.rpc('admin_registrar_activacion_promocion',{p_promocion_id:id});
    if(error)throw error;
    aviso('Activación registrada. Vigencia hasta '+fmt(data)+'.');await cargar();
  }
  async function conservar(id,value){
    const {error}=await client.rpc('admin_configurar_retiro_promocion',{p_promocion_id:id,p_conservar:value});
    if(error)throw error;
    aviso(value?'El distintivo se conservará al vencer.':'El distintivo se retirará automáticamente al vencer.');
    await cargar();
  }
  async function init(){
    await header();
    client=await obtenerSupabaseClient();
    admin=await Auth.requireAuth();
    if(!admin){window.location.href='/login.html?redirect='+encodeURIComponent('/promociones-admin.html');return;}
    if(admin.rol!=='admin'){document.querySelector('main').innerHTML='<section class="promo-panel"><h1>Acceso restringido</h1><p>Esta sección está disponible únicamente para administradores.</p><a href="/index.html">Volver al inicio</a></section>';return;}
    await cargar();
  }
  document.addEventListener('click',async e=>{
    try{
      const r=e.target.closest('[data-review]');if(r){r.disabled=true;await revisar(r.dataset.id,r.dataset.review);return;}
      const p=e.target.closest('[data-payment]');if(p){p.disabled=true;await validarPago(p.dataset.id,p.dataset.payment);return;}
      const a=e.target.closest('[data-activate]');if(a){a.disabled=true;await activar(a.dataset.activate);return;}
      if(e.target.id==='admin-refresh')await cargar();
    }catch(error){console.error(error);aviso(error.message||'No se pudo completar la operación.',true);}
  });
  document.addEventListener('change',async e=>{
    const c=e.target.closest('[data-preserve]');
    if(!c)return;
    c.disabled=true;
    try{await conservar(c.dataset.preserve,c.checked);}catch(error){aviso(error.message||'No se pudo actualizar la opción.',true);c.checked=!c.checked;c.disabled=false;}
  });
  init().catch(error=>{console.error(error);aviso(error.message||'No se pudo cargar el panel.',true);});
})();