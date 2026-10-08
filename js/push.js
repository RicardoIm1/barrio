// ============================================================
// EL BARRIO · Web Push nativo + Supabase
// Sin Firebase
// ============================================================

(function () {
  "use strict";

  // Clave pública VAPID. La privada NUNCA debe estar en el frontend.
  const VAPID_PUBLIC_KEY =
    "BDr1vV4sJF485cSxNPBXm6gSX3b7Pfi3c-9ZTTly6-JqvkNNS9uMB9-fM_DjfOVCFlXlLjN5tQYZy_O2NI114_k";

  const SERVICE_WORKER_URL = "/sw.js";

  // v5: una sola migración controlada del navegador.
  // Obliga a recrear la suscripción con la VAPID vigente.
  const PUSH_VAPID_VERSION = "v6";
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

    const payload = {
      usuario_id: usuarioId,
      endpoint: subscription.endpoint,
      p256dh: bufferABase64(keys.p256dh),
      auth: bufferABase64(keys.auth),
      user_agent: navigator.userAgent,
      activo: true,
      updated_at: new Date().toISOString(),
    };

    const { error } = await client
      .from("push_subscriptions")
      .upsert(payload, { onConflict: "usuario_id,endpoint" });

    if (error) throw error;

    return true;
  }

  async function desactivarSuscripcionesAnteriores(usuarioId, endpointActual) {
    try {
      const client = await obtenerCliente();

      const { error } = await client
        .from("push_subscriptions")
        .update({
          activo: false,
          updated_at: new Date().toISOString(),
        })
        .eq("usuario_id", usuarioId)
        .neq("endpoint", endpointActual)
        .eq("activo", true);

      if (error) {
        console.warn(
          "Web Push: no se pudieron desactivar suscripciones anteriores:",
          error,
        );
      }
    } catch (error) {
      console.warn(
        "Web Push: error al limpiar suscripciones anteriores:",
        error,
      );
    }
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

    await desactivarSuscripcionesAnteriores(
      usuario.id,
      subscription.endpoint,
    );

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
      typeof Notification !== "undefined" &&
      Notification.permission === "granted";

    boton.textContent = activadas ? "🔔" : "🔕";
    boton.title = activadas
      ? "Notificaciones activadas"
      : "Activar notificaciones";
    boton.setAttribute("aria-label", boton.title);
  }

  window.ElBarrioPush = {
    activar: activarPush,
    sincronizar: sincronizarPushSiYaExiste,
  };

  document.addEventListener("DOMContentLoaded", () => {
    sincronizarPushSiYaExiste();

    const botonActivar = document.getElementById("activar-notificaciones");

    if (botonActivar) {
      botonActivar.addEventListener("click", () => {
        activarPush().catch((error) => {
          console.error("Web Push:", error);

          if (typeof showToast === "function") {
            showToast("No se pudieron activar las notificaciones.", 2500);
          }
        });
      });

      console.log("Botón #activar-notificaciones conectado a Web Push");
    }

    setTimeout(actualizarControlPush, 500);
  });

  window.addEventListener("storage", actualizarControlPush);
})();