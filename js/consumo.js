(() => {
  const $ = (id) => document.getElementById(id);
  const state = $("estado-carga");
  const panel = $("panel-consumo");
  const btn = $("btn-actualizar");
  const QUOTA = 1024 * 1024 * 1024;

  const formatBytes = (bytes) => {
    const n = Number(bytes || 0);
    if (n < 1024) return n.toLocaleString("es-MX") + " B";
    const units = ["KB","MB","GB","TB"];
    let value = n, unit = -1;
    do { value /= 1024; unit++; } while (value >= 1024 && unit < units.length - 1);
    return value.toLocaleString("es-MX",{maximumFractionDigits:2}) + " " + units[unit];
  };
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

  async function iniciar() {
    try {
      const client = await window.__elBarrioGetSupabaseClient();
      const { data: authData, error: authError } = await client.auth.getUser();
      if (authError || !authData?.user?.id) throw new Error("Inicia sesión con una cuenta administradora para consultar este panel.");
      const { data: perfil, error: perfilError } = await client.from("usuarios").select("rol,activo").eq("id",authData.user.id).single();
      if (perfilError || perfil?.rol !== "admin" || perfil?.activo !== true) {
        await client.auth.signOut();
        throw new Error("Acceso restringido. Esta sección es exclusiva para administradores activos.");
      }
      await cargarDatos(client);
      btn.addEventListener("click", () => cargarDatos(client));
    } catch (error) {
      state.textContent = error?.message || "No fue posible validar la sesión.";
      state.classList.add("error");
      btn.disabled = true;
    }
  }

  async function cargarDatos(client) {
    btn.disabled = true;
    btn.textContent = "Actualizando…";
    state.textContent = "Consultando almacenamiento…";
    state.classList.remove("error");
    try {
      const { data, error } = await client.rpc("admin_obtener_consumo_storage");
      if (error) throw error;
      const total = Number(data?.total_bytes || 0);
      const quota = Number(data?.quota_bytes || QUOTA);
      const percent = quota > 0 ? total / quota * 100 : 0;
      const safePercent = Math.min(100,Math.max(0,percent));
      $("total-espacio").textContent = formatBytes(total);
      $("detalle-archivos").textContent = Number(data?.total_files || 0).toLocaleString("es-MX") + " archivos en " + (data?.buckets?.length || 0) + " buckets";
      $("porcentaje").textContent = percent.toLocaleString("es-MX",{maximumFractionDigits:1}) + "%";
      $("barra-uso").style.width = safePercent + "%";
      $("barra-progreso").setAttribute("aria-valuenow",String(Math.round(safePercent)));
      $("barra-progreso").classList.toggle("watch",percent >= 60 && percent < 90);
      $("barra-progreso").classList.toggle("critical",percent >= 90);
      const status = $("estado-uso");
      status.className = "consumo-usage-status";
      if (percent >= 90) { status.textContent = "Nivel crítico. No ampliar cargas hasta recuperar capacidad."; status.classList.add("critical"); }
      else if (percent >= 80) { status.textContent = "Optimización prioritaria. Revisar archivos pesados y políticas de limpieza."; status.classList.add("watch"); }
      else if (percent >= 60) { status.textContent = "Conviene vigilar el crecimiento y revisar los archivos más pesados."; status.classList.add("watch"); }
      else { status.textContent = "Consumo dentro de la zona normal. Mantener las reglas de carga actuales."; }
      $("bucket-grid").innerHTML = (data?.buckets || []).map(bucket => {
        const visibility = bucket.public ? "Público" : "Privado";
        const extra = [Number(bucket.images||0)+" imágenes",Number(bucket.videos||0)+" videos",Number(bucket.files||0)+" archivos"].join(" · ");
        return '<article class="consumo-bucket-card"><div class="consumo-bucket-head"><span class="consumo-bucket-name">'+escapeHtml(bucket.name)+'</span><span class="consumo-bucket-visibility">'+visibility+'</span></div><div class="consumo-bucket-size">'+formatBytes(bucket.bytes)+'</div><div class="consumo-bucket-meta">'+extra+'<br>Límite por archivo: '+(bucket.file_size_limit ? formatBytes(bucket.file_size_limit) : "No definido")+'</div></article>';
      }).join("") || '<p>No hay buckets registrados.</p>';
      const fecha = data?.generated_at ? new Date(data.generated_at) : new Date();
      $("actualizado").textContent = "Actualizado: " + fecha.toLocaleString("es-MX",{dateStyle:"medium",timeStyle:"short"});
      state.hidden = true;
      panel.hidden = false;
    } catch (error) {
      state.hidden = false;
      state.classList.add("error");
      state.textContent = error?.message || "No fue posible consultar el almacenamiento.";
    } finally {
      btn.disabled = false;
      btn.textContent = "Actualizar datos";
    }
  }

  iniciar();
})();