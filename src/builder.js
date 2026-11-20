// Diseñador de páginas del panel: editar textos, imágenes y orden de bloques de cada página,
// crear páginas nuevas, ordenar el menú, vista previa en vivo, publicar y volver a versiones anteriores.
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import crypto from 'node:crypto';
import { all, get, run, settings, audit, DATA_DIR } from './db.js';
import { h, FOOT_1, FOOT_2, PAGE_ICONS } from './views.js';
import { BLOCKS, STYLE_FIELDS } from './blocks.js';
import { RESERVED, newId, cleanBlocks, saveDraft, publish, hasChanges, pagePath, blocksOf } from './pages.js';
import { renderPage, pageCtx } from './render.js';

const imgUpload = multer({
  storage: multer.diskStorage({ destination: path.join(DATA_DIR, 'uploads'), filename: (_q, f, cb) => cb(null, crypto.randomBytes(8).toString('hex') + ({ 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' })[f.mimetype]) }),
  limits: { fileSize: 6 * 1024 * 1024, files: 1 }, fileFilter: (_q, f, cb) => cb(null, /^image\/(jpeg|png|webp)$/.test(f.mimetype)),
});
const slugify = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
const TEMPLATES = {
  blank: () => [{ id: newId(), type: 'hero', data: { layout: 'none' } }],
  landing: () => ['hero', 'cards', 'stats', 'steps', 'cta', 'faq', 'form'].map((type) => ({ id: newId(), type, data: {} })),
  info: () => ['hero', 'media', 'text', 'gallery', 'whatsapp'].map((type) => ({ id: newId(), type, data: type === 'hero' ? { layout: 'back' } : {} })),
};
const ICON_NAMES = { home: 'Casa', tools: 'Edificio', bag: 'Bolsa', user: 'Persona', mail: 'Sobre', doc: 'Documento', star: 'Estrella', image: 'Imagen', info: 'Información', leaf: 'Hoja', shield: 'Escudo' };
const SITE = [['foot_1', 'Pie de página · columna 1', FOOT_1], ['foot_2', 'Pie de página · columna 2', FOOT_2], ['foot_3_title', 'Pie de página · título de la columna de contacto', 'Contacto'], ['wa_float', 'Mensaje del botón flotante de WhatsApp', 'Hola, vengo de la web de Imagroup.']];

export function mountBuilder(r) {
  // Subida de imágenes (multipart): se procesa antes de exigir el token, que llega en la cabecera.
  r.post('/paginas/subir', (req, res, next) => (req.admin && req.get('x-csrf') === req.csrf ? imgUpload.single('file')(req, res, next) : res.status(403).json({ ok: false })), (req, res) => {
    if (!req.file) return res.status(400).json({ ok: false, message: 'Sube una imagen JPG, PNG o WebP de hasta 6 MB.' });
    audit(req.admin.username, 'upload', 'pages', null, req.file.filename);
    res.json({ ok: true, url: '/uploads/' + req.file.filename });
  });
}

export function mountBuilderAdmin(r, { shell, csrf, ic }) {
  const page = (id) => get('SELECT * FROM pages WHERE id = ?', id);
  const json = (res, o, code = 200) => res.status(code).json(o);

  // ---------- Lista de páginas, menú y pie ----------
  r.get('/paginas', (req, res) => {
    const pages = all("SELECT * FROM pages ORDER BY system IS NULL, system = 'carrito', nav_sort, id"), s = settings();
    const menu = all('SELECT * FROM pages WHERE system IS NOT NULL OR published IS NOT NULL ORDER BY in_nav DESC, nav_sort, id').filter((p) => p.system !== 'inicio' && p.system !== 'carrito');
    const card = (p, i) => { const n = blocksOf(p, 'draft').length, live = p.system || p.published; return `<article class="pg-card" style="--i:${i}">
      <a class="pg-thumb" href="/admin/paginas/${p.id}"><span class="pg-ico"><svg viewBox="0 0 24 24">${PAGE_ICONS[p.icon] || PAGE_ICONS.doc}</svg></span><i></i><i></i><i></i></a>
      <div class="pg-tx"><h3>${h(p.nav_label || p.title)}</h3><p class="pg-url">${h(pagePath(p))}</p>
      <p class="pg-meta"><span class="pg-st ${!live ? 'off' : hasChanges(p) ? 'warn' : 'ok'}">${!live ? 'Sin publicar' : hasChanges(p) ? 'Cambios sin publicar' : 'Publicada'}</span> · ${n} bloque${n === 1 ? '' : 's'}${p.system ? '' : ' · página nueva'}</p></div>
      <div class="pg-act"><a class="a-btn sm" href="/admin/paginas/${p.id}">${ic('pen')}Diseñar</a>${live ? `<a class="a-btn sm ghost" href="${h(pagePath(p))}" target="_blank" rel="noopener">${ic('ext')}Ver</a>` : ''}</div></article>`; };
    res.send(shell(req, 'Diseño web', `<div class="pg">
  <header class="pg-hero"><div><p class="pg-eye">Diseño web</p><h1>Diseña tu sitio sin tocar código</h1>
  <p>Cambia textos, fotos, colores y el orden de cada sección. Los cambios se guardan como borrador y solo los ven tus visitantes cuando pulsas <b>Publicar</b>.</p></div>
  <div class="pg-hero-art" aria-hidden="true"><i></i><i></i><i></i><b></b></div></header>
  <section><div class="pg-sec-h"><h2>Páginas</h2><button class="a-btn" type="button" data-open="#pg-new">${ic('plus')}Nueva página</button></div>
  <div class="pg-grid">${pages.map(card).join('')}</div></section>
  <dialog id="pg-new" class="pg-dialog"><form method="post" action="/admin/paginas/nueva">${csrf(req)}<h2>Nueva página</h2>
    <label>Nombre de la página<input name="title" required maxlength="80" placeholder="Ejemplo: Nosotros" data-slug-src></label>
    <label>Dirección<span class="pg-slug">imagroup.raser.pe/<input name="slug" maxlength="60" pattern="[a-z0-9-]+" placeholder="nosotros" data-slug></span></label>
    <fieldset class="pg-tpl"><legend>Empezar con</legend>
      ${[['blank', 'En blanco', 'Solo un título para empezar desde cero.'], ['landing', 'Página de ventas', 'Portada, tarjetas, cifras, pasos, llamado, preguntas y formulario.'], ['info', 'Página informativa', 'Portada con foto de fondo, imagen y texto, galería y WhatsApp.']]
        .map(([v, l, d], i) => `<label><input type="radio" name="template" value="${v}" ${i ? '' : 'checked'}><b>${l}</b><small>${d}</small></label>`).join('')}
      ${pages.length ? `<label><input type="radio" name="template" value="copy"><b>Copia de otra página</b><select name="copy">${pages.map((p) => `<option value="${p.id}">${h(p.nav_label || p.title)}</option>`).join('')}</select></label>` : ''}</fieldset>
    <div class="pg-dlg-act"><button class="a-btn ghost" type="button" data-close>Cancelar</button><button class="a-btn">Crear y diseñar</button></div></form></dialog>

  <section class="pg-two"><div class="a-card"><h2>Menú del sitio</h2><p class="a-help">Arrastra para cambiar el orden. Las tres primeras también aparecen en la barra inferior del celular.</p>
    <ol class="pg-menu" data-menu>${menu.map((p) => `<li data-id="${p.id}"><span class="pg-grip" aria-hidden="true">⋮⋮</span><svg viewBox="0 0 24 24" aria-hidden="true">${PAGE_ICONS[p.icon] || PAGE_ICONS.doc}</svg><b>${h(p.nav_label || p.title)}</b>
      <label class="pg-sw"><input type="checkbox" ${p.in_nav ? 'checked' : ''} aria-label="Mostrar ${h(p.nav_label || p.title)} en el menú"><span></span></label>
      <span class="pg-mv"><button type="button" data-mv="-1" aria-label="Subir">↑</button><button type="button" data-mv="1" aria-label="Bajar">↓</button></span></li>`).join('')}</ol>
    <p class="pg-saved" data-menu-msg role="status"></p></div>
  <form class="a-card a-form" method="post" action="/admin/paginas/sitio">${csrf(req)}<h2>Pie de página y WhatsApp</h2>
    <p class="a-help">Usa **negrita** y [texto](/direccion) para enlaces. La columna de contacto toma el teléfono y el correo de Ajustes.</p>
    ${SITE.map(([k, l, d]) => `<label>${l}${k.startsWith('foot_') && k !== 'foot_3_title' ? `<textarea name="${k}" rows="3">${h(s[k] ?? d)}</textarea>` : `<input name="${k}" value="${h(s[k] ?? d)}">`}</label>`).join('')}
    <button class="a-btn">Guardar</button></form></section></div>`));
  });

  r.post('/paginas/sitio', (req, res) => {
    for (const [k] of SITE) run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', k, String(req.body[k] ?? '').slice(0, 600));
    audit(req.admin.username, 'update', 'settings', null, 'pie de página');
    res.redirect('/admin/paginas');
  });

  r.post('/paginas/menu', (req, res) => {
    const list = Array.isArray(req.body.items) ? req.body.items.slice(0, 40) : [];
    list.forEach((it, i) => run('UPDATE pages SET nav_sort = ?, in_nav = ? WHERE id = ?', i + 1, it.on ? 1 : 0, +it.id));
    audit(req.admin.username, 'update', 'pages', null, 'menú');
    json(res, { ok: true });
  });

  r.post('/paginas/nueva', (req, res) => {
    const title = String(req.body.title || '').trim().slice(0, 80) || 'Página nueva';
    let slug = slugify(req.body.slug || title) || 'pagina';
    if (RESERVED.test(slug)) slug += '-1';
    while (get('SELECT 1 FROM pages WHERE slug = ?', slug)) slug = slug.replace(/(-\d+)?$/, (m) => '-' + ((parseInt(m.slice(1), 10) || 1) + 1));
    let blocks = (TEMPLATES[req.body.template] || TEMPLATES.blank)();
    if (req.body.template === 'copy') { const src = page(+req.body.copy); if (src) blocks = blocksOf(src, 'draft').map((b) => ({ ...b, id: newId() })); }
    if (req.body.template === 'blank') blocks[0].data = { layout: 'none', title, eyebrow: '', text: '', btn1_label: '' };
    const max = get('SELECT COALESCE(MAX(nav_sort), 0) m FROM pages').m;
    const id = run(`INSERT INTO pages (slug, title, nav_label, in_nav, nav_sort, icon, draft) VALUES (?,?,?,0,?,?,?)`, slug, title, title, max + 1, 'doc', JSON.stringify(cleanBlocks(blocks))).lastInsertRowid;
    audit(req.admin.username, 'create', 'pages', id, title);
    res.redirect('/admin/paginas/' + id);
  });

  // ---------- Imágenes disponibles ----------
  r.get('/paginas/imagenes', (req, res) => {
    const list = (dir, url, skip = /-sm\.webp$/) => { try { return fs.readdirSync(dir).filter((f) => /\.(webp|png|jpe?g)$/i.test(f) && !skip.test(f)).map((f) => url + f); } catch { return []; } };
    const uploads = (() => { try { return fs.readdirSync(path.join(DATA_DIR, 'uploads')).filter((f) => /\.(webp|png|jpe?g)$/i.test(f)).map((f) => ({ f, t: fs.statSync(path.join(DATA_DIR, 'uploads', f)).mtimeMs })).sort((a, b) => b.t - a.t).map((x) => '/uploads/' + x.f); } catch { return []; } })();
    json(res, { groups: [['Subidas por ti', uploads], ['Fotos de obra', list('public/img/f', '/img/f/')], ['Productos', list('public/img/p/c', '/img/p/c/')], ['Logos y marca', list('public/img/brand', '/img/brand/', /\.png$|-sm\.webp$/)]] });
  });

  // ---------- Editor ----------
  r.get('/paginas/:id', (req, res, next) => {
    const p = page(+req.params.id); if (!p) return next();
    const ctx = pageCtx(req), types = {};
    for (const [k, B] of Object.entries(BLOCKS)) {
      types[k] = { label: B.label, group: B.group, icon: B.icon, desc: B.desc, fields: B.fields, defaults: B.defaults(ctx) };
    }
    const data = { page: { id: p.id, title: p.title, slug: p.slug, system: p.system, description: p.description, nav_label: p.nav_label, in_nav: !!p.in_nav, icon: p.icon, path: pagePath(p), live: !!(p.system || p.published), changed: hasChanges(p) },
      blocks: blocksOf(p, 'draft'), types, style: STYLE_FIELDS, csrf: req.csrf, icons: Object.fromEntries(Object.entries(ICON_NAMES).map(([k, l]) => [k, [l, PAGE_ICONS[k]]])),
      options: { categories: [['', 'Todas'], ...ctx.categories.map((c) => [c.slug, c.name])], products: [['', 'Elige un producto'], ...ctx.products.map((x) => [x.slug, x.name])] },
      links: all('SELECT * FROM pages').map((x) => [pagePath(x), x.nav_label || x.title]).concat(ctx.services.map((v) => ['/servicios/' + v.slug, 'Servicio: ' + v.title]), ctx.products.map((x) => ['/tienda/' + x.slug, 'Producto: ' + x.name])) };
    res.send(editorHtml(req, p, data));
  });

  r.get('/paginas/:id/vista', (req, res, next) => {
    const p = page(+req.params.id); if (!p) return next();
    res.set({ 'X-Frame-Options': 'SAMEORIGIN', 'Content-Security-Policy': res.get('Content-Security-Policy').replace("frame-ancestors 'none'", "frame-ancestors 'self'"), 'Cache-Control': 'no-store' });
    res.send(renderPage(req, p, 'draft', '<link rel="stylesheet" href="/css/preview.css?v=1"><script src="/js/preview.js?v=1"></script>'));
  });

  r.post('/paginas/:id/borrador', (req, res) => {
    const p = page(+req.params.id); if (!p) return json(res, { ok: false }, 404);
    saveDraft(p.id, req.body.blocks);
    json(res, { ok: true, changed: hasChanges(page(p.id)) });
  });
  r.post('/paginas/:id/publicar', (req, res) => {
    const p = page(+req.params.id); if (!p) return json(res, { ok: false }, 404);
    publish(p.id, req.admin.username); audit(req.admin.username, 'publish', 'pages', p.id, p.title);
    json(res, { ok: true });
  });
  r.post('/paginas/:id/descartar', (req, res) => {
    const p = page(+req.params.id); if (!p || !p.published) return json(res, { ok: false, message: 'Esta página aún no se publicó.' }, 400);
    run('UPDATE pages SET draft = published WHERE id = ?', p.id);
    json(res, { ok: true, blocks: blocksOf(page(p.id), 'draft') });
  });
  r.get('/paginas/:id/historial', (req, res) => json(res, { versions: all('SELECT id, admin, created_at, length(blocks) size FROM page_versions WHERE page_id = ? ORDER BY id DESC', +req.params.id) }));
  r.post('/paginas/:id/restaurar/:vid', (req, res) => {
    const v = get('SELECT * FROM page_versions WHERE id = ? AND page_id = ?', +req.params.vid, +req.params.id); if (!v) return json(res, { ok: false }, 404);
    run(`UPDATE pages SET draft = ?, updated_at = datetime('now') WHERE id = ?`, v.blocks, v.page_id);
    audit(req.admin.username, 'restore', 'pages', v.page_id, 'versión ' + v.id);
    json(res, { ok: true, blocks: blocksOf(page(v.page_id), 'draft') });
  });
  r.post('/paginas/:id/datos', (req, res) => {
    const p = page(+req.params.id); if (!p) return json(res, { ok: false }, 404);
    const b = req.body, title = String(b.title || '').trim().slice(0, 120) || p.title;
    let slug = p.slug;
    if (!p.system && b.slug !== undefined) {
      slug = slugify(b.slug);
      if (!slug || RESERVED.test(slug)) return json(res, { ok: false, message: 'Esa dirección no está disponible. Usa otra.' }, 400);
      if (get('SELECT 1 FROM pages WHERE slug = ? AND id != ?', slug, p.id)) return json(res, { ok: false, message: 'Ya hay otra página con esa dirección.' }, 400);
    }
    run('UPDATE pages SET title = ?, slug = ?, description = ?, nav_label = ?, in_nav = ?, icon = ? WHERE id = ?', title, slug, String(b.description || '').slice(0, 300),
      String(b.nav_label || '').trim().slice(0, 40) || title, b.in_nav && p.system !== 'carrito' ? 1 : 0, PAGE_ICONS[b.icon] ? b.icon : 'doc', p.id);
    audit(req.admin.username, 'update', 'pages', p.id, title);
    json(res, { ok: true, path: pagePath(page(p.id)) });
  });
  r.post('/paginas/:id/duplicar', (req, res) => {
    const p = page(+req.params.id); if (!p) return res.redirect('/admin/paginas');
    let slug = slugify((p.system ? p.system : p.slug) + '-copia'); while (get('SELECT 1 FROM pages WHERE slug = ?', slug)) slug += '-2';
    const id = run('INSERT INTO pages (slug, title, nav_label, in_nav, icon, draft) VALUES (?,?,?,0,?,?)', slug, p.title + ' (copia)', (p.nav_label || p.title) + ' (copia)', p.icon,
      JSON.stringify(blocksOf(p, 'draft').map((x) => ({ ...x, id: newId() })))).lastInsertRowid;
    audit(req.admin.username, 'create', 'pages', id, 'copia de ' + p.title);
    res.redirect('/admin/paginas/' + id);
  });
  r.post('/paginas/:id/eliminar', (req, res) => {
    const p = page(+req.params.id);
    if (p && !p.system) { run('DELETE FROM pages WHERE id = ?', p.id); audit(req.admin.username, 'delete', 'pages', p.id, p.title); }
    res.redirect('/admin/paginas');
  });

  function editorHtml(req, p, data) {
    const I = (n) => `<svg viewBox="0 0 24 24" aria-hidden="true">${{
      back: '<path d="M19 12H5M11 6l-6 6 6 6"/>', desk: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>', tab: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M11 18h2"/>',
      phone: '<rect x="7" y="3" width="10" height="18" rx="2"/><path d="M11 18h2"/>', undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>', redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>',
      sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>', moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/>',
      clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', ext: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>', eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
      rocket: '<path d="M5 15c-1.5 1.5-2 5-2 5s3.5-.5 5-2M9 15l-3-3c1-4 4-8 12-9-1 8-5 11-9 12Z"/><circle cx="15" cy="9" r="1.6"/>',
    }[n]}</svg>`;
    return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="robots" content="noindex">
<title>Diseñar: ${h(p.nav_label || p.title)} · Admin Imagroup</title><link rel="icon" href="/img/brand/imagroup.webp">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@75..100,400..800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/css/admin.css?v=4"><link rel="stylesheet" href="/css/builder.css?v=3"><script src="/js/theme.js?v=7"></script><script src="/js/builder.js?v=2" defer></script></head>
<body class="bd-body"><div class="bd" data-builder data-view="panel">
<header class="bd-top">
  <a class="bd-ic" href="/admin/paginas" aria-label="Volver a las páginas">${I('back')}</a>
  <div class="bd-name"><b data-page-name>${h(p.nav_label || p.title)}</b><span class="bd-status" data-status>Borrador guardado</span></div>
  <div class="bd-dev" role="group" aria-label="Tamaño de la vista previa"><button type="button" data-dev="desk" aria-pressed="true" aria-label="Computadora">${I('desk')}</button><button type="button" data-dev="tab" aria-pressed="false" aria-label="Tableta">${I('tab')}</button><button type="button" data-dev="phone" aria-pressed="false" aria-label="Celular">${I('phone')}</button></div>
  <div class="bd-tools">
    <button class="bd-ic" type="button" data-undo aria-label="Deshacer" title="Deshacer (Ctrl+Z)" disabled>${I('undo')}</button><button class="bd-ic" type="button" data-redo aria-label="Rehacer" title="Rehacer (Ctrl+Y)" disabled>${I('redo')}</button>
    <button class="bd-ic bd-th" type="button" data-pv-theme aria-label="Ver en modo oscuro" title="Ver en modo oscuro o claro">${I('moon')}${I('sun')}</button>
    <button class="bd-ic" type="button" data-history aria-label="Historial de versiones" title="Historial">${I('clock')}</button>
    <a class="bd-ic" href="${h(pagePath(p))}" target="_blank" rel="noopener" aria-label="Ver la página publicada" title="Ver la página publicada" data-live-link ${data.page.live ? '' : 'hidden'}>${I('ext')}</a>
    <button class="bd-ic bd-only-m" type="button" data-toggle-view aria-label="Ver vista previa">${I('eye')}</button>
    <button class="bd-pub" type="button" data-publish>${I('rocket')}<span>Publicar</span></button></div>
</header>
<aside class="bd-panel">
  <div class="bd-tabs" role="tablist"><button type="button" role="tab" aria-selected="true" data-tab="blocks">Bloques</button><button type="button" role="tab" aria-selected="false" data-tab="page">Página</button></div>
  <div class="bd-pane" data-pane="blocks"><ol class="bd-list" data-list></ol><button class="bd-add" type="button" data-add-at="end"><span>+</span>Agregar bloque</button>
    <p class="bd-tip">Toca una sección en la vista previa para editarla. Arrastra <b>⋮⋮</b> para moverla.</p></div>
  <div class="bd-pane" data-pane="page" hidden><form class="bd-form" data-meta></form></div>
</aside>
<main class="bd-stage" data-stage><div class="bd-frame" data-frame><iframe title="Vista previa" data-pv></iframe><iframe title="" data-pv hidden aria-hidden="true" tabindex="-1"></iframe><div class="bd-loading" data-loading><i></i></div></div></main>
</div>
<dialog class="bd-dlg bd-pal" data-palette><header><h2>Agregar bloque</h2><input type="search" placeholder="Buscar bloque…" data-pal-q aria-label="Buscar bloque"><button class="bd-x" type="button" data-close aria-label="Cerrar">×</button></header><div data-pal-list></div></dialog>
<dialog class="bd-dlg bd-imgs" data-images><header><h2>Elegir imagen</h2><button class="bd-x" type="button" data-close aria-label="Cerrar">×</button></header>
  <div class="bd-up"><label class="bd-drop" data-drop><input type="file" accept="image/jpeg,image/png,image/webp" data-file hidden><b>Subir una imagen</b><small>Arrastra aquí o toca para elegir · JPG, PNG o WebP hasta 6 MB</small><span class="bd-bar" data-bar></span></label>
  <label class="bd-url">O pega una dirección<input type="text" placeholder="/img/f/agua-1.webp o https://…" data-img-url><button type="button" class="a-btn sm" data-img-use>Usar</button></label></div>
  <div class="bd-gal" data-gal><p>Cargando imágenes…</p></div></dialog>
<dialog class="bd-dlg bd-hist" data-hist><header><h2>Historial de publicaciones</h2><button class="bd-x" type="button" data-close aria-label="Cerrar">×</button></header><div data-hist-list></div>
  <footer><button type="button" class="a-btn ghost sm" data-discard>Descartar los cambios sin publicar</button></footer></dialog>
<form method="post" action="/admin/paginas/${p.id}/duplicar" data-dup hidden>${csrf(req)}</form>
${p.system ? '' : `<form method="post" action="/admin/paginas/${p.id}/eliminar" data-del hidden>${csrf(req)}</form>`}
<script type="application/json" id="bd-data">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>
</body></html>`;
  }
}
