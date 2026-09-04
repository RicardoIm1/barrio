// Guard for legacy admin user-list calls.
// Real authorization remains enforced by Supabase/RLS.
(function () {
  'use strict';
  function getRole() {
    try { return String(JSON.parse(localStorage.getItem('usuario') || 'null')?.rol || '').toLowerCase(); }
    catch (_) { return ''; }
  }
  function install() {
    if (getRole() === 'admin') return;
    if (typeof window.cargarUsuariosAdmin !== 'function') return;
    const original = window.cargarUsuariosAdmin;
    if (original.__elBarrioNormalGuard) return;
    const guarded = function () {
      if (getRole() !== 'admin') return Promise.resolve();
      return original.apply(this, arguments);
    };
    guarded.__elBarrioNormalGuard = true;
    window.cargarUsuariosAdmin = guarded;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
