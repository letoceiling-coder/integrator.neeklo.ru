# Deploy — integrator.neeklo.ru

Isolated production stack on `212.67.9.173`. Does **not** use host ports 5432/6379/3001.

## Layout

| Component | Location / port |
| --- | --- |
| App root | `/opt/neeklo-integrator` |
| Static web | `/var/www/integrator.neeklo.ru` |
| API (PM2) | `127.0.0.1:3022` → `neeklo-integrator-api` |
| Postgres (Docker) | `127.0.0.1:5438` |
| Redis (Docker) | `127.0.0.1:6385` |
| Nginx vhost | `/etc/nginx/sites-available/integrator.neeklo.ru.conf` |

## First deploy / update

```bash
# from dev machine — sync tarball
tar -czf /tmp/neeklo-integrator.tgz --exclude=node_modules --exclude=.git .
scp /tmp/neeklo-integrator.tgz root@212.67.9.173:/tmp/
ssh root@212.67.9.173 'mkdir -p /opt/neeklo-integrator && tar xzf /tmp/neeklo-integrator.tgz -C /opt/neeklo-integrator'

# on server
cd /opt/neeklo-integrator
sed -i 's/\r$//' deploy/deploy.sh deploy/start-api.sh
chmod +x deploy/deploy.sh deploy/start-api.sh
bash deploy/deploy.sh
```

## SSL (safe — webroot only, no `--nginx` mass edit)

```bash
certbot certonly --webroot -w /var/www/certbot -d integrator.neeklo.ru
cp deploy/nginx/integrator.neeklo.ru.ssl.conf /etc/nginx/sites-available/integrator.neeklo.ru.conf
nginx -t && systemctl reload nginx
```

## Secrets

Edit `/opt/neeklo-integrator/.env` (never overwritten by deploy script):

- `OPENROUTER_API_KEY` — for AI features
- `AVITO_CLIENT_ID` / `AVITO_CLIENT_SECRET` — for live Avito API

## Demo login

`owner@neeklo.dev` / `neeklo12345`

## URL

https://integrator.neeklo.ru
