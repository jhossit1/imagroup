// Módulo privado de trabajadores: solo el administrador crea fichas, evalúa, aprueba reconocimientos y emite certificados.
import crypto from 'node:crypto';
import { all, get, run, audit, settings } from './db.js';
import { h, money } from './views.js';
import { CRITERIA, LEVELS, levelOf, evaluate, isTrusted, TRUST_RULE, periodName, rating, N_CRIT } from './method.js';
import { certificatePdf, certImages } from './cert.js';
import { badgePdf, badgeImages } from './badge.js';
import { loadImages } from './files.js';
import { teamPath } from './team.js';
import { reviewsCard, mountReviewsAdmin, pendingReviews, clientScore } from './reviews.js';
import QRCode from 'qrcode';

const thisPeriod = () => new Date(Date.now() - 5 * 36e5).toISOString().slice(0, 7);
const STATUS = ['activo', 'disponible', 'inactivo'];
const HUES = ['#1a5f99', '#3d8a37', '#c9a24a', '#c2467a', '#2f86cc'];
const initials = (n) => String(n).trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
const avatar = (w, big = '') => (w.photo ? `<img class="w-av${big}" src="${h(w.photo)}" alt="" style="--hue:${HUES[w.id % HUES.length]}">` : `<span class="w-av${big}" style="--hue:${HUES[w.id % HUES.length]}">${h(initials(w.name))}</span>`);
const qrSvg = (t) => { const q = QRCode.create(t, { errorCorrectionLevel: 'M' }), n = q.modules.size; let d = ''; for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (q.modules.data[y * n + x]) d += `M${x} ${y}h1v1h-1z`; return `<svg viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges" aria-hidden="true"><path d="${d}"/></svg>`; };
const today = () => new Date(Date.now() - 5 * 36e5).toISOString().slice(0, 10);
const dmy = (iso) => String(iso).slice(0, 10).split('-').reverse().join('/');
const baseUrl = (req) => `${req.get('x-forwarded-proto') === 'https' ? 'https' : req.protocol}://${req.get('host')}`;
const ring = (score, lv, size = '') => `<span class="w-ring${size}" style="--p:${score || 0};--lc:${levelOf(lv).c}"><svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="16" pathLength="100"/><circle cx="20" cy="20" r="16" pathLength="100"/></svg><b>${score == null ? '—' : Math.round(score)}</b></span>`;
const chip = (lv) => { const l = levelOf(lv); return `<span class="w-lv lv-${l.k}">${h(l.t)}</span>`; };
const num = (v) => String(v).replace('.', ',');
export const stars = (v, c = '#c9a24a', i = 0) => `<span class="w-stars" role="img" aria-label="${v ? num(v) + ' de 5' : 'Sin calificar'}" style="--f:${(v || 0) * 20}%;--sc:${c};--i:${i}"></span>`;
// Datos que lleva impresos el carné: si cambian, el panel avisa que conviene reimprimirlo.
const PRINT = { name: 'nombre', trade: 'oficio', zone: 'zona', photo: 'foto', rt: 'calificación', trusted: 'reconocimiento de confianza' };
const printSig = (w, rt, trusted) => JSON.stringify({ name: w.name, trade: w.trade || '', zone: w.zone || '', photo: w.photo || '', rt: (rt || []).map((r) => r.v), trusted: !!trusted });
const changed = (a, b) => { try { const x = JSON.parse(a), y = JSON.parse(b); return Object.keys(PRINT).filter((k) => JSON.stringify(x[k]) !== JSON.stringify(y[k])).map((k) => PRINT[k]); } catch { return []; } };
const listEs = (a) => (a.length > 1 ? a.slice(0, -1).join(', ') + ' y ' + a.at(-1) : a[0] || '');
// Carné en pantalla: el mismo diseño se usa en la ficha y, en vivo, mientras se llena el formulario.
const cardHtml = (req, w, co, active, trusted, rt) => `<div class="bc-wrap"><button type="button" class="bc" data-flip aria-label="Girar el carné para ver el reverso">
  <span class="bc-face bc-front"><span class="bc-head"><img src="${h(co.logo || '/img/brand/imagroup.webp')}" alt=""><span><b data-out="company">${h(co.name || '')}</b><small>Carné de identificación</small></span></span>
    <span class="bc-photo" data-out-photo>${w.photo ? `<img src="${h(w.photo)}" alt="">` : `<span style="--hue:${HUES[(w.id || 0) % HUES.length]}" data-out="initials">${h(initials(w.name || '?'))}</span>`}</span>
    ${trusted ? '<span class="bc-trust">Trabajador de confianza</span>' : ''}
    <b class="bc-name" data-out="name">${h(w.name || 'Nombre del trabajador')}</b><span class="bc-trade" data-out="trade">${h(w.trade || '')}</span><small class="bc-zone" data-out="zone">${h(w.zone || '')}</small>
    ${rt ? `<span class="bc-rate">${rt.map((r, i) => `<span><small>${h(r.t)}</small>${stars(r.v, '#c9a24a', i)}</span>`).join('')}</span>` : '<span class="bc-rate bc-norate">Calificación al evaluar su primer mes</span>'}
    <span class="bc-foot"><span><small>N.° de carné</small>${active ? h(active.code) : '—'}<small>Válido hasta</small>${active ? dmy(active.expires) : '—'}</span><span class="bc-qr">${active ? qrSvg(`${baseUrl(req)}/verificar/${active.code}`) : ''}</span></span></span>
  <span class="bc-face bc-back"><span class="bc-stripe"></span><b>Verifique este carné</b><span class="bc-bigqr">${active ? qrSvg(`${baseUrl(req)}/verificar/${active.code}`) : '<em>El QR se crea al generar el carné</em>'}</span>
    <small>Escanee el código con la cámara del celular para comprobar que este carné es válido y que la persona trabaja con nosotros.</small><span class="bc-sign">${h(co.signer_name || co.signer_role || 'Gerencia General')}</span></span>
</button><p class="a-help bc-tip">Toca el carné para girarlo.</p></div>`;
const trustBadge = '<span class="w-trust" title="' + h(TRUST_RULE) + '">★ De confianza</span>';

export function monthStar() {
  const e = get(`SELECT e.*, w.name, w.id AS wid, w.trade FROM evaluations e JOIN workers w ON w.id = e.worker_id WHERE e.status = 'aprobado' ORDER BY e.period DESC, e.score DESC LIMIT 1`);
  if (!e) return '';
  return `<a class="d-star" href="/admin/trabajadores/${e.wid}"><span class="d-star-k">Trabajador destacado · ${h(periodName(e.period))}</span>
    <span class="d-star-b">${avatar({ id: e.wid, name: e.name })}<span><b>${h(e.name)}</b><small>${h(e.trade || '')}</small></span>${ring(e.score, e.level)}</span></a>`;
}

export function mountWorkers(r, { shell, ic, csrf }) {
  mountReviewsAdmin(r);
  const load = (id) => get('SELECT * FROM workers WHERE id = ?', id);

  // ---- Lista del equipo ----
  r.get('/trabajadores', (req, res) => {
    const q = String(req.query.q || '').trim(), st = STATUS.includes(req.query.st) ? req.query.st : '';
    const per = get(`SELECT MAX(period) p FROM evaluations WHERE status = 'aprobado'`).p;
    const ws = all(`SELECT w.*, (SELECT score FROM evaluations e WHERE e.worker_id = w.id ORDER BY period DESC LIMIT 1) AS score,
      (SELECT level FROM evaluations e WHERE e.worker_id = w.id ORDER BY period DESC LIMIT 1) AS level
      FROM workers w WHERE (? = '' OR w.name LIKE ? OR w.trade LIKE ? OR w.zone LIKE ?) AND (? = '' OR w.status = ?) ORDER BY w.status = 'inactivo', w.name`,
    q, `%${q}%`, `%${q}%`, `%${q}%`, st, st);
    const evs = all(`SELECT worker_id, period, score, status FROM evaluations`);
    const trusted = new Set(ws.filter((w) => isTrusted(evs.filter((e) => e.worker_id === w.id))).map((w) => w.id));
    const cur = thisPeriod();
    const k = {
      act: get(`SELECT COUNT(*) n FROM workers WHERE status <> 'inactivo'`).n,
      ev: get(`SELECT COUNT(*) n FROM evaluations WHERE period = ?`, cur).n,
      avg: get(`SELECT ROUND(AVG(score)) n FROM evaluations WHERE period = ?`, cur).n,
      bono: get(`SELECT COALESCE(SUM(bonus_cents),0) n FROM evaluations WHERE period = ? AND status = 'aprobado'`, cur).n,
    };
    const podium = per ? all(`SELECT e.score, e.level, w.id, w.name, w.trade, w.photo FROM evaluations e JOIN workers w ON w.id = e.worker_id WHERE e.period = ? AND e.status = 'aprobado' ORDER BY e.score DESC LIMIT 3`, per) : [];
    const order = [podium[1], podium[0], podium[2]];
    res.send(shell(req, 'Trabajadores', `<div class="a-head w-top"><div><p class="d-eye">Equipo de obra · ${h(periodName(cur))}</p><h1 class="grad">Trabajadores</h1></div>
    <div class="w-acts"><a class="a-btn ghost" href="/admin/trabajadores/metodologia">${ic('shield')}Metodología</a><a class="a-btn" href="/admin/trabajadores/nuevo">${ic('plus')}Agregar trabajador</a></div></div>
    <div class="w-kpis">${[['users', k.act, 'activos y disponibles', 'c1'], ['pen', k.ev, 'evaluados este mes', 'c2'], ['star', k.avg ?? '—', 'puntaje promedio del mes', 'c3'], ['coin', money(k.bono), 'en bonos aprobados', 'c4']]
      .map(([i, v, l, c], n) => `<div class="w-kpi ${c} rise" style="--i:${n}"><span class="w-kpi-i">${ic(i)}</span><b ${typeof v === 'number' ? `data-count="${v}"` : ''}>${v}</b><small>${l}</small></div>`).join('')}</div>
    ${podium.length ? `<section class="card w-podium rise" style="--i:2"><header><h2>Podio de ${h(periodName(per))}</h2><span class="d-tag">evaluaciones aprobadas</span></header><div class="w-steps">
      ${order.map((p, i) => (p ? `<a class="w-step s${[2, 1, 3][i]}" href="/admin/trabajadores/${p.id}" style="--i:${[1, 0, 2][i]}">${avatar(p, ' big')}<b>${h(p.name.split(' ').slice(0, 2).join(' '))}</b><small>${h(p.trade || '')}</small>${chip(p.level)}<span class="w-block"><em>${[2, 1, 3][i]}</em>${Math.round(p.score)} pts</span></a>` : '<span class="w-step empty"></span>')).join('')}</div></section>` : ''}
    ${pendingReviews().map((p) => `<a class="w-op-alert rise" href="/admin/trabajadores/${p.worker_id}#opiniones">${ic('star')}<span><b>${p.n === 1 ? 'Una opinión de cliente' : p.n + ' opiniones de clientes'} por revisar</b><small>${h(p.name)}: revísala y publícala o déjala oculta.</small></span></a>`).join('')}
    <form class="a-filters w-search"><label class="w-q"><span class="sr">Buscar</span><input name="q" value="${h(q)}" placeholder="Buscar por nombre, oficio o zona" type="search"></label>
    <select name="st" aria-label="Estado"><option value="">Todos los estados</option>${STATUS.map((s) => `<option ${s === st ? 'selected' : ''}>${s}</option>`).join('')}</select><button class="a-btn ghost">Filtrar</button></form>
    ${ws.length ? `<div class="w-grid">${ws.map((w, i) => `<a class="w-card st-${h(w.status)}" href="/admin/trabajadores/${w.id}" style="--i:${Math.min(i, 12)}">
      ${avatar(w)}<span class="w-info"><b>${h(w.name)}</b><small>${h([w.trade, w.zone].filter(Boolean).join(' · ') || 'Sin oficio registrado')}</small>
      <span class="w-tags"><span class="w-st">${h(w.status)}</span>${w.level ? chip(w.level) : ''}${trusted.has(w.id) ? trustBadge : ''}${(() => { const c = clientScore(w.id); return c ? `<span class="w-st w-cli">Clientes ${num(c.v)} de 5</span>` : ''; })()}</span></span>${ring(w.score, w.level)}</a>`).join('')}</div>`
      : `<div class="a-empty w-empty"><span class="w-empty-i">${ic('users')}</span><b>${q || st ? 'Nadie coincide con ese filtro.' : 'Aún no hay trabajadores.'}</b><span>Agrega a tu equipo para evaluarlo cada mes, aprobar bonos y emitir certificados.</span><a class="a-btn" href="/admin/trabajadores/nuevo">${ic('plus')}Agregar el primero</a></div>`}`));
  });

  // ---- Metodología ----
  r.get('/trabajadores/metodologia', (req, res) => {
    const s = settings();
    res.send(shell(req, 'Metodología', `<p><a href="/admin/trabajadores">← Trabajadores</a></p><div class="a-head"><div><p class="d-eye">Cómo se reconoce a un buen trabajador</p><h1 class="grad">Metodología de reconocimiento</h1></div></div>
    <section class="card m-intro rise"><p>Usamos una <b>escala de calificación anclada en conductas</b> (BARS): cada mes, quien supervisa califica de 1 a 5 ${N_CRIT} criterios. Cada nota describe una conducta observable en obra, así dos supervisores califican igual. Los criterios tienen un peso y suman <b>100 puntos</b>.</p>
    <ol class="m-steps"><li><b>Evalúa</b> al cierre del mes con una nota justificada.</li><li><b>Revisa</b> el nivel y bono que propone el sistema.</li><li><b>Aprueba</b> o revoca: tú decides, nada es automático.</li><li><b>Reconoce</b> con un certificado verificable por QR.</li></ol></section>
    <div class="m-grid">${CRITERIA.map((c, i) => `<section class="card m-crit rise" style="--i:${i};--cc:${c.c}"><header><h2>${h(c.t)}</h2><span class="m-w">${c.w}%</span></header><p class="a-help">${h(c.d)}</p>
      <span class="m-bar"><i style="width:${c.w * 4}%"></i></span><ol class="m-anch">${c.a.map((a, n) => `<li><b>${n + 1}</b>${h(a)}</li>`).join('')}</ol></section>`).join('')}</div>
    <div class="a-cols"><section class="card rise" style="--i:2"><h2>Niveles y bonos</h2><ul class="m-lv">${LEVELS.map((l) => `<li style="--lc:${l.c}"><span class="w-medal"></span><b>${h(l.t)} · ${h(l.name)}</b><small>${l.k === 'base' ? 'menos de 70 puntos' : `${l.min} puntos o más`}</small><em>${l.k === 'base' ? 'Plan de mejora' : s['bono_' + l.k] ? 'S/ ' + h(s['bono_' + l.k]) : 'por definir'}</em></li>`).join('')}</ul>
      <p class="a-help">Los montos se cambian en <a href="/admin/ajustes">Ajustes</a>.</p></section>
    <section class="card rise" style="--i:3"><h2>Reglas que protegen al equipo</h2><ul class="m-rules">
      <li><b>Compuerta de seguridad.</b> Con nota menor a 3 en Seguridad no hay nivel ni bono, aunque el resto sea alto.</li>
      <li><b>Trabajador de confianza.</b> ${h(TRUST_RULE)}</li>
      <li><b>Justificación obligatoria.</b> Toda evaluación guarda el motivo y quién la hizo.</li>
      <li><b>Decisión humana.</b> El sistema solo propone; el administrador aprueba, revoca con motivo y todo queda en auditoría.</li>
      <li><b>Sin datos sensibles.</b> No se registra DNI ni se penalizan ausencias automáticamente.</li></ul></section></div>`));
  });

  // ---- Alta y edición ----
  const wform = (req, w, err = '') => {
    const cos = all('SELECT id, name, logo, signer_name, signer_role FROM companies ORDER BY sort'), co = cos.find((c) => c.id === (w.company_id || 1)) || cos[0] || {};
    const evs = w.id ? all('SELECT * FROM evaluations WHERE worker_id = ?', w.id) : [], active = w.id ? get('SELECT * FROM badges WHERE worker_id = ? AND revoked_at IS NULL ORDER BY id DESC', w.id) : null;
    const step = (n, t, d) => `<header class="wf-h"><span class="wf-n">${n}</span><span><b>${t}</b><small>${d}</small></span></header>`;
    return shell(req, w.id ? 'Editar trabajador' : 'Nuevo trabajador', `<p><a href="/admin/trabajadores${w.id ? '/' + w.id : ''}">← ${w.id ? h(w.name) : 'Trabajadores'}</a></p>
    <h1 class="grad">${w.id ? 'Editar ficha' : 'Nuevo trabajador'}</h1>${err ? `<p class="a-err" role="alert">${h(err)}</p>` : ''}
    <div class="wf" data-wform data-cos='${h(JSON.stringify(Object.fromEntries(cos.map((c) => [c.id, c.name]))))}'>
    <form class="a-form w-form" method="post" enctype="multipart/form-data" action="/admin/trabajadores/${w.id || 'nuevo'}">${csrf(req)}
    <section class="card wf-s" style="--i:0">${step(1, 'Quién es', 'El nombre sale tal cual en el carné y en los certificados.')}
      <label>Nombre completo<input name="name" required maxlength="120" value="${h(w.name)}" autocomplete="off" data-live="name" placeholder="Ej.: Juan Pérez Quispe"></label>
      <div class="w-2"><label>Teléfono <small>(opcional)</small><input name="phone" inputmode="tel" maxlength="20" value="${h(w.phone)}"></label>
      <label>Fecha de incorporación<input name="joined" type="date" value="${h(w.joined)}"></label></div></section>
    <section class="card wf-s" style="--i:1">${step(2, 'Foto para el carné', 'Opcional. De frente, con fondo claro. JPG o PNG de hasta 4 MB.')}
      <div class="w-photo"><label class="wf-drop" data-drop>${w.photo ? `<img src="${h(w.photo)}" alt="">` : `<span class="w-photo-ph">${ic('users')}</span>`}<span><b>${w.photo ? 'Cambiar foto' : 'Elegir foto'}</b><small>Toca aquí o arrastra la imagen</small></span><input type="file" name="photo__file" accept="image/jpeg,image/png,image/webp" data-live-photo></label><input type="hidden" name="photo" value="${h(w.photo)}">
      ${w.photo ? `<button type="button" class="a-btn ghost sm" data-recrop="${h(w.photo)}">${ic('pen')}Ajustar encuadre</button><label class="a-check"><input type="checkbox" name="photo_rm" value="1" data-live-rm> Quitar foto</label>` : ''}</div>
      <dialog class="crop" data-crop aria-labelledby="crop-t"><h2 id="crop-t">Encuadra la foto</h2><p class="a-help">Arrastra para mover y usa la barra para acercar. Deja la cara y los hombros dentro del marco.</p>
        <div class="crop-vp"><img alt="Foto a recortar" draggable="false"><span class="crop-guide" aria-hidden="true"></span></div>
        <label class="crop-z">Acercar<input type="range" min="1" max="4" step="0.01" value="1" data-zoom></label>
        <div class="a-actions"><button type="button" class="a-btn" data-crop-ok>${ic('plus')}Usar este encuadre</button><button type="button" class="a-btn ghost" data-crop-cancel>Cancelar</button></div></dialog></section>
    <section class="card wf-s" style="--i:2">${step(3, 'Su trabajo', 'Oficio y zona salen en el carné. El estado decide si aparece como disponible.')}
      <div class="w-2"><label>Oficio o especialidad<input name="trade" maxlength="80" value="${h(w.trade)}" placeholder="Operario, maestro de obra, chofer…" data-live="trade"></label>
      <label>Zona u obra<input name="zone" maxlength="80" value="${h(w.zone)}" data-live="zone"></label></div>
      <div class="w-2"><label>Empresa<select name="company_id" data-live-co>${cos.map((c) => `<option value="${c.id}" ${c.id === co.id ? 'selected' : ''}>${h(c.name)}</option>`).join('')}</select></label>
      <label>Estado<select name="status">${STATUS.map((s) => `<option ${s === (w.status || 'activo') ? 'selected' : ''}>${s}</option>`).join('')}</select></label></div>
      <label class="a-check wf-pub"><input type="checkbox" name="public" value="1" ${w.public === 0 ? '' : 'checked'}> Mostrar en la página pública <a href="/equipo" target="_blank" rel="noopener">Equipo</a> con su foto, oficio, calificación y certificados <small>Pide su permiso antes de publicar su foto. Nunca se publican teléfono, observaciones ni bonos.</small></label></section>
    <section class="card wf-s" style="--i:3">${step(4, 'Observaciones', 'Solo las ve el administrador. No registres DNI ni datos de salud.')}
      <label><span class="sr">Observaciones</span><textarea name="notes" rows="3" maxlength="2000">${h(w.notes)}</textarea></label></section>
    <div class="a-actions wf-act"><button class="a-btn">${ic('plus')}${w.id ? 'Guardar cambios' : 'Guardar y ver su ficha'}</button>${w.id ? `<button class="a-btn danger" name="_delete" value="1" data-confirm="¿Eliminar a ${h(w.name)} con todo su historial y certificados? Si solo dejó de trabajar, cambia su estado a inactivo.">Eliminar</button>` : ''}</div></form>
    <aside class="wf-prev"><p class="wf-prev-t">Así se verá su carné</p>${cardHtml(req, w, co, active, w.id && isTrusted(evs), w.id ? rating(evs) : null)}
      <p class="a-help">${w.id ? 'Al guardar, el carné y su QR toman estos datos. Las estrellas salen de sus evaluaciones.' : 'Después de guardar podrás calificar su puntualidad, garantía y calidad, y generar el carné con QR.'}</p></aside></div>`);
  };
  r.get('/trabajadores/nuevo', (req, res) => res.send(wform(req, {})));
  r.get('/trabajadores/:id/editar', (req, res, next) => { const w = load(req.params.id); return w ? res.send(wform(req, w)) : next(); });
  r.post('/trabajadores/:id', (req, res, next) => {
    const isNew = req.params.id === 'nuevo'; const w = isNew ? {} : load(req.params.id); if (!w) return next();
    if (!isNew && req.body._delete === '1') { run('DELETE FROM workers WHERE id = ?', w.id); audit(req.admin.username, 'delete', 'workers', w.id, w.name); return res.redirect('/admin/trabajadores'); }
    const b = req.body, v = { name: String(b.name || '').trim().slice(0, 120), trade: String(b.trade || '').trim().slice(0, 80), zone: String(b.zone || '').trim().slice(0, 80),
      phone: String(b.phone || '').replace(/[^\d +]/g, '').slice(0, 20), joined: /^\d{4}-\d{2}-\d{2}$/.test(b.joined) ? b.joined : '',
      company_id: get('SELECT id FROM companies WHERE id = ?', +b.company_id)?.id || 1, status: STATUS.includes(b.status) ? b.status : 'activo', notes: String(b.notes || '').slice(0, 2000), public: b.public === '1' ? 1 : 0 };
    v.photo = req.file ? '/uploads/' + req.file.filename : b.photo_rm ? '' : /^\/uploads\/[a-f0-9]+\.(jpe?g|png)$/.test(b.photo || '') ? b.photo : '';
    if (!v.name) return res.status(400).send(wform(req, { ...v, id: w.id }, 'Escribe el nombre completo.'));
    const keys = Object.keys(v);
    let id = w.id;
    if (isNew) id = Number(run(`INSERT INTO workers (${keys}) VALUES (${keys.map(() => '?')})`, ...Object.values(v)).lastInsertRowid);
    else run(`UPDATE workers SET ${keys.map((x) => x + ' = ?')} WHERE id = ?`, ...Object.values(v), id);
    audit(req.admin.username, isNew ? 'create' : 'update', 'workers', id, v.name); res.redirect('/admin/trabajadores/' + id);
  });

  // ---- Ficha ----
  r.get('/trabajadores/:id', (req, res, next) => {
    const w = load(req.params.id); if (!w) return next();
    const evs = all('SELECT * FROM evaluations WHERE worker_id = ? ORDER BY period DESC', w.id);
    const certs = all('SELECT * FROM certificates WHERE worker_id = ? ORDER BY id DESC', w.id);
    const badges = all('SELECT * FROM badges WHERE worker_id = ? ORDER BY id DESC', w.id), active = badges.find((x) => !x.revoked_at && x.expires >= today());
    const coFull = get('SELECT * FROM companies WHERE id = ?', w.company_id) || {};
    const nextYear = new Date(Date.now() + 365 * 864e5).toISOString().slice(0, 10);
    const co = get('SELECT name FROM companies WHERE id = ?', w.company_id);
    const last = evs[0], trusted = isTrusted(evs), approved = evs.filter((e) => e.status === 'aprobado');
    const hist = evs.slice(0, 12).reverse(), rt = rating(evs), sig = printSig(w, rt, trusted);
    const stale = active?.printed && active.printed !== sig ? changed(active.printed, sig) : [];
    const phone = (w.phone || '').replace(/\D/g, ''), wa = phone.length === 9 ? '51' + phone : phone;
    res.send(shell(req, w.name, `<p><a href="/admin/trabajadores">← Trabajadores</a></p>
    <section class="w-prof rise" style="--hue:${HUES[w.id % HUES.length]}">${avatar(w, ' big')}<div class="w-prof-tx"><h1>${h(w.name)}</h1>
      <p>${h([w.trade, w.zone, co?.name].filter(Boolean).join(' · '))}</p><span class="w-tags"><span class="w-st">${h(w.status)}</span>${last ? chip(last.level) : ''}${trusted ? trustBadge : ''}${w.joined ? `<span class="w-st">desde ${h(w.joined)}</span>` : ''}${w.public === 0 || w.status === 'inactivo' ? '<span class="w-st">no sale en la web</span>' : ''}</span></div>
      ${last ? ring(last.score, last.level, ' big') : ''}
      <div class="w-prof-act"><a class="a-btn" href="/admin/trabajadores/${w.id}/evaluar">${ic('star')}Evaluar mes</a><a class="a-btn ghost" href="/admin/trabajadores/${w.id}/editar">${ic('pen')}Editar</a>${wa ? `<a class="a-btn ghost" href="https://wa.me/${h(wa)}" target="_blank" rel="noopener">${ic('ext')}WhatsApp</a>` : ''}${w.public !== 0 && w.status !== 'inactivo' ? `<a class="a-btn ghost" href="${teamPath(w)}" target="_blank" rel="noopener">${ic('ext')}Ver en la web</a>` : ''}</div></section>
    <section class="card rise w-rate" style="--i:1"><header><h2>Calificación</h2><a class="a-btn sm" href="/admin/trabajadores/${w.id}/evaluar">${ic('star')}Calificar este mes</a></header>
      ${rt ? `<div class="w-rate-g">${rt.map((r, i) => `<div class="w-rate-c" style="--cc:${r.c};--i:${i}"><span class="w-rate-t">${h(r.t)}</span>${stars(r.v, r.c, i)}<b>${r.v ? num(r.v) : '—'}<small> / 5</small></b></div>`).join('')}</div>
        <p class="a-help">Promedio de sus últimas evaluaciones aprobadas (hasta tres meses). Sale en su certificado y en su carné.</p>`
      : `<div class="w-rate-empty"><span class="w-stars big" style="--f:0%"></span><p>Califica su <b>puntualidad</b>, la <b>garantía</b> de su trabajo y su <b>calidad</b> al cerrar el mes. Al aprobar la evaluación, las estrellas aparecen aquí, en su certificado y en su carné.</p></div>`}</section>
    ${reviewsCard(req, w, { csrf, ic, base: baseUrl(req), fresh: String(req.query.enlace || '') })}
    <div class="a-cols">
      <section class="card rise" style="--i:2"><header><h2>Historial de puntaje</h2><span class="d-tag">${evs.length} meses</span></header>
        ${hist.length ? `<div class="w-hist">${hist.map((e, i) => `<span style="--h:${Math.max(4, e.score)};--i:${i};--lc:${levelOf(e.level).c}" class="${e.status}" title="${h(periodName(e.period))}: ${e.score} (${h(e.status)})"><b>${Math.round(e.score)}</b><i></i><small>${h(e.period.slice(5))}/${h(e.period.slice(2, 4))}</small></span>`).join('')}</div>` : '<p class="d-empty">Sin evaluaciones todavía.</p>'}</section>
      <section class="card rise" style="--i:2"><header><h2>Última evaluación</h2>${last ? `<span class="d-tag">${h(periodName(last.period))}</span>` : ''}</header>
        ${last ? `<ul class="w-crit">${CRITERIA.map((c, i) => `<li style="--cc:${c.c};--v:${(last[c.k] || 0) * 20};--i:${i}"><span>${h(c.t)}</span><span class="w-cb"><i></i></span><b>${last[c.k] ? last[c.k] + '/5' : '—'}</b></li>`).join('')}</ul>` : `<p class="d-empty">Evalúa su primer mes para ver sus fortalezas.</p>`}</section></div>
    <section class="card rise" style="--i:3"><header><h2>Evaluaciones y bonos</h2><a class="a-btn ghost" href="/admin/trabajadores/${w.id}/evaluar">${ic('plus')}Nueva</a></header>
      ${evs.length ? `<ul class="w-evs">${evs.map((e) => `<li class="ev-${e.status}"><span class="w-ev-p"><b>${h(periodName(e.period))}</b><small>${h(e.project || 'Sin obra indicada')}${e.days ? ` · ${e.days} días` : ''}</small></span>
        ${ring(e.score, e.level)}${chip(e.level)}<span class="w-ev-b">${e.bonus_cents ? money(e.bonus_cents) : 'Sin bono'}</span><span class="a-pill s-${e.status === 'aprobado' ? 'confirmado' : e.status === 'propuesto' ? 'nuevo' : 'descartado'}">${h(e.status)}</span>
        <span class="w-ev-a">${e.status === 'propuesto' ? `<form method="post" action="/admin/evaluaciones/${e.id}/aprobar">${csrf(req)}<button class="a-btn sm">Aprobar</button></form><a class="a-btn ghost sm" href="/admin/trabajadores/${w.id}/evaluar?periodo=${e.period}">Editar</a>` : ''}
        ${e.status !== 'revocado' ? `<details class="w-rev"><summary>Revocar</summary><form method="post" action="/admin/evaluaciones/${e.id}/revocar">${csrf(req)}<input name="reason" required maxlength="300" placeholder="Motivo de la revocación"><button class="a-btn danger sm">Confirmar</button></form></details>` : `<small class="a-muted">${h(e.revoke_reason || '')}</small>`}</span>
        <p class="w-ev-r">${h(e.reason || '')} <small>— ${h(e.evaluator || '')}${e.decided_by ? `, ${h(e.status)} por ${h(e.decided_by)}` : ''}</small></p></li>`).join('')}</ul>` : '<p class="d-empty">Todavía no hay evaluaciones.</p>'}</section>
    <section class="card rise w-badge" style="--i:4" id="carne"><header><h2>Carné de identificación</h2>${active ? `<span class="a-pill s-confirmado">vigente hasta ${dmy(active.expires)}</span>` : '<span class="a-pill s-nuevo">sin carné vigente</span>'}</header>
      ${cardHtml(req, w, coFull, active, trusted, rt)}
      <div class="bc-side">${stale.length ? `<p class="bc-stale" role="status">${ic('pen')}<span>Cambió ${h(listEs(stale))} desde la última descarga. <b>Descarga el PDF otra vez</b> para imprimir el carné al día. El QR ya muestra los datos nuevos.</span></p>` : active ? `<p class="bc-live">El carné toma siempre los datos actuales de la ficha: cada descarga sale al día.</p>` : ''}<ol class="bc-steps"><li><b>Genera</b> el carné con su fecha de vencimiento.</li><li><b>Imprime</b> la hoja A4 a tamaño real o lleva el PDF tamaño tarjeta a una imprenta de fotochecks.</li><li><b>Recorta, pega y plastifica.</b> El trabajador lo lleva visible en obra.</li><li><b>Cualquiera lo verifica</b> escaneando el QR: verá si está vigente.</li></ol>
        <form class="w-issue bc-form" method="post" action="/admin/trabajadores/${w.id}/carne">${csrf(req)}<label>Válido hasta<input type="date" name="expires" required value="${nextYear}" min="${today()}"></label>
          <button class="a-btn" ${active ? `data-confirm="Se anulará el carné ${h(active.code)} y se creará uno nuevo. ¿Continuar?"` : ''}>${ic('plus')}${active ? 'Reemplazar carné' : 'Generar carné'}</button></form>
        ${w.photo ? '' : `<p class="a-help">Sin foto, el carné muestra sus iniciales. <a href="/admin/trabajadores/${w.id}/editar">Agregar foto</a></p>`}
        ${badges.length ? `<ul class="w-cl">${badges.map((x) => `<li class="${x.revoked_at || x.expires < today() ? 'rev' : ''}"><span class="d-ico">${ic('users')}</span><span><b>Carné ${h(x.code)}</b><small>Emitido ${dmy(x.issued_at)} · vence ${dmy(x.expires)}${x.revoked_at ? ` · anulado: ${h(x.revoked_reason)}` : x.expires < today() ? ' · vencido' : ''}</small></span>
          <span class="w-ev-a">${x.revoked_at ? '' : `<a class="a-btn sm" href="/admin/carnes/${h(x.code)}.pdf?hoja=1">${ic('down')}Hoja A4</a><a class="a-btn ghost sm" href="/admin/carnes/${h(x.code)}.pdf">${ic('down')}PDF tarjeta</a>`}<a class="a-btn ghost sm" href="/verificar/${h(x.code)}" target="_blank" rel="noopener">Verificar</a>
          ${x.revoked_at ? '' : `<details class="w-rev"><summary>Anular</summary><form method="post" action="/admin/carnes/${h(x.code)}/anular">${csrf(req)}<input name="reason" required maxlength="300" placeholder="Motivo (pérdida, cese…)"><button class="a-btn danger sm">Anular</button></form></details>`}</span></li>`).join('')}</ul>` : ''}</div></section>
    <section class="card rise w-certs" style="--i:5"><header><h2>Certificados</h2></header>
      <form class="w-issue" method="post" action="/admin/trabajadores/${w.id}/certificado">${csrf(req)}
        <label>Tipo<select name="kind"><option value="confianza">Trabajador de confianza${trusted ? ' (cumple la regla)' : ''}</option><option value="excelencia" ${approved.length ? '' : 'disabled'}>Reconocimiento a la excelencia</option></select></label>
        <label>Evaluación que lo respalda<select name="evaluation_id"><option value="">Ninguna</option>${approved.map((e) => `<option value="${e.id}">${h(periodName(e.period))} · ${Math.round(e.score)} pts · ${h(levelOf(e.level).t)}</option>`).join('')}</select></label>
        <button class="a-btn">${ic('down')}Emitir certificado PDF</button></form>
      ${trusted ? '' : `<p class="a-help">Regla de confianza: ${h(TRUST_RULE)} Puedes emitirlo igual si tienes otros registros que lo respalden.</p>`}
      ${certs.length ? `<ul class="w-cl">${certs.map((c) => `<li id="cert-${h(c.code)}" class="${c.revoked_at ? 'rev' : ''}"><span class="d-ico">${ic('shield')}</span><span><b>${h(c.title)}</b><small>${h(c.code)} · ${h(c.issued_at.slice(0, 10))}${c.revoked_at ? ` · anulado: ${h(c.revoked_reason)}` : ''}</small></span>
        <span class="w-ev-a"><a class="a-btn ghost sm" href="/admin/certificados/${h(c.code)}.pdf">${ic('down')}PDF</a><a class="a-btn ghost sm" href="/verificar/${h(c.code)}" target="_blank" rel="noopener">Verificar</a>
        ${c.revoked_at ? '' : `<details class="w-rev"><summary>Anular</summary><form method="post" action="/admin/certificados/${h(c.code)}/anular">${csrf(req)}<input name="reason" required maxlength="300" placeholder="Motivo"><button class="a-btn danger sm">Anular</button></form></details>`}</span></li>`).join('')}</ul>` : ''}</section>
    ${w.notes ? `<section class="card"><h2>Observaciones</h2><p class="a-pre">${h(w.notes)}</p></section>` : ''}`));
  });

  // ---- Evaluar ----
  r.get('/trabajadores/:id/evaluar', (req, res, next) => {
    const w = load(req.params.id); if (!w) return next();
    const period = /^\d{4}-\d{2}$/.test(req.query.periodo) ? req.query.periodo : thisPeriod();
    const e = get('SELECT * FROM evaluations WHERE worker_id = ? AND period = ?', w.id, period) || {};
    res.send(shell(req, 'Evaluar', evalForm(req, w, { period, ...e })));
  });
  const evalForm = (req, w, e, err = '') => {
    const s = settings();
    return `<p><a href="/admin/trabajadores/${w.id}">← ${h(w.name)}</a></p><div class="a-head"><div><p class="d-eye">Evaluación mensual</p><h1 class="grad">${h(w.name)}</h1></div><a class="a-btn ghost" href="/admin/trabajadores/metodologia">${ic('shield')}Ver metodología</a></div>
    ${err ? `<p class="a-err" role="alert">${h(err)}</p>` : ''}
    <form class="ev" method="post" action="/admin/trabajadores/${w.id}/evaluar" data-eval data-bonos='${h(JSON.stringify({ oro: s.bono_oro, plata: s.bono_plata, bronce: s.bono_bronce }))}'>${csrf(req)}
    <div class="ev-main"><section class="card w-2 ev-meta"><label>Mes evaluado<input type="month" name="period" required value="${h(e.period)}"></label><label>Obra o proyecto<input name="project" maxlength="120" value="${h(e.project)}"></label><label>Días trabajados<input type="number" name="days" min="0" max="31" value="${h(e.days)}"></label></section>
    ${CRITERIA.map((c, i) => `<fieldset class="card ev-c rise" style="--i:${i};--cc:${c.c}" data-w="${c.w}" data-k="${c.k}"><legend><b>${h(c.t)}${['s_pun', 's_gar', 's_cal'].includes(c.k) ? '<span class="ev-key">Sale en certificado y carné</span>' : ''}</b><span class="m-w">${c.w}%</span></legend><p class="a-help">${h(c.d)}</p>
      <div class="ev-pick">${[1, 2, 3, 4, 5].map((n) => `<label><input type="radio" name="${c.k}" value="${n}" required ${+e[c.k] === n ? 'checked' : ''}><span>${n}</span></label>`).join('')}</div>
      <ol class="ev-anch">${c.a.map((a) => `<li>${h(a)}</li>`).join('')}</ol></fieldset>`).join('')}
    <section class="card"><label>Justificación<textarea name="reason" rows="3" required maxlength="1000" placeholder="Hechos concretos del mes: qué hizo bien, qué debe mejorar.">${h(e.reason)}</textarea></label></section></div>
    <aside class="card ev-prev"><p class="d-eye">Resultado propuesto</p><span class="w-ring huge" data-ring style="--p:0;--lc:#5d6874"><svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="16" pathLength="100"/><circle cx="20" cy="20" r="16" pathLength="100"/></svg><b data-score>0</b></span>
      <b class="ev-lv" data-level>Completa los ${N_CRIT} criterios</b><span class="ev-bono" data-bono></span><p class="ev-gate" data-gate hidden>Seguridad menor a 3: sin nivel ni bono.</p>
      <ul class="ev-mini">${CRITERIA.map((c) => `<li style="--cc:${c.c}" data-mini="${c.k}"><span>${h(c.t)}</span><i></i></li>`).join('')}</ul>
      <button class="a-btn" name="approve" value="1">${ic('star')}Guardar y aprobar</button><button class="a-btn ghost" name="approve" value="0">Guardar como propuesta</button>
      <p class="a-help">Tú decides: el sistema solo propone nivel y bono.</p></aside></form>`;
  };
  r.post('/trabajadores/:id/evaluar', (req, res, next) => {
    const w = load(req.params.id); if (!w) return next();
    const b = req.body, sc = {};
    for (const c of CRITERIA) sc[c.k] = Math.min(5, Math.max(1, parseInt(b[c.k], 10) || 0));
    const period = /^\d{4}-\d{2}$/.test(b.period) ? b.period : '';
    const reason = String(b.reason || '').trim().slice(0, 1000);
    if (!period || CRITERIA.some((c) => !+b[c.k]) || !reason) return res.status(400).send(shell(req, 'Evaluar', evalForm(req, w, { ...b, ...sc }, 'Completa el mes, los ${N_CRIT} criterios y la justificación.')));
    const r0 = evaluate(sc, settings()), ok = b.approve === '1';
    const vals = [b.project ? String(b.project).slice(0, 120) : '', parseInt(b.days, 10) || null, ...CRITERIA.map((c) => sc[c.k]), r0.score, r0.level, r0.bonus_cents, ok ? 'aprobado' : 'propuesto', reason, req.admin.username, ok ? req.admin.username : null, ok ? new Date().toISOString() : null];
    run(`INSERT INTO evaluations (worker_id, period, project, days, ${CRITERIA.map((c) => c.k)}, score, level, bonus_cents, status, reason, evaluator, decided_by, decided_at) VALUES (?, ?, ?, ?, ${CRITERIA.map(() => '?')}, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (worker_id, period) DO UPDATE SET project = excluded.project, days = excluded.days, ${CRITERIA.map((c) => `${c.k} = excluded.${c.k}`)}, score = excluded.score, level = excluded.level,
      bonus_cents = excluded.bonus_cents, status = excluded.status, reason = excluded.reason, evaluator = excluded.evaluator, decided_by = excluded.decided_by, decided_at = excluded.decided_at, revoke_reason = NULL`, w.id, period, ...vals);
    audit(req.admin.username, ok ? 'approve' : 'evaluate', 'workers', w.id, `${period}: ${r0.score} ${r0.level}${r0.bonus_cents ? ' ' + money(r0.bonus_cents) : ''}`);
    res.redirect('/admin/trabajadores/' + w.id);
  });
  r.post('/evaluaciones/:id/:act', (req, res, next) => {
    const e = get('SELECT * FROM evaluations WHERE id = ?', req.params.id); if (!e || !['aprobar', 'revocar'].includes(req.params.act)) return next();
    const reason = String(req.body.reason || '').trim().slice(0, 300);
    if (req.params.act === 'aprobar') run(`UPDATE evaluations SET status = 'aprobado', decided_by = ?, decided_at = ? WHERE id = ?`, req.admin.username, new Date().toISOString(), e.id);
    else { if (!reason) return res.redirect('/admin/trabajadores/' + e.worker_id); run(`UPDATE evaluations SET status = 'revocado', decided_by = ?, decided_at = ?, revoke_reason = ? WHERE id = ?`, req.admin.username, new Date().toISOString(), reason, e.id); }
    audit(req.admin.username, req.params.act === 'aprobar' ? 'approve' : 'revoke', 'workers', e.worker_id, `${e.period}${reason ? ': ' + reason : ''}`);
    res.redirect('/admin/trabajadores/' + e.worker_id);
  });

  // ---- Certificados ----
  r.post('/trabajadores/:id/certificado', (req, res, next) => {
    const w = load(req.params.id); if (!w) return next();
    const ev = req.body.evaluation_id ? get(`SELECT * FROM evaluations WHERE id = ? AND worker_id = ? AND status = 'aprobado'`, req.body.evaluation_id, w.id) : null;
    const kind = req.body.kind === 'excelencia' && ev ? 'excelencia' : 'confianza';
    const co = get('SELECT * FROM companies WHERE id = ?', w.company_id) || get('SELECT * FROM companies WHERE id = 1');
    const lv = ev ? levelOf(ev.level) : null;
    const title = kind === 'excelencia' ? 'Reconocimiento a la Excelencia' : 'Trabajador de Confianza';
    const body = kind === 'excelencia'
      ? `Por su desempeño de máxima calidad y rendimiento en ${periodName(ev.period)}${ev.project ? `, en ${ev.project}` : ''}, con una calificación de ${Math.round(ev.score)} de 100 puntos (nivel ${lv.t} · ${lv.name}) según la metodología de evaluación de ${co.name}, que acredita su puntualidad, la garantía y la calidad de su trabajo, y su compromiso con la seguridad.`
      : `Por demostrar puntualidad, responsabilidad y compromiso con la garantía y la calidad de su trabajo en las obras de ${co.name}${w.trade ? ` como ${w.trade.toLowerCase()}` : ''}${w.joined ? `, desde ${periodName(w.joined.slice(0, 7))}` : ''}${ev ? `, con una evaluación de ${Math.round(ev.score)} de 100 puntos en ${periodName(ev.period)}` : ''}. Se le acredita como trabajador de confianza de la empresa.`;
    const code = crypto.randomBytes(5).toString('hex').toUpperCase().replace(/(.{5})/, '$1-');
    const rt = rating(all('SELECT * FROM evaluations WHERE worker_id = ?', w.id));
    run('INSERT INTO certificates (code, worker_id, evaluation_id, kind, title, body, company_id, issued_by, ratings) VALUES (?,?,?,?,?,?,?,?,?)', code, w.id, ev?.id ?? null, kind, title, body, co.id, req.admin.username, rt ? JSON.stringify(rt) : null);
    audit(req.admin.username, 'certificate', 'workers', w.id, `${code} ${title}`);
    res.redirect('/admin/trabajadores/' + w.id + '#cert-' + code);
  });
  r.get('/certificados/:file', async (req, res, next) => {
    const m = /^([A-F0-9]{5}-[A-F0-9]{5})\.pdf$/.exec(req.params.file); if (!m) return next();
    const c = get('SELECT * FROM certificates WHERE code = ?', m[1]); if (!c) return next();
    const w = load(c.worker_id), co = get('SELECT * FROM companies WHERE id = ?', c.company_id), ev = c.evaluation_id ? get('SELECT * FROM evaluations WHERE id = ?', c.evaluation_id) : null;
    const base = `${req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : req.protocol}://${req.get('host')}`;
    res.type('pdf').attachment(`certificado-${initials(w.name).toLowerCase()}-${c.code}.pdf`);
    const d = { c, w, co, ev, url: `${base}/verificar/${c.code}` };
    certificatePdf(res, d, await loadImages(certImages(d)));
  });
  // ---- Carnés ----
  r.post('/trabajadores/:id/carne', (req, res, next) => {
    const w = load(req.params.id); if (!w) return next();
    const exp = /^\d{4}-\d{2}-\d{2}$/.test(req.body.expires) && req.body.expires >= today() ? req.body.expires : new Date(Date.now() + 365 * 864e5).toISOString().slice(0, 10);
    const code = crypto.randomBytes(5).toString('hex').toUpperCase().replace(/(.{5})/, '$1-');
    run(`UPDATE badges SET revoked_at = ?, revoked_reason = ? WHERE worker_id = ? AND revoked_at IS NULL`, new Date().toISOString(), 'Reemplazado por ' + code, w.id);
    run('INSERT INTO badges (code, worker_id, expires, issued_by) VALUES (?,?,?,?)', code, w.id, exp, req.admin.username);
    audit(req.admin.username, 'badge', 'workers', w.id, `${code} vence ${exp}`);
    res.redirect(`/admin/trabajadores/${w.id}#carne`);
  });
  r.get('/carnes/:file', async (req, res, next) => {
    const m = /^([A-F0-9]{5}-[A-F0-9]{5})\.pdf$/.exec(req.params.file); if (!m) return next();
    const b = get('SELECT * FROM badges WHERE code = ?', m[1]); if (!b) return next();
    const w = load(b.worker_id), co = get('SELECT * FROM companies WHERE id = ?', w.company_id) || get('SELECT * FROM companies WHERE id = 1');
    const evs = all('SELECT * FROM evaluations WHERE worker_id = ?', w.id), trusted = isTrusted(evs), rt = rating(evs);
    if (!b.revoked_at) run('UPDATE badges SET printed = ? WHERE id = ?', printSig(w, rt, trusted), b.id);
    res.type('pdf').attachment(`carne-${initials(w.name).toLowerCase()}-${b.code}${req.query.hoja ? '-a4' : ''}.pdf`);
    const d = { b, w, co, s: settings(), trusted, rt, url: `${baseUrl(req)}/verificar/${b.code}` };
    badgePdf(res, d, !!req.query.hoja, await loadImages(badgeImages(d)));
  });
  r.post('/carnes/:code/anular', (req, res, next) => {
    const b = get('SELECT * FROM badges WHERE code = ?', req.params.code); if (!b) return next();
    const reason = String(req.body.reason || '').trim().slice(0, 300);
    if (reason && !b.revoked_at) { run('UPDATE badges SET revoked_at = ?, revoked_reason = ? WHERE id = ?', new Date().toISOString(), reason, b.id); audit(req.admin.username, 'revoke', 'workers', b.worker_id, `carné ${b.code}: ${reason}`); }
    res.redirect(`/admin/trabajadores/${b.worker_id}#carne`);
  });
  r.post('/certificados/:code/anular', (req, res, next) => {
    const c = get('SELECT * FROM certificates WHERE code = ?', req.params.code); if (!c) return next();
    const reason = String(req.body.reason || '').trim().slice(0, 300);
    if (reason && !c.revoked_at) { run('UPDATE certificates SET revoked_at = ?, revoked_reason = ? WHERE id = ?', new Date().toISOString(), reason, c.id); audit(req.admin.username, 'revoke', 'certificates', c.id, `${c.code}: ${reason}`); }
    res.redirect('/admin/trabajadores/' + c.worker_id);
  });
}

// Verificación pública: solo nombre, título, empresa, periodo, fecha y vigencia. Nunca la ficha laboral.
export function verifyData(code) {
  code = String(code).toUpperCase();
  const c = get(`SELECT c.code, c.title, c.issued_at, c.revoked_at, c.ratings, w.name, co.name AS company, e.period FROM certificates c JOIN workers w ON w.id = c.worker_id
    LEFT JOIN companies co ON co.id = c.company_id LEFT JOIN evaluations e ON e.id = c.evaluation_id WHERE c.code = ?`, code);
  if (c) { let rt = null; try { rt = c.ratings ? JSON.parse(c.ratings) : null; } catch { rt = null; } return { type: 'cert', ...c, rt, state: c.revoked_at ? 'anulado' : 'valido', period: periodName(c.period) }; }
  const b = get(`SELECT b.*, w.name, w.trade, w.photo, w.status, w.id AS wid, co.name AS company FROM badges b JOIN workers w ON w.id = b.worker_id
    LEFT JOIN companies co ON co.id = w.company_id WHERE b.code = ?`, code);
  if (!b) return null;
  const state = b.revoked_at ? 'anulado' : b.expires < today() ? 'vencido' : b.status === 'inactivo' ? 'inactivo' : 'valido';
  const evs = all('SELECT * FROM evaluations WHERE worker_id = ?', b.wid);
  return { rt: state === 'valido' ? rating(evs) : null, type: 'carne', code: b.code, name: b.name, trade: b.trade, photo: b.photo, company: b.company, expires: dmy(b.expires), issued_at: b.issued_at, state,
    trusted: state === 'valido' && isTrusted(evs) };
}
