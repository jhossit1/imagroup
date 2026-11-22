// Diseñador de páginas del panel. Sin dependencias.
(() => {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const el = (tag, attrs = {}, ...kids) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else if (k === 'html') e.innerHTML = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v);
    }
    kids.flat().forEach((c) => c != null && e.append(c.nodeType ? c : document.createTextNode(c)));
    return e;
  };
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- Diálogos y menú de la lista de páginas ----------
  $$('[data-open]').forEach((b) => b.addEventListener('click', () => $(b.dataset.open).showModal()));
  document.addEventListener('click', (e) => { const c = e.target.closest('[data-close]'); if (c) c.closest('dialog').close(); });
  $$('dialog').forEach((d) => d.addEventListener('click', (e) => { if (e.target === d) d.close(); }));
  const src = $('[data-slug-src]'), slug = $('[data-slug]');
  const slugify = (t) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  if (src && slug) { src.addEventListener('input', () => { if (!slug.dataset.touched) slug.value = slugify(src.value); }); slug.addEventListener('input', () => { slug.dataset.touched = 1; }); }

  const menu = $('[data-menu]');
  if (menu) {
    const csrf = $('input[name=_csrf]')?.value, msg = $('[data-menu-msg]');
    const save = () => {
      const items = $$('li', menu).map((li) => ({ id: +li.dataset.id, on: $('input', li).checked }));
      fetch('/admin/paginas/menu', { method: 'POST', headers: { 'content-type': 'application/json', 'x-csrf': csrf }, body: JSON.stringify({ items }) })
        .then((r) => { msg.textContent = r.ok ? 'Menú guardado ✓' : 'No se pudo guardar'; msg.classList.remove('pop'); void msg.offsetWidth; msg.classList.add('pop'); });
    };
    menu.addEventListener('change', save);
    menu.addEventListener('click', (e) => { const b = e.target.closest('[data-mv]'); if (!b) return; const li = b.closest('li'); flip(menu, () => { +b.dataset.mv < 0 ? li.previousElementSibling?.before(li) : li.nextElementSibling?.after(li); }); save(); });
    sortable(menu, '.pg-grip', save);
  }

  // Animación FLIP al reordenar.
  function flip(list, change) {
    const items = [...list.children], before = new Map(items.map((x) => [x, x.getBoundingClientRect().top]));
    change();
    if (still) return;
    items.forEach((x) => { const d = before.get(x) - x.getBoundingClientRect().top; if (d) x.animate([{ transform: `translateY(${d}px)` }, { transform: 'none' }], { duration: 320, easing: 'cubic-bezier(.2,.8,.2,1)' }); });
  }
  // Arrastrar para ordenar (mouse y dedo).
  function sortable(list, handle, done) {
    list.addEventListener('pointerdown', (e) => {
      const hd = e.target.closest(handle); if (!hd) return;
      const item = hd.closest(':scope > *'); if (!item || item.parentElement !== list) return;
      e.preventDefault(); item.classList.add('dragging'); hd.setPointerCapture(e.pointerId);
      const move = (ev) => {
        const over = document.elementFromPoint(ev.clientX, ev.clientY)?.closest(':scope > *');
        const target = over && over.parentElement === list ? over : [...list.children].find((x) => x.parentElement === list && x !== item && x.contains(document.elementFromPoint(ev.clientX, ev.clientY)));
        if (!target || target === item) return;
        const r = target.getBoundingClientRect(), after = ev.clientY > r.top + r.height / 2;
        if ((after && target.nextElementSibling === item) || (!after && target.previousElementSibling === item)) return;
        flip(list, () => (after ? target.after(item) : target.before(item)));
      };
      const up = () => { item.classList.remove('dragging'); hd.removeEventListener('pointermove', move); hd.removeEventListener('pointerup', up); hd.removeEventListener('pointercancel', up); done(); };
      hd.addEventListener('pointermove', move); hd.addEventListener('pointerup', up); hd.addEventListener('pointercancel', up);
    });
  }

  // ---------- Editor ----------
  const root = $('[data-builder]');
  if (!root) return;
  const D = JSON.parse($('#bd-data').textContent), T = D.types, P = D.page;
  let blocks = D.blocks, sel = null;
  const hist = [JSON.stringify(blocks)]; let hi = 0;
  const api = (url, body) => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', 'x-csrf': D.csrf }, body: JSON.stringify(body || {}) }).then((r) => r.json().catch(() => ({ ok: false })));
  const status = $('[data-status]'), list = $('[data-list]');
  const setStatus = (t, cls = '') => { status.textContent = t; status.className = 'bd-status ' + cls; };
  const id = () => [...crypto.getRandomValues(new Uint8Array(4))].map((b) => b.toString(16).padStart(2, '0')).join('');
  const toast = (t) => { const x = el('div', { class: 'bd-toast', role: 'status', text: t }); document.body.append(x); setTimeout(() => x.remove(), 2600); };

  // ----- Guardado automático e historial de deshacer -----
  let saveT, pending = false;
  function changed(record = true, quick = false) {
    if (record) {
      const snap = JSON.stringify(blocks);
      if (snap !== hist[hi]) { hist.splice(hi + 1); hist.push(snap); if (hist.length > 80) hist.shift(); hi = hist.length - 1; }
    }
    $('[data-undo]').disabled = hi <= 0; $('[data-redo]').disabled = hi >= hist.length - 1;
    setStatus('Guardando…', 'busy'); pending = true; clearTimeout(saveT);
    saveT = setTimeout(save, quick ? 50 : 650);
  }
  async function save() {
    const r = await api(`/admin/paginas/${P.id}/borrador`, { blocks });
    pending = false;
    if (!r.ok) return setStatus('No se pudo guardar. Revisa tu conexión.', 'err');
    P.changed = r.changed; setStatus(r.changed ? 'Cambios sin publicar' : 'Todo publicado', r.changed ? 'warn' : 'ok'); refresh();
  }
  addEventListener('beforeunload', (e) => { if (pending) { e.preventDefault(); e.returnValue = ''; } });
  const restore = (snap) => { blocks = JSON.parse(snap); renderList(); changed(false, true); };
  $('[data-undo]').addEventListener('click', () => { if (hi > 0) restore(hist[--hi]); });
  $('[data-redo]').addEventListener('click', () => { if (hi < hist.length - 1) restore(hist[++hi]); });
  addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.target.matches('input, textarea')) return;
    if (e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); $('[data-undo]').click(); }
    if (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey)) { e.preventDefault(); $('[data-redo]').click(); }
  });

  // ----- Vista previa con dos marcos (se carga el nuevo y se cambia sin parpadeo) -----
  const frames = $$('[data-pv]'), loading = $('[data-loading]');
  let front = 0, pvY = 0, pvTheme = (() => { try { return localStorage.getItem('pv-theme') || 'light'; } catch { return 'light'; } })(), loadN = 0;
  function refresh() {
    const back = frames[1 - front], n = ++loadN;
    loading.classList.add('on');
    back.onload = () => {
      if (n !== loadN) return;
      try { back.contentWindow.postMessage({ t: 'init', y: pvY, theme: pvTheme, sel }, location.origin); } catch { /* sin acceso */ }
      setTimeout(() => {
        if (n !== loadN) return;
        back.hidden = false; back.removeAttribute('aria-hidden'); back.tabIndex = 0; back.title = 'Vista previa';
        frames[front].hidden = true; frames[front].setAttribute('aria-hidden', 'true'); frames[front].tabIndex = -1; front = 1 - front; loading.classList.remove('on');
      }, 120);
    };
    back.src = `/admin/paginas/${P.id}/vista?r=${Date.now()}`;
  }
  addEventListener('message', (e) => {
    if (e.origin !== location.origin || !e.data) return;
    if (e.data.t === 'scroll' && e.source === frames[front].contentWindow) pvY = e.data.y;
    if (e.data.t === 'select') { select(e.data.id, true); if (innerWidth < 900) setView('panel'); }
  });
  const post = (m) => { try { frames[front].contentWindow.postMessage(m, location.origin); } catch { /* sin acceso */ } };
  const thBtn = $('[data-pv-theme]');
  const paintTheme = () => { thBtn.classList.toggle('dark', pvTheme === 'dark'); thBtn.setAttribute('aria-label', pvTheme === 'dark' ? 'Ver en modo claro' : 'Ver en modo oscuro'); };
  thBtn.addEventListener('click', () => { pvTheme = pvTheme === 'dark' ? 'light' : 'dark'; try { localStorage.setItem('pv-theme', pvTheme); } catch { /* */ } paintTheme(); post({ t: 'theme', v: pvTheme }); });
  paintTheme();

  // Tamaño de pantalla de la vista previa
  const frameBox = $('[data-frame]'), stage = $('[data-stage]');
  const DEV = { desk: 1280, tab: 820, phone: 390 };
  let dev = 'desk';
  function fit() {
    const w = DEV[dev], avail = stage.clientWidth - 32, s = Math.min(1, avail / w);
    frameBox.style.width = w + 'px'; frameBox.style.setProperty('--s', s);
    frameBox.style.height = (stage.clientHeight - 32) / s + 'px'; frameBox.dataset.dev = dev;
  }
  $$('[data-dev]').forEach((b) => b.addEventListener('click', () => { dev = b.dataset.dev; $$('[data-dev]').forEach((x) => x.setAttribute('aria-pressed', x === b)); fit(); }));
  addEventListener('resize', fit); new ResizeObserver(fit).observe(stage);
  const setView = (v) => { root.dataset.view = v; $('[data-toggle-view]').setAttribute('aria-label', v === 'panel' ? 'Ver vista previa' : 'Volver a editar'); fit(); };
  $('[data-toggle-view]').addEventListener('click', () => setView(root.dataset.view === 'panel' ? 'preview' : 'panel'));
  if (innerWidth < 900) dev = 'phone', $$('[data-dev]').forEach((x) => x.setAttribute('aria-pressed', x.dataset.dev === 'phone'));

  // ----- Campos -----
  const OPT = (o) => (Array.isArray(o) ? o : D.options[o] || []);
  const summary = (b) => {
    const t = T[b.type], d = { ...t.defaults, ...b.data };
    const v = d.title || d.l1 || d.word || d.first || d.eyebrow || (Array.isArray(d.items) && d.items[0] && (d.items[0].title || d.items[0].label || d.items[0].q)) || (typeof d.items === 'string' && d.items.split('\n')[0]) || '';
    return String(v).replace(/\*\*|\*/g, '').replace(/\n/g, ' ').slice(0, 60);
  };
  function field(f, get, set, opts = {}) {
    const v = get(), wrap = el('div', { class: 'bd-f bd-f-' + f.t }), lab = el('label', { class: 'bd-lab' }, f.l);
    const fid = 'f' + Math.random().toString(36).slice(2, 8);
    lab.htmlFor = fid;
    const def = opts.def, isSet = opts.isSet;
    if (opts.reset && isSet) wrap.append(el('button', { type: 'button', class: 'bd-reset', title: 'Volver al texto original', 'aria-label': `Volver al valor original de ${f.l}`, onclick: opts.reset }, '↺'));
    let input;
    const ph = f.dyn && def != null ? String(def).slice(0, 160) : '';
    if (f.t === 'text' || f.t === 'link') {
      input = el('input', { id: fid, type: 'text', value: v ?? '', placeholder: ph || (f.t === 'link' ? '/contacto o https://…' : ''), list: f.t === 'link' ? 'bd-links' : null });
      input.addEventListener('input', () => set(input.value));
    } else if (f.t === 'area' || f.t === 'md' || f.t === 'lines') {
      input = el('textarea', { id: fid, rows: f.t === 'lines' ? 4 : 3, placeholder: ph });
      input.value = v ?? '';
      const grow = () => { input.style.height = 'auto'; input.style.height = Math.min(420, input.scrollHeight + 2) + 'px'; };
      input.addEventListener('input', () => { grow(); set(input.value); }); requestAnimationFrame(grow);
      if (f.t === 'md') {
        const wrapSel = (a, b = a) => { const s = input.selectionStart, e = input.selectionEnd, t = input.value; input.value = t.slice(0, s) + a + (t.slice(s, e) || 'texto') + b + t.slice(e); input.focus(); input.dispatchEvent(new Event('input')); };
        wrap.append(el('div', { class: 'bd-md' },
          el('button', { type: 'button', title: 'Negrita', onclick: () => wrapSel('**') }, el('b', {}, 'N')),
          el('button', { type: 'button', title: 'Cursiva', onclick: () => wrapSel('*') }, el('i', {}, 'C')),
          el('button', { type: 'button', title: 'Enlace', onclick: () => { const u = prompt('Dirección del enlace (ej. /contacto o https://…)'); if (u) wrapSel('[', `](${u})`); } }, '🔗'),
          el('button', { type: 'button', title: 'Lista', onclick: () => { input.value += (input.value && !input.value.endsWith('\n') ? '\n' : '') + '- '; input.focus(); input.dispatchEvent(new Event('input')); } }, '• Lista')));
      }
      if (f.t === 'lines') wrap.append(el('small', { class: 'bd-hint' }, 'Uno por línea.'));
    } else if (f.t === 'num') {
      input = el('input', { id: fid, type: 'number', min: 0, max: 60, value: v ?? '' }); input.addEventListener('input', () => set(+input.value));
    } else if (f.t === 'sel') {
      input = el('select', { id: fid }, OPT(f.o).map(([val, l]) => el('option', { value: val, selected: String(v ?? '') === String(val) }, l)));
      input.addEventListener('change', () => set(input.value));
    } else if (f.t === 'bool') {
      input = el('input', { id: fid, type: 'checkbox', checked: !!v }); input.addEventListener('change', () => set(input.checked));
      wrap.classList.add('bd-sw'); wrap.append(el('label', { class: 'bd-switch', for: fid }, input, el('span'), el('b', {}, f.l)));
      return wrap;
    } else if (f.t === 'img') {
      const img = el('img', { alt: '', src: v || def || '' }), shown = v || (f.dyn ? def : '');
      if (!shown) img.hidden = true;
      input = el('div', { class: 'bd-img' }, el('button', { type: 'button', class: 'bd-thumb', 'aria-label': 'Cambiar imagen', onclick: () => pick((u) => { set(u); rebuild(); }) }, img, el('span', {}, shown ? 'Cambiar' : 'Elegir imagen')),
        shown ? el('button', { type: 'button', class: 'bd-mini', onclick: () => { set(''); rebuild(); } }, 'Quitar') : null);
    } else if (f.t === 'list') {
      const arr = Array.isArray(v) ? v : [], box = el('div', { class: 'bd-items' });
      const commit = () => set(arr.map((x) => ({ ...x })));
      arr.forEach((it, i) => {
        const title = String(Object.values(it).find((x) => typeof x === 'string' && x && !x.startsWith('/')) || `Elemento ${i + 1}`).slice(0, 48);
        const det = el('details', { class: 'bd-item', open: opts.openItem === i }, el('summary', {}, el('span', { class: 'bd-n' }, String(i + 1)), el('span', { class: 'bd-it' }, title),
          el('span', { class: 'bd-ia' },
            el('button', { type: 'button', 'aria-label': 'Subir', disabled: i === 0, onclick: (e) => { e.preventDefault(); [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; commit(); rebuild(); } }, '↑'),
            el('button', { type: 'button', 'aria-label': 'Bajar', disabled: i === arr.length - 1, onclick: (e) => { e.preventDefault(); [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]]; commit(); rebuild(); } }, '↓'),
            el('button', { type: 'button', 'aria-label': 'Duplicar', onclick: (e) => { e.preventDefault(); arr.splice(i + 1, 0, { ...it }); commit(); rebuild(); } }, '⧉'),
            el('button', { type: 'button', 'aria-label': 'Eliminar', class: 'bd-del', onclick: (e) => { e.preventDefault(); arr.splice(i, 1); commit(); rebuild(); } }, '×'))));
        f.f.forEach((sf) => det.append(field(sf, () => it[sf.k], (nv) => { it[sf.k] = nv; commit(); }, { def: null })));
        box.append(det);
      });
      if (!f.max || arr.length < f.max) box.append(el('button', { type: 'button', class: 'bd-additem', onclick: () => { const n = Object.fromEntries(f.f.map((sf) => [sf.k, sf.t === 'bool' ? false : ''])); if (arr.length) Object.assign(n, Object.fromEntries(f.f.filter((sf) => sf.t === 'sel').map((sf) => [sf.k, arr[arr.length - 1][sf.k]]))); arr.push(n); commit(); rebuild(arr.length - 1); } }, '+ Agregar'));
      input = box;
    }
    if (f.dyn) wrap.append(lab, input, el('small', { class: 'bd-hint' }, f.h || 'Vacío: se toma de otra sección del panel.'));
    else wrap.append(...[lab, input, f.h ? el('small', { class: 'bd-hint' }, f.h) : null].filter(Boolean));
    return wrap;
    function rebuild(openItem) { const b = blocks.find((x) => x.id === sel); if (b) openBlock(b, openItem); }
  }

  // ----- Lista de bloques -----
  const linksDl = el('datalist', { id: 'bd-links' }, D.links.map(([u, l]) => el('option', { value: u }, l))); document.body.append(linksDl);
  const icoSvg = (n) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ICONS.cards}</svg>`;
  function renderList() {
    list.replaceChildren(...blocks.map((b, i) => {
      const t = T[b.type];
      const li = el('li', { class: 'bd-bk' + (b.hidden ? ' off' : '') + (b.id === sel ? ' on' : ''), 'data-id': b.id, style: `--i:${i}` },
        el('div', { class: 'bd-row' },
          el('span', { class: 'bd-grip', title: 'Arrastra para mover', 'aria-hidden': 'true' }, '⋮⋮'),
          el('button', { type: 'button', class: 'bd-open', 'aria-expanded': b.id === sel, onclick: () => select(b.id === sel ? null : b.id) },
            el('span', { class: 'bd-ico', html: icoSvg(t.icon) }), el('span', { class: 'bd-tt' }, el('b', {}, t.label), el('small', {}, summary(b) || t.group))),
          el('span', { class: 'bd-acts' },
            el('button', { type: 'button', title: b.hidden ? 'Mostrar' : 'Ocultar', 'aria-label': (b.hidden ? 'Mostrar ' : 'Ocultar ') + t.label, class: 'bd-eye' + (b.hidden ? ' off' : ''), onclick: () => { b.hidden = !b.hidden; renderList(); changed(); } }, b.hidden ? '◌' : '●'),
            el('button', { type: 'button', title: 'Subir', 'aria-label': 'Subir ' + t.label, disabled: i === 0, onclick: () => move(i, -1) }, '↑'),
            el('button', { type: 'button', title: 'Bajar', 'aria-label': 'Bajar ' + t.label, disabled: i === blocks.length - 1, onclick: () => move(i, 1) }, '↓'),
            el('button', { type: 'button', title: 'Duplicar', 'aria-label': 'Duplicar ' + t.label, onclick: () => { const c = JSON.parse(JSON.stringify(b)); c.id = id(); blocks.splice(i + 1, 0, c); sel = c.id; renderList(); changed(); } }, '⧉'),
            el('button', { type: 'button', title: 'Eliminar', 'aria-label': 'Eliminar ' + t.label, class: 'bd-del', onclick: () => { if (!confirm(`¿Quitar el bloque «${t.label}» de esta página? Puedes deshacerlo con Ctrl+Z.`)) return; blocks.splice(i, 1); if (sel === b.id) sel = null; renderList(); changed(); toast('Bloque quitado · Ctrl+Z para deshacer'); } }, '×'))),
        el('div', { class: 'bd-body' }));
      li.append(el('button', { type: 'button', class: 'bd-ins', title: 'Agregar un bloque aquí', 'aria-label': 'Agregar un bloque debajo de ' + t.label, onclick: () => palette(i + 1) }, '+'));
      return li;
    }));
    if (!blocks.length) list.append(el('li', { class: 'bd-empty' }, 'Esta página no tiene bloques. Agrega el primero.'));
    const b = blocks.find((x) => x.id === sel); if (b) openBlock(b);
  }
  function move(i, d) { const j = i + d; if (j < 0 || j >= blocks.length) return; flip(list, () => { [blocks[i], blocks[j]] = [blocks[j], blocks[i]]; renderList(); }); changed(); post({ t: 'focus', id: blocks[j].id }); }
  sortable(list, '.bd-grip', () => {
    const order = $$('.bd-bk', list).map((li) => li.dataset.id), next = order.map((x) => blocks.find((b) => b.id === x)).filter(Boolean);
    if (next.map((b) => b.id).join() !== blocks.map((b) => b.id).join()) { blocks = next; renderList(); changed(); }
  });

  function openBlock(b, openItem) {
    const li = $(`.bd-bk[data-id="${b.id}"]`, list); if (!li) return;
    const t = T[b.type], body = $('.bd-body', li), d = (b.data ||= {});
    const mk = (f, isStyle) => field(f, () => (d[f.k] !== undefined ? d[f.k] : f.dyn ? '' : isStyle ? '' : t.defaults[f.k]),
      (v) => { d[f.k] = v; li.querySelector('.bd-tt small').textContent = summary(b) || t.group; changed(); },
      { def: t.defaults[f.k], isSet: d[f.k] !== undefined && !isStyle, reset: isStyle ? null : () => { delete d[f.k]; openBlock(b); changed(); }, openItem });
    const content = t.fields.map((f) => mk(f, false)), style = D.style.map((f) => mk(f, true));
    body.replaceChildren(el('p', { class: 'bd-desc' }, t.desc),
      el('div', { class: 'bd-grp' }, content),
      el('details', { class: 'bd-style', open: Object.keys(d).some((k) => k.startsWith('_')) }, el('summary', {}, '🎨 Diseño de la sección'), el('div', { class: 'bd-grp' }, style)));
  }
  function select(bid, fromPreview) {
    sel = bid; renderList();
    const li = bid && $(`.bd-bk[data-id="${bid}"]`, list);
    if (li) { li.scrollIntoView({ block: 'nearest', behavior: still ? 'auto' : 'smooth' }); if (!fromPreview) post({ t: 'focus', id: bid }); else post({ t: 'mark', id: bid }); }
    if (!bid) post({ t: 'mark', id: null });
  }

  // ----- Paleta de bloques -----
  const pal = $('[data-palette]'), palList = $('[data-pal-list]'), palQ = $('[data-pal-q]');
  let insertAt = 0;
  const ORDER = ['Bloques libres', 'Inicio', 'Servicios', 'Tienda', 'Contacto', 'Portafolio', 'Equipo'];
  function drawPalette() {
    const q = palQ.value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const groups = ORDER.map((g) => [g, Object.entries(T).filter(([, t]) => t.group === g && (!q || (t.label + ' ' + t.desc).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(q)))]).filter(([, a]) => a.length);
    palList.replaceChildren(...groups.map(([g, items]) => el('section', {}, el('h3', {}, g === 'Bloques libres' ? 'Para diseñar a tu modo' : `Secciones de ${g}`),
      el('div', { class: 'bd-pal-grid' }, items.map(([k, t], i) => el('button', { type: 'button', class: 'bd-pal-it', style: `--i:${i}`, onclick: () => add(k) },
        el('span', { class: 'bd-pal-art', 'data-art': t.icon, html: icoSvg(t.icon) }), el('b', {}, t.label), el('small', {}, t.desc)))))));
    if (!groups.length) palList.append(el('p', { class: 'bd-hint' }, 'No hay bloques con ese nombre.'));
  }
  function palette(at) { insertAt = at; palQ.value = ''; drawPalette(); pal.showModal(); setTimeout(() => palQ.focus(), 50); }
  palQ.addEventListener('input', drawPalette);
  $$('[data-add-at]').forEach((b) => b.addEventListener('click', () => palette(blocks.length)));
  function add(type) {
    const b = { id: id(), type, data: {} };
    blocks.splice(insertAt, 0, b); sel = b.id; pal.close(); renderList(); changed(true, true);
    setTimeout(() => post({ t: 'focus', id: b.id }), 900);
    toast(`Agregado: ${T[type].label}`);
  }

  // ----- Imágenes -----
  const dlg = $('[data-images]'), gal = $('[data-gal]'), file = $('[data-file]'), bar = $('[data-bar]');
  let onPick = null, loaded = false;
  function pick(cb) {
    onPick = cb; dlg.showModal();
    if (loaded) return;
    fetch('/admin/paginas/imagenes').then((r) => r.json()).then((j) => {
      loaded = true;
      gal.replaceChildren(...j.groups.filter(([, a]) => a.length).map(([g, a]) => el('section', {}, el('h3', {}, g),
        el('div', { class: 'bd-gal-grid' }, a.map((u, i) => el('button', { type: 'button', style: `--i:${i % 12}`, title: u.split('/').pop(), onclick: () => use(u) }, el('img', { src: u.replace(/(\/img\/f\/[^/]+?)\.webp$/, '$1-sm.webp'), alt: '', loading: 'lazy' })))))));
    });
  }
  const use = (u) => { dlg.close(); onPick && onPick(u); };
  $('[data-img-use]').addEventListener('click', () => { const u = $('[data-img-url]').value.trim(); if (u) use(u); });
  async function upload(f) {
    if (!f) return;
    if (!/^image\/(jpeg|png|webp)$/.test(f.type) || f.size > 6 * 1024 * 1024) return toast('Usa una imagen JPG, PNG o WebP de hasta 6 MB.');
    const fd = new FormData(); fd.append('file', f);
    const xhr = new XMLHttpRequest(); xhr.open('POST', '/admin/paginas/subir'); xhr.setRequestHeader('x-csrf', D.csrf);
    xhr.upload.onprogress = (e) => bar.style.setProperty('--p', (e.loaded / e.total) * 100 + '%');
    xhr.onload = () => { bar.style.setProperty('--p', '0%'); let j = {}; try { j = JSON.parse(xhr.responseText); } catch { /* */ } if (j.ok) { loaded = false; use(j.url); toast('Imagen subida ✓'); } else toast(j.message || 'No se pudo subir la imagen.'); };
    xhr.send(fd);
  }
  file.addEventListener('change', () => upload(file.files[0]));
  const drop = $('[data-drop]');
  ['dragover', 'dragenter'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, () => drop.classList.remove('over')));
  drop.addEventListener('drop', (e) => { e.preventDefault(); upload(e.dataTransfer.files[0]); });

  // ----- Publicar, historial y descartar -----
  $('[data-publish]').addEventListener('click', async (e) => {
    const b = e.currentTarget; clearTimeout(saveT); if (pending) await save();
    b.classList.add('busy');
    const r = await api(`/admin/paginas/${P.id}/publicar`);
    b.classList.remove('busy');
    if (!r.ok) return toast('No se pudo publicar.');
    P.changed = false; P.live = true; $('[data-live-link]').hidden = false; setStatus('Publicado ✓', 'ok');
    b.classList.add('done'); setTimeout(() => b.classList.remove('done'), 1600);
    if (!still) confetti(b);
    toast('¡Publicado! Tus visitantes ya ven los cambios.');
  });
  function confetti(b) {
    const r = b.getBoundingClientRect(), C = ['#c9a24a', '#1a5f99', '#3d8a37', '#2f86cc', '#e8c77f'];
    for (let i = 0; i < 26; i++) {
      const p = el('i', { class: 'bd-cf', style: `left:${r.left + r.width / 2}px;top:${r.top + r.height / 2}px;background:${C[i % C.length]}` }); document.body.append(p);
      const a = Math.random() * Math.PI * 2, d = 60 + Math.random() * 120;
      p.animate([{ transform: 'translate(0,0) rotate(0)', opacity: 1 }, { transform: `translate(${Math.cos(a) * d}px, ${Math.sin(a) * d + 80}px) rotate(${Math.random() * 720}deg)`, opacity: 0 }], { duration: 900 + Math.random() * 500, easing: 'cubic-bezier(.2,.7,.3,1)' }).finished.then(() => p.remove());
    }
  }
  const hd = $('[data-hist]');
  $('[data-history]').addEventListener('click', async () => {
    hd.showModal(); const box = $('[data-hist-list]'); box.replaceChildren(el('p', {}, 'Cargando…'));
    const j = await fetch(`/admin/paginas/${P.id}/historial`).then((r) => r.json());
    box.replaceChildren(j.versions.length ? el('ol', { class: 'bd-vers' }, j.versions.map((v, i) => el('li', { style: `--i:${i}` },
      el('div', {}, el('b', {}, new Date(v.created_at.replace(' ', 'T') + 'Z').toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'short' })), el('small', {}, `Publicada por ${v.admin || '—'}${i === 0 ? ' · versión actual' : ''}`)),
      el('button', { type: 'button', class: 'a-btn sm ghost', onclick: async () => { if (!confirm('¿Cargar esta versión en el borrador? Luego puedes publicarla.')) return; const r = await api(`/admin/paginas/${P.id}/restaurar/${v.id}`); if (r.ok) { blocks = r.blocks; sel = null; renderList(); changed(true, true); hd.close(); toast('Versión cargada en el borrador'); } } }, 'Usar esta')))) : el('p', { class: 'bd-hint' }, 'Aún no hay publicaciones guardadas. Cada vez que publiques se guardará una copia aquí.'));
  });
  $('[data-discard]').addEventListener('click', async () => {
    if (!confirm('¿Descartar todos los cambios que no publicaste?')) return;
    const r = await api(`/admin/paginas/${P.id}/descartar`);
    if (!r.ok) return toast(r.message || 'No se pudo descartar.');
    blocks = r.blocks; sel = null; renderList(); changed(true, true); hd.close(); toast('Cambios descartados');
  });

  // ----- Datos de la página -----
  function drawMeta() {
    const f = $('[data-meta]'), sys = !!P.system;
    const iconPick = el('div', { class: 'bd-icons', role: 'radiogroup', 'aria-label': 'Ícono en el menú del celular' }, Object.entries(D.icons).map(([k, [l, svg]]) => el('label', { title: l }, el('input', { type: 'radio', name: 'icon', value: k, checked: P.icon === k }), el('span', { html: `<svg viewBox="0 0 24 24" aria-hidden="true">${svg}</svg>` }), el('span', { class: 'sr' }, l))));
    f.replaceChildren(
      el('label', {}, 'Nombre en el menú', el('input', { name: 'nav_label', value: P.nav_label || '', maxlength: 40 })),
      el('label', {}, 'Título de la pestaña del navegador', el('input', { name: 'title', value: P.title, maxlength: 120 })),
      sys ? el('p', { class: 'bd-hint' }, `Dirección: ${P.path} (fija, es una página del sistema)`) : el('label', {}, 'Dirección', el('span', { class: 'pg-slug' }, location.host + '/', el('input', { name: 'slug', value: P.slug, pattern: '[a-z0-9-]+', maxlength: 60 }))),
      el('label', {}, 'Descripción para Google y WhatsApp', el('textarea', { name: 'description', rows: 3, maxlength: 300 }, P.description || '')),
      P.system === 'carrito' || P.system === 'inicio' ? null : el('label', { class: 'bd-switch' }, el('input', { type: 'checkbox', name: 'in_nav', checked: P.in_nav }), el('span'), el('b', {}, 'Mostrar en el menú')),
      el('fieldset', {}, el('legend', {}, 'Ícono'), iconPick),
      el('button', { class: 'a-btn' }, 'Guardar datos de la página'), el('p', { class: 'bd-hint', 'data-meta-msg': true }),
      el('div', { class: 'bd-danger' },
        el('button', { type: 'button', class: 'a-btn ghost sm', onclick: () => $('[data-dup]').submit() }, 'Duplicar esta página'),
        sys ? null : el('button', { type: 'button', class: 'a-btn ghost sm bd-del', onclick: () => { if (confirm('¿Eliminar esta página para siempre? Esta acción no se puede deshacer.')) $('[data-del]').submit(); } }, 'Eliminar página')));
  }
  $('[data-meta]').addEventListener('submit', async (e) => {
    e.preventDefault(); const fd = new FormData(e.target), body = Object.fromEntries(fd); body.in_nav = !!fd.get('in_nav');
    const r = await api(`/admin/paginas/${P.id}/datos`, body), m = $('[data-meta-msg]');
    if (!r.ok) { m.textContent = r.message || 'No se pudo guardar.'; return; }
    Object.assign(P, body); P.path = r.path; $('[data-page-name]').textContent = body.nav_label || body.title; $('[data-live-link]').href = r.path;
    m.textContent = 'Guardado ✓'; refresh();
  });
  $$('[data-tab]').forEach((t) => t.addEventListener('click', () => {
    $$('[data-tab]').forEach((x) => x.setAttribute('aria-selected', x === t)); $$('[data-pane]').forEach((p) => { p.hidden = p.dataset.pane !== t.dataset.tab; });
    if (t.dataset.tab === 'page') drawMeta();
  }));

  // Íconos de los tipos de bloque
  const ICONS = {
    hero: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M6 9h7M6 12h5"/><path d="m14 16 2.5-3 3 4"/>', duo: '<rect x="3" y="5" width="8" height="14" rx="2"/><rect x="13" y="5" width="8" height="14" rx="2"/>',
    list: '<path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>', rail: '<rect x="2" y="6" width="6" height="12" rx="1.5"/><rect x="9" y="6" width="6" height="12" rx="1.5"/><rect x="16" y="6" width="6" height="12" rx="1.5"/>',
    mosaic: '<rect x="3" y="3" width="10" height="18" rx="2"/><rect x="15" y="3" width="6" height="8" rx="2"/><rect x="15" y="13" width="6" height="8" rx="2"/>', mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    cards: '<rect x="3" y="4" width="8" height="7" rx="1.5"/><rect x="13" y="4" width="8" height="7" rx="1.5"/><rect x="3" y="13" width="8" height="7" rx="1.5"/><rect x="13" y="13" width="8" height="7" rx="1.5"/>',
    cart: '<path d="M3 4h2l2 11h11l2-8H6"/><circle cx="9" cy="19" r="1.5"/><circle cx="17" cy="19" r="1.5"/>', type: '<path d="M4 6V4h16v2M12 4v16M9 20h6"/>', form: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h4"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>', marquee: '<path d="M3 12h4M10 12h4M17 12h4"/><path d="m18 9 3 3-3 3"/>', timeline: '<path d="M4 12h16"/><circle cx="6" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="18" cy="12" r="2"/>',
    tabs: '<path d="M3 8h6V5h6v3h6v11H3z"/>', gallery: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 17-5-5-9 8"/>', cta: '<rect x="3" y="7" width="18" height="10" rx="5"/><path d="M10 12h5M13 10l2 2-2 2"/>',
    media: '<rect x="3" y="5" width="8" height="14" rx="2"/><path d="M14 8h7M14 12h7M14 16h4"/>', stats: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>', faq: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.4V14M12 17h.01"/>',
    chat: '<path d="M4 20l1.5-4A8 8 0 1 1 9 19.5z"/>', buttons: '<rect x="2" y="9" width="9" height="6" rx="3"/><rect x="13" y="9" width="9" height="6" rx="3"/>', spacer: '<path d="M4 12h16M12 4v4M12 16v4M9 6l3-3 3 3M9 18l3 3 3-3"/>',
  };

  renderList(); refresh(); fit();
  $('[data-undo]').disabled = true; $('[data-redo]').disabled = true;
  setStatus(P.live ? (P.changed ? 'Cambios sin publicar' : 'Todo publicado') : 'Sin publicar', P.changed || !P.live ? 'warn' : 'ok');
})();
