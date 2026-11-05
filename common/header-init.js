(function () {
  function inicializarHeader() {
    const root = document.getElementById('header-container');
    if (!root) return;
    const login = root.querySelector('#login-link');
    const userArea = root.querySelector('#user-area');
    const userName = root.querySelector('#user-name');
    const logout = root.querySelector('#cerrar-sesion');
    const toggle = root.querySelector('#header-menu-toggle');
    const menu = root.querySelector('#header-acciones');

    let usuario = null;
    try {
      const raw = localStorage.getItem('usuario');
      const apiKey = localStorage.getItem('api_key');
      if (raw && apiKey) usuario = JSON.parse(raw);
    } catch (error) {
      console.warn('No se pudo leer la sesión local:', error);
    }

    if (usuario) {
      if (login) login.style.display = 'none';
      if (userArea) userArea.style.display = 'flex';
      if (userName) {
        userName.textContent = '👋 ' + (usuario.nombre || usuario.email || 'Usuario');
        userName.classList.add('admin-link');
        userName.title = 'Abrir panel de administración';
        userName.setAttribute('role', 'link');
        userName.setAttribute('tabindex', '0');
        userName.onclick = function () { window.location.href = '/admin.html'; };
        userName.onkeydown = function (event) {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            window.location.href = '/admin.html';
          }
        };
      }
    } else {
      if (login) login.style.display = 'inline-flex';
      if (userArea) userArea.style.display = 'none';
    }

    if (logout && logout.dataset.logoutInit !== '1') {
      logout.dataset.logoutInit = '1';
      logout.addEventListener('click', async function (event) {
        event.preventDefault();
        event.stopPropagation();
        try {
          if (window.Auth && typeof window.Auth.logout === 'function') {
            await window.Auth.logout();
          } else {
            localStorage.removeItem('usuario');
            localStorage.removeItem('api_key');
          }
        } catch (error) {
          console.error('Error al cerrar sesión:', error);
          localStorage.removeItem('usuario');
          localStorage.removeItem('api_key');
        }
        window.location.href = '/index.html';
      });
    }

    if (toggle && menu && toggle.dataset.menuInit !== '1') {
      toggle.dataset.menuInit = '1';
      const cerrar = function () {
        menu.classList.remove('menu-open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-label', 'Abrir menú');
      };
      toggle.addEventListener('click', function (event) {
        event.stopPropagation();
        const abierto = toggle.getAttribute('aria-expanded') === 'true';
        if (abierto) cerrar();
        else {
          menu.classList.add('menu-open');
          toggle.setAttribute('aria-expanded', 'true');
          toggle.setAttribute('aria-label', 'Cerrar menú');
        }
      });
      if (!window.__elBarrioMenuGlobal) {
        window.__elBarrioMenuGlobal = true;
        document.addEventListener('pointerdown', function (event) {
          const currentMenu = document.getElementById('header-acciones');
          const currentToggle = document.getElementById('header-menu-toggle');
          if (currentMenu && currentToggle &&
              !currentMenu.contains(event.target) &&
              !currentToggle.contains(event.target)) {
            currentMenu.classList.remove('menu-open');
            currentToggle.setAttribute('aria-expanded', 'false');
            currentToggle.setAttribute('aria-label', 'Abrir menú');
          }
        });
        document.addEventListener('keydown', function (event) {
          if (event.key !== 'Escape') return;
          const currentMenu = document.getElementById('header-acciones');
          const currentToggle = document.getElementById('header-menu-toggle');
          if (currentMenu && currentToggle) {
            currentMenu.classList.remove('menu-open');
            currentToggle.setAttribute('aria-expanded', 'false');
            currentToggle.setAttribute('aria-label', 'Abrir menú');
          }
        });
        window.addEventListener('resize', function () {
          if (window.innerWidth <= 768) return;
          const currentMenu = document.getElementById('header-acciones');
          const currentToggle = document.getElementById('header-menu-toggle');
          if (currentMenu && currentToggle) {
            currentMenu.classList.remove('menu-open');
            currentToggle.setAttribute('aria-expanded', 'false');
            currentToggle.setAttribute('aria-label', 'Abrir menú');
          }
        });
      }
    }
  }

  window.cargarHeaderCompartido = async function () {
    const target = document.getElementById('header-container');
    if (!target) return;
    const response = await fetch('/common/header.html', { cache: 'no-store' });
    if (!response.ok) throw new Error('No se pudo cargar el encabezado');
    target.innerHTML = await response.text();
    inicializarHeader();
  };

  window.cargarFooterCompartido = async function () {
    const target = document.getElementById('footer-container');
    if (!target) return;
    const response = await fetch('/common/footer.html', { cache: 'no-store' });
    if (!response.ok) throw new Error('No se pudo cargar el pie de página');
    target.innerHTML = await response.text();
    const year = target.querySelector('#copyright-year');
    if (year) year.innerHTML = '&copy; ' + new Date().getFullYear() + ' - El Barrio. Todos los derechos reservados.';
    target.querySelectorAll('script').forEach(function (oldScript) {
      const script = document.createElement('script');
      if (oldScript.src) script.src = oldScript.src;
      else script.textContent = oldScript.textContent;
      document.body.appendChild(script);
      oldScript.remove();
    });
  };
})();