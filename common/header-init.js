(function () {
  function inicializarHeader() {
    if (typeof window.inicializarHeaderAuth === 'function') {
      window.inicializarHeaderAuth();
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