#!/usr/bin/env bash
# Publica la versión actual en el servidor sin tocar los datos (/opt/imagroup/data).
# Uso: deploy/deploy.sh   (requiere acceso SSH configurado como host "imagroup-vps" o variable SSH)
set -euo pipefail
SSH=${SSH:-"ssh imagroup-vps"}
VER=$(git rev-parse --short HEAD)
git archive --format=tar HEAD | $SSH "mkdir -p /opt/imagroup/app /opt/imagroup/data && chown 1000:1000 /opt/imagroup/data && cd /opt/imagroup/app && tar -xf - && \
  (docker exec imagroup-web node --disable-warning=ExperimentalWarning scripts/backup.js || true) && \
  APP_VERSION=$VER docker compose up -d --build && sleep 4 && docker exec imagroup-web node -e \"fetch('http://localhost:3000/healthz').then(r=>r.json()).then(j=>console.log(j))\""
echo "Publicado $VER"
