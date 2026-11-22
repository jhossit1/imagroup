import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { PRODUCT_COPY } from './copy-products.js';

export const DATA_DIR = process.env.DATA_DIR || path.resolve('data');
fs.mkdirSync(path.join(DATA_DIR, 'uploads'), { recursive: true });

export const db = new DatabaseSync(path.join(DATA_DIR, 'imagroup.db'));
db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
// Migraciones por versión: solo se agregan, nunca se editan las ya aplicadas.
const MIGRATIONS = [
  `CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT);
   CREATE TABLE companies (id INTEGER PRIMARY KEY, slug TEXT UNIQUE, name TEXT, tagline TEXT, description TEXT,
     scope TEXT, logo TEXT, logo_dark TEXT, image TEXT, sort INTEGER DEFAULT 0);
   CREATE TABLE services (id INTEGER PRIMARY KEY, company_id INTEGER REFERENCES companies(id), slug TEXT UNIQUE,
     title TEXT, summary TEXT, body TEXT, image TEXT, sort INTEGER DEFAULT 0, visible INTEGER DEFAULT 1);
   CREATE TABLE categories (id INTEGER PRIMARY KEY, slug TEXT UNIQUE, name TEXT, sort INTEGER DEFAULT 0);
   CREATE TABLE products (id INTEGER PRIMARY KEY, category_id INTEGER REFERENCES categories(id), slug TEXT UNIQUE,
     name TEXT, description TEXT, variants TEXT, price_cents INTEGER, availability TEXT DEFAULT 'disponible',
     image TEXT, sort INTEGER DEFAULT 0, visible INTEGER DEFAULT 1);
   CREATE TABLE projects (id INTEGER PRIMARY KEY, slug TEXT UNIQUE, title TEXT, area TEXT, period TEXT, place TEXT,
     summary TEXT, image TEXT, gallery TEXT, sort INTEGER DEFAULT 0, visible INTEGER DEFAULT 1);
   CREATE TABLE leads (id INTEGER PRIMARY KEY, kind TEXT, name TEXT, phone TEXT, email TEXT, organization TEXT,
     subject TEXT, message TEXT, items TEXT, total_cents INTEGER, delivery TEXT, status TEXT DEFAULT 'nuevo',
     notes TEXT, created_at TEXT DEFAULT (datetime('now')));
   CREATE TABLE admins (id INTEGER PRIMARY KEY, username TEXT UNIQUE, pass_hash TEXT, created_at TEXT DEFAULT (datetime('now')));
   CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, admin_id INTEGER REFERENCES admins(id) ON DELETE CASCADE,
     csrf TEXT, expires INTEGER);
   CREATE TABLE setup_tokens (token_hash TEXT PRIMARY KEY, username TEXT, expires INTEGER);
   CREATE TABLE pageviews (day TEXT, path TEXT, count INTEGER DEFAULT 0, PRIMARY KEY (day, path));
   CREATE TABLE audit (id INTEGER PRIMARY KEY, admin TEXT, action TEXT, entity TEXT, entity_id INTEGER, detail TEXT,
     at TEXT DEFAULT (datetime('now')));`,
  // v0.2: trabajadores (solo administrador), evaluaciones con reconocimiento y certificados verificables.
  `CREATE TABLE workers (id INTEGER PRIMARY KEY, name TEXT NOT NULL, phone TEXT, trade TEXT, zone TEXT,
     company_id INTEGER REFERENCES companies(id) DEFAULT 1, joined TEXT, status TEXT DEFAULT 'activo', notes TEXT,
     created_at TEXT DEFAULT (datetime('now')));
   CREATE TABLE evaluations (id INTEGER PRIMARY KEY, worker_id INTEGER NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
     period TEXT NOT NULL, project TEXT, days INTEGER, s_seg INTEGER, s_cal INTEGER, s_prod INTEGER, s_pun INTEGER,
     s_equ INTEGER, s_ord INTEGER, score REAL, level TEXT, bonus_cents INTEGER, status TEXT DEFAULT 'propuesto',
     reason TEXT, evaluator TEXT, decided_by TEXT, decided_at TEXT, revoke_reason TEXT, created_at TEXT DEFAULT (datetime('now')),
     UNIQUE (worker_id, period));
   CREATE TABLE certificates (id INTEGER PRIMARY KEY, code TEXT UNIQUE NOT NULL, worker_id INTEGER NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
     evaluation_id INTEGER REFERENCES evaluations(id) ON DELETE SET NULL, kind TEXT, title TEXT, body TEXT, company_id INTEGER,
     issued_by TEXT, issued_at TEXT DEFAULT (datetime('now')), revoked_at TEXT, revoked_reason TEXT);
   ALTER TABLE companies ADD COLUMN signer_name TEXT;
   ALTER TABLE companies ADD COLUMN signer_role TEXT DEFAULT 'Gerencia General';
   ALTER TABLE companies ADD COLUMN signature TEXT;
   ALTER TABLE companies ADD COLUMN signer2_name TEXT DEFAULT 'Ing. Jhossi Gregory Tenorio Montenegro';
   ALTER TABLE companies ADD COLUMN signer2_role TEXT DEFAULT 'Ingeniero responsable · CIP 285140';
   ALTER TABLE companies ADD COLUMN signature2 TEXT;
   INSERT OR IGNORE INTO settings (key, value) VALUES ('bono_oro', '300'), ('bono_plata', '200'), ('bono_bronce', '100');`,
  // v0.3: carné físico con QR y foto opcional del trabajador.
  `ALTER TABLE workers ADD COLUMN photo TEXT;
   CREATE TABLE badges (id INTEGER PRIMARY KEY, code TEXT UNIQUE NOT NULL, worker_id INTEGER NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
     expires TEXT NOT NULL, issued_by TEXT, issued_at TEXT DEFAULT (datetime('now')), revoked_at TEXT, revoked_reason TEXT);`,
  // Descripciones nuevas de la tienda: solo reemplaza las del sembrado inicial, no las editadas en el panel.
  PRODUCT_COPY.map(([slug, old, txt]) => `UPDATE products SET description = ${q(txt)} WHERE slug = ${q(slug)} AND (description IS NULL OR description IN ('', ${q(old)}));`).join(' '),
  // v0.4: criterio Garantía, calificación guardada en el certificado y datos del último carné impreso.
  `ALTER TABLE evaluations ADD COLUMN s_gar INTEGER;
   ALTER TABLE certificates ADD COLUMN ratings TEXT;
   ALTER TABLE badges ADD COLUMN printed TEXT;`,
  // v0.5: el trabajador puede ocultarse de la página pública Equipo.
  `ALTER TABLE workers ADD COLUMN public INTEGER DEFAULT 1;`,
  // v0.6: opiniones de clientes con enlace único; solo se publican al aprobarlas.
  `CREATE TABLE reviews (id INTEGER PRIMARY KEY, code TEXT UNIQUE NOT NULL, worker_id INTEGER NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
     job TEXT, client TEXT, s_pun INTEGER, s_gar INTEGER, s_cal INTEGER, again INTEGER, comment TEXT, show_name INTEGER DEFAULT 1,
     status TEXT NOT NULL DEFAULT 'enviado', expires TEXT NOT NULL, created_by TEXT, created_at TEXT DEFAULT (datetime('now')), answered_at TEXT, decided_by TEXT);
   CREATE INDEX reviews_worker ON reviews (worker_id, status);`,
];

db.exec('CREATE TABLE IF NOT EXISTS _migrations (n INTEGER PRIMARY KEY)');
const done = new Set(db.prepare('SELECT n FROM _migrations').all().map((r) => r.n));
MIGRATIONS.forEach((sql, i) => {
  if (done.has(i)) return;
  db.exec('BEGIN'); db.exec(sql); db.prepare('INSERT INTO _migrations (n) VALUES (?)').run(i); db.exec('COMMIT');
  if (i === 0) seed();
});

export const all = (sql, ...a) => db.prepare(sql).all(...a);
export const get = (sql, ...a) => db.prepare(sql).get(...a);
export const run = (sql, ...a) => db.prepare(sql).run(...a);

export function settings() {
  return Object.fromEntries(all('SELECT key, value FROM settings').map((r) => [r.key, r.value]));
}

export function audit(admin, action, entity, id, detail = '') {
  run('INSERT INTO audit (admin, action, entity, entity_id, detail) VALUES (?,?,?,?,?)', admin, action, entity, id ?? null, String(detail).slice(0, 500));
}

// Datos iniciales tomados de imagroupsac.com y de los Drive del cliente (ver docs/ASSETS.md).
function seed() {
  const S = {
    site_name: 'Imagroup S.A.C.',
    phone_1: '943 300 006', phone_2: '942 610 275', whatsapp: '51943300006',
    email: 'areacomercial@imagroupsac.com', city: 'Lima, Perú',
    facebook: 'https://www.facebook.com/imagroup.10/',
    review_banner: '1', notify_webhook: '',
    owner_name: '', owner_role: '', owner_bio: '', owner_photo: '/img/brand/ing-perfil.webp',
  };
  const ins = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
  for (const [k, v] of Object.entries(S)) ins.run(k, v);

  const co = db.prepare('INSERT INTO companies (slug, name, tagline, description, scope, logo, logo_dark, image, sort) VALUES (?,?,?,?,?,?,?,?,?)');
  co.run('imagroup', 'Imagroup S.A.C.', 'Grupo de Ingeniería Medioambiental',
    'Consultoría, gestión ambiental y municipal, y obras de ingeniería para proyectos de inversión pública y privada. Trabajamos en campo, con la comunidad y con el expediente técnico.',
    'Gestión de residuos sólidos\nEducación y comunicación ambiental\nAgua y saneamiento rural\nExpedientes técnicos y planos\nMantenimiento vial\nEnergía solar fotovoltaica',
    '/img/brand/imagroup.webp', '/img/brand/imagroup.webp', '/img/f/agua-1.webp', 1);
  co.run('gregorian', 'Gregorian', 'Seguridad en Ingeniería',
    'Equipos de protección personal y ropa de trabajo para obra, campo e industria. Cotiza por unidad o por volumen para tu cuadrilla.',
    'Calzado de seguridad\nRopa de trabajo y outdoor\nProtección de cabeza, manos y respiratoria\nAccesorios y señalización',
    '/img/brand/gregorian-h.webp', '/img/brand/gregorian-sq.webp', '/img/p/casco.webp', 2);

  const sv = db.prepare('INSERT INTO services (company_id, slug, title, summary, body, image, sort) VALUES (1,?,?,?,?,?,?)');
  [
    ['residuos-solidos-municipales', 'Residuos sólidos municipales', 'Estudios de caracterización y asesoría para implementar la gestión integral de residuos del municipio.', 'Acompañamos a gobiernos locales en el estudio de caracterización, la segregación en la fuente y la planificación del manejo integral de residuos sólidos.', '/img/f/residuos-1.webp'],
    ['residuos-solidos-no-municipales', 'Residuos sólidos no municipales', 'Asesoría para el manejo de residuos en actividades productivas y de servicios.', 'Apoyo técnico para organizar el manejo de residuos no municipales: identificación, almacenamiento, registros y valorización de residuos orgánicos.', '/img/f/organicos-1.webp'],
    ['educacion-ambiental', 'Educación y comunicación ambiental', 'Campañas, talleres y materiales para colegios, municipios y comunidades.', 'Diseñamos y ejecutamos actividades de sensibilización: talleres en colegios, campañas de segregación y comunicación ambiental para programas municipales.', '/img/f/educacion-1.webp'],
    ['agua-y-saneamiento', 'Agua y saneamiento rural', 'Monitoreo de calidad del agua y expedientes para sistemas de agua y saneamiento.', 'Monitoreo de la calidad del agua en campo, diagnóstico y elaboración de expedientes técnicos para mejoramiento de sistemas de agua y saneamiento rural.', '/img/f/agua-2.webp'],
    ['planos-y-expedientes', 'Planos y expedientes técnicos', 'Planos de arquitectura, sanitarias y eléctricas; planos urbanos.', 'Elaboración de planos de arquitectura, instalaciones sanitarias y eléctricas, planos urbanos y expedientes técnicos para proyectos de inversión.', null],
    ['asesoria-ambiental', 'Asesoría y consultoría ambiental', 'Acompañamiento técnico en instrumentos y obligaciones ambientales.', 'Consultoría para proyectos y actividades económicas que necesitan incorporar el componente ambiental y social en su gestión.', '/img/f/agua-3.webp'],
    ['mantenimiento-vial', 'Mantenimiento vial', 'Mantenimiento de caminos vecinales con cuadrillas locales.', 'Ejecución de mantenimiento rutinario de caminos vecinales con personal de la zona y equipos de protección completos.', '/img/f/vial-1.webp'],
    ['energia-solar', 'Sistemas fotovoltaicos', 'Instalación de sistemas solares para energía en zonas aisladas.', 'Instalación de paneles solares, tableros y baterías para dotar de energía a locales en zonas sin red o con suministro inestable.', '/img/f/solar-1.webp'],
  ].forEach((r, i) => sv.run(...r, i));

  const cat = db.prepare('INSERT INTO categories (slug, name, sort) VALUES (?,?,?)');
  [['calzado', 'Calzado'], ['ropa', 'Ropa de trabajo'], ['proteccion', 'Protección personal'], ['accesorios', 'Accesorios']].forEach((c, i) => cat.run(...c, i));
  const pr = db.prepare('INSERT INTO products (category_id, slug, name, description, price_cents, image, sort) VALUES (?,?,?,?,?,?,?)');
  [
    [1, 'zapatos-de-seguridad', 'Zapatos de seguridad', 'Calzado de seguridad para obra y campo.', 7000, 'zapatos'],
    [1, 'botas-de-jebe', 'Botas de seguridad industrial', 'Botas de jebe para trabajo en zonas húmedas.', 3500, 'botas'],
    [3, 'casco-de-proteccion', 'Casco de protección', 'Casco de seguridad con suspensión ajustable.', 6500, 'casco'],
    [3, 'guantes-de-badana', 'Guantes de badana', 'Guantes de cuero para trabajo general.', 1500, 'guantes'],
    [3, 'respirador-full-face', 'Respirador full face', 'Equipo de protección respiratoria de cara completa.', 50000, 'respirador'],
    [3, 'juego-de-seguridad', 'Juego de seguridad', 'Kit de protección personal. Consulta el contenido según tu actividad.', 6000, 'juego-seguridad'],
    [2, 'chaleco-multibolsillo', 'Chaleco multibolsillo', 'Chaleco de trabajo con bolsillos, personalizable con tu logo.', 7000, 'chaleco-multibolsillo'],
    [2, 'chaleco-rojo', 'Chaleco rojo multibolsillo', 'Chaleco institucional personalizable.', 4700, 'chaleco-rojo'],
    [2, 'pantalon-outdoor', 'Pantalón outdoor', 'Pantalón de trabajo personalizable.', 9000, 'pantalon'],
    [2, 'camisa-outdoor', 'Camisa outdoor', 'Camisa y pantalón para actividades al aire libre.', 12000, 'camisa-outdoor'],
    [2, 'polo-lurawi', 'Polo Lurawi', 'Polo manga larga con logos institucionales.', 3000, 'polo-lurawi'],
    [2, 'poncho-impermeable', 'Poncho impermeable', 'Poncho con cinta reflectiva.', 3500, 'poncho'],
    [2, 'polo-manga-larga', 'Polo manga larga', 'Polo de trabajo con cintas reflectivas.', null, 'polo-ml'],
    [2, 'polo-manga-larga-deporte', 'Polo manga larga deportivo', 'Polo de trabajo de tela ligera.', null, 'polo-ml-deporte'],
    [4, 'silbato', 'Silbato con cuerda', 'Silbato capado con cuerda de seguridad.', 600, 'silbato'],
  ].forEach(([c, s, n, d, p, img], i) => pr.run(c, s, n, d, p, `/img/p/${img}.webp`, i));

  const pj = db.prepare('INSERT INTO projects (slug, title, area, period, summary, image, gallery, sort) VALUES (?,?,?,?,?,?,?,?)');
  [
    ['caracterizacion-residuos', 'Estudio de caracterización de residuos sólidos municipales', 'Residuos sólidos', '2018', 'Muestreo, pesaje y clasificación de residuos domiciliarios con equipo de campo.', 'residuos-1', 'residuos-2'],
    ['educacion-ambiental-colegios', 'Educación ambiental en colegios y comunidad', 'Educación ambiental', '2018', 'Talleres, pasacalles y campañas de segregación con estudiantes y vecinos.', 'educacion-1', 'educacion-2'],
    ['monitoreo-calidad-agua', 'Monitoreo de la calidad del agua', 'Agua y saneamiento', '2018', 'Toma de muestras y mediciones en campo con equipo portátil.', 'agua-1', 'agua-2,agua-3'],
    ['sistemas-fotovoltaicos', 'Instalación de sistemas fotovoltaicos', 'Energía', '2018', 'Paneles, tablero y banco de baterías para un local sin suministro estable.', 'solar-1', 'solar-2'],
    ['mantenimiento-vial-vecinal', 'Mantenimiento vial sostenible de caminos vecinales', 'Infraestructura', '', 'Trabajo con cuadrillas locales en caminos vecinales.', 'vial-2', 'vial-1'],
    ['valorizacion-organicos', 'Estabilización y valorización de residuos orgánicos', 'Residuos sólidos', '', 'Compostaje y aprovechamiento de residuos orgánicos.', 'organicos-1', ''],
    ['cultivo-hidroponico', 'Sistemas de cultivo hidropónico', 'Producción sostenible', '2018', 'Diseño e instalación de módulos hidropónicos.', 'hidro-1', ''],
    ['biogas', 'Sistemas de producción de biogás', 'Energía', '', 'Biodigestores de bajo costo a partir de residuos orgánicos.', 'biogas-1', ''],
  ].forEach(([s, t, a, p, sum, img, gal], i) =>
    pj.run(s, t, a, p, sum, `/img/f/${img}.webp`, gal.split(',').filter(Boolean).map((g) => `/img/f/${g}.webp`).join('\n'), i));
}
