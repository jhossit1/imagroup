// Panel: confirmaciones, modo claro/oscuro, cifras que cuentan y filas que entran en cascada.
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-confirm]'); if (b && !confirm(b.dataset.confirm)) e.preventDefault();
  const more = document.querySelector('.ad-more[open]'); if (more && !more.contains(e.target)) more.open = false;
});
document.querySelectorAll('[data-theme-btn]').forEach((btn) => btn.addEventListener('click', () => {
  const dark = document.documentElement.dataset.theme !== 'dark';
  const apply = () => { if (dark) document.documentElement.dataset.theme = 'dark'; else delete document.documentElement.dataset.theme; };
  try { localStorage.setItem('theme', dark ? 'dark' : 'light'); } catch { /* sin almacenamiento */ }
  document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches ? document.startViewTransition(apply) : apply();
}));
document.querySelectorAll('.a-table tbody tr').forEach((tr, i) => tr.style.setProperty('--i', Math.min(i, 15)));
if (!matchMedia('(prefers-reduced-motion: reduce)').matches) document.querySelectorAll('[data-count]').forEach((el) => {
  const to = +el.dataset.count, suf = el.dataset.suf || '', t0 = performance.now() + 300, dur = 1400;
  if (!to) return;
  const tick = (t) => { const p = Math.min(1, Math.max(0, (t - t0) / dur)); el.textContent = Math.round(to * (1 - Math.pow(1 - p, 4))).toLocaleString('es-PE') + suf; if (p < 1) requestAnimationFrame(tick); };
  el.textContent = '0' + suf; requestAnimationFrame(tick);
});

// Evaluación: puntaje, nivel y bono propuestos en vivo (misma fórmula que el servidor).
const ev = document.querySelector('[data-eval]');
if (ev) {
  const bonos = JSON.parse(ev.dataset.bonos || '{}');
  const LV = [['oro', 'Oro · Excelencia', 90, '#c9a24a'], ['plata', 'Plata · Destacado', 80, '#8e9aa6'], ['bronce', 'Bronce · Confiable', 70, '#b0723e'], ['base', 'En desarrollo', 0, '#5d6874']];
  const ring = ev.querySelector('[data-ring]'), out = ev.querySelector('[data-score]'), lvl = ev.querySelector('[data-level]'), bono = ev.querySelector('[data-bono]'), gate = ev.querySelector('[data-gate]');
  let shown = 0;
  const upd = () => {
    let score = 0, n = 0, seg = 0;
    ev.querySelectorAll('fieldset[data-k]').forEach((f) => {
      const v = +(f.querySelector('input:checked')?.value || 0); if (v) n++;
      if (f.dataset.k === 's_seg') seg = v;
      score += (v / 5) * +f.dataset.w;
      ev.querySelector(`[data-mini="${f.dataset.k}"] i`).style.setProperty('--v', v * 20 + '%');
    });
    score = Math.round(score * 10) / 10;
    const l = seg && seg < 3 ? LV[3] : LV.find((x) => score >= x[2]);
    ring.style.setProperty('--p', score); ring.style.setProperty('--lc', l[3]);
    gate.hidden = !(seg && seg < 3);
    const T = ev.querySelectorAll('fieldset[data-k]').length;
    lvl.textContent = n < T ? (T - n === 1 ? 'Falta 1 criterio' : `Faltan ${T - n} criterios`) : l[1];
    bono.textContent = n === T && bonos[l[0]] ? `Bono propuesto: S/ ${bonos[l[0]]}` : n === T ? 'Sin bono' : '';
    const from = shown, t0 = performance.now();
    const step = (t) => { const p = Math.min(1, (t - t0) / 500); out.textContent = Math.round(from + (score - from) * p); if (p < 1) requestAnimationFrame(step); else shown = score; };
    requestAnimationFrame(step);
  };
  ev.addEventListener('change', upd); upd();
}

// Tarjetas que se inclinan con el mouse.
if (matchMedia('(hover: hover) and (prefers-reduced-motion: no-preference)').matches) document.querySelectorAll('.w-card').forEach((c) => {
  c.addEventListener('pointermove', (e) => { const r = c.getBoundingClientRect(); c.style.setProperty('--ry', ((e.clientX - r.left) / r.width - .5) * 8 + 'deg'); c.style.setProperty('--rx', (.5 - (e.clientY - r.top) / r.height) * 8 + 'deg'); });
  c.addEventListener('pointerleave', () => { c.style.removeProperty('--rx'); c.style.removeProperty('--ry'); });
});

// Carné: girar para ver el reverso.
document.querySelectorAll("[data-flip]").forEach((b) => b.addEventListener("click", () => b.classList.toggle("flip")));

// Ficha del trabajador: el carné de la derecha cambia mientras se escribe.
const wf = document.querySelector('[data-wform]');
if (wf) {
  const card = wf.querySelector('.bc'), out = (k) => wf.querySelector(`[data-out="${k}"]`), cos = JSON.parse(wf.dataset.cos || '{}');
  const ini = (n) => String(n).trim().split(/\s+/).slice(0, 2).map((x) => x[0] || '').join('').toUpperCase() || '?';
  const bump = (el) => { if (!el) return; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); };
  wf.querySelectorAll('[data-live]').forEach((inp) => inp.addEventListener('input', () => {
    const k = inp.dataset.live, el = out(k), v = inp.value.trim();
    if (el) { el.textContent = v || (k === 'name' ? 'Nombre del trabajador' : ''); bump(el); }
    if (k === 'name' && out('initials')) out('initials').textContent = ini(v || '?');
    card.classList.remove('flip');
  }));
  wf.querySelector('[data-live-co]')?.addEventListener('change', (e) => { const el = out('company'); el.textContent = cos[e.target.value] || ''; bump(el); });
  const box = wf.querySelector('[data-out-photo]'), drop = wf.querySelector('[data-drop]'), file = wf.querySelector('[data-live-photo]');
  const show = (src) => {
    const slot = drop.querySelector('img, .w-photo-ph');
    box.replaceChildren();
    if (src) {
      const a = new Image(); a.src = src; a.alt = ''; box.append(a);
      const b = new Image(); b.src = src; b.alt = ''; slot.replaceWith(b);
    } else {
      const sp = document.createElement('span'); sp.dataset.out = 'initials'; sp.style.setProperty('--hue', '#1a5f99');
      sp.textContent = ini(wf.querySelector('[data-live=name]').value); box.append(sp);
    }
    bump(box); card.classList.remove('flip');
  };
  // Encuadre: se arrastra y se acerca la foto dentro de un marco 3:4; se guarda ya recortada (600 × 800).
  const dlg = wf.querySelector('[data-crop]'), vp = dlg?.querySelector('.crop-vp'), cimg = vp?.querySelector('img'), zoom = dlg?.querySelector('[data-zoom]');
  let st = null;
  const place = () => {
    const { iw, ih, base } = st, s = base * st.z, W = vp.clientWidth, H = vp.clientHeight;
    st.x = Math.min(0, Math.max(W - iw * s, st.x)); st.y = Math.min(0, Math.max(H - ih * s, st.y));
    cimg.style.transform = `translate(${st.x}px, ${st.y}px) scale(${s})`;
  };
  const openCrop = (src) => {
    const im = new Image();
    im.onload = () => {
      dlg.showModal();
      const W = vp.clientWidth, H = vp.clientHeight, base = Math.max(W / im.naturalWidth, H / im.naturalHeight);
      // Arranca centrado y un poco arriba: en las fotos de cuerpo entero la cara suele estar en el tercio superior.
      st = { im, iw: im.naturalWidth, ih: im.naturalHeight, base, z: 1, x: (W - im.naturalWidth * base) / 2, y: (H - im.naturalHeight * base) * .2 };
      cimg.src = src; zoom.value = 1; place();
    };
    im.src = src;
  };
  const zoomTo = (z, cx = vp.clientWidth / 2, cy = vp.clientHeight / 2) => {
    const s0 = st.base * st.z; st.z = Math.min(4, Math.max(1, z)); const s1 = st.base * st.z;
    st.x = cx - ((cx - st.x) * s1) / s0; st.y = cy - ((cy - st.y) * s1) / s0; zoom.value = st.z; place();
  };
  if (dlg) {
    let drag = null;
    vp.addEventListener('pointerdown', (e) => { drag = { x: e.clientX - st.x, y: e.clientY - st.y }; vp.setPointerCapture(e.pointerId); vp.classList.add('grab'); });
    vp.addEventListener('pointermove', (e) => { if (!drag) return; st.x = e.clientX - drag.x; st.y = e.clientY - drag.y; place(); });
    vp.addEventListener('pointerup', () => { drag = null; vp.classList.remove('grab'); });
    vp.addEventListener('wheel', (e) => { e.preventDefault(); const r = vp.getBoundingClientRect(); zoomTo(st.z * (e.deltaY < 0 ? 1.08 : .92), e.clientX - r.left, e.clientY - r.top); }, { passive: false });
    zoom.addEventListener('input', () => zoomTo(+zoom.value));
    dlg.addEventListener('cancel', () => { if (!dlg.dataset.keep) file.value = ''; });
    dlg.querySelector('[data-crop-cancel]').addEventListener('click', () => { if (!dlg.dataset.keep) file.value = ''; dlg.close(); });
    dlg.querySelector('[data-crop-ok]').addEventListener('click', () => {
      const k = 600 / vp.clientWidth, c = document.createElement('canvas'); c.width = 600; c.height = 800;
      const g = c.getContext('2d'), s = st.base * st.z * k;
      g.fillStyle = '#fff'; g.fillRect(0, 0, 600, 800); g.drawImage(st.im, st.x * k, st.y * k, st.iw * s, st.ih * s);
      c.toBlob((b) => {
        const dt = new DataTransfer(); dt.items.add(new File([b], 'foto.jpg', { type: 'image/jpeg' })); file.files = dt.files;
        const rm = wf.querySelector('[data-live-rm]'); if (rm) rm.checked = false;
        show(c.toDataURL('image/jpeg', .85)); dlg.close();
      }, 'image/jpeg', .88);
    });
    wf.querySelector('[data-recrop]')?.addEventListener('click', (e) => { dlg.dataset.keep = '1'; openCrop(e.currentTarget.dataset.recrop); });
  }
  file?.addEventListener('change', () => {
    const f = file.files[0]; if (!f) return;
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) { alert('Elige una foto JPG o PNG.'); file.value = ''; return; }
    if (f.size > 25 * 1024 * 1024) { alert('La foto pesa más de 25 MB. Elige una más liviana.'); file.value = ''; return; }
    const r = new FileReader(); r.onload = () => { if (dlg) { delete dlg.dataset.keep; openCrop(r.result); } else show(r.result); }; r.readAsDataURL(f);
  });
  wf.querySelector('[data-live-rm]')?.addEventListener('change', (e) => { if (e.target.checked) show(''); });
  ['dragenter', 'dragover'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, () => drop.classList.remove('over')));
  drop.addEventListener('drop', (e) => { e.preventDefault(); if (e.dataTransfer.files[0]) { file.files = e.dataTransfer.files; file.dispatchEvent(new Event('change')); } });
}
