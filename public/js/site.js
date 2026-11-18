(() => {
  document.documentElement.classList.add('js');
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  // Menú móvil
  const btn = $('.menu-btn'), nav = $('#nav');
  if (btn) {
    btn.addEventListener('click', () => { const o = nav.classList.toggle('open'); btn.setAttribute('aria-expanded', o); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && nav.classList.contains('open')) { nav.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); btn.focus(); } });
  }

  // Aparición al hacer scroll
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
    $$('.reveal').forEach((el, i) => { el.style.transitionDelay = (i % 4) * 70 + 'ms'; io.observe(el); });
  } else $$('.reveal').forEach((el) => el.classList.add('in'));

  // Carrito en el navegador (solo la lista; precios y totales los recalcula el servidor)
  const load = () => { try { return JSON.parse(localStorage.getItem('cart') || '[]'); } catch { return []; } };
  const save = (c) => { try { localStorage.setItem('cart', JSON.stringify(c)); } catch {} count(); };
  const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => '&#' + c.charCodeAt(0) + ';');
  const money = (c) => (c == null ? 'Consultar' : 'S/ ' + (c / 100).toFixed(2));
  function count() {
    const n = load().reduce((a, i) => a + i.qty, 0);
    $$('[data-cart-count]').forEach((b) => { b.textContent = n; b.hidden = !n; });
  }
  if ($('[data-clear-cart]')) save([]);
  count();

  function toast(msg) {
    let t = $('.toast');
    if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.append(t); }
    t.innerHTML = msg; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 3200);
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-add]'); if (!b) return;
    const p = JSON.parse(b.dataset.add); const qEl = $('[data-qty]');
    const qty = Math.max(1, Math.min(999, parseInt(qEl && b.closest('.buy') ? qEl.value : 1, 10) || 1));
    const c = load(); const f = c.find((i) => i.slug === p.slug);
    f ? (f.qty += qty) : c.push({ slug: p.slug, qty }); save(c);
    toast(`Agregado: ${esc(p.name)} · <a href="/carrito">Ver pedido</a>`);
  });

  const root = $('[data-cart-root]');
  if (root) {
    const catalog = new Map(JSON.parse($('#catalog').textContent).map((p) => [p.slug, p]));
    const form = $('[data-order]');
    const render = () => {
      const c = load().filter((i) => catalog.has(i.slug));
      if (!c.length) { root.innerHTML = '<div class="empty"><p>Tu pedido está vacío.</p><a class="btn" href="/tienda">Ver productos</a></div>'; form.hidden = true; return; }
      let total = 0, unknown = false;
      root.innerHTML = '<ul class="cart-list">' + c.map((i) => {
        const p = catalog.get(i.slug); if (p.price == null) unknown = true; else total += p.price * i.qty;
        return `<li><img src="${esc(p.image)}" alt=""><div><b>${esc(p.name)}</b><br><span class="note">${money(p.price)} c/u</span></div>
        <div class="qty" aria-label="Cantidad de ${esc(p.name)}"><button type="button" data-d="-1" data-s="${i.slug}" aria-label="Quitar uno">−</button><output>${i.qty}</output><button type="button" data-d="1" data-s="${i.slug}" aria-label="Agregar uno">+</button></div>
        <button type="button" class="rm" data-rm="${i.slug}">Quitar</button></li>`;
      }).join('') + `</ul><p class="cart-total"><span>Total referencial</span><span>${money(total)}${unknown ? ' + productos a cotizar' : ''}</span></p>
      <p class="note">Precios en soles. El envío, si lo eliges, se cotiza según el destino y se confirma antes de pagar.</p>`;
      form.hidden = false; form.items.value = JSON.stringify(c);
    };
    root.addEventListener('click', (e) => {
      const d = e.target.closest('[data-d]'), r = e.target.closest('[data-rm]'); if (!d && !r) return;
      let c = load();
      if (r) c = c.filter((i) => i.slug !== r.dataset.rm);
      else { const it = c.find((i) => i.slug === d.dataset.s); it.qty = Math.max(1, Math.min(999, it.qty + Number(d.dataset.d))); }
      save(c); render();
    });
    render();
  }

  // Formularios de contacto con validación y respuesta sin recargar
  $$('[data-form], [data-order]').forEach((f) => f.addEventListener('submit', async (e) => {
    const msg = $('.form-msg', f); let bad = null;
    $$('[required]', f).forEach((i) => { const ok = i.value.trim() !== ''; i.setAttribute('aria-invalid', !ok); if (!ok && !bad) bad = i; });
    const em = f.email; if (em && em.value && !/^\S+@\S+\.\S+$/.test(em.value)) { em.setAttribute('aria-invalid', 'true'); bad = bad || em; }
    if (bad) { e.preventDefault(); msg.className = 'form-msg err'; msg.textContent = 'Revisa los campos marcados.'; bad.focus(); return; }
    if (f.hasAttribute('data-order')) { f.querySelector('button[type=submit]').disabled = true; return; } // envío normal: muestra la página de confirmación
    e.preventDefault();
    const b = f.querySelector('button[type=submit]'); b.disabled = true; msg.className = 'form-msg'; msg.textContent = 'Enviando…';
    try {
      const r = await fetch(f.action, { method: 'POST', headers: { Accept: 'application/json' }, body: new URLSearchParams(new FormData(f)) });
      const j = await r.json();
      msg.className = 'form-msg ' + (j.ok ? 'ok' : 'err'); msg.textContent = j.message;
      if (j.ok) { f.reset(); f._t.value = Date.now() - 3000; if (f.classList.contains('mini')) { msg.textContent = ''; f.classList.add('sent'); setTimeout(() => f.classList.remove('sent'), 6000); } }
    } catch { msg.className = 'form-msg err'; msg.textContent = 'No se pudo enviar. Revisa tu conexión o escríbenos por WhatsApp.'; }
    b.disabled = false;
  }));

  // Filtro de portafolio por área
  const fl = $('[data-filter]');
  if (fl) fl.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    $$('button', fl).forEach((x) => x.setAttribute('aria-pressed', x === b));
    $$('.pj[data-area]').forEach((p) => { p.hidden = b.dataset.f && p.dataset.area !== b.dataset.f; if (!p.hidden) p.classList.add('in'); });
  });
})();

// Presentación profesional: cifras que cuentan, línea de trayectoria que avanza y filtro de formación.
(() => {
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const nums = document.querySelectorAll('[data-count]');
  if (nums.length && 'IntersectionObserver' in window && !still) {
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) return; io.unobserve(e.target);
      const el = e.target, end = +el.dataset.count, suf = el.dataset.suf || '', t0 = performance.now();
      const step = (t) => { const k = Math.min(1, (t - t0) / 1400); el.textContent = Math.round(end * (1 - Math.pow(1 - k, 3))) + suf; if (k < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    }), { threshold: .6 });
    nums.forEach((n) => { n.textContent = '0' + (n.dataset.suf || ''); io.observe(n); });
  }
  const line = document.querySelector('[data-line]');
  if (line) {
    let raf = 0;
    const upd = () => { raf = 0; const r = line.getBoundingClientRect(), vh = innerHeight * .6; line.style.setProperty('--p', Math.max(0, Math.min(1, (vh - r.top) / r.height)).toFixed(3)); };
    addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(upd); }, { passive: true }); upd();
  }
  const tabs = document.querySelector('[data-study]');
  if (tabs) tabs.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    tabs.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', x === b));
    let n = 0; document.querySelectorAll('.pf-study li').forEach((li) => { li.hidden = li.dataset.k !== b.dataset.k; if (!li.hidden) li.style.setProperty('--n', n++); });
  });
})();

// Interfaz: modo oscuro con haz de luz, barra inferior líquida, palabra cinética y textarea que crece.
(() => {
  const root = document.documentElement;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const tb = document.querySelector('[data-theme-btn]');
  if (tb) {
    const sync = () => { const d = root.dataset.theme === 'dark'; tb.setAttribute('aria-pressed', d); tb.setAttribute('aria-label', d ? 'Modo claro' : 'Modo oscuro'); };
    sync();
    tb.addEventListener('click', () => {
      const d = root.dataset.theme !== 'dark';
      root.classList.add('theme-anim');
      if (d) root.dataset.theme = 'dark'; else delete root.dataset.theme;
      try { localStorage.setItem('theme', d ? 'dark' : 'light'); } catch { /* */ }
      tb.classList.remove('flash'); void tb.offsetWidth; if (d) tb.classList.add('flash');
      sync(); setTimeout(() => root.classList.remove('theme-anim'), 700);
    });
  }

  const tabs = document.querySelector('[data-tabs]');
  if (tabs) {
    const links = [...tabs.querySelectorAll('a')];
    const now = parseInt(tabs.style.getPropertyValue('--i'), 10);
    let prev = null; try { prev = sessionStorage.getItem('tab'); } catch { /* */ }
    if (!still && prev !== null && +prev !== now && now >= 0 && +prev >= 0) {
      tabs.classList.add('no-anim'); tabs.style.setProperty('--i', prev); void tabs.offsetWidth;
      tabs.classList.remove('no-anim'); requestAnimationFrame(() => tabs.style.setProperty('--i', now));
    }
    try { sessionStorage.setItem('tab', now); } catch { /* */ }
    links.forEach((a, i) => a.addEventListener('click', () => { tabs.style.setProperty('--i', i); try { sessionStorage.setItem('tab', i); } catch { /* */ } }));
  }

  const word = document.querySelector('[data-kinetic]');
  if (word && !still) {
    const ls = [...word.children], kinds = ['k1', 'k2', 'k3'];
    const tick = () => {
      const el = ls[Math.floor(Math.random() * ls.length)];
      if (!el.className) { el.className = kinds[Math.floor(Math.random() * kinds.length)]; setTimeout(() => (el.className = ''), 700 + Math.random() * 600); }
    };
    setInterval(tick, 420);
  }

  document.querySelectorAll('.fl textarea').forEach((t) => {
    const fit = () => { t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 320) + 'px'; };
    t.addEventListener('input', fit);
  });
})();
