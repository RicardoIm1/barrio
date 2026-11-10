/* Compartir avisos de El Barrio. */
(function () {
  'use strict';

  function textoPlano(valor) {
    return String(valor || '').replace(/<[^>]*>/g, ' ').replace(new RegExp('\\s+', 'g'), ' ').trim();
  }

  function datosDesdeTarjeta(id, trigger) {
    const card = trigger && trigger.closest ? trigger.closest('.aviso-card') : null;
    return {
      titulo: card?.querySelector('.card-titulo-moderno')?.textContent?.trim() || 'Aviso de El Barrio',
      descripcion: textoPlano(card?.querySelector('.card-preview-moderno')?.textContent || 'Conoce esta publicación en El Barrio.'),
      version: card?.dataset?.shareVersion || ''
    };
  }

  async function compartirAviso(id, event, aviso) {
    if (event) {
      event.preventDefault?.();
      event.stopPropagation?.();
    }
    if (!id) return;

    const datos = aviso ? {
      titulo: textoPlano(aviso.titulo || aviso.nombre || 'Aviso de El Barrio'),
      descripcion: textoPlano(aviso.descripcion || aviso.contenido || aviso.texto || 'Conoce esta publicación en El Barrio.'),
      version: aviso.updated_at || aviso.created_at || ''
    } : datosDesdeTarjeta(id, event?.currentTarget || event?.target);

    const url = new URL('/api/share', window.location.origin);
    url.searchParams.set('id', String(id));
    if (datos.version) url.searchParams.set('v', String(datos.version));
    const shareUrl = url.toString();
    const title = datos.titulo || 'Aviso de El Barrio';
    const description = (datos.descripcion || 'Conoce esta publicación en El Barrio.').slice(0, 220);
    const payload = { title: title, text: description, url: shareUrl };

    if (navigator.share) {
      try {
        await navigator.share(payload);
        return;
      } catch (error) {
        if (error && error.name === 'AbortError') return;
        console.warn('No se pudo abrir el menú nativo para compartir:', error);
      }
    }

    const mensaje = title + '\n' + description + '\n' + shareUrl;
    const whatsapp = 'https://wa.me/?text=' + encodeURIComponent(mensaje);
    const ventana = window.open(whatsapp, '_blank', 'noopener,noreferrer');
    if (!ventana) window.location.href = whatsapp;
  }

  window.compartirAviso = compartirAviso;
})();
