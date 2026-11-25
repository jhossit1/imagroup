// Archivos en Cloudflare: fotos subidas desde el panel en Workers KV (binding UPLOADS) y archivos del sitio
// en los recursos estáticos (binding ASSETS, carpeta public/).
import crypto from 'node:crypto';

let env = null;
export const setEnv = (e) => { env = e; };

// Motor de almacenamiento para multer: recibe el archivo en memoria y lo guarda en KV.
// name(file) devuelve el nombre final (sin carpeta), como el filename de multer.diskStorage.
export function kvStorage(name) {
  return {
    _handleFile(_req, file, cb) {
      const chunks = [];
      file.stream.on('data', (c) => chunks.push(c));
      file.stream.on('error', cb);
      file.stream.on('end', () => {
        const body = Buffer.concat(chunks), filename = name(file);
        env.UPLOADS.put(filename, body, { metadata: { type: file.mimetype, t: Date.now() } })
          .then(() => cb(null, { filename, size: body.length }), cb);
      });
    },
    _removeFile(_req, file, cb) { env.UPLOADS.delete(file.filename).then(() => cb(null), cb); },
  };
}
export const randomName = (ext) => crypto.randomBytes(8).toString('hex') + ext;

// Fotos subidas, de la más reciente a la más antigua.
export async function listUploads() {
  const out = [];
  let cursor;
  do {
    const r = await env.UPLOADS.list({ cursor, limit: 1000 });
    out.push(...r.keys);
    cursor = r.list_complete ? undefined : r.cursor;
  } while (cursor);
  return out.filter((k) => /\.(webp|png|jpe?g)$/i.test(k.name)).sort((a, b) => (b.metadata?.t || 0) - (a.metadata?.t || 0)).map((k) => '/uploads/' + k.name);
}

// Imágenes para los PDF. pdfkit solo lee PNG o JPG: para los logos .webp del sitio se usa su copia .png.
// Devuelve un Map ruta -> data URI (o null si no hay imagen utilizable).
export async function loadImages(paths) {
  const map = new Map();
  await Promise.all([...new Set(paths.filter(Boolean))].map(async (p) => {
    let f = p.startsWith('/uploads/') ? p : '/' + p.replace(/^\/+/, '');
    if (f.endsWith('.webp')) f = f.replace(/\.webp$/, '.png');
    let data = null;
    if (/\.(png|jpe?g)$/i.test(f)) {
      if (f.startsWith('/uploads/')) data = await env.UPLOADS.get(f.slice(9).replace(/[/\\]/g, ''), 'arrayBuffer');
      else {
        const r = await env.ASSETS.fetch(new Request('https://assets.local' + f));
        if (r.ok) data = await r.arrayBuffer();
      }
    }
    map.set(p, data ? `data:image/${/\.png$/i.test(f) ? 'png' : 'jpeg'};base64,${Buffer.from(data).toString('base64')}` : null);
  }));
  return map;
}

// Junta la salida de un documento pdfkit y la envía completa.
export function sendPdf(res, doc) {
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  doc.on('end', () => res.end(Buffer.concat(chunks.map((c) => Buffer.from(c)))));
}
