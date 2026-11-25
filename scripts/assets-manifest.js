// Lista las imágenes de public/ que ofrece el selector de imágenes del diseñador.
// Se ejecuta antes de cada compilación de Wrangler (wrangler.jsonc → build.command).
import fs from 'node:fs';
const dirs = ['public/img/f', 'public/img/p/c', 'public/img/brand'];
const out = Object.fromEntries(dirs.map((d) => [d, fs.existsSync(d) ? fs.readdirSync(d).filter((f) => /\.(webp|png|jpe?g)$/i.test(f)).sort() : []]));
const file = 'src/assets-manifest.json', text = JSON.stringify(out, null, 1) + '\n';
// Solo escribe si cambió: wrangler dev vigila src/ y volvería a compilar sin parar.
if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== text) fs.writeFileSync(file, text);
