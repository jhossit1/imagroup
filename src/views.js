// Plantillas públicas (HTML renderizado en servidor).
import { PROFILE } from './profile.js';
export const h = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const money = (c) => (c == null ? 'Consultar' : 'S/ ' + (c / 100).toFixed(2));
const lines = (t) => String(t || '').split('\n').map((s) => s.trim()).filter(Boolean);
export const wa = (num, text) => `https://wa.me/${h(num)}?text=${encodeURIComponent(text)}`;

const ICON = {
  wa: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.3c0-.1-.2-.2-.5-.3Z"/></svg>',
  cart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" d="M3 4h2.2l2.1 10.3a1.5 1.5 0 0 0 1.5 1.2h8.4a1.5 1.5 0 0 0 1.4-1.1L20.5 8H6.1"/><circle cx="9.5" cy="19.5" r="1.4" fill="currentColor"/><circle cx="17" cy="19.5" r="1.4" fill="currentColor"/></svg>',
  phone: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" d="M6.6 3.5h2.6l1.4 4.2-2 1.4a12 12 0 0 0 6.3 6.3l1.4-2 4.2 1.4v2.6A2 2 0 0 1 18.4 19 15.6 15.6 0 0 1 4.6 5.6a2 2 0 0 1 2-2.1Z"/></svg>',
  mail: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5.5" width="18" height="13" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m3.5 6.5 8.5 6.5 8.5-6.5" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
};

export function layout(s, { title, desc, path = '/', body, theme = '' }) {
  const full = title ? `${title} | ${s.site_name}` : `${s.site_name}: ingeniería ambiental y seguridad industrial`;
  const nav = [['/servicios', 'Servicios'], ['/tienda', 'Tienda'], ['/portafolio', 'Portafolio'], ['/contacto', 'Contacto']];
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${h(full)}</title><meta name="description" content="${h(desc || 'Imagroup S.A.C.: consultoría y gestión ambiental, obras de ingeniería y venta de equipos de protección personal Gregorian.')}">
<meta property="og:title" content="${h(full)}"><meta property="og:type" content="website"><meta property="og:image" content="/img/f/vial-2.webp">
${s.review_banner === '1' ? '<meta name="robots" content="noindex">' : ''}
<link rel="icon" href="/img/brand/imagroup.webp"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@75..100,400..800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/css/site.css?v=13"><script src="/js/theme.js?v=7"></script></head>
<body class="${theme}">
<a class="skip" href="#main">Saltar al contenido</a>
${s.review_banner === '1' ? '<div class="review">Versión de revisión. Los pagos en línea aún no están habilitados: los pedidos se confirman por WhatsApp o teléfono.</div>' : ''}
<header class="top"><div class="wrap top-in">
  <a class="brand" href="/" aria-label="Imagroup, inicio"><img src="/img/brand/imagroup.webp" alt="" width="34" height="44"><span>Imagroup<small>S.A.C.</small></span></a>

  <nav id="nav" class="nav">${nav.map(([u, l]) => `<a href="${u}"${path.startsWith(u) ? ' aria-current="page"' : ''}>${l}</a>`).join('')}
</nav>
  <div class="top-act"><button class="theme-btn" type="button" aria-label="Modo oscuro" aria-pressed="false" data-theme-btn><span class="tb-knob"></span><svg class="tb-sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg><svg class="tb-moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/></svg><span class="tb-beam" aria-hidden="true"></span></button><a class="cart-link" href="/carrito" aria-label="Ver pedido">${ICON.cart}<b data-cart-count hidden>0</b></a>
  <button class="menu-btn" aria-expanded="false" aria-controls="nav"><span></span><span></span><span class="sr">Menú</span></button></div>
</div></header>
<main id="main">${body}</main>
<nav class="mobile-tabs" aria-label="Navegación principal" data-tabs style="--i:${['/', '/servicios', '/tienda', '/contacto'].findIndex((u) => (u === '/' ? path === '/' : path.startsWith(u)))}"><span class="mt-blob" aria-hidden="true"></span>
  <a href="/"${path === '/' ? ' aria-current="page"' : ''}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/></svg><span>Inicio</span></a>
  <a href="/servicios"${path.startsWith('/servicios') ? ' aria-current="page"' : ''}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V8l8-5 8 5v12H4Z"/><path d="M9 20v-7h6v7M4 10h16"/></svg><span>Servicios</span></a>
  <a href="/tienda"${path.startsWith('/tienda') ? ' aria-current="page"' : ''}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h16l-1 12H5L4 9ZM8 10V7a4 4 0 0 1 8 0v3"/></svg><span>Tienda</span></a>
  <a href="/contacto"${path.startsWith('/contacto') ? ' aria-current="page"' : ''}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v14H4zM4 6l8 7 8-7"/></svg><span>Contacto</span></a>
</nav>
<footer class="foot"><div class="wrap foot-in">
  <div><img src="/img/brand/imagroup.webp" alt="Imagroup" width="40" height="52"><img src="/img/brand/gregorian-sq.webp" alt="Gregorian" width="96" height="64"></div>
  <div class="foot-cols">
    <p><b>Imagroup S.A.C.</b><br>Consultoría, gestión ambiental y obras.<br><a href="/servicios">Servicios</a> · <a href="/portafolio">Portafolio</a></p>
    <p><b>Gregorian</b><br>Seguridad en ingeniería.<br><a href="/tienda">Tienda de EPP</a></p>
    <p><b>Contacto</b><br><a href="tel:+51${h((s.phone_1 || '').replace(/\D/g, ''))}">${h(s.phone_1)}</a><br><a href="mailto:${h(s.email)}">${h(s.email)}</a><br>${h(s.city)}</p>
  </div>
  <p class="fine">© ${new Date().getFullYear()} Imagroup S.A.C. ${s.facebook ? `· <a href="${h(s.facebook)}" rel="noopener">Facebook</a>` : ''}</p>
</div></footer>
<a class="wa-float" href="${wa(s.whatsapp, 'Hola, vengo de la web de Imagroup.')}" target="_blank" rel="noopener" aria-label="Escribir por WhatsApp">${ICON.wa}</a>
<script src="/js/site.js?v=12" defer></script></body></html>`;
}

const frame = (src, alt, cls = '', eager = false) =>
  src ? `<figure class="frame ${cls}"><img src="${h(src)}" alt="${h(alt)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async"></figure>` : '';
const sm = (src) => (src && src.startsWith('/img/f/') ? src.replace('.webp', '-sm.webp') : src);

function productCard(p) {
  return `<article class="prod reveal"><a href="/tienda/${h(p.slug)}" class="prod-img"><img src="${h(p.image)}" alt="${h(p.name)}" loading="lazy" decoding="async"></a>
  <div class="prod-body"><h3><a href="/tienda/${h(p.slug)}">${h(p.name)}</a></h3>
  <p class="price">${money(p.price_cents)}${p.availability !== 'disponible' ? ` <span class="avail">${h(p.availability)}</span>` : ''}</p>
  ${p.availability === 'agotado' ? '' : `<button class="btn sm ghost" data-add='${h(JSON.stringify({ slug: p.slug, name: p.name, price: p.price_cents, image: p.image }))}'>Agregar</button>`}</div></article>`;
}

export function home(s, { companies, services, products, projects }) {
  const [im, gr] = companies;
  return `
<section class="hero wrap">
  <div class="hero-copy">
    <h1 class="rise">Ingeniería ambiental en campo y equipos de protección para tu obra.</h1>
    <p class="lead rise">Dos líneas de trabajo con un mismo equipo: <b>Imagroup</b> para consultoría, gestión ambiental y obras, y <b>Gregorian</b> para seguridad industrial.</p>
    <div class="routes rise">
      <a class="route" href="/servicios"><span>01</span>Servicios de ingeniería</a>
      <a class="route" href="/tienda"><span>02</span>Comprar equipos de protección</a>
      <a class="route" href="/portafolio"><span>03</span>Conocer al ingeniero a cargo</a>
    </div>
  </div>
  <div class="hero-media">${frame('/img/f/vial-2.webp', 'Cuadrilla en mantenimiento de un camino vecinal', 'tall wipe', true)}
    <p class="caption">Mantenimiento vial · caminos vecinales</p></div>
</section>

<section class="duo wrap">
  <article class="co co-im reveal"><img class="co-logo" src="${h(im.logo)}" alt="${h(im.name)}" width="70" height="90">
    <h2>${h(im.name)}</h2><p class="co-tag">${h(im.tagline)}</p><p>${h(im.description)}</p>
    <ul class="ticks">${lines(im.scope).map((l) => `<li>${h(l)}</li>`).join('')}</ul>
    <a class="btn" href="/servicios">Ver servicios de Imagroup</a></article>
  <article class="co co-gr reveal"><img class="co-logo" src="${h(gr.logo_dark)}" alt="${h(gr.name)}" width="150" height="100">
    <p class="co-tag">${h(gr.tagline)}</p><p>${h(gr.description)}</p>
    <ul class="ticks">${lines(gr.scope).map((l) => `<li>${h(l)}</li>`).join('')}</ul>
    <a class="btn gold" href="/tienda">Ir a la tienda Gregorian</a></article>
</section>

<section class="wrap block">
  <header class="sec-head reveal"><h2>Qué hacemos en campo</h2><a href="/servicios" class="link">Todos los servicios</a></header>
  <ol class="svc-list">${services.slice(0, 6).map((v, i) => `<li class="reveal"><a href="/servicios/${h(v.slug)}">
    <span class="num">${String(i + 1).padStart(2, '0')}</span><span class="svc-t">${h(v.title)}</span><span class="svc-s">${h(v.summary)}</span>
    ${v.image ? `<img class="svc-peek" src="${h(sm(v.image))}" alt="" loading="lazy">` : ''}</a></li>`).join('')}</ol>
</section>

<section class="shop-band">
  <div class="wrap"><header class="sec-head reveal"><h2>Equipos de protección personal</h2><a href="/tienda" class="link">Ver catálogo completo</a></header>
  <div class="rail">${products.slice(0, 8).map(productCard).join('')}</div></div>
</section>

<section class="wrap block">
  <header class="sec-head reveal"><h2>Trabajos realizados</h2><a href="/portafolio" class="link">Ver portafolio</a></header>
  <div class="mosaic">${projects.slice(0, 3).map((p, i) => `<a class="pj reveal ${i === 0 ? 'big' : ''}" href="/portafolio/${h(p.slug)}">
    ${frame(i === 0 ? p.image : sm(p.image), p.title)}<span class="pj-meta">${h(p.area)}${p.period ? ' · ' + h(p.period) : ''}</span><h3>${h(p.title)}</h3></a>`).join('')}</div>
</section>
${contactBand(s)}`;
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

export function servicesPage(s, co, services) {
  return `<section class="page-head wrap"><img src="${h(co.logo)}" alt="" width="60" height="78" class="ph-logo">
  <div><p class="kicker">${h(co.name)} · ${h(co.tagline)}</p><h1>Servicios de consultoría, gestión ambiental y obras</h1><p class="lead">${h(co.description)}</p></div></section>
  <section class="wrap block"><div class="svc-grid">${services.map((v) => `<a class="svc-card reveal" href="/servicios/${h(v.slug)}">
    ${v.image ? frame(sm(v.image), v.title) : '<div class="frame plain"><span>Planos · expedientes</span></div>'}
    <h2>${h(v.title)}</h2><p>${h(v.summary)}</p><span class="link">Ver detalle y cotizar</span></a>`).join('')}</div></section>
  ${contactBand(s, { kind: 'cotizacion', subject: 'Cotización de servicio' })}`;
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

export function shopPage(s, { co, categories, products, q, c }) {
  return `<section class="shop-head"><div class="wrap shop-head-in">
  <div><img src="${h(co.logo_dark)}" alt="Gregorian" width="180" height="120" class="ph-logo-wide"><h1>Tienda de equipos de protección</h1>
  <p class="lead">${h(co.description)}</p></div>
  <form class="search" role="search" action="/tienda"><label class="sr" for="q">Buscar producto</label>
    <input id="q" name="q" value="${h(q)}" placeholder="Buscar: casco, guantes, chaleco…">${c ? `<input type="hidden" name="c" value="${h(c)}">` : ''}<button class="btn gold">Buscar</button></form></div></section>
  <section class="wrap block">
  <nav class="chips" aria-label="Categorías"><a href="/tienda${q ? `?q=${encodeURIComponent(q)}` : ''}" ${!c ? 'aria-current="true"' : ''}>Todo</a>${categories.map((k) => `<a href="/tienda?c=${h(k.slug)}${q ? `&q=${encodeURIComponent(q)}` : ''}" ${c === k.slug ? 'aria-current="true"' : ''}>${h(k.name)}</a>`).join('')}</nav>
  <p class="note">Precios referenciales en soles. Confirmamos stock, tallas y entrega antes de cualquier pago.</p>
  ${products.length ? `<div class="grid-prod">${products.map(productCard).join('')}</div>`
    : `<div class="empty"><p>No encontramos productos para “${h(q)}”.</p><a class="btn ghost" href="/tienda">Ver todo el catálogo</a> <a class="btn wa" href="${wa(s.whatsapp, `Hola, busco: ${q}`)}" target="_blank" rel="noopener">${ICON.wa}Preguntar por WhatsApp</a></div>`}
  </section>`;
}

export function productPage(s, p, related) {
  return `<article class="wrap detail"><nav class="crumbs"><a href="/tienda">Tienda</a> / ${h(p.category || '')}</nav>
  <div class="detail-grid prod-detail"><figure class="frame sq"><img src="${h(p.image)}" alt="${h(p.name)}" fetchpriority="high"></figure>
  <div><h1>${h(p.name)}</h1><p class="price big">${money(p.price_cents)}</p><p class="avail-line">Disponibilidad: <b>${h(p.availability)}</b></p>
  <p>${h(p.description)}</p>${p.variants ? `<p>Opciones: ${h(p.variants)}</p>` : ''}
  ${p.availability === 'agotado' ? '' : `<div class="buy"><label>Cantidad<input type="number" min="1" max="999" value="1" data-qty></label>
  <button class="btn gold" data-add='${h(JSON.stringify({ slug: p.slug, name: p.name, price: p.price_cents, image: p.image }))}'>Agregar al pedido</button></div>`}
  <a class="btn wa ghost" href="${wa(s.whatsapp, `Hola, me interesa: ${p.name} (${money(p.price_cents)}).`)}" target="_blank" rel="noopener">${ICON.wa}Consultar por WhatsApp</a>
  <p class="note">Sin cargos ocultos: el costo de envío, si aplica, te lo confirmamos antes de pagar.</p></div></div></article>
  ${related.length ? `<section class="wrap block"><h2 class="h3">También en ${h(p.category || 'la tienda')}</h2><div class="grid-prod">${related.map(productCard).join('')}</div></section>` : ''}`;
}

export function cartPage(s, catalog) {
  return `<section class="wrap detail cart"><h1>Tu pedido</h1>
  <p class="lead">Revisa los productos y envíanos la solicitud. Te confirmamos stock, total y entrega por WhatsApp o llamada. Aún no cobramos en línea.</p>
  <div data-cart-root><p class="loading">Cargando tu pedido…</p></div>
  <script type="application/json" id="catalog">${JSON.stringify(catalog).replace(/</g, '\\u003c')}</script>
  <form class="form order" method="post" action="/pedido" data-order hidden>
    <input type="hidden" name="items"><input type="hidden" name="_t" value="${Date.now()}">
    <div class="hp" aria-hidden="true"><label>No llenar <input name="website" tabindex="-1" autocomplete="off"></label></div>
    <h2 class="h3">Datos para confirmar</h2>
    <div class="row2"><label>Nombre<input name="name" required maxlength="120" autocomplete="name"></label>
    <label>Teléfono o WhatsApp<input name="phone" required maxlength="30" inputmode="tel" autocomplete="tel"></label></div>
    <fieldset class="opts"><legend>Entrega</legend>
      <label><input type="radio" name="delivery" value="recojo" checked> Recojo (te indicamos el punto)</label>
      <label><input type="radio" name="delivery" value="envio"> Envío (costo según destino, se confirma antes de pagar)</label></fieldset>
    <label>Notas <i>(tallas, destino, factura)</i><textarea name="message" maxlength="1500" rows="3"></textarea></label>
    <p class="form-msg" role="status" aria-live="polite"></p>
    <button class="btn gold" type="submit">Enviar solicitud de pedido</button></form></section>`;
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

export function contactPage(s, subject) {
  const word = 'CONTACTO';
  return `<section class="kc"><div class="wrap">
  <ul class="kc-info">
    <li><span>Correo</span><a href="mailto:${h(s.email)}">${h(s.email)}</a></li>
    <li><span>WhatsApp</span><a href="${wa(s.whatsapp, 'Hola, quiero hacer una consulta.')}" target="_blank" rel="noopener">${h(s.phone_1)}</a></li>
    <li><span>Teléfono</span><a href="tel:+51${h((s.phone_2 || '').replace(/\D/g, ''))}">${h(s.phone_2)}</a></li>
    <li><span>Ubicación</span>${h(s.city)}</li></ul>
  <h1 class="kc-word" aria-label="Contacto" data-kinetic>${[...word].map((c, i) => `<span aria-hidden="true" style="--i:${i}">${c}</span>`).join('')}</h1>
  </div></section>
  <section class="wrap kc-form"><div class="kc-lead reveal"><h2>Escríbenos en dos líneas</h2><p>Déjanos tu correo y lo que necesitas. Te respondemos con la cotización o la información.</p></div>
  ${leadForm({ kind: 'contacto', subject })}</section>`;
}

export function message(title, text, back = '/') {
  return `<section class="wrap detail done"><h1>${h(title)}</h1><p class="lead">${h(text)}</p><a class="btn" href="${h(back)}">Volver</a></section>`;
}

// Portafolio personal del ingeniero a cargo: compacto, en claro y oscuro.
export function profilePage(s) {
  const P = PROFILE;
  const years = new Date().getFullYear() - P.since;
  const orgs = new Set(P.jobs.map((j) => j.org)).size;
  const waP = (t) => wa(s.whatsapp, t);
  const pad = (n) => String(n).padStart(2, '0');
  const img = (n, alt = '') => `<img src="/img/f/${n}-sm.webp" alt="${h(alt)}" loading="lazy" decoding="async">`;
  const marq = (items) => `<div class="pf-marquee" aria-hidden="true"><div>${[0, 1].map(() => `<span>${items.map((t) => `<b>${h(t)}</b><i>✦</i>`).join('')}</span>`).join('')}</div></div>`;
  const tabs = [['grado', 'Grados'], ['diplomado', 'Diplomados'], ['curso', 'Cursos'], ['soft', 'Software e idiomas']];
  const n = (k) => (k === 'soft' ? P.tools.length + P.langs.length : P.study.filter((x) => x.k === k).length);
  const arrows = (name) => `<div class="pf-arrows"><button type="button" data-${name}="-1" aria-label="Anterior">←</button><button type="button" data-${name}="1" aria-label="Siguiente">→</button></div>`;
  return `<div class="pf">
  <section class="ph" data-ph>
    <div class="ph-glow" aria-hidden="true"></div>
    <div class="ph-back" aria-hidden="true"><div>${[0, 1].map(() => `<span>INGENIERÍA AMBIENTAL · RESIDUOS SÓLIDOS · AGUA Y SANEAMIENTO · GESTIÓN MUNICIPAL · </span>`).join('')}</div></div>
    <div class="wrap ph-in">
      <div class="ph-tx">
        <p class="pf-eyebrow rise" style="--d:0">Hola, soy</p>
        <h1 class="ph-name" aria-label="Ingeniero ${h(P.name)}">
          <span class="ph-l1" aria-hidden="true">${[...P.first.toUpperCase()].map((c, i) => `<i style="--i:${i}">${c}</i>`).join('')}</span>
          <span class="ph-l2" aria-hidden="true">${[...'TENORIO'].map((c, i) => `<i style="--i:${i + 6}">${c}</i>`).join('')}</span>
        </h1>
        <p class="ph-role rise" style="--d:3">${h(P.role)} · <b>CIP ${P.cip}</b></p>
        <p class="pf-intro rise" style="--d:4">${h(P.intro)}</p>
        <div class="pf-cta rise" style="--d:5"><a class="btn gold" href="${waP('Hola Ing. ' + P.first + ', vengo de su portafolio en la web de Imagroup.')}" target="_blank" rel="noopener">${ICON.wa}Escribir por WhatsApp</a><a class="btn pf-ghost" href="#trayectoria">Ver trayectoria <span aria-hidden="true">→</span></a></div>
        <ul class="ph-facts rise" style="--d:6">
          ${[[years, '+', 'años de experiencia'], [P.jobs.length, '', 'cargos'], [orgs, '', 'instituciones'], [P.study.length, '', 'formaciones']]
            .map(([v, suf, l]) => `<li><b data-count="${v}" data-suf="${suf}">${v}${suf}</b><span>${l}</span></li>`).join('')}
        </ul>
      </div>
      <div class="ph-media">
        <div class="ph-halo" aria-hidden="true"></div>
        <figure class="ph-photo"><img src="/img/brand/jhossi-cut.webp?v=2" srcset="/img/brand/jhossi-cut-sm.webp?v=2 560w, /img/brand/jhossi-cut.webp?v=2 900w" sizes="(max-width: 760px) 86vw, 44vw" alt="Ing. ${h(P.name)}" width="900" height="1200" fetchpriority="high"></figure>
        <ul class="ph-chips" aria-hidden="true">${P.tags.slice(0, 4).map((t, i) => `<li style="--i:${i}">${h(t)}</li>`).join('')}</ul>
      </div>
      <p class="ph-vert" aria-hidden="true">Ingeniero ambiental — CIP ${P.cip}</p>
    </div>
  </section>${marq(P.tags.concat(P.tools.map((t) => t[0]).slice(0, 4)))}

  <section class="pf-sec pf-spec" aria-labelledby="esp-t"><div class="wrap">
    <header class="pf-head reveal"><div><p class="pf-eyebrow">Especialidades</p><h2 id="esp-t">Lo que hace en <span class="pf-mark">campo</span></h2></div>${arrows('car')}</header>
    <div class="pf-car" data-carousel tabindex="0" aria-roledescription="carrusel" aria-label="Especialidades">
      ${P.areas.map((a, i) => `<article class="pf-c" data-i="${i}" aria-label="${h(a.t)}"><figure>${img(a.img.replace('/img/f/', ''), a.t)}</figure>
        <div class="pf-c-tx"><span class="pf-num">${pad(i + 1)}</span><h3>${h(a.t)}</h3><p>${h(a.d)}</p></div></article>`).join('')}
    </div>
    <div class="pf-dots" role="tablist" aria-label="Elegir especialidad">${P.areas.map((a, i) => `<button type="button" role="tab" data-dot="${i}" aria-label="${h(a.t)}"></button>`).join('')}</div>
  </div></section>

  <section class="pf-sec pf-alt" id="trayectoria" aria-labelledby="tr-t"><div class="wrap">
    <header class="pf-head reveal"><div><p class="pf-eyebrow">Experiencia laboral</p><h2 id="tr-t">Trayectoria de <span class="pf-mark">${P.since} a hoy</span></h2></div>${arrows('rail')}</header>
  </div>
    <div class="pf-rail" data-railbox tabindex="0" aria-label="Cargos, del más reciente al más antiguo">
      ${P.jobs.map((j, i) => `<article class="pf-job${j.now ? ' now' : ''}" style="--i:${i}"><span class="pf-dot" aria-hidden="true"></span><p class="pf-per"><span class="pf-year">${h(j.y)}</span>${h(j.p)}${j.now ? ' <em>Actual</em>' : ''}</p>
        <h3>${h(j.role)}</h3><p class="pf-org">${h(j.org)}</p>${j.note ? `<p class="pf-note">${h(j.note)}</p>` : ''}
        ${j.extra ? `<details><summary>${j.extra.length} encargaturas</summary><ul>${j.extra.map((e) => `<li>${h(e)}</li>`).join('')}</ul></details>` : ''}</article>`).join('')}
    </div>
    <div class="wrap"><div class="pf-progress" aria-hidden="true"><span data-rail-bar></span></div></div>
  </section>

  <section class="pf-sec" aria-labelledby="fo-t"><div class="wrap">
    <header class="pf-head reveal"><div><p class="pf-eyebrow">Formación y herramientas</p><h2 id="fo-t">Estudios, cursos y <span class="pf-mark">software</span></h2></div></header>
    <div class="chips pf-tabs" role="group" aria-label="Filtrar formación" data-study>${tabs.map(([k, l], i) => `<button type="button" aria-pressed="${i === 0}" data-k="${k}">${l} <small>${n(k)}</small></button>`).join('')}</div>
    <ul class="pf-study">${P.study.map((x) => `<li data-k="${x.k}"${x.k === 'grado' ? '' : ' hidden'}><span class="pf-year">${h(x.y)}</span><div><b>${h(x.t)}</b><span>${h(x.o)}</span></div></li>`).join('')}
      ${P.tools.map(([t, d]) => `<li data-k="soft" hidden><span class="pf-year">SW</span><div><b>${h(t)}</b><span>${h(d)}</span></div></li>`).join('')}
      ${P.langs.map(([l, v]) => `<li data-k="soft" hidden><span class="pf-year">ES/EN</span><div><b>${h(l)}</b><span>${h(v)}</span></div></li>`).join('')}</ul>
  </div></section>

  <section class="pf-gal" aria-label="Fotos de trabajo en campo"><div class="pf-gal-row"><div>${[0, 1].map((dup) => P.gallery.map((g) => `<figure${dup ? ' aria-hidden="true"' : ''}>${img(g, dup ? '' : 'Trabajo en campo')}</figure>`).join('')).join('')}</div></div></section>

  <section class="pf-sec pf-end"><div class="wrap"><div class="glow-box reveal">
    <p class="pf-eyebrow">Contacto</p>
    <h2><span data-type="¿Tiene un proyecto ambiental o municipal?">¿Tiene un proyecto ambiental o municipal?</span><span class="caret" aria-hidden="true"></span></h2>
    <p class="pf-intro">Conversemos sobre alcance, plazos y costos.</p>
    <div class="pf-cta"><a class="btn gold" href="${waP('Hola Ing. ' + P.first + ', quisiera conversar sobre un proyecto.')}" target="_blank" rel="noopener">${ICON.wa}WhatsApp ${h(s.phone_1)}</a><a class="btn pf-ghost" href="/contacto?asunto=${encodeURIComponent('Consulta para el Ing. ' + P.first + ' Tenorio')}">Enviar un mensaje</a></div>
    <p class="pf-fine">La información de este portafolio puede acreditarse con documentos a solicitud.</p>
  </div></div></section>
  </div>`;
}
