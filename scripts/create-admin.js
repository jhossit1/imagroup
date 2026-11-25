// Pide al sitio un enlace de un solo uso (60 min) para que el administrador cree su propia contraseña.
// Uso: SETUP_KEY=... npm run create-admin -- <usuario> [https://dominio]
// En local, la clave se lee de .dev.vars. En producción es el secreto SETUP_KEY de Cloudflare.
import fs from 'node:fs';
const user = (process.argv[2] || '').trim();
const base = (process.argv[3] || 'http://localhost:8787').replace(/\/+$/, '');
const fromFile = fs.existsSync('.dev.vars') ? (/^SETUP_KEY\s*=\s*"?([^"\r\n]+)"?/m.exec(fs.readFileSync('.dev.vars', 'utf8')) || [])[1] : '';
const key = process.env.SETUP_KEY || fromFile;
if (!/^[a-zA-Z0-9._-]{3,40}$/.test(user)) { console.error('Indica un usuario válido: npm run create-admin -- nombre [https://dominio]'); process.exit(1); }
if (!key) { console.error('Falta la clave SETUP_KEY (variable de entorno o archivo .dev.vars).'); process.exit(1); }
const r = await fetch(base + '/__setup-link', { method: 'POST', headers: { authorization: 'Bearer ' + key, 'content-type': 'application/json' }, body: JSON.stringify({ user }) });
const j = r.headers.get('content-type')?.includes('json') ? await r.json() : null;
if (!r.ok || !j?.ok) { console.error(j?.message || `No se pudo crear el enlace (HTTP ${r.status}). Revisa la clave y la dirección.`); process.exit(1); }
console.log(`Enlace de un solo uso para "${user}" (vence en 60 minutos):\n${j.url}`);
