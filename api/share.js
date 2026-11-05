// Vercel serverless endpoint: Open Graph dinámico para cada publicación.
const SUPABASE_URL = 'https://gnjaumpjerbbwlkcgxqa.supabase.co';
// Clave publishable pública utilizada también por el cliente web. Nunca usar service_role aquí.
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_x01F_xzyh5b-sZdwhKh6FQ_OzQVxMpN';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, function (character) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character];
  });
}

function plainText(value) {
  return String(value ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function absoluteImage(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return 'https://elbarrio.me/icons/logo-elbarrio.png';
  try {
    const parsed = new URL(raw, 'https://elbarrio.me');
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new Error('Protocolo no permitido');
    return parsed.href;
  } catch (_) {
    return 'https://elbarrio.me/icons/logo-elbarrio.png';
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');

  const id = String(req.query?.id ?? '').trim();
  if (!id || id.length > 80) {
    res.status(400).send('<!doctype html><html lang="es"><meta charset="utf-8"><title>Publicación no disponible | El Barrio</title><p>El enlace no contiene una publicación válida.</p><a href="https://elbarrio.me">Ir a El Barrio</a></html>');
    return;
  }

  try {
    const endpoint = new URL('/rest/v1/avisos', SUPABASE_URL);
    endpoint.searchParams.set('id', 'eq.' + id);
    endpoint.searchParams.set('status', 'eq.activo');
    endpoint.searchParams.set('select', 'id,titulo,contenido,categoria,imagen_url,created_at');
    endpoint.searchParams.set('limit', '1');

    const response = await fetch(endpoint.toString(), {
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: 'Bearer ' + SUPABASE_PUBLISHABLE_KEY
      }
    });
    if (!response.ok) throw new Error('No se pudo consultar la publicación');

    const rows = await response.json();
    const post = Array.isArray(rows) ? rows[0] : null;
    if (!post) {
      res.status(404).send('<!doctype html><html lang="es"><meta charset="utf-8"><title>Publicación no disponible | El Barrio</title><p>Esta publicación ya no está disponible.</p><a href="https://elbarrio.me">Ir a El Barrio</a></html>');
      return;
    }

    const title = plainText(post.titulo || 'Aviso de El Barrio').slice(0, 180);
    const description = plainText(post.contenido || 'Conoce esta publicación en El Barrio.').slice(0, 260);
    const image = absoluteImage(post.imagen_url);
    const target = 'https://elbarrio.me/aviso.html?id=' + encodeURIComponent(post.id);
    const safeTarget = escapeHtml(target);
    const safeTitle = escapeHtml(title);
    const safeDescription = escapeHtml(description);
    const safeImage = escapeHtml(image);

    const html = '<!doctype html><html lang="es-MX"><head>' +
      '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>' + safeTitle + ' | El Barrio</title>' +
      '<meta name="description" content="' + safeDescription + '">' +
      '<link rel="canonical" href="' + safeTarget + '">' +
      '<meta property="og:type" content="article">' +
      '<meta property="og:site_name" content="El Barrio">' +
      '<meta property="og:url" content="' + safeTarget + '">' +
      '<meta property="og:title" content="' + safeTitle + '">' +
      '<meta property="og:description" content="' + safeDescription + '">' +
      '<meta property="og:image" content="' + safeImage + '">' +
      '<meta property="og:image:secure_url" content="' + safeImage + '">' +
      '<meta property="og:image:alt" content="' + safeTitle + '">' +
      '<meta name="twitter:card" content="summary_large_image">' +
      '<meta name="twitter:title" content="' + safeTitle + '">' +
      '<meta name="twitter:description" content="' + safeDescription + '">' +
      '<meta name="twitter:image" content="' + safeImage + '">' +
      '<meta http-equiv="refresh" content="0;url=' + safeTarget + '">' +
      '</head><body><p>Abriendo publicación: <a href="' + safeTarget + '">' + safeTitle + '</a></p>' +
      '<script>window.location.replace(' + JSON.stringify(target) + ');</script></body></html>';

    res.status(200).send(html);
  } catch (error) {
    console.error('Error generando vista previa de El Barrio:', error);
    res.status(502).send('<!doctype html><html lang="es"><meta charset="utf-8"><title>El Barrio</title><p>No fue posible preparar la vista previa.</p><a href="https://elbarrio.me">Ir a El Barrio</a></html>');
  }
};
