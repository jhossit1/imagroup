// Catálogo de bloques del diseñador de páginas.
// Cada bloque declara sus campos (lo que el administrador puede cambiar), sus valores por defecto y cómo se dibuja.
// Los valores vienen del administrador: todo se escapa al dibujar y los enlaces pasan por safeUrl.
import { h, money, wa, lines, ICON, frame, sm, productCard, shopCard, art, figure, SI, leadForm, safeUrl, mi } from './views.js';
import { PROFILE } from './profile.js';
import { teamGrid, teamMethod } from './team.js';

// ---------- Utilidades de texto ----------
export { safeUrl, mi };
// Párrafos y listas ("- " al inicio de línea).
export const md = (t) => String(t || '').trim().split(/\n\s*\n/).filter(Boolean).map((p) => {
  const ls = p.split('\n');
  return ls.every((l) => /^\s*[-•]\s+/.test(l)) ? `<ul class="bk-ul">${ls.map((l) => `<li>${mi(l.replace(/^\s*[-•]\s+/, ''))}</li>`).join('')}</ul>` : `<p>${mi(p)}</p>`;
}).join('');
const btn = (label, link, cls = '') => (label && link ? `<a class="btn ${cls}" href="${h(safeUrl(link))}"${/^https?:/.test(link) ? ' target="_blank" rel="noopener"' : ''}>${h(label)}</a>` : '');
const imgTag = (src, alt = '', cls = '', eager = false) => (src ? `<img class="${cls}" src="${h(safeUrl(src))}" alt="${h(alt)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">` : '');
const head = (d) => (d.eyebrow || d.title ? `<header class="bk-head">${d.eyebrow ? `<p class="bk-eye">${h(d.eyebrow)}</p>` : ''}${d.title ? `<h2>${mi(d.title)}</h2>` : ''}</header>` : '');

// ---------- Definición de campos ----------
// t: text | area | md | img | link | num | sel | bool | list | lines.  dyn: si se deja vacío, se toma de otra parte del panel.
const F = {
  title: (def, l = 'Título') => ({ k: 'title', l, t: 'text' }),
  eyebrow: { k: 'eyebrow', l: 'Texto pequeño sobre el título', t: 'text' },
  link: (k, l) => ({ k, l, t: 'link' }),
};
const BTN = (n = '') => [{ k: 'btn' + n + '_label', l: `Botón ${n || ''} · texto`.replace('  ', ' '), t: 'text' }, { k: 'btn' + n + '_link', l: `Botón ${n || ''} · enlace`.replace('  ', ' '), t: 'link' }];
const IMG_ALT = { k: 'image_alt', l: 'Descripción de la imagen (para lectores de pantalla)', t: 'text' };

const facts = () => {
  const P = PROFILE, orgs = new Set(P.jobs.map((j) => j.org)).size;
  return [{ v: String(new Date().getFullYear() - P.since), suf: '+', l: 'años de experiencia' }, { v: String(P.jobs.length), suf: '', l: 'cargos' }, { v: String(orgs), suf: '', l: 'instituciones' }, { v: String(P.study.length), suf: '', l: 'formaciones' }];
};
const pfImg = (src) => (src && !/\.\w+$/.test(src) ? src + '.webp' : src);

export const BLOCKS = {
  // ======================= Inicio =======================
  'home-hero': {
    label: 'Portada de inicio', group: 'Inicio', icon: 'hero', desc: 'Titular, texto, tres accesos y foto grande.',
    fields: [{ k: 'title', l: 'Titular', t: 'area' }, { k: 'lead', l: 'Texto debajo del titular', t: 'md' },
      { k: 'routes', l: 'Accesos numerados', t: 'list', f: [{ k: 'label', l: 'Texto', t: 'text' }, { k: 'link', l: 'Enlace', t: 'link' }] },
      { k: 'image', l: 'Foto', t: 'img' }, IMG_ALT, { k: 'caption', l: 'Pie de foto', t: 'text' }],
    defaults: () => ({ title: 'Ingeniería ambiental en campo y equipos de protección para tu obra.',
      lead: 'Dos líneas de trabajo con un mismo equipo: **Imagroup** para consultoría, gestión ambiental y obras, y **Gregorian** para seguridad industrial.',
      routes: [{ label: 'Servicios de ingeniería', link: '/servicios' }, { label: 'Comprar equipos de protección', link: '/tienda' }, { label: 'Conocer al ingeniero a cargo', link: '/portafolio' }],
      image: '/img/f/vial-2.webp', image_alt: 'Cuadrilla en mantenimiento de un camino vecinal', caption: 'Mantenimiento vial · caminos vecinales' }),
    render: (d) => `<section class="hero wrap"><div class="hero-copy">
  <h1 class="rise">${mi(d.title)}</h1>${d.lead ? `<p class="lead rise">${mi(d.lead)}</p>` : ''}
  ${d.routes?.length ? `<div class="routes rise">${d.routes.map((r, i) => `<a class="route" href="${h(safeUrl(r.link))}"><span>${String(i + 1).padStart(2, '0')}</span>${h(r.label)}</a>`).join('')}</div>` : ''}</div>
  ${d.image ? `<div class="hero-media">${frame(safeUrl(d.image), d.image_alt, 'tall wipe', true)}${d.caption ? `<p class="caption">${h(d.caption)}</p>` : ''}</div>` : ''}</section>`,
  },
  'home-duo': {
    label: 'Las dos empresas', group: 'Inicio', icon: 'duo', desc: 'Imagroup y Gregorian lado a lado. Logos, lema y ámbitos se editan en Empresas.',
    fields: [{ k: 'im_text', l: 'Imagroup · descripción', t: 'area', dyn: 1, h: 'Vacío: usa la descripción de Empresas.' }, ...BTN(1),
      { k: 'gr_text', l: 'Gregorian · descripción', t: 'area', dyn: 1, h: 'Vacío: usa la descripción de Empresas.' }, ...BTN(2)],
    defaults: (c) => ({ im_text: c.companies[0]?.description, gr_text: c.companies[1]?.description, btn1_label: 'Ver servicios de Imagroup', btn1_link: '/servicios', btn2_label: 'Ir a la tienda Gregorian', btn2_link: '/tienda' }),
    render: (d, c) => { const [im, gr] = c.companies; if (!im || !gr) return ''; return `<section class="duo wrap">
  <article class="co co-im reveal"><img class="co-logo" src="${h(im.logo)}" alt="${h(im.name)}" width="70" height="90">
    <h2>${h(im.name)}</h2><p class="co-tag">${h(im.tagline)}</p><p>${mi(d.im_text)}</p>
    <ul class="ticks">${lines(im.scope).map((l) => `<li>${h(l)}</li>`).join('')}</ul>${btn(d.btn1_label, d.btn1_link)}</article>
  <article class="co co-gr reveal"><img class="co-logo" src="${h(gr.logo_dark)}" alt="${h(gr.name)}" width="150" height="100">
    <p class="co-tag">${h(gr.tagline)}</p><p>${mi(d.gr_text)}</p>
    <ul class="ticks">${lines(gr.scope).map((l) => `<li>${h(l)}</li>`).join('')}</ul>${btn(d.btn2_label, d.btn2_link, 'gold')}</article></section>`; },
  },
  'services-list': {
    label: 'Lista de servicios', group: 'Inicio', icon: 'list', desc: 'Servicios numerados con foto al pasar el mouse. Los servicios se editan en Servicios.',
    fields: [F.title(), { k: 'link_label', l: 'Enlace · texto', t: 'text' }, F.link('link', 'Enlace · dirección'), { k: 'count', l: 'Cuántos mostrar', t: 'num' }],
    defaults: () => ({ title: 'Qué hacemos en campo', link_label: 'Todos los servicios', link: '/servicios', count: 6 }),
    render: (d, c) => `<section class="wrap block"><header class="sec-head reveal"><h2>${mi(d.title)}</h2>${d.link_label ? `<a href="${h(safeUrl(d.link))}" class="link">${h(d.link_label)}</a>` : ''}</header>
  <ol class="svc-list">${c.services.slice(0, +d.count || 6).map((v, i) => `<li class="reveal"><a href="/servicios/${h(v.slug)}">
    <span class="num">${String(i + 1).padStart(2, '0')}</span><span class="svc-t">${h(v.title)}</span><span class="svc-s">${h(v.summary)}</span>
    ${v.image ? `<img class="svc-peek" src="${h(sm(v.image))}" alt="" loading="lazy">` : ''}</a></li>`).join('')}</ol></section>`,
  },
  'products-rail': {
    label: 'Franja de productos', group: 'Inicio', icon: 'rail', desc: 'Fila deslizable de productos sobre fondo oscuro.',
    fields: [F.title(), { k: 'link_label', l: 'Enlace · texto', t: 'text' }, F.link('link', 'Enlace · dirección'), { k: 'category', l: 'Categoría', t: 'sel', o: 'categories' }, { k: 'count', l: 'Cuántos mostrar', t: 'num' }],
    defaults: () => ({ title: 'Equipos de protección personal', link_label: 'Ver catálogo completo', link: '/tienda', category: '', count: 8 }),
    render: (d, c) => `<section class="shop-band"><div class="wrap"><header class="sec-head reveal"><h2>${mi(d.title)}</h2>${d.link_label ? `<a href="${h(safeUrl(d.link))}" class="link">${h(d.link_label)}</a>` : ''}</header>
  <div class="rail">${c.products.filter((p) => !d.category || p.cslug === d.category).slice(0, +d.count || 8).map(productCard).join('')}</div></div></section>`,
  },
  'projects-mosaic': {
    label: 'Trabajos realizados', group: 'Inicio', icon: 'mosaic', desc: 'Mosaico de proyectos. Los proyectos se editan en Portafolio del panel.',
    fields: [F.title(), { k: 'link_label', l: 'Enlace · texto', t: 'text' }, F.link('link', 'Enlace · dirección'), { k: 'count', l: 'Cuántos mostrar', t: 'num' }],
    defaults: () => ({ title: 'Trabajos realizados', link_label: 'Ver portafolio', link: '/portafolio', count: 3 }),
    render: (d, c) => `<section class="wrap block"><header class="sec-head reveal"><h2>${mi(d.title)}</h2>${d.link_label ? `<a href="${h(safeUrl(d.link))}" class="link">${h(d.link_label)}</a>` : ''}</header>
  <div class="mosaic">${c.projects.slice(0, +d.count || 3).map((p, i) => `<a class="pj reveal ${i === 0 ? 'big' : ''}" href="/portafolio/${h(p.slug)}">
    ${frame(i === 0 ? p.image : sm(p.image), p.title)}<span class="pj-meta">${h(p.area)}${p.period ? ' · ' + h(p.period) : ''}</span><h3>${h(p.title)}</h3></a>`).join('')}</div></section>`,
  },
  'contact-band': {
    label: 'Franja de contacto', group: 'Contacto', icon: 'mail', desc: 'Texto, WhatsApp, teléfono, correo y formulario corto.',
    fields: [F.title(), { k: 'text', l: 'Texto', t: 'md' }, { k: 'kind', l: 'Tipo de solicitud', t: 'sel', o: [['contacto', 'Consulta'], ['cotizacion', 'Cotización']] },
      { k: 'subject', l: 'Asunto que llega al panel (opcional)', t: 'text' }, { k: 'wa_text', l: 'Mensaje inicial de WhatsApp', t: 'text' }],
    defaults: () => ({ title: 'Cuéntanos qué necesitas', text: 'Solo tu correo y lo que necesitas. Si prefieres, escríbenos directo.', kind: 'contacto', subject: '', wa_text: 'Hola, quiero hacer una consulta.' }),
    render: (d, c) => { const s = c.s; return `<section class="contact-band"><div class="wrap contact-in">
  <div class="reveal"><h2>${mi(d.title)}</h2>${md(d.text)}
    <ul class="direct"><li><a href="${wa(s.whatsapp, d.wa_text || 'Hola')}" target="_blank" rel="noopener">${ICON.wa}WhatsApp ${h(s.phone_1)}</a></li>
      ${s.phone_2 ? `<li><a href="tel:+51${h(s.phone_2.replace(/\D/g, ''))}">${ICON.phone}${h(s.phone_2)}</a></li>` : ''}
      <li><a href="mailto:${h(s.email)}">${ICON.mail}${h(s.email)}</a></li></ul></div>
  ${leadForm({ kind: d.kind, subject: d.subject })}</div></section>`; },
  },

  // ======================= Servicios =======================
  'services-head': {
    label: 'Cabecera de servicios', group: 'Servicios', icon: 'hero', desc: 'Logo, título y descripción de la página de servicios.',
    fields: [{ k: 'kicker', l: 'Texto pequeño', t: 'text', dyn: 1 }, { k: 'title', l: 'Título', t: 'area' }, { k: 'lead', l: 'Descripción', t: 'area', dyn: 1 }, { k: 'logo', l: 'Logo', t: 'img', dyn: 1 }],
    defaults: (c) => ({ kicker: `${c.companies[0]?.name} · ${c.companies[0]?.tagline}`, title: 'Servicios de consultoría, gestión ambiental y obras', lead: c.companies[0]?.description, logo: c.companies[0]?.logo }),
    render: (d) => `<section class="page-head wrap">${d.logo ? `<img src="${h(safeUrl(d.logo))}" alt="" width="60" height="78" class="ph-logo">` : ''}
  <div>${d.kicker ? `<p class="kicker">${h(d.kicker)}</p>` : ''}<h1>${mi(d.title)}</h1>${d.lead ? `<p class="lead">${mi(d.lead)}</p>` : ''}</div></section>`,
  },
  'services-grid': {
    label: 'Tarjetas de servicios', group: 'Servicios', icon: 'cards', desc: 'Todos los servicios publicados con foto. Se editan en Servicios.',
    fields: [{ k: 'link_label', l: 'Texto del enlace de cada tarjeta', t: 'text' }, { k: 'empty', l: 'Texto cuando un servicio no tiene foto', t: 'text' }],
    defaults: () => ({ link_label: 'Ver detalle y cotizar', empty: 'Planos · expedientes' }),
    render: (d, c) => `<section class="wrap block"><div class="svc-grid">${c.services.map((v) => `<a class="svc-card reveal" href="/servicios/${h(v.slug)}">
    ${v.image ? frame(sm(v.image), v.title) : `<div class="frame plain"><span>${h(d.empty)}</span></div>`}
    <h2>${h(v.title)}</h2><p>${h(v.summary)}</p>${d.link_label ? `<span class="link">${h(d.link_label)}</span>` : ''}</a>`).join('')}</div></section>`,
  },

  // ======================= Tienda =======================
  'shop-hero': {
    label: 'Cabecera de la tienda', group: 'Tienda', icon: 'hero', desc: 'Titular con brillo dorado, buscador y productos flotando.',
    fields: [{ k: 'logo', l: 'Logo', t: 'img', dyn: 1 }, { k: 'l1', l: 'Titular · primera parte', t: 'text' }, { k: 'hl', l: 'Titular · parte dorada', t: 'text' }, { k: 'l3', l: 'Titular · última parte', t: 'text' },
      { k: 'text', l: 'Texto', t: 'area', dyn: 1 }, { k: 'placeholder', l: 'Texto dentro del buscador', t: 'text' }, { k: 'search_btn', l: 'Botón del buscador', t: 'text' },
      { k: 'marquee', l: 'Texto gigante que se desplaza al fondo', t: 'text' }, { k: 'art', l: 'Mostrar productos flotando', t: 'bool' },
      { k: 'art_products', l: 'Productos flotando (hasta 3)', t: 'list', max: 3, f: [{ k: 'slug', l: 'Producto', t: 'sel', o: 'products' }] }],
    defaults: (c) => ({ logo: c.companies[1]?.logo_dark, l1: 'Equipos que', hl: 'te cuidan', l3: 'en la obra', text: c.companies[1]?.description, placeholder: 'Busca casco, guantes, chaleco…', search_btn: 'Buscar',
      marquee: 'GREGORIAN · SEGURIDAD EN INGENIERÍA', art: true, art_products: [{ slug: 'guantes-de-badana' }, { slug: 'poncho-impermeable' }, { slug: 'chaleco-rojo' }] }),
    render: (d, c) => {
      const pick = (d.art_products || []).map((x) => c.products.find((p) => p.slug === x.slug)).filter(Boolean).slice(0, 3);
      const mq = d.marquee ? `${h(d.marquee)} · ${h(d.marquee)} · ` : '';
      return `<section class="sh">${mq ? `<div class="sh-mark" aria-hidden="true"><span>${mq}</span><span>${mq}</span></div>` : ''}
  <div class="wrap sh-in"><div class="sh-copy">${d.logo ? `<img src="${h(safeUrl(d.logo))}" alt="" width="150" height="100" class="sh-logo">` : ''}
  <h1>${d.l1 ? `<span>${h(d.l1)}</span> ` : ''}${d.hl ? `<em>${h(d.hl)}</em> ` : ''}${d.l3 ? `<span>${h(d.l3)}</span>` : ''}</h1>${d.text ? `<p>${mi(d.text)}</p>` : ''}
  <form class="sh-search" role="search" action="/tienda" data-search><label class="sr" for="q">Buscar producto</label>${SI.search}
    <input id="q" name="q" value="${h(c.q)}" placeholder="${h(d.placeholder)}" autocomplete="off">${c.c ? `<input type="hidden" name="c" value="${h(c.c)}">` : ''}<button class="btn gold">${h(d.search_btn || 'Buscar')}</button></form></div>
  ${d.art && pick.length ? `<div class="sh-art" aria-hidden="true"><i class="sh-orbit"></i><i class="sh-sun"></i>${pick.map((p, i) => `<a href="/tienda/${h(p.slug)}" tabindex="-1" class="sh-p sh-p${i}" style="--tone:${art(p).tone}">${figure(p, '', true)}<span class="sh-tag">${h(p.name)}<b>${money(p.price_cents)}</b></span></a>`).join('')}</div>` : ''}</div></section>`;
    },
  },
  'shop-featured': {
    label: 'Carrusel de destacados', group: 'Tienda', icon: 'rail', desc: 'Tarjetas grandes de color que avanzan solas.',
    fields: [F.title(), { k: 'pick', l: 'Productos (vacío = los primeros con precio)', t: 'list', max: 12, f: [{ k: 'slug', l: 'Producto', t: 'sel', o: 'products' }] }, { k: 'count', l: 'Cuántos mostrar si no eliges', t: 'num' }],
    defaults: () => ({ title: 'Lo más pedido', pick: [], count: 8 }),
    render: (d, c) => {
      if (c.q || c.c) return '';
      const chosen = (d.pick || []).map((x) => c.products.find((p) => p.slug === x.slug)).filter(Boolean);
      const list = chosen.length ? chosen : c.products.filter((p) => p.price_cents != null && !art(p).photo).slice(0, +d.count || 8);
      if (!list.length) return '';
      const on = (t) => (/^#(e8dcc0|c9a24a)$/i.test(t) ? '#14202c' : '#ffffff');
      return `<section class="sf" aria-label="${h(d.title || 'Destacados')}"><div class="wrap sf-head"><h2>${mi(d.title)}</h2><div class="sf-nav"><button type="button" data-rail="-1" aria-label="Anterior">${SI.back}</button><button type="button" data-rail="1" aria-label="Siguiente">${SI.arrow}</button></div></div>
  <div class="sf-rail" data-rail-track tabindex="0">${list.map((p, i) => { const a = art(p); return `<a class="sf-card" href="/tienda/${h(p.slug)}" style="--tone:${a.tone};--on:${on(a.tone)};--i:${i}"><span class="sf-txt"><b>${h(p.name)}</b><span>${money(p.price_cents)}</span><small>${h(p.category || '')}</small></span><i class="sf-ring"></i>${figure(p, '', i < 2)}<span class="sf-go">${SI.arrow}</span></a>`; }).join('')}</div>
  <div class="sf-dots" data-rail-dots aria-hidden="true">${list.map(() => '<i></i>').join('')}</div></section>`;
    },
  },
  'shop-catalog': {
    label: 'Catálogo con filtros', group: 'Tienda', icon: 'cards', desc: 'Pestañas por categoría, contador y tarjetas de producto.',
    fields: [{ k: 'all_label', l: 'Pestaña de todos los productos', t: 'text' }, { k: 'note', l: 'Nota debajo de las pestañas', t: 'text' }, { k: 'empty', l: 'Mensaje cuando no hay resultados', t: 'text' }],
    defaults: () => ({ all_label: 'Todo', note: 'Precios referenciales en soles. Confirmamos stock, tallas y entrega antes de cualquier pago.', empty: 'No encontramos productos' }),
    render: (d, c) => {
      const { q, c: cat } = c, full = !q && !cat;
      const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const products = c.products.filter((p) => (!cat || p.cslug === cat) && (!q || norm(p.name + ' ' + p.description + ' ' + p.category).includes(norm(q))));
      const count = (slug) => c.products.filter((p) => p.cslug === slug).length;
      return `<section class="wrap ss" ${full ? 'data-filter' : ''}>
  <nav class="st" aria-label="Categorías"><a href="/tienda${q ? `?q=${encodeURIComponent(q)}` : ''}" data-cat="" ${!cat ? 'aria-current="true"' : ''}>${h(d.all_label || 'Todo')}<small>${c.products.length}</small></a>${c.categories.map((k) => `<a href="/tienda?c=${h(k.slug)}${q ? `&q=${encodeURIComponent(q)}` : ''}" data-cat="${h(k.slug)}" ${cat === k.slug ? 'aria-current="true"' : ''}>${h(k.name)}<small>${count(k.slug)}</small></a>`).join('')}<span class="st-bar" aria-hidden="true"></span></nav>
  <p class="ss-note"><b data-shown>${products.length}</b> productos${d.note ? ` · ${h(d.note)}` : ''}</p>
  <div class="sg" data-grid>${products.map(shopCard).join('')}</div>
  <div class="empty" data-empty ${products.length ? 'hidden' : ''}><p>${h(d.empty)}${q ? ` para “${h(q)}”` : ''}.</p><a class="btn ghost" href="/tienda">Ver todo el catálogo</a> <a class="btn wa" href="${wa(c.s.whatsapp, `Hola, busco: ${q || 'un equipo de protección'}`)}" target="_blank" rel="noopener">${ICON.wa}Preguntar por WhatsApp</a></div></section>`;
    },
  },
  cart: {
    label: 'Carrito y formulario de pedido', group: 'Tienda', icon: 'cart', desc: 'Lista del pedido y datos para confirmar.',
    fields: [F.title(), { k: 'lead', l: 'Texto', t: 'md' }, { k: 'form_title', l: 'Título del formulario', t: 'text' },
      { k: 'pickup', l: 'Opción de recojo', t: 'text' }, { k: 'ship', l: 'Opción de envío', t: 'text' }, { k: 'notes', l: 'Etiqueta de notas', t: 'text' }, { k: 'button', l: 'Botón de enviar', t: 'text' }],
    defaults: () => ({ title: 'Tu pedido', lead: 'Revisa los productos y envíanos la solicitud. Te confirmamos stock, total y entrega por WhatsApp o llamada. Aún no cobramos en línea.',
      form_title: 'Datos para confirmar', pickup: 'Recojo (te indicamos el punto)', ship: 'Envío (costo según destino, se confirma antes de pagar)', notes: 'Notas (tallas, destino, factura)', button: 'Enviar solicitud de pedido' }),
    render: (d, c) => `<section class="wrap detail cart"><h1>${mi(d.title)}</h1>${d.lead ? `<p class="lead">${mi(d.lead)}</p>` : ''}
  <div data-cart-root><p class="loading">Cargando tu pedido…</p></div>
  <script type="application/json" id="catalog">${JSON.stringify(c.products.map(({ slug, name, price_cents, image, availability }) => ({ slug, name, price: price_cents, image, availability }))).replace(/</g, '\\u003c')}</script>
  <form class="form order" method="post" action="/pedido" data-order hidden>
    <input type="hidden" name="items"><input type="hidden" name="_t" value="${Date.now()}">
    <div class="hp" aria-hidden="true"><label>No llenar <input name="website" tabindex="-1" autocomplete="off"></label></div>
    <h2 class="h3">${h(d.form_title)}</h2>
    <div class="row2"><label>Nombre<input name="name" required maxlength="120" autocomplete="name"></label>
    <label>Teléfono o WhatsApp<input name="phone" required maxlength="30" inputmode="tel" autocomplete="tel"></label></div>
    <fieldset class="opts"><legend>Entrega</legend>
      <label><input type="radio" name="delivery" value="recojo" checked> ${h(d.pickup)}</label>
      <label><input type="radio" name="delivery" value="envio"> ${h(d.ship)}</label></fieldset>
    <label>${h(d.notes)}<textarea name="message" maxlength="1500" rows="3"></textarea></label>
    <p class="form-msg" role="status" aria-live="polite"></p>
    <button class="btn gold" type="submit">${h(d.button)}</button></form></section>`,
  },

  // ======================= Contacto =======================
  'contact-kinetic': {
    label: 'Cabecera de contacto', group: 'Contacto', icon: 'type', desc: 'Palabra gigante animada con correo, WhatsApp, teléfono y ubicación.',
    fields: [{ k: 'word', l: 'Palabra gigante', t: 'text' }, { k: 'l_mail', l: 'Etiqueta del correo', t: 'text' }, { k: 'l_wa', l: 'Etiqueta de WhatsApp', t: 'text' }, { k: 'l_tel', l: 'Etiqueta del teléfono', t: 'text' }, { k: 'l_city', l: 'Etiqueta de la ubicación', t: 'text' }],
    defaults: () => ({ word: 'CONTACTO', l_mail: 'Correo', l_wa: 'WhatsApp', l_tel: 'Teléfono', l_city: 'Ubicación' }),
    render: (d, c) => { const s = c.s, w = String(d.word || 'CONTACTO').toUpperCase().slice(0, 14); return `<section class="kc"><div class="wrap">
  <ul class="kc-info"><li><span>${h(d.l_mail)}</span><a href="mailto:${h(s.email)}">${h(s.email)}</a></li>
    <li><span>${h(d.l_wa)}</span><a href="${wa(s.whatsapp, 'Hola, quiero hacer una consulta.')}" target="_blank" rel="noopener">${h(s.phone_1)}</a></li>
    ${s.phone_2 ? `<li><span>${h(d.l_tel)}</span><a href="tel:+51${h(s.phone_2.replace(/\D/g, ''))}">${h(s.phone_2)}</a></li>` : ''}<li><span>${h(d.l_city)}</span>${h(s.city)}</li></ul>
  <h1 class="kc-word" aria-label="${h(w)}" data-kinetic>${[...w].map((ch, i) => `<span aria-hidden="true" style="--i:${i}">${h(ch)}</span>`).join('')}</h1></div></section>`; },
  },
  'contact-form': {
    label: 'Formulario de contacto', group: 'Contacto', icon: 'form', desc: 'Título, texto y formulario de correo y mensaje.',
    fields: [F.title(), { k: 'text', l: 'Texto', t: 'md' }, { k: 'kind', l: 'Tipo de solicitud', t: 'sel', o: [['contacto', 'Consulta'], ['cotizacion', 'Cotización']] }],
    defaults: () => ({ title: 'Escríbenos en dos líneas', text: 'Déjanos tu correo y lo que necesitas. Te respondemos con la cotización o la información.', kind: 'contacto' }),
    render: (d, c) => `<section class="wrap kc-form"><div class="kc-lead reveal"><h2>${mi(d.title)}</h2>${md(d.text)}</div>${leadForm({ kind: d.kind, subject: c.asunto || '' })}</section>`,
  },

  // ======================= Portafolio =======================
  'pf-hero': {
    label: 'Portada del portafolio', group: 'Portafolio', icon: 'user', pf: 1, desc: 'Nombre en letras grandes, foto recortada, cifras y botones.',
    fields: [{ k: 'eyebrow', l: 'Saludo', t: 'text' }, { k: 'first', l: 'Nombre (primera línea)', t: 'text' }, { k: 'last', l: 'Apellido (segunda línea)', t: 'text' }, { k: 'full', l: 'Nombre completo', t: 'text' },
      { k: 'role', l: 'Profesión', t: 'text' }, { k: 'badge', l: 'Dato destacado (ej. CIP)', t: 'text' }, { k: 'intro', l: 'Presentación', t: 'area' }, { k: 'photo', l: 'Foto (PNG o WebP sin fondo)', t: 'img' },
      { k: 'wa_label', l: 'Botón de WhatsApp · texto', t: 'text' }, { k: 'wa_text', l: 'Botón de WhatsApp · mensaje', t: 'text' }, ...BTN(2),
      { k: 'facts', l: 'Cifras', t: 'list', max: 4, f: [{ k: 'v', l: 'Número', t: 'text' }, { k: 'suf', l: 'Sufijo (+, %)', t: 'text' }, { k: 'l', l: 'Texto', t: 'text' }] },
      { k: 'chips', l: 'Etiquetas flotantes (una por línea, hasta 4)', t: 'lines' }, { k: 'vertical', l: 'Texto vertical', t: 'text' }, { k: 'back', l: 'Texto que se desplaza al fondo', t: 'text' }],
    defaults: () => ({ eyebrow: 'Hola, soy', first: PROFILE.first.toUpperCase(), last: 'TENORIO', full: 'Ing. ' + PROFILE.name, role: PROFILE.role, badge: 'CIP ' + PROFILE.cip, intro: PROFILE.intro,
      photo: '/img/brand/jhossi-cut.webp', wa_label: 'Escribir por WhatsApp', wa_text: `Hola Ing. ${PROFILE.first}, vengo de su portafolio en la web de Imagroup.`, btn2_label: 'Ver trayectoria', btn2_link: '#trayectoria',
      facts: facts(), chips: PROFILE.tags.slice(0, 4).join('\n'), vertical: `Ingeniero ambiental — CIP ${PROFILE.cip}`, back: 'INGENIERÍA AMBIENTAL · RESIDUOS SÓLIDOS · AGUA Y SANEAMIENTO · GESTIÓN MUNICIPAL' }),
    render: (d, c) => {
      const L = (t, o) => [...String(t || '').toUpperCase()].map((ch, i) => `<i style="--i:${i + o}">${h(ch)}</i>`).join('');
      const photo = safeUrl(d.photo), isCut = photo === '/img/brand/jhossi-cut.webp';
      return `<section class="ph" data-ph><div class="ph-glow" aria-hidden="true"></div>
    ${d.back ? `<div class="ph-back" aria-hidden="true"><div>${[0, 1].map(() => `<span>${h(d.back)} · </span>`).join('')}</div></div>` : ''}
    <div class="wrap ph-in"><div class="ph-tx">
        ${d.eyebrow ? `<p class="pf-eyebrow rise" style="--d:0">${h(d.eyebrow)}</p>` : ''}
        <h1 class="ph-name" aria-label="${h(d.full || d.first + ' ' + d.last)}"><span class="ph-l1" aria-hidden="true">${L(d.first, 0)}</span><span class="ph-l2" aria-hidden="true">${L(d.last, String(d.first || '').length)}</span></h1>
        <p class="ph-role rise" style="--d:3">${h(d.role)}${d.badge ? ` · <b>${h(d.badge)}</b>` : ''}</p>
        ${d.intro ? `<p class="pf-intro rise" style="--d:4">${mi(d.intro)}</p>` : ''}
        <div class="pf-cta rise" style="--d:5">${d.wa_label ? `<a class="btn gold" href="${wa(c.s.whatsapp, d.wa_text || 'Hola')}" target="_blank" rel="noopener">${ICON.wa}${h(d.wa_label)}</a>` : ''}${d.btn2_label ? `<a class="btn pf-ghost" href="${h(safeUrl(d.btn2_link))}">${h(d.btn2_label)} <span aria-hidden="true">→</span></a>` : ''}</div>
        ${d.facts?.length ? `<ul class="ph-facts rise" style="--d:6">${d.facts.map((f) => `<li><b data-count="${h(String(f.v).replace(/\D/g, '') || 0)}" data-suf="${h(f.suf)}">${h(f.v)}${h(f.suf)}</b><span>${h(f.l)}</span></li>`).join('')}</ul>` : ''}
      </div>
      <div class="ph-media"><div class="ph-halo" aria-hidden="true"></div>
        ${photo ? `<figure class="ph-photo"><img src="${h(isCut ? photo + '?v=2' : photo)}"${isCut ? ' srcset="/img/brand/jhossi-cut-sm.webp?v=2 560w, /img/brand/jhossi-cut.webp?v=2 900w" sizes="(max-width: 760px) 86vw, 44vw" width="900" height="1200"' : ''} alt="${h(d.full)}" fetchpriority="high"></figure>` : ''}
        <ul class="ph-chips" aria-hidden="true">${lines(d.chips).slice(0, 4).map((t, i) => `<li style="--i:${i}">${h(t)}</li>`).join('')}</ul></div>
      ${d.vertical ? `<p class="ph-vert" aria-hidden="true">${h(d.vertical)}</p>` : ''}</div></section>`;
    },
  },
  'pf-marquee': {
    label: 'Cinta de palabras', group: 'Portafolio', icon: 'marquee', pf: 1, desc: 'Palabras clave que se desplazan sin parar.',
    fields: [{ k: 'items', l: 'Palabras (una por línea)', t: 'lines' }],
    defaults: () => ({ items: PROFILE.tags.concat(PROFILE.tools.map((t) => t[0]).slice(0, 4)).join('\n') }),
    render: (d) => `<div class="pf-marquee" aria-hidden="true"><div>${[0, 1].map(() => `<span>${lines(d.items).map((t) => `<b>${h(t)}</b><i>✦</i>`).join('')}</span>`).join('')}</div></div>`,
  },
  'pf-spec': {
    label: 'Especialidades (carrusel)', group: 'Portafolio', icon: 'rail', pf: 1, desc: 'Tarjetas con foto que se deslizan.',
    fields: [F.eyebrow, F.title(), { k: 'areas', l: 'Tarjetas', t: 'list', f: [{ k: 't', l: 'Título', t: 'text' }, { k: 'd', l: 'Texto', t: 'area' }, { k: 'img', l: 'Foto', t: 'img' }] }],
    defaults: () => ({ eyebrow: 'Especialidades', title: 'Lo que hace en **campo**', areas: PROFILE.areas.map((a) => ({ t: a.t, d: a.d, img: a.img + '-sm.webp' })) }),
    render: (d) => `<section class="pf-sec pf-spec"><div class="wrap">
    <header class="pf-head reveal"><div><p class="pf-eyebrow">${h(d.eyebrow)}</p><h2>${pfMark(d.title)}</h2></div><div class="pf-arrows"><button type="button" data-car="-1" aria-label="Anterior">←</button><button type="button" data-car="1" aria-label="Siguiente">→</button></div></header>
    <div class="pf-car" data-carousel tabindex="0" aria-roledescription="carrusel" aria-label="${h(d.eyebrow)}">
      ${(d.areas || []).map((a, i) => `<article class="pf-c" data-i="${i}" aria-label="${h(a.t)}"><figure>${imgTag(pfImg(a.img), a.t)}</figure>
        <div class="pf-c-tx"><span class="pf-num">${String(i + 1).padStart(2, '0')}</span><h3>${h(a.t)}</h3><p>${h(a.d)}</p></div></article>`).join('')}</div>
    <div class="pf-dots" role="tablist" aria-label="Elegir">${(d.areas || []).map((a, i) => `<button type="button" role="tab" data-dot="${i}" aria-label="${h(a.t)}"></button>`).join('')}</div></div></section>`,
  },
  'pf-jobs': {
    label: 'Trayectoria (línea de tiempo)', group: 'Portafolio', icon: 'timeline', pf: 1, desc: 'Cargos en una fila deslizable con barra de progreso.',
    fields: [F.eyebrow, F.title(), { k: 'jobs', l: 'Cargos', t: 'list', f: [{ k: 'y', l: 'Año', t: 'text' }, { k: 'p', l: 'Periodo', t: 'text' }, { k: 'role', l: 'Cargo', t: 'text' }, { k: 'org', l: 'Institución', t: 'text' },
      { k: 'note', l: 'Nota', t: 'text' }, { k: 'now', l: 'Cargo actual', t: 'bool' }, { k: 'extra', l: 'Encargaturas (una por línea)', t: 'lines' }] }],
    defaults: () => ({ eyebrow: 'Experiencia laboral', title: `Trayectoria de **${PROFILE.since} a hoy**`, jobs: PROFILE.jobs.map((j) => ({ y: j.y, p: j.p, role: j.role, org: j.org, note: j.note || '', now: !!j.now, extra: (j.extra || []).join('\n') })) }),
    render: (d) => `<section class="pf-sec pf-alt" id="trayectoria"><div class="wrap">
    <header class="pf-head reveal"><div><p class="pf-eyebrow">${h(d.eyebrow)}</p><h2>${pfMark(d.title)}</h2></div><div class="pf-arrows"><button type="button" data-rail="-1" aria-label="Anterior">←</button><button type="button" data-rail="1" aria-label="Siguiente">→</button></div></header></div>
    <div class="pf-rail" data-railbox tabindex="0" aria-label="${h(d.eyebrow)}">
      ${(d.jobs || []).map((j, i) => { const ex = lines(j.extra); return `<article class="pf-job${j.now ? ' now' : ''}" style="--i:${i}"><span class="pf-dot" aria-hidden="true"></span><p class="pf-per"><span class="pf-year">${h(j.y)}</span>${h(j.p)}${j.now ? ' <em>Actual</em>' : ''}</p>
        <h3>${h(j.role)}</h3><p class="pf-org">${h(j.org)}</p>${j.note ? `<p class="pf-note">${h(j.note)}</p>` : ''}
        ${ex.length ? `<details><summary>${ex.length} encargaturas</summary><ul>${ex.map((e) => `<li>${h(e)}</li>`).join('')}</ul></details>` : ''}</article>`; }).join('')}</div>
    <div class="wrap"><div class="pf-progress" aria-hidden="true"><span data-rail-bar></span></div></div></section>`,
  },
  'pf-study': {
    label: 'Formación con pestañas', group: 'Portafolio', icon: 'tabs', pf: 1, desc: 'Grados, diplomados, cursos, software e idiomas.',
    fields: [F.eyebrow, F.title(), { k: 'study', l: 'Estudios', t: 'list', f: [{ k: 'k', l: 'Tipo', t: 'sel', o: [['grado', 'Grado'], ['diplomado', 'Diplomado'], ['curso', 'Curso']] }, { k: 'y', l: 'Año', t: 'text' }, { k: 't', l: 'Título', t: 'text' }, { k: 'o', l: 'Institución', t: 'text' }] },
      { k: 'tools', l: 'Software', t: 'list', f: [{ k: 't', l: 'Nombre', t: 'text' }, { k: 'd', l: 'Detalle', t: 'text' }] },
      { k: 'langs', l: 'Idiomas', t: 'list', f: [{ k: 't', l: 'Idioma', t: 'text' }, { k: 'd', l: 'Nivel', t: 'text' }] }],
    defaults: () => ({ eyebrow: 'Formación y herramientas', title: 'Estudios, cursos y **software**', study: PROFILE.study.map((x) => ({ k: x.k, y: x.y, t: x.t, o: x.o })),
      tools: PROFILE.tools.map(([t, dd]) => ({ t, d: dd })), langs: PROFILE.langs.map(([t, dd]) => ({ t, d: dd })) }),
    render: (d) => {
      const st = d.study || [], soft = (d.tools || []).length + (d.langs || []).length;
      const tabs = [['grado', 'Grados'], ['diplomado', 'Diplomados'], ['curso', 'Cursos'], ['soft', 'Software e idiomas']].filter(([k]) => (k === 'soft' ? soft : st.some((x) => x.k === k)));
      const n = (k) => (k === 'soft' ? soft : st.filter((x) => x.k === k).length), first = tabs[0]?.[0];
      return `<section class="pf-sec"><div class="wrap">
    <header class="pf-head reveal"><div><p class="pf-eyebrow">${h(d.eyebrow)}</p><h2>${pfMark(d.title)}</h2></div></header>
    <div class="chips pf-tabs" role="group" aria-label="Filtrar formación" data-study>${tabs.map(([k, l]) => `<button type="button" aria-pressed="${k === first}" data-k="${k}">${l} <small>${n(k)}</small></button>`).join('')}</div>
    <ul class="pf-study">${st.map((x) => `<li data-k="${h(x.k)}"${x.k === first ? '' : ' hidden'}><span class="pf-year">${h(x.y)}</span><div><b>${h(x.t)}</b><span>${h(x.o)}</span></div></li>`).join('')}
      ${(d.tools || []).map((x) => `<li data-k="soft"${first === 'soft' ? '' : ' hidden'}><span class="pf-year">SW</span><div><b>${h(x.t)}</b><span>${h(x.d)}</span></div></li>`).join('')}
      ${(d.langs || []).map((x) => `<li data-k="soft"${first === 'soft' ? '' : ' hidden'}><span class="pf-year">ES/EN</span><div><b>${h(x.t)}</b><span>${h(x.d)}</span></div></li>`).join('')}</ul></div></section>`;
    },
  },
  'pf-gallery': {
    label: 'Fotos en movimiento', group: 'Portafolio', icon: 'gallery', pf: 1, desc: 'Fila de fotos que se desplaza sola.',
    fields: [{ k: 'images', l: 'Fotos', t: 'list', f: [{ k: 'src', l: 'Foto', t: 'img' }] }],
    defaults: () => ({ images: PROFILE.gallery.map((g) => ({ src: `/img/f/${g}-sm.webp` })) }),
    render: (d) => `<section class="pf-gal" aria-label="Fotos"><div class="pf-gal-row"><div>${[0, 1].map((dup) => (d.images || []).map((g) => `<figure${dup ? ' aria-hidden="true"' : ''}>${imgTag(g.src, '')}</figure>`).join('')).join('')}</div></div></section>`,
  },
  'pf-end': {
    label: 'Cierre con contacto', group: 'Portafolio', icon: 'cta', pf: 1, desc: 'Pregunta que se escribe sola y botones de contacto.',
    fields: [F.eyebrow, { k: 'title', l: 'Pregunta (se escribe letra por letra)', t: 'text' }, { k: 'text', l: 'Texto', t: 'text' },
      { k: 'wa_label', l: 'Botón de WhatsApp · texto', t: 'text' }, { k: 'wa_text', l: 'Botón de WhatsApp · mensaje', t: 'text' }, ...BTN(2), { k: 'fine', l: 'Nota final', t: 'text' }],
    defaults: (c) => ({ eyebrow: 'Contacto', title: '¿Tiene un proyecto ambiental o municipal?', text: 'Conversemos sobre alcance, plazos y costos.', wa_label: `WhatsApp ${c.s.phone_1 || ''}`.trim(),
      wa_text: `Hola Ing. ${PROFILE.first}, quisiera conversar sobre un proyecto.`, btn2_label: 'Enviar un mensaje', btn2_link: `/contacto?asunto=${encodeURIComponent('Consulta para el Ing. ' + PROFILE.first + ' Tenorio')}`,
      fine: 'La información de este portafolio puede acreditarse con documentos a solicitud.' }),
    render: (d, c) => `<section class="pf-sec pf-end"><div class="wrap"><div class="glow-box reveal">
    <p class="pf-eyebrow">${h(d.eyebrow)}</p><h2><span data-type="${h(d.title)}">${h(d.title)}</span><span class="caret" aria-hidden="true"></span></h2>
    ${d.text ? `<p class="pf-intro">${h(d.text)}</p>` : ''}
    <div class="pf-cta">${d.wa_label ? `<a class="btn gold" href="${wa(c.s.whatsapp, d.wa_text || 'Hola')}" target="_blank" rel="noopener">${ICON.wa}${h(d.wa_label)}</a>` : ''}${d.btn2_label ? `<a class="btn pf-ghost" href="${h(safeUrl(d.btn2_link))}">${h(d.btn2_label)}</a>` : ''}</div>
    ${d.fine ? `<p class="pf-fine">${h(d.fine)}</p>` : ''}</div></div></section>`,
  },

  // ======================= Equipo =======================
  'team-head': {
    label: 'Portada del equipo', group: 'Equipo', icon: 'hero', desc: 'Título y texto de presentación de la página Equipo.',
    fields: [{ k: 'title', l: 'Título', t: 'text' }, { k: 'lead', l: 'Texto', t: 'md' }],
    defaults: () => ({ title: 'Nuestro equipo de obra', lead: 'Notas reales de **puntualidad**, **garantía** y **calidad**, mes a mes.' }),
    render: (d) => `<section class="wrap tm-head"><h1 class="rise">${mi(d.title)}</h1>${d.lead ? `<div class="lead rise">${md(d.lead)}</div>` : ''}</section>`,
  },
  'team-grid': {
    label: 'Tarjetas del equipo', group: 'Equipo', icon: 'cards', desc: 'Cada trabajador con su foto, nivel, puntaje y estrellas. Los datos salen de Trabajadores.',
    fields: [{ k: 'title', l: 'Título sobre las tarjetas (opcional)', t: 'text' }, { k: 'show_unrated', l: 'Mostrar también a quienes aún no tienen evaluación aprobada', t: 'bool' }],
    defaults: () => ({ title: '', show_unrated: true }),
    render: (d) => teamGrid(d),
  },
  'team-method': {
    label: 'Cómo calificamos', group: 'Equipo', icon: 'list', desc: 'Los criterios y su peso, tomados de la metodología del panel.',
    fields: [{ k: 'title', l: 'Título', t: 'text' }, { k: 'text', l: 'Texto', t: 'area' }],
    defaults: () => ({ title: 'Cómo calificamos', text: 'Quien supervisa la obra califica de 1 a 5 cada criterio al cerrar el mes. Cada nota describe una conducta concreta y el administrador aprueba la evaluación antes de publicarla.' }),
    render: (d) => teamMethod(d),
  },
  // ======================= Bloques libres =======================
  hero: {
    label: 'Portada', group: 'Bloques libres', icon: 'hero', desc: 'Título grande con imagen, a un lado o de fondo.',
    fields: [F.eyebrow, { k: 'title', l: 'Título', t: 'area' }, { k: 'text', l: 'Texto', t: 'md' }, { k: 'image', l: 'Imagen', t: 'img' }, IMG_ALT,
      { k: 'layout', l: 'Ubicación de la imagen', t: 'sel', o: [['right', 'A la derecha'], ['left', 'A la izquierda'], ['back', 'De fondo'], ['none', 'Sin imagen']] }, ...BTN(1), ...BTN(2)],
    defaults: () => ({ eyebrow: 'Imagroup S.A.C.', title: 'Escribe aquí un titular claro', text: 'Explica en una o dos líneas qué ofreces y para quién.', image: '/img/f/agua-1.webp', image_alt: '', layout: 'right',
      btn1_label: 'Contáctanos', btn1_link: '/contacto', btn2_label: '', btn2_link: '' }),
    render: (d) => `<section class="bk-hero bk-hero-${h(d.layout)}">${d.layout === 'back' && d.image ? imgTag(d.image, d.image_alt, 'bk-hero-bg', true) : ''}
  <div class="wrap bk-hero-in"><div class="bk-hero-tx">${d.eyebrow ? `<p class="bk-eye">${h(d.eyebrow)}</p>` : ''}<h1>${mi(d.title)}</h1>${md(d.text)}
  <div class="bk-btns">${btn(d.btn1_label, d.btn1_link, 'gold')}${btn(d.btn2_label, d.btn2_link, 'ghost')}</div></div>
  ${d.image && (d.layout === 'right' || d.layout === 'left') ? `<figure class="bk-hero-img">${imgTag(d.image, d.image_alt, '', true)}</figure>` : ''}</div></section>`,
  },
  text: {
    label: 'Texto', group: 'Bloques libres', icon: 'type', desc: 'Título y párrafos, con negrita, enlaces y listas.',
    fields: [F.eyebrow, F.title(), { k: 'body', l: 'Texto', t: 'md' }, { k: 'align', l: 'Alineación', t: 'sel', o: [['left', 'Izquierda'], ['center', 'Centrada']] }, { k: 'width', l: 'Ancho', t: 'sel', o: [['narrow', 'Angosto (fácil de leer)'], ['wide', 'Ancho completo']] }],
    defaults: () => ({ eyebrow: '', title: 'Un título para esta sección', body: 'Escribe aquí. Usa **negrita**, *cursiva* o [un enlace](/contacto).\n\n- Una lista empieza con guion\n- Cada punto en su línea', align: 'left', width: 'narrow' }),
    render: (d) => `<section class="wrap bk-text bk-al-${h(d.align)} bk-w-${h(d.width)}">${head(d)}<div class="bk-prose">${md(d.body)}</div></section>`,
  },
  media: {
    label: 'Imagen y texto', group: 'Bloques libres', icon: 'media', desc: 'Una imagen junto a un texto; elige de qué lado va cada uno.',
    fields: [{ k: 'image', l: 'Imagen', t: 'img' }, IMG_ALT, F.eyebrow, F.title(), { k: 'body', l: 'Texto', t: 'md' }, ...BTN(1),
      { k: 'side', l: 'Lado de la imagen', t: 'sel', o: [['left', 'Izquierda'], ['right', 'Derecha']] }, { k: 'shape', l: 'Forma de la imagen', t: 'sel', o: [['round', 'Esquinas redondeadas'], ['circle', 'Círculo'], ['tilt', 'Inclinada'], ['blob', 'Orgánica']] }],
    defaults: () => ({ image: '/img/f/residuos-1.webp', image_alt: '', eyebrow: '', title: 'Título junto a la imagen', body: 'Cuenta aquí qué se ve en la foto o qué hace tu equipo.', btn1_label: '', btn1_link: '', side: 'left', shape: 'round' }),
    render: (d) => `<section class="wrap bk-media bk-side-${h(d.side)}"><figure class="bk-shape-${h(d.shape)}">${imgTag(d.image, d.image_alt)}</figure>
  <div>${head(d)}<div class="bk-prose">${md(d.body)}</div>${d.btn1_label ? `<div class="bk-btns">${btn(d.btn1_label, d.btn1_link)}</div>` : ''}</div></section>`,
  },
  cards: {
    label: 'Tarjetas', group: 'Bloques libres', icon: 'cards', desc: 'Varias tarjetas con imagen, título, texto y enlace.',
    fields: [F.eyebrow, F.title(), { k: 'items', l: 'Tarjetas', t: 'list', f: [{ k: 'image', l: 'Imagen', t: 'img' }, { k: 'title', l: 'Título', t: 'text' }, { k: 'text', l: 'Texto', t: 'area' }, { k: 'link', l: 'Enlace (opcional)', t: 'link' }] },
      { k: 'cols', l: 'Columnas en computadora', t: 'sel', o: [['2', '2'], ['3', '3'], ['4', '4']] }, { k: 'style', l: 'Estilo', t: 'sel', o: [['card', 'Tarjeta blanca'], ['color', 'Colores de marca'], ['plain', 'Sin fondo']] }],
    defaults: () => ({ eyebrow: '', title: 'Lo que ofrecemos', cols: '3', style: 'card', items: [
      { image: '/img/f/agua-2.webp', title: 'Primera tarjeta', text: 'Una o dos líneas que expliquen este punto.', link: '' },
      { image: '/img/f/solar-1.webp', title: 'Segunda tarjeta', text: 'Una o dos líneas que expliquen este punto.', link: '' },
      { image: '/img/f/educacion-1.webp', title: 'Tercera tarjeta', text: 'Una o dos líneas que expliquen este punto.', link: '' }] }),
    render: (d) => `<section class="wrap bk-cards">${head(d)}<div class="bk-grid bk-cols-${h(d.cols)} bk-cs-${h(d.style)}">${(d.items || []).map((it, i) => {
      const tag = it.link ? 'a' : 'article';
      return `<${tag} class="bk-card" style="--i:${i}"${it.link ? ` href="${h(safeUrl(it.link))}"` : ''}>${it.image ? `<figure>${imgTag(it.image, '')}</figure>` : ''}<div><h3>${h(it.title)}</h3>${it.text ? `<p>${mi(it.text)}</p>` : ''}${it.link ? `<span class="bk-more">${SI.arrow}</span>` : ''}</div></${tag}>`;
    }).join('')}</div></section>`,
  },
  gallery: {
    label: 'Galería', group: 'Bloques libres', icon: 'gallery', desc: 'Fotos en cuadrícula, mosaico o cinta en movimiento.',
    fields: [F.eyebrow, F.title(), { k: 'images', l: 'Fotos', t: 'list', f: [{ k: 'src', l: 'Foto', t: 'img' }, { k: 'alt', l: 'Descripción', t: 'text' }] },
      { k: 'style', l: 'Estilo', t: 'sel', o: [['grid', 'Cuadrícula'], ['mosaic', 'Mosaico'], ['marquee', 'Cinta en movimiento']] }],
    defaults: () => ({ eyebrow: '', title: 'Galería', style: 'grid', images: ['vial-1', 'agua-3', 'residuos-2', 'solar-2', 'educacion-2', 'organicos-1'].map((g) => ({ src: `/img/f/${g}-sm.webp`, alt: '' })) }),
    render: (d) => {
      const ims = d.images || [];
      if (d.style === 'marquee') return `<section class="bk-gal-mq">${head({ ...d, title: d.title })}<div class="pf-gal-row"><div>${[0, 1].map((dup) => ims.map((g) => `<figure${dup ? ' aria-hidden="true"' : ''}>${imgTag(g.src, dup ? '' : g.alt)}</figure>`).join('')).join('')}</div></div></section>`;
      return `<section class="wrap bk-gal bk-gal-${h(d.style)}">${head(d)}<div>${ims.map((g, i) => `<figure style="--i:${i}">${imgTag(g.src, g.alt)}</figure>`).join('')}</div></section>`;
    },
  },
  stats: {
    label: 'Cifras', group: 'Bloques libres', icon: 'stats', desc: 'Números grandes que cuentan hacia arriba al aparecer.',
    fields: [F.eyebrow, F.title(), { k: 'items', l: 'Cifras', t: 'list', max: 6, f: [{ k: 'v', l: 'Número', t: 'text' }, { k: 'suf', l: 'Sufijo (+, %)', t: 'text' }, { k: 'l', l: 'Texto', t: 'text' }] }],
    defaults: () => ({ eyebrow: '', title: '', items: [{ v: '10', suf: '+', l: 'Cambia este texto' }, { v: '25', suf: '', l: 'Cambia este texto' }, { v: '100', suf: '%', l: 'Cambia este texto' }] }),
    render: (d) => `<section class="wrap bk-stats">${head(d)}<ul>${(d.items || []).map((f, i) => `<li style="--i:${i}"><b data-count="${h(String(f.v).replace(/\D/g, '') || 0)}" data-suf="${h(f.suf)}">${h(f.v)}${h(f.suf)}</b><span>${h(f.l)}</span></li>`).join('')}</ul></section>`,
  },
  steps: {
    label: 'Pasos', group: 'Bloques libres', icon: 'timeline', desc: 'Proceso numerado: cómo trabajamos, cómo comprar…',
    fields: [F.eyebrow, F.title(), { k: 'items', l: 'Pasos', t: 'list', f: [{ k: 'title', l: 'Título', t: 'text' }, { k: 'text', l: 'Texto', t: 'area' }] }],
    defaults: () => ({ eyebrow: 'Cómo trabajamos', title: 'Así de simple', items: [{ title: 'Nos escribes', text: 'Cuéntanos qué necesitas.' }, { title: 'Te cotizamos', text: 'Recibes alcance, plazo y precio.' }, { title: 'Ejecutamos', text: 'Nuestro equipo se encarga en campo.' }] }),
    render: (d) => `<section class="wrap bk-steps">${head(d)}<ol>${(d.items || []).map((s, i) => `<li style="--i:${i}"><span>${String(i + 1).padStart(2, '0')}</span><h3>${h(s.title)}</h3><p>${mi(s.text)}</p></li>`).join('')}</ol></section>`,
  },
  faq: {
    label: 'Preguntas frecuentes', group: 'Bloques libres', icon: 'faq', desc: 'Preguntas que se abren al tocarlas.',
    fields: [F.eyebrow, F.title(), { k: 'items', l: 'Preguntas', t: 'list', f: [{ k: 'q', l: 'Pregunta', t: 'text' }, { k: 'a', l: 'Respuesta', t: 'md' }] }],
    defaults: () => ({ eyebrow: '', title: 'Preguntas frecuentes', items: [{ q: '¿Escribe aquí una pregunta?', a: 'Y aquí su respuesta.' }, { q: '¿Otra pregunta?', a: 'Otra respuesta.' }] }),
    render: (d) => `<section class="wrap bk-faq">${head(d)}<div>${(d.items || []).map((f) => `<details><summary>${h(f.q)}<i aria-hidden="true"></i></summary><div class="bk-prose">${md(f.a)}</div></details>`).join('')}</div></section>`,
  },
  cta: {
    label: 'Llamado a la acción', group: 'Bloques libres', icon: 'cta', desc: 'Franja llamativa con título y botones.',
    fields: [F.title(), { k: 'text', l: 'Texto', t: 'md' }, ...BTN(1), ...BTN(2), { k: 'style', l: 'Color', t: 'sel', o: [['blue', 'Azul'], ['gold', 'Dorado'], ['dark', 'Oscuro'], ['green', 'Verde']] }],
    defaults: () => ({ title: '¿Listo para empezar?', text: 'Escríbenos y te respondemos el mismo día.', btn1_label: 'Escribir por WhatsApp', btn1_link: '/contacto', btn2_label: '', btn2_link: '', style: 'blue' }),
    render: (d) => `<section class="wrap"><div class="bk-cta bk-cta-${h(d.style)}"><i aria-hidden="true"></i><div><h2>${mi(d.title)}</h2>${md(d.text)}</div><div class="bk-btns">${btn(d.btn1_label, d.btn1_link, 'gold')}${btn(d.btn2_label, d.btn2_link, 'ghost')}</div></div></section>`,
  },
  marquee: {
    label: 'Texto en movimiento', group: 'Bloques libres', icon: 'marquee', desc: 'Una cinta de palabras que se desplaza.',
    fields: [{ k: 'items', l: 'Palabras (una por línea)', t: 'lines' }, { k: 'style', l: 'Estilo', t: 'sel', o: [['outline', 'Letras huecas grandes'], ['band', 'Cinta de color']] }],
    defaults: () => ({ items: 'Ingeniería ambiental\nSeguridad industrial\nObras\nEquipos de protección', style: 'band' }),
    render: (d) => `<div class="bk-mq bk-mq-${h(d.style)}" aria-hidden="true"><div>${[0, 1].map(() => `<span>${lines(d.items).map((t) => `<b>${h(t)}</b><i>✦</i>`).join('')}</span>`).join('')}</div></div>`,
  },
  products: {
    label: 'Productos', group: 'Bloques libres', icon: 'cart', desc: 'Tarjetas de productos de la tienda, de una categoría o de todas.',
    fields: [F.eyebrow, F.title(), { k: 'category', l: 'Categoría', t: 'sel', o: 'categories' }, { k: 'count', l: 'Cuántos', t: 'num' }, { k: 'link_label', l: 'Enlace · texto', t: 'text' }, F.link('link', 'Enlace · dirección')],
    defaults: () => ({ eyebrow: 'Tienda Gregorian', title: 'Equipos de protección', category: '', count: 4, link_label: 'Ver la tienda', link: '/tienda' }),
    shop: 1,
    render: (d, c) => `<section class="wrap ss">${head(d)}<div class="sg">${c.products.filter((p) => !d.category || p.cslug === d.category).slice(0, +d.count || 4).map(shopCard).join('')}</div>${d.link_label ? `<p class="bk-btns">${btn(d.link_label, d.link, 'ghost')}</p>` : ''}</section>`,
  },
  form: {
    label: 'Formulario', group: 'Bloques libres', icon: 'form', desc: 'Formulario corto de correo y mensaje. Llega a Solicitudes.',
    fields: [F.title(), { k: 'text', l: 'Texto', t: 'md' }, { k: 'kind', l: 'Tipo de solicitud', t: 'sel', o: [['contacto', 'Consulta'], ['cotizacion', 'Cotización']] }, { k: 'subject', l: 'Asunto que llega al panel', t: 'text' }],
    defaults: () => ({ title: 'Escríbenos', text: 'Te respondemos a tu correo.', kind: 'contacto', subject: '' }),
    render: (d) => `<section class="wrap kc-form"><div class="kc-lead"><h2>${mi(d.title)}</h2>${md(d.text)}</div>${leadForm({ kind: d.kind, subject: d.subject })}</section>`,
  },
  whatsapp: {
    label: 'Botón de WhatsApp', group: 'Bloques libres', icon: 'chat', desc: 'Tarjeta con un botón que abre WhatsApp con un mensaje listo.',
    fields: [F.title(), { k: 'text', l: 'Texto', t: 'text' }, { k: 'label', l: 'Texto del botón', t: 'text' }, { k: 'message', l: 'Mensaje que se envía', t: 'text' }],
    defaults: () => ({ title: '¿Prefieres conversar?', text: 'Escríbenos y te atendemos directo.', label: 'Abrir WhatsApp', message: 'Hola, vengo de la web de Imagroup.' }),
    render: (d, c) => `<section class="wrap"><div class="bk-wa"><span class="bk-wa-ico">${ICON.wa}</span><div><h2>${mi(d.title)}</h2>${d.text ? `<p>${h(d.text)}</p>` : ''}</div><a class="btn wa" href="${wa(c.s.whatsapp, d.message || 'Hola')}" target="_blank" rel="noopener">${ICON.wa}${h(d.label)}</a></div></section>`,
  },
  buttons: {
    label: 'Botones', group: 'Bloques libres', icon: 'buttons', desc: 'Una fila de botones o enlaces.',
    fields: [{ k: 'items', l: 'Botones', t: 'list', max: 6, f: [{ k: 'label', l: 'Texto', t: 'text' }, { k: 'link', l: 'Enlace', t: 'link' }, { k: 'style', l: 'Estilo', t: 'sel', o: [['', 'Oscuro'], ['gold', 'Dorado'], ['ghost', 'Con borde'], ['wa', 'Verde']] }] },
      { k: 'align', l: 'Alineación', t: 'sel', o: [['left', 'Izquierda'], ['center', 'Centrada']] }],
    defaults: () => ({ items: [{ label: 'Ver servicios', link: '/servicios', style: '' }, { label: 'Ir a la tienda', link: '/tienda', style: 'gold' }], align: 'center' }),
    render: (d) => `<section class="wrap bk-btns bk-al-${h(d.align)}">${(d.items || []).map((b) => btn(b.label, b.link, b.style)).join('')}</section>`,
  },
  spacer: {
    label: 'Espacio o línea', group: 'Bloques libres', icon: 'spacer', desc: 'Separa dos bloques con aire o una línea.',
    fields: [{ k: 'size', l: 'Alto', t: 'sel', o: [['s', 'Pequeño'], ['m', 'Mediano'], ['l', 'Grande']] }, { k: 'line', l: 'Mostrar una línea', t: 'bool' }],
    defaults: () => ({ size: 'm', line: false }),
    render: (d) => `<div class="wrap bk-space bk-space-${h(d.size)}" aria-hidden="true">${d.line ? '<hr>' : ''}</div>`,
  },
};
function pfMark(t) { return mi(t).replace(/<b>(.*?)<\/b>/g, '<span class="pf-mark">$1</span>'); }

// Opciones de diseño que tiene todo bloque.
export const STYLE_FIELDS = [
  { k: '_bg', l: 'Fondo', t: 'sel', o: [['', 'Original'], ['soft', 'Suave'], ['dark', 'Oscuro'], ['brand', 'Azul de marca'], ['gold', 'Dorado'], ['grad', 'Degradado de marca']] },
  { k: '_pad', l: 'Espacio arriba y abajo', t: 'sel', o: [['', 'Original'], ['s', 'Compacto'], ['l', 'Amplio']] },
  { k: '_anim', l: 'Animación al aparecer', t: 'sel', o: [['', 'Ninguna extra'], ['up', 'Subir'], ['zoom', 'Acercar'], ['left', 'Desde la izquierda'], ['right', 'Desde la derecha'], ['tilt', 'Girar']] },
  { k: '_round', l: 'Esquinas redondeadas en la sección', t: 'bool' },
  { k: '_hide_m', l: 'Ocultar en celular', t: 'bool' }, { k: '_hide_d', l: 'Ocultar en computadora', t: 'bool' },
];

// Valores finales: lo guardado manda; un campo dinámico vacío toma el dato del panel.
export function resolve(type, data, ctx) {
  const B = BLOCKS[type], def = B.defaults(ctx), out = {};
  for (const f of B.fields) {
    const v = data?.[f.k];
    out[f.k] = v === undefined || (f.dyn && v === '') ? def[f.k] : v;
  }
  return out;
}

export function renderBlock(b, ctx, preview = false) {
  const B = BLOCKS[b.type];
  if (!B || (b.hidden && !preview)) return '';
  let html;
  try { html = B.render(resolve(b.type, b.data, ctx), ctx); } catch (e) { console.error('bloque', b.type, e); html = preview ? `<p class="wrap">Error en el bloque ${h(B.label)}.</p>` : ''; }
  const st = b.data || {}, cls = ['bk'];
  if (st._bg) cls.push('bk-bg-' + st._bg); if (st._pad) cls.push('bk-pad-' + st._pad); if (st._anim) cls.push('bk-an-' + st._anim);
  if (st._round) cls.push('bk-round'); if (st._hide_m) cls.push('bk-hide-m'); if (st._hide_d) cls.push('bk-hide-d'); if (b.hidden) cls.push('bk-off');
  if (B.pf) html = `<div class="pf">${html}</div>`;
  return `<div class="${cls.map(h).join(' ')}" id="b-${h(b.id)}"${preview ? ` data-bid="${h(b.id)}" data-blabel="${h(B.label)}"` : ''}>${html}</div>`;
}

// Bloques que necesitan la hoja de estilos de la tienda.
export const needsShop = (blocks) => blocks.some((b) => !b.hidden && (b.type.startsWith('shop-') || b.type === 'cart' || BLOCKS[b.type]?.shop));
