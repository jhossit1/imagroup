import crypto from 'node:crypto';
import { get, run } from './db.js';

const SESSION_HOURS = 12;
export const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
export const token = () => crypto.randomBytes(32).toString('base64url');

export function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(pw, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`;
}
export function checkPassword(pw, stored) {
  const [, salt, key] = String(stored).split('$');
  if (!salt || !key) return false;
  const k = crypto.scryptSync(pw, Buffer.from(salt, 'hex'), 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return crypto.timingSafeEqual(k, Buffer.from(key, 'hex'));
}
export function passwordProblem(pw) {
  if (!pw || pw.length < 8) return 'Usa al menos 8 caracteres.';
  if (!/[a-zA-Z]/.test(pw) || !/[0-9]/.test(pw)) return 'Combina letras y números.';
  return null;
}

export function createSession(res, adminId, secure) {
  const t = token();
  run('INSERT INTO sessions (token_hash, admin_id, csrf, expires) VALUES (?,?,?,?)', sha(t), adminId, token(), Date.now() + SESSION_HOURS * 3600e3);
  res.cookie('sid', t, { httpOnly: true, sameSite: 'lax', secure, path: '/', maxAge: SESSION_HOURS * 3600e3 });
}
export function destroySession(req, res) {
  if (req.cookies.sid) run('DELETE FROM sessions WHERE token_hash = ?', sha(req.cookies.sid));
  res.clearCookie('sid', { path: '/' });
}

// Carga la sesión del administrador (si existe) en req.admin y req.csrf.
export function loadSession(req, _res, next) {
  const t = req.cookies.sid;
  if (t) {
    const s = get('SELECT s.csrf, s.expires, a.id, a.username FROM sessions s JOIN admins a ON a.id = s.admin_id WHERE s.token_hash = ?', sha(t));
    if (s && s.expires > Date.now()) { req.admin = { id: s.id, username: s.username }; req.csrf = s.csrf; }
  }
  next();
}
export function requireAdmin(req, res, next) {
  if (!req.admin) return res.redirect('/admin/login');
  if (req.method === 'POST') {
    const sent = req.body?._csrf || req.get('x-csrf');
    if (!sent || sent !== req.csrf) return res.status(403).send('Sesión expirada. Vuelve a cargar la página.');
  }
  next();
}

// Límite simple en memoria por clave (IP + acción).
const hits = new Map();
export function limited(key, max, windowMs) {
  const now = Date.now();
  const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
  arr.push(now); hits.set(key, arr);
  if (hits.size > 5000) for (const [k, v] of hits) if (now - v[v.length - 1] > windowMs) hits.delete(k);
  return arr.length > max;
}
