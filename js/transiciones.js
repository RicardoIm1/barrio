/* El Barrio | Transiciones discretas de navegación y registros */
(function () {
  'use strict';
  if (window.__elBarrioTransitionsReady) return;
  window.__elBarrioTransitionsReady = true;

  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const duration = reduceMotion ? 0 : 180;
  const recordSelector = '.aviso-card, .tarjeta-moderna, .mas-aviso-item, .comment-item, .aviso-paper, #aviso-container, [data-record-id], tr[data-id]';
  let pendingAction = null;
  let pendingTimer = null;

  function ensureTransitionStyles() {
    if (document.querySelector('link[href*="/css/estilo.css"]') || document.getElementById('eb-transition-styles')) return;
    const style = document.createElement('style');
    style.id = 'eb-transition-styles';
    style.textContent = `
      @keyframes eb-page-enter { from { opacity:0; transform:translateY(5px); } to { opacity:1; transform:translateY(0); } }
      @keyframes eb-page-leave { from { opacity:1; } to { opacity:0; } }
      @keyframes eb-record-enter { from { opacity:0; transform:translateY(12px) scale(.992); } to { opacity:1; transform:translateY(0) scale(1); } }
      @keyframes eb-record-update { 0% { box-shadow:0 0 0 0 rgba(212,160,67,0); } 35% { box-shadow:0 0 0 3px rgba(212,160,67,.22); } 100% { box-shadow:0 0 0 0 rgba(212,160,67,0); } }
      @keyframes eb-screen-enter { from { opacity:.55; transform:translateY(7px); } to { opacity:1; transform:translateY(0); } }
      body.eb-page-enter { animation:eb-page-enter .34s cubic-bezier(.2,.65,.3,1) both; }
      body.eb-page-leave { animation:eb-page-leave .18s ease both; pointer-events:none; }
      .eb-record-enter { animation:eb-record-enter .38s cubic-bezier(.2,.65,.3,1) both; animation-delay:var(--eb-enter-delay,0ms); }
      .eb-record-update { animation:eb-record-update .72s ease-out both; }
      .eb-screen-enter { animation:eb-screen-enter .26s ease-out both; }
      @media (prefers-reduced-motion:reduce) { body.eb-page-enter,body.eb-page-leave,.eb-record-enter,.eb-record-update,.eb-screen-enter { animation:none!important; transition:none!important; } }
    `;
    document.head.appendChild(style);
  }

  function animate(element, className) {
    if (!element || reduceMotion || !element.isConnected) return;
    element.classList.remove(className);
    void element.offsetWidth;
    element.classList.add(className);
    element.addEventListener('animationend', () => element.classList.remove(className), { once: true });
  }

  function beginPage() {
    ensureTransitionStyles();
    if (reduceMotion) return;
    document.documentElement.classList.add('eb-transitions-enabled');
    document.body.classList.add('eb-page-enter');
    window.setTimeout(() => document.body.classList.remove('eb-page-enter'), 420);
  }

  function navigateWithTransition(link, href) {
    if (reduceMotion || !document.body || document.body.classList.contains('eb-page-leave')) {
      window.location.href = href;
      return;
    }
    document.body.classList.add('eb-page-leave');
    window.setTimeout(() => { window.location.href = href; }, duration);
  }

  document.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target && event.target.closest ? event.target.closest('a[href]') : null;
    if (!link || link.hasAttribute('download') || link.target && link.target !== '_self') return;
    if (link.hasAttribute('data-no-transition') || link.closest('[data-no-transition]')) return;
    let url;
    try { url = new URL(link.href, window.location.href); } catch (_) { return; }
    if (url.origin !== window.location.origin || url.pathname === window.location.pathname && url.search === window.location.search) return;
    if (/^(mailto:|tel:|javascript:)$/.test(link.getAttribute('href') || '')) return;
    event.preventDefault();
    navigateWithTransition(link, url.href);
  }, true);

  function setPendingAction(type) {
    pendingAction = type;
    window.clearTimeout(pendingTimer);
    pendingTimer = window.setTimeout(() => { pendingAction = null; }, 10000);
  }

  document.addEventListener('submit', (event) => {
    const form = event.target;
    if (!form || !form.matches) return;
    if (form.matches('#form-aviso')) setPendingAction('create');
    else if (form.matches('#form-editar, #form-editar-aviso')) setPendingAction('edit');
  }, true);

  function collectRecords(node) {
    if (!node || node.nodeType !== 1) return [];
    const found = [];
    if (node.matches(recordSelector)) found.push(node);
    if (node.querySelectorAll) found.push(...node.querySelectorAll(recordSelector));
    return found;
  }

  function processMutations(mutations) {
    const created = new Set();
    const updated = new Set();

    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => {
          collectRecords(node).forEach((record) => created.add(record));
        });
        const owner = mutation.target.nodeType === 1
          ? mutation.target.closest(recordSelector)
          : mutation.target.parentElement && mutation.target.parentElement.closest(recordSelector);
        if (owner && pendingAction === 'edit') updated.add(owner);
      } else if (mutation.type === 'characterData') {
        const owner = mutation.target.parentElement && mutation.target.parentElement.closest(recordSelector);
        if (owner && pendingAction === 'edit') updated.add(owner);
      } else if (mutation.type === 'attributes' && mutation.target.matches('.tab.active, .tab[style*="display: block"], .tab-pane.active, [role="tabpanel"].active')) {
        animate(mutation.target, 'eb-screen-enter');
      }
    });

    created.forEach((record, index) => {
      if (pendingAction === 'edit') updated.add(record);
      else {
        record.style.setProperty('--eb-enter-delay', Math.min(index * 45, 225) + 'ms');
        animate(record, 'eb-record-enter');
      }
    });

    updated.forEach((record) => {
      animate(record, 'eb-record-update');
      if (pendingAction === 'edit') {
        pendingAction = null;
        window.clearTimeout(pendingTimer);
      }
    });
  }

  function observe() {
    if (!document.body || reduceMotion) return;
    const observer = new MutationObserver(processMutations);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['class', 'style']
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { beginPage(); observe(); }, { once: true });
  } else {
    beginPage();
    observe();
  }

  window.addEventListener('pageshow', () => {
    document.body && document.body.classList.remove('eb-page-leave');
  });
})();
