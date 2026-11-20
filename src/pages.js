// Páginas del sitio armadas con bloques. Cada página tiene un borrador (lo que edita el administrador)
// y una versión publicada (lo que ven los visitantes). Publicar guarda una copia en el historial.
import crypto from 'node:crypto';
import { all, get, run, db } from './db.js';
import { BLOCKS, STYLE_FIELDS } from './blocks.js';

db.exec(`CREATE TABLE IF NOT EXISTS pages (id INTEGER PRIMARY KEY, slug TEXT UNIQUE NOT NULL, title TEXT NOT NULL, description TEXT DEFAULT '',
  system TEXT, nav_label TEXT, in_nav INTEGER DEFAULT 0, nav_sort INTEGER DEFAULT 0, icon TEXT DEFAULT 'doc',
  draft TEXT, published TEXT, updated_at TEXT DEFAULT (datetime('now')), published_at TEXT);
CREATE TABLE IF NOT EXISTS page_versions (id INTEGER PRIMARY KEY, page_id INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  blocks TEXT NOT NULL, title TEXT, admin TEXT, created_at TEXT DEFAULT (datetime('now')));`);

export const newId = () => crypto.randomBytes(4).toString('hex');
const B = (type, data = {}) => ({ id: newId(), type, data });

// Páginas del sitio que ya existían, con sus secciones originales como bloques.
export const SYSTEM = {
  inicio: { slug: '', title: 'Inicio', nav: 0, icon: 'home', blocks: () => [B('home-hero'), B('home-duo'), B('services-list'), B('products-rail'), B('projects-mosaic'), B('contact-band')] },
  servicios: { slug: 'servicios', title: 'Servicios', nav: 1, icon: 'tools', desc: 'Consultoría ambiental, residuos sólidos, agua y saneamiento, planos y obras.',
    blocks: () => [B('services-head'), B('services-grid'), B('contact-band', { kind: 'cotizacion', subject: 'Cotización de servicio', title: 'Cuéntanos qué necesitas' })] },
  tienda: { slug: 'tienda', title: 'Tienda de equipos de protección', label: 'Tienda', nav: 2, icon: 'bag', desc: 'Zapatos de seguridad, cascos, guantes, chalecos y ropa de trabajo. Precios en soles.',
    blocks: () => [B('shop-hero'), B('shop-featured'), B('shop-catalog')] },
  portafolio: { slug: 'portafolio', title: 'Ing. Jhossi Tenorio Montenegro · Portafolio', label: 'Portafolio', nav: 3, icon: 'user', desc: 'Portafolio del Ing. Jhossi Tenorio Montenegro, ingeniero ambiental (CIP 285140): trayectoria, especialidades y formación.',
    blocks: () => [B('pf-hero'), B('pf-marquee'), B('pf-spec'), B('pf-jobs'), B('pf-study'), B('pf-gallery'), B('pf-end')] },
  contacto: { slug: 'contacto', title: 'Contacto', nav: 4, icon: 'mail', blocks: () => [B('contact-kinetic'), B('contact-form')] },
  carrito: { slug: 'carrito', title: 'Tu pedido', nav: 0, icon: 'bag', blocks: () => [B('cart')] },
};
// Direcciones que usa el sistema y no pueden tomar páginas nuevas.
export const RESERVED = /^(admin|tienda|servicios|portafolio|contacto|carrito|verificar|pedido|img|css|js|uploads|healthz|robots\.txt|sitemap\.xml|p)$/;

for (const [key, p] of Object.entries(SYSTEM)) {
  if (get('SELECT id FROM pages WHERE system = ?', key)) continue;
  const blocks = JSON.stringify(p.blocks());
  run(`INSERT INTO pages (slug, title, description, system, nav_label, in_nav, nav_sort, icon, draft, published, published_at) VALUES (?,?,?,?,?,?,?,?,?,?, datetime('now'))`,
    p.slug || '/', p.title, p.desc || '', key, p.label || p.title, p.nav ? 1 : 0, p.nav || 0, p.icon, blocks, blocks);
}

const parse = (t) => { try { const v = JSON.parse(t || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };
export const pageBySystem = (key) => get('SELECT * FROM pages WHERE system = ?', key);
export const pageBySlug = (slug) => get('SELECT * FROM pages WHERE slug = ? AND system IS NULL AND published IS NOT NULL', slug);
export const blocksOf = (p, which = 'published') => parse(p?.[which]);
export const pagePath = (p) => (p.system === 'inicio' ? '/' : '/' + p.slug);
export const navPages = () => all('SELECT * FROM pages WHERE in_nav = 1 AND (system IS NOT NULL OR published IS NOT NULL) ORDER BY nav_sort, id');

// Limpia lo que llega del editor: solo tipos y campos conocidos, textos con largo máximo.
function cleanValue(f, v, depth = 0) {
  if (f.t === 'bool') return !!v;
  if (f.t === 'num') return Math.max(0, Math.min(60, parseInt(v, 10) || 0));
  if (f.t === 'list') {
    if (!Array.isArray(v) || depth) return [];
    return v.slice(0, f.max || 60).map((it) => Object.fromEntries(f.f.map((sf) => [sf.k, cleanValue(sf, it?.[sf.k], 1)])));
  }
  const max = f.t === 'md' || f.t === 'area' || f.t === 'lines' ? 6000 : 400;
  return String(v ?? '').slice(0, max);
}
export function cleanBlocks(list) {
  if (!Array.isArray(list)) return [];
  return list.slice(0, 80).filter((b) => b && BLOCKS[b.type]).map((b) => {
    const fields = [...BLOCKS[b.type].fields, ...STYLE_FIELDS], data = {};
    for (const f of fields) if (b.data && b.data[f.k] !== undefined) data[f.k] = cleanValue(f, b.data[f.k]);
    return { id: /^[a-f0-9]{8}$/.test(b.id) ? b.id : newId(), type: b.type, hidden: !!b.hidden, data };
  });
}

export function saveDraft(id, blocks) {
  run(`UPDATE pages SET draft = ?, updated_at = datetime('now') WHERE id = ?`, JSON.stringify(cleanBlocks(blocks)), id);
}
export function publish(id, admin) {
  const p = get('SELECT * FROM pages WHERE id = ?', id);
  run(`UPDATE pages SET published = draft, published_at = datetime('now') WHERE id = ?`, id);
  run('INSERT INTO page_versions (page_id, blocks, title, admin) VALUES (?,?,?,?)', id, p.draft || '[]', p.title, admin);
  // Se guardan las últimas 30 versiones de cada página.
  run('DELETE FROM page_versions WHERE page_id = ? AND id NOT IN (SELECT id FROM page_versions WHERE page_id = ? ORDER BY id DESC LIMIT 30)', id, id);
}
export const hasChanges = (p) => (p.draft || '[]') !== (p.published || '');
