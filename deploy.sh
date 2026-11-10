#!/usr/bin/env bash
# Выкатка новой версии сайта на сервер — запускать на своём компьютере (Mac/Linux):
#   cd ~/proj/axel-team-form && ./deploy.sh
# Настройки бота (server/.env) и журнал заявок на сервере не трогаются.
set -euo pipefail

REMOTE_DIR=/root/axel-team-form
cd "$(dirname "$0")"

# Адрес сервера хранится локально в .deploy.env (в git не попадает): DEPLOY_SERVER=root@IP
[ -f .deploy.env ] && . ./.deploy.env
SERVER="${DEPLOY_SERVER:-}"
[ -n "$SERVER" ] || { echo "Укажите сервер: echo 'DEPLOY_SERVER=root@IP_СЕРВЕРА' > .deploy.env"; exit 1; }

say() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }

# Быстрая проверка, что файлы не сломаны
say "Проверяю файлы"
[ -f public/config.js ] || { echo "Нет public/config.js — скопируйте public/config.example.js и впишите контакты"; exit 1; }
python3 -c "import json; json.load(open('public/data/works.json'))" \
  || { echo "Ошибка в public/data/works.json — проверьте запятые и кавычки"; exit 1; }
if command -v node >/dev/null; then node --check public/config.js && node --check public/assets/js/app.js; fi

say "Загружаю файлы на $SERVER"
rsync -az --delete \
  --exclude '.DS_Store' --exclude 'server/.env' --exclude 'server/leads.log' --exclude 'server/node_modules' \
  ./ "$SERVER:$REMOTE_DIR/"

say "Устанавливаю на сервере"
ssh "$SERVER" "cd $REMOTE_DIR && bash install.sh"
