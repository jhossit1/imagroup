// Copia consistente de la base de datos (VACUUM INTO). Conserva las últimas 30.
import fs from 'node:fs';
import path from 'node:path';
import { db, DATA_DIR } from '../src/db.js';
const dir = path.join(DATA_DIR, 'backups'); fs.mkdirSync(dir, { recursive: true });
const file = path.join(dir, `imagroup-${new Date().toISOString().replace(/[:.]/g, '-')}.db`);
db.exec(`VACUUM INTO '${file}'`);
fs.readdirSync(dir).filter((f) => f.endsWith('.db')).sort().slice(0, -30).forEach((f) => fs.unlinkSync(path.join(dir, f)));
console.log('Respaldo:', file);
