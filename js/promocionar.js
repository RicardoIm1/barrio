(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const fecha = value => value ? new Date(value).toLocaleString('es-MX',{dateStyle:'medium',timeStyle:'short',timeZone:'America/Bahia_Banderas'}) : 'Pendiente';
  const estados = {
    solicitada:['Solicitud recibida','wait'], en_revision:['En revisión','wait'],
    requiere_ajustes:['Requiere ajustes','bad'], autorizada:['Autorizada · puedes pagar','good'],
    pago_reportado:['Comprobante recibido','wait'], pago_rechazado:['Pago no validado · puedes reenviar','bad'],
    pago_verificado:['Pago verificado','good'], activacion_pendiente:['Pendiente de activación','wait'],
    activa:['Promoción activa','good'], vencida:['Promoción vencida',''], rechazada:['Solicitud rechazada','bad'], cancelada:['Cancelada','']
  };
  let client, usuario, avisos=[], productos=[], paquetes=[], solicitudes=[], pagos=[], promociones=[];

  function feedback(message, error=false){
    const node=$('#promo-feedback'); node.textContent=message; node.classList.toggle('error',error);
    if(message) setTimeout(()=>{if(node.textContent===message)node.textContent='';},6500);
  }

  async function cargarHeader(){
    try{
      const response=await fetch('/common/header.html');
      if(response.ok){$('#header-container').innerHTML=await response.text();window.inicializarAtmosferaHeader?.(document);}
    }catch(error){console.warn('Header:',error);}
  }

  async function cargarAvisos(){
    const {data,error}=await client.from('avisos').select('id,titulo,categoria,urgente,destacado,status,created_at')
      .eq('created_by',usuario.id).eq('status','activo').order('created_at',{ascending:false});
    if(error) throw error;
    avisos=data||[];
    const select=$('#promo-aviso');
    select.innerHTML=avisos.length
      ? '<option value="">Selecciona una publicación</option>'+avisos.map(a=>'<option value="'+escapeHTML(a.id)+'">'+escapeHTML(a.titulo)+'</option>').join('')
      : '<option value="">No tienes avisos activos</option>';
    actualizarMetaAviso();
  }

  function actualizarMetaAviso(){
    const aviso=avisos.find(a=>a.id===$('#promo-aviso').value);
    $('#promo-aviso-meta').textContent=aviso
      ? 'Categoría: '+(aviso.categoria||'Sin categoría')+' · Los distintivos promocionales no modifican esta clasificación.'
      : 'Selecciona un aviso para consultar las opciones disponibles.';
    document.querySelectorAll('[data-promo-type]').forEach(btn=>btn.disabled=!aviso);
  }

  async function cargarCatalogo(){
    const [p,b]=await Promise.all([
      client.from('productos_promocion').select('tipo,nombre,descripcion').eq('activo',true),
      client.from('paquetes_promocion').select('id,codigo,tipo,nombre,duracion_dias,precio,moneda').eq('activo',true)
    ]);
    if(p.error)throw p.error;if(b.error)throw b.error;
    productos=p.data||[];paquetes=b.data||[];
    renderCatalogo();
  }

  function renderCatalogo(){
    const root=$('#promo-products');
    const orden=['urgente','destacado'];
    const clases={urgente:['promo-product-urgent','U','Prioridad'],destacado:['promo-product-featured','D','Visibilidad']};
    root.innerHTML=orden.map(tipo=>{
      const producto=productos.find(x=>x.tipo===tipo);
      const paquete=paquetes.find(x=>x.tipo===tipo);
      if(!producto||!paquete)return '';
      const estilo=clases[tipo];
      return '<article class="promo-product '+estilo[0]+'">'+
        '<div class="promo-product-top"><span class="promo-product-mark">'+estilo[1]+'</span><span class="promo-product-tag">'+estilo[2]+'</span></div>'+
        '<h2>'+escapeHTML(producto.nombre)+'</h2><p>'+escapeHTML(producto.descripcion||'Promoción independiente para tu aviso.')+'</p>'+
        '<div class="promo-price">

  async function cargarSolicitudes(){
    const s=await client.from('solicitudes_promocion').select('*').eq('usuario_id',usuario.id).order('created_at',{ascending:false});
    if(s.error)throw s.error;
    solicitudes=s.data||[];
    const ids=solicitudes.map(x=>x.id);
    if(!ids.length){pagos=[];promociones=[];renderSolicitudes();return;}
    const [p,m]=await Promise.all([
      client.from('pagos_promocion').select('*').in('solicitud_id',ids).order('created_at',{ascending:false}),
      client.from('promociones').select('*').in('solicitud_id',ids)
    ]);
    if(p.error)throw p.error;if(m.error)throw m.error;
    pagos=p.data||[];promociones=m.data||[];
    renderSolicitudes();
  }

  function renderSolicitudes(){
    const root=$('#promo-mis-solicitudes');
    if(!solicitudes.length){root.innerHTML='<p class="promo-muted">Todavía no tienes solicitudes de promoción.</p>';return;}
    root.innerHTML=solicitudes.map(s=>{
      const st=estados[s.estado]||[s.estado,''];
      const pago=pagos.find(p=>p.solicitud_id===s.id);
      const promo=promociones.find(p=>p.solicitud_id===s.id);
      let extra='';
      if(s.observaciones_admin)extra+='<div class="promo-observations"><strong>Mensaje de El Barrio:</strong><br>'+escapeHTML(s.observaciones_admin)+'</div>';
      if(s.estado==='autorizada'||s.estado==='pago_rechazado'){
        extra+='<form class="promo-payment-form" data-payment-form="'+escapeHTML(s.id)+'">'+
          '<div><label>Método de pago</label><select name="metodo" required><option value="transferencia">Transferencia</option><option value="deposito">Depósito</option></select></div>'+
          '<div><label>Referencia (opcional)</label><input name="referencia" maxlength="120" placeholder="Folio o referencia"></div>'+
          '<div class="full"><label>Comprobante de pago · imagen JPG, PNG o WebP, máximo 5 MB</label><input name="comprobante" type="file" accept="image/jpeg,image/png,image/webp" required></div>'+
          '<button class="promo-button" type="submit">Enviar comprobante</button></form>';
      }else if(s.estado==='pago_reportado'){
        extra+='<p class="promo-muted">Tu comprobante está pendiente de validación.</p>';
      }
      if(promo){
        if(promo.estado==='activacion_pendiente')extra+='<p class="promo-muted">El pago fue verificado. La promoción se activará después de la revisión final del administrador.</p>';
        if(promo.estado==='activa')extra+='<p class="promo-muted">Vigente hasta: <strong>'+fecha(promo.fecha_fin)+'</strong>.</p>';
        if(promo.estado==='vencida')extra+='<p class="promo-muted">Venció el '+fecha(promo.fecha_fin)+'.</p>';
      }
      return '<article class="promo-request"><div class="promo-request-head"><div><h3>'+escapeHTML(s.aviso_titulo_snapshot)+'</h3><p class="promo-request-meta">'+escapeHTML(s.producto_nombre_snapshot)+' · '+escapeHTML(s.paquete_nombre_snapshot)+' · $'+Number(s.precio_snapshot).toFixed(2)+' MXN<br>Solicitada: '+fecha(s.created_at)+'</p></div><span class="promo-state '+st[1]+'">'+escapeHTML(st[0])+'</span></div>'+extra+'</article>';
    }).join('');
  }

  async function crearSolicitud(tipo){
    const avisoId=$('#promo-aviso').value;
    if(!avisoId){feedback('Selecciona primero uno de tus avisos.',true);return;}
    const paquete=paquetes.find(p=>p.tipo===tipo);
    if(!paquete){feedback('El paquete no está disponible.',true);return;}
    const btn=document.querySelector('[data-promo-type="'+tipo+'"]');
    btn.disabled=true;btn.textContent='Enviando…';
    try{
      const {error}=await client.rpc('crear_solicitud_promocion',{
        p_aviso_id:avisoId,p_tipo:tipo,p_paquete_id:paquete.id,p_nota_usuario:null
      });
      if(error)throw error;
      feedback('Solicitud enviada. Espera la revisión antes de realizar el pago.');
      await cargarSolicitudes();
    }catch(error){feedback(error.message||'No se pudo enviar la solicitud.',true);}
    finally{btn.textContent=tipo==='urgente'?'Solicitar Urgente':'Solicitar Destacado';actualizarMetaAviso();}
  }

  async function reportarPago(form){
    const solicitudId=form.dataset.paymentForm;
    const file=form.querySelector('[name="comprobante"]').files[0];
    const metodo=form.querySelector('[name="metodo"]').value;
    const referencia=form.querySelector('[name="referencia"]').value;
    if(!file){feedback('Selecciona la imagen del comprobante.',true);return;}
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024){
      feedback('El comprobante debe ser JPG, PNG o WebP y no superar 5 MB.',true);return;
    }
    const submit=form.querySelector('button[type="submit"]');submit.disabled=true;submit.textContent='Subiendo…';
    try{
      const ext=file.type==='image/jpeg'?'jpg':file.type==='image/png'?'png':'webp';
      const path=usuario.id+'/'+solicitudId+'/'+crypto.randomUUID()+'.'+ext;
      const upload=await client.storage.from('comprobantes-promocion').upload(path,file,{contentType:file.type,upsert:false});
      if(upload.error)throw upload.error;
      const {error}=await client.rpc('reportar_pago_promocion',{
        p_solicitud_id:solicitudId,p_metodo:metodo,p_referencia:referencia||null,p_comprobante_path:path
      });
      if(error)throw error;
      feedback('Comprobante enviado. El pago queda pendiente de validación.');
      await cargarSolicitudes();
    }catch(error){feedback(error.message||'No se pudo reportar el pago.',true);submit.disabled=false;submit.textContent='Enviar comprobante';}
  }

  async function iniciar(){
    await cargarHeader();
    client=await obtenerSupabaseClient();
    usuario=await Auth.requireAuth();
    if(!usuario){window.location.href='/login.html?redirect='+encodeURIComponent('/promocionar.html');return;}
    await Promise.all([cargarAvisos(),cargarCatalogo()]);
    actualizarMetaAviso();
    await cargarSolicitudes();
  }

  document.addEventListener('change',e=>{if(e.target.id==='promo-aviso')actualizarMetaAviso();});
  document.addEventListener('click',e=>{
    const btn=e.target.closest('[data-promo-type]');
    if(btn)crearSolicitud(btn.dataset.promoType);
    if(e.target.id==='promo-refresh')cargarSolicitudes().catch(err=>feedback(err.message,true));
  });
  document.addEventListener('submit',e=>{
    const form=e.target.closest('[data-payment-form]');
    if(form){e.preventDefault();reportarPago(form);}
  });
  iniciar().catch(error=>{console.error(error);feedback(error.message||'No se pudo cargar el módulo.',true);});
})();+Number(paquete.precio).toFixed(2)+' <small>'+escapeHTML(paquete.moneda)+'</small></div>'+
        '<p class="promo-duration">'+Number(paquete.duracion_dias)+' días de vigencia</p>'+
        '<button type="button" class="promo-button" data-promo-type="'+tipo+'">Solicitar '+escapeHTML(producto.nombre)+'</button></article>';
    }).join('')||'<p class="promo-muted">No hay productos de promoción disponibles por el momento.</p>';
    actualizarMetaAviso();
  }

  async function cargarSolicitudes(){
    const s=await client.from('solicitudes_promocion').select('*').eq('usuario_id',usuario.id).order('created_at',{ascending:false});
    if(s.error)throw s.error;
    solicitudes=s.data||[];
    const ids=solicitudes.map(x=>x.id);
    if(!ids.length){pagos=[];promociones=[];renderSolicitudes();return;}
    const [p,m]=await Promise.all([
      client.from('pagos_promocion').select('*').in('solicitud_id',ids).order('created_at',{ascending:false}),
      client.from('promociones').select('*').in('solicitud_id',ids)
    ]);
    if(p.error)throw p.error;if(m.error)throw m.error;
    pagos=p.data||[];promociones=m.data||[];
    renderSolicitudes();
  }

  function renderSolicitudes(){
    const root=$('#promo-mis-solicitudes');
    if(!solicitudes.length){root.innerHTML='<p class="promo-muted">Todavía no tienes solicitudes de promoción.</p>';return;}
    root.innerHTML=solicitudes.map(s=>{
      const st=estados[s.estado]||[s.estado,''];
      const pago=pagos.find(p=>p.solicitud_id===s.id);
      const promo=promociones.find(p=>p.solicitud_id===s.id);
      let extra='';
      if(s.observaciones_admin)extra+='<div class="promo-observations"><strong>Mensaje de El Barrio:</strong><br>'+escapeHTML(s.observaciones_admin)+'</div>';
      if(s.estado==='autorizada'||s.estado==='pago_rechazado'){
        extra+='<form class="promo-payment-form" data-payment-form="'+escapeHTML(s.id)+'">'+
          '<div><label>Método de pago</label><select name="metodo" required><option value="transferencia">Transferencia</option><option value="deposito">Depósito</option></select></div>'+
          '<div><label>Referencia (opcional)</label><input name="referencia" maxlength="120" placeholder="Folio o referencia"></div>'+
          '<div class="full"><label>Comprobante de pago · imagen JPG, PNG o WebP, máximo 5 MB</label><input name="comprobante" type="file" accept="image/jpeg,image/png,image/webp" required></div>'+
          '<button class="promo-button" type="submit">Enviar comprobante</button></form>';
      }else if(s.estado==='pago_reportado'){
        extra+='<p class="promo-muted">Tu comprobante está pendiente de validación.</p>';
      }
      if(promo){
        if(promo.estado==='activacion_pendiente')extra+='<p class="promo-muted">El pago fue verificado. La promoción se activará después de la revisión final del administrador.</p>';
        if(promo.estado==='activa')extra+='<p class="promo-muted">Vigente hasta: <strong>'+fecha(promo.fecha_fin)+'</strong>.</p>';
        if(promo.estado==='vencida')extra+='<p class="promo-muted">Venció el '+fecha(promo.fecha_fin)+'.</p>';
      }
      return '<article class="promo-request"><div class="promo-request-head"><div><h3>'+escapeHTML(s.aviso_titulo_snapshot)+'</h3><p class="promo-request-meta">'+escapeHTML(s.producto_nombre_snapshot)+' · '+escapeHTML(s.paquete_nombre_snapshot)+' · $'+Number(s.precio_snapshot).toFixed(2)+' MXN<br>Solicitada: '+fecha(s.created_at)+'</p></div><span class="promo-state '+st[1]+'">'+escapeHTML(st[0])+'</span></div>'+extra+'</article>';
    }).join('');
  }

  async function crearSolicitud(tipo){
    const avisoId=$('#promo-aviso').value;
    if(!avisoId){feedback('Selecciona primero uno de tus avisos.',true);return;}
    const paquete=paquetes.find(p=>p.tipo===tipo);
    if(!paquete){feedback('El paquete no está disponible.',true);return;}
    const btn=document.querySelector('[data-promo-type="'+tipo+'"]');
    btn.disabled=true;btn.textContent='Enviando…';
    try{
      const {error}=await client.rpc('crear_solicitud_promocion',{
        p_aviso_id:avisoId,p_tipo:tipo,p_paquete_id:paquete.id,p_nota_usuario:null
      });
      if(error)throw error;
      feedback('Solicitud enviada. Espera la revisión antes de realizar el pago.');
      await cargarSolicitudes();
    }catch(error){feedback(error.message||'No se pudo enviar la solicitud.',true);}
    finally{btn.textContent=tipo==='urgente'?'Solicitar Urgente':'Solicitar Destacado';actualizarMetaAviso();}
  }

  async function reportarPago(form){
    const solicitudId=form.dataset.paymentForm;
    const file=form.querySelector('[name="comprobante"]').files[0];
    const metodo=form.querySelector('[name="metodo"]').value;
    const referencia=form.querySelector('[name="referencia"]').value;
    if(!file){feedback('Selecciona la imagen del comprobante.',true);return;}
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024){
      feedback('El comprobante debe ser JPG, PNG o WebP y no superar 5 MB.',true);return;
    }
    const submit=form.querySelector('button[type="submit"]');submit.disabled=true;submit.textContent='Subiendo…';
    try{
      const ext=file.type==='image/jpeg'?'jpg':file.type==='image/png'?'png':'webp';
      const path=usuario.id+'/'+solicitudId+'/'+crypto.randomUUID()+'.'+ext;
      const upload=await client.storage.from('comprobantes-promocion').upload(path,file,{contentType:file.type,upsert:false});
      if(upload.error)throw upload.error;
      const {error}=await client.rpc('reportar_pago_promocion',{
        p_solicitud_id:solicitudId,p_metodo:metodo,p_referencia:referencia||null,p_comprobante_path:path
      });
      if(error)throw error;
      feedback('Comprobante enviado. El pago queda pendiente de validación.');
      await cargarSolicitudes();
    }catch(error){feedback(error.message||'No se pudo reportar el pago.',true);submit.disabled=false;submit.textContent='Enviar comprobante';}
  }

  async function iniciar(){
    await cargarHeader();
    client=await obtenerSupabaseClient();
    usuario=await Auth.requireAuth();
    if(!usuario){window.location.href='/login.html?redirect='+encodeURIComponent('/promocionar.html');return;}
    await Promise.all([cargarAvisos(),cargarCatalogo()]);
    actualizarMetaAviso();
    await cargarSolicitudes();
  }

  document.addEventListener('change',e=>{if(e.target.id==='promo-aviso')actualizarMetaAviso();});
  document.addEventListener('click',e=>{
    const btn=e.target.closest('[data-promo-type]');
    if(btn)crearSolicitud(btn.dataset.promoType);
    if(e.target.id==='promo-refresh')cargarSolicitudes().catch(err=>feedback(err.message,true));
  });
  document.addEventListener('submit',e=>{
    const form=e.target.closest('[data-payment-form]');
    if(form){e.preventDefault();reportarPago(form);}
  });
  iniciar().catch(error=>{console.error(error);feedback(error.message||'No se pudo cargar el módulo.',true);});
})();