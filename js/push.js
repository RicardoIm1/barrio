// ============================================================
// EL BARRIO · Web Push nativo + Supabase
// Sin Firebase
// ============================================================

(function () {
  "use strict";

  // Clave pública VAPID. La privada NUNCA debe estar en el frontend.
  const VAPID_PUBLIC_KEY =
    "BDr1vV4sJF485cSxNPBXm6gSX3b7Pfi3c-9ZTTly6-JqvkNNS9uMB9-fM_DjfOVCFlXlLjN5tQYZy_O2NI114_k";
  const SERVICE_WORKER_URL = "/js/service-worker.js";

  function base64UrlToUint8Array(base64UrlData) {
    const padding = "=".repeat((4 - (base64UrlData.length % 4)) % 4);
    const base64 = (base64UrlData + padding)
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    const rawData = atob(base64);
    return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
  }

  async function obtenerCliente() {
    if (typeof getSupabaseClient === "function") return getSupabaseClient();
    if (typeof obtenerSupabaseClient === "function")
      return obtenerSupabaseClient();
    if (window.__elBarrioSupabaseClient) return window.__elBarrioSupabaseClient;
    throw new Error("Cliente Supabase no disponible");
  }

  async function obtenerUsuarioAutenticado() {
    try {
      const client = await obtenerCliente();
      const { data, error } = await client.auth.getUser();
      if (error) throw error;
      return data?.user || null;
    } catch (error) {
      console.warn("Web Push: no se pudo obtener el usuario:", error);
      return null;
    }
  }

  async function registrarSuscripcion(subscription) {
    const usuario = await obtenerUsuarioAutenticado();
    if (!usuario?.id) return false;

    const keys = subscription.getKey
      ? {
          p256dh: subscription.getKey("p256dh"),
          auth: subscription.getKey("auth"),
        }
      : null;

    if (!keys?.p256dh || !keys?.auth) {
      throw new Error("La suscripción Web Push no contiene sus claves");
    }

    const toBase64 = (buffer) =>
      btoa(String.fromCharCode(...new Uint8Array(buffer)));

    const client = await obtenerCliente();
    const payload = {
      usuario_id: usuario.id,
      endpoint: subscription.endpoint,
      p256dh: toBase64(keys.p256dh),
      auth: toBase64(keys.auth),
      user_agent: navigator.userAgent,
      activo: true,
      updated_at: new Date().toISOString(),
    };

    const { error } = await client
      .from("push_subscriptions")
      .upsert(payload, { onConflict: "endpoint" });

    if (error) throw error;
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

    const usuario = await obtenerUsuarioAutenticado();
    if (!usuario?.id) return false;

    const registration = await navigator.serviceWorker.register(
      SERVICE_WORKER_URL,
      { scope: "/js/" },
    );
    await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (!subscription) return false;
    return registrarSuscripcion(subscription);
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

    const registration = await navigator.serviceWorker.register(
      SERVICE_WORKER_URL,
      { scope: "/js/" },
    );
    await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    const guardado = await registrarSuscripcion(subscription);
    if (guardado && typeof showToast === "function")
      showToast("🔔 Notificaciones activadas", 2200);
    actualizarControlPush();
    return guardado;
  }

  async function sincronizarPushSiYaExiste() {
    try {
      if (!("Notification" in window) || Notification.permission !== "granted")
        return false;
      return await registrarPush();
    } catch (error) {
      console.warn("Web Push: no se pudo sincronizar la suscripción:", error);
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

    console.log("🔔 Botón #activar-notificaciones conectado a Web Push");
  }

  setTimeout(actualizarControlPush, 500);
});

window.addEventListener("storage", actualizarControlPush);
})();