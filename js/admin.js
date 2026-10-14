// ==============================================================
// ADMIN.JS
// ==============================================================
console.log("ℹ️ admin.js: controlador embebido de admin.html activo.");

const EL_BARRIO_TIME_ZONE = "America/Bahia_Banderas";

/* Feedback administrativo sin diálogos nativos del navegador. */
function notificarAdmin(mensaje, tipo) {
  const texto = String(mensaje ?? "");
  const clase = tipo || (/error|obligatorio|no se pudo|no disponible|fall[oó]|rechaz/i.test(texto) ? "error" : "success");
  if (typeof window.elBarrioToast === "function") window.elBarrioToast(texto, clase);
  else console[clase === "error" ? "error" : "log"]("[El Barrio]", texto);
}
function confirmarAdmin(mensaje) {
  return new Promise((resolve) => {
    document.getElementById("confirmacion-admin-overlay")?.remove();
    const overlay = document.createElement("div"); overlay.id = "confirmacion-admin-overlay";
    overlay.style.cssText = "position:fixed;inset:0;z-index:100001;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(15,27,39,.48);backdrop-filter:blur(5px);";
    const dialogo = document.createElement("section"); dialogo.setAttribute("role","alertdialog"); dialogo.setAttribute("aria-modal","true"); dialogo.setAttribute("aria-label","Confirmar acción");
    dialogo.style.cssText = "width:min(100%,390px);box-sizing:border-box;padding:22px;border:1px solid #e1e8ef;border-radius:18px;background:#fff;color:#263746;box-shadow:0 20px 60px rgba(12,24,38,.25);font:500 14px/1.5 system-ui,sans-serif;";
    const texto = document.createElement("p"); texto.textContent = mensaje; texto.style.cssText = "margin:0 0 20px;font-size:15px;";
    const botones = document.createElement("div"); botones.style.cssText = "display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap;";
    let resuelto = false;
    const finalizar = (valor) => { if (resuelto) return; resuelto = true; document.removeEventListener("keydown", teclaEscape); overlay.remove(); resolve(valor); };
    const teclaEscape = (evento) => { if (evento.key === "Escape") finalizar(false); };
    const crearBoton = (etiqueta, confirmar) => { const boton = document.createElement("button"); boton.type = "button"; boton.textContent = etiqueta; boton.style.cssText = "min-height:40px;padding:9px 16px;border:0;border-radius:11px;font:600 13px system-ui;cursor:pointer;background:" + (confirmar ? "#2c3e50;color:#fff;" : "#edf1f5;color:#34495e;"); boton.addEventListener("click", () => finalizar(confirmar)); return boton; };
    botones.append(crearBoton("Cancelar",false),crearBoton("Confirmar",true)); dialogo.append(texto,botones); overlay.appendChild(dialogo);
    overlay.addEventListener("click",(evento) => { if (evento.target === overlay) finalizar(false); }); document.addEventListener("keydown",teclaEscape); document.body.appendChild(overlay); botones.querySelector("button:last-child")?.focus();
  });
}

(function inicializarPerfilAdmin() {
  const escapar = (valor) => {
    const div = document.createElement("div");
    div.textContent = valor == null ? "" : String(valor);
    return div.innerHTML;
  };
  const formatearFecha = (valor) => {
    if (!valor) return "No disponible";
    const fecha = new Date(valor);
    if (Number.isNaN(fecha.getTime())) return String(valor);
    return fecha.toLocaleString("es-MX", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: EL_BARRIO_TIME_ZONE,
    });
  };
  function mostrarPerfil(p) {
    const contenedor = document.getElementById("perfil-info");
    if (!contenedor) return;
    p = p || {};
    const nombre = p.nombre || p.name || "Usuario",
      email = p.email || "No disponible",
      rol = p.rol || "usuario",
      telefono = p.telefono || "No registrado";
    const categorias = Array.isArray(p.categorias)
      ? p.categorias.join(", ")
      : p.categorias || "No registradas";
    contenedor.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;">
        <div class="campo"><label>Nombre</label><div>${escapar(nombre)}</div></div><div class="campo"><label>Correo electrónico</label><div>${escapar(email)}</div></div>
        <div class="campo"><label>Rol</label><div>${escapar(rol)}</div></div><div class="campo"><label>Teléfono</label><div>${escapar(telefono)}</div></div>
        <div class="campo"><label>Categorías</label><div>${escapar(categorias)}</div></div><div class="campo"><label>Estado</label><div>${p.activo === false ? "Inactivo" : "Activo"}</div></div>
        <div class="campo"><label>Fecha de registro</label><div>${escapar(formatearFecha(p.fecha_registro))}</div></div><div class="campo"><label>Último acceso</label><div>${escapar(formatearFecha(p.ultimo_acceso))}</div></div>
        <div class="campo"><label>Puntos de confianza</label><div>${escapar(p.puntos_confianza ?? 0)}</div></div><div class="campo"><label>Nivel</label><div>${escapar(p.nivel || "Sin nivel")}</div></div>
        <div class="campo"><label>Avisos publicados</label><div>${escapar(p.avisos_publicados ?? 0)}</div></div><div class="campo"><label>Reportes recibidos</label><div>${escapar(p.reportes_recibidos ?? 0)}</div></div></div>`;
  }
  async function cargarPerfil() {
    const contenedor = document.getElementById("perfil-info");
    if (!contenedor) return;
    try {
      const local = JSON.parse(localStorage.getItem("usuario") || "null");
      if (local) mostrarPerfil(local);
    } catch (e) {
      console.warn("⚠️ No se pudo leer el perfil local:", e);
    }
    if (!window.supabaseClient) return;
    try {
      const { data: authData, error: authError } =
        await window.supabaseClient.auth.getUser();
      if (authError || !authData?.user?.id) return;
      const { data, error } = await window.supabaseClient
        .from("usuarios")
        .select(
          `id,email,nombre,rol,categorias,activo,telefono,fecha_registro,ultimo_acceso,puntos_confianza,nivel,avisos_publicados,reportes_recibidos,reportes_realizados,votos_positivos_recibidos,votos_negativos_recibidos,fecha_verificacion,sancion_hasta`,
        )
        .eq("id", authData.user.id)
        .maybeSingle();
      if (error) {
        console.error("❌ Error cargando perfil desde Supabase:", error);
        return;
      }
      if (data) mostrarPerfil(data);
    } catch (error) {
      console.error("❌ Error inesperado cargando perfil:", error);
    }
  }
  window.cargarPerfilAdmin = cargarPerfil;
})();

(function inicializarPestanasAdmin() {
  function activarPestana(tabName) {
    const botones = document.querySelectorAll("#admin-tabs .filtro[data-tab]"),
      paneles = document.querySelectorAll(".tab");
    if (!tabName) return;
    botones.forEach((btn) =>
      btn.classList.toggle("activo", btn.dataset.tab === tabName),
    );
    paneles.forEach((panel) =>
      panel.classList.toggle("activo", panel.id === `tab-${tabName}`),
    );
    if (tabName === "perfil" && typeof window.cargarPerfilAdmin === "function")
      window.cargarPerfilAdmin();
    console.log(`📑 Pestaña admin activa: ${tabName}`);
  }
  function instalar() {
    const contenedor = document.getElementById("admin-tabs");
    if (!contenedor) return false;
    contenedor.addEventListener("click", (event) => {
      const boton = event.target.closest(".filtro[data-tab]");
      if (!boton || !contenedor.contains(boton)) return;
      event.preventDefault();
      activarPestana(boton.dataset.tab);
    });
    const inicial = contenedor.querySelector(".filtro.activo[data-tab]");
    if (inicial) activarPestana(inicial.dataset.tab);
    console.log("✅ Navegación de pestañas admin instalada.");
    return true;
  }
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", instalar, { once: true });
  else instalar();
})();

(function inicializarCreacionAviso() {
  const valor = (id) => {
    const e = document.getElementById(id);
    return e ? String(e.value || "").trim() : "";
  };
  async function crearAviso(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    const titulo = valor("titulo"),
      contenido = valor("contenido"),
      categoria = valor("categoria") || "varios";
    if (!titulo) return notificarAdmin("❌ El título del aviso es obligatorio.");
    if (!contenido) return notificarAdmin("❌ La descripción del aviso es obligatoria.");
    const datos = {
      titulo,
      contenido,
      categoria,
      ubicacion: valor("ubicacion"),
      contacto: valor("contacto"),
      destacado: false,
      status: "activo",
    };
    const fechaEvento = valor("fecha_evento");
    if (fechaEvento) datos.fecha_evento = fechaEvento;
    const imagenUrl = valor("imagen_url");
    if (imagenUrl) datos.imagen_url = imagenUrl;
    const videoUrl = valor("video_url");
    if (videoUrl) datos.video_url = videoUrl;
    try {
      const apiKey = localStorage.getItem("api_key"),
        usuario = API.getUsuarioActual();
      if (!apiKey || !usuario?.id)
        throw new Error(
          "Sesión de usuario no disponible. Vuelve a iniciar sesión.",
        );
      const resultado = await API.peticion(
        "CREAR",
        { coleccion: "AVISOS", datos },
        apiKey,
      );
      if (!resultado?.success)
        throw new Error(
          resultado?.error || "Supabase rechazó la creación del aviso.",
        );
      console.log("✅ CREAR AVISO: registro creado:", resultado.data);
      notificarAdmin("✅ Aviso publicado correctamente");
      const form = document.getElementById("form-aviso");
      if (form) form.reset();
      window.location.reload();
    } catch (error) {
      console.error("❌ CREAR AVISO: error:", error);
      notificarAdmin("❌ No se pudo publicar el aviso: " + (error?.message || error));
    }
  }
  function instalar() {
    const form = document.getElementById("form-aviso");
    if (!form) return false;
    form.addEventListener("submit", crearAviso, true);
    console.log("✅ CREAR AVISO: handler Supabase instalado en #form-aviso.");
    return true;
  }
  function intentar() {
    if (instalar()) return;
    setTimeout(instalar, 500);
  }
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", intentar, { once: true });
  else intentar();
})();

(function inicializarEdicionAviso() {
  function instalar() {
    const original = document.getElementById("form-editar");
    if (!original || original.dataset.supabaseEditReady === "1")
      return !!original;
    const form = original.cloneNode(true);
    form.removeAttribute("onsubmit");
    form.dataset.supabaseEditReady = "1";
    original.replaceWith(form);
    form.addEventListener(
      "submit",
      async (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        const obtener = (id) => document.getElementById(id),
          valor = (id) => {
            const el = obtener(id);
            return el ? String(el.value || "").trim() : "";
          },
          id = valor("edit-id");
        if (!id) return notificarAdmin("❌ No se encontró el ID del aviso.");
        const datos = {
          titulo: valor("edit-titulo"),
          contenido: valor("edit-contenido"),
          ubicacion: valor("edit-ubicacion"),
          contacto: valor("edit-contacto"),
          imagen_url: valor("edit-imagen_url"),
          video_url: valor("edit-video_url"),
        };
        const fecha = valor("edit-fecha_evento");
        if (fecha) datos.fecha_evento = fecha.split("T")[0];
        const chkUrgente = obtener("edit-urgente");
        const chkDestacado = obtener("edit-destacado");
        if (chkUrgente) datos.urgente = !!chkUrgente.checked;
        if (chkDestacado) datos.destacado = !!chkDestacado.checked;
        try {
          const apiKey = localStorage.getItem("api_key");
          console.log("✏️ ACTUALIZAR AVISO: enviando:", { id, datos });
          const resultado = await API.peticion(
            "ACTUALIZAR",
            { coleccion: "AVISOS", id, datos },
            apiKey,
          );
          if (!resultado?.success)
            throw new Error(
              resultado?.error || "No se pudo actualizar el aviso.",
            );
          notificarAdmin("✅ Aviso actualizado correctamente");
          const modal = document.getElementById("modal-editar");
          if (modal) modal.style.display = "none";
          location.reload();
        } catch (error) {
          console.error("❌ ACTUALIZAR AVISO:", error);
          notificarAdmin("❌ Error al actualizar: " + (error?.message || error));
        }
      },
      true,
    );
    console.log(
      "✅ EDICIÓN AVISO: formulario legacy aislado y handler Supabase instalado.",
    );
    return true;
  }
  function intentar() {
    if (instalar()) return;
    setTimeout(instalar, 1000);
  }
  setTimeout(intentar, 0);
})();

(function ocultarAvisosEliminadosAdmin() {
  let instalado = false,
    intentos = 0;
  function instalarFiltro() {
    if (instalado) return true;
    if (typeof window.renderizarTablaAvisos !== "function") {
      intentos++;
      if (intentos >= 100) {
        console.warn("⚠️ No se pudo instalar el filtro de avisos eliminados.");
        return true;
      }
      return false;
    }
    const original = window.renderizarTablaAvisos;
    window.renderizarTablaAvisos = function () {
      if (!Array.isArray(todosLosAvisos)) {
        return original.apply(this, arguments);
      }

      const avisosCompletos = todosLosAvisos;
      const avisosVisibles = avisosCompletos.filter(
        (a) => a?.status !== "eliminado",
      );

      todosLosAvisos = avisosVisibles;

      try {
        return original.apply(this, arguments);
      } finally {
        todosLosAvisos = avisosCompletos;
      }
    };
    instalado = true;
    return true;
  }
  const timer = setInterval(() => {
    if (instalarFiltro()) clearInterval(timer);
  }, 100);
  setTimeout(() => clearInterval(timer), 10000);
})();

(function aislarEstilosAdmin() {
  function instalar() {
    document.querySelectorAll('link[rel="stylesheet"]').forEach((hoja) => {
      const href = hoja.getAttribute("href") || "";
      if (href === "/css/index2.css" || href.endsWith("/css/index2.css"))
        hoja.remove();
    });
  }
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", instalar, { once: true });
  else instalar();
})();

// ==============================================================
// MÉTRICAS DEL DASHBOARD ADMIN
// Un único sistema de datos, sin paneles estadísticos duplicados.
// ==============================================================
(function inicializarMetricasAdmin() {
  if (window.__ELBARRIO_METRICAS_ADMIN_INICIADAS__) return;
  window.__ELBARRIO_METRICAS_ADMIN_INICIADAS__ = true;
  let timer = null;
  let ultimoDatos = null;
  let cargando = false;
  let sesionAdminLista = false;
  const DIAS = 30;

  async function asegurarSesionAdmin() {
    if (sesionAdminLista) return true;
    if (!window.Auth || typeof window.Auth.requireAuth !== "function")
      throw new Error("Sistema de autenticación no disponible.");
    const usuario = await window.Auth.requireAuth();
    if (!usuario?.id) throw new Error("Sesión de administrador no disponible.");
    sesionAdminLista = true;
    console.log(
      "🔐 Sesión admin confirmada antes de cargar métricas:",
      usuario.id,
    );
    return true;
  }
  const numero = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  const formatear = (v) => numero(v).toLocaleString("es-MX");
  const escapar = (v) => {
    const d = document.createElement("div");
    d.textContent = v == null ? "" : String(v);
    return d.innerHTML;
  };

  function actualizar(id, v) {
    const e = document.getElementById(id);
    if (e) e.textContent = formatear(v);
  }
  const EL_BARRIO_DATE_PARTS = new Intl.DateTimeFormat("en-CA", {
    timeZone: EL_BARRIO_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  function fechas30() {
    const partes = EL_BARRIO_DATE_PARTS.format(new Date()).split("-").map(Number);
    const hoy = new Date(Date.UTC(partes[0], partes[1] - 1, partes[2]));
    const r = [];
    for (let i = DIAS - 1; i >= 0; i--) {
      const d = new Date(hoy);
      d.setUTCDate(hoy.getUTCDate() - i);
      r.push(d);
    }
    return r;
  }

  function clave(d) {
    return EL_BARRIO_DATE_PARTS.format(d);
  }

  function etiqueta(d) {
    return d.toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "2-digit",
      timeZone: "UTC",
    });
  }

  function canvasSize(canvas) {
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect(),
      ratio = window.devicePixelRatio || 1,
      w = Math.max(320, Math.floor(rect.width || 700)),
      h = 200;
    canvas.width = w * ratio;
    canvas.height = h * ratio;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    return { ctx, w, h };
  }
  function lineChart(canvas, labels, values) {
    const size = canvasSize(canvas);
    if (!size) return;
    const { ctx, w, h } = size;
    ctx.clearRect(0, 0, w, h);
    const pad = { l: 42, r: 18, t: 20, b: 38 },
      cw = w - pad.l - pad.r,
      ch = h - pad.t - pad.b,
      max = Math.max(1, ...values),
      steps = 4;
    ctx.font = "11px system-ui";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let i = 0; i <= steps; i++) {
      const y = pad.t + ch - (ch * i) / steps,
        v = (max * i) / steps;
      ctx.strokeStyle = "rgba(255,255,255,.10)";
      ctx.beginPath();
      ctx.moveTo(pad.l, y);
      ctx.lineTo(w - pad.r, y);
      ctx.stroke();
      ctx.fillStyle = "#888";
      ctx.fillText(Math.round(v).toLocaleString("es-MX"), pad.l - 7, y);
    }
    const pts = values.map((v, i) => {
      const x =
          pad.l +
          (labels.length === 1 ? cw / 2 : (cw * i) / (labels.length - 1)),
        y = pad.t + ch - (v / max) * ch;
      return { x, y };
    });
    ctx.strokeStyle = "#f5b042";
    ctx.lineWidth = 3;
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.stroke();
    pts.forEach((p) => {
      ctx.fillStyle = "#f5b042";
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = "#888";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    labels.forEach((l, i) => {
      if (i % 5 === 0 || i === labels.length - 1) {
        const x =
          pad.l +
          (labels.length === 1 ? cw / 2 : (cw * i) / (labels.length - 1));
        ctx.fillText(l, x, h - pad.b + 9);
      }
    });
  }

  function renderCategorias(avisos) {
    const panel = document.getElementById("chartCategorias"),
      cont = document.getElementById("chartBars"),
      mini = document.getElementById("chartStatsMini");
    if (!panel || !cont) return;
    const mapa = new Map();
    avisos.forEach((a) => {
      const c = String(a.categoria || "varios").trim() || "varios";
      mapa.set(c, (mapa.get(c) || 0) + 1);
    });
    const arr = [...mapa.entries()].sort((a, b) => b[1] - a[1]);
    const max = Math.max(1, ...arr.map((x) => x[1]));
    cont.innerHTML = arr
      .map(
        ([categoria, cantidad]) =>
          `<div class="bar-item"><span class="bar-label">${escapar(categoria)}</span><div class="bar-container"><div class="bar-fill" style="width:${(cantidad / max) * 100}%">${cantidad}</div></div><span class="bar-count">${cantidad}</span></div>`,
      )
      .join("");
    panel.style.display = "block";
    if (mini)
      mini.textContent = `${mapa.size} categorías con avisos · ${formatear(avisos.length)} avisos no eliminados`;
    actualizar("totalCategorias", mapa.size);
  }

  function renderDiarios(usuarios, avisos) {
    const fechas = fechas30(),
      labels = fechas.map(etiqueta),
      mapU = new Map(),
      mapA = new Map();
    usuarios.forEach((x) => {
      if (x.fecha_registro) {
        const k = clave(new Date(x.fecha_registro));
        mapU.set(k, (mapU.get(k) || 0) + 1);
      }
    });
    avisos.forEach((x) => {
      if (x.created_at) {
        const k = clave(new Date(x.created_at));
        mapA.set(k, (mapA.get(k) || 0) + 1);
      }
    });
    const u = fechas.map((d) => mapU.get(clave(d)) || 0),
      a = fechas.map((d) => mapA.get(clave(d)) || 0);
    const panelU = document.getElementById("chartUsuariosDiarios"),
      panelA = document.getElementById("chartAvisosDiarios");
    if (panelU) {
      panelU.style.display = "block";
      lineChart(document.getElementById("chartUsuariosCanvas"), labels, u);
      const s = document.getElementById("usuariosStats");
      if (s)
        s.textContent = `Total en periodo: ${formatear(u.reduce((s, v) => s + v, 0))}`;
    }
    if (panelA) {
      panelA.style.display = "block";
      lineChart(document.getElementById("chartAvisosCanvas"), labels, a);
      const s = document.getElementById("avisosStats");
      if (s)
        s.textContent = `Total en periodo: ${formatear(a.reduce((s, v) => s + v, 0))}`;
    }
    const conexiones = document.getElementById("chartConexionesDiarias");
    if (conexiones) conexiones.style.display = "none";
  }

  function renderOnlineUsers(usuariosOnline) {
    const panel = document.getElementById("chartOnline"),
      lista = document.getElementById("onlineUsersList"),
      badge = document.getElementById("onlineCount");
    if (!panel || !lista || !badge) return;
    panel.style.display = "block";
    badge.textContent = `${usuariosOnline.length} ${usuariosOnline.length === 1 ? "conectado" : "conectados"}`;
    if (!usuariosOnline.length) {
      lista.innerHTML =
        '<p style="color:#888;margin:0;padding:12px 0;">No hay usuarios conectados en este momento.</p>';
      return;
    }
    lista.innerHTML = usuariosOnline
      .map((u) => {
        const nombre = escapar(u.nombre || "Usuario"),
          email = escapar(u.email || ""),
          fecha = u.ultima_actividad ? new Date(u.ultima_actividad) : null,
          tiempo =
            fecha && !Number.isNaN(fecha.getTime())
              ? fecha.toLocaleTimeString("es-MX", {
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: EL_BARRIO_TIME_ZONE,
                })
              : "ahora";
        return `<div class="online-user-item"><div><strong style="color:#eee;">${nombre}</strong>${email ? `<div class="online-user-email">${email}</div>` : ""}</div><span class="online-user-time">● ${tiempo}</span></div>`;
      })
      .join("");
  }

  function actualizarResumen(totalUsuarios, avisosPeriodo) {
    const resumen = document.getElementById("statsSummary");
    if (!resumen) return;
    resumen.style.display = "flex";
    const promU = document.getElementById("promUsuarios"),
      promA = document.getElementById("promAvisos"),
      totalU = document.getElementById("totalUsuarios");
    if (promU) promU.textContent = (totalUsuarios / DIAS).toFixed(1);
    if (promA) promA.textContent = (avisosPeriodo / DIAS).toFixed(1);
    if (totalU) totalU.textContent = formatear(totalUsuarios);
  }

  async function cargar() {
    const footer = document.querySelector(".dashboard-footer");
    if (!footer || typeof getSupabaseClient !== "function") return;
    if (cargando) return;
    try {
      await asegurarSesionAdmin();
    } catch (error) {
      console.error("❌ Admin: sesión no lista para métricas:", error);
      const badge = document.getElementById("onlineCount");
      if (badge) badge.textContent = "No disponible";
      return;
    }
    cargando = true;
    try {
      const client = await getSupabaseClient();
      const [ur, ar, vr, or] = await Promise.all([
        client
          .from("usuarios")
          .select("id,fecha_registro,ultimo_acceso")
          .range(0, 9999),
        client
          .from("avisos")
          .select("id,titulo,categoria,created_at,status,vistas")
          .range(0, 9999),
        client.rpc("obtener_resumen_votos_admin"),
        client.rpc("obtener_usuarios_en_linea_admin"),
      ]);
      if (ur.error) throw ur.error;
      if (ar.error) throw ar.error;
      if (vr.error) throw vr.error;
      if (or.error) throw or.error;
      const usuarios = ur.data || [],
        avisos = (ar.data || []).filter((a) => a.status !== "eliminado");
      const votosRaw =
          typeof vr.data === "string" ? JSON.parse(vr.data) : vr.data || {},
        onlineRaw =
          typeof or.data === "string" ? JSON.parse(or.data) : or.data || {};
      const pos = numero(votosRaw.positivos),
        neg = numero(votosRaw.negativos),
        votos = numero(votosRaw.total ?? pos + neg);
      const usuariosOnline = Array.isArray(onlineRaw)
        ? onlineRaw
        : Array.isArray(onlineRaw.usuarios)
          ? onlineRaw.usuarios
          : [];
      const totalUsuarios = usuarios.length,
        totalAvisos = avisos.length,
        activos = avisos.filter((a) => a.status === "activo").length,
        pendientes = avisos.filter((a) => a.status === "pendiente").length,
        totalVistas = avisos.reduce((s, a) => s + numero(a.vistas), 0),
        fechaCorte = Date.now() - DIAS * 24 * 60 * 60 * 1000,
        avisosPeriodo = avisos.filter((a) => {
          const d = new Date(a.created_at);
          return !Number.isNaN(d.getTime()) && d.getTime() >= fechaCorte;
        }).length;
      actualizar("totalAvisos", totalAvisos);
      actualizar("avisosActivos", activos);
      actualizar("avisosPendientes", pendientes);
      actualizar("totalVisitas", totalVistas);
      actualizar("totalInteracciones", votos);
      actualizar("totalUsuarios", totalUsuarios);
      const card = document.getElementById("pendingCard");
      if (card) card.style.display = pendientes > 0 ? "flex" : "none";
      const cards = document.querySelectorAll(".dashboard-footer .stat-card");
      cards.forEach((card) => {
        const t = card.querySelector("h4"),
          l = card.querySelector(".stat-label");
        if (!t) return;
        const txt = t.textContent.trim().toLowerCase();
        if (txt === "interacciones" || txt === "votos registrados") {
          t.textContent = "Votos registrados";
          if (l) l.textContent = "positivos + negativos";
        }
        if (txt === "total visitas" || txt === "alcance") {
          t.textContent = "Alcance";
          if (l) l.textContent = "vistas acumuladas";
        }
      });
      renderCategorias(avisos);
      renderDiarios(usuarios, avisos);
      renderOnlineUsers(usuariosOnline);
      actualizarResumen(totalUsuarios, avisosPeriodo);
      ultimoDatos = { usuarios, avisos, usuariosOnline };
      console.log("📊 Dashboard admin actualizado:", {
        totalUsuarios,
        totalAvisos,
        activos,
        pendientes,
        totalVistas,
        pos,
        neg,
        votos,
        usuariosOnline: usuariosOnline.length,
      });
    } catch (error) {
      console.error(
        "❌ No se pudieron cargar las métricas del panel admin:",
        error,
      );
      const badge = document.getElementById("onlineCount");
      if (badge) badge.textContent = "No disponible";
    } finally {
      cargando = false;
    }
  }

  function observar() {
    const contenedor = document.getElementById("footer-container");
    if (!contenedor) return;
    const iniciar = () => {
      if (!document.querySelector(".dashboard-footer")) return;
      if (!timer) timer = setInterval(cargar, 15000);
      cargar();
    };
    const obs = new MutationObserver(() => {
      if (document.querySelector(".dashboard-footer")) {
        obs.disconnect();
        iniciar();
      }
    });
    obs.observe(contenedor, { childList: true, subtree: true });
    iniciar();
    window.addEventListener("resize", () => {
      if (!ultimoDatos) return;
      renderDiarios(ultimoDatos.usuarios, ultimoDatos.avisos);
      renderCategorias(ultimoDatos.avisos);
      renderOnlineUsers(ultimoDatos.usuariosOnline || []);
    });
  }
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", observar, { once: true });
  else observar();
})();

// ===== JAVASCRIPT MIGRADO DESDE admin.html =====
// ==================== CONTROL DE ACCESO ====================
(function verificarAcceso() {
  const usuario = API.getUsuarioActual();
  const apiKey = localStorage.getItem("api_key");

  if (!usuario || !apiKey) {
    console.warn("🔒 Acceso denegado: No hay sesión activa");
    window.location.href = "/login.html?redirect=admin.html";
    return;
  }

  console.log(`✅ Acceso concedido como: ${usuario.rol} - ${usuario.email}`);

  if (usuario.rol === "admin") {
    const tabUsuarios = document.getElementById("tab-usuarios-btn");
    if (tabUsuarios) tabUsuarios.style.display = "block";
    console.log("👥 Pestaña de usuarios visible para admin");
  } else {
    console.log("👤 Usuario normal: solo verá sus propios avisos");
  }
})();

document.addEventListener("DOMContentLoaded", function () {
  const modal = document.getElementById("modal-editar");
  const cerrarBtn = document.getElementById("cerrar-modal");
  const cancelarBtn = document.getElementById("cancelar-editar");
  const form = document.getElementById("form-editar");

  if (cerrarBtn) {
    cerrarBtn.onclick = function () {
      if (modal) modal.style.display = "none";
    };
  }
  if (cancelarBtn) {
    cancelarBtn.onclick = function () {
      if (modal) modal.style.display = "none";
    };
  }

  if (modal) {
    modal.onclick = function (e) {
      if (e.target === modal) modal.style.display = "none";
    };
  }

  if (form) {
    form.onsubmit = async function (e) {
      e.preventDefault();
      const id = document.getElementById("edit-id").value;
      const datos = {
        titulo: document.getElementById("edit-titulo").value,
        contenido: document.getElementById("edit-contenido").value,
        ubicacion: document.getElementById("edit-ubicacion").value,
        contacto: document.getElementById("edit-contacto").value,
        fecha_evento: document.getElementById("edit-fecha_evento").value,
        imagen_url: document.getElementById("edit-imagen_url").value,
        video_url: document.getElementById("edit-video_url").value,
      };

      // Solo el administrador puede cambiar las banderas de urgencia y destacado.
      const usuarioActual = API.getUsuarioActual();
      if (usuarioActual?.rol === "admin") {
        datos.urgente = document.getElementById("edit-urgente").checked;
        datos.destacado = document.getElementById("edit-destacado").checked;
      }

      try {
        const apiKey = localStorage.getItem("api_key");
        const resultado = await API.peticion(
          "ACTUALIZAR",
          {
            coleccion: "AVISOS",
            id: id,
            datos: datos,
          },
          apiKey,
        );

        if (resultado && resultado.success) {
          notificarAdmin("✅ Aviso actualizado correctamente");
          modal.style.display = "none";
          location.reload();
        } else {
          notificarAdmin("❌ Error: " + (resultado.error || "No se pudo actualizar"));
        }
      } catch (error) {
        notificarAdmin("❌ Error: " + error.message);
      }
    };
  }
});

// ==================== ADMINISTRACIÓN - CONEXIÓN REAL CON TU API ====================
let todosLosAvisos = [];
let filtroCategoriaActual = "todos";
let filtroStatusActual = "todos";

function escapeHTML(str) {
  if (!str) return "";
  return String(str).replace(/[&<>]/g, function (m) {
    if (m === "&") return "&amp;";
    if (m === "<") return "&lt;";
    if (m === ">") return "&gt;";
    return m;
  });
}

function getCategoriaIcono(categoria) {
  const iconos = {
    urgente: "🚨",
    escuelas: "🏫",
    servicios: "🛠️",
    comercios: "🛒",
    eventos: "📅",
    gobierno: "🏛️",
    varios: "📢",
  };
  return iconos[categoria] || "📢";
}

async function cargarAvisosParaAdmin() {
  const tbody = document.getElementById("tabla-avisos-cuerpo");
  if (tbody)
    tbody.innerHTML =
      '<tr><td colspan="6" style="text-align: center; padding: 15px;">🔄 Cargando avisos...</td></tr>';
  try {
    const apiKey = localStorage.getItem("api_key");
    const usuario = API.getUsuarioActual();
    if (!apiKey || !usuario) {
      if (tbody)
        tbody.innerHTML =
          '<tr><td colspan="6" style="text-align: center; padding: 15px; color: #ff8c42;">⚠️ Necesitas iniciar sesión</td></tr>';
      return;
    }
    console.log(`👤 Usuario logueado: ${usuario.rol} - ${usuario.email}`);
    let respuesta;
    if (usuario.rol === "admin") {
      respuesta = await API.peticion("LISTAR_TODOS_AVISOS", {}, apiKey);
      console.log("📡 Respuesta API:", respuesta);
      console.log("📦 Datos:", respuesta?.data);
      console.log("📦 Datos.datos:", respuesta?.data?.datos);
      if (!respuesta || !respuesta.success)
        respuesta = await API.peticion(
          "LISTAR_MIS_AVISOS",
          { limite: 1000 },
          apiKey,
        );
    } else {
      respuesta = await API.peticion("LISTAR_MIS_AVISOS", {}, apiKey);
    }
    console.log("📡 Respuesta de la API:", respuesta);
    let avisos = [];
    if (respuesta && respuesta.success) {
      if (
        respuesta.data &&
        respuesta.data.datos &&
        Array.isArray(respuesta.data.datos)
      )
        avisos = respuesta.data.datos;
      else if (respuesta.data && Array.isArray(respuesta.data))
        avisos = respuesta.data;
      else if (respuesta.datos && Array.isArray(respuesta.datos))
        avisos = respuesta.datos;
    } else throw new Error(respuesta?.error || "Error al obtener avisos");
    if (!avisos || avisos.length === 0) {
      if (tbody)
        tbody.innerHTML =
          '<tr><td colspan="6" style="text-align: center; padding: 15px;">📭 No tienes avisos registrados aún</td></tr>';
      todosLosAvisos = [];
      return;
    }

    todosLosAvisos = avisos.map((aviso) => ({
      id: aviso.id,
      titulo: aviso.titulo || "Sin título",
      contenido: aviso.contenido || "",
      categoria: aviso.categoria || "varios",
      status: aviso.status || "pendiente",
      contacto: aviso.contacto || "",
      imagen_url: aviso.imagen_url || "",
      video_url: aviso.video_url || "",
      ubicacion: aviso.ubicacion || "",
      fecha_evento: aviso.fecha_evento || "",
      created_at: aviso.created_at,
      urgente:
        aviso.urgente === true ||
        aviso.urgente === "TRUE" ||
        aviso.urgente === 1 ||
        aviso.urgente === "true" ||
        aviso.urgente === "1",
      destacado:
        aviso.destacado === true ||
        aviso.destacado === "TRUE" ||
        aviso.destacado === 1 ||
        aviso.destacado === "true" ||
        aviso.destacado === "1",
      vistas: aviso.vistas || aviso.visitas || 0,
      comentarios_count:
        aviso.comentarios_count || aviso.total_comentarios || 0,
      votos_positivos:
        aviso.votos_positivos || aviso.likes || aviso.puntuacion_positiva || 0,
      votos_negativos:
        aviso.votos_negativos ||
        aviso.dislikes ||
        aviso.puntuacion_negativa ||
        0,
      nombre_autor:
        aviso.nombre_autor || aviso.autor_nombre || aviso.created_by_nombre,
      email: aviso.email || aviso.autor_email || aviso.created_by_email,
    }));

    console.log(`✅ Cargados ${todosLosAvisos.length} avisos`);
    renderizarTablaAvisos();
  } catch (error) {
    console.error("❌ Error:", error);
    if (tbody)
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 15px; color: red;">❌ ${error.message || "Error de conexión"}</td></tr>`;
  }
}

function renderizarTablaAvisos() {
  const tbody = document.getElementById("tabla-avisos-cuerpo");
  if (!tbody) return;
  const usuario = API.getUsuarioActual();
  const esAdmin = usuario?.rol === "admin";
  const esUrgente = (valor) => valor === true || valor === "TRUE" || valor === "true" || valor === 1 || valor === "1";
  let avisosFiltrados = [...todosLosAvisos];
  if (filtroStatusActual !== "todos")
    avisosFiltrados = avisosFiltrados.filter(
      (a) => a.status === filtroStatusActual,
    );
  if (avisosFiltrados.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="6" style="text-align: center; padding: 15px;">🔍 No hay avisos que coincidan con los filtros</td></tr>';
    return;
  }
  tbody.innerHTML = avisosFiltrados
    .map((aviso) => {
      const estado = aviso.status || "pendiente";
      const estadoTexto =
        estado === "activo"
          ? "🟢 Activo"
          : estado === "rechazado"
            ? "🔴 Rechazado"
            : "⏳ Pendiente";
      const nombreAutor =
        aviso.nombre_autor ||
        aviso.autor_nombre ||
        aviso.created_by_nombre ||
        "Usuario";
      const vistas = aviso.vistas || 0;
      const comentarios =
        aviso.comentarios_count || aviso.total_comentarios || 0;
      const votosPos = aviso.votos_positivos || aviso.likes || 0;
      const votosNeg = aviso.votos_negativos || aviso.dislikes || 0;
      const totalVotos = votosPos + votosNeg;
      let fechaFormateada = "Sin fecha";
      if (aviso.created_at) {
        try {
          fechaFormateada = new Date(aviso.created_at).toLocaleString("es-MX", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            timeZone: EL_BARRIO_TIME_ZONE,
          });
        } catch (e) {
          fechaFormateada = aviso.created_at;
        }
      }
      return `<tr data-id="${aviso.id}" onclick="editarAviso('${aviso.id}')" title="Haz clic en la fila para editar este aviso">
            <td data-label="ID">${aviso.id ? String(aviso.id).substring(0, 8) : "N/A"}..</td>
            <td data-label="Imagen" style="text-align: center;">${aviso.imagen_url ? `<img src="${aviso.imagen_url}" style="width: 40px; height: 40px; object-fit: cover; border-radius: 4px;" onerror="this.style.display='none'">` : "📷"}</td>
            <td data-label="Título"><strong>${escapeHTML(aviso.titulo || "Sin título")}</strong><br>
                <div style="font-size: 0.7rem; margin-top: 5px;"><span title="Vistas">🙉 ${vistas}</span><span style="margin-left: 8px;" title="Comentarios">💬 ${comentarios}</span><span style="margin-left: 8px;" title="Votos positivos">👍 ${votosPos}</span><span style="margin-left: 8px;" title="Votos negativos">👎 ${votosNeg}</span>${totalVotos > 0 ? `<span style="margin-left: 8px;" title="Total de votos">📊 ${totalVotos}</span>` : ""}</div>
                <small style="display: block; margin-top: 4px;">📢 ${escapeHTML(String(aviso.categoria || aviso.category || "varios").toUpperCase())}</small>${aviso.video_url ? "<small>🎥 Video</small>" : ""}</td>
            <td data-label="Publicó"><strong>👤 ${escapeHTML(nombreAutor)}</strong><br><small>🕒 ${fechaFormateada}</small>${aviso.email ? `<br><small>📧 ${escapeHTML(aviso.email)}</small>` : ""}</td>
            <td data-label="Estado">${esAdmin ? `<select class="select-estado ${estado}" onclick="event.stopPropagation()" onchange="event.stopPropagation(); cambiarEstadoAviso('${aviso.id}', this.value)"><option value="pendiente" ${estado === "pendiente" ? "selected" : ""}>⏳ Pendiente</option><option value="activo" ${estado === "activo" ? "selected" : ""}>🟢 Activo</option><option value="rechazado" ${estado === "rechazado" ? "selected" : ""}>🔴 Rechazado</option></select>` : `<span class="badge-estado badge-${estado}">${estadoTexto}</span>`}</td>
            <td data-label="Acciones"><div class="acciones-botones">
                    ${
                      esAdmin
                        ? `<button type="button" class="accion-btn accion-icono ${esUrgente(aviso.urgente) ? "accion-activa" : ""}" title="${esUrgente(aviso.urgente) ? "Quitar urgente" : "Marcar urgente"}" aria-label="${esUrgente(aviso.urgente) ? "Quitar urgente" : "Marcar urgente"}" onclick="event.stopPropagation(); cambiarUrgente('${aviso.id}', ${!esUrgente(aviso.urgente)})">❗</button>
                        <button type="button" class="accion-btn accion-icono ${aviso.destacado ? "accion-activa" : ""}" title="${aviso.destacado ? "Quitar destacado" : "Destacar aviso"}" aria-label="${aviso.destacado ? "Quitar destacado" : "Destacar aviso"}" onclick="event.stopPropagation(); cambiarDestacado('${aviso.id}', ${!aviso.destacado})">⭐</button>
                        <button type="button" class="accion-btn accion-icono accion-eliminar" title="Eliminar aviso" aria-label="Eliminar aviso" onclick="event.stopPropagation(); eliminarAviso('${aviso.id}')">🗑️</button>`
                        : ""
                    }</div></td>
        </tr>`;
    })
    .join("");
}

window.cambiarEstadoAviso = async function (id, nuevoStatus) {
  try {
    const apiKey = localStorage.getItem("api_key");
    const usuario = API.getUsuarioActual();
    if (!apiKey || usuario?.rol !== "admin") {
      notificarAdmin("Solo administradores pueden cambiar el estado");
      return;
    }
    console.log(`Cambiando aviso ${id} a ${nuevoStatus}`);
    const resultado = await API.peticion(
      "ACTUALIZAR",
      { coleccion: "AVISOS", id: id, datos: { status: nuevoStatus } },
      apiKey,
    );
    console.log("Respuesta completa:", resultado);
    if (resultado && resultado.success) {
      const index = todosLosAvisos.findIndex((a) => a.id == id);
      if (index !== -1) todosLosAvisos[index].status = nuevoStatus;
      renderizarTablaAvisos();
      notificarAdmin(`✅ Estado actualizado a: ${nuevoStatus}`);
    } else
      notificarAdmin(
        "❌ La API respondió pero no actualizó: " +
          (resultado?.error || "Error desconocido"),
      );
  } catch (error) {
    console.error("Error detallado:", error);
    notificarAdmin("❌ Error: " + error.message);
  }
};

window.cambiarUrgente = async function (id, nuevoValor) {
  try {
    const apiKey = localStorage.getItem("api_key");
    const usuario = API.getUsuarioActual();
    if (!apiKey || usuario?.rol !== "admin") {
      notificarAdmin("Solo administradores pueden activar o desactivar urgente");
      return;
    }
const resultado = await API.peticion(
      "ACTUALIZAR",
      { coleccion: "AVISOS", id, datos: { urgente: nuevoValor } },
      apiKey,
    );
    if (!resultado?.success) throw new Error(resultado?.error || "No se pudo actualizar urgente");
    const valor = !!nuevoValor;
    const index = todosLosAvisos.findIndex((a) => a.id == id);
    if (index !== -1) todosLosAvisos[index].urgente = valor;
    const indexOriginal = avisosOriginales.findIndex((a) => a.id == id);
    if (indexOriginal !== -1) avisosOriginales[indexOriginal].urgente = valor;
    renderizarTablaAvisos();
    notificarAdmin(valor ? "⚠️ Aviso marcado como urgente" : "Se quitó la marca de urgente");
  } catch (error) {
    console.error("Error cambiando urgente:", error);
    notificarAdmin("❌ Error: " + error.message);
  }
};

window.cambiarDestacado = async function (id, nuevoValor) {
  try {
    const apiKey = localStorage.getItem("api_key");
    const usuario = API.getUsuarioActual();
    if (!apiKey || usuario?.rol !== "admin") {
      notificarAdmin("Solo administradores pueden destacar avisos");
      return;
    }
    const accion = nuevoValor ? "destacar" : "quitar el destacado";
    if (!(await confirmarAdmin(`¿Quieres ${accion} este aviso?`))) return;
    console.log(`⭐ Cambiando destacado del aviso ${id} a:`, nuevoValor);
    const resultado = await API.peticion(
      "ACTUALIZAR",
      { coleccion: "AVISOS", id: id, datos: { destacado: nuevoValor } },
      apiKey,
    );
    console.log("Respuesta ACTUALIZAR destacado:", resultado);
    if (resultado && resultado.success) {
      const index = todosLosAvisos.findIndex((a) => a.id == id);
      if (index !== -1) todosLosAvisos[index].destacado = nuevoValor;
      const indexOriginal = avisosOriginales.findIndex((a) => a.id == id);
      if (indexOriginal !== -1)
        avisosOriginales[indexOriginal].destacado = nuevoValor;
      renderizarTablaAvisos();
      notificarAdmin(
        nuevoValor
          ? "⭐ Aviso destacado correctamente"
          : "Aviso retirado de destacados",
      );
    } else
      throw new Error(resultado?.error || "No se pudo actualizar el destacado");
  } catch (error) {
    console.error("Error cambiando destacado:", error);
    notificarAdmin("❌ Error: " + error.message);
  }
};

window.eliminarAviso = async function (id) {
  if (!(await confirmarAdmin("¿Eliminar este aviso?"))) return;
  try {
    const apiKey = localStorage.getItem("api_key");
    const resultado = await API.peticion(
      "ELIMINAR",
      { coleccion: "AVISOS", id: id },
      apiKey,
    );
    if (resultado && resultado.success) {
      todosLosAvisos = todosLosAvisos.filter((a) => a.id != id);
      renderizarTablaAvisos();
      notificarAdmin("✅ Aviso eliminado");
    } else throw new Error(resultado?.error || "Error al eliminar");
  } catch (error) {
    console.error("Error:", error);
    notificarAdmin("❌ Error: " + error.message);
  }
};

window.editarAviso = function (id) {
  console.log("✏️ Editando aviso con ID:", id);
  const aviso = todosLosAvisos.find((a) => a.id == id);
  if (!aviso) {
    console.error("Aviso no encontrado:", id);
    notificarAdmin("No se encontró el aviso");
    return;
  }
  console.log("Aviso encontrado:", aviso);
  const campos = {
    "edit-id": aviso.id,
    "edit-titulo": aviso.titulo || "",
    "edit-contenido": aviso.contenido || "",
    "edit-ubicacion": aviso.ubicacion || "",
    "edit-contacto": aviso.contacto || "",
    "edit-fecha_evento": aviso.fecha_evento || "",
    "edit-imagen_url": aviso.imagen_url || "",
    "edit-video_url": aviso.video_url || "",
  };
  for (const [idCampo, valor] of Object.entries(campos)) {
    const elemento = document.getElementById(idCampo);
    if (elemento) {
      elemento.value = valor;
      console.log(`✅ Campo ${idCampo} asignado:`, valor);
    } else console.warn(`⚠️ Campo ${idCampo} no encontrado en el DOM`);
  }

  const chkUrgente = document.getElementById("edit-urgente");
  const chkDestacado = document.getElementById("edit-destacado");
  const usuarioActual = API.getUsuarioActual();
  const puedeCambiarPromocion = usuarioActual?.rol === "admin";
  if (chkUrgente) {
    chkUrgente.checked = aviso.urgente === true || aviso.urgente === "TRUE" || aviso.urgente === "true" || aviso.urgente === 1 || aviso.urgente === "1";
    chkUrgente.disabled = !puedeCambiarPromocion;
    console.log(`✅ Checkbox urgente: ${chkUrgente.checked}`);
  } else console.warn("⚠️ Campo edit-urgente no encontrado");
  if (chkDestacado) {
    chkDestacado.checked = aviso.destacado === true || aviso.destacado === "TRUE" || aviso.destacado === "true" || aviso.destacado === 1 || aviso.destacado === "1";
    chkDestacado.disabled = !puedeCambiarPromocion;
    console.log(`✅ Checkbox destacado: ${chkDestacado.checked}`);
  } else console.warn("⚠️ Campo edit-destacado no encontrado");

  const vista = document.getElementById("edit-vista-previa");
  if (vista) {
    if (
      aviso.imagen_url &&
      (aviso.imagen_url.startsWith("http://") ||
        aviso.imagen_url.startsWith("https://"))
    )
      vista.innerHTML = `<img src="${aviso.imagen_url}" style="max-width:100%; max-height:180px; border-radius:12px;">`;
    else if (aviso.video_url) {
      let videoEmbed = aviso.video_url;
      if (aviso.video_url.includes("youtube.com/watch?v="))
        videoEmbed = aviso.video_url.replace("watch?v=", "embed/");
      else if (aviso.video_url.includes("youtu.be/")) {
        const videoId = aviso.video_url.split("/").pop();
        videoEmbed = `https://www.youtube.com/embed/${videoId}`;
      } else if (aviso.video_url.includes("cloudinary.com"))
        vista.innerHTML = `<video src="${aviso.video_url}" controls style="max-width:100%; max-height:180px; border-radius:12px;"></video>`;
      else
        vista.innerHTML = `<iframe src="${videoEmbed}" frameborder="0" allowfullscreen style="width:100%; height:180px; border-radius:12px;"></iframe>`;
    } else vista.innerHTML = "";
  } else console.warn("⚠️ edit-vista-previa no encontrado");
  const modal = document.getElementById("modal-editar");
  if (modal) {
    modal.style.display = "flex";
    console.log("✅ Modal abierto");
  } else {
    console.error("❌ Modal no encontrado");
    notificarAdmin("Error: Modal no encontrado");
  }
};

/* aqui va el subir img */
document.addEventListener("DOMContentLoaded", function () {
  setTimeout(cargarAvisosParaAdmin, 500);
  setTimeout(cargarUsuariosAdmin, 500);
  const btnFiltros = document.getElementById("aplicar-filtros"),
    filtroStatus = document.getElementById("filtro-status-admin");
  if (btnFiltros)
    btnFiltros.addEventListener("click", function () {
      filtroStatusActual = filtroStatus?.value || "todos";
      renderizarTablaAvisos();
    });
  if (filtroStatus)
    filtroStatus.addEventListener("change", function () {
      filtroStatusActual = this.value;
      renderizarTablaAvisos();
    });
  document.getElementById("cerrar-modal")?.addEventListener("click", () => {
    document.getElementById("modal-editar").style.display = "none";
  });
  document.getElementById("cancelar-editar")?.addEventListener("click", () => {
    document.getElementById("modal-editar").style.display = "none";
  });
  const tabs = document.querySelectorAll(".filtro");
  tabs.forEach((btn) => {
    btn.addEventListener("click", function () {
      if (this.dataset.tab === "usuarios") cargarUsuariosAdmin();
    });
  });
});

if (typeof UI !== "undefined" && UI.cargarHeader) UI.cargarHeader();
fetch("/common/footer-admin.html?v=20260903-2")
  .then((response) => (response.ok ? response.text() : Promise.reject()))
  .then((data) => {
    const footerContainer = document.getElementById("footer-container");
    if (footerContainer) {
      footerContainer.innerHTML = data;
      const yearSpan = footerContainer.querySelector("#copyright-year");
      if (yearSpan)
        yearSpan.innerHTML = `&copy; ${new Date().getFullYear()} - El Barrio. Todos los derechos reservados.`;
      const scripts = footerContainer.querySelectorAll("script");
      scripts.forEach((oldScript) => {
        const newScript = document.createElement("script");
        newScript.textContent = oldScript.textContent;
        document.body.appendChild(newScript);
        oldScript.remove();
      });
    }
  })
  .catch(() => console.log("Footer no disponible"));
console.log("✅ Script de administración cargado - Conectado a API real");


// Ficha modal de usuario y estadísticas de sus publicaciones.
(function instalarFichaUsuarioAdmin() {
  if (window.__elBarrioFichaUsuarioInstalada) return;
  window.__elBarrioFichaUsuarioInstalada = true;
  const esc = function(v) { const n=document.createElement("span"); n.textContent=v==null?"":String(v); return n.innerHTML; };
  const num = function(v) { const n=Number(v); return Number.isFinite(n)?n:0; };
  const fmt = function(v) { return num(v).toLocaleString("es-MX"); };
  const fecha = function(v) {
    if (!v) return "No disponible";
    const d=new Date(v);
    return Number.isNaN(d.getTime())?esc(v):d.toLocaleString("es-MX",{timeZone:"America/Bahia_Banderas",dateStyle:"medium",timeStyle:"short"});
  };
  function asegurarModal() {
    if (document.getElementById("modal-ficha-usuario")) return;
    const st=document.createElement("style");
    st.id="estilos-modal-ficha-usuario";
    st.textContent = '.fila-usuario-detalle{cursor:pointer}.fila-usuario-detalle:focus-visible{outline:2px solid #4a90a4;outline-offset:2px}'+
      '#modal-ficha-usuario{position:fixed;inset:0;z-index:12000;display:none;align-items:center;justify-content:center;padding:clamp(8px,2vh,22px);box-sizing:border-box;background:rgba(12,24,38,.72);backdrop-filter:blur(10px)}'+
      '#modal-ficha-usuario .fu-panel{width:min(100%,920px);max-height:calc(100dvh - 24px);overflow:auto;box-sizing:border-box;background:linear-gradient(145deg,#fff,#f4f7fb);color:#263849;border:1px solid #fff;border-radius:22px;box-shadow:0 28px 90px rgba(8,20,35,.35);padding:clamp(16px,2.5vw,28px)}'+
      '#modal-ficha-usuario .fu-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;padding-bottom:14px;background:#fff;border-bottom:1px solid #e2eaf1}'+
      '#modal-ficha-usuario .fu-head h2{margin:0;font-size:1.4rem;color:#24384b}#modal-ficha-usuario .fu-sub{margin:5px 0 0;color:#657789;font-size:.85rem;overflow-wrap:anywhere}'+
      '#modal-ficha-usuario .fu-close{border:0;border-radius:50%;width:38px;height:38px;flex:0 0 38px;cursor:pointer;background:#eaf0f5;color:#34495e;font-size:20px}'+
      '#modal-ficha-usuario .fu-section{margin-top:20px}#modal-ficha-usuario .fu-section h3{margin:0 0 11px;font-size:1rem;color:#2c465c}'+
      '#modal-ficha-usuario .fu-fields{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}#modal-ficha-usuario .fu-field{min-width:0;padding:11px 12px;border:1px solid #e3eaf1;border-radius:12px;background:#fff}'+
      '#modal-ficha-usuario .fu-label{display:block;color:#7b8b9a;font-size:.68rem;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px}#modal-ficha-usuario .fu-value{display:block;font-size:.88rem;font-weight:600;overflow-wrap:anywhere}'+
      '#modal-ficha-usuario .fu-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}#modal-ficha-usuario .fu-stat{padding:14px;border-radius:14px;background:#fff;border:1px solid #e2eaf1}'+
      '#modal-ficha-usuario .fu-stat span{display:block;font-size:.7rem;color:#728394;text-transform:uppercase}#modal-ficha-usuario .fu-stat strong{display:block;margin-top:5px;font-size:1.45rem;color:#29465d}'+
      '#modal-ficha-usuario .fu-box{margin-top:12px;padding:14px;border:1px solid #e2eaf1;border-radius:14px;background:#fff}#modal-ficha-usuario .fu-box h4{margin:0 0 10px;font-size:.9rem;color:#344f65}'+
      '#modal-ficha-usuario .fu-chart{display:block;width:100%;height:170px}#modal-ficha-usuario .fu-table-wrap{overflow-x:auto}#modal-ficha-usuario .fu-table{width:100%;border-collapse:collapse;font-size:.78rem}'+
      '#modal-ficha-usuario .fu-table th{text-align:left;white-space:nowrap;background:#edf2f6;padding:9px}#modal-ficha-usuario .fu-table td{padding:9px;border-top:1px solid #e8edf2}#modal-ficha-usuario .fu-num{text-align:right;white-space:nowrap}#modal-ficha-usuario .fu-muted{color:#728394;padding:16px 4px}'+
      '@media(max-width:620px){#modal-ficha-usuario .fu-fields,#modal-ficha-usuario .fu-stats{grid-template-columns:repeat(2,minmax(0,1fr))}#modal-ficha-usuario .fu-panel{border-radius:18px}}@media(max-width:380px){#modal-ficha-usuario .fu-fields{grid-template-columns:1fr}}';
    document.head.appendChild(st);
    const modal=document.createElement("div"); modal.id="modal-ficha-usuario";
    modal.innerHTML='<section class="fu-panel" role="dialog" aria-modal="true" aria-labelledby="fu-titulo">'+
      '<header class="fu-head"><div><h2 id="fu-titulo">Ficha del usuario</h2><p id="fu-subtitulo" class="fu-sub"></p></div><button type="button" class="fu-close" id="fu-cerrar" aria-label="Cerrar ficha">×</button></header>'+
      '<section class="fu-section"><h3>Datos del usuario</h3><div id="fu-datos" class="fu-fields"><div class="fu-muted">Cargando datos…</div></div></section>'+
      '<section class="fu-section"><h3>Estadísticas de sus publicaciones</h3><div class="fu-stats">'+
      '<div class="fu-stat"><span>Publicaciones</span><strong id="fu-total">…</strong></div><div class="fu-stat"><span>Avisos activos</span><strong id="fu-activos">…</strong></div><div class="fu-stat"><span>Vistas totales</span><strong id="fu-vistas">…</strong></div>'+
      '<div class="fu-stat"><span>Votos positivos</span><strong id="fu-positivos">…</strong></div><div class="fu-stat"><span>Votos negativos</span><strong id="fu-negativos">…</strong></div><div class="fu-stat"><span>Interacciones</span><strong id="fu-interacciones">…</strong></div></div>'+
      '<div class="fu-box"><h4>Publicaciones de los últimos 30 días</h4><canvas id="fu-chart" class="fu-chart"></canvas></div>'+
      '<div class="fu-box"><h4>Rendimiento por aviso</h4><div class="fu-table-wrap"><table class="fu-table"><thead><tr><th>Aviso</th><th>Estado</th><th class="fu-num">Vistas</th><th class="fu-num">👍</th><th class="fu-num">👎</th><th class="fu-num">Interacciones</th></tr></thead><tbody id="fu-avisos"><tr><td colspan="6" class="fu-muted">Cargando estadísticas…</td></tr></tbody></table></div></div></section></section>';
    document.body.appendChild(modal);
    const cerrar=function(){modal.style.display="none";document.body.style.overflow="";};
    modal.querySelector("#fu-cerrar").addEventListener("click",cerrar);
    modal.addEventListener("click",function(e){if(e.target===modal)cerrar();});
    document.addEventListener("keydown",function(e){if(e.key==="Escape"&&modal.style.display==="flex")cerrar();});
  }
  function dibujarGrafica(avisos) {
    const canvas=document.getElementById("fu-chart"); if(!canvas)return;
    const ratio=window.devicePixelRatio||1, ancho=Math.max(280,Math.floor(canvas.parentElement.clientWidth-28)), alto=170;
    canvas.width=ancho*ratio;canvas.height=alto*ratio;canvas.style.width="100%";canvas.style.height=alto+"px";
    const ctx=canvas.getContext("2d");ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,ancho,alto);
    const hoyTxt=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Bahia_Banderas",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
    const p=hoyTxt.split("-").map(Number),hoy=new Date(Date.UTC(p[0],p[1]-1,p[2])),dias=[];
    for(let i=29;i>=0;i--){const d=new Date(hoy);d.setUTCDate(hoy.getUTCDate()-i);dias.push(d);}
    const clave=function(v){const d=new Date(v);if(Number.isNaN(d.getTime()))return "";return new Intl.DateTimeFormat("en-CA",{timeZone:"America/Bahia_Banderas",year:"numeric",month:"2-digit",day:"2-digit"}).format(d);};
    const conteo=new Map();avisos.forEach(function(a){const k=clave(a.created_at);if(k)conteo.set(k,(conteo.get(k)||0)+1);});
    const vals=dias.map(function(d){return conteo.get(clave(d))||0;}),max=Math.max(1,...vals),pad={l:32,r:8,t:10,b:28},cw=ancho-pad.l-pad.r,ch=alto-pad.t-pad.b;
    ctx.font="10px system-ui";ctx.textAlign="right";ctx.textBaseline="middle";
    for(let i=0;i<=4;i++){const y=pad.t+ch-ch*i/4;ctx.strokeStyle="#e7edf2";ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(ancho-pad.r,y);ctx.stroke();ctx.fillStyle="#728394";ctx.fillText(String(Math.round(max*i/4)),pad.l-5,y);}
    ctx.strokeStyle="#e5a33b";ctx.lineWidth=2.5;ctx.beginPath();vals.forEach(function(v,i){const x=pad.l+cw*i/(vals.length-1),y=pad.t+ch-(v/max)*ch;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);});ctx.stroke();
    ctx.fillStyle="#e5a33b";vals.forEach(function(v,i){const x=pad.l+cw*i/(vals.length-1),y=pad.t+ch-(v/max)*ch;ctx.beginPath();ctx.arc(x,y,2.5,0,Math.PI*2);ctx.fill();});
    ctx.fillStyle="#728394";ctx.textAlign="center";ctx.textBaseline="top";dias.forEach(function(d,i){if(i%5===0||i===dias.length-1)ctx.fillText(d.toLocaleDateString("es-MX",{day:"2-digit",month:"2-digit",timeZone:"UTC"}),pad.l+cw*i/(dias.length-1),alto-pad.b+7);});
  }
  async function abrirFicha(id) {
    asegurarModal();
    const modal=document.getElementById("modal-ficha-usuario");
    const usuario=(window.__elBarrioUsuariosAdmin||[]).find(function(u){return String(u.id)===String(id);})||{};
    document.getElementById("fu-titulo").textContent=usuario.nombre||usuario.email||"Ficha del usuario";
    document.getElementById("fu-subtitulo").textContent=usuario.email||"Detalle del usuario";
    const campos=[["Nombre",usuario.nombre],["Correo electrónico",usuario.email],["Teléfono",usuario.telefono],["Dirección",usuario.direccion],["Rol",usuario.rol||"usuario"],
      ["Estado",usuario.activo===true||String(usuario.activo).toUpperCase()==="TRUE"?"Activo":"Inactivo"],["Categorías",usuario.categorias],
      ["Registro",fecha(usuario.fecha_registro||usuario.created_at)],["Último acceso",fecha(usuario.ultimo_acceso)],["ID",usuario.id]].filter(function(c){return c[1]!==undefined&&c[1]!==null&&String(c[1]).trim()!=="";});
    document.getElementById("fu-datos").innerHTML=campos.map(function(c){return '<div class="fu-field"><span class="fu-label">'+esc(c[0])+'</span><span class="fu-value">'+esc(c[1])+'</span></div>';}).join("")||'<div class="fu-muted">No hay datos adicionales disponibles.</div>';
    ["fu-total","fu-activos","fu-vistas","fu-positivos","fu-negativos","fu-interacciones"].forEach(function(k){document.getElementById(k).textContent="…";});
    document.getElementById("fu-avisos").innerHTML='<tr><td colspan="6" class="fu-muted">Cargando estadísticas…</td></tr>';
    modal.style.display="flex";document.body.style.overflow="hidden";
    try {
      const client=typeof window.getSupabaseClient==="function"?await window.getSupabaseClient():null;
      if(!client)throw new Error("No está disponible la conexión con Supabase.");
      const r=await client.from("avisos").select("id,titulo,status,created_at,vistas").eq("created_by",id).neq("status","eliminado").order("created_at",{ascending:false});
      if(r.error)throw r.error;
      const lista=r.data||[],votosMap=new Map();let positivos=0,negativos=0;
      if(lista.length){
        const vr=await client.from("votos").select("aviso_id,tipo").in("aviso_id",lista.map(function(a){return a.id;}));
        if(vr.error) console.warn("No se pudieron cargar los votos de este usuario:",vr.error);
        else (vr.data||[]).forEach(function(v){const x=votosMap.get(v.aviso_id)||{positivos:0,negativos:0};if(v.tipo==="positivo"){x.positivos++;positivos++;}if(v.tipo==="negativo"){x.negativos++;negativos++;}votosMap.set(v.aviso_id,x);});
      }
      const vistas=lista.reduce(function(s,a){return s+num(a.vistas);},0),activos=lista.filter(function(a){return a.status==="activo";}).length;
      [["fu-total",lista.length],["fu-activos",activos],["fu-vistas",vistas],["fu-positivos",positivos],["fu-negativos",negativos],["fu-interacciones",positivos+negativos]].forEach(function(p){document.getElementById(p[0]).textContent=fmt(p[1]);});
      dibujarGrafica(lista);
      const tbody=document.getElementById("fu-avisos");
      if(!lista.length)tbody.innerHTML='<tr><td colspan="6" class="fu-muted">Este usuario todavía no tiene publicaciones.</td></tr>';
      else tbody.innerHTML=lista.map(function(a){const v=votosMap.get(a.id)||{positivos:0,negativos:0},s=a.status||"pendiente",label=s==="activo"?"Activo":s==="rechazado"?"Rechazado":s==="pendiente"?"Pendiente":s;
        return '<tr><td><strong>'+esc(a.titulo||"Sin título")+'</strong></td><td>'+esc(label)+'</td><td class="fu-num">'+fmt(a.vistas)+'</td><td class="fu-num">'+fmt(v.positivos)+'</td><td class="fu-num">'+fmt(v.negativos)+'</td><td class="fu-num">'+fmt(v.positivos+v.negativos)+'</td></tr>';}).join("");
    } catch(error) {
      console.error("No se pudo cargar la ficha estadística del usuario:",error);
      document.getElementById("fu-avisos").innerHTML='<tr><td colspan="6" class="fu-muted">No se pudieron cargar las estadísticas: '+esc(error.message||error)+'</td></tr>';
      ["fu-total","fu-activos","fu-vistas","fu-positivos","fu-negativos","fu-interacciones"].forEach(function(k){document.getElementById(k).textContent="—";});
    }
  }
  window.verFichaUsuarioAdmin=abrirFicha;
  function conectarFilas(){
    const tabla=document.getElementById("tabla-usuarios-cuerpo");if(!tabla||tabla.dataset.fichaUsuarioInit==="1")return;tabla.dataset.fichaUsuarioInit="1";
    const activar=function(fila){if(fila&&fila.dataset.userId)abrirFicha(fila.dataset.userId);};
    tabla.addEventListener("click",function(e){if(e.target.closest("button,a,input,select,textarea"))return;activar(e.target.closest("tr.fila-usuario-detalle"));});
    tabla.addEventListener("keydown",function(e){if(e.key!=="Enter"&&e.key!==" ")return;const fila=e.target.closest("tr.fila-usuario-detalle");if(!fila)return;e.preventDefault();activar(fila);});
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",conectarFilas,{once:true});else conectarFilas();
  new MutationObserver(conectarFilas).observe(document.documentElement,{childList:true,subtree:true});
})();

async function cargarUsuariosAdmin() {
  const tablaUsuarios = document.getElementById("tabla-usuarios-cuerpo");
  if (!tablaUsuarios) return;
  try {
    const apiKey = localStorage.getItem("api_key"),
      usuario = API.getUsuarioActual();
    if (!apiKey || usuario?.rol !== "admin") {
      console.warn("No autorizado para ver usuarios");
      tablaUsuarios.innerHTML =
        '<tr><td colspan="6">⚠️ Solo administradores pueden ver esta sección</td></tr>';
      return;
    }
    tablaUsuarios.innerHTML =
      '<tr><td colspan="6">🔄 Cargando usuarios...</td></tr>';
    let respuesta = null,
      accionUsada = "";
    try {
      respuesta = await API.peticion("LISTAR_USUARIOS", {}, apiKey);
      accionUsada = "LISTAR_USUARIOS";
      console.log("Respuesta LISTAR_USUARIOS:", respuesta);
    } catch (e) {
      console.log("LISTAR_USUARIOS falló:", e);
    }
    if (!respuesta || !respuesta.success) {
      try {
        respuesta = await API.peticion("OBTENER_USUARIOS", {}, apiKey);
        accionUsada = "OBTENER_USUARIOS";
        console.log("Respuesta OBTENER_USUARIOS:", respuesta);
      } catch (e) {
        console.log("OBTENER_USUARIOS falló:", e);
      }
    }
    if (!respuesta || !respuesta.success) {
      try {
        respuesta = await API.peticion(
          "LISTAR",
          { coleccion: "USUARIOS" },
          apiKey,
        );
        accionUsada = "LISTAR";
        console.log("Respuesta LISTAR:", respuesta);
      } catch (e) {
        console.log("LISTAR falló:", e);
      }
    }
    if (!respuesta || !respuesta.success) {
      tablaUsuarios.innerHTML = `<tr><td colspan="5">❌ No se pudo cargar usuarios. Acción intentada: ${accionUsada}<br>Error: ${respuesta?.error || "Desconocido"}</td></tr>`;
      return;
    }
    let usuarios = [];
    if (
      respuesta.data &&
      respuesta.data.datos &&
      Array.isArray(respuesta.data.datos)
    )
      usuarios = respuesta.data.datos;
    else if (respuesta.datos && Array.isArray(respuesta.datos))
      usuarios = respuesta.datos;
    else if (Array.isArray(respuesta.data)) usuarios = respuesta.data;
    window.__elBarrioUsuariosAdmin = usuarios;
    if (!usuarios || usuarios.length === 0) {
      tablaUsuarios.innerHTML =
        '<td><td colspan="5">📭 No hay usuarios registrados</td></tr>';
      return;
    }
    usuarios.sort((a, b) => {
      const fechaA =
          a.created_at ||
          a.fecha_registro ||
          a.ultimo_acceso ||
          a.fecha_creacion ||
          0,
        fechaB =
          b.created_at ||
          b.fecha_registro ||
          b.ultimo_acceso ||
          b.fecha_creacion ||
          0,
        fechaAObj = fechaA ? new Date(fechaA) : 0,
        fechaBObj = fechaB ? new Date(fechaB) : 0;
      return fechaBObj - fechaAObj;
    });
    const escapeHtml = (str) => {
      if (!str) return "";
      return String(str).replace(/[&<>]/g, (m) =>
        m === "&" ? "&amp;" : m === "<" ? "&lt;" : "&gt;",
      );
    };
    tablaUsuarios.innerHTML = usuarios
      .map((user) => {
        const email = escapeHtml(user.email || ""),
          nombre = escapeHtml(user.nombre || email.split("@")[0]),
          rol = user.rol === "admin" ? "admin" : "usuario",
          activo =
            user.activo === "TRUE" || user.activo === true
              ? "✅ Activo"
              : "❌ Inactivo",
          fechaRegistro = user.created_at || user.fecha_registro || "",
          fechaMostrar = fechaRegistro
            ? new Date(fechaRegistro).toLocaleDateString("es-MX", { timeZone: EL_BARRIO_TIME_ZONE })
            : "—";
        return `<tr class="fila-usuario-detalle" data-user-id="${escapeHtml(user.id || "")}" tabindex="0" role="button" aria-label="Ver ficha de usuario"><td data-label="Email">${email}${fechaRegistro ? `<br><small style="color:#888;">📅 ${fechaMostrar}</small>` : ""}</td><td data-label="Nombre">${nombre}</td><td data-label="Rol"><span class="rol-badge ${rol === "admin" ? "rol-admin" : "rol-usuario"}">${rol}</span></td><td data-label="Estado">${activo}</td><td data-label="Acciones"><button type="button" class="accion-btn accion-icono accion-eliminar" title="Eliminar usuario" aria-label="Eliminar usuario" onclick="event.stopPropagation();eliminarUsuario('${user.id}')">🗑️</button></td></tr>`;
      })
      .join("");
    console.log(
      `✅ Cargados ${usuarios.length} usuarios (ordenados del más reciente al más antiguo)`,
    );
  } catch (error) {
    console.error("Error cargando usuarios:", error);
    tablaUsuarios.innerHTML = `<tr><td colspan="5">❌ Error: ${error.message}</td></tr>`;
  }
}

window.eliminarUsuario = async function (id) {
  if (!(await confirmarAdmin("⚠️ ¿Desactivar este usuario? Podrá ser reactivado más tarde."))) return;
  try {
    const apiKey = localStorage.getItem("api_key"),
      usuario = API.getUsuarioActual(),
      resultado = await API.peticion(
        "ELIMINAR_USUARIO",
        { id: id, usuario: usuario },
        apiKey,
      );
    if (resultado && resultado.success) {
      notificarAdmin("✅ Usuario desactivado correctamente");
      await cargarUsuariosAdmin();
    } else throw new Error(resultado?.error || "Error al desactivar usuario");
  } catch (error) {
    console.error("Error:", error);
    notificarAdmin("❌ Error: " + error.message);
  }
};

// ===== Multimedia: Supabase Storage como único proveedor =====
const multimediaConfig = {
  bucket: "media",
  imagenes: { mime: ["image/jpeg", "image/png", "image/webp"], extensiones: ["jpg", "jpeg", "png", "webp"], maxBytes: 10 * 1024 * 1024 },
  videos: {
    mime: ["video/mp4", "video/webm", "video/quicktime"],
    extensiones: ["mp4", "webm", "mov"],
    maxBytes: 10 * 1024 * 1024,
    objetivoBytes: 9 * 1024 * 1024,
    duracionMaxSegundos: 30,
    fuenteMaxBytes: 250 * 1024 * 1024
  }
};

async function obtenerClienteMultimedia() {
  if (typeof window.obtenerSupabaseClient === "function") return await window.obtenerSupabaseClient();
  const client = window.supabaseClient || window.__elBarrioSupabaseClient;
  if (client) return client;
  throw new Error("No está disponible la conexión con Supabase.");
}

function nombreArchivoSeguro(nombre) {
  return String(nombre || "archivo").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^\.+/, "").slice(0, 100) || "archivo";
}

async function obtenerDuracionVideo(file) {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.preload = "metadata";
  video.muted = true;
  video.playsInline = true;
  try {
    const duracion = await new Promise((resolve, reject) => {
      video.onloadedmetadata = () => resolve(video.duration);
      video.onerror = () => reject(new Error("No se pudo leer el video. Prueba con MP4, WebM o MOV."));
      video.src = url;
    });
    if (!Number.isFinite(duracion) || duracion <= 0) throw new Error("El video no tiene una duración válida.");
    return duracion;
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}

async function comprimirVideoEnNavegador(file, elementos) {
  const cfg = multimediaConfig.videos;
  if (file.size > cfg.fuenteMaxBytes) throw new Error("El archivo original supera 250 MB. Para evitar bloquear tu navegador, reduce primero el video y vuelve a intentarlo.");
  const duracion = await obtenerDuracionVideo(file);
  if (duracion > cfg.duracionMaxSegundos) throw new Error("El video dura " + Math.ceil(duracion) + " segundos. El máximo para El Barrio es 30 segundos; recórtalo y vuelve a intentarlo.");
  if (file.size <= cfg.objetivoBytes) return file;
  if (!("MediaRecorder" in window) || !HTMLCanvasElement.prototype.captureStream) {
    throw new Error("Este navegador no permite comprimir el video automáticamente. Usa Chrome o Edge actualizado, o comprime el video a menos de 9 MB antes de subirlo.");
  }

  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.preload = "auto";
  video.muted = true;
  video.playsInline = true;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) {
    URL.revokeObjectURL(url);
    throw new Error("No se pudo iniciar el compresor de video en este navegador.");
  }

  let raf = 0, canvasStream = null, audioStream = null, recorder = null;
  try {
    await new Promise((resolve, reject) => {
      video.onloadedmetadata = resolve;
      video.onerror = () => reject(new Error("No se pudo abrir el video para comprimirlo."));
      video.src = url;
    });

    const escala = Math.min(1, 1280 / video.videoWidth, 720 / video.videoHeight);
    canvas.width = Math.max(2, Math.round(video.videoWidth * escala / 2) * 2);
    canvas.height = Math.max(2, Math.round(video.videoHeight * escala / 2) * 2);
    canvasStream = canvas.captureStream(24);
    if (typeof video.captureStream === "function") {
      audioStream = video.captureStream();
      audioStream.getAudioTracks().forEach(track => canvasStream.addTrack(track));
    }

    const tipos = ["video/webm;codecs=vp8,opus", "video/webm;codecs=vp8", "video/webm"];
    const mimeType = tipos.find(type => MediaRecorder.isTypeSupported(type));
    if (!mimeType) throw new Error("Este navegador no admite el formato de compresión WebM requerido. Usa Chrome o Edge actualizado.");

    const bitsObjetivo = cfg.objetivoBytes * 8 * 0.88;
    const tasaTotal = Math.max(220000, Math.min(900000, Math.floor(bitsObjetivo / Math.max(1, duracion))));
    const tasaAudio = 64000;
    const tasaVideo = Math.max(150000, tasaTotal - tasaAudio);
    const partes = [];
    recorder = new MediaRecorder(canvasStream, { mimeType, videoBitsPerSecond: tasaVideo, audioBitsPerSecond: tasaAudio });
    const grabacion = new Promise((resolve, reject) => {
      recorder.ondataavailable = event => { if (event.data && event.data.size) partes.push(event.data); };
      recorder.onerror = () => reject(new Error("Falló la compresión del video. Intenta con un archivo más corto."));
      recorder.onstop = () => resolve(new Blob(partes, { type: recorder.mimeType || "video/webm" }));
    });

    const dibujar = () => {
      if (video.readyState >= 2) ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      if (!video.ended && !video.paused) raf = requestAnimationFrame(dibujar);
    };
    video.currentTime = 0;
    await video.play();
    dibujar();
    recorder.start(500);
    elementos.vista.innerHTML = "<p>Comprimiendo video en este dispositivo…</p><p style='font-size:12px;opacity:.75'>Máximo 30 segundos · 720p · objetivo menor de 9 MB. No cierres esta ventana.</p>";

    await new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        try { if (recorder && recorder.state !== "inactive") recorder.stop(); } catch (_) {}
        reject(new Error("La compresión tardó demasiado. Prueba con un video más corto."));
      }, Math.max(20000, (duracion + 12) * 1000));
      video.onended = () => {
        window.clearTimeout(timeout);
        try { if (recorder && recorder.state !== "inactive") recorder.stop(); } catch (_) {}
        resolve();
      };
      video.onerror = () => {
        window.clearTimeout(timeout);
        reject(new Error("Se interrumpió la lectura del video durante la compresión."));
      };
    });

    const blob = await grabacion;
    if (!blob.size) throw new Error("La compresión no produjo un archivo válido.");
    if (blob.size > cfg.maxBytes) throw new Error("El video sigue pesando más de 10 MB después de comprimirlo. Recórtalo a menos de 30 segundos o reduce la calidad y vuelve a intentarlo.");
    return new File([blob], nombreArchivoSeguro(file.name.replace(/\.[^.]+$/, "")) + ".webm", { type: "video/webm", lastModified: Date.now() });
  } finally {
    if (raf) cancelAnimationFrame(raf);
    try { video.pause(); } catch (_) {}
    if (recorder && recorder.state !== "inactive") { try { recorder.stop(); } catch (_) {} }
    if (canvasStream) canvasStream.getTracks().forEach(track => track.stop());
    if (audioStream) audioStream.getTracks().forEach(track => track.stop());
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}

async function subirMultimediaSupabase(file, tipo, modo, elementos) {
  if (!file || elementos.ocupado) return;
  elementos.ocupado = true;
  const btn = elementos.boton;
  const textoOriginal = btn?.textContent;
  try {
    const cfg = tipo === "imagen" ? multimediaConfig.imagenes : multimediaConfig.videos;
    const extensionOriginal = (file.name.split(".").pop() || "").toLowerCase();
    if (!cfg.mime.includes(file.type.toLowerCase())) {
      throw new Error(tipo === "imagen" ? "Formato no permitido. Usa JPG, PNG o WebP." : "Formato no permitido. Usa MP4, WebM o MOV.");
    }
    if (!cfg.extensiones.includes(extensionOriginal)) throw new Error("La extensión del archivo no está permitida.");
    if (file.size <= 0) throw new Error("El archivo está vacío o no es válido.");
    if (tipo === "imagen" && file.size > cfg.maxBytes) throw new Error("La imagen debe pesar como máximo 10 MB.");
    if (tipo === "video" && file.size > multimediaConfig.videos.fuenteMaxBytes) throw new Error("El archivo original supera 250 MB. Para evitar bloquear tu navegador, reduce primero el video y vuelve a intentarlo.");

    let archivoSubida = file;
    if (tipo === "video") {
      if (btn) { btn.disabled = true; btn.textContent = "Preparando video…"; }
      elementos.vista.innerHTML = "<p>Revisando duración y tamaño del video…</p>";
      archivoSubida = await comprimirVideoEnNavegador(file, elementos);
      if (archivoSubida.size > multimediaConfig.videos.maxBytes) throw new Error("El video final no puede superar 10 MB.");
    }

    const client = await obtenerClienteMultimedia();
    const { data: authData, error: authError } = await client.auth.getUser();
    if (authError) throw authError;
    const uid = authData?.user?.id;
    if (!uid) throw new Error("La sesión de Supabase expiró. Inicia sesión nuevamente.");

    const avisoId = modo === "edicion" ? String(document.getElementById("edit-id")?.value || "").trim() : "nuevo";
    if (modo === "edicion" && !avisoId) throw new Error("No se encontró el ID del aviso que estás editando.");

    if (btn) { btn.disabled = true; btn.textContent = "Subiendo a Supabase…"; }
    elementos.vista.innerHTML = "<p>Subiendo archivo a Supabase…</p>";
    const extension = tipo === "video" && archivoSubida !== file ? "webm" : extensionOriginal;
    const base = nombreArchivoSeguro(file.name.replace(/\.[^.]+$/, ""));
    const ruta = "avisos/" + uid + "/" + avisoId + "/" + Date.now() + "-" + base + "." + extension;

    const { error: uploadError } = await client.storage.from(multimediaConfig.bucket).upload(ruta, archivoSubida, {
      cacheControl: "3600", contentType: archivoSubida.type.toLowerCase(), upsert: false
    });
    if (uploadError) throw uploadError;

    const { data: publicData } = client.storage.from(multimediaConfig.bucket).getPublicUrl(ruta);
    const url = publicData?.publicUrl;
    if (!url) throw new Error("Supabase no devolvió la URL pública del archivo.");

    elementos.campoImagen.value = tipo === "imagen" ? url : "";
    elementos.campoVideo.value = tipo === "video" ? url : "";
    elementos.vista.innerHTML = tipo === "imagen"
      ? '<img src="' + url + '" alt="Imagen subida" style="max-width:100%;max-height:180px;border-radius:12px;object-fit:contain;"><p style="color:green;font-size:12px;">Imagen subida a Supabase. Guarda el aviso para conservar el enlace.</p>'
      : '<video src="' + url + '" controls playsinline style="max-width:100%;max-height:180px;border-radius:12px;"></video><p style="color:green;font-size:12px;">Video preparado y subido a Supabase (' + (archivoSubida.size / 1024 / 1024).toFixed(2) + ' MB). Guarda el aviso para conservar el enlace.</p>';
    if (window.API?.mostrarExito) API.mostrarExito("Archivo subido correctamente a Supabase.");
    console.log("Multimedia subida a Supabase:", { tipo, ruta, bytes: archivoSubida.size });
  } catch (error) {
    console.error("Error subiendo multimedia a Supabase:", error);
    const mensaje = error?.message || String(error);
    const p = document.createElement("p");
    p.style.cssText = "color:#b42318;font-size:12px;";
    p.textContent = "No se pudo subir a Supabase: " + mensaje;
    elementos.vista?.appendChild(p);
    if (window.API?.mostrarError) API.mostrarError(mensaje);
    else notificarAdmin("No se pudo subir el archivo a Supabase: " + mensaje);
  } finally {
    elementos.ocupado = false;
    if (btn) { btn.disabled = false; btn.textContent = textoOriginal || (tipo === "imagen" ? "Imagen" : "Video"); }
    if (elementos.input) elementos.input.value = "";
  }
}
function conectarControlesMultimedia(config) {
  const { input, botonImagen, botonVideo, vista, campoImagen, campoVideo, modo } = config;
  if (!input || !botonImagen || !botonVideo || !vista || !campoImagen || !campoVideo) return;
  const estado = { ocupado: false, boton: null, vista, campoImagen, campoVideo, input };
  const seleccionar = (tipo, boton, accept) => event => {
    event.preventDefault();
    if (estado.ocupado) return;
    estado.boton = boton;
    input.accept = accept;
    input.dataset.tipoMultimedia = tipo;
    input.click();
  };
  botonImagen.addEventListener("click", seleccionar("imagen", botonImagen, "image/jpeg,image/png,image/webp"));
  botonVideo.addEventListener("click", seleccionar("video", botonVideo, "video/mp4,video/webm,video/quicktime"));
  input.addEventListener("change", async () => {
    const file = input.files?.[0], tipo = input.dataset.tipoMultimedia;
    if (!file || !tipo) return;
    campoImagen.value = ""; campoVideo.value = "";
    await subirMultimediaSupabase(file, tipo, modo, estado);
  });
}

conectarControlesMultimedia({
  input: document.getElementById("archivo-multimedia"), botonImagen: document.getElementById("btn-seleccionar-imagen"),
  botonVideo: document.getElementById("btn-seleccionar-video"), vista: document.getElementById("vista-previa-multimedia"),
  campoImagen: document.getElementById("imagen_url"), campoVideo: document.getElementById("video_url"), modo: "nuevo"
});
conectarControlesMultimedia({
  input: document.getElementById("edit-archivo-multimedia"), botonImagen: document.getElementById("edit-btn-imagen"),
  botonVideo: document.getElementById("edit-btn-video"), vista: document.getElementById("edit-vista-previa"),
  campoImagen: document.getElementById("edit-imagen_url"), campoVideo: document.getElementById("edit-video_url"), modo: "edicion"
});
// ===== Fin de multimedia Supabase =====

document.getElementById("form-aviso")?.addEventListener("submit", function () {
  document.getElementById("categoria").value = "varios";
});
document.getElementById("form-editar")?.addEventListener("submit", function () {
  const categoria = document.getElementById("edit-categoria");
  if (categoria) categoria.value = "varios";
});
(function actualizarHeaderForce() {
  const usuario = API.getUsuarioActual();
  if (usuario && window.actualizarHeaderPorSesion)
    setTimeout(() => {
      window.actualizarHeaderPorSesion();
    }, 100);
})();
function abrirModalCategorias() {
  const modal = document.getElementById("modalCategorias");
  if (modal) {
    modal.style.display = "flex";
    document.body.style.overflow = "hidden";
  } else console.warn("Modal no encontrado");
}
function cerrarModalCategorias() {
  const modal = document.getElementById("modalCategorias");
  if (modal) {
    modal.style.display = "none";
    document.body.style.overflow = "";
  }
}
document.addEventListener("click", function (event) {
  const modal = document.getElementById("modalCategorias");
  if (modal && modal.style.display === "flex" && event.target === modal)
    cerrarModalCategorias();
});
let busquedaActual = "",
  avisosOriginales = [],
  usuariosOriginales = [];
function buscarEnAviso(aviso, termino) {
  const texto = termino.toLowerCase(),
    campos = [
      aviso.titulo,
      aviso.contenido,
      aviso.categoria,
      aviso.contacto,
      aviso.ubicacion,
      aviso.id,
      aviso.created_by,
      aviso.email,
      aviso.status,
      aviso.fecha_evento,
    ];
  return campos.some(
    (campo) => campo && campo.toString().toLowerCase().includes(texto),
  );
}
function buscarEnUsuario(usuario, termino) {
  const texto = termino.toLowerCase(),
    campos = [
      usuario.email,
      usuario.nombre,
      usuario.rol,
      usuario.id,
      usuario.telefono,
      usuario.direccion,
    ];
  return campos.some(
    (campo) => campo && campo.toString().toLowerCase().includes(texto),
  );
}
function actualizarResultadosBusqueda(texto, total) {
  const resultadosDiv = document.getElementById("resultados-busqueda");
  if (!resultadosDiv) return;
  if (texto && total !== undefined) {
    resultadosDiv.innerHTML = `<span>🔍 ${total} resultado${total !== 1 ? "s" : ""} encontrado${total !== 1 ? "s" : ""} para "${escapeHTML(texto)}"</span>`;
    resultadosDiv.style.display = "block";
  } else resultadosDiv.style.display = "none";
}
function aplicarBusqueda() {
  const input = document.getElementById("buscadorAdmin");
  if (!input) return;
  const texto = input.value.trim();
  busquedaActual = texto;
  const limpiarBtn = document.getElementById("limpiarBusqueda");
  if (limpiarBtn) limpiarBtn.style.display = texto ? "block" : "none";
  const tabActivo = document.querySelector(".tab.activo"),
    esTabAvisos = tabActivo && tabActivo.id === "tab-lista",
    esTabUsuarios = tabActivo && tabActivo.id === "tab-usuarios";
  if (!texto) {
    if (esTabAvisos && avisosOriginales.length) {
      todosLosAvisos = [...avisosOriginales];
      renderizarTablaAvisos();
    }
    if (esTabUsuarios && usuariosOriginales.length)
      awaitOriginalCargarUsuarios();
    actualizarResultadosBusqueda("", 0);
    return;
  }
  if (esTabAvisos && avisosOriginales.length) {
    const avisosFiltrados = avisosOriginales.filter((a) =>
      buscarEnAviso(a, texto),
    );
    todosLosAvisos = [...avisosFiltrados];
    renderizarTablaAvisos();
    actualizarResultadosBusqueda(texto, avisosFiltrados.length);
  } else if (esTabUsuarios && usuariosOriginales.length) {
    const usuariosFiltrados = usuariosOriginales.filter((u) =>
        buscarEnUsuario(u, texto),
      ),
      tablaUsuarios = document.getElementById("tabla-usuarios-cuerpo");
    if (tablaUsuarios) {
      if (usuariosFiltrados.length === 0)
        tablaUsuarios.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px;">🔍 No se encontraron usuarios que coincidan con "${escapeHTML(texto)}"</td></tr>`;
      else {
        const escapeHtml = (str) => {
          if (!str) return "";
          return String(str).replace(/[&<>]/g, (m) =>
            m === "&" ? "&amp;" : m === "<" ? "&lt;" : "&gt;",
          );
        };
        tablaUsuarios.innerHTML = usuariosFiltrados
          .map(
            (user) =>
              `<tr class="fila-usuario-detalle" data-user-id="${escapeHtml(user.id || "")}" tabindex="0" role="button" aria-label="Ver ficha de usuario"><td data-label="Email">${escapeHtml(user.email || "")}</td><td data-label="Nombre">${escapeHtml(user.nombre || "")}</td><td data-label="Rol"><span class="rol-badge ${user.rol === "admin" ? "rol-admin" : "rol-usuario"}">${user.rol || "usuario"}</span></td><td data-label="Estado">${user.activo === "TRUE" || user.activo === true ? "✅ Activo" : "❌ Inactivo"}</td><td data-label="Acciones"><button type="button" class="accion-btn accion-icono accion-eliminar" title="Eliminar usuario" aria-label="Eliminar usuario" onclick="event.stopPropagation();eliminarUsuario('${user.id}')">🗑️</button></td></tr>`,
          )
          .join("");
      }
    }
    actualizarResultadosBusqueda(texto, usuariosFiltrados.length);
  }
}
function limpiarBusqueda() {
  const input = document.getElementById("buscadorAdmin");
  if (input) {
    input.value = "";
    aplicarBusqueda();
  }
}

function guardarCopiasOriginales() {
  if (todosLosAvisos.length && avisosOriginales.length === 0)
    avisosOriginales = [...todosLosAvisos];
  const tabla = document.getElementById("tabla-usuarios-cuerpo");
  if (tabla && usuariosOriginales.length === 0) {
    const filas = tabla.querySelectorAll("tr"),
      usuarios = [];
    for (let i = 0; i < filas.length; i++) {
      const celdas = filas[i].querySelectorAll("td");
      if (celdas.length >= 5 && !filas[i].querySelector("td[colspan]"))
        usuarios.push({
          email: celdas[0]?.textContent?.split("📅")[0]?.trim() || "",
          nombre: celdas[1]?.textContent || "",
          rol: celdas[2]?.textContent?.includes("admin") ? "admin" : "usuario",
          activo: celdas[3]?.textContent?.includes("Activo") ? "TRUE" : "FALSE",
          id:
            celdas[4]
              ?.querySelector("button")
              ?.getAttribute("onclick")
              ?.match(/'([^']+)'/)?.[1] || "",
        });
    }
    if (usuarios.length) usuariosOriginales = usuarios;
  }
}
async function awaitOriginalCargarUsuarios() {
  if (usuariosOriginales.length) {
    const tablaUsuarios = document.getElementById("tabla-usuarios-cuerpo");
    if (tablaUsuarios) {
      const escapeHtml = (str) => {
        if (!str) return "";
        return String(str).replace(/[&<>]/g, (m) =>
          m === "&" ? "&amp;" : m === "<" ? "&lt;" : "&gt;",
        );
      };
      tablaUsuarios.innerHTML = usuariosOriginales
        .map(
          (user) =>
            `<tr class="fila-usuario-detalle" data-user-id="${escapeHtml(user.id || "")}" tabindex="0" role="button" aria-label="Ver ficha de usuario"><td data-label="Email">${escapeHtml(user.email || "")}</td><td data-label="Nombre">${escapeHtml(user.nombre || "")}</td><td data-label="Rol"><span class="rol-badge ${user.rol === "admin" ? "rol-admin" : "rol-usuario"}">${user.rol || "usuario"}</span></td><td data-label="Estado">${user.activo === "TRUE" || user.activo === true ? "✅ Activo" : "❌ Inactivo"}</td><td data-label="Acciones"><button type="button" class="accion-btn accion-icono accion-eliminar" title="Eliminar usuario" aria-label="Eliminar usuario" onclick="event.stopPropagation();eliminarUsuario('${user.id}')">🗑️</button></td></tr>`,
        )
        .join("");
    }
  } else await cargarUsuariosAdmin();
}
function inicializarBuscador() {
  const input = document.getElementById("buscadorAdmin");
  if (!input) return;
  const nuevoInput = input.cloneNode(true);
  input.parentNode.replaceChild(nuevoInput, input);
  nuevoInput.addEventListener("input", aplicarBusqueda);
  nuevoInput.addEventListener("keyup", (e) => {
    if (e.key === "Escape") limpiarBusqueda();
  });
  const limpiarBtn = document.getElementById("limpiarBusqueda");
  if (limpiarBtn) {
    const nuevoBtn = limpiarBtn.cloneNode(true);
    limpiarBtn.parentNode.replaceChild(nuevoBtn, limpiarBtn);
    nuevoBtn.addEventListener("click", limpiarBusqueda);
  }
}
const originalCargarAvisos = window.cargarAvisosParaAdmin;
window.cargarAvisosParaAdmin = async function () {
  await originalCargarAvisos();
  if (todosLosAvisos.length && avisosOriginales.length === 0)
    avisosOriginales = [...todosLosAvisos];
  inicializarBuscador();
};
const originalCargarUsuariosGlobal = window.cargarUsuariosAdmin;
window.cargarUsuariosAdmin = async function () {
  await originalCargarUsuariosGlobal();
  setTimeout(guardarCopiasOriginales, 300);
};
function controlarVisibilidadBuscador() {
  const buscador = document.querySelector(".buscador-universal");
  if (!buscador) return;
  const tabActivo = document.querySelector(".tab.activo"),
    esVisible =
      tabActivo &&
      (tabActivo.id === "tab-lista" || tabActivo.id === "tab-usuarios");
  buscador.style.display = esVisible ? "block" : "none";
  if (!esVisible) {
    const input = document.getElementById("buscadorAdmin");
    if (input && input.value.trim()) {
      input.value = "";
      aplicarBusqueda();
    }
  }
}
const observer = new MutationObserver(() => {
  controlarVisibilidadBuscador();
});
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    agregarResultadosDiv();
    inicializarBuscador();
    controlarVisibilidadBuscador();
    const tabs = document.querySelectorAll(".tab");
    tabs.forEach((tab) =>
      observer.observe(tab, { attributes: true, attributeFilter: ["class"] }),
    );
    document.querySelectorAll(".filtro").forEach((btn) => {
      btn.addEventListener("click", () => {
        setTimeout(() => {
          controlarVisibilidadBuscador();
          guardarCopiasOriginales();
        }, 100);
      });
    });
  }, 500);
});
function agregarResultadosDiv() {
  if (!document.getElementById("resultados-busqueda")) {
    const wrapper = document.querySelector(".buscador-universal");
    if (wrapper) {
      const div = document.createElement("div");
      div.id = "resultados-busqueda";
      div.className = "resultados-busqueda";
      wrapper.appendChild(div);
    }
  }
}
(function controlarBuscadorPorPestana() {
  const buscador = document.querySelector(".buscador-universal");
  if (!buscador) return;
  function actualizarBuscador() {
    const tabActivo = document.querySelector(".tab.activo");
    const esAvisos = tabActivo && tabActivo.id === "tab-lista",
      esUsuarios = tabActivo && tabActivo.id === "tab-usuarios";
    buscador.style.display = esAvisos || esUsuarios ? "block" : "none";
  }
  document
    .querySelectorAll(".filtro")
    .forEach((btn) =>
      btn.addEventListener("click", () => setTimeout(actualizarBuscador, 50)),
    );
  actualizarBuscador();
})();
// ===== FIN JAVASCRIPT MIGRADO DESDE admin.html =====
