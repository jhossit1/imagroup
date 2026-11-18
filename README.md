# Imagrup SAC · web y administración

Web de **Imagroup S.A.C.** (consultoría, gestión ambiental y obras) y **Gregorian** (equipos de protección personal), con panel de administración.

- Pruebas: https://imagroup.raser.pe (aviso de "versión de revisión" activo, `noindex`)
- Stack: Node.js 24 · Express 5 · SQLite integrado de Node (`node:sqlite`) · HTML renderizado en servidor · CSS/JS sin framework.

## Desarrollo local
```bash
npm install
npm run dev            # http://localhost:3000 (datos en ./data)
npm run create-admin -- miusuario http://localhost:3000
```
El último comando imprime un enlace de un solo uso (60 min) para crear la contraseña. No hay contraseñas en el código.

## Variables de entorno
| Variable | Uso | Por defecto |
|---|---|---|
| `PORT` | Puerto HTTP | 3000 |
| `DATA_DIR` | Base de datos, subidas y respaldos | `./data` |
| `PUBLIC_URL` | Base de los enlaces de alta de admin | — |
| `APP_VERSION` | Versión mostrada en `/healthz` | `dev` |

## Servidor (Contabo, Ubuntu 24.04)
- Código en `/opt/imagroup/app`, datos en `/opt/imagroup/data` (volumen; nunca se borra al publicar).
- Contenedor `imagroup-web` en la red `deploy_fijazo`; el Caddy existente (`/opt/fijazo/deploy/Caddyfile`) hace HTTPS y proxy.
- DNS: registro A `imagroup` → 217.77.11.160 en Cloudflare (solo DNS, sin proxy).
- Respaldo diario 04:15 (`/etc/cron.d/imagroup-backup`) en `/opt/imagroup/data/backups`, conserva 30.
- Logs: `docker logs imagroup-web`; accesos en el volumen de Caddy (`imagroup-access.log`).

### Publicar una versión
```bash
SSH="ssh -i ~/.ssh/cumple_deploy root@217.77.11.160" bash deploy/deploy.sh
```
Hace respaldo previo, reconstruye la imagen y comprueba `/healthz`. Las migraciones de base de datos se aplican solas al arrancar (`src/db.js`, lista `MIGRATIONS`, solo se agregan).

### Crear o recuperar un administrador en el servidor
```bash
ssh root@217.77.11.160 'docker exec imagroup-web node --disable-warning=ExperimentalWarning scripts/create-admin.js usuario https://imagroup.raser.pe'
```

### Restaurar un respaldo
```bash
docker stop imagroup-web && cp /opt/imagroup/data/backups/<archivo>.db /opt/imagroup/data/imagroup.db && rm -f /opt/imagroup/data/imagroup.db-wal /opt/imagroup/data/imagroup.db-shm && docker start imagroup-web
```

## Imágenes
`drive_originales/` (fuera de Git) guarda los originales de los Drive. `python scripts/optimize_images.py` genera los WebP de `public/img`. Origen de cada recurso: `docs/ASSETS.md`.

## Estructura
`src/server.js` rutas públicas · `src/admin.js` panel · `src/views.js` plantillas · `src/db.js` esquema, migraciones y datos iniciales · `src/auth.js` sesiones, contraseñas (scrypt), límites.
