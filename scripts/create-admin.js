// Genera un enlace de un solo uso (60 min) para que el administrador cree su propia contraseña.
// Uso: npm run create-admin -- <usuario> [https://dominio]
import { run } from '../src/db.js';
import { sha, token } from '../src/auth.js';
const user = (process.argv[2] || '').trim();
if (!/^[a-zA-Z0-9._-]{3,40}$/.test(user)) { console.error('Indica un usuario válido: npm run create-admin -- nombre'); process.exit(1); }
const t = token();
run('INSERT INTO setup_tokens (token_hash, username, expires) VALUES (?,?,?)', sha(t), user, Date.now() + 60 * 60e3);
console.log(`Enlace de un solo uso para "${user}" (vence en 60 minutos):\n${process.argv[3] || process.env.PUBLIC_URL || 'http://localhost:3000'}/admin/setup?t=${t}`);
