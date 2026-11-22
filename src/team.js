// Página pública del equipo: calificaciones y reconocimientos de cada trabajador.
// Solo se publica lo aprobado por el administrador. Nunca teléfono, observaciones, bonos ni justificaciones.
import { all, get } from './db.js';
import { h, mi } from './views.js';
import { CRITERIA, levelOf, isTrusted, rating, periodName, TRUST_RULE } from './method.js';

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
  return { ...w, evs, last: evs[0] || null, rt: rating(evs), trusted: isTrusted(evs) };
}
const PUBLIC = `SELECT w.id, w.name, w.trade, w.zone, w.photo, w.joined, w.company_id, co.name AS company, co.logo AS logo FROM workers w LEFT JOIN companies co ON co.id = w.company_id
  WHERE w.status <> 'inactivo' AND COALESCE(w.public, 1) = 1`;
export function publicTeam() {
  return all(PUBLIC + ' ORDER BY w.name').map(enrich).sort((a, b) => (b.last?.score ?? -1) - (a.last?.score ?? -1) || a.name.localeCompare(b.name));
}
export const publicWorker = (id) => { const w = get(PUBLIC + ' AND w.id = ?', id); return w ? enrich(w) : null; };

const rateList = (rt, cls = '') => (rt ? `<ul class="tm-rate${cls}">${rt.map((r, i) => `<li style="--cc:${r.c}"><span>${h(r.t)}</span>${stars(r.v, i)}<b>${r.v ? num(r.v) : '<small>sin nota</small>'}</b></li>`).join('')}</ul>`
  : '<p class="tm-none">Aún sin calificación aprobada.</p>');

// Portada: título, cifras reales del equipo y un abanico 3D con las fotos de los mejores puntajes.
export function teamHead(d) {
  const ws = publicTeam(), rated = ws.filter((w) => w.last), top = ws.slice(0, 3);
  const per = rated.length ? rated.map((w) => w.last.period).sort().at(-1) : null, ofPer = rated.filter((w) => w.last.period === per);
  const avg = ofPer.length ? Math.round(ofPer.reduce((t, w) => t + w.last.score, 0) / ofPer.length) : null;
  const certs = ws.length ? get(`SELECT COUNT(*) n FROM certificates WHERE revoked_at IS NULL AND worker_id IN (${ws.map((w) => +w.id).join(',')})`).n : 0;
  const stats = [[ws.length, ws.length === 1 ? 'persona en el equipo' : 'personas en el equipo'], avg != null && [avg, `puntaje promedio de ${periodName(per)}`], certs && [certs, certs === 1 ? 'certificado vigente' : 'certificados vigentes']].filter(Boolean);
  return `<section class="wrap tm-head"><div class="tm-head-tx"><h1 class="rise">${mi(d.title)}</h1>${d.lead ? `<div class="lead rise">${md(d.lead)}</div>` : ''}
    ${ws.length ? `<dl class="tm-stats">${stats.map(([v, l], i) => `<div style="--i:${i}"><dt>${h(l)}</dt><dd data-count="${v}">${v}</dd></div>`).join('')}</dl>` : ''}</div>
  ${top.length && d.show_deck !== false ? `<div class="tm-deck n${top.length}" aria-hidden="true">${top.map((w, i) => `<a class="tm-dk" href="${teamPath(w)}" tabindex="-1" style="--k:${i};--lc:${lvColor(w)}"><span class="tm-dk-pic">${photo(w, i === 0)}</span>
    <span class="tm-dk-tx"><b>${h(w.name.split(' ').slice(0, 2).join(' '))}</b>${w.last ? `<small>${Math.round(w.last.score)} puntos</small>` : `<small>${h(w.trade || '')}</small>`}</span></a>`).join('')}</div>` : ''}</section>`;
}

// Tarjetas del equipo: foto grande, puntaje que sobresale en 3D y estrellas.
export function teamGrid(d) {
  const ws = publicTeam().filter((w) => d.show_unrated !== false || w.last);
  if (!ws.length) return `<section class="wrap tm"><p class="tm-none">Pronto publicaremos a nuestro equipo.</p></section>`;
  const trades = [...new Set(ws.map((w) => w.trade).filter(Boolean))];
  return `<section class="wrap tm" data-team>${d.title ? `<h2 class="reveal">${h(d.title)}</h2>` : ''}
  ${trades.length > 1 ? `<div class="tm-chips" role="group" aria-label="Filtrar por oficio"><button type="button" aria-pressed="true" data-trade="">Todos <small>${ws.length}</small></button>${trades.map((t) => `<button type="button" aria-pressed="false" data-trade="${h(t)}">${h(t)} <small>${ws.filter((w) => w.trade === t).length}</small></button>`).join('')}</div>` : ''}
  <div class="tm-grid">${ws.map((w, i) => { const lv = w.last ? levelOf(w.last.level) : null; return `<div class="tm-cell" data-trade="${h(w.trade || '')}" style="--i:${Math.min(i, 8)}"><a class="tm-card" href="${teamPath(w)}" data-tilt style="--lc:${lvColor(w)}">
    <span class="tm-pic">${photo(w)}${lv ? `<span class="tm-lvb lv-${lv.k}">${h(lv.t)}</span>` : ''}</span>
    ${w.last ? ring(w.last.score, w.last.level, ' pop') : ''}
    <span class="tm-body"><b class="tm-name">${h(w.name)}</b><small class="tm-job">${h([w.trade, w.zone].filter(Boolean).join(', ') || 'Equipo de obra')}</small>
      ${w.trusted ? '<span class="tm-trust">Trabajador de confianza</span>' : ''}${rateList(w.rt)}<span class="tm-more">Ver su historial</span></span>
    <span class="tm-glare" aria-hidden="true"></span></a></div>`; }).join('')}</div></section>`;
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
  const facts = [[w.evs.length, w.evs.length === 1 ? 'mes evaluado' : 'meses evaluados'], [certs.length, certs.length === 1 ? 'certificado' : 'certificados']];
  return `<article class="wrap tm-prof" style="--lc:${lvColor(w)}"><nav class="crumbs"><a href="/equipo">Equipo</a> / ${h(w.name)}</nav>
  <header class="tm-hero">
    <div class="tm-cred-wrap"><button type="button" class="tm-cred" data-tilt data-flip aria-label="Girar la credencial de ${h(w.name)}">
      <span class="tm-face tm-front"><span class="tm-pic">${photo(w, true)}${lv ? `<span class="tm-lvb lv-${lv.k}">${h(lv.t)}</span>` : ''}</span>
        <span class="tm-cred-tx"><b>${h(w.name)}</b><small>${h(w.trade || 'Equipo de obra')}</small></span>
        <span class="tm-cred-co">${w.logo ? `<img src="${h(w.logo)}" alt="">` : ''}${h(w.company || '')}</span></span>
      <span class="tm-face tm-back"><b>Calificación</b>${last ? ring(last.score, last.level, ' mid') : ''}${rateList(w.rt)}<small>Toca para volver</small></span>
      <span class="tm-glare" aria-hidden="true"></span></button><p class="tm-hint">Toca la credencial para girarla</p></div>
    <div class="tm-hero-tx"><h1>${h(w.name)}</h1>
      <p>${h([w.trade, w.zone].filter(Boolean).join(', ') || 'Equipo de obra')}${w.company ? `. Trabaja con ${h(w.company.replace(/\.$/, ''))}` : ''}${w.joined ? ` desde ${h(periodName(w.joined.slice(0, 7)))}` : ''}.</p>
      <span class="tm-tags">${lv ? `<span class="tm-lvb lv-${lv.k} flat">${h(lv.t)}: ${h(lv.name)}</span>` : ''}${w.trusted ? '<span class="tm-trust">Trabajador de confianza</span>' : ''}${badge ? '<span class="tm-ok">Carné vigente</span>' : ''}</span>
      <div class="tm-facts">${last ? ring(last.score, last.level, ' big') : ''}${facts.map(([v, l]) => `<span><b data-count="${v}">${v}</b><small>${l}</small></span>`).join('')}</div></div></header>
  <section class="tm-sec tm-cell" style="--i:0"><h2>Calificación</h2>${rateList(w.rt, ' big')}${w.rt ? '<p class="tm-note">Promedio de sus últimas evaluaciones mensuales aprobadas.</p>' : ''}</section>
  ${last ? `<div class="tm-two"><section class="tm-sec tm-cell" style="--i:1"><h2>Evaluación de ${h(periodName(last.period))}</h2><ul class="tm-bars">${CRITERIA.map((c, i) => `<li style="--cc:${c.c};--v:${(last[c.k] || 0) * 20};--i:${i}"><span>${h(c.t)}</span><i><i></i></i><b>${last[c.k] ? last[c.k] + ' de 5' : 'sin nota'}</b></li>`).join('')}</ul></section>
  <section class="tm-sec tm-cell" style="--i:2"><h2>Puntaje mes a mes</h2><div class="tm-hist">${hist.map((e, i) => `<span style="--h:${Math.max(4, e.score)};--i:${i};--lc:${levelOf(e.level).c}" title="${h(periodName(e.period))}: ${Math.round(e.score)} puntos"><b>${Math.round(e.score)}</b><i></i><small>${h(periodName(e.period).slice(0, 3))} ${h(e.period.slice(2, 4))}</small></span>`).join('')}</div></section></div>` : ''}
  ${certs.length ? `<section class="tm-sec tm-cell" style="--i:3"><h2>Certificados</h2><ul class="tm-certs">${certs.map((c, i) => `<li style="--i:${i}"><span><b>${h(c.title)}</b><small>Emitido el ${h(c.issued_at.slice(0, 10).split('-').reverse().join('/'))}</small></span><a class="link" href="/verificar/${h(c.code)}">Verificar</a></li>`).join('')}</ul></section>` : ''}
  <p class="tm-note"><a class="link" href="/equipo#como-calificamos">Cómo calificamos</a></p></article>`;
}
