#!/usr/bin/env bash
# Установка сайта командной формы на Ubuntu/Debian.
# Запуск (из папки, где лежит этот файл):   sudo bash install.sh
# Позже, когда будет домен:                  sudo bash install.sh forma.example.ru
set -euo pipefail

DOMAIN="${1:-}"
APP_DIR=/var/www/axel-team-form
SRC_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVICE=axel-leads
NGINX_CONF=/etc/nginx/sites-available/axel-team-form

say() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31mОшибка: %s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "запустите от root: sudo bash install.sh"
[ -d "$SRC_DIR/public" ] && [ -d "$SRC_DIR/server" ] || die "рядом со скриптом должны быть папки public и server"
command -v apt-get >/dev/null || die "скрипт рассчитан на Ubuntu/Debian"

say "1/6 Устанавливаю nginx и инструменты"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq nginx curl ca-certificates rsync >/dev/null

say "2/6 Проверяю Node.js"
NODE_MAJOR=0
command -v node >/dev/null && NODE_MAJOR="$(node -v | sed 's/^v//; s/\..*//')"
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "Ставлю Node.js 20 LTS"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
fi
echo "Node.js $(node -v)"

say "3/6 Копирую файлы в $APP_DIR"
mkdir -p "$APP_DIR"
# .env и журнал заявок на сервере не перезаписываем
rsync -a --delete --exclude 'server/.env' --exclude 'server/leads.log' --exclude 'server/node_modules' \
  "$SRC_DIR/public" "$SRC_DIR/server" "$APP_DIR/"
[ -f "$APP_DIR/server/.env" ] || cp "$APP_DIR/server/.env.example" "$APP_DIR/server/.env"
(cd "$APP_DIR/server" && npm install --omit=dev --no-audit --no-fund --silent)
chown -R www-data:www-data "$APP_DIR"
chmod 600 "$APP_DIR/server/.env"

# Адрес сайта — для превью ссылок в мессенджерах (og:image должен быть полным адресом)
if [ -n "$DOMAIN" ]; then
  SITE_URL="https://$DOMAIN"
else
  IP="$(curl -fsS -4 --max-time 5 https://ifconfig.me || hostname -I | awk '{print $1}')"
  SITE_URL="http://$IP"
fi
sed -i "s#content=\"[^\"]*/assets/img/og.jpg\"#content=\"$SITE_URL/assets/img/og.jpg\"#" "$APP_DIR/public/index.html"

say "4/6 Настраиваю nginx"
OTHER_SITES="$(ls /etc/nginx/sites-enabled 2>/dev/null | grep -v -x -e default -e axel-team-form || true)"
if [ -z "$DOMAIN" ] && [ -n "$OTHER_SITES" ]; then
  die "на сервере уже есть другие сайты ($OTHER_SITES). Без домена сайт займёт адрес http://IP и может их перекрыть. Запустите с доменом: sudo bash install.sh ваш.домен"
fi
if [ -n "$DOMAIN" ]; then LISTEN="listen 80;"; NAME="server_name $DOMAIN;"; else LISTEN="listen 80 default_server; listen [::]:80 default_server;"; NAME="server_name _;"; fi

cat > "$NGINX_CONF" <<NGINX
server {
    $LISTEN
    $NAME

    root $APP_DIR/public;
    index index.html;
    server_tokens off;

    location = /api/lead {
        proxy_pass http://127.0.0.1:3005;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        client_max_body_size 32k;
    }

    location /assets/ {
        expires 30d;
        add_header Cache-Control "public";
    }
    location = /data/works.json { add_header Cache-Control "no-cache"; }
    location = /config.js       { add_header Cache-Control "no-cache"; }

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;
}
NGINX
ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/axel-team-form
if [ -z "$DOMAIN" ]; then rm -f /etc/nginx/sites-enabled/default; fi
nginx -t
systemctl enable --now nginx >/dev/null
systemctl reload nginx

say "5/6 Запускаю обработчик заявок"
cat > /etc/systemd/system/$SERVICE.service <<UNIT
[Unit]
Description=Axel team form leads
After=network.target

[Service]
WorkingDirectory=$APP_DIR/server
ExecStart=$(command -v node) server.js
Restart=always
User=www-data
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable $SERVICE >/dev/null
systemctl restart $SERVICE
sleep 1
systemctl is-active --quiet $SERVICE || { journalctl -u $SERVICE -n 20 --no-pager; die "обработчик заявок не запустился"; }

if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then
  ufw allow 'Nginx Full' >/dev/null || ufw allow 80/tcp >/dev/null
fi

if [ -n "$DOMAIN" ]; then
  say "Включаю HTTPS для $DOMAIN"
  apt-get install -y -qq certbot python3-certbot-nginx >/dev/null
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email --redirect \
    || echo "HTTPS не включился: проверьте, что домен $DOMAIN указывает на этот сервер, и запустите скрипт ещё раз."
fi

say "6/6 Проверка"
CODE="$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1/ -H "Host: ${DOMAIN:-localhost}")"
LEAD="$(curl -s -X POST http://127.0.0.1:3005/api/lead -H 'Content-Type: application/json' -d '{"website":"bot-check"}')"
echo "Страница: HTTP $CODE (нужно 200)"
echo "Обработчик заявок: $LEAD (нужно {\"ok\":true})"

printf '\n\033[1;32mГотово! Сайт: %s\033[0m\n' "$SITE_URL"
echo "Ссылка для клуба: $SITE_URL/?club=Название%20клуба"
echo "Заявки сохраняются в $APP_DIR/server/leads.log"
grep -q '^TELEGRAM_BOT_TOKEN=.\+' "$APP_DIR/server/.env" || echo "Telegram и почта пока не настроены: заполните $APP_DIR/server/.env и выполните: systemctl restart $SERVICE"
