#!/usr/bin/env bash
set -a
# shellcheck disable=SC1091
source /opt/neeklo-integrator/.env
set +a
export NODE_ENV=production
export API_PORT=3022
export WEB_URL=https://integrator.neeklo.ru
cd /opt/neeklo-integrator/apps/api
if [[ ! -f dist/main.js ]]; then
  npx nest build -b swc
fi
exec node dist/main.js
