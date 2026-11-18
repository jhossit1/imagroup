import express from 'express';
import path from 'node:path';
import { all, get, run, settings, DATA_DIR } from './db.js';
import { loadSession, limited } from './auth.js';
import * as V from './views.js';
import admin from './admin.js';

const app = express();
const PORT = process.env.PORT || 3000;
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'X-Frame-Options': 'DENY',
    'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self' https://fonts.googleapis.com; style-src-attr 'unsafe-inline'; font-src https://fonts.gstatic.com; script-src 'self'; form-action 'self'; frame-ancestors 'none'",
  });
  req.cookies = Object.fromEntries((req.headers.cookie || '').split(';').map((c) => c.trim().split('=')).filter((p) => p[0]).map(([k, ...v]) => [k, decodeURIComponent(v.join('='))]));
  next();
});
app.use(express.static('public', { maxAge: '7d' }));
app.use('/uploads', express.static(path.join(DATA_DIR, 'uploads'), { maxAge: '7d' }));
app.use(express.urlencoded({ extended: false, limit: '200kb' }));
app.use(express.json({ limit: '200kb' }));
app.use(loadSession);

// Analítica agregada: solo cuenta visitas por ruta y día, sin IP ni identificadores.
app.use((req, _res, next) => {
  if (req.method === 'GET' && !req.admin && !/^\/(admin|uploads|img|css|js)|\.\w+$/.test(req.path) && !/bot|crawl|spider/i.test(req.get('user-agent') || ''))
    run(`INSERT INTO pageviews (day, path, count) VALUES (date('now'), ?, 1) ON CONFLICT(day, path) DO UPDATE SET count = count + 1`, req.path.slice(0, 120));
  next();
});

const page = (res, opts) => res.send(V.layout(settings(), opts));
const companies = () => all('SELECT * FROM companies ORDER BY sort');
const visibleProducts = () => all(`SELECT p.*, c.name AS category, c.slug AS cslug FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE p.visible = 1 ORDER BY c.sort, p.sort`);

app.get('/', (req, res) => page(res, { path: '/', body: V.home(settings(), {
  companies: companies(), services: all('SELECT * FROM services WHERE visible = 1 ORDER BY sort'),
  products: visibleProducts(), projects: all('SELECT * FROM projects WHERE visible = 1 ORDER BY sort') }) }));

app.get(['/imagroup', '/empresas/imagroup'], (_q, res) => res.redirect(301, '/servicios'));
app.get(['/gregorian', '/empresas/gregorian'], (_q, res) => res.redirect(301, '/tienda'));

app.get('/servicios', (req, res) => page(res, { title: 'Servicios', path: '/servicios', desc: 'Consultoría ambiental, residuos sólidos, agua y saneamiento, planos y obras.',
  body: V.servicesPage(settings(), companies()[0], all('SELECT * FROM services WHERE visible = 1 ORDER BY sort')) }));
app.get('/servicios/:slug', (req, res, next) => {
  const v = get('SELECT * FROM services WHERE slug = ? AND visible = 1', req.params.slug);
  if (!v) return next();
  page(res, { title: v.title, desc: v.summary, path: '/servicios', body: V.servicePage(settings(), v, all('SELECT slug, title FROM services WHERE visible = 1 AND id != ? ORDER BY sort', v.id)) });
});

app.get('/tienda', (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 60); const c = String(req.query.c || '');
  const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const products = visibleProducts().filter((p) => (!c || p.cslug === c) && (!q || norm(p.name + ' ' + p.description + ' ' + p.category).includes(norm(q))));
  page(res, { title: 'Tienda de equipos de protección', path: '/tienda', theme: 'shop', desc: 'Zapatos de seguridad, cascos, guantes, chalecos y ropa de trabajo. Precios en soles.',
    body: V.shopPage(settings(), { co: companies()[1], categories: all('SELECT * FROM categories ORDER BY sort'), products, q, c }) });
});
app.get('/tienda/:slug', (req, res, next) => {
  const p = visibleProducts().find((x) => x.slug === req.params.slug);
  if (!p) return next();
  page(res, { title: p.name, desc: p.description, path: '/tienda', theme: 'shop',
    body: V.productPage(settings(), p, visibleProducts().filter((x) => x.category_id === p.category_id && x.id !== p.id).slice(0, 4)) });
});
app.get('/carrito', (req, res) => page(res, { title: 'Tu pedido', path: '/carrito', theme: 'shop',
  body: V.cartPage(settings(), visibleProducts().map(({ slug, name, price_cents, image, availability }) => ({ slug, name, price: price_cents, image, availability }))) }));

app.get('/portafolio', (req, res) => page(res, { title: 'Portafolio', path: '/portafolio', body: V.portfolioPage(settings(), all('SELECT * FROM projects WHERE visible = 1 ORDER BY sort')) }));
app.get('/portafolio/jhossi-tenorio', (req, res) => page(res, { title: 'Ing. Jhossi Tenorio Montenegro', desc: 'Presentación profesional del Ing. Jhossi Tenorio Montenegro, ingeniero ambiental (CIP 285140).', path: '/portafolio', body: V.profilePage(settings()) }));
app.get('/portafolio/:slug', (req, res, next) => {
  const p = get('SELECT * FROM projects WHERE slug = ? AND visible = 1', req.params.slug);
  if (!p) return next();
  page(res, { title: p.title, desc: p.summary, path: '/portafolio', body: V.projectPage(settings(), p) });
});
app.get('/contacto', (req, res) => page(res, { title: 'Contacto', path: '/contacto', body: V.contactPage(settings(), String(req.query.asunto || '').slice(0, 140)) }));

// Filtro anti-spam común: campo trampa, tiempo mínimo de llenado y límite por IP.
function spam(req) {
  if (req.body.website) return 'spam';
  const t = Number(req.body._t); if (!t || Date.now() - t < 2500) return 'spam';
  if (limited('form:' + req.ip, 6, 10 * 60e3)) return 'Demasiados envíos seguidos. Intenta en unos minutos o escríbenos por WhatsApp.';
  return null;
}
const clean = (v, n) => String(v ?? '').trim().slice(0, n);
const wantsJson = (req) => (req.get('accept') || '').includes('application/json');
function notify(lead) {
  const url = settings().notify_webhook;
  if (url && /^https:\/\//.test(url)) fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: `Nueva solicitud (${lead.kind}) de ${lead.name || lead.email || ''} · ${lead.phone || lead.email || ''}`, lead }), signal: AbortSignal.timeout(5000) }).catch(() => {});
}

app.post('/contacto', (req, res) => {
  const err = spam(req);
  const b = { kind: ['contacto', 'cotizacion'].includes(req.body.kind) ? req.body.kind : 'contacto', name: clean(req.body.name, 120), phone: clean(req.body.phone, 30),
    email: clean(req.body.email, 120), organization: clean(req.body.organization, 120), subject: clean(req.body.subject, 140), message: clean(req.body.message, 3000) };
  let msg = err;
  if (!msg && (!b.email || !b.message)) msg = 'Escribe tu correo y lo que necesitas.';
  if (!msg && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email)) msg = 'Revisa el correo.';
  if (msg === 'spam') return wantsJson(req) ? res.json({ ok: true, message: 'Recibido.' }) : page(res, { body: V.message('Recibido', 'Gracias.') });
  if (msg) return wantsJson(req) ? res.status(400).json({ ok: false, message: msg }) : res.status(400).send(V.layout(settings(), { body: V.message('Revisa el formulario', msg, 'javascript:history.back()') }));
  const r = run('INSERT INTO leads (kind, name, phone, email, organization, subject, message) VALUES (?,?,?,?,?,?,?)', b.kind, b.name, b.phone, b.email, b.organization, b.subject, b.message);
  notify({ id: Number(r.lastInsertRowid), ...b });
  const ok = 'Recibido. Te responderemos a tu correo.';
  wantsJson(req) ? res.json({ ok: true, message: ok }) : page(res, { title: 'Solicitud enviada', body: V.message('Solicitud enviada', ok) });
});

app.post('/pedido', (req, res) => {
  const err = spam(req);
  if (err === 'spam') return res.redirect('/tienda');
  let items = [];
  try { items = JSON.parse(req.body.items || '[]'); } catch { /* vacío */ }
  const catalog = new Map(visibleProducts().map((p) => [p.slug, p]));
  // Precios siempre desde la base de datos, nunca desde el navegador.
  items = items.slice(0, 50).map((i) => ({ p: catalog.get(String(i.slug)), qty: Math.min(999, Math.max(1, parseInt(i.qty, 10) || 1)) }))
    .filter((i) => i.p && i.p.availability !== 'agotado').map(({ p, qty }) => ({ slug: p.slug, name: p.name, price: p.price_cents, qty }));
  const name = clean(req.body.name, 120), phone = clean(req.body.phone, 30);
  const msg = err || (!items.length ? 'Tu pedido está vacío.' : (!name || !phone) ? 'Completa nombre y teléfono.' : null);
  if (msg) return res.status(400).send(V.layout(settings(), { body: V.message('No se pudo enviar', msg, '/carrito') }));
  // Evita pedidos duplicados por doble clic: mismo teléfono y mismos productos en 2 minutos.
  const itemsJson = JSON.stringify(items);
  const dup = get(`SELECT * FROM leads WHERE kind = 'pedido' AND phone = ? AND items = ? AND created_at > datetime('now','-2 minutes')`, phone, itemsJson);
  const total = items.some((i) => i.price == null) ? null : items.reduce((a, i) => a + i.price * i.qty, 0);
  const lead = dup || get('SELECT * FROM leads WHERE id = ?', run(`INSERT INTO leads (kind, name, phone, message, items, total_cents, delivery) VALUES ('pedido',?,?,?,?,?,?)`,
    name, phone, clean(req.body.message, 1500), itemsJson, total, req.body.delivery === 'envio' ? 'envio' : 'recojo').lastInsertRowid);
  if (!dup) notify(lead);
  page(res, { title: 'Pedido recibido', theme: 'shop', body: V.orderDone(settings(), lead, items) });
});

app.get('/robots.txt', (req, res) => res.type('text').send(settings().review_banner === '1' ? 'User-agent: *\nDisallow: /\n' : `User-agent: *\nDisallow: /admin\nSitemap: ${req.protocol}://${req.get('host')}/sitemap.xml\n`));
app.get('/sitemap.xml', (req, res) => {
  const base = `${req.protocol}://${req.get('host')}`;
  const urls = ['/', '/servicios', '/tienda', '/portafolio', '/portafolio/jhossi-tenorio', '/contacto',
    ...all('SELECT slug FROM services WHERE visible = 1').map((r) => '/servicios/' + r.slug),
    ...all('SELECT slug FROM products WHERE visible = 1').map((r) => '/tienda/' + r.slug),
    ...all('SELECT slug FROM projects WHERE visible = 1').map((r) => '/portafolio/' + r.slug)];
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((u) => `<url><loc>${base}${u}</loc></url>`).join('')}</urlset>`);
});
app.get('/healthz', (_q, res) => { get('SELECT 1 AS ok'); res.json({ ok: true, version: process.env.APP_VERSION || 'dev' }); });

app.use('/admin', admin);

app.use((req, res) => res.status(404).send(V.layout(settings(), { title: 'No encontrado', body: V.message('Página no encontrada', 'La dirección no existe o fue retirada.', '/') })));
app.use((err, req, res, _next) => { console.error(new Date().toISOString(), req.method, req.path, err); res.status(500).send(V.layout(settings(), { body: V.message('Algo salió mal', 'Intenta de nuevo en unos segundos.', '/') })); });

app.listen(PORT, () => console.log(`Imagroup escuchando en :${PORT}`));
