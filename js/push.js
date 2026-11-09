// ============================================================
// EL BARRIO · Web Push nativo + Supabase
// Sin Firebase
// ============================================================

(function () {
  "use strict";

  // Clave pública VAPID. La privada NUNCA debe estar en el frontend.
  const VAPID_PUBLIC_KEY =
    "BAQSRvXYrby2lYZchAzPMDRggkh8K379cIMsmzhDzzZKf8hZZ2h9-xtxltSZlL5NBXLzsv4ZFEQURVrO8_9y4OA";

  const SERVICE_WORKER_URL = "/sw.js";

  // v7: rotación de pareja VAPID; recrea la suscripción con la nueva clave pública.
  const PUSH_VAPID_VERSION = "v7";
  const PUSH_ENDPOINT_KEY = "elbarrio_push_endpoint_v1";

  function base64UrlToUint8Array(base64UrlData) {
    const padding = "=".repeat((4 - (base64UrlData.length % 4)) % 4);
    const base64 = (base64UrlData + padding)
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    const rawData = atob(base64);
    return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
  }

  async function esperarServiceWorkerActivo(registration) {
    if (registration.active) return registration;

    const worker = registration.installing || registration.waiting;

    if (!worker) {
      throw new Error("El Service Worker no tiene worker activo");
    }

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Tiempo agotado esperando al Service Worker"));
      }, 10000);

      worker.addEventListener("statechange", () => {
        if (worker.state === "activated") {
          clearTimeout(timeout);
          resolve();
        }

        if (worker.state === "redundant") {
          clearTimeout(timeout);
          reject(new Error("El Service Worker quedó en estado redundant"));
        }
      });
    });

    return registration;
  }

  async function obtenerCliente() {
    if (typeof getSupabaseClient === "function") return getSupabaseClient();
    if (typeof obtenerSupabaseClient === "function")
      return obtenerSupabaseClient();
    if (window.__elBarrioSupabaseClient) return window.__elBarrioSupabaseClient;
    throw new Error("Cliente Supabase no disponible");
  }

  async function obtenerUsuarioAutenticado() {
    const client = await obtenerCliente();
    const { data, error } = await client.auth.getUser();
    if (error) throw error;
    return data?.user || null;
  }

  function bufferABase64(buffer) {
    return btoa(String.fromCharCode(...new Uint8Array(buffer)));
  }

  async function registrarSuscripcion(subscription, usuarioId) {
    const keys = subscription.getKey
      ? {
          p256dh: subscription.getKey("p256dh"),
          auth: subscription.getKey("auth"),
        }
      : null;

    if (!keys?.p256dh || !keys?.auth) {
      throw new Error("La suscripción Web Push no contiene sus claves");
    }

    const client = await obtenerCliente();
    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    const authenticatedUserId = sessionData?.session?.user?.id;

    if (sessionError || !accessToken || !authenticatedUserId) {
      throw sessionError || new Error("No hay una sesión autenticada para registrar las notificaciones");
    }
    if (String(authenticatedUserId) !== String(usuarioId)) {
      throw new Error("La cuenta activa cambió. Vuelve a iniciar sesión para sincronizar las notificaciones.");
    }

    const payload = {
      endpoint: subscription.endpoint,
      p256dh: bufferABase64(keys.p256dh),
      auth: bufferABase64(keys.auth),
      user_agent: navigator.userAgent,
    };

    const response = await fetch("https://gnjaumpjerbbwlkcgxqa.supabase.co/functions/v1/register-push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": "sb_publishable_x01F_xzyh5b-sZdwhKh6FQ_OzQVxMpN",
        "Authorization": "Bearer " + accessToken,
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result?.success) {
      throw new Error(result?.error || "No se pudo asociar este navegador a tu cuenta");
    }

    return true;
  }

  async function sincronizarSuscripcion({ forzarMigracion = false } = {}) {
    const usuario = await obtenerUsuarioAutenticado();

    if (!usuario?.id) return false;

    const registration = await navigator.serviceWorker.register(
      SERVICE_WORKER_URL,
      { scope: "/" },
    );

    await esperarServiceWorkerActivo(registration);

    let subscription = await registration.pushManager.getSubscription();

    const versionMigrada = localStorage.getItem("elbarrio_push_vapid_version");
    const endpointRegistrado =
      localStorage.getItem(PUSH_ENDPOINT_KEY) || "";

    const debeMigrar =
      forzarMigracion ||
      versionMigrada !== PUSH_VAPID_VERSION ||
      (endpointRegistrado &&
        subscription &&
        endpointRegistrado !== subscription.endpoint);

    if (subscription && debeMigrar) {
      console.log("Web Push: migrando suscripción al estado vigente...");

      try {
        await subscription.unsubscribe();
      } catch (error) {
        console.warn(
          "Web Push: no se pudo cancelar la suscripción anterior:",
          error,
        );
      }

      subscription = null;
    }

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    await registrarSuscripcion(subscription, usuario.id);

    localStorage.setItem(
      "elbarrio_push_vapid_version",
      PUSH_VAPID_VERSION,
    );
    localStorage.setItem(PUSH_ENDPOINT_KEY, subscription.endpoint);

    console.log("Web Push: suscripción sincronizada correctamente.", {
      proveedor:
        subscription.endpoint.includes("fcm.googleapis.com")
          ? "FCM"
          : subscription.endpoint.includes("wns")
            ? "WNS"
            : "OTRO",
    });

    return true;
  }

  async function registrarPush() {
    if (
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    ) {
      console.info("Web Push no está disponible en este navegador.");
      return false;
    }

    return sincronizarSuscripcion();
  }

  async function activarPush() {
    if (!("Notification" in window)) {
      if (typeof showToast === "function")
        showToast("Este navegador no admite notificaciones.", 2500);
      return false;
    }

    if (Notification.permission === "denied") {
      if (typeof showToast === "function")
        showToast(
          "Las notificaciones están bloqueadas en este navegador.",
          3000,
        );
      return false;
    }

    const permiso =
      Notification.permission === "granted"
        ? "granted"
        : await Notification.requestPermission();

    if (permiso !== "granted") {
      if (typeof showToast === "function")
        showToast("No se activaron las notificaciones.", 2000);
      return false;
    }

    try {
      const guardado = await sincronizarSuscripcion({
        forzarMigracion: true,
      });

      if (guardado) localStorage.setItem("elbarrio_push_enabled", "true");
      if (guardado && typeof showToast === "function")
        showToast("Notificaciones activadas", 2200);

      actualizarControlPush();
      return guardado;
    } catch (error) {
      console.error("Web Push:", error);

      if (typeof showToast === "function")
        showToast("No se pudieron activar las notificaciones.", 2500);

      return false;
    }
  }

  async function sincronizarPushSiYaExiste() {
    try {
      if (!preferenciasPushActivas()) return false;
      if (
        !("Notification" in window) ||
        Notification.permission !== "granted"
      ) {
        return false;
      }

      for (let intento = 1; intento <= 4; intento++) {
        try {
          return await registrarPush();
        } catch (error) {
          if (intento === 4) throw error;

          await new Promise((resolve) =>
            setTimeout(resolve, intento * 1500),
          );
        }
      }

      return false;
    } catch (error) {
      console.warn(
        "Web Push: no se pudo sincronizar la suscripción:",
        error,
      );
      return false;
    }
  }

  function actualizarControlPush() {
    const usuario = localStorage.getItem("usuario");
    const userArea = document.getElementById("user-area");
    if (!userArea) return;

    let boton = document.getElementById("btn-elbarrio-push");

    if (!usuario) {
      if (boton) boton.remove();
      return;
    }

    if (!boton) {
      boton = document.createElement("button");
      boton.id = "btn-elbarrio-push";
      boton.type = "button";
      boton.style.cssText =
        "border:0;background:transparent;cursor:pointer;font-size:1.05rem;padding:6px 8px;border-radius:50%;";
      boton.title = "Activar notificaciones";
      boton.setAttribute("aria-label", "Activar notificaciones");

      boton.addEventListener("click", () =>
        activarPush().catch((error) => {
          console.error("Web Push:", error);
          if (typeof showToast === "function")
            showToast("No se pudieron activar las notificaciones.", 2500);
        }),
      );

      userArea.insertBefore(boton, userArea.firstChild);
    }

    const activadas =
      preferenciasPushActivas() &&
      typeof Notification !== "undefined" &&
      Notification.permission === "granted";

    boton.textContent = activadas ? "🔔" : "🔕";
    boton.title = activadas
      ? "Notificaciones activadas"
      : "Activar notificaciones";
    boton.setAttribute("aria-label", boton.title);
  }

  const PUSH_ENABLED_KEY = "elbarrio_push_enabled";

  function preferenciasPushActivas() {
    return localStorage.getItem(PUSH_ENABLED_KEY) !== "false";
  }

  async function desactivarPush() {
    try {
      const usuario = await obtenerUsuarioAutenticado();
      const registration = await navigator.serviceWorker.getRegistration(SERVICE_WORKER_URL);
      const subscription = registration?.pushManager
        ? await registration.pushManager.getSubscription()
        : null;

      if (usuario?.id && subscription) {
        const client = await obtenerCliente();
        const { error } = await client
          .from("push_subscriptions")
          .update({ activo: false, updated_at: new Date().toISOString() })
          .eq("usuario_id", usuario.id)
          .eq("endpoint", subscription.endpoint);
        if (error) throw error;
        await subscription.unsubscribe();
      }

      localStorage.setItem(PUSH_ENABLED_KEY, "false");
      actualizarControlPush();
      if (typeof showToast === "function") showToast("Notificaciones desactivadas", 2200);
      return true;
    } catch (error) {
      console.error("Web Push: no se pudieron desactivar las notificaciones:", error);
      if (typeof showToast === "function") showToast("No se pudieron desactivar las notificaciones.", 2500);
      return false;
    }
  }

  async function alternarPush() {
    if (preferenciasPushActivas()) {
      const registration = await navigator.serviceWorker.getRegistration(SERVICE_WORKER_URL);
      const subscription = registration?.pushManager
        ? await registration.pushManager.getSubscription()
        : null;
      if (subscription || (typeof Notification !== "undefined" && Notification.permission === "granted")) {
        return desactivarPush();
      }
    }
    const activado = await activarPush();
    if (activado) localStorage.setItem(PUSH_ENABLED_KEY, "true");
    actualizarControlPush();
    return activado;
  }

  function actualizarBotonPreferencias() {
    const boton = document.getElementById("activar-notificaciones");
    if (!boton) return;
    const activas = preferenciasPushActivas() &&
      typeof Notification !== "undefined" &&
      Notification.permission === "granted";
    boton.classList.toggle("is-on", activas);
    boton.setAttribute("aria-checked", String(activas));
    boton.setAttribute("aria-label", activas ? "Desactivar notificaciones" : "Activar notificaciones");
    boton.title = activas ? "Desactivar notificaciones" : "Activar notificaciones";
    const texto = boton.querySelector(".toggle-label");
    if (texto) texto.textContent = activas ? "Activadas" : "Desactivadas";
  }

  window.ElBarrioPush = {
    activar: activarPush,
    desactivar: desactivarPush,
    alternar: alternarPush,
    sincronizar: sincronizarPushSiYaExiste,
  };

  document.addEventListener("DOMContentLoaded", () => {
    if (preferenciasPushActivas()) sincronizarPushSiYaExiste();
    const botonActivar = document.getElementById("activar-notificaciones");
    if (botonActivar) {
      botonActivar.addEventListener("click", async () => {
        botonActivar.disabled = true;
        try {
          await alternarPush();
        } catch (error) {
          console.error("Web Push:", error);
          if (typeof showToast === "function") showToast("No se pudo cambiar la preferencia de notificaciones.", 2500);
        } finally {
          botonActivar.disabled = false;
          actualizarBotonPreferencias();
        }
      });
    }
    actualizarBotonPreferencias();
    setTimeout(actualizarControlPush, 500);
  });

  window.addEventListener("storage", () => {
    actualizarControlPush();
    actualizarBotonPreferencias();
  });
})();