#!/usr/bin/env bash
set -euo pipefail
# Kill any process you own that is bound to port 3000
fuser -k 3000/tcp || true
# Start the app
exec node /var/www/dojopro/backend/app.js
