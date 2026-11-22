// Página pública del equipo: calificaciones y reconocimientos de cada trabajador.
// Solo se publica lo aprobado por el administrador. Nunca teléfono, observaciones, bonos ni justificaciones.
import { all, get } from './db.js';
import { h } from './views.js';
import { CRITERIA, levelOf, isTrusted, rating, periodName, TRUST_RULE } from './method.js';

const HUES = ['#1a5f99', '#3d8a37', '#c9a24a', '#c2467a', '#2f86cc'];
const initials = (n) => String(n).trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
const num = (v) => String(v).replace('.', ',');
const slug = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const teamPath = (w) => `/equipo/${w.id}-${slug(w.name)}`;
const today = () => new Date(Date.now() - 5 * 36e5).toISOString().slice(0, 10);

const stars = (v, i = 0) => `<i class="tm-stars" style="--f:${(v || 0) * 20}%;--i:${i}" role="img" aria-label="${v ? num(v) + ' de 5' : 'sin calificar'}"></i>`;
const photo = (w, cls = 'tm-ph') => (w.photo ? `<img class="${cls}" src="${h(w.photo)}" alt="Foto de ${h(w.name)}" loading="lazy" decoding="async">`
  : `<span class="${cls}" style="--hue:${HUES[w.id % HUES.length]}" aria-hidden="true">${h(initials(w.name))}</span>`);
const ring = (score, lv, big = '') => `<span class="tm-ring${big}" style="--p:${score || 0};--lc:${levelOf(lv).c}"><svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="16" pathLength="100"/><circle cx="20" cy="20" r="16" pathLength="100"/></svg><b>${score == null ? '0' : Math.round(score)}</b><small>de 100</small></span>`;

function enrich(w) {
  const evs = all(`SELECT * FROM evaluations WHERE worker_id = ? AND status = 'aprobado' ORDER BY period DESC`, w.id);
  return { ...w, evs, last: evs[0] || null, rt: rating(evs), trusted: isTrusted(evs) };
}
const PUBLIC = `SELECT w.id, w.name, w.trade, w.zone, w.photo, w.joined, w.company_id, co.name AS company FROM workers w LEFT JOIN companies co ON co.id = w.company_id
  WHERE w.status <> 'inactivo' AND COALESCE(w.public, 1) = 1`;
export function publicTeam() {
  return all(PUBLIC + ' ORDER BY w.name').map(enrich).sort((a, b) => (b.last?.score ?? -1) - (a.last?.score ?? -1) || a.name.localeCompare(b.name));
}
export const publicWorker = (id) => { const w = get(PUBLIC + ' AND w.id = ?', id); return w ? enrich(w) : null; };

const rateList = (rt, cls = '') => (rt ? `<ul class="tm-rate${cls}">${rt.map((r, i) => `<li style="--cc:${r.c}"><span>${h(r.t)}</span>${stars(r.v, i)}<b>${r.v ? num(r.v) : '<small>sin nota</small>'}</b></li>`).join('')}</ul>` : '<p class="tm-none">Aún sin calificación aprobada.</p>');

// Tarjetas del equipo (bloque del diseñador).
export function teamGrid(d) {
  const ws = publicTeam().filter((w) => d.show_unrated !== false || w.last);
  if (!ws.length) return `<section class="wrap tm"><p class="tm-none">Pronto publicaremos a nuestro equipo.</p></section>`;
  const trades = [...new Set(ws.map((w) => w.trade).filter(Boolean))];
  return `<section class="wrap tm" data-team>${d.title ? `<h2 class="reveal">${h(d.title)}</h2>` : ''}
  ${trades.length > 1 ? `<div class="tm-chips" role="group" aria-label="Filtrar por oficio"><button type="button" aria-pressed="true" data-trade="">Todos <small>${ws.length}</small></button>${trades.map((t) => `<button type="button" aria-pressed="false" data-trade="${h(t)}">${h(t)} <small>${ws.filter((w) => w.trade === t).length}</small></button>`).join('')}</div>` : ''}
  <div class="tm-grid">${ws.map((w, i) => `<a class="tm-card" href="${teamPath(w)}" data-trade="${h(w.trade || '')}" style="--i:${Math.min(i, 10)}">
    <span class="tm-top">${photo(w)}<span class="tm-who"><b>${h(w.name)}</b><small>${h(w.trade || 'Equipo de obra')}</small>
      <span class="tm-tags">${w.last ? `<span class="tm-lv lv-${levelOf(w.last.level).k}">${h(levelOf(w.last.level).t)}</span>` : ''}${w.trusted ? '<span class="tm-trust">De confianza</span>' : ''}</span></span>${w.last ? ring(w.last.score, w.last.level) : ''}</span>
    ${rateList(w.rt)}
    <span class="tm-more">Ver su historial</span></a>`).join('')}</div></section>`;
}

// Cómo se califica (bloque del diseñador).
export function teamMethod(d) {
  return `<section class="wrap tm-method" id="como-calificamos"><div class="tm-mh reveal">${d.title ? `<h2>${h(d.title)}</h2>` : ''}${d.text ? `<p>${h(d.text)}</p>` : ''}</div>
  <ol class="tm-crit">${CRITERIA.map((c, i) => `<li style="--cc:${c.c};--w:${c.w};--i:${i}"><span class="tm-cw"><b>${c.w}</b>%</span><span><b>${h(c.t)}</b><small>${h(c.d)}</small></span><i aria-hidden="true"></i></li>`).join('')}</ol>
  <p class="tm-note">Niveles: Oro desde 90 puntos, Plata desde 80 y Bronce desde 70. ${h(TRUST_RULE.replace('Tres', 'Trabajador de confianza: tres'))}</p></section>`;
}

// Ficha pública de un trabajador.
export function teamProfile(w) {
  const certs = all(`SELECT code, title, issued_at FROM certificates WHERE worker_id = ? AND revoked_at IS NULL ORDER BY id DESC`, w.id);
  const badge = get(`SELECT expires FROM badges WHERE worker_id = ? AND revoked_at IS NULL AND expires >= ? ORDER BY id DESC`, w.id, today());
  const hist = w.evs.slice(0, 12).reverse(), last = w.last, lv = last ? levelOf(last.level) : null;
  return `<article class="wrap tm-prof"><nav class="crumbs"><a href="/equipo">Equipo</a> / ${h(w.name)}</nav>
  <header class="tm-hero">${photo(w, 'tm-ph big')}<div class="tm-hero-tx"><h1>${h(w.name)}</h1>
    <p>${h([w.trade, w.zone].filter(Boolean).join(', ') || 'Equipo de obra')}${w.company ? `. Trabaja con ${h(w.company.replace(/\.$/, ''))}` : ''}${w.joined ? ` desde ${h(periodName(w.joined.slice(0, 7)))}` : ''}.</p>
    <span class="tm-tags">${lv ? `<span class="tm-lv lv-${lv.k}">${h(lv.t)}: ${h(lv.name)}</span>` : ''}${w.trusted ? '<span class="tm-trust">Trabajador de confianza</span>' : ''}${badge ? '<span class="tm-ok">Carné vigente</span>' : ''}</span></div>
    ${last ? ring(last.score, last.level, ' big') : ''}</header>
  <section class="tm-sec"><h2>Calificación</h2>${rateList(w.rt, ' big')}${w.rt ? '<p class="tm-note">Promedio de sus últimas evaluaciones mensuales aprobadas.</p>' : ''}</section>
  ${last ? `<div class="tm-two"><section class="tm-sec"><h2>Evaluación de ${h(periodName(last.period))}</h2><ul class="tm-bars">${CRITERIA.map((c, i) => `<li style="--cc:${c.c};--v:${(last[c.k] || 0) * 20};--i:${i}"><span>${h(c.t)}</span><i><i></i></i><b>${last[c.k] ? last[c.k] + ' de 5' : 'sin nota'}</b></li>`).join('')}</ul></section>
  <section class="tm-sec"><h2>Puntaje mes a mes</h2><div class="tm-hist">${hist.map((e, i) => `<span style="--h:${Math.max(4, e.score)};--i:${i};--lc:${levelOf(e.level).c}" title="${h(periodName(e.period))}: ${Math.round(e.score)} puntos"><b>${Math.round(e.score)}</b><i></i><small>${h(periodName(e.period).slice(0, 3))} ${h(e.period.slice(2, 4))}</small></span>`).join('')}</div></section></div>` : ''}
  ${certs.length ? `<section class="tm-sec"><h2>Certificados</h2><ul class="tm-certs">${certs.map((c, i) => `<li style="--i:${i}"><span><b>${h(c.title)}</b><small>Emitido el ${h(c.issued_at.slice(0, 10).split('-').reverse().join('/'))}</small></span><a class="link" href="/verificar/${h(c.code)}">Verificar</a></li>`).join('')}</ul></section>` : ''}
  <p class="tm-note"><a class="link" href="/equipo#como-calificamos">Cómo calificamos</a></p></article>`;
}
