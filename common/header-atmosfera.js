/* Atmósfera horaria única para el encabezado de todo El Barrio. */
(function () {
  function obtenerCielo(fecha) {
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
      // No existen excepciones por página: portada, administración e información
      // comparten exactamente el mismo estado horario.
      delete header.dataset.adminDay;
      header.setAttribute("aria-label", "Encabezado de El Barrio");
    };

    actualizar();
    if (header.dataset.atmosferaActiva === "true") return;
    header.dataset.atmosferaActiva = "true";

    const intervalo = window.setInterval(function () {
      if (!header.isConnected) {
        window.clearInterval(intervalo);
        return;
      }
      actualizar();
    }, 60000);
  };
})();
