import express from 'express';
import multer from 'multer';
import path from 'node:path';
import crypto from 'node:crypto';
import { all, get, run, settings, audit, DATA_DIR } from './db.js';
import { checkPassword, hashPassword, passwordProblem, createSession, destroySession, requireAdmin, limited, sha } from './auth.js';
import { h, money } from './views.js';

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
    { name: 'scope', label: 'Ámbitos (uno por línea)', type: 'textarea' }, { name: 'logo', label: 'Logo (fondo claro)', type: 'image' }, { name: 'logo_dark', label: 'Logo (fondo oscuro)', type: 'image' }] },
};
const SETTINGS = [
  ['phone_1', 'Teléfono principal (WhatsApp)'], ['phone_2', 'Teléfono secundario'], ['whatsapp', 'Número de WhatsApp con código de país (ej. 51943300006)'],
  ['email', 'Correo de contacto'], ['city', 'Ciudad'], ['facebook', 'Enlace de Facebook'],
  ['notify_webhook', 'Aviso de nuevas solicitudes: URL https de webhook (opcional)'],
  ['owner_name', 'Portafolio: nombre del profesional (vacío = no se muestra el perfil)'], ['owner_role', 'Portafolio: cargo'], ['owner_bio', 'Portafolio: trayectoria (un párrafo por línea)'],
  ['owner_photo', 'Portafolio: foto (ruta)'], ['review_banner', 'Mostrar aviso de versión de revisión (1 = sí, 0 = no)'],
];
const LEAD_STATES = ['nuevo', 'en proceso', 'cotizado', 'confirmado', 'entregado', 'cerrado', 'descartado'];

const shell = (req, title, body) => `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>${h(title)} · Admin Imagroup</title><link rel="stylesheet" href="/css/admin.css?v=2"></head><body>
${req.admin ? `<header class="a-top"><a href="/admin" class="a-brand">Imagroup · Admin</a><nav>
<a href="/admin/leads">Solicitudes</a>${Object.entries(ENT).map(([k, e]) => `<a href="/admin/${k}">${e.label}</a>`).join('')}<a href="/admin/ajustes">Ajustes</a><a href="/admin/auditoria">Auditoría</a>
<form method="post" action="/admin/logout"><input type="hidden" name="_csrf" value="${h(req.csrf)}"><button>Salir</button></form></nav></header>` : ''}
<main class="a-main">${body}</main><script src="/js/admin.js?v=2" defer></script></body></html>`;
const csrf = (req) => `<input type="hidden" name="_csrf" value="${h(req.csrf)}">`;
const slugify = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);

// ---- Acceso ----
r.get('/login', (req, res) => req.admin ? res.redirect('/admin') : res.send(shell(req, 'Ingresar', loginForm())));
const loginForm = (err = '') => `<form class="a-card a-login" method="post" action="/admin/login"><h1>Panel de administración</h1>
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
r.use(requireAdmin);
r.post('/logout', (req, res) => { destroySession(req, res); res.redirect('/admin/login'); });

// ---- Inicio del panel ----
r.get('/', (req, res) => {
  const c = (sql) => get(sql).n;
  const top = all(`SELECT path, SUM(count) AS n FROM pageviews WHERE day >= date('now','-30 days') GROUP BY path ORDER BY n DESC LIMIT 8`);
  const days = all(`SELECT day, SUM(count) AS n FROM pageviews WHERE day >= date('now','-13 days') GROUP BY day ORDER BY day`);
  const max = Math.max(1, ...days.map((d) => d.n));
  const leads = all('SELECT * FROM leads ORDER BY id DESC LIMIT 6');
  res.send(shell(req, 'Inicio', `<h1>Hola, ${h(req.admin.username)}</h1>
  <div class="a-stats"><a href="/admin/leads?status=nuevo"><b>${c(`SELECT COUNT(*) n FROM leads WHERE status='nuevo'`)}</b>solicitudes nuevas</a>
  <a href="/admin/leads?kind=pedido"><b>${c(`SELECT COUNT(*) n FROM leads WHERE kind='pedido'`)}</b>pedidos recibidos</a>
  <div><b>${c(`SELECT COALESCE(SUM(count),0) n FROM pageviews WHERE day >= date('now','-30 days')`)}</b>visitas en 30 días</div>
  <a href="/admin/products"><b>${c('SELECT COUNT(*) n FROM products WHERE visible=1')}</b>productos publicados</a></div>
  <div class="a-cols"><section class="a-card"><h2>Últimas solicitudes</h2>${leads.length ? `<ul class="a-list">${leads.map((l) => `<li><a href="/admin/leads/${l.id}"><b>${h(l.name)}</b> · ${h(l.kind)} · ${h(l.subject || '')}</a><span class="a-pill s-${h(l.status.replace(' ', '-'))}">${h(l.status)}</span></li>`).join('')}</ul>` : '<p class="a-empty">Aún no hay solicitudes. Aparecerán aquí cuando alguien use el formulario o el carrito.</p>'}</section>
  <section class="a-card"><h2>Visitas por día</h2><p class="a-help">Datos agregados y anónimos: no identifican personas. Solo se conoce a quien envía un formulario.</p>
  ${days.length ? `<div class="a-bars">${days.map((d) => `<span style="--h:${Math.round((d.n / max) * 100)}%" title="${d.day}: ${d.n}"><i>${d.n}</i></span>`).join('')}</div>
  <h3>Páginas más vistas (30 días)</h3><ol class="a-top-pages">${top.map((t) => `<li><span>${h(t.path)}</span><b>${t.n}</b></li>`).join('')}</ol>` : '<p class="a-empty">Sin visitas registradas todavía.</p>'}</section></div>`));
});

// ---- Solicitudes y pedidos ----
r.get('/leads', (req, res) => {
  const { status = '', kind = '' } = req.query;
  const rows = all(`SELECT * FROM leads WHERE (? = '' OR status = ?) AND (? = '' OR kind = ?) ORDER BY id DESC LIMIT 500`, status, status, kind, kind);
  res.send(shell(req, 'Solicitudes', `<div class="a-head"><h1>Solicitudes y pedidos</h1><a class="a-btn ghost" href="/admin/leads.csv">Exportar CSV</a></div>
  <form class="a-filters"><select name="kind"><option value="">Todo tipo</option>${['contacto', 'cotizacion', 'pedido'].map((k) => `<option ${k === kind ? 'selected' : ''}>${k}</option>`).join('')}</select>
  <select name="status"><option value="">Todo estado</option>${LEAD_STATES.map((k) => `<option ${k === status ? 'selected' : ''}>${k}</option>`).join('')}</select><button class="a-btn ghost">Filtrar</button></form>
  ${rows.length ? `<div class="a-table-wrap"><table class="a-table"><thead><tr><th>N.°</th><th>Fecha</th><th>Tipo</th><th>Nombre</th><th>Teléfono</th><th>Tema / total</th><th>Estado</th></tr></thead><tbody>
  ${rows.map((l) => `<tr><td><a href="/admin/leads/${l.id}">${l.id}</a></td><td>${h(l.created_at.slice(0, 16))}</td><td>${h(l.kind)}</td><td><a href="/admin/leads/${l.id}">${h(l.name)}</a></td><td>${h(l.phone)}</td>
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
  const phone = l.phone.replace(/\D/g, ''); const waNum = phone.length === 9 ? '51' + phone : phone;
  res.send(shell(req, `Solicitud ${l.id}`, `<p><a href="/admin/leads">← Solicitudes</a></p><div class="a-head"><h1>${h(l.kind)} N.° ${l.id}</h1><span class="a-pill s-${h(l.status.replace(' ', '-'))}">${h(l.status)}</span></div>
  <div class="a-cols"><section class="a-card"><dl class="a-dl"><dt>Fecha</dt><dd>${h(l.created_at)} (UTC)</dd><dt>Nombre</dt><dd>${h(l.name)}</dd>
  <dt>Teléfono</dt><dd>${h(l.phone)} · <a href="https://wa.me/${h(waNum)}" target="_blank" rel="noopener">Abrir WhatsApp</a></dd>
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
