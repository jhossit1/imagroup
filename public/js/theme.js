// Aplica el tema guardado antes de pintar, para que no parpadee al cargar.
try { if (localStorage.getItem('theme') === 'dark') document.documentElement.dataset.theme = 'dark'; } catch { /* sin almacenamiento */ }
