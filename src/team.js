// Página pública del equipo: calificaciones y reconocimientos de cada trabajador.
// Solo se publica lo aprobado por el administrador. Nunca teléfono, observaciones, bonos ni justificaciones.
import { all, get } from './db.js';
import { h, mi } from './views.js';
import { CRITERIA, levelOf, isTrusted, rating, periodName, TRUST_RULE } from './method.js';
import { clientScore, clientReviews, clientTotals, reviewWho, RK } from './reviews.js';

const HUES = ['#1a5f99', '#3d8a37', '#c9a24a', '#c2467a', '#2f86cc'];
const initials = (n) => String(n).trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
const num = (v) => String(v).replace('.', ',');
const slug = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const teamPath = (w) => `/equipo/${w.id}-${slug(w.name)}`;
const today = () => new Date(Date.now() - 5 * 36e5).toISOString().slice(0, 10);
const md = (t) => String(t || '').trim().split(/\n\s*\n/).filter(Boolean).map((p) => `<p>${mi(p)}</p>`).join('');

const stars = (v, i = 0) => `<i class="tm-stars" style="--f:${(v || 0) * 20}%;--i:${i}" role="img" aria-label="${v ? num(v) + ' de 5' : 'sin calificar'}"></i>`;
const photo = (w, eager = false) => (w.photo ? `<img src="${h(w.photo)}" alt="Foto de ${h(w.name)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`
  : `<span class="tm-ini" style="--hue:${HUES[w.id % HUES.length]}" aria-hidden="true">${h(initials(w.name))}</span>`);
const ring = (score, lv, cls = '') => `<span class="tm-ring${cls}" style="--p:${score || 0};--lc:${levelOf(lv).c}"><svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="16" pathLength="100"/><circle cx="20" cy="20" r="16" pathLength="100"/></svg><b>${Math.round(score || 0)}</b><small>de 100</small></span>`;
const lvColor = (w) => (w.last ? levelOf(w.last.level).c : '#5d6874');

function enrich(w) {
  const evs = all(`SELECT * FROM evaluations WHERE worker_id = ? AND status = 'aprobado' ORDER BY period DESC`, w.id);
  return { ...w, evs, last: evs[0] || null, rt: rating(evs), trusted: isTrusted(evs), cs: clientScore(w.id) };
}
const PUBLIC = `SELECT w.id, w.name, w.trade, w.zone, w.photo, w.joined, w.company_id, co.name AS company, co.logo AS logo FROM workers w LEFT JOIN companies co ON co.id = w.company_id
  WHERE w.status <> 'inactivo' AND COALESCE(w.public, 1) = 1`;
export function publicTeam() {
  return all(PUBLIC + ' ORDER BY w.name').map(enrich).sort((a, b) => (b.last?.score ?? -1) - (a.last?.score ?? -1) || a.name.localeCompare(b.name));
}
export const publicWorker = (id) => { const w = get(PUBLIC + ' AND w.id = ?', id); return w ? enrich(w) : null; };

const rateList = (rt, cls = '') => (rt ? `<ul class="tm-rate${cls}">${rt.map((r, i) => `<li style="--cc:${r.c}"><span>${h(r.t)}</span>${stars(r.v, i)}<b>${r.v ? num(r.v) : '<small>sin nota</small>'}</b></li>`).join('')}</ul>`
  : '<p class="tm-none">Aún sin calificación aprobada.</p>');

const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const plural = (n, a, b) => `${n} ${n === 1 ? a : b}`;
const cliPill = (cs) => (cs ? `<span class="tm-cli"><span class="tm-cli-v"><small>Clientes</small><b>${num(cs.v)}</b>${stars(cs.v, 3)}</span><small>${plural(cs.n, 'opinión', 'opiniones')} de clientes. ${cs.again}% lo volvería a contratar</small></span>`
  : '<span class="tm-cli none"><small>Aún sin opiniones de clientes</small></span>');
const pctRing = (p) => `<span class="tm-ring mid tm-again" style="--p:${p};--lc:#3d8a37"><svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="16" pathLength="100"/><circle cx="20" cy="20" r="16" pathLength="100"/></svg><b>${p}%</b></span>`;

// Opinión de clientes: promedio, reparto por estrellas que filtra la lista y cada opinión aprobada.
function clientSec(w) {
  const cs = w.cs;
  if (!cs) return `<section class="tm-sec tm-cell" id="opiniones" style="--i:1"><h2>Opinión de clientes</h2><p class="tm-none">Todavía no hay opiniones de clientes publicadas.</p></section>`;
  const rs = clientReviews(w.id);
  return `<section class="tm-sec tm-cell tm-cl" id="opiniones" style="--i:1" data-cl><h2>Opinión de clientes</h2>
  <div class="tm-cl-top"><div class="tm-cl-big"><b>${num(cs.v)}</b>${stars(cs.v, 1)}<small>de 5, ${plural(cs.n, 'opinión', 'opiniones')}</small></div>
    <div class="tm-cl-dist" role="group" aria-label="Mostrar opiniones por estrellas">${cs.dist.map((d, i) => `<button type="button" data-stars="${d.s}" aria-pressed="false" ${d.n ? '' : 'disabled'} style="--w:${Math.round((d.n / cs.n) * 100)}%;--i:${i}"><span>${d.s}</span><i class="tm-st1" aria-hidden="true"></i><span class="tm-cl-bar"><i></i></span><small>${d.n}</small><span class="sr"> opiniones de ${d.s} estrellas</span></button>`).join('')}</div>
    <div class="tm-cl-again">${pctRing(cs.again)}<small>lo volvería a contratar</small></div></div>
  ${rateList(cs.crit, ' big')}
  <p class="tm-cl-filter" data-cl-out aria-live="polite" hidden></p>
  <ul class="tm-revs">${rs.map((r, i) => { const v = Math.round(((r.s_pun + r.s_gar + r.s_cal) / 3) * 10) / 10, who = reviewWho(r); return `<li data-s="${Math.round(v)}" style="--i:${i % 4}" ${i >= 4 ? 'data-extra hidden' : ''}>
    <header><span class="tm-rv-av" aria-hidden="true">${h(who[0].toUpperCase())}</span><span><b>${h(who)}</b><small>${h([r.job, periodName(String(r.answered_at).slice(0, 7))].filter(Boolean).join(', '))}</small>${stars(v, 0)}</span></header>
    ${r.comment ? `<p>${h(r.comment)}</p>` : ''}
    <span class="tm-rv-c">${RK.map((c) => `<span style="--cc:${c.c}">${h(c.t)} <b>${r[c.k]}</b></span>`).join('')}${r.again ? '<span class="tm-rv-yes">Lo volvería a contratar</span>' : ''}</span></li>`; }).join('')}</ul>
  ${rs.length > 4 ? `<button type="button" class="btn ghost sm tm-revs-more" data-more>Ver las ${rs.length} opiniones</button>` : ''}
  <p class="tm-note">Cada cliente califica con un enlace único que recibe al terminar el trabajo. Revisamos cada opinión antes de publicarla.</p></section>`;
}

// Portada: título, cifras reales del equipo y un abanico 3D con las fotos de los mejores puntajes.
export function teamHead(d) {
  const ws = publicTeam(), rated = ws.filter((w) => w.last), top = ws.slice(0, 3);
  const per = rated.length ? rated.map((w) => w.last.period).sort().at(-1) : null, ofPer = rated.filter((w) => w.last.period === per);
  const avg = ofPer.length ? Math.round(ofPer.reduce((t, w) => t + w.last.score, 0) / ofPer.length) : null;
  const certs = ws.length ? get(`SELECT COUNT(*) n FROM certificates WHERE revoked_at IS NULL AND worker_id IN (${ws.map((w) => +w.id).join(',')})`).n : 0;
  const cli = clientTotals(ws.map((w) => w.id));
  const stats = [[ws.length, ws.length === 1 ? 'persona en el equipo' : 'personas en el equipo'], avg != null && [avg, `puntaje promedio de ${periodName(per)}`],
    cli && [cli.again, `de ${cli.n} ${cli.n === 1 ? 'cliente volvería' : 'clientes volvería'} a contratarlos`, '%'], certs && [certs, certs === 1 ? 'certificado vigente' : 'certificados vigentes']].filter(Boolean);
  return `<section class="wrap tm-head"><div class="tm-head-tx"><h1 class="rise">${mi(d.title)}</h1>${d.lead ? `<div class="lead rise">${md(d.lead)}</div>` : ''}
    ${ws.length ? `<dl class="tm-stats">${stats.map(([v, l, suf = ''], i) => `<div style="--i:${i}"><dt>${h(l)}</dt><dd data-count="${v}" ${suf ? `data-suf="${suf}"` : ''}>${v}${suf}</dd></div>`).join('')}</dl>` : ''}</div>
  ${top.length && d.show_deck !== false ? `<div class="tm-deck n${top.length}" aria-hidden="true">${top.map((w, i) => `<a class="tm-dk" href="${teamPath(w)}" tabindex="-1" style="--k:${i};--lc:${lvColor(w)}"><span class="tm-dk-pic">${photo(w, i === 0)}</span>
    <span class="tm-dk-tx"><b>${h(w.name.split(' ').slice(0, 2).join(' '))}</b>${w.last ? `<small>${Math.round(w.last.score)} puntos</small>` : `<small>${h(w.trade || '')}</small>`}</span></a>`).join('')}</div>` : ''}</section>`;
}

// Tarjetas del equipo: foto grande, puntaje que sobresale en 3D y estrellas.
export function teamGrid(d) {
  const ws = publicTeam().filter((w) => d.show_unrated !== false || w.last);
  if (!ws.length) return `<section class="wrap tm"><p class="tm-none">Pronto publicaremos a nuestro equipo.</p></section>`;
  const trades = [...new Set(ws.map((w) => w.trade).filter(Boolean))];
  return `<section class="wrap tm" data-team>${d.title ? `<h2 class="reveal">${h(d.title)}</h2>` : ''}
  ${ws.length > 1 ? `<div class="tm-tools"><label class="tm-q"><span class="sr">Buscar en el equipo</span><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg><input type="search" placeholder="Buscar por nombre, oficio o zona" data-q autocomplete="off"></label>
    <div class="tm-sort" role="group" aria-label="Ordenar el equipo"><span>Ordenar por</span>${[['score', 'Puntaje'], ['cli', 'Clientes'], ['name', 'Nombre']].map(([k, t], i) => `<button type="button" data-sort="${k}" aria-pressed="${!i}">${t}</button>`).join('')}<i class="tm-sort-pill" aria-hidden="true"></i></div></div>` : ''}
  ${trades.length > 1 ? `<div class="tm-chips" role="group" aria-label="Filtrar por oficio"><button type="button" aria-pressed="true" data-trade="">Todos <small>${ws.length}</small></button>${trades.map((t) => `<button type="button" aria-pressed="false" data-trade="${h(t)}">${h(t)} <small>${ws.filter((w) => w.trade === t).length}</small></button>`).join('')}</div>` : ''}
  <p class="tm-count" data-shown aria-live="polite"></p>
  <div class="tm-grid">${ws.map((w, i) => { const lv = w.last ? levelOf(w.last.level) : null; return `<div class="tm-cell" data-trade="${h(w.trade || '')}" data-q="${h(norm([w.name, w.trade, w.zone].join(' ')))}" data-name="${h(norm(w.name))}" data-score="${w.last?.score ?? -1}" data-cli="${w.cs ? w.cs.v * 1000 + w.cs.n : -1}" style="--i:${Math.min(i, 8)}"><a class="tm-card" href="${teamPath(w)}" data-tilt style="--lc:${lvColor(w)}">
    <span class="tm-pic">${photo(w)}${lv ? `<span class="tm-lvb lv-${lv.k}">${h(lv.t)}</span>` : ''}</span>
    ${w.last ? ring(w.last.score, w.last.level, ' pop') : ''}
    <span class="tm-body"><b class="tm-name">${h(w.name)}</b><small class="tm-job">${h([w.trade, w.zone].filter(Boolean).join(', ') || 'Equipo de obra')}</small>
      ${w.trusted ? '<span class="tm-trust">Trabajador de confianza</span>' : ''}${rateList(w.rt)}${cliPill(w.cs)}<span class="tm-more">Ver su historial</span></span>
    <span class="tm-glare" aria-hidden="true"></span></a></div>`; }).join('')}</div>
  <p class="tm-none tm-nomatch" data-empty hidden>Nadie coincide con tu búsqueda. <button type="button" class="link" data-clear>Ver a todo el equipo</button></p></section>`;
}

// Cómo se califica.
export function teamMethod(d) {
  return `<section class="wrap tm-method" id="como-calificamos"><div class="tm-mh reveal">${d.title ? `<h2>${h(d.title)}</h2>` : ''}${d.text ? `<p>${h(d.text)}</p>` : ''}</div>
  <ol class="tm-crit">${CRITERIA.map((c, i) => `<li class="tm-cell" style="--cc:${c.c};--w:${c.w};--i:${i}"><span class="tm-cw"><b data-count="${c.w}" data-suf="%">${c.w}%</b></span><span><b>${h(c.t)}</b><small>${h(c.d)}</small></span><i aria-hidden="true"></i></li>`).join('')}</ol>
  <p class="tm-note">Niveles: Oro desde 90 puntos, Plata desde 80 y Bronce desde 70. ${h(TRUST_RULE.replace('Tres', 'Trabajador de confianza: tres'))}</p></section>`;
}

// Ficha pública: credencial 3D que gira, cifras y evaluaciones.
export function teamProfile(w) {
  const certs = all(`SELECT code, title, issued_at FROM certificates WHERE worker_id = ? AND revoked_at IS NULL ORDER BY id DESC`, w.id);
  const badge = get(`SELECT expires FROM badges WHERE worker_id = ? AND revoked_at IS NULL AND expires >= ? ORDER BY id DESC`, w.id, today());
  const hist = w.evs.slice(0, 12).reverse(), last = w.last, lv = last ? levelOf(last.level) : null;
  const facts = [[w.evs.length, w.evs.length === 1 ? 'mes evaluado' : 'meses evaluados'], w.cs && [w.cs.n, w.cs.n === 1 ? 'opinión de cliente' : 'opiniones de clientes'], [certs.length, certs.length === 1 ? 'certificado' : 'certificados']].filter(Boolean);
  return `<article class="wrap tm-prof" style="--lc:${lvColor(w)}"><nav class="crumbs"><a href="/equipo">Equipo</a> / ${h(w.name)}</nav>
  <header class="tm-hero">
    <div class="tm-cred-wrap"><button type="button" class="tm-cred" data-tilt data-flip aria-label="Girar la credencial de ${h(w.name)}">
      <span class="tm-face tm-front"><span class="tm-pic">${photo(w, true)}${lv ? `<span class="tm-lvb lv-${lv.k}">${h(lv.t)}</span>` : ''}</span>
        <span class="tm-cred-tx"><b>${h(w.name)}</b><small>${h(w.trade || 'Equipo de obra')}</small></span>
        <span class="tm-cred-co">${w.logo ? `<img src="${h(w.logo)}" alt="">` : ''}${h(w.company || '')}</span></span>
      <span class="tm-face tm-back"><b>Calificación</b>${last ? ring(last.score, last.level, ' mid') : ''}${rateList(w.rt)}${cliPill(w.cs)}<small>Toca para volver</small></span>
      <span class="tm-glare" aria-hidden="true"></span></button><p class="tm-hint">Toca la credencial para girarla</p></div>
    <div class="tm-hero-tx"><h1>${h(w.name)}</h1>
      <p>${h([w.trade, w.zone].filter(Boolean).join(', ') || 'Equipo de obra')}${w.company ? `. Trabaja con ${h(w.company.replace(/\.$/, ''))}` : ''}${w.joined ? ` desde ${h(periodName(w.joined.slice(0, 7)))}` : ''}.</p>
      <span class="tm-tags">${lv ? `<span class="tm-lvb lv-${lv.k} flat">${h(lv.t)}: ${h(lv.name)}</span>` : ''}${w.trusted ? '<span class="tm-trust">Trabajador de confianza</span>' : ''}${badge ? '<span class="tm-ok">Carné vigente</span>' : ''}</span>
      <div class="tm-facts">${last ? ring(last.score, last.level, ' big') : ''}${facts.map(([v, l]) => `<span><b data-count="${v}">${v}</b><small>${l}</small></span>`).join('')}</div></div></header>
  <section class="tm-sec tm-cell" style="--i:0"><h2>Calificación</h2>${rateList(w.rt, ' big')}${w.rt ? '<p class="tm-note">Promedio de sus últimas evaluaciones mensuales aprobadas.</p>' : ''}</section>
  ${clientSec(w)}
  ${last ? `<div class="tm-two"><section class="tm-sec tm-cell" style="--i:1"><h2>Evaluación de ${h(periodName(last.period))}</h2><ul class="tm-bars">${CRITERIA.map((c, i) => `<li style="--cc:${c.c};--v:${(last[c.k] || 0) * 20};--i:${i}"><span>${h(c.t)}</span><i><i></i></i><b>${last[c.k] ? last[c.k] + ' de 5' : 'sin nota'}</b></li>`).join('')}</ul></section>
  <section class="tm-sec tm-cell" style="--i:2"><h2>Puntaje mes a mes</h2><div class="tm-hist">${hist.map((e, i) => `<span style="--h:${Math.max(4, e.score)};--i:${i};--lc:${levelOf(e.level).c}" title="${h(periodName(e.period))}: ${Math.round(e.score)} puntos"><b>${Math.round(e.score)}</b><i></i><small>${h(periodName(e.period).slice(0, 3))} ${h(e.period.slice(2, 4))}</small></span>`).join('')}</div></section></div>` : ''}
  ${certs.length ? `<section class="tm-sec tm-cell" style="--i:3"><h2>Certificados</h2><ul class="tm-certs">${certs.map((c, i) => `<li style="--i:${i}"><span><b>${h(c.title)}</b><small>Emitido el ${h(c.issued_at.slice(0, 10).split('-').reverse().join('/'))}</small></span><a class="link" href="/verificar/${h(c.code)}">Verificar</a></li>`).join('')}</ul></section>` : ''}
  <p class="tm-note"><a class="link" href="/equipo#como-calificamos">Cómo calificamos</a></p></article>`;
}
