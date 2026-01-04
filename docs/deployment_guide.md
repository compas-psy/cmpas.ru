# Руководство по Деплою (UFO.HOSTING VPS + SSL)

Поздравляю с покупкой VPS! Это отличный выбор (Ubuntu 24.04).
Вот ваши данные:
*   **IP**: `45.144.30.190`
*   **Login**: `root`
*   **Password**: (у вас есть)

---

## Часть 1: Переключение DNS (на Reg.ru)

На вашем скриншоте (ISPmanager -> Управление записями домена) нужно изменить **две записи**:

1.  Найдите запись с именем `cmpas.ru.` (тип **A**).
    *   Нажмите "Изменить".
    *   Замените IP `31.31.196.104` на **`45.144.30.190`**.
2.  Найдите запись с именем `www.cmpas.ru.` (тип **A**).
    *   Замените IP `31.31.196.104` на **`45.144.30.190`**.
3.  **УДАЛИТЕ** (если есть) записи типа **AAAA** для этих доменов (иногда они мешают выпуску SSL, если сервер не настроен на IPv6).

*Старый SSL от Reg.ru работать перестанет, но мы выпустим новый, бесплатный и автоматический, прямо на сервере (см. Часть 4).*

---

## Часть 2: Настройка Сервера (Терминал)

Откройте терминал (PowerShell) на компьютере:
`ssh root@45.144.30.190`
(Пароль при вводе не виден).

**Выполняйте команды по блокам:**

### 1. Установка программ
```bash
# Обновляем систему
apt update && apt upgrade -y

# Ставим Node.js, Git, Nginx (веб-сервер) и Certbot (для SSL)
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs git nginx certbot python3-certbot-nginx

# Ставим PM2
npm install -g pm2
```

### 2. Настройка доступа GitHub
Чтобы GitHub мог загружать код, нам нужен ключ.
*   **На вашем компьютере**: Найдите файл ключа `gh_deploy_key.pub` (который мы делали) и скопируйте его содержимое.
*   **На сервере**:
    ```bash
    mkdir -p ~/.ssh
    nano ~/.ssh/authorized_keys
    ```
    *   Вставьте ключ.
    *   `Ctrl+O` (Save), `Enter`, `Ctrl+X` (Exit).

### 3. Секреты (Токены бота)
```bash
mkdir -p /var/www/cmpas.ru
nano /var/www/cmpas.ru/.env.local
```
Вставьте:
```env
TELEGRAM_BOT_TOKEN=ваш_токен
TELEGRAM_CHAT_ID=ваш_чат_ид
```
Сохраните и выйдите.

---

## Часть 3: Настройка GitHub

Зайдите в репозиторий на GitHub -> **Settings** -> **Secrets and variables** -> **Actions**.
Обновите секреты:
1.  **SERVER_HOST**: `45.144.30.190`
2.  **SERVER_USER**: `root`
3.  **SSH_PRIVATE_KEY**: Скопируйте **приватный** ключ с компьютера (содержимое файла `gh_deploy_key`).

**Сделайте первый деплой!**
Измените любой файл в проекте (например, пробел в README) и сделайте `git push`.
Подождите, пока GitHub Actions напишет "Success".

---

## Часть 4: Настройка Nginx и SSL (HTTPS)

После того как GitHub успешно загрузил код (Часть 3), настроим красивый адрес `https://cmpas.ru`.

**Выполняйте на сервере:**

### 1. Настройка Nginx
Создадим конфиг сайта:
```bash
nano /etc/nginx/sites-available/cmpas.ru
```

Вставьте этот текст (здесь мы говорим Nginx пересылать запросы на наш Next.js порт 3000):
```nginx
server {
    listen 80;
    server_name cmpas.ru www.cmpas.ru;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```
Сохраните (`Ctrl+O`, `Enter`, `Ctrl+X`).

Включим этот сайт:
```bash
ln -s /etc/nginx/sites-available/cmpas.ru /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default
nginx -t
# Если написало "syntax is ok", перезагружаем:
systemctl restart nginx
```

### 2. Выпуск SSL сертификата (Зеленый замочек)
Теперь магия. Запускаем Certbot:
```bash
certbot --nginx -d cmpas.ru -d www.cmpas.ru
```
*   Вас попросят email (для уведомлений) — введите.
*   Согласитесь с правилами (`Y`).
*   Certbot сам проверит домен (DNS должны уже работать!) и настроит https.

**Всё! Ваш сайт доступен по адресу https://cmpas.ru**
