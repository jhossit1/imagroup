// Opiniones de clientes: el administrador crea un enlace único por trabajo, el cliente califica
// puntualidad, garantía y calidad, y la opinión solo se publica cuando el administrador la aprueba.
import crypto from 'node:crypto';
import { all, get, run, audit } from './db.js';
import { h } from './views.js';
import { CRITERIA } from './method.js';

export const RK = ['s_pun', 's_gar', 's_cal'].map((k) => CRITERIA.find((c) => c.k === k));
const ASK = { s_pun: '¿Llegó a la hora y cumplió los plazos acordados?', s_gar: '¿Respondió y corrigió lo que hizo falta después del trabajo?', s_cal: '¿Cómo quedó el trabajo terminado?' };
const SAY = ['', 'Muy malo', 'Malo', 'Regular', 'Bueno', 'Excelente'];
const num = (v) => String(v).replace('.', ',');
const dmy = (iso) => String(iso || '').slice(0, 10).split('-').reverse().join('/');
const avg3 = (r) => (r.s_pun + r.s_gar + r.s_cal) / 3;
const r1 = (v) => Math.round(v * 10) / 10;
const DAYS = 60;

// ---- Datos públicos (solo publicadas) ----
export function clientScore(wid) {
  const rs = all(`SELECT s_pun, s_gar, s_cal, again FROM reviews WHERE worker_id = ? AND status = 'publicado'`, wid);
  if (!rs.length) return null;
  const mean = (f) => r1(rs.reduce((t, r) => t + f(r), 0) / rs.length);
  return {
    n: rs.length, v: mean(avg3), again: Math.round((rs.filter((r) => r.again).length / rs.length) * 100),
    crit: RK.map((c) => ({ k: c.k, t: c.t, c: c.c, v: mean((r) => r[c.k]) })),
    dist: [5, 4, 3, 2, 1].map((s) => ({ s, n: rs.filter((r) => Math.round(avg3(r)) === s).length })),
  };
}
export const clientReviews = (wid) => all(`SELECT * FROM reviews WHERE worker_id = ? AND status = 'publicado' ORDER BY answered_at DESC`, wid);
export function clientTotals(ids) {
  if (!ids.length) return null;
  const t = get(`SELECT COUNT(*) n, SUM(again) a FROM reviews WHERE status = 'publicado' AND worker_id IN (${ids.map((i) => +i).join(',')})`);
  return t.n ? { n: t.n, again: Math.round((t.a / t.n) * 100) } : null;
}
export const reviewWho = (r) => (r.show_name && r.client ? r.client : 'Cliente verificado');

// ---- Página del cliente: /opinar/:code ----
const starsInput = (c) => `<fieldset class="op-q" data-q="${c.k}" style="--cc:${c.c}"><legend><b>${h(c.t)}</b><small>${h(ASK[c.k])}</small></legend>
  <div class="op-stars">${[5, 4, 3, 2, 1].map((v) => `<input type="radio" id="${c.k}-${v}" name="${c.k}" value="${v}" ${v === 5 ? 'required' : ''}><label for="${c.k}-${v}" title="${SAY[v]}"><span class="sr">${v} de 5: ${SAY[v]}</span></label>`).join('')}</div>
  <output class="op-say" data-say aria-live="polite">Toca una estrella</output></fieldset>`;

const who = (w) => `<aside class="op-who"><span class="op-pic">${w.photo ? `<img src="${h(w.photo)}" alt="Foto de ${h(w.name)}">` : `<span class="tm-ini" style="--hue:#1a5f99">${h(w.name.split(/\s+/).slice(0, 2).map((x) => x[0]).join('').toUpperCase())}</span>`}</span>
  <b>${h(w.name)}</b><small>${h(w.trade || 'Equipo de obra')}${w.company ? `, ${h(w.company.replace(/\.$/, ''))}` : ''}</small></aside>`;

export function reviewForm(rv, w, err = '') {
  const first = h(w.name.split(/\s+/)[0]);
  return `<section class="wrap op">${who(w)}
  <form class="op-form" method="post" data-op novalidate>
    <div class="op-prog" aria-hidden="true"><i data-op-bar></i></div><p class="op-left" data-op-left aria-live="polite">4 preguntas, menos de un minuto</p>
    <h1>¿Cómo trabajó ${first}?</h1>
    <p class="op-lead">${rv.job ? `Trabajo: <b>${h(rv.job)}</b>. ` : ''}Tu opinión ayuda a otros clientes y reconoce el buen trabajo.</p>
    ${err ? `<p class="op-err" role="alert">${h(err)}</p>` : ''}
    ${RK.map(starsInput).join('')}
    <fieldset class="op-q op-again" data-q="again"><legend><b>¿Volverías a contratar a ${first}?</b></legend>
      <div class="op-yn"><input type="radio" id="ag-1" name="again" value="1" required><label for="ag-1">Sí, lo volvería a contratar</label><input type="radio" id="ag-0" name="again" value="0"><label for="ag-0">No</label></div></fieldset>
    <label class="op-f">Cuéntanos algo más <small>opcional</small><textarea name="comment" maxlength="600" rows="4" data-op-count placeholder="Qué hizo bien, qué podría mejorar"></textarea><small class="op-n" data-op-n>0 de 600</small></label>
    <label class="op-f">Tu nombre o empresa <small>opcional</small><input name="client" maxlength="80" value="${h(rv.client || '')}" autocomplete="name"></label>
    <label class="op-chk"><input type="checkbox" name="show_name" value="1" checked> Mostrar mi nombre junto a mi opinión</label>
    <input type="text" name="website" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true"><input type="hidden" name="_t" value="${Date.now()}">
    <button class="btn op-send" data-op-send>Enviar opinión</button>
    <p class="op-fine">Revisamos cada opinión antes de publicarla en la página del equipo. Este enlace sirve una sola vez.</p>
  </form></section>`;
}

export function reviewDone(rv, w, link) {
  const v = r1(avg3(rv));
  return `<section class="wrap op op-done">${who(w)}<div class="op-thanks"><span class="op-check" aria-hidden="true"><svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="24"/><path d="M15 27l7 7 15-16"/></svg></span>
    <h1>Gracias por tu opinión</h1><p>Le diste a ${h(w.name.split(/\s+/)[0])} <b>${num(v)} de 5</b>. La revisaremos antes de publicarla en su página.</p>
    <ul class="tm-rate big">${RK.map((c, i) => `<li style="--cc:${c.c}"><span>${h(c.t)}</span><i class="tm-stars" style="--f:${rv[c.k] * 20}%;--i:${i}" role="img" aria-label="${rv[c.k]} de 5"></i><b>${rv[c.k]}</b></li>`).join('')}</ul>
    ${link ? `<a class="btn ghost" href="${link}">Ver la página de ${h(w.name.split(/\s+/)[0])}</a>` : ''}</div></section>`;
}

export function reviewSubmit(rv, body) {
  const v = RK.map((c) => parseInt(body[c.k], 10));
  if (v.some((x) => !(x >= 1 && x <= 5)) || !['0', '1'].includes(body.again)) return 'Califica las tres preguntas con estrellas y dinos si lo volverías a contratar.';
  const clean = (s, n) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
  const ok = run(`UPDATE reviews SET s_pun = ?, s_gar = ?, s_cal = ?, again = ?, comment = ?, client = ?, show_name = ?, status = 'recibido', answered_at = datetime('now')
    WHERE id = ? AND status = 'enviado'`, ...v, +body.again, String(body.comment ?? '').trim().slice(0, 600), clean(body.client, 80), body.show_name === '1' ? 1 : 0, rv.id);
  return ok.changes ? null : 'Este enlace ya se usó.';
}
export const reviewByCode = (code) => get(`SELECT * FROM reviews WHERE code = ?`, String(code).slice(0, 40));
export const isOpen = (rv) => rv.status === 'enviado' && rv.expires >= new Date().toISOString().slice(0, 10);

// ---- Panel ----
const ST = { enviado: ['Esperando respuesta', 'nuevo'], recibido: ['Por revisar', 'nuevo'], publicado: ['Publicada', 'confirmado'], oculto: ['Oculta', 'descartado'] };
export const pendingReviews = () => all(`SELECT r.worker_id, w.name, COUNT(*) n FROM reviews r JOIN workers w ON w.id = r.worker_id WHERE r.status = 'recibido' GROUP BY r.worker_id ORDER BY MIN(r.answered_at)`);

export function reviewsCard(req, w, { csrf, ic, base, fresh }) {
  const rs = all(`SELECT * FROM reviews WHERE worker_id = ? ORDER BY CASE status WHEN 'recibido' THEN 0 WHEN 'enviado' THEN 1 ELSE 2 END, id DESC`, w.id);
  const cs = clientScore(w.id), first = w.name.split(/\s+/)[0];
  const link = (r) => `${base}/opinar/${r.code}`;
  const wa = (r) => `https://wa.me/?text=${encodeURIComponent(`Hola${r.client ? ' ' + r.client : ''}, gracias por confiar en nosotros. ¿Nos ayudas calificando el trabajo de ${first}${r.job ? ` (${r.job})` : ''}? Toma menos de un minuto: ${link(r)}`)}`;
  const stars = (v, i = 0) => `<span class="w-stars" style="--f:${v * 20}%;--sc:#c9a24a;--i:${i}" role="img" aria-label="${num(v)} de 5"></span>`;
  return `<section class="card rise w-op" style="--i:2" id="opiniones"><header><h2>Opinión de clientes</h2>${cs ? `<span class="d-tag">${cs.n} publicadas</span>` : ''}</header>
    ${cs ? `<div class="w-op-sum"><span class="w-op-big"><b>${num(cs.v)}</b>${stars(cs.v)}<small>promedio de ${cs.n} ${cs.n === 1 ? 'cliente' : 'clientes'}</small></span>
      <span class="w-op-big"><b>${cs.again}%</b><small>lo volvería a contratar</small></span>
      <span class="w-op-crit">${cs.crit.map((c, i) => `<span style="--cc:${c.c}"><small>${h(c.t)}</small>${stars(c.v, i)}<b>${num(c.v)}</b></span>`).join('')}</span></div>` : ''}
    <form class="w-op-new" method="post" action="/admin/trabajadores/${w.id}/opinion">${csrf(req)}
      <ol class="w-op-how"><li>Escribe el trabajo que hizo.</li><li>Crea el enlace y envíalo al cliente por WhatsApp.</li><li>El cliente califica con estrellas y tú apruebas antes de publicar.</li></ol>
      <label>Trabajo realizado<input name="job" required maxlength="120" placeholder="Ej.: Tarrajeo de fachada, Av. Los Álamos"></label>
      <label>Cliente <small>opcional</small><input name="client" maxlength="80" placeholder="Nombre o empresa"></label>
      <button class="a-btn">${ic('plus')}Crear enlace para el cliente</button></form>
    ${rs.length ? `<ul class="w-op-list">${rs.map((r) => { const [t, p] = ST[r.status] || [r.status, 'nuevo'], open = r.status === 'enviado'; return `<li class="op-${r.status}${fresh === r.code ? ' fresh' : ''}">
      <span class="w-op-h"><b>${h(r.job || 'Trabajo sin detalle')}</b><small>${h(r.client || 'Cliente sin nombre')}${r.answered_at ? `, respondió el ${dmy(r.answered_at)}` : `, enlace creado el ${dmy(r.created_at)}, vence el ${dmy(r.expires)}`}</small></span>
      <span class="a-pill s-${p}">${t}</span>
      ${r.answered_at ? `<span class="w-op-s">${RK.map((c, i) => `<span><small>${h(c.t)}</small>${stars(r[c.k], i)}</span>`).join('')}<span><small>Volvería a contratarlo</small><b>${r.again ? 'Sí' : 'No'}</b></span></span>
        ${r.comment ? `<p class="w-op-c">${h(r.comment)}</p>` : ''}${r.client && !r.show_name ? '<p class="a-help">Pidió no mostrar su nombre: saldrá como «Cliente verificado».</p>' : ''}` : ''}
      ${open ? `<span class="w-op-link"><input readonly value="${h(link(r))}" aria-label="Enlace para el cliente" data-select><button type="button" class="a-btn ghost sm" data-copy="${h(link(r))}">${ic('pen')}Copiar</button><a class="a-btn sm" href="${h(wa(r))}" target="_blank" rel="noopener">${ic('ext')}Enviar por WhatsApp</a></span>` : ''}
      <span class="w-ev-a">${r.status === 'recibido' || r.status === 'oculto' ? `<form method="post" action="/admin/opiniones/${r.id}/publicar">${csrf(req)}<button class="a-btn sm">Publicar</button></form>` : ''}
        ${r.status === 'recibido' || r.status === 'publicado' ? `<form method="post" action="/admin/opiniones/${r.id}/ocultar">${csrf(req)}<button class="a-btn ghost sm">Ocultar</button></form>` : ''}
        ${open ? `<form method="post" action="/admin/opiniones/${r.id}/borrar">${csrf(req)}<button class="a-btn ghost sm" data-confirm="¿Anular este enlace? El cliente ya no podrá usarlo.">Anular enlace</button></form>` : ''}</span></li>`; }).join('')}</ul>`
      : `<p class="d-empty">Cuando termines un trabajo, crea un enlace y pídele al cliente su opinión. Las opiniones aprobadas salen en la página pública del equipo.</p>`}</section>`;
}

export function mountReviewsAdmin(r) {
  r.post('/trabajadores/:id/opinion', (req, res, next) => {
    const w = get('SELECT id, name FROM workers WHERE id = ?', req.params.id); if (!w) return next();
    const job = String(req.body.job || '').trim().slice(0, 120); if (!job) return res.redirect(`/admin/trabajadores/${w.id}#opiniones`);
    const code = crypto.randomBytes(12).toString('base64url'), exp = new Date(Date.now() + DAYS * 864e5).toISOString().slice(0, 10);
    run(`INSERT INTO reviews (code, worker_id, job, client, expires, created_by) VALUES (?,?,?,?,?,?)`, code, w.id, job, String(req.body.client || '').trim().slice(0, 80), exp, req.admin.username);
    audit(req.admin.username, 'create', 'reviews', w.id, job);
    res.redirect(`/admin/trabajadores/${w.id}?enlace=${code}#opiniones`);
  });
  r.post('/opiniones/:id/:act', (req, res, next) => {
    const rv = get('SELECT * FROM reviews WHERE id = ?', req.params.id), act = req.params.act;
    if (!rv || !['publicar', 'ocultar', 'borrar'].includes(act)) return next();
    if (act === 'borrar') { if (rv.status === 'enviado') run('DELETE FROM reviews WHERE id = ?', rv.id); }
    else run(`UPDATE reviews SET status = ?, decided_by = ? WHERE id = ? AND status <> 'enviado'`, act === 'publicar' ? 'publicado' : 'oculto', req.admin.username, rv.id);
    audit(req.admin.username, act, 'reviews', rv.worker_id, rv.job || '');
    res.redirect(`/admin/trabajadores/${rv.worker_id}#opiniones`);
  });
}
