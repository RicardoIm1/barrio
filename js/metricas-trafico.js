/* El Barrio · medición propia de sesiones y páginas vistas.
   Solo registra actividad cuando el visitante acepta analítica.
   No almacena IP, correo, agente de usuario ni parámetros de URL.
*/
(() => {
  "use strict";
  if (window.__elBarrioTrackerInstalled) return;
  window.__elBarrioTrackerInstalled = true;

  const PROJECT_URL = "https://gnjaumpjerbbwlkcgxqa.supabase.co";
  const PUBLISHABLE_KEY = "sb_publishable_x01F_xzyh5b-sZdwhKh6FQ_OzQVxMpN";
  const CONSENT_KEY = "elbarrio_cookie_consent";
  let pageRecorded = false;

  function consentGranted() {
    try {
      const choice = JSON.parse(localStorage.getItem(CONSENT_KEY) || "null");
      return choice?.version === 2 && choice?.necessary === true && choice?.analytics === true;
    } catch (_) {
      return false;
    }
  }

  function newSessionId() {
    if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    const hex = Array.from(bytes, value => value.toString(16).padStart(2, "0")).join("");
    return hex.slice(0,8) + "-" + hex.slice(8,12) + "-" + hex.slice(12,16) + "-" + hex.slice(16,20) + "-" + hex.slice(20);
  }

  function sessionId() {
    try {
      let value = sessionStorage.getItem("elbarrio_session_id");
      if (!value) {
        value = newSessionId();
        sessionStorage.setItem("elbarrio_session_id", value);
      }
      return value;
    } catch (_) {
      return newSessionId();
    }
  }

  async function recordPage() {
    if (pageRecorded || !consentGranted()) return;
    pageRecorded = true;
    try {
      const token = PUBLISHABLE_KEY;
      const response = await fetch(PROJECT_URL + "/rest/v1/rpc/registrar_visita_sitio", {
        method: "POST",
        headers: {
          "apikey": PUBLISHABLE_KEY,
          "Authorization": "Bearer " + token,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          p_pagina: location.pathname || "/",
          p_session_id: sessionId()
        }),
        keepalive: true
      });
      if (!response.ok) throw new Error("HTTP " + response.status);
    } catch (error) {
      pageRecorded = false;
      console.warn("No se pudo registrar la página vista:", error?.message || error);
    }
  }

  function schedule() {
    if (!consentGranted()) return;
    if ("requestIdleCallback" in window) requestIdleCallback(recordPage, { timeout: 2500 });
    else setTimeout(recordPage, 700);
  }

  window.addEventListener("elbarrio:consent-change", event => {
    if (event.detail?.analytics === true) schedule();
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", schedule, { once: true });
  } else {
    schedule();
  }
})();
