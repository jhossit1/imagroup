import express from 'express';
import multer from 'multer';
import path from 'node:path';
import crypto from 'node:crypto';
import { all, get, run, settings, audit, DATA_DIR } from './db.js';
import { checkPassword, hashPassword, passwordProblem, createSession, destroySession, requireAdmin, limited, sha } from './auth.js';
import { h, money } from './views.js';
import { mountWorkers, monthStar } from './workers.js';
import { mountBuilder, mountBuilderAdmin } from './builder.js';

const r = express.Router();
const upload = multer({
  storage: multer.diskStorage({
    destination: path.join(DATA_DIR, 'uploads'),
    filename: (_q, f, cb) => cb(null, crypto.randomBytes(8).toString('hex') + (path.extname(f.originalname).toLowerCase().match(/^\.(jpe?g|png|webp)$/) ? path.extname(f.originalname).toLowerCase() : '.bin')),
  }),
  limits: { fileSize: 4 * 1024 * 1024, files: 1 },
  fileFilter: (_q, f, cb) => cb(null, /^image\/(jpeg|png|webp)$/.test(f.mimetype)),
});
const secure = (req) => req.secure || req.get('x-forwarded-proto') === 'https';

// Definición de entidades editables: un solo formulario genérico para todas.
const SLUG = { name: 'slug', label: 'URL (slug)', help: 'Solo minúsculas, números y guiones. Se genera del título si lo dejas vacío.' };
const ENT = {
  products: { label: 'Productos', one: 'producto', title: 'name', cols: ['name', 'price_cents', 'availability', 'visible'], fields: [
    { name: 'name', label: 'Nombre', req: 1 }, SLUG,
    { name: 'category_id', label: 'Categoría', type: 'select', options: () => all('SELECT id AS v, name AS l FROM categories ORDER BY sort') },
    { name: 'description', label: 'Descripción', type: 'textarea' }, { name: 'variants', label: 'Variantes (tallas, colores)', help: 'Ejemplo: 38, 39, 40, 41, 42' },
    { name: 'price_cents', label: 'Precio en soles', type: 'money', help: 'Déjalo vacío para mostrar "Consultar".' },
    { name: 'availability', label: 'Disponibilidad', type: 'select', options: () => ['disponible', 'a pedido', 'agotado'].map((v) => ({ v, l: v })) },
    { name: 'image', label: 'Foto', type: 'image' }, { name: 'sort', label: 'Orden', type: 'number' }, { name: 'visible', label: 'Publicado', type: 'bool' }] },
  categories: { label: 'Categorías', one: 'categoría', title: 'name', cols: ['name', 'sort'], fields: [{ name: 'name', label: 'Nombre', req: 1 }, SLUG, { name: 'sort', label: 'Orden', type: 'number' }] },
  services: { label: 'Servicios', one: 'servicio', title: 'title', cols: ['title', 'visible'], fields: [
    { name: 'title', label: 'Título', req: 1 }, SLUG, { name: 'summary', label: 'Resumen (una línea)' }, { name: 'body', label: 'Detalle', type: 'textarea' },
    { name: 'image', label: 'Foto', type: 'image' }, { name: 'sort', label: 'Orden', type: 'number' }, { name: 'visible', label: 'Publicado', type: 'bool' }], fixed: { company_id: 1 } },
  projects: { label: 'Portafolio', one: 'proyecto', title: 'title', cols: ['title', 'area', 'period', 'visible'], fields: [
    { name: 'title', label: 'Título', req: 1 }, SLUG, { name: 'area', label: 'Área' }, { name: 'period', label: 'Fecha aproximada', help: 'Ejemplo: 2018 o 2023-2024' },
    { name: 'place', label: 'Lugar' }, { name: 'summary', label: 'Descripción', type: 'textarea' }, { name: 'image', label: 'Foto principal', type: 'image' },
    { name: 'gallery', label: 'Galería (una ruta de imagen por línea)', type: 'textarea' }, { name: 'sort', label: 'Orden', type: 'number' }, { name: 'visible', label: 'Publicado', type: 'bool' }] },
  companies: { label: 'Empresas', one: 'empresa', title: 'name', cols: ['name', 'tagline'], noCreate: 1, fields: [
    { name: 'name', label: 'Nombre comercial', req: 1 }, { name: 'tagline', label: 'Lema' }, { name: 'description', label: 'Descripción', type: 'textarea' },
    { name: 'scope', label: 'Ámbitos (uno por línea)', type: 'textarea' }, { name: 'logo', label: 'Logo (fondo claro)', type: 'image' }, { name: 'logo_dark', label: 'Logo (fondo oscuro)', type: 'image' },
    { name: 'signer_name', label: 'Certificados: firmante 1, nombre', help: 'Ejemplo: nombre del gerente general.' }, { name: 'signer_role', label: 'Certificados: firmante 1, cargo' },
    { name: 'signature', label: 'Certificados: firma 1 (PNG con fondo transparente)', type: 'image' },
    { name: 'signer2_name', label: 'Certificados: firmante 2, nombre' }, { name: 'signer2_role', label: 'Certificados: firmante 2, cargo' },
    { name: 'signature2', label: 'Certificados: firma 2 (PNG con fondo transparente)', type: 'image' }] },
};
const SETTINGS = [
  ['phone_1', 'Teléfono principal (WhatsApp)'], ['phone_2', 'Teléfono secundario'], ['whatsapp', 'Número de WhatsApp con código de país (ej. 51943300006)'],
  ['email', 'Correo de contacto'], ['city', 'Ciudad'], ['facebook', 'Enlace de Facebook'],
  ['notify_webhook', 'Aviso de nuevas solicitudes: URL https de webhook (opcional)'],
  ['owner_name', 'Portafolio: nombre del profesional (vacío = no se muestra el perfil)'], ['owner_role', 'Portafolio: cargo'], ['owner_bio', 'Portafolio: trayectoria (un párrafo por línea)'],
  ['owner_photo', 'Portafolio: foto (ruta)'], ['bono_oro', 'Trabajadores: bono nivel Oro (S/)'], ['bono_plata', 'Trabajadores: bono nivel Plata (S/)'], ['bono_bronce', 'Trabajadores: bono nivel Bronce (S/)'], ['review_banner', 'Mostrar aviso de versión de revisión (1 = sí, 0 = no)'],
];
const LEAD_STATES = ['nuevo', 'en proceso', 'cotizado', 'confirmado', 'entregado', 'cerrado', 'descartado'];

// Íconos de trazo (24×24) para la navegación del panel.
const IC = {
  home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  layout: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M9 9v12"/>',
  inbox: '<path d="M4 4h16v16H4z"/><path d="M4 14h4l2 3h4l2-3h4"/>',
  box: '<path d="M3 7l9-4 9 4-9 4-9-4z"/><path d="M3 7v10l9 4 9-4V7M12 11v10"/>',
  tag: '<path d="M3 12V3h9l9 9-9 9z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
  leaf: '<path d="M5 19C5 10 11 5 20 5c0 9-5 15-14 15"/><path d="M5 20l8-8"/>',
  folder: '<path d="M3 6h6l2 2h10v11H3z"/>',
  building: '<path d="M4 21V4h10v17M14 9h6v12M8 8h2M8 12h2M8 16h2M2 21h20"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
  out: '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>',
  ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6"/>',
  dots: '<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.4 1.4M17.6 17.6 19 19M5 19l1.4-1.4M17.6 6.4 19 5"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  down: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c2 .7 3.2 2.4 3.5 5.2"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  coin: '<circle cx="12" cy="12" r="9"/><path d="M14.8 9.2c-.5-.9-1.6-1.4-2.8-1.4-1.6 0-2.8.8-2.8 2.1 0 3 5.8 1.4 5.8 4.3 0 1.3-1.3 2.1-3 2.1-1.3 0-2.5-.6-3-1.6M12 6v1.8M12 16.3V18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', pen: '<path d="M4 20h4L19 9l-4-4L4 16z"/>', x: '<path d="M6 6l12 12M18 6 6 18"/>', in: '<path d="M10 4H5v16h5M14 8l4 4-4 4M18 12H8"/>',
};
const ic = (n) => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${IC[n]}</svg>`;
const NAV = [['/admin', 'Inicio', 'home'], ['/admin/paginas', 'Diseño web', 'layout'], ['/admin/leads', 'Solicitudes', 'inbox'], ['/admin/trabajadores', 'Trabajadores', 'users'], ['/admin/products', 'Productos', 'box'], ['/admin/categories', 'Categorías', 'tag'],
  ['/admin/services', 'Servicios', 'leaf'], ['/admin/projects', 'Portafolio', 'folder'], ['/admin/companies', 'Empresas', 'building'], ['/admin/ajustes', 'Ajustes', 'gear'], ['/admin/auditoria', 'Auditoría', 'shield']];
const TABS = ['/admin', '/admin/leads', '/admin/trabajadores', '/admin/products'];

const shell = (req, title, body) => {
  const head = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex"><meta name="color-scheme" content="light dark"><title>${h(title)} · Admin Imagroup</title><link rel="icon" href="/img/brand/imagroup.webp">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@75..100,400..800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/css/admin.css?v=4"><link rel="stylesheet" href="/css/admin-team.css?v=8"><link rel="stylesheet" href="/css/builder.css?v=3"><script src="/js/theme.js?v=7"></script><script src="/js/admin.js?v=8" defer></script><script src="/js/builder.js?v=2" defer></script></head>`;
  const themeBtn = `<button type="button" class="ad-icon ad-theme" data-theme-btn aria-label="Cambiar entre modo claro y oscuro">${ic('sun')}${ic('moon')}</button>`;
  if (!req.admin) return `${head}<body class="ad-guest"><div class="ad-orbs" aria-hidden="true"><i></i><i></i><i></i></div>${themeBtn}<main class="ad-guest-main">${body}</main></body></html>`;
  const cur = req.originalUrl.split('?')[0].replace(/\/$/, '') || '/admin';
  const on = (href) => (href === '/admin' ? cur === href : cur === href || cur.startsWith(href + '/'));
  const fresh = get(`SELECT COUNT(*) n FROM leads WHERE status = 'nuevo'`).n;
  const link = ([href, label, icon], cls = '') => `<a class="${cls}" href="${href}"${on(href) ? ' aria-current="page"' : ''}>${ic(icon)}<span>${label}</span>${href === '/admin/leads' && fresh ? `<b class="ad-badge">${fresh}</b>` : ''}</a>`;
  const logout = `<form method="post" action="/admin/logout"><input type="hidden" name="_csrf" value="${h(req.csrf)}"><button class="ad-out">${ic('out')}<span>Salir</span></button></form>`;
  const user = h(req.admin.username);
  return `${head}<body><div class="ad">
<aside class="ad-side"><a class="ad-brand" href="/admin"><img src="/img/brand/imagroup.webp" alt="" width="36" height="36"><span><b>Imagroup</b><small>Panel de gestión</small></span></a>
<nav class="ad-nav" aria-label="Secciones del panel">${NAV.map((n) => link(n)).join('')}</nav>
<div class="ad-promo"><div class="ad-docs" aria-hidden="true"><i></i><i></i><i>${ic('down')}</i></div><b>Solicitudes en Excel</b><small>Todas las solicitudes y pedidos en un archivo CSV.</small><a class="a-btn" href="/admin/leads.csv">Descargar</a></div>
${logout}</aside>
<div class="ad-body"><header class="ad-top"><a class="ad-brand ad-brand-m" href="/admin"><img src="/img/brand/imagroup.webp" alt="" width="32" height="32"><b>Imagroup</b></a>
<p class="ad-crumb">${h(title)}</p><div class="ad-tools"><a class="ad-icon" href="/" target="_blank" rel="noopener" aria-label="Ver el sitio público">${ic('ext')}</a>${themeBtn}<span class="ad-user" title="${user}">${user.slice(0, 1).toUpperCase()}</span></div></header>
<main class="ad-main" id="main">${body}</main></div></div>
<nav class="ad-tabs" aria-label="Secciones principales">${NAV.filter((n) => TABS.includes(n[0])).map((n) => link(n)).join('')}
<details class="ad-more"><summary>${ic('dots')}<span>Más</span></summary><div class="ad-sheet">${NAV.filter((n) => !TABS.includes(n[0])).map((n) => link(n)).join('')}<a href="/admin/leads.csv">${ic('down')}<span>Exportar CSV</span></a>${logout}</div></details></nav>
</body></html>`;
};
const csrf = (req) => `<input type="hidden" name="_csrf" value="${h(req.csrf)}">`;
const slugify = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);

// ---- Acceso ----
r.get('/login', (req, res) => req.admin ? res.redirect('/admin') : res.send(shell(req, 'Ingresar', loginForm())));
const loginForm = (err = '') => `<form class="a-card a-login" method="post" action="/admin/login"><img class="a-logo" src="/img/brand/imagroup.webp" alt="" width="56" height="56"><h1>Panel de gestión</h1><p class="a-muted">Ingresa con tu usuario de Imagroup.</p>
${err ? `<p class="a-err" role="alert">${h(err)}</p>` : ''}<label>Usuario<input name="username" required autocomplete="username"></label>
<label>Contraseña<input name="password" type="password" required autocomplete="current-password"></label><button class="a-btn">Ingresar</button></form>`;
r.post('/login', express.urlencoded({ extended: false }), (req, res) => {
  if (limited('login:' + req.ip, 5, 15 * 60e3)) return res.status(429).send(shell(req, 'Ingresar', loginForm('Demasiados intentos. Espera 15 minutos.')));
  const a = get('SELECT * FROM admins WHERE username = ?', String(req.body.username || ''));
  if (!a || !checkPassword(String(req.body.password || ''), a.pass_hash)) return res.status(401).send(shell(req, 'Ingresar', loginForm('Usuario o contraseña incorrectos.')));
  createSession(res, a.id, secure(req)); audit(a.username, 'login', 'admin', a.id);
  res.redirect('/admin');
});
// Alta del primer administrador con un enlace de un solo uso generado en el servidor (scripts/create-admin.js).
r.get('/setup', (req, res) => {
  const t = get('SELECT * FROM setup_tokens WHERE token_hash = ? AND expires > ?', sha(String(req.query.t || '')), Date.now());
  if (!t) return res.status(410).send(shell(req, 'Enlace vencido', '<div class="a-card"><h1>Enlace vencido o inválido</h1><p>Genera uno nuevo en el servidor.</p></div>'));
  res.send(shell(req, 'Crear contraseña', setupForm(req.query.t, t.username)));
});
const setupForm = (t, u, err = '') => `<form class="a-card a-login" method="post" action="/admin/setup"><h1>Crea tu contraseña</h1><p>Usuario: <b>${h(u)}</b></p>
${err ? `<p class="a-err" role="alert">${h(err)}</p>` : ''}<input type="hidden" name="t" value="${h(t)}"><input type="hidden" name="username" value="${h(u)}" autocomplete="username">
<label>Contraseña (mín. 12 caracteres, letras y números)<input name="password" type="password" required minlength="12" autocomplete="new-password"></label>
<label>Repite la contraseña<input name="password2" type="password" required autocomplete="new-password"></label><button class="a-btn">Guardar y entrar</button></form>`;
r.post('/setup', (req, res) => {
  const t = get('SELECT * FROM setup_tokens WHERE token_hash = ? AND expires > ?', sha(String(req.body.t || '')), Date.now());
  if (!t) return res.status(410).send(shell(req, 'Enlace vencido', '<div class="a-card"><h1>Enlace vencido</h1></div>'));
  const pw = String(req.body.password || '');
  const p = passwordProblem(pw) || (pw !== req.body.password2 ? 'Las contraseñas no coinciden.' : null);
  if (p) return res.status(400).send(shell(req, 'Crear contraseña', setupForm(req.body.t, t.username, p)));
  run('INSERT INTO admins (username, pass_hash) VALUES (?, ?) ON CONFLICT(username) DO UPDATE SET pass_hash = excluded.pass_hash', t.username, hashPassword(pw));
  run('DELETE FROM setup_tokens WHERE token_hash = ?', t.token_hash);
  const a = get('SELECT id FROM admins WHERE username = ?', t.username);
  run('DELETE FROM sessions WHERE admin_id = ?', a.id);
  audit(t.username, 'password_set', 'admin', a.id); createSession(res, a.id, secure(req)); res.redirect('/admin');
});

// Multipart (fotos) se procesa antes de verificar CSRF, y solo con sesión iniciada.
r.post('/:ent/:id', (req, res, next) => (req.admin && ENT[req.params.ent] ? upload.any()(req, res, next) : next()));
// Foto del trabajador para el carné: solo JPG o PNG (el PDF no admite WebP).
const photoUpload = multer({ storage: upload.storage, limits: { fileSize: 4 * 1024 * 1024, files: 1 }, fileFilter: (_q, f, cb) => cb(null, /^image\/(jpeg|png)$/.test(f.mimetype)) });
r.post('/trabajadores/:id', (req, res, next) => (req.admin ? photoUpload.single('photo__file')(req, res, next) : next()));
mountBuilder(r);
r.use(requireAdmin);
r.post('/logout', (req, res) => { destroySession(req, res); res.redirect('/admin/login'); });
mountWorkers(r, { shell: (...a) => shell(...a), ic: (n) => ic(n), csrf: (q) => csrf(q) });
mountBuilderAdmin(r, { shell: (...a) => shell(...a), ic: (n) => ic(n), csrf: (q) => csrf(q) });

// ---- Inicio del panel ----
r.get('/', (req, res) => {
  const c = (sql) => get(sql).n;
  const PV = `FROM pageviews WHERE path <> '/healthz' AND`;
  const top = all(`SELECT path, SUM(count) AS n ${PV} day >= date('now','-30 days') GROUP BY path ORDER BY n DESC LIMIT 6`);
  const byDay = Object.fromEntries(all(`SELECT day, SUM(count) AS n ${PV} day >= date('now','-13 days') GROUP BY day`).map((d) => [d.day, d.n]));
  const series = [...Array(14)].map((_, i) => { const d = new Date(Date.now() - (13 - i) * 864e5).toISOString().slice(0, 10); return { d, n: byDay[d] || 0 }; });
  const v30 = c(`SELECT COALESCE(SUM(count),0) n ${PV} day >= date('now','-30 days')`);
  const vPrev = c(`SELECT COALESCE(SUM(count),0) n ${PV} day >= date('now','-60 days') AND day < date('now','-30 days')`);
  const fresh = c(`SELECT COUNT(*) n FROM leads WHERE status='nuevo'`), orders = c(`SELECT COUNT(*) n FROM leads WHERE kind='pedido'`), total = c('SELECT COUNT(*) n FROM leads');
  const pub = c('SELECT COUNT(*) n FROM products WHERE visible=1'), prods = c('SELECT COUNT(*) n FROM products');
  const leads = all('SELECT * FROM leads ORDER BY id DESC LIMIT 5');
  const acts = all('SELECT * FROM audit ORDER BY id DESC LIMIT 5');

  // Curva suave (Catmull-Rom → Bézier) de visitas por día.
  const W = 320, H = 120, mx = Math.max(1, ...series.map((s) => s.n));
  const P = series.map((s, i) => [+(i * (W / 13)).toFixed(1), +(H - 10 - (s.n / mx) * (H - 30)).toFixed(1)]);
  let line = `M${P[0]}`;
  for (let i = 0; i < 13; i++) {
    const [a, b, c2, d] = [P[i - 1] || P[i], P[i], P[i + 1], P[i + 2] || P[i + 1]];
    line += ` C${(b[0] + (c2[0] - a[0]) / 6).toFixed(1)},${(b[1] + (c2[1] - a[1]) / 6).toFixed(1)} ${(c2[0] - (d[0] - b[0]) / 6).toFixed(1)},${(c2[1] - (d[1] - b[1]) / 6).toFixed(1)} ${c2}`;
  }
  const peak = series.reduce((m, s, i) => (s.n > series[m].n ? i : m), 0);
  const delta = vPrev ? Math.round(((v30 - vPrev) / vPrev) * 100) : null;
  const tmax = Math.max(1, ...top.map((t) => t.n));
  const pct = prods ? Math.round((pub / prods) * 100) : 0;
  const today = new Intl.DateTimeFormat('es-PE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Lima' }).format(new Date());
  const ACT = { login: ['in', 'Ingresó al panel'], create: ['plus', 'Creó'], update: ['pen', 'Editó'], delete: ['x', 'Eliminó'], export: ['down', 'Exportó'], password_set: ['shield', 'Definió su contraseña'], evaluate: ['star', 'Evaluó a'], approve: ['star', 'Aprobó reconocimiento de'], revoke: ['x', 'Revocó'], certificate: ['shield', 'Emitió certificado a'], badge: ['users', 'Generó carné de'], publish: ['ext', 'Publicó la página'], restore: ['pen', 'Restauró una versión de'], upload: ['plus', 'Subió una imagen'] };
  const ENTN = { products: 'un producto', categories: 'una categoría', services: 'un servicio', projects: 'un proyecto', companies: 'una empresa', settings: 'los ajustes', leads: 'solicitudes', workers: 'un trabajador', certificates: 'un certificado', pages: 'una página' };
  const count = (n, suf = '') => `<b data-count="${n}" data-suf="${suf}">${n}${suf}</b>`;

  res.send(shell(req, 'Inicio', `<div class="dash">
  <section class="d-main">
    <header class="d-head rise"><p class="d-eye">Hola, ${h(req.admin.username)} · ${h(today)}</p><h1>Resumen</h1></header>
    <div class="d-grid">
      <a class="d-hero rise" style="--i:1" href="/admin/leads?status=nuevo"><span class="d-chip" aria-hidden="true"><i></i><i></i></span><span class="d-hero-k">Imagroup</span>
        <span class="d-hero-n">${count(fresh)}<small>solicitudes nuevas</small></span>
        <span class="d-hero-f"><span><small>Pedidos</small>${orders}</span><span><small>Total recibidas</small>${total}</span><span class="d-go">Ver ${ic('ext')}</span></span></a>
      <section class="card d-line rise" style="--i:2"><header><h2>Visitas por día</h2><span class="d-tag">14 días</span></header>
        <svg viewBox="0 0 ${W} ${H + 18}" role="img" aria-label="Visitas de los últimos 14 días, máximo ${series[peak].n} el ${series[peak].d}">
          <defs><linearGradient id="ar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--ac)" stop-opacity=".28"/><stop offset="1" stop-color="var(--ac)" stop-opacity="0"/></linearGradient></defs>
          ${[0.25, 0.5, 0.75].map((g) => `<line class="d-gl" x1="0" x2="${W}" y1="${(H * g).toFixed(0)}" y2="${(H * g).toFixed(0)}"/>`).join('')}
          <path class="d-area" d="${line} L${W},${H} L0,${H} Z" fill="url(#ar)"/><path class="d-path" d="${line}" pathLength="1"/>
          <circle class="d-peak" cx="${P[peak][0]}" cy="${P[peak][1]}" r="5"/>
          ${series.map((s, i) => (i % 3 === 1 || i === 13 ? `<text x="${P[i][0]}" y="${H + 15}">${s.d.slice(8)}/${s.d.slice(5, 7)}</text>` : '')).join('')}
        </svg></section>
      <section class="card d-bars rise" style="--i:3"><header><h2>Páginas más vistas</h2><span class="d-tag">30 días</span></header>
        ${top.length ? `<div class="d-cols">${top.map((t, i) => `<div class="d-col" style="--h:${Math.max(6, Math.round((t.n / tmax) * 100))};--i:${i}" title="${h(t.path)}: ${t.n}"><b>${t.n}</b><span></span><small>${h(t.path === '/' ? 'inicio' : t.path.slice(1).split('/')[0].slice(0, 10))}</small></div>`).join('')}</div>` : '<p class="a-empty">Sin visitas todavía.</p>'}
        <p class="d-note">Conteo anónimo por página: no identifica personas.</p></section>
      <section class="card d-donut rise" style="--i:4"><header><h2>Catálogo</h2></header>
        <a class="d-ring" href="/admin/products" style="--p:${pct}"><svg viewBox="0 0 100 100" aria-hidden="true"><circle class="d-rbg" cx="50" cy="50" r="40" pathLength="100"/><circle class="d-rfg" cx="50" cy="50" r="40" pathLength="100"/></svg>
          <span>${count(pub)}<small>de ${prods} publicados</small></span></a>
        <p class="d-legend"><i></i>Publicados <i class="off"></i>Ocultos</p></section>
    </div>
  </section>
  <aside class="d-side card rise" style="--i:2">
    <div class="d-me"><span class="ad-user big">${h(req.admin.username.slice(0, 1).toUpperCase())}</span><div><b>${h(req.admin.username)}</b><small>Administrador</small></div></div>
    <div class="d-kpi"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><path d="${line}" pathLength="1"/></svg>
      ${delta == null ? '' : `<span class="d-delta${delta < 0 ? ' neg' : ''}">${delta > 0 ? '+' : ''}${delta}%</span>`}<small>Visitas en 30 días</small>${count(v30)}</div>
    ${monthStar()}
    <h2>Últimas solicitudes</h2>
    ${leads.length ? `<ul class="d-feed">${leads.map((l, i) => `<li style="--i:${i}"><a href="/admin/leads/${l.id}"><span class="d-ico k-${h(l.kind)}">${ic(l.kind === 'pedido' ? 'box' : 'inbox')}</span><span><b>${h(l.name || l.email)}</b><small>${h(l.kind)} · ${h(l.created_at.slice(5, 16))}</small></span><span class="a-pill s-${h(l.status.replace(' ', '-'))}">${h(l.status)}</span></a></li>`).join('')}</ul>`
      : '<p class="d-empty">Aún no hay solicitudes. Llegarán aquí desde el formulario de contacto y el carrito.</p>'}
    <h2>Actividad del equipo</h2>
    <ul class="d-feed">${acts.map((a, i) => { const [icon, verb] = ACT[a.action] || ['pen', a.action]; return `<li style="--i:${i + 3}"><span class="d-ico t-${h(a.action)}">${ic(icon)}</span><span><b>${h(verb)} ${a.action === 'login' || a.action === 'password_set' ? '' : h(ENTN[a.entity] || a.entity || '')}</b><small>${h(a.admin)} · ${h(String(a.at).slice(5, 16))}</small></span></li>`; }).join('')}</ul>
  </aside>
</div>`));
});

// ---- Solicitudes y pedidos ----
r.get('/leads', (req, res) => {
  const { status = '', kind = '' } = req.query;
  const rows = all(`SELECT * FROM leads WHERE (? = '' OR status = ?) AND (? = '' OR kind = ?) ORDER BY id DESC LIMIT 500`, status, status, kind, kind);
  res.send(shell(req, 'Solicitudes', `<div class="a-head"><h1>Solicitudes y pedidos</h1><a class="a-btn ghost" href="/admin/leads.csv">Exportar CSV</a></div>
  <form class="a-filters"><select name="kind"><option value="">Todo tipo</option>${['contacto', 'cotizacion', 'pedido'].map((k) => `<option ${k === kind ? 'selected' : ''}>${k}</option>`).join('')}</select>
  <select name="status"><option value="">Todo estado</option>${LEAD_STATES.map((k) => `<option ${k === status ? 'selected' : ''}>${k}</option>`).join('')}</select><button class="a-btn ghost">Filtrar</button></form>
  ${rows.length ? `<div class="a-table-wrap"><table class="a-table"><thead><tr><th>N.°</th><th>Fecha</th><th>Tipo</th><th>Nombre</th><th>Teléfono</th><th>Tema / total</th><th>Estado</th></tr></thead><tbody>
  ${rows.map((l) => `<tr><td><a href="/admin/leads/${l.id}">${l.id}</a></td><td>${h(l.created_at.slice(0, 16))}</td><td>${h(l.kind)}</td><td><a href="/admin/leads/${l.id}">${h(l.name || l.email)}</a></td><td>${h(l.phone || '')}</td>
  <td>${l.kind === 'pedido' ? money(l.total_cents) : h(l.subject)}</td><td><span class="a-pill s-${h(l.status.replace(' ', '-'))}">${h(l.status)}</span></td></tr>`).join('')}</tbody></table></div>` : '<p class="a-empty">No hay solicitudes con ese filtro.</p>'}`));
});
r.get('/leads.csv', (req, res) => {
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = all('SELECT id, created_at, kind, status, name, phone, email, organization, subject, message, items, total_cents, delivery FROM leads ORDER BY id');
  audit(req.admin.username, 'export', 'leads', null, `${rows.length} filas`);
  res.type('text/csv').attachment('solicitudes.csv').send('﻿' + [Object.keys(rows[0] || { id: 0 }).join(','), ...rows.map((r) => Object.values(r).map(q).join(','))].join('\n'));
});
r.get('/leads/:id', (req, res, next) => {
  const l = get('SELECT * FROM leads WHERE id = ?', req.params.id); if (!l) return next();
  let items = []; try { items = JSON.parse(l.items || '[]'); } catch { /* */ }
  const phone = (l.phone || '').replace(/\D/g, ''); const waNum = phone.length === 9 ? '51' + phone : phone;
  res.send(shell(req, `Solicitud ${l.id}`, `<p><a href="/admin/leads">← Solicitudes</a></p><div class="a-head"><h1>${h(l.kind)} N.° ${l.id}</h1><span class="a-pill s-${h(l.status.replace(' ', '-'))}">${h(l.status)}</span></div>
  <div class="a-cols"><section class="a-card"><dl class="a-dl"><dt>Fecha</dt><dd>${h(l.created_at)} (UTC)</dd>${l.name ? `<dt>Nombre</dt><dd>${h(l.name)}</dd>` : ''}
  ${phone ? `<dt>Teléfono</dt><dd>${h(l.phone)} · <a href="https://wa.me/${h(waNum)}" target="_blank" rel="noopener">Abrir WhatsApp</a></dd>` : ''}
  ${l.email ? `<dt>Correo</dt><dd><a href="mailto:${h(l.email)}">${h(l.email)}</a></dd>` : ''}${l.organization ? `<dt>Entidad</dt><dd>${h(l.organization)}</dd>` : ''}
  ${l.subject ? `<dt>Tema</dt><dd>${h(l.subject)}</dd>` : ''}${l.delivery ? `<dt>Entrega</dt><dd>${h(l.delivery)}</dd>` : ''}<dt>Mensaje</dt><dd class="a-pre">${h(l.message)}</dd></dl>
  ${items.length ? `<table class="a-table"><thead><tr><th>Producto</th><th>Cant.</th><th>Subtotal</th></tr></thead><tbody>${items.map((i) => `<tr><td>${h(i.name)}</td><td>${i.qty}</td><td>${money(i.price == null ? null : i.price * i.qty)}</td></tr>`).join('')}
  <tr><td colspan="2"><b>Total referencial</b></td><td><b>${money(l.total_cents)}</b></td></tr></tbody></table>` : ''}</section>
  <form class="a-card" method="post" action="/admin/leads/${l.id}">${csrf(req)}<h2>Seguimiento</h2><label>Estado<select name="status">${LEAD_STATES.map((s) => `<option ${s === l.status ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
  <label>Notas internas<textarea name="notes" rows="5">${h(l.notes)}</textarea></label><button class="a-btn">Guardar</button></form></div>`));
});
r.post('/leads/:id', (req, res) => {
  const status = LEAD_STATES.includes(req.body.status) ? req.body.status : 'nuevo';
  run('UPDATE leads SET status = ?, notes = ? WHERE id = ?', status, String(req.body.notes || '').slice(0, 3000), req.params.id);
  audit(req.admin.username, 'update', 'leads', Number(req.params.id), status); res.redirect('/admin/leads/' + req.params.id);
});

// ---- Ajustes ----
r.get('/ajustes', (req, res) => {
  const s = settings();
  res.send(shell(req, 'Ajustes', `<h1>Ajustes del sitio</h1><form class="a-card a-form" method="post" action="/admin/ajustes">${csrf(req)}
  ${SETTINGS.map(([k, l]) => `<label>${h(l)}${k === 'owner_bio' ? `<textarea name="${k}" rows="4">${h(s[k])}</textarea>` : `<input name="${k}" value="${h(s[k])}">`}</label>`).join('')}
  <button class="a-btn">Guardar ajustes</button></form>`));
});
r.post('/ajustes', (req, res) => {
  for (const [k] of SETTINGS) run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', k, String(req.body[k] ?? '').trim().slice(0, 3000));
  audit(req.admin.username, 'update', 'settings', null); res.redirect('/admin/ajustes');
});
r.get('/auditoria', (req, res) => res.send(shell(req, 'Auditoría', `<h1>Registro de auditoría</h1><div class="a-table-wrap"><table class="a-table"><thead><tr><th>Fecha (UTC)</th><th>Usuario</th><th>Acción</th><th>Entidad</th><th>Detalle</th></tr></thead><tbody>
  ${all('SELECT * FROM audit ORDER BY id DESC LIMIT 300').map((a) => `<tr><td>${h(a.at)}</td><td>${h(a.admin)}</td><td>${h(a.action)}</td><td>${h(a.entity)} ${a.entity_id ?? ''}</td><td>${h(a.detail)}</td></tr>`).join('')}</tbody></table></div>`)));

// ---- CRUD genérico ----
r.get('/:ent', (req, res, next) => {
  const e = ENT[req.params.ent]; if (!e) return next();
  const rows = all(`SELECT * FROM ${req.params.ent} ORDER BY ${e.fields.some((f) => f.name === 'sort') ? 'sort, ' : ''}id`);
  const fmt = (c, v) => c === 'price_cents' ? money(v) : c === 'visible' ? (v ? 'Sí' : '<span class="a-muted">Oculto</span>') : h(v);
  res.send(shell(req, e.label, `<div class="a-head"><h1>${e.label}</h1>${e.noCreate ? '' : `<a class="a-btn" href="/admin/${req.params.ent}/nuevo">Agregar ${e.one}</a>`}</div>
  ${rows.length ? `<div class="a-table-wrap"><table class="a-table"><thead><tr>${rows[0].image !== undefined ? '<th></th>' : ''}${e.cols.map((c) => `<th>${h(e.fields.find((f) => f.name === c)?.label || c)}</th>`).join('')}</tr></thead><tbody>
  ${rows.map((row) => `<tr>${row.image !== undefined ? `<td>${row.image ? `<img class="a-thumb" src="${h(row.image)}" alt="">` : ''}</td>` : ''}${e.cols.map((c, i) => `<td>${i === 0 ? `<a href="/admin/${req.params.ent}/${row.id}">${fmt(c, row[c])}</a>` : fmt(c, row[c])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : `<p class="a-empty">Todavía no hay ${e.label.toLowerCase()}.</p>`}`));
});
function form(req, ent, row, err = '') {
  const e = ENT[ent]; const isNew = !row.id;
  const field = (f) => {
    const v = row[f.name]; const help = f.help ? `<small>${h(f.help)}</small>` : '';
    if (f.type === 'textarea') return `<label>${h(f.label)}<textarea name="${f.name}" rows="4">${h(v)}</textarea>${help}</label>`;
    if (f.type === 'select') return `<label>${h(f.label)}<select name="${f.name}">${f.options().map((o) => `<option value="${h(o.v)}" ${String(o.v) === String(v) ? 'selected' : ''}>${h(o.l)}</option>`).join('')}</select></label>`;
    if (f.type === 'bool') return `<label class="a-check"><input type="checkbox" name="${f.name}" value="1" ${v || isNew ? 'checked' : ''}> ${h(f.label)}</label>`;
    if (f.type === 'money') return `<label>${h(f.label)}<input name="${f.name}" inputmode="decimal" value="${v == null ? '' : (v / 100).toFixed(2)}">${help}</label>`;
    if (f.type === 'image') return `<div class="a-img"><span>${h(f.label)}</span>${v ? `<img src="${h(v)}" alt="">` : ''}<input type="hidden" name="${f.name}" value="${h(v)}">
      <label class="a-file">Subir nueva imagen (JPG, PNG o WebP, máx. 4 MB)<input type="file" name="${f.name}__file" accept="image/jpeg,image/png,image/webp"></label></div>`;
    return `<label>${h(f.label)}<input name="${f.name}" ${f.type === 'number' ? 'type="number"' : ''} ${f.req ? 'required' : ''} value="${h(v)}">${help}</label>`;
  };
  return shell(req, e.label, `<p><a href="/admin/${ent}">← ${e.label}</a></p><h1>${isNew ? `Nuevo ${e.one}` : h(row[e.title])}</h1>${err ? `<p class="a-err" role="alert">${h(err)}</p>` : ''}
  <form class="a-card a-form" method="post" enctype="multipart/form-data" action="/admin/${ent}/${isNew ? 'nuevo' : row.id}">${csrf(req)}${e.fields.map(field).join('')}
  <div class="a-actions"><button class="a-btn">Guardar</button>${!isNew && !e.noCreate ? `<button class="a-btn danger" name="_delete" value="1" data-confirm="¿Eliminar definitivamente este ${e.one}? Si solo quieres ocultarlo, desmarca Publicado.">Eliminar</button>` : ''}</div></form>`);
}
r.get('/:ent/:id', (req, res, next) => {
  const e = ENT[req.params.ent]; if (!e) return next();
  if (req.params.id === 'nuevo') return e.noCreate ? next() : res.send(form(req, req.params.ent, { visible: 1, sort: 0 }));
  const row = get(`SELECT * FROM ${req.params.ent} WHERE id = ?`, req.params.id); if (!row) return next();
  res.send(form(req, req.params.ent, row));
});
r.post('/:ent/:id', (req, res, next) => {
  const ent = req.params.ent; const e = ENT[ent]; if (!e) return next();
  const isNew = req.params.id === 'nuevo';
  if (!isNew && !get(`SELECT id FROM ${ent} WHERE id = ?`, req.params.id)) return next();
  if (req.body._delete === '1' && !isNew && !e.noCreate) {
    run(`DELETE FROM ${ent} WHERE id = ?`, req.params.id); audit(req.admin.username, 'delete', ent, Number(req.params.id));
    return res.redirect('/admin/' + ent);
  }
  const vals = {}; const files = Object.fromEntries((req.files || []).map((f) => [f.fieldname, f]));
  for (const f of e.fields) {
    let v = req.body[f.name];
    if (f.type === 'bool') v = v ? 1 : 0;
    else if (f.type === 'number') v = parseInt(v, 10) || 0;
    else if (f.type === 'money') v = v === '' || v == null ? null : Math.round(parseFloat(String(v).replace(',', '.')) * 100);
    else if (f.type === 'image') v = files[f.name + '__file'] ? '/uploads/' + files[f.name + '__file'].filename : String(v || '');
    else v = String(v ?? '').trim().slice(0, 5000);
    if (f.type === 'money' && v != null && !(v >= 0)) return res.status(400).send(form(req, ent, { ...req.body, id: isNew ? null : req.params.id }, 'Precio inválido.'));
    vals[f.name] = v;
  }
  if ('slug' in vals) vals.slug = slugify(vals.slug || vals[e.title]);
  if (e.fields.some((f) => f.req && !vals[f.name])) return res.status(400).send(form(req, ent, { ...vals, id: isNew ? null : req.params.id }, 'Completa los campos obligatorios.'));
  Object.assign(vals, e.fixed || {});
  const keys = Object.keys(vals);
  try {
    if (isNew) {
      const id = run(`INSERT INTO ${ent} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`, ...Object.values(vals)).lastInsertRowid;
      audit(req.admin.username, 'create', ent, Number(id), vals[e.title]);
    } else {
      run(`UPDATE ${ent} SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`, ...Object.values(vals), req.params.id);
      audit(req.admin.username, 'update', ent, Number(req.params.id), vals[e.title]);
    }
  } catch (err) {
    if (/UNIQUE/.test(err.message)) return res.status(400).send(form(req, ent, { ...vals, id: isNew ? null : req.params.id }, 'Ya existe un registro con esa URL (slug). Cámbiala.'));
    throw err;
  }
  res.redirect('/admin/' + ent);
});

export default r;
