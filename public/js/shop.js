// Tienda: filtros al instante, carrusel, deslizar para agregar y animación al carrito.
(() => {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const vt = (fn) => {
    if (!document.startViewTransition || still) return fn();
    const t = document.startViewTransition(fn); [t.ready, t.finished].forEach((p) => p.catch(() => {}));
  };

  // Entrada escalonada de tarjetas
  const cards = $$('.sc');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -6% 0px' });
    cards.forEach((c) => io.observe(c));
    // Respaldo: si el observador no responde, las tarjetas visibles igual aparecen
    const sweep = () => cards.forEach((c) => { if (!c.classList.contains('in') && c.getBoundingClientRect().top < innerHeight) c.classList.add('in'); });
    setTimeout(sweep, 1500); addEventListener('scroll', () => { clearTimeout(sweep.t); sweep.t = setTimeout(sweep, 400); }, { passive: true });
  } else cards.forEach((c) => c.classList.add('in'));

  // Barra de la pestaña activa
  const tabs = $('.st');
  const bar = () => {
    const a = tabs && $('[aria-current]', tabs); if (!a) return;
    const bx = tabs.querySelector('.st-bar');
    bx.style.setProperty('--x', a.offsetLeft + 'px'); bx.style.setProperty('--w', a.offsetWidth + 'px');
  };
  bar(); addEventListener('resize', bar); document.fonts && document.fonts.ready.then(bar);

  // Filtrar por categoría y búsqueda sin recargar (solo cuando la página trae todo el catálogo)
  const box = $('[data-filter]');
  if (box) {
    const input = $('#q'), grid = $('[data-grid]'), empty = $('[data-empty]'), shown = $('[data-shown]');
    let cat = '';
    const apply = (animate = true) => {
      const q = norm(input && input.value.trim());
      const run = () => {
        let n = 0;
        $$('.sc', grid).forEach((c) => {
          const ok = (!cat || c.dataset.cat === cat) && (!q || c.dataset.text.includes(q));
          c.hidden = !ok; if (ok) { n++; c.classList.add('in'); }
        });
        shown.textContent = n; empty.hidden = n > 0;
      };
      animate ? vt(run) : run();
    };
    $$('a', tabs).forEach((a) => a.addEventListener('click', (e) => {
      e.preventDefault(); cat = a.dataset.cat;
      $$('a', tabs).forEach((x) => x.toggleAttribute('aria-current', x === a)); bar();
      a.scrollIntoView({ inline: 'center', block: 'nearest', behavior: still ? 'auto' : 'smooth' });
      history.replaceState(null, '', cat ? '?c=' + cat : location.pathname); apply();
    }));
    let t; input && input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => apply(false), 120); });
    $('[data-search]').addEventListener('submit', (e) => { e.preventDefault(); apply(); box.scrollIntoView({ behavior: still ? 'auto' : 'smooth' }); });
  }

  // Carrusel de destacados: flechas, puntos y avance automático
  const rail = $('[data-rail-track]');
  if (rail) {
    const dots = $$('[data-rail-dots] i'), step = () => (rail.firstElementChild ? rail.firstElementChild.offsetWidth + 18 : 300);
    const sync = () => { const i = Math.round(rail.scrollLeft / step()); dots.forEach((d, k) => d.classList.toggle('on', k === i)); };
    rail.addEventListener('scroll', () => requestAnimationFrame(sync), { passive: true }); sync();
    const go = (d) => {
      const end = rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 4;
      rail.scrollTo({ left: d > 0 && end ? 0 : rail.scrollLeft + d * step(), behavior: still ? 'auto' : 'smooth' });
    };
    $$('[data-rail]').forEach((b) => b.addEventListener('click', () => go(+b.dataset.rail)));
    let hold = still, timer = setInterval(() => { if (!hold && !document.hidden) go(1); }, 4200);
    ['pointerenter', 'focusin', 'touchstart'].forEach((ev) => rail.addEventListener(ev, () => { hold = true; }, { passive: true }));
    rail.addEventListener('pointerleave', () => { hold = still; });
    addEventListener('pagehide', () => clearInterval(timer));
  }

  // Movimiento del producto según el puntero
  $$('.sf-card, .pd-stage').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', ((e.clientX - r.left) / r.width - .5) * 2);
      el.style.setProperty('--my', ((e.clientY - r.top) / r.height - .5) * 2);
    });
    el.addEventListener('pointerleave', () => { el.style.setProperty('--mx', 0); el.style.setProperty('--my', 0); });
  });

  // Cantidad con + y −
  $$('[data-step]').forEach((b) => b.addEventListener('click', () => {
    const i = $('[data-qty]'); i.value = Math.max(1, Math.min(999, (parseInt(i.value, 10) || 1) + +b.dataset.step));
  }));

  // Miniaturas: producto recortado o volante original
  const shot = $('[data-shot]');
  $$('.pd-thumbs button').forEach((b) => b.addEventListener('click', () => {
    if (b.getAttribute('aria-pressed') === 'true') return;
    $$('.pd-thumbs button').forEach((x) => x.setAttribute('aria-pressed', x === b));
    const fig = $('.sp-fig', shot), img = $('img', fig);
    shot.classList.add('swap');
    setTimeout(() => {
      img.removeAttribute('width'); img.removeAttribute('height'); img.src = b.dataset.src;
      fig.classList.toggle('is-photo', b.dataset.photo === '1'); fig.classList.toggle('is-cut', b.dataset.photo !== '1');
      img.onload = () => shot.classList.remove('swap');
    }, still ? 0 : 220);
  }));

  // Deslizar para agregar (tocar también funciona: el clic lo maneja site.js)
  const sw = $('[data-swipe]');
  if (sw) {
    let x0 = null, moved = false, max = 0;
    sw.addEventListener('pointerdown', (e) => { x0 = e.clientX; moved = false; max = sw.offsetWidth - 62; sw.style.setProperty('--w', sw.offsetWidth + 'px'); });
    sw.addEventListener('pointermove', (e) => {
      if (x0 == null) return; const dx = Math.max(0, Math.min(max, e.clientX - x0));
      if (dx > 6) { moved = true; sw.classList.add('drag'); sw.setPointerCapture(e.pointerId); }
      sw.style.setProperty('--dx', dx + 'px');
    });
    const end = (e) => {
      if (x0 == null) return; const dx = e.clientX - x0; x0 = null; sw.classList.remove('drag'); sw.style.setProperty('--dx', '0px');
      if (moved && dx > max * .7) { moved = false; sw.click(); }
    };
    sw.addEventListener('pointerup', end); sw.addEventListener('pointercancel', end);
    // Un arrastre corto no debe agregar
    sw.addEventListener('click', (e) => { if (moved) { moved = false; e.stopImmediatePropagation(); e.preventDefault(); } }, true);
  }

  // Al agregar: el producto vuela al carrito, el carrito salta y el botón confirma
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-add]'); if (!b) return;
    const cart = $('.cart-link');
    if (b.matches('[data-swipe]')) {
      b.style.setProperty('--w', b.offsetWidth + 'px'); b.classList.add('done');
      const l = $('.pd-label', b), txt = l.textContent; l.textContent = '¡Agregado a tu pedido!';
      setTimeout(() => { b.classList.remove('done'); l.textContent = txt; }, 1800);
    }
    const src = (b.closest('.sc') && $('.sp-fig img', b.closest('.sc'))) || $('[data-shot] img');
    if (!src || !cart || still) return;
    const a = src.getBoundingClientRect(), z = cart.getBoundingClientRect();
    if (!a.width || !z.width) return;
    const f = src.cloneNode(); f.className = 'fly'; f.removeAttribute('style'); f.removeAttribute('loading');
    Object.assign(f.style, { left: a.left + 'px', top: a.top + 'px', width: a.width + 'px', height: a.height + 'px' });
    document.body.append(f);
    const dx = z.left + z.width / 2 - (a.left + a.width / 2), dy = z.top + z.height / 2 - (a.top + a.height / 2);
    f.animate([{ transform: 'none', opacity: 1 }, { transform: `translate(${dx * .55}px, ${dy - 80}px) scale(.5) rotate(-20deg)`, opacity: 1, offset: .55 },
      { transform: `translate(${dx}px, ${dy}px) scale(.08) rotate(-40deg)`, opacity: .4 }], { duration: 900, easing: 'cubic-bezier(.5,0,.3,1)' })
      .finished.then(() => { f.remove(); cart.classList.remove('bump'); void cart.offsetWidth; cart.classList.add('bump'); });
  });
})();
