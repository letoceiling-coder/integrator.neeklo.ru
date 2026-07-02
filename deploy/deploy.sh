#!/usr/bin/env bash
# Safe deploy for integrator.neeklo.ru — isolated under /opt/neeklo-integrator
# Does NOT modify other nginx vhosts or docker stacks.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/neeklo-integrator}"
WEB_ROOT="${WEB_ROOT:-/var/www/integrator.neeklo.ru}"
NGINX_AVAILABLE="/etc/nginx/sites-available/integrator.neeklo.ru.conf"
NGINX_ENABLED="/etc/nginx/sites-enabled/integrator.neeklo.ru.conf"
DOMAIN="integrator.neeklo.ru"
API_PORT="3022"

cd "$APP_DIR"

echo "==> [1/9] Ensure .env (never overwrite existing)"
if [[ ! -f .env ]]; then
  cp deploy/env.production.example .env
  JWT_ACCESS=$(openssl rand -hex 32)
  JWT_REFRESH=$(openssl rand -hex 32)
  PG_PASS=$(openssl rand -hex 16)
  sed -i "s/CHANGE_ME_ACCESS_MIN_32_CHARS/${JWT_ACCESS}/" .env
  sed -i "s/CHANGE_ME_REFRESH_MIN_32_CHARS/${JWT_REFRESH}/" .env
  sed -i "s/CHANGE_ME_STRONG_PASSWORD/${PG_PASS}/g" .env
  echo "Created .env with generated secrets."
else
  echo ".env exists — keeping as-is."
fi
sed -i 's/\r$//' .env

# Host-side DB/Redis URLs (docker maps 5438/6385 on localhost)
grep -q '^DATABASE_URL=postgresql://.*127.0.0.1:5438' .env || {
  PG_PASS=$(grep '^POSTGRES_PASSWORD=' .env | cut -d= -f2-)
  sed -i "s|^DATABASE_URL=.*|DATABASE_URL=postgresql://neeklo_integrator:${PG_PASS}@127.0.0.1:5438/neeklo_integrator?schema=public|" .env
}
grep -q '^REDIS_URL=redis://127.0.0.1:6385' .env || sed -i 's|^REDIS_URL=.*|REDIS_URL=redis://127.0.0.1:6385|' .env

echo "==> [2/9] Start Postgres + Redis (isolated ports 5438, 6385)"
docker compose --env-file .env -f deploy/docker-compose.prod.yml up -d postgres redis

echo "==> [3/9] Install deps + build packages + web"
corepack enable 2>/dev/null || true
corepack prepare pnpm@9.12.0 --activate 2>/dev/null || true
pnpm install
pnpm build:packages
pnpm --filter @neeklo/api db:generate

echo "==> [4/9] Apply schema + seed"
export $(grep -v '^#' .env | xargs)
cd apps/api
npx prisma db push --skip-generate
npx --yes tsx prisma/seed.ts || true
cd "$APP_DIR"

echo "==> [5/9] Build frontend"
pnpm --filter @neeklo/web build
mkdir -p "$WEB_ROOT"
rsync -a --delete apps/web/dist/ "$WEB_ROOT/"
chown -R www-data:www-data "$WEB_ROOT" 2>/dev/null || true

echo "==> [6/9] Build API (SWC) + start via PM2 (127.0.0.1:${API_PORT})"
cd apps/api
pnpm add -D @swc/cli @swc/core class-validator class-transformer 2>/dev/null || true
npx nest build -b swc
cd "$APP_DIR"
pm2 delete neeklo-integrator-api 2>/dev/null || true
pm2 start deploy/ecosystem.config.cjs
pm2 save

echo "==> [7/9] Wait for API health"
for i in $(seq 1 30); do
  if curl -sf "http://127.0.0.1:${API_PORT}/api/health" >/dev/null 2>&1; then
    echo "API healthy."
    break
  fi
  if [[ $i -eq 30 ]]; then
    echo "API health check failed — pm2 logs:"
    pm2 logs neeklo-integrator-api --lines 40 --nostream
    exit 1
  fi
  sleep 2
done

echo "==> [8/9] Install nginx vhost (HTTP stage)"
cp deploy/nginx/integrator.neeklo.ru.conf "$NGINX_AVAILABLE"
ln -sf ../sites-available/integrator.neeklo.ru.conf "$NGINX_ENABLED"
nginx -t
systemctl reload nginx

echo "==> [9/9] SSL certificate (webroot only — safe for other vhosts)"
if [[ ! -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]]; then
  certbot certonly --webroot -w /var/www/certbot -d "$DOMAIN" \
    --non-interactive --agree-tos --register-unsafely-without-email || {
    echo "Certbot failed — site works on HTTP until cert is issued."
  }
fi

if [[ -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]]; then
  cp deploy/nginx/integrator.neeklo.ru.ssl.conf "$NGINX_AVAILABLE"
  nginx -t
  systemctl reload nginx
  echo "HTTPS enabled for ${DOMAIN}"
fi

echo ""
echo "Deploy complete:"
echo "  https://${DOMAIN}"
echo "  Demo login: owner@neeklo.dev / neeklo12345"
echo "  API: http://127.0.0.1:${API_PORT}/api/health"
