# Imagrup SAC · web y administración

Web de **Imagroup S.A.C.** (consultoría, gestión ambiental y obras) y **Gregorian** (equipos de protección personal), con panel de administración.

- Stack: Cloudflare Workers · Express 5 · SQLite de un Durable Object · Workers KV para fotos · HTML renderizado en servidor · CSS/JS sin framework.
- Costo: plan gratuito de Cloudflare mientras el tráfico sea bajo (permite uso comercial).

## Cómo funciona en Cloudflare
| Parte | Dónde vive |
|---|---|
| `public/` (CSS, JS, imágenes del sitio) | Recursos estáticos de Workers. Se sirven directo, sin ejecutar código. |
| `/uploads/*` (fotos subidas en el panel) | Workers KV `imagroup-uploads` (binding `UPLOADS`). |
| Páginas, panel, formularios y PDF | App Express (`src/server.js`) dentro de un único Durable Object `Site` (`src/worker.js`). |
| Base de datos | SQLite del Durable Object. Las consultas son síncronas (`src/db.js`), y las migraciones se aplican solas al arrancar (lista `MIGRATIONS`, solo se agregan). |

## Desarrollo local
```bash
npm install
npm run dev            # http://localhost:8787 (base y fotos locales en .wrangler/)
npm run create-admin -- miusuario
```
`create-admin` imprime un enlace de un solo uso (60 min) para crear la contraseña. Usa la clave `SETUP_KEY` del archivo `.dev.vars` (fuera de Git). Crea ese archivo con una línea:
```
SETUP_KEY="una-clave-larga-de-al-menos-24-caracteres"
```

## Publicar en Cloudflare (primera vez)
1. Crea una cuenta gratuita en Cloudflare e inicia sesión desde la terminal: `npx wrangler login`.
2. Crea el espacio para fotos: `npx wrangler kv namespace create imagroup-uploads` y copia su `id` en `wrangler.jsonc` (`kv_namespaces`). Ya está hecho para la cuenta actual.
3. Guarda la clave para crear administradores: `npx wrangler secret put SETUP_KEY` (pega una clave larga y aleatoria).
4. Publica: `npm run deploy`. Queda en `https://imagroup.<tu-subdominio>.workers.dev`.
5. Crea el primer administrador: `SETUP_KEY=... npm run create-admin -- usuario https://imagroup.<tu-subdominio>.workers.dev`.
6. Dominio propio (ya hecho para imagroupsac.com): el dominio usa los nameservers de Cloudflare y `wrangler.jsonc` define rutas `imagroupsac.com/*` y `www.imagroupsac.com/*`. En el DNS, solo `imagroupsac.com` y `www` llevan el proxy activado; `mail`, `webmail`, `cpanel`, `ftp` y demás quedan en "DNS only" porque apuntan al hosting del correo. `www` redirige al dominio principal y `workers.dev` responde con `noindex`.

Para publicar cambios después, basta con `npm run deploy`.

## Respaldos
El SQLite de los Durable Objects incluye recuperación a un punto en el tiempo de los últimos 30 días (point-in-time recovery); confirmar en la documentación de Cloudflare que aplica al plan en uso. Las fotos quedan en Workers KV.

## Límites del plan gratuito a vigilar
- 100 000 peticiones al día a Workers y Durable Objects (los archivos de `public/` no cuentan).
- 5 GB de base de datos; en KV, 1 GB de fotos y 1 000 subidas al día.
- Toda la app corre en un solo Durable Object: suficiente para tráfico bajo o medio.

## Imágenes
`drive_originales/` (fuera de Git) guarda los originales de los Drive. `python scripts/optimize_images.py` genera los WebP de `public/img`. Origen de cada recurso: `docs/ASSETS.md`. `scripts/assets-manifest.js` lista las imágenes de `public/img` para el selector del diseñador; se ejecuta solo en cada `dev` y `deploy`.

## Estructura
`src/worker.js` entrada de Cloudflare · `src/server.js` rutas públicas · `src/admin.js` panel · `src/views.js` plantillas · `src/db.js` esquema, migraciones y datos iniciales · `src/files.js` fotos en KV e imágenes para PDF · `src/auth.js` sesiones, contraseñas (scrypt), límites.
