#!/usr/bin/env bash
#
# Bootstrap de siaf-justificantes en el servidor SIAF (DEPLOYMENT.md pasos 2-9 + runner).
# Ejecutar EN EL SERVIDOR como el usuario `oliver`.  Idempotente: se puede repetir.
#
#   export GH_PAT=ghp_xxx            # token con permiso 'repo' (solo para registrar el runner)
#   bash deploy/bootstrap-server.sh
#
# Deja pendiente para ti:  rellenar SMTP_* en $ENV_FILE  y  `npm run seed` (una vez).
set -euo pipefail

REPO="OliverHuron/siaf-justificantes"
DOMAIN="justificantes.siafsystem.online"
APP_DIR="/var/www/siaf-justificantes"
ENV_FILE="/var/www/.env.siaf-justificantes"
PM2_NAME="siaf-justificantes"
PORT=5004
DB_NAME="justificantes_db"
DB_USER="justificantes_admin"
RUNNER_DIR="$HOME/actions-runner-justificantes"

say() { printf '\n\033[1;34m== %s ==\033[0m\n' "$*"; }

say "1/8  Chromium para el PDF del oficio"
if ! command -v google-chrome-stable >/dev/null 2>&1; then
  tmp=$(mktemp --suffix=.deb)
  wget -qO "$tmp" https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
  sudo apt-get update -qq
  sudo apt-get install -y "$tmp"
  rm -f "$tmp"
fi
sudo apt-get install -y --no-install-recommends \
  libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 \
  libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 \
  libcairo2 libatspi2.0-0 fonts-liberation "$(apt-cache show libasound2t64 >/dev/null 2>&1 && echo libasound2t64 || echo libasound2)" || true
command -v google-chrome-stable

say "2/8  Carpeta de despliegue"
sudo mkdir -p "$APP_DIR"
sudo chown -R oliver:oliver "$APP_DIR"
mkdir -p "$APP_DIR/server/storage/adjuntos" "$APP_DIR/server/storage/folios"

say "3/8  Base de datos $DB_NAME + usuario $DB_USER"
DB_PASS=""
[ -f "$ENV_FILE" ] && DB_PASS=$(sudo sed -n 's/^DB_PASSWORD=//p' "$ENV_FILE" || true)
[ -n "$DB_PASS" ] || DB_PASS=$(openssl rand -hex 20)
sudo -u postgres psql -v ON_ERROR_STOP=1 -q <<SQL
SELECT 'CREATE DATABASE $DB_NAME' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$DB_NAME')\gexec
DO \$\$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = '$DB_USER') THEN
    ALTER ROLE $DB_USER LOGIN PASSWORD '$DB_PASS';
  ELSE
    CREATE ROLE $DB_USER LOGIN PASSWORD '$DB_PASS';
  END IF;
END \$\$;
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;
SQL
sudo -u postgres psql -q -d "$DB_NAME" -c "GRANT ALL ON SCHEMA public TO $DB_USER;"

say "4/8  $ENV_FILE"
if [ ! -f "$ENV_FILE" ]; then
  sudo tee "$ENV_FILE" >/dev/null <<ENV
NODE_ENV=production
PORT=$PORT
CLIENT_URL=https://$DOMAIN
PUBLIC_URL=https://$DOMAIN

DB_HOST=localhost
DB_PORT=5432
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASS
DB_NAME=$DB_NAME

JWT_SECRET=$(openssl rand -hex 48)
JWT_EXPIRE=7d
JWT_ALUMNO_EXPIRE=2h
OTP_TTL_MIN=10
OTP_MAX_INTENTOS=5

PENDIENTES_MAX=2
DIAS_LIMITE_SOLICITUD=10

STORAGE_PATH=$APP_DIR/server/storage
CHROMIUM_PATH=$(command -v google-chrome-stable)
CONFIG_ENC_KEY=$(openssl rand -base64 32)
FOLIO_HMAC_SECRET=$(openssl rand -hex 48)

# --- SMTP: RELLENA ESTO. Sin SMTP válido el alumno NO recibe el código OTP. ---
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=CAMBIAME@gmail.com
SMTP_PASS=APP_PASSWORD_DE_16_CARACTERES
SMTP_FROM="Justificantes FCCA <CAMBIAME@gmail.com>"

SEED_PASSWORD=123456
ENV
  sudo chown oliver:oliver "$ENV_FILE"
  sudo chmod 600 "$ENV_FILE"
  echo "  creado."
else
  echo "  ya existía, no se toca."
fi

say "5/8  nginx"
sudo tee /etc/nginx/sites-available/siaf-justificantes >/dev/null <<'NGINX'
server {
    listen 80;
    server_name justificantes.siafsystem.online;

    root /var/www/siaf-justificantes/client/dist;
    index index.html;
    client_max_body_size 15m;

    location / { try_files $uri /index.html; }

    location /api/ {
        proxy_pass http://localhost:5004;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
NGINX
sudo ln -sf /etc/nginx/sites-available/siaf-justificantes /etc/nginx/sites-enabled/siaf-justificantes
sudo nginx -t
sudo systemctl reload nginx

say "6/8  Cloudflare Tunnel"
CF=/etc/cloudflared/config.yml
sudo cp "$CF" "$CF.bak.$(date +%s)"
if ! grep -q "$DOMAIN" "$CF"; then
  sudo sed -i "s|^\([[:space:]]*\)- service: http_status:404|\1- hostname: $DOMAIN\n\1  service: http://localhost:80\n\1- service: http_status:404|" "$CF"
fi
TUNNEL=$(sudo sed -n 's/^tunnel:[[:space:]]*//p' "$CF" | head -1)
[ -n "$TUNNEL" ] && cloudflared tunnel route dns "$TUNNEL" "$DOMAIN" || echo "  (revisa el route dns a mano: tunnel='$TUNNEL')"
sudo systemctl restart cloudflared

say "7/8  Runner de GitHub Actions (label 'siaf')"
if [ -f "$RUNNER_DIR/.runner" ]; then
  echo "  ya registrado."
else
  : "${GH_PAT:?exporta GH_PAT=ghp_... para registrar el runner}"
  mkdir -p "$RUNNER_DIR"; cd "$RUNNER_DIR"
  RV=$(curl -fsSL https://api.github.com/repos/actions/runner/releases/latest | sed -n 's/.*"tag_name": "v\([^"]*\)".*/\1/p')
  curl -fsSL -o r.tgz "https://github.com/actions/runner/releases/download/v${RV}/actions-runner-linux-x64-${RV}.tar.gz"
  tar xzf r.tgz && rm r.tgz
  REG=$(curl -fsSL -X POST -H "Authorization: Bearer $GH_PAT" -H "Accept: application/vnd.github+json" \
        "https://api.github.com/repos/$REPO/actions/runners/registration-token" | sed -n 's/.*"token": *"\([^"]*\)".*/\1/p')
  ./config.sh --unattended --replace --url "https://github.com/$REPO" --token "$REG" \
              --name "infra-siaf-justificantes" --labels "siaf" --work _work
  sudo ./svc.sh install oliver
  sudo ./svc.sh start
  cd - >/dev/null
fi

say "8/8  Disparar el primer deploy"
if [ -n "${GH_PAT:-}" ]; then
  curl -fsSL -X POST -H "Authorization: Bearer $GH_PAT" -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/$REPO/actions/workflows/deploy.yml/dispatches" -d '{"ref":"main"}' \
    && echo "  workflow disparado. Míralo en la pestaña Actions."
else
  echo "  haz un push a main (o Run workflow en Actions) para desplegar."
fi

cat <<FIN

────────────────────────────────────────────────────────────
Listo el bootstrap. Falta:

  1) Rellenar SMTP_* en $ENV_FILE  y  pm2 restart $PM2_NAME --update-env
  2) Cuando el workflow termine:  cd $APP_DIR/server && npm run seed   (una sola vez)
  3) Verificar:
       pm2 logs $PM2_NAME --lines 40
       curl -s http://localhost:$PORT/api/health
       curl -s https://$DOMAIN/api/health

Contraseña de la BD (guárdala):
FIN
sudo sed -n 's/^DB_PASSWORD=/  DB_PASSWORD = /p' "$ENV_FILE"
