# Запуск сайта на сервере

## Быстрый способ: скрипт install.sh

Скрипт сам ставит nginx и Node.js, копирует сайт в `/var/www/axel-team-form`, запускает обработчик заявок и проверяет, что всё работает. Повторный запуск безопасен: так же обновляется сайт, а настройки в `server/.env` и журнал заявок сохраняются.

```bash
# на Mac, в Терминале, из папки с архивом
scp axel-team-form.zip root@IP_СЕРВЕРА:/root/
ssh root@IP_СЕРВЕРА

# на сервере
apt-get update && apt-get install -y unzip
cd /root && unzip -o axel-team-form.zip && cd axel-team-form
bash install.sh                      # сайт будет на http://IP_СЕРВЕРА
# bash install.sh forma.example.ru   # когда появится домен: сайт + HTTPS
```

## Обновление сайта: deploy.sh

Держите проект распакованной папкой на своём компьютере (например, `~/proj/axel-team-form`), правьте файлы там и выкатывайте одной командой:

```bash
cd ~/proj/axel-team-form && ./deploy.sh
```

Скрипт проверит `works.json` и скрипты на ошибки, загрузит изменения на сервер (только изменившиеся файлы) и запустит `install.sh`. Настройки бота (`server/.env`) и журнал заявок на сервере не трогаются. Чтобы не вводить пароль каждый раз, один раз настройте вход по ключу: `ssh-keygen -t ed25519` (если ключа ещё нет), затем `ssh-copy-id root@IP_СЕРВЕРА`.

Адрес сервера скрипт берёт из файла `.deploy.env` рядом с ним (в git его нет). В новой копии проекта создайте его один раз: `echo 'DEPLOY_SERVER=root@IP_СЕРВЕРА' > .deploy.env`, и скопируйте `public/config.example.js` в `public/config.js`.

Ниже — то же самое вручную, по шагам.

---

Инструкция для сервера на **Ubuntu 22.04 / 24.04** с доступом по SSH. Вместо `example.ru` везде подставьте свой домен.

Что получится:
- **nginx** отдаёт сайт (папка `public`) и включает HTTPS;
- **обработчик заявок** (папка `server`, Node.js) принимает форму и отправляет заявку в Telegram и на почту. Запросы к нему идут через nginx по адресу `/api/lead`.

---

## 1. Направьте домен на сервер

В панели, где куплен домен (REG.RU, Timeweb, Beget и т. п.), создайте две **A-записи**:

| Имя | Тип | Значение |
|---|---|---|
| `@` | A | IP вашего сервера |
| `www` | A | IP вашего сервера |

Если сайт будет на поддомене (например, `forma.axelnn.ru`), создайте одну A-запись с именем `forma`.

Изменения DNS применяются от нескольких минут до суток. Проверить можно командой `ping example.ru`: она должна показать IP вашего сервера.

## 2. Подключитесь к серверу и установите nginx и Node.js

```bash
ssh root@IP_СЕРВЕРА

apt update && apt -y upgrade
apt -y install nginx certbot python3-certbot-nginx curl unzip

# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt -y install nodejs
node -v   # должно быть v20.x
```

## 3. Загрузите файлы

На своём компьютере, в папке, где лежит архив:

```bash
scp axel-team-form.zip root@IP_СЕРВЕРА:/tmp/
```

На сервере:

```bash
mkdir -p /var/www/axel-team-form
cd /var/www/axel-team-form
unzip -o /tmp/axel-team-form.zip
mv axel-team-form/* . && rmdir axel-team-form
chown -R www-data:www-data /var/www/axel-team-form
```

После распаковки в `/var/www/axel-team-form` будут папки `public` (сайт) и `server` (обработчик заявок).

> Удобнее без командной строки: загрузите файлы через FileZilla или WinSCP по протоколу SFTP с теми же логином и паролем.

## 4. Настройте nginx

Создайте файл настроек сайта:

```bash
nano /etc/nginx/sites-available/axel-team-form
```

Вставьте (замените `example.ru`):

```nginx
server {
    listen 80;
    server_name example.ru www.example.ru;

    root /var/www/axel-team-form/public;
    index index.html;

    # заявки -> обработчик на Node.js
    location = /api/lead {
        proxy_pass http://127.0.0.1:3005;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        client_max_body_size 32k;
    }

    # картинки и стили кэшируются браузером
    location /assets/ {
        expires 30d;
        add_header Cache-Control "public";
    }

    # список работ и настройки не кэшируем, чтобы правки были видны сразу
    location = /data/works.json { add_header Cache-Control "no-cache"; }
    location = /config.js       { add_header Cache-Control "no-cache"; }

    location / {
        try_files $uri $uri/ /index.html;
    }

    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;
}
```

Включите сайт и проверьте настройки:

```bash
ln -s /etc/nginx/sites-available/axel-team-form /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

Откройте `http://example.ru`: сайт уже должен открываться.

## 5. Включите HTTPS (бесплатный сертификат Let's Encrypt)

```bash
certbot --nginx -d example.ru -d www.example.ru
```

Укажите почту, согласитесь с условиями и на вопрос о редиректе выберите вариант «перенаправлять на HTTPS». Сертификат будет продлеваться автоматически.

## 6. Создайте Telegram-бота для заявок

1. В Telegram откройте **@BotFather**, отправьте `/newbot`, задайте имя и username. Сохраните **токен** вида `123456:ABC...`.
2. Решите, куда будут приходить заявки:
   - **Лично менеджеру:** менеджер пишет боту любое сообщение.
   - **В рабочую группу:** добавьте бота в группу и напишите в ней любое сообщение.
3. Узнайте ID чата: откройте в браузере `https://api.telegram.org/bot<ТОКЕН>/getUpdates` и найдите `"chat":{"id": ...}`. У групп ID отрицательный, например `-1001234567890`.

## 7. Настройте и запустите обработчик заявок

```bash
cd /var/www/axel-team-form/server
npm install --omit=dev
cp .env.example .env
nano .env
```

Заполните `.env`:

```
TELEGRAM_BOT_TOKEN=123456:ABC...
TELEGRAM_CHAT_ID=-1001234567890
MAIL_TO=zakaz@example.ru
SMTP_HOST=smtp.yandex.ru
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=robot@example.ru
SMTP_PASS=пароль_приложения
MAIL_FROM=robot@example.ru
```

> Для Яндекс.Почты нужен **пароль приложения**, а не обычный пароль: Яндекс ID → Безопасность → Пароли приложений → Почта. Для Mail.ru: `smtp.mail.ru`, порт 465, тоже пароль приложения.

Запретите посторонним читать файл с паролями:

```bash
chmod 600 .env && chown www-data:www-data .env
```

Сделайте обработчик службой, чтобы он сам запускался после перезагрузки:

```bash
nano /etc/systemd/system/axel-leads.service
```

```ini
[Unit]
Description=Axel team form leads
After=network.target

[Service]
WorkingDirectory=/var/www/axel-team-form/server
ExecStart=/usr/bin/node server.js
Restart=always
User=www-data
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload
systemctl enable --now axel-leads
systemctl status axel-leads     # должно быть active (running) и «Telegram: вкл, почта: вкл»
```

## 8. Проверка

1. Откройте сайт с телефона и с компьютера.
2. Отметьте пару работ и отправьте тестовую заявку: она должна прийти в Telegram и на почту.
3. Отправьте ссылку себе в Telegram или WhatsApp и проверьте, что появилось превью с картинкой. Если превью старое, в Telegram его можно обновить через @WebpageBot.

Каждая заявка дополнительно сохраняется в файл `server/leads.log`, даже если Telegram и почта недоступны.

Логи обработчика: `journalctl -u axel-leads -n 50`.

## 9. Обновление сайта

- **Фото и подписи работ:** загрузите фото в `public/assets/works/` и поправьте `public/data/works.json` (см. README.md). Перезапуск не нужен.
- **Телефон, мессенджеры, срок, Метрика:** поправьте `public/config.js`. Перезапуск не нужен.
- **Изменили `server/.env`:** выполните `systemctl restart axel-leads`.
