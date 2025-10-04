# Деплой на Reg.ru

## Требования

- Python 3.10+
- PostgreSQL 13+
- Nginx (для reverse proxy)
- SSL сертификат

---

## Подготовка сервера

### 1. Обновление системы

```bash
sudo apt update
sudo apt upgrade -y
```

### 2. Установка Python 3.10+

```bash
sudo apt install python3.10 python3.10-venv python3-pip -y
```

### 3. Установка PostgreSQL

```bash
sudo apt install postgresql postgresql-contrib -y
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### 4. Создание базы данных

```bash
sudo -u postgres psql

CREATE DATABASE cmpas;
CREATE USER cmpas_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE cmpas TO cmpas_user;
\q
```

---

## Деплой приложения

### 1. Клонирование репозитория

```bash
cd /var/www
sudo git clone https://github.com/compas-psy/cmpas.ru.git
cd cmpas.ru
```

### 2. Создание виртуального окружения

```bash
python3.10 -m venv venv
source venv/bin/activate
```

### 3. Установка зависимостей

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

### 4. Настройка .env

```bash
cp .env.example .env
nano .env
```

Обязательно измените:
- `DEBUG=False`
- `ENVIRONMENT=production`
- `DATABASE_URL=postgresql+asyncpg://cmpas_user:your_secure_password@localhost/cmpas`
- `SECRET_KEY=<новый секретный ключ>`
- `ALLOWED_ORIGINS=https://cmpas.ru`

### 5. Миграции базы данных

```bash
alembic upgrade head
```

---

## Настройка systemd

### 1. Создание service файла

```bash
sudo nano /etc/systemd/system/cmpas.service
```

```ini
[Unit]
Description=cmpas.ru FastAPI Application
After=network.target

[Service]
Type=notify
User=www-data
Group=www-data
WorkingDirectory=/var/www/cmpas.ru
Environment="PATH=/var/www/cmpas.ru/venv/bin"
ExecStart=/var/www/cmpas.ru/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
Restart=always

[Install]
WantedBy=multi-user.target
```

### 2. Запуск сервиса

```bash
sudo systemctl daemon-reload
sudo systemctl start cmpas
sudo systemctl enable cmpas
sudo systemctl status cmpas
```

---

## Настройка Nginx

### 1. Создание конфигурации

```bash
sudo nano /etc/nginx/sites-available/cmpas.ru
```

```nginx
server {
    listen 80;
    server_name cmpas.ru www.cmpas.ru;
    
    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name cmpas.ru www.cmpas.ru;
    
    # SSL certificates
    ssl_certificate /etc/letsencrypt/live/cmpas.ru/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/cmpas.ru/privkey.pem;
    
    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # Static files
    location /static {
        alias /var/www/cmpas.ru/static;
        expires 30d;
    }
    
    # Proxy to FastAPI
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 2. Активация конфигурации

```bash
sudo ln -s /etc/nginx/sites-available/cmpas.ru /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## SSL сертификат (Let's Encrypt)

### 1. Установка Certbot

```bash
sudo apt install certbot python3-certbot-nginx -y
```

### 2. Получение сертификата

```bash
sudo certbot --nginx -d cmpas.ru -d www.cmpas.ru
```

### 3. Автоматическое обновление

```bash
sudo systemctl status certbot.timer
```

---

## Мониторинг и логи

### Просмотр логов приложения

```bash
sudo journalctl -u cmpas -f
```

### Просмотр логов Nginx

```bash
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Проверка статуса

```bash
sudo systemctl status cmpas
sudo systemctl status nginx
sudo systemctl status postgresql
```

---

## Обновление приложения

```bash
cd /var/www/cmpas.ru
git pull origin main
source venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
sudo systemctl restart cmpas
```

---

## Бэкапы

### База данных

```bash
# Создание бэкапа
pg_dump -U cmpas_user cmpas > backup_$(date +%Y%m%d).sql

# Восстановление
psql -U cmpas_user cmpas < backup_20251004.sql
```

### Автоматические бэкапы (cron)

```bash
sudo crontab -e
```

```cron
# Ежедневный бэкап в 3:00
0 3 * * * pg_dump -U cmpas_user cmpas > /backups/cmpas_$(date +\%Y\%m\%d).sql
```

---

## Troubleshooting

### Приложение не запускается

```bash
# Проверка логов
sudo journalctl -u cmpas -n 50

# Проверка прав доступа
ls -la /var/www/cmpas.ru

# Проверка .env файла
cat /var/www/cmpas.ru/.env
```

### Ошибки базы данных

```bash
# Проверка подключения
psql -U cmpas_user -d cmpas -h localhost

# Проверка миграций
cd /var/www/cmpas.ru
source venv/bin/activate
alembic current
```

### Проблемы с Nginx

```bash
# Проверка конфигурации
sudo nginx -t

# Перезапуск
sudo systemctl restart nginx
```
