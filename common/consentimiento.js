/* Gestor de consentimiento de El Barrio.
 * GA4 solo se carga tras una elección afirmativa de analítica.
 * Rechazar o retirar el consentimiento bloquea la recogida posterior.
 */
(() => {
  "use strict";
  const KEY = "elbarrio_cookie_consent";
  const VERSION = 1;
  const GA_ID = "G-B1D6RRTT0C";
  const GA_DISABLE_KEY = "ga-disable-" + GA_ID;
  const CONSENT_DENIED = {
    analytics_storage: "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied"
  };
  const CONSENT_GRANTED = {
    analytics_storage: "granted",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied"
  };
  let gaScriptRequested = false;

  function applyAnalyticsConsent(allowed) {
    window[GA_DISABLE_KEY] = !allowed;

    if (!allowed) {
      if (typeof window.gtag === "function") {
        window.gtag("consent", "update", CONSENT_DENIED);
      }
      return;
    }

    if (typeof window.gtag === "function") {
      window[GA_DISABLE_KEY] = false;
      window.gtag("consent", "update", CONSENT_GRANTED);
      window.gtag("event", "page_view", {
        page_location: window.location.href,
        page_title: document.title
      });
      return;
    }
    if (gaScriptRequested) return;

    gaScriptRequested = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag("consent", "default", CONSENT_GRANTED);
    window.gtag("js", new Date());
    window.gtag("config", GA_ID, { send_page_view: false });

    const script = document.createElement("script");
    script.async = true;
    script.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(GA_ID);
    script.dataset.elBarrioGa4 = "1";
    script.onload = function () {
      if (readChoice()?.analytics) {
        window[GA_DISABLE_KEY] = false;
        window.gtag("consent", "update", CONSENT_GRANTED);
        window.gtag("event", "page_view", {
          page_location: window.location.href,
          page_title: document.title
        });
      } else {
        window[GA_DISABLE_KEY] = true;
        window.gtag("consent", "update", CONSENT_DENIED);
      }
    };
    script.onerror = function () {
      gaScriptRequested = false;
      console.warn("No se pudo cargar Google Analytics 4.");
    };
    document.head.appendChild(script);
  }

  function readChoice() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      if (raw === "accepted") return null; // consentimiento antiguo e inespecífico: volver a preguntar
      if (raw === "rejected") return { necessary: true, analytics: false, version: VERSION };
      const data = JSON.parse(raw);
      if (data && data.version === VERSION && data.necessary === true && typeof data.analytics === "boolean") {
        return data;
      }
    } catch (error) {
      console.warn("No se pudo leer la preferencia de privacidad:", error);
    }
    return null;
  }

  function saveChoice(analytics) {
    const choice = {
      necessary: true,
      analytics: Boolean(analytics),
      version: VERSION,
      updatedAt: new Date().toISOString()
    };
    try {
      localStorage.setItem(KEY, JSON.stringify(choice));
      applyAnalyticsConsent(choice.analytics);
      window.dispatchEvent(new CustomEvent("elbarrio:consent-change", { detail: choice }));
      return true;
    } catch (error) {
      console.warn("No se pudo guardar la preferencia de privacidad:", error);
      return false;
    }
  }

  function init() {
    if (document.getElementById("elbarrio-privacy-root")) return;
    const style = document.createElement("style");
    style.textContent = `
      #elbarrio-privacy-root{position:fixed;inset:auto 16px 16px 16px;z-index:2147483000;font:14px/1.5 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#17212b}
      #elbarrio-privacy-root *{box-sizing:border-box}
      #elbarrio-privacy-root .eb-privacy-panel{max-width:860px;margin:0 auto;padding:18px;background:#fff;border:1px solid #dce3e8;border-radius:16px;box-shadow:0 14px 50px rgba(0,0,0,.24)}
      #elbarrio-privacy-root .eb-privacy-title{margin:0 0 6px;font-size:17px;font-weight:750;color:#243746}
      #elbarrio-privacy-root .eb-privacy-copy{margin:0 0 13px;color:#475569}
      #elbarrio-privacy-root .eb-privacy-actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
      #elbarrio-privacy-root button,#elbarrio-privacy-root a.eb-privacy-link{min-height:40px;border-radius:9px;padding:9px 13px;font:inherit;font-weight:650;cursor:pointer;text-decoration:none}
      #elbarrio-privacy-root .eb-accept{background:#245c3a;color:#fff;border:1px solid #245c3a}
      #elbarrio-privacy-root .eb-reject{background:#fff;color:#243746;border:1px solid #9baab5}
      #elbarrio-privacy-root .eb-config{background:#edf2f5;color:#243746;border:1px solid #d2dce3}
      #elbarrio-privacy-root a.eb-privacy-link{display:inline-flex;align-items:center;color:#245c3a;border:1px solid transparent}
      #elbarrio-privacy-root .eb-privacy-options{margin:12px 0;padding:12px;border:1px solid #dce3e8;border-radius:10px;background:#f7f9fa}
      #elbarrio-privacy-root .eb-privacy-options label{display:flex;gap:10px;align-items:flex-start;margin:8px 0}
      #elbarrio-privacy-root .eb-privacy-options input{margin-top:4px}
      #elbarrio-privacy-root .eb-privacy-manage{position:fixed;right:12px;bottom:12px;z-index:2147482999;background:#fff;color:#243746;border:1px solid #cbd5dc;border-radius:999px;padding:8px 12px;font:600 12px system-ui;box-shadow:0 3px 16px rgba(0,0,0,.14);cursor:pointer}
      #elbarrio-privacy-root[hidden],#elbarrio-privacy-root [hidden]{display:none!important}
      @media(max-width:600px){#elbarrio-privacy-root{inset:auto 8px 8px}#elbarrio-privacy-root .eb-privacy-panel{padding:14px;border-radius:13px}#elbarrio-privacy-root .eb-privacy-actions{display:grid;grid-template-columns:1fr 1fr}#elbarrio-privacy-root .eb-privacy-actions .eb-accept{grid-column:1/-1}#elbarrio-privacy-root .eb-privacy-actions a{justify-content:center}}
      @media(prefers-reduced-motion:reduce){#elbarrio-privacy-root *{scroll-behavior:auto!important;transition:none!important}}
    `;
    document.head.appendChild(style);

    const root = document.createElement("div");
    root.id = "elbarrio-privacy-root";
    root.setAttribute("aria-live", "polite");
    root.innerHTML = `
      <section class="eb-privacy-panel" role="dialog" aria-modal="false" aria-labelledby="eb-privacy-title" hidden>
        <h2 class="eb-privacy-title" id="eb-privacy-title">Tu privacidad en El Barrio</h2>
        <p class="eb-privacy-copy">Las funciones necesarias permiten operar el sitio. La analítica opcional de Google Analytics 4 solo se carga si la aceptas. Si la rechazas, no se inicia la etiqueta de analítica. Puedes cambiar tu decisión después.</p>
        <div class="eb-privacy-options" hidden>
          <label><input type="checkbox" checked disabled> <span><strong>Necesarias</strong><br>Requeridas para funciones básicas y seguridad.</span></label>
          <label><input id="eb-privacy-analytics" type="checkbox"> <span><strong>Analítica</strong><br>Permite medir visitas mediante Google Analytics 4. Es opcional y puedes cambiar tu decisión desde «Privacidad».</span></label>
        </div>
        <div class="eb-privacy-actions">
          <button class="eb-accept" type="button" data-eb-action="accept">Aceptar analítica</button>
          <button class="eb-reject" type="button" data-eb-action="reject">Rechazar analítica</button>
          <button class="eb-config" type="button" data-eb-action="configure">Configurar</button>
          <button class="eb-config" type="button" data-eb-action="save" hidden>Guardar selección</button>
          <a class="eb-privacy-link" href="/cookies.html">Política de cookies</a>
          <a class="eb-privacy-link" href="/confianza.html">Privacidad</a>
        </div>
      </section>
      <button class="eb-privacy-manage" type="button" data-eb-action="manage">Privacidad</button>
    `;
    document.body.appendChild(root);

    const panel = root.querySelector(".eb-privacy-panel");
    const options = root.querySelector(".eb-privacy-options");
    const analytics = root.querySelector("#eb-privacy-analytics");
    const save = root.querySelector('[data-eb-action="save"]');
    const config = root.querySelector('[data-eb-action="configure"]');

    function openPanel(showOptions = false) {
      panel.hidden = false;
      options.hidden = !showOptions;
      save.hidden = !showOptions;
      config.hidden = showOptions;
      const current = readChoice();
      analytics.checked = Boolean(current?.analytics);
      root.querySelector('[data-eb-action="accept"]').hidden = showOptions;
      root.querySelector('[data-eb-action="reject"]').hidden = showOptions;
    }
    function closePanel() {
      panel.hidden = true;
      options.hidden = true;
      save.hidden = true;
      config.hidden = false;
      root.querySelector('[data-eb-action="accept"]').hidden = false;
      root.querySelector('[data-eb-action="reject"]').hidden = false;
    }
    function setAndClose(allowAnalytics) {
      if (saveChoice(allowAnalytics)) {
        closePanel();
        root.querySelector(".eb-privacy-manage").setAttribute("aria-label", "Cambiar preferencias de privacidad");
      } else {
        openPanel(true);
      }
    }

    root.addEventListener("click", event => {
      const button = event.target.closest("[data-eb-action]");
      if (!button) return;
      switch (button.dataset.ebAction) {
        case "accept": setAndClose(true); break;
        case "reject": setAndClose(false); break;
        case "configure": openPanel(true); break;
        case "save": setAndClose(analytics.checked); break;
        case "manage": openPanel(true); break;
      }
    });

    const initialChoice = readChoice();
    applyAnalyticsConsent(Boolean(initialChoice?.analytics));
    if (!initialChoice) openPanel(false);
    else closePanel();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
