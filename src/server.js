import express from 'express';
import crypto from 'node:crypto';
import { all, get, run, settings } from './db.js';
import { loadSession, limited, sha, token } from './auth.js';
import * as V from './views.js';
import admin from './admin.js';
import { verifyData } from './workers.js';
import { publicWorker, teamPath, teamProfile } from './team.js';
import { reviewByCode, reviewForm, reviewDone, reviewSubmit, isOpen } from './reviews.js';
import { pageBySystem, pageBySlug, pagePath, navPages } from './pages.js';
import { renderPage, visibleProducts } from './render.js';

const app = express();
// Puerto virtual: en Cloudflare no se abre ningún puerto; src/worker.js entrega cada petición a este servidor.
export const PORT = 3000;
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
// public/ lo sirve Cloudflare antes de llegar aquí y /uploads lo sirve src/worker.js desde Workers KV.
app.use(express.urlencoded({ extended: false, limit: '200kb' }));
app.use(express.json({ limit: '200kb' }));
app.use(loadSession);

// Analítica agregada: solo cuenta visitas por ruta y día, sin IP ni identificadores.
app.use((req, _res, next) => {
  if (req.method === 'GET' && !req.admin && !/^\/(admin|uploads|img|css|js|healthz)|\.\w+$/.test(req.path) && !/bot|crawl|spider/i.test(req.get('user-agent') || ''))
    run(`INSERT INTO pageviews (day, path, count) VALUES (date('now'), ?, 1) ON CONFLICT(day, path) DO UPDATE SET count = count + 1`, req.path.slice(0, 120));
  next();
});

const page = (res, opts) => res.send(V.layout(settings(), opts));
const companies = () => all('SELECT * FROM companies ORDER BY sort');
const sysPage = (req, res, key) => res.send(renderPage(req, pageBySystem(key)));
V.setNav(() => navPages().map((p) => [pagePath(p), p.nav_label || p.title, p.icon]));

app.get('/', (req, res) => sysPage(req, res, 'inicio'));

app.get(['/imagroup', '/empresas/imagroup'], (_q, res) => res.redirect(301, '/servicios'));
app.get(['/gregorian', '/empresas/gregorian'], (_q, res) => res.redirect(301, '/tienda'));

app.get('/servicios', (req, res) => sysPage(req, res, 'servicios'));
app.get('/servicios/:slug', (req, res, next) => {
  const v = get('SELECT * FROM services WHERE slug = ? AND visible = 1', req.params.slug);
  if (!v) return next();
  page(res, { title: v.title, desc: v.summary, path: '/servicios', body: V.servicePage(settings(), v, all('SELECT slug, title FROM services WHERE visible = 1 AND id != ? ORDER BY sort', v.id)) });
});

app.get('/tienda', (req, res) => sysPage(req, res, 'tienda'));
app.get('/tienda/:slug', (req, res, next) => {
  const p = visibleProducts().find((x) => x.slug === req.params.slug);
  if (!p) return next();
  page(res, { title: p.name, desc: p.description, path: '/tienda', theme: 'shop',
    body: V.productPage(settings(), p, visibleProducts().filter((x) => x.category_id === p.category_id && x.id !== p.id).slice(0, 4).concat(visibleProducts().filter((x) => x.category_id !== p.category_id)).slice(0, 4)) });
});
app.get('/carrito', (req, res) => sysPage(req, res, 'carrito'));

app.get('/portafolio', (req, res) => sysPage(req, res, 'portafolio'));
app.get('/portafolio/jhossi-tenorio', (req, res) => res.redirect(301, '/portafolio'));
app.get('/portafolio/:slug', (req, res, next) => {
  const p = get('SELECT * FROM projects WHERE slug = ? AND visible = 1', req.params.slug);
  if (!p) return next();
  page(res, { title: p.title, desc: p.summary, path: '/portafolio', body: V.projectPage(settings(), p) });
});
// Verificación por QR de certificados y carnés: solo datos autorizados, nunca la ficha laboral.
app.get('/verificar/:code', (req, res) => {
  const c = verifyData(String(req.params.code).slice(0, 20)), co = String(c?.company || '').replace(/[.]$/, ''), ok = c?.state === 'valido', e = V.h, isB = c?.type === 'carne';
  const TIT = { valido: isB ? 'Carné válido' : 'Certificado válido', vencido: 'Carné vencido', anulado: isB ? 'Carné anulado' : 'Certificado anulado', inactivo: 'Ya no trabaja con nosotros' };
  const MSG = { valido: isB ? `Esta persona trabaja con ${e(co)}.` : '', vencido: 'El carné superó su fecha de vigencia. Pida a la persona que lo renueve.', anulado: 'Este documento fue anulado y no debe aceptarse.', inactivo: `Esta persona ya no forma parte del equipo de ${e(co)}.` };
  res.status(c ? 200 : 404).set('X-Robots-Tag', 'noindex');
  page(res, { title: 'Verificación', path: '/verificar', body: `<section class="vf"><div class="wrap"><div class="vf-card ${ok ? 'ok' : 'bad'}">
    ${isB && c.photo ? `<img class="vf-photo" src="${e(c.photo)}" alt="Foto de ${e(c.name)}">` : ''}<span class="vf-ico" aria-hidden="true">${ok ? '✓' : '!'}</span><p class="eyebrow">Verificación de ${isB ? 'carné' : 'certificado'}</p>
    <h1>${c ? TIT[c.state] : 'Código no encontrado'}</h1>${c && MSG[c.state] ? `<p class="vf-msg">${MSG[c.state]}</p>` : ''}
    ${c?.trusted ? '<p class="vf-trust">★ Trabajador de confianza</p>' : ''}
    ${c?.rt?.some((r) => r.v) ? `<ul class="vf-rate" aria-label="Calificación">${c.rt.filter((r) => r.v).map((r, i) => `<li><span>${e(r.t)}</span><i style="--f:${r.v * 20}%;--i:${i}" role="img" aria-label="${String(r.v).replace('.', ',')} de 5"></i><b>${String(r.v).replace('.', ',')}</b></li>`).join('')}</ul>
      <p class="vf-note">${isB ? 'Calificación actual según sus últimas evaluaciones.' : 'Calificación al emitir el certificado.'}</p>` : ''}
    ${!c ? '<p>Revisa que el código esté bien escrito. Si el problema sigue, contáctanos.</p>' : isB
      ? `<dl><dt>Nombre</dt><dd>${e(c.name)}</dd>${c.trade ? `<dt>Oficio</dt><dd>${e(c.trade)}</dd>` : ''}<dt>Empresa</dt><dd>${e(c.company || '')}</dd><dt>Válido hasta</dt><dd>${e(c.expires)}</dd><dt>Carné</dt><dd>${e(c.code)}</dd></dl>`
      : `<dl><dt>Otorgado a</dt><dd>${e(c.name)}</dd><dt>Reconocimiento</dt><dd>${e(c.title)}</dd><dt>Empresa</dt><dd>${e(c.company || '')}</dd>
    ${c.period ? `<dt>Periodo</dt><dd>${e(c.period)}</dd>` : ''}<dt>Emitido</dt><dd>${e(c.issued_at.slice(0, 10))}</dd><dt>Código</dt><dd>${e(c.code)}</dd></dl>`}
    <p class="vf-at">Consultado el ${new Date().toLocaleString('es-PE', { timeZone: 'America/Lima', dateStyle: 'long', timeStyle: 'short' })}</p></div></div></section>` });
});
app.get('/contacto', (req, res) => sysPage(req, res, 'contacto'));
app.get('/equipo', (req, res) => sysPage(req, res, 'equipo'));
app.get('/equipo/:ref', (req, res, next) => {
  const w = publicWorker(parseInt(req.params.ref, 10)); if (!w) return next();
  if (req.params.ref !== teamPath(w).slice(8)) return res.redirect(301, teamPath(w));
  page(res, { title: w.name, desc: `${w.name}${w.trade ? ', ' + w.trade : ''}: calificación de puntualidad, garantía y calidad.`, path: '/equipo', body: teamProfile(w) });
});

// Opinión del cliente: enlace único creado en el panel. Nunca indexado.
const opWorker = (rv) => get(`SELECT w.id, w.name, w.trade, w.photo, w.status, COALESCE(w.public, 1) AS public, co.name AS company FROM workers w LEFT JOIN companies co ON co.id = w.company_id WHERE w.id = ?`, rv.worker_id);
const opClosed = (res, rv) => page(res, { title: 'Opinión', body: V.message(rv?.answered_at ? 'Ya recibimos tu opinión' : 'Este enlace no está disponible',
  rv?.answered_at ? 'Gracias. Este enlace sirve una sola vez.' : 'Puede que haya vencido o que se haya anulado. Pide un enlace nuevo a quien te lo envió.', '/equipo') });
app.get('/opinar/:code', (req, res) => {
  const rv = reviewByCode(req.params.code); res.set('X-Robots-Tag', 'noindex');
  if (!rv || !isOpen(rv)) return res.status(rv ? 410 : 404), opClosed(res, rv);
  page(res, { title: 'Tu opinión', path: '/opinar', body: reviewForm(rv, opWorker(rv)) });
});
app.post('/opinar/:code', (req, res) => {
  const rv = reviewByCode(req.params.code); res.set('X-Robots-Tag', 'noindex');
  if (!rv || !isOpen(rv)) return opClosed(res, rv);
  const w = opWorker(rv);
  if (req.body.website) return opClosed(res, { answered_at: 1 });
  if (limited('op:' + req.ip, 10, 60 * 60e3)) return res.status(429), page(res, { title: 'Tu opinión', body: reviewForm(rv, w, 'Demasiados envíos seguidos. Intenta en unos minutos.') });
  const err = reviewSubmit(rv, req.body);
  if (err) return res.status(400), page(res, { title: 'Tu opinión', body: reviewForm(rv, w, err) });
  page(res, { title: 'Gracias', body: reviewDone(reviewByCode(rv.code), w, w.public && w.status !== 'inactivo' ? teamPath(w) : '') });
});

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
  const urls = ['/', '/servicios', '/tienda', '/portafolio', '/contacto', '/equipo',
    ...all('SELECT slug FROM services WHERE visible = 1').map((r) => '/servicios/' + r.slug),
    ...all('SELECT slug FROM products WHERE visible = 1').map((r) => '/tienda/' + r.slug),
    ...all('SELECT slug FROM projects WHERE visible = 1').map((r) => '/portafolio/' + r.slug),
    ...all('SELECT slug FROM pages WHERE system IS NULL AND published IS NOT NULL').map((r) => '/' + r.slug)];
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((u) => `<url><loc>${base}${u}</loc></url>`).join('')}</urlset>`);
});
app.get('/healthz', (_q, res) => { get('SELECT 1 AS ok'); res.json({ ok: true, version: process.env.APP_VERSION || 'dev' }); });

// Enlace de un solo uso (60 min) para crear o recuperar un administrador. Lo usa scripts/create-admin.js
// con la clave secreta SETUP_KEY (wrangler secret put SETUP_KEY). Sin clave configurada, no existe.
app.post('/__setup-link', (req, res) => {
  const key = process.env.SETUP_KEY || '', sent = String(req.get('authorization') || '').replace(/^Bearer /, '');
  const ok = key.length >= 24 && crypto.timingSafeEqual(Buffer.from(sha(sent)), Buffer.from(sha(key)));
  if (!ok || limited('setup:' + req.ip, 10, 60 * 60e3)) return res.status(404).end();
  const user = String(req.body.user || '').trim();
  if (!/^[a-zA-Z0-9._-]{3,40}$/.test(user)) return res.status(400).json({ ok: false, message: 'Usuario no válido (3 a 40 letras, números, punto, guion).' });
  const t = token();
  run('INSERT INTO setup_tokens (token_hash, username, expires) VALUES (?,?,?)', sha(t), user, Date.now() + 60 * 60e3);
  res.json({ ok: true, url: `${req.protocol}://${req.get('host')}/admin/setup?t=${t}` });
});

app.use('/admin', admin);

// Páginas nuevas creadas en el diseñador.
app.get('/:slug', (req, res, next) => { const p = pageBySlug(req.params.slug); if (!p) return next(); res.send(renderPage(req, p)); });

app.use((req, res) => res.status(404).send(V.layout(settings(), { title: 'No encontrado', body: V.message('Página no encontrada', 'La dirección no existe o fue retirada.', '/') })));
app.use((err, req, res, _next) => { console.error(new Date().toISOString(), req.method, req.path, err); res.status(500).send(V.layout(settings(), { body: V.message('Algo salió mal', 'Intenta de nuevo en unos segundos.', '/') })); });

app.listen(PORT);
