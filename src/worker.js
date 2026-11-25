// Entrada de Cloudflare Workers.
// - public/ lo sirve Cloudflare directamente (recursos estáticos, sin pasar por aquí).
// - /uploads/* se lee de Workers KV.
// - Todo lo demás va a un único Durable Object "Site", que guarda la base SQLite y ejecuta la app Express.
import { DurableObject } from 'cloudflare:workers';
import { handleAsNodeRequest } from 'cloudflare:node';
import { openDb } from './db.js';
import { initPages } from './pages.js';
import { setEnv } from './files.js';
import { PORT } from './server.js';

export class Site extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    setEnv(env);
    openDb(ctx.storage);
    initPages();
  }
  fetch(request) {
    return handleAsNodeRequest(PORT, request);
  }
}

const TYPES = { webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg' };

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // Siempre HTTPS en producción (el panel y los formularios nunca viajan sin cifrar).
    if (url.protocol === 'http:' && !/^(localhost|127\.0\.0\.1|\[::1\])$/.test(url.hostname)) {
      url.protocol = 'https:';
      return Response.redirect(url.href, 308);
    }
    // Una sola dirección: www.dominio -> dominio.
    if (url.hostname.startsWith('www.')) {
      url.hostname = url.hostname.slice(4);
      return Response.redirect(url.href, 308);
    }
    if (url.pathname.startsWith('/uploads/')) {
      const key = url.pathname.slice(9);
      const ext = key.split('.').pop().toLowerCase();
      const obj = /^[a-f0-9]{16}\.(webp|png|jpe?g)$/.test(key) && ['GET', 'HEAD'].includes(request.method) ? await env.UPLOADS.get(key, 'stream') : null;
      if (!obj) return new Response('No encontrado', { status: 404 });
      return new Response(request.method === 'HEAD' ? null : obj, {
        headers: { 'content-type': TYPES[ext], 'cache-control': 'public, max-age=604800', 'x-content-type-options': 'nosniff' },
      });
    }
    // La app confía en estas cabeceras (trust proxy) para la IP del visitante y para saber si es HTTPS.
    const headers = new Headers(request.headers);
    headers.set('x-forwarded-for', request.headers.get('cf-connecting-ip') || '127.0.0.1');
    headers.set('x-forwarded-proto', url.protocol.replace(':', ''));
    const site = env.SITE.get(env.SITE.idFromName('imagroup'));
    const res = await site.fetch(new Request(request, { headers }));
    if (!url.hostname.endsWith('.workers.dev')) return res;
    // La dirección de respaldo no debe competir con el dominio en los buscadores.
    const copy = new Response(res.body, res);
    copy.headers.set('x-robots-tag', 'noindex');
    return copy;
  },
};
