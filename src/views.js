// Plantillas públicas (HTML renderizado en servidor).
import fs from 'node:fs';
export const h = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const money = (c) => (c == null ? 'Consultar' : 'S/ ' + (c / 100).toFixed(2));
export const lines = (t) => String(t || '').split('\n').map((s) => s.trim()).filter(Boolean);
export const wa = (num, text) => `https://wa.me/${h(num)}?text=${encodeURIComponent(text)}`;

// Enlaces seguros y texto con formato sencillo: **negrita**, *cursiva*, [texto](enlace) y saltos de línea.
export const safeUrl = (u) => {
  const v = String(u || '').trim();
  return /^(\/(?!\/)|#|https:\/\/|http:\/\/|mailto:|tel:)/i.test(v) ? v : v ? '#' : '';
};
export const mi = (t) => h(t)
  .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, a, u) => `<a href="${h(safeUrl(u.replace(/&amp;/g, '&')))}">${a}</a>`)
  .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>').replace(/\n/g, '<br>');
// El menú lo arma el diseñador de páginas (server.js lo conecta con setNav).
let navFn = () => [['/servicios', 'Servicios', 'tools'], ['/tienda', 'Tienda', 'bag'], ['/portafolio', 'Portafolio', 'user'], ['/contacto', 'Contacto', 'mail']];
export const setNav = (fn) => { navFn = fn; };
export const PAGE_ICONS = {
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>', tools: '<path d="M4 20V8l8-5 8 5v12H4Z"/><path d="M9 20v-7h6v7M4 10h16"/>',
  bag: '<path d="M4 9h16l-1 12H5L4 9ZM8 10V7a4 4 0 0 1 8 0v3"/>', mail: '<path d="M4 5h16v14H4zM4 6l8 7 8-7"/>', user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  doc: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h5"/>', star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 17-5-5-9 8"/>', info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  leaf: '<path d="M5 19c0-9 6-14 15-14 0 9-5 15-14 15"/><path d="M5 19 14 10"/>', shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/>',
};
export const ICON = {
  wa: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.3c0-.1-.2-.2-.5-.3Z"/></svg>',
  cart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" d="M3 4h2.2l2.1 10.3a1.5 1.5 0 0 0 1.5 1.2h8.4a1.5 1.5 0 0 0 1.4-1.1L20.5 8H6.1"/><circle cx="9.5" cy="19.5" r="1.4" fill="currentColor"/><circle cx="17" cy="19.5" r="1.4" fill="currentColor"/></svg>',
  phone: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" d="M6.6 3.5h2.6l1.4 4.2-2 1.4a12 12 0 0 0 6.3 6.3l1.4-2 4.2 1.4v2.6A2 2 0 0 1 18.4 19 15.6 15.6 0 0 1 4.6 5.6a2 2 0 0 1 2-2.1Z"/></svg>',
  mail: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5.5" width="18" height="13" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m3.5 6.5 8.5 6.5 8.5-6.5" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
};

export const FOOT_1 = '**Imagroup S.A.C.**\nConsultoría, gestión ambiental y obras.\n[Servicios](/servicios) · [Portafolio](/portafolio)';
export const FOOT_2 = '**Gregorian**\nSeguridad en ingeniería.\n[Tienda de EPP](/tienda)';
export function layout(s, { title, desc, path = '/', body, theme = '', preview = '' }) {
  const full = title ? `${title} | ${s.site_name}` : `${s.site_name}: ingeniería ambiental y seguridad industrial`;
  const nav = navFn();
  const isOn = (u) => (u === '/' ? path === '/' : path === u || path.startsWith(u + '/'));
  const tabs = [['/', 'Inicio', 'home'], ...nav.slice(0, 3)];
  const svg = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true">${PAGE_ICONS[k] || PAGE_ICONS.doc}</svg>`;
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${h(full)}</title><meta name="description" content="${h(desc || 'Imagroup S.A.C.: consultoría y gestión ambiental, obras de ingeniería y venta de equipos de protección personal Gregorian.')}">
<meta property="og:title" content="${h(full)}"><meta property="og:type" content="website"><meta property="og:image" content="/img/f/vial-2.webp">
${s.review_banner === '1' ? '<meta name="robots" content="noindex">' : ''}
<link rel="icon" href="/img/brand/imagroup.webp"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@75..100,400..800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/css/site.css?v=16"><link rel="stylesheet" href="/css/blocks.css?v=1">${theme === 'shop' ? '<link rel="stylesheet" href="/css/shop.css?v=4"><script src="/js/shop.js?v=3" defer></script>' : ''}<script src="/js/theme.js?v=7"></script></head>
<body class="${theme}">
<a class="skip" href="#main">Saltar al contenido</a>
${s.review_banner === '1' ? '<div class="review">Versión de revisión. Los pagos en línea aún no están habilitados: los pedidos se confirman por WhatsApp o teléfono.</div>' : ''}
<header class="top"><div class="wrap top-in">
  <a class="brand" href="/" aria-label="Imagroup, inicio"><img src="/img/brand/imagroup.webp" alt="" width="34" height="44"><span>Imagroup<small>S.A.C.</small></span></a>

  <nav id="nav" class="nav">${nav.map(([u, l]) => `<a href="${h(u)}"${isOn(u) ? ' aria-current="page"' : ''}>${h(l)}</a>`).join('')}
</nav>
  <div class="top-act"><button class="theme-btn" type="button" aria-label="Modo oscuro" aria-pressed="false" data-theme-btn><span class="tb-knob"></span><svg class="tb-sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg><svg class="tb-moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/></svg><span class="tb-beam" aria-hidden="true"></span></button><a class="cart-link" href="/carrito" aria-label="Ver pedido">${ICON.cart}<b data-cart-count hidden>0</b></a>
  <button class="menu-btn" aria-expanded="false" aria-controls="nav"><span></span><span></span><span class="sr">Menú</span></button></div>
</div></header>
<main id="main">${body}</main>
<nav class="mobile-tabs" aria-label="Navegación principal" data-tabs style="--i:${tabs.findIndex(([u]) => isOn(u))}"><span class="mt-blob" aria-hidden="true"></span>
  ${tabs.map(([u, l, k]) => `<a href="${h(u)}"${isOn(u) ? ' aria-current="page"' : ''}>${svg(k)}<span>${h(l)}</span></a>`).join('')}
</nav>
<footer class="foot"><div class="wrap foot-in">
  <div><img src="/img/brand/imagroup.webp" alt="Imagroup" width="40" height="52"><img src="/img/brand/gregorian-sq.webp" alt="Gregorian" width="96" height="64"></div>
  <div class="foot-cols">
    <p>${mi(s.foot_1 ?? FOOT_1)}</p>
    <p>${mi(s.foot_2 ?? FOOT_2)}</p>
    <p><b>${h(s.foot_3_title ?? 'Contacto')}</b><br><a href="tel:+51${h((s.phone_1 || '').replace(/\D/g, ''))}">${h(s.phone_1)}</a><br><a href="mailto:${h(s.email)}">${h(s.email)}</a><br>${h(s.city)}</p>
  </div>
  <p class="fine">© ${new Date().getFullYear()} Imagroup S.A.C. ${s.facebook ? `· <a href="${h(s.facebook)}" rel="noopener">Facebook</a>` : ''}</p>
</div></footer>
<a class="wa-float" href="${wa(s.whatsapp, s.wa_float || 'Hola, vengo de la web de Imagroup.')}" target="_blank" rel="noopener" aria-label="Escribir por WhatsApp">${ICON.wa}</a>
<script src="/js/site.js?v=13" defer></script>${preview}</body></html>`;
}

export const frame = (src, alt, cls = '', eager = false) =>
  src ? `<figure class="frame ${cls}"><img src="${h(src)}" alt="${h(alt)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async"></figure>` : '';
export const sm = (src) => (src && src.startsWith('/img/f/') ? src.replace('.webp', '-sm.webp') : src);

export function productCard(p) {
  return `<article class="prod reveal"><a href="/tienda/${h(p.slug)}" class="prod-img"><img src="${h(p.image)}" alt="${h(p.name)}" loading="lazy" decoding="async"></a>
  <div class="prod-body"><h3><a href="/tienda/${h(p.slug)}">${h(p.name)}</a></h3>
  <p class="price">${money(p.price_cents)}${p.availability !== 'disponible' ? ` <span class="avail">${h(p.availability)}</span>` : ''}</p>
  ${p.availability === 'agotado' ? '' : `<button class="btn sm ghost" data-add='${h(JSON.stringify({ slug: p.slug, name: p.name, price: p.price_cents, image: p.image }))}'>Agregar</button>`}</div></article>`;
}

export function contactBand(s, prefill = {}) {
  return `<section class="contact-band" id="contacto"><div class="wrap contact-in">
  <div class="reveal"><h2>Cuéntanos qué necesitas</h2><p>Solo tu correo y lo que necesitas. Si prefieres, escríbenos directo.</p>
    <ul class="direct">
      <li><a href="${wa(s.whatsapp, prefill.wa || 'Hola, quiero hacer una consulta.')}" target="_blank" rel="noopener">${ICON.wa}WhatsApp ${h(s.phone_1)}</a></li>
      <li><a href="tel:+51${h((s.phone_2 || '').replace(/\D/g, ''))}">${ICON.phone}${h(s.phone_2)}</a></li>
      <li><a href="mailto:${h(s.email)}">${ICON.mail}${h(s.email)}</a></li></ul></div>
  ${leadForm(prefill)}</div></section>`;
}

export function leadForm(prefill = {}) {
  const subj = prefill.subject || '';
  return `<form class="form mini reveal" method="post" action="/contacto" novalidate data-form>
  <input type="hidden" name="kind" value="${h(prefill.kind || 'contacto')}"><input type="hidden" name="_t" value="${Date.now()}"><input type="hidden" name="subject" value="${h(subj)}">
  <div class="hp" aria-hidden="true"><label>No llenar <input name="website" tabindex="-1" autocomplete="off"></label></div>
  ${subj ? `<p class="mini-subj"><span>Sobre</span> ${h(subj)}</p>` : ''}
  <label class="fl"><input name="email" type="email" required maxlength="120" autocomplete="email" inputmode="email" placeholder=" "><span>Tu correo</span><i aria-hidden="true"></i></label>
  <label class="fl"><textarea name="message" required maxlength="3000" rows="2" placeholder=" "></textarea><span>¿Qué necesitas?</span><i aria-hidden="true"></i></label>
  <div class="mini-foot"><p class="form-msg" role="status" aria-live="polite"></p>
  <button class="btn send" type="submit"><span>Enviar</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div>
  <div class="mini-ok" aria-hidden="true"><svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="24"/><path d="m15 27 7 7 15-16"/></svg><b>Recibido</b><span>Te responderemos a tu correo.</span></div>
</form>`;
}

export function servicePage(s, v, others) {
  return `<article class="wrap detail">
  <nav class="crumbs"><a href="/servicios">Servicios</a> / ${h(v.title)}</nav>
  <div class="detail-grid"><div><h1>${h(v.title)}</h1><p class="lead">${h(v.summary)}</p><p>${h(v.body)}</p>
    <p class="note">El alcance y el precio se definen según cada proyecto. Envíanos tu requerimiento y te respondemos con una propuesta.</p>
    <a class="btn wa" href="${wa(s.whatsapp, `Hola, quiero cotizar: ${v.title}.`)}" target="_blank" rel="noopener">${ICON.wa}Cotizar por WhatsApp</a></div>
  ${frame(v.image, v.title, 'tall')}</div></article>
  ${contactBand(s, { kind: 'cotizacion', subject: `Cotización: ${v.title}`, wa: `Hola, quiero cotizar: ${v.title}.` })}
  <section class="wrap block"><h2 class="h3">Otros servicios</h2><ul class="chips">${others.map((o) => `<li><a href="/servicios/${h(o.slug)}">${h(o.title)}</a></li>`).join('')}</ul></section>`;
}

// ---------- Tienda ----------
const ART = JSON.parse(fs.readFileSync(new URL('./product-art.json', import.meta.url), 'utf8'));
// Imagen recortada y color de marca de cada producto; si el admin sube otra foto se usa tal cual.
export const art = (p) => ART[p.image] || { cut: p.image, tone: '#1a5f99', photo: true };
// Texto oscuro sobre los tonos claros (arena y dorado), blanco sobre los demás.
export const on = (tone) => (/^#(e8dcc0|c9a24a)$/i.test(tone) ? '#14202c' : '#ffffff');
const vt = (p) => `view-transition-name:p-${h(p.slug).replace(/[^a-z0-9-]/gi, '')}`;
const firstLine = (t) => lines(t)[0] || '';
export const SI = {
  arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  minus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
  search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>',
  back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>',
};
const addData = (p) => h(JSON.stringify({ slug: p.slug, name: p.name, price: p.price_cents, image: p.image }));
export const figure = (p, cls = '', eager = false) => {
  const a = art(p);
  return `<span class="sp-fig ${a.photo ? 'is-photo' : 'is-cut'} ${cls}"><img src="${h(a.cut)}" alt="${h(p.name)}" ${a.w ? `width="${a.w}" height="${a.h}"` : ''} ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async"></span>`;
};

export function shopCard(p, i = 0) {
  const a = art(p);
  return `<article class="sc" style="--tone:${a.tone};--on:${on(a.tone)};--i:${i % 8}" data-cat="${h(p.cslug || '')}" data-text="${h((p.name + ' ' + p.category + ' ' + p.description).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''))}">
  <a class="sc-tile" href="/tienda/${h(p.slug)}" style="${vt(p)}" tabindex="-1" aria-hidden="true"><i class="sc-blob"></i>${figure(p)}</a>
  <div class="sc-body"><small>${h(p.category || '')}</small><h3><a href="/tienda/${h(p.slug)}">${h(p.name)}</a></h3>
  <div class="sc-row"><p class="sc-price">${money(p.price_cents)}${p.availability !== 'disponible' ? ` <span class="avail">${h(p.availability)}</span>` : ''}</p>
  ${p.availability === 'agotado' ? '' : `<button class="sc-add" type="button" data-add="${addData(p)}" aria-label="Agregar ${h(p.name)} al pedido">${SI.plus}</button>`}
  <a class="sc-go" href="/tienda/${h(p.slug)}" aria-label="Ver ${h(p.name)}">${SI.arrow}</a></div></div></article>`;
}

export function productPage(s, p, related) {
  const a = art(p), [lead, ...feats] = lines(p.description);
  const variants = String(p.variants || '').split(',').map((v) => v.trim()).filter(Boolean);
  return `<article class="pd" style="--tone:${a.tone};--on:${on(a.tone)}">
  <div class="wrap pd-in">
  <div class="pd-stage"><a class="pd-back" href="/tienda" aria-label="Volver a la tienda">${SI.back}</a>
    <span class="pd-word" aria-hidden="true">${h((p.category || 'Gregorian').toUpperCase())}</span><i class="pd-blob" aria-hidden="true"></i>
    <div class="pd-shot" style="${vt(p)}" data-shot>${figure(p, '', true)}</div>
    <div class="pd-thumbs" role="group" aria-label="Imágenes"><button type="button" aria-pressed="true" data-src="${h(a.cut)}" data-photo="${a.photo ? 1 : 0}"><img src="${h(a.cut)}" alt="" loading="lazy"><span class="sr">Producto</span></button>${a.cut !== p.image ? `<button type="button" aria-pressed="false" data-src="${h(p.image)}" data-photo="1"><img src="${h(p.image)}" alt="" loading="lazy"><span class="sr">Volante original</span></button>` : ''}</div></div>
  <div class="pd-info"><nav class="crumbs"><a href="/tienda">Tienda</a> / <a href="/tienda?c=${h(p.cslug || '')}">${h(p.category || '')}</a></nav>
    <h1>${h(p.name)}</h1>
    <div class="pd-price"><b>${money(p.price_cents)}</b><span class="pd-av ${h(p.availability)}"><i></i>${p.availability === 'disponible' ? 'Disponible' : h(p.availability)}</span></div>
    <p class="pd-lead">${h(lead || '')}</p>
    ${feats.length ? `<ul class="pd-feats">${feats.map((f, i) => `<li style="--i:${i}">${SI.check}${h(f)}</li>`).join('')}</ul>` : ''}
    ${variants.length ? `<div class="pd-var"><span>Opciones</span><div>${variants.map((v) => `<b>${h(v)}</b>`).join('')}</div><small>Escribe la opción que necesitas en las notas del pedido.</small></div>` : ''}
    ${p.availability === 'agotado' ? '' : `<div class="buy pd-buy"><div class="pd-qty"><button type="button" data-step="-1" aria-label="Quitar uno">${SI.minus}</button><label class="sr" for="qty">Cantidad</label><input id="qty" type="number" min="1" max="999" value="1" data-qty inputmode="numeric"><button type="button" data-step="1" aria-label="Agregar uno">${SI.plus}</button></div>
    <button class="pd-swipe" type="button" data-add="${addData(p)}" data-swipe><span class="pd-knob">${ICON.cart}</span><span class="pd-label">Desliza o toca para agregar</span><span class="pd-chev" aria-hidden="true">›››</span></button></div>`}
    <a class="btn wa ghost pd-wa" href="${wa(s.whatsapp, `Hola, me interesa: ${p.name} (${money(p.price_cents)}).`)}" target="_blank" rel="noopener">${ICON.wa}Consultar por WhatsApp</a>
    <p class="note">Sin cargos ocultos: el costo de envío, si aplica, te lo confirmamos antes de pagar.</p></div></div></article>
  ${related.length ? `<section class="wrap ss pd-rel"><h2 class="h3">También en ${h(p.category || 'la tienda')}</h2><div class="sg">${related.map(shopCard).join('')}</div></section>` : ''}`;
}

export function orderDone(s, lead, items) {
  const text = `Hola, envié el pedido N.° ${lead.id}:\n${items.map((i) => `• ${i.qty} x ${i.name}`).join('\n')}\nTotal referencial: ${money(lead.total_cents)}`;
  return `<section class="wrap detail done"><h1>Pedido N.° ${lead.id} recibido</h1>
  <p class="lead">Gracias, ${h(lead.name)}. Te contactaremos al ${h(lead.phone)} para confirmar stock, entrega y forma de pago.</p>
  <ul class="sum">${items.map((i) => `<li><span>${i.qty} × ${h(i.name)}</span><b>${money(i.price == null ? null : i.price * i.qty)}</b></li>`).join('')}
  <li class="tot"><span>Total referencial</span><b>${money(lead.total_cents)}</b></li></ul>
  <a class="btn wa" href="${wa(s.whatsapp, text)}" target="_blank" rel="noopener">${ICON.wa}Avisar por WhatsApp</a> <a class="btn ghost" href="/tienda">Seguir viendo productos</a>
  <div data-clear-cart hidden></div></section>`;
}


export function projectPage(s, p) {
  const gal = lines(p.gallery);
  return `<article class="wrap detail"><nav class="crumbs"><a href="/portafolio">Portafolio</a> / ${h(p.area)}</nav>
  <h1>${h(p.title)}</h1><p class="pj-meta">${h(p.area)}${p.period ? ' · ' + h(p.period) : ''}${p.place ? ' · ' + h(p.place) : ''}</p>
  <p class="lead">${h(p.summary)}</p>${frame(p.image, p.title, 'wide', true)}
  ${gal.length ? `<div class="gal">${gal.map((g) => frame(g, p.title)).join('')}</div>` : ''}
  <p><a class="btn" href="/contacto?asunto=${encodeURIComponent('Proyecto similar a: ' + p.title)}">Solicitar un proyecto similar</a></p></article>`;
}

export function message(title, text, back = '/') {
  return `<section class="wrap detail done"><h1>${h(title)}</h1><p class="lead">${h(text)}</p><a class="btn" href="${h(back)}">Volver</a></section>`;
}
