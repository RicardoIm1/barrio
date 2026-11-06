/* Atmósfera horaria compartida para el encabezado de El Barrio. */
(function () {
  function obtenerCielo(fecha) {
    // El panel administrativo conserva siempre la variante diurna.
    if (window.location.pathname === "/admin.html" || window.location.pathname.endsWith("/admin.html")) return "dia";
    const hora = fecha.getHours() + fecha.getMinutes() / 60;
    if (hora >= 6 && hora < 9) return "amanecer";
    if (hora >= 9 && hora < 17) return "dia";
    if (hora >= 17 && hora < 20) return "atardecer";
    return "noche";
  }

  window.inicializarAtmosferaHeader = function (raiz) {
    const contexto = raiz || document;
    const header = contexto.querySelector(".header");
    if (!header) return;

    const actualizar = function () {
      const cielo = obtenerCielo(new Date());
      if (header.dataset.cielo !== cielo) header.dataset.cielo = cielo;
      const esAdmin = window.location.pathname === "/admin.html" || window.location.pathname.endsWith("/admin.html");
      if (esAdmin) {
        header.dataset.adminDay = "true";
      } else {
        delete header.dataset.adminDay;
      }
      header.setAttribute("aria-label", "Encabezado de El Barrio");
    };

    actualizar();
    if (header.dataset.atmosferaActiva === "true") return;
    header.dataset.atmosferaActiva = "true";

    // Revisa el reloj una vez por minuto; el CSS se encarga de la transición.
    const intervalo = window.setInterval(function () {
      if (!header.isConnected) {
        window.clearInterval(intervalo);
        return;
      }
      actualizar();
    }, 60000);
  };
})();
