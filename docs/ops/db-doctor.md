# Состояние базы на боевом сервере

Снято прогоном 32658428158. Файл перезаписывается каждой диагностикой.

```
Warning: Permanently added '45.144.30.190' (ED25519) to the list of known hosts.
### Журнал миграций существует?
t
### Записей в журнале
37
### Незавершённых миграций
0
### Последние 20 записей журнала
20260823100000_visitor_analytics_account_id  finished=2026-08-23 15:07:36.727566+00
20260823094500_app_response_time  finished=2026-08-23 15:07:36.710728+00
20260823093000_analytics_event_id  finished=2026-08-23 15:07:36.684168+00
20260823090000_reminder_outbox  finished=2026-08-23 15:07:36.666461+00
20260820120000_infra_pulse_panel_fields  finished=2026-08-21 05:19:10.612063+00
20260818100000_infra_pulse  finished=2026-08-18 10:13:47.754507+00
20260818090000_ingest_anonymous  finished=2026-08-18 10:03:09.310097+00
20260817140000_booking_a_b  finished=2026-08-18 10:03:09.281124+00
20260817120000_analytics_f0_f1  finished=2026-08-17 13:33:19.477871+00
20260710120000_legal_acceptance_schema_sync  finished=2026-08-17 13:10:59.984689+00
20260709_legal_acceptance_audit_fields  finished=2026-08-17 13:10:55.588199+00
20260709_feature_interest  finished=2026-08-17 13:10:51.733131+00
20260705_practice_notifications  finished=2026-08-17 13:10:47.675357+00
20260705183000_add_diary_session_payment_status  finished=2026-08-17 13:10:44.177284+00
20260610_scheduled_messages_fcm  finished=2026-08-17 13:10:40.256673+00
20260531_specialist_client_documents  finished=2026-08-17 13:10:36.777919+00
20260531_configurable_documents_payments  finished=2026-08-17 13:10:33.116919+00
20260426_add_system_config  finished=2026-08-17 13:10:29.427704+00
20260419_add_schedule_rules  finished=2026-08-17 13:10:25.622061+00
20260411_schedule_v2  finished=2026-08-17 13:10:21.886053+00
### Колонки, которые добавляли откаченные PR (должны отсутствовать)
PsychologistSettings.privateRemindersEnabled
PsychologistSettings.timeSuggestEnabled
User.analyticsConsentAt
Payment.terminal
### Таблицы, которые добавляли откаченные PR (должны отсутствовать)
Subscription
WaitlistEntry
events
events_rejected
### Всего таблиц в базе
52
### Строк в главных таблицах
User=15
DiaryClient=20
DiarySession=41
### Место на диске
Filesystem      Size  Used Avail Use% Mounted on
/dev/vda2        89G   23G   62G  27% /
/dev/vda2        89G   23G   62G  27% /
### Память
               total        used        free      shared  buff/cache   available
Mem:            7941        2030         959          55        5313        5911
Swap:            511           1         510
### Что занимает docker
TYPE            TOTAL     ACTIVE    SIZE      RECLAIMABLE
Images          7         6         11.08GB   10.58GB (95%)
Containers      7         6         28.59MB   12.29kB (0%)
Local Volumes   155       7         265.8MB   4.07MB (1%)
Build Cache     103       19        7.657GB   4.193GB
### Убитые по нехватке памяти за сутки
0
0
не удалось прочитать
### Хвост журнала последней выкладки (/tmp/cmpas-deploy.log)
#17 [infra-pulse infra-pulse-collector 2/2] RUN apt-get update -y && apt-get install -y --no-install-recommends postgresql-client && rm -rf /var/lib/apt/lists/*
#17 ...

#38 [app] resolving provenance for metadata file
#38 DONE 0.0s

#17 [infra-pulse infra-pulse-collector 2/2] RUN apt-get update -y && apt-get install -y --no-install-recommends postgresql-client && rm -rf /var/lib/apt/lists/*
#17 56.92 Get:2 http://deb.debian.org/debian bookworm/main amd64 libgdbm6 amd64 1.23-3 [72.2 kB]
#17 57.66 Get:3 http://deb.debian.org/debian bookworm/main amd64 libgdbm-compat4 amd64 1.23-3 [48.2 kB]
#17 58.49 Get:4 http://deb.debian.org/debian bookworm/main amd64 libperl5.36 amd64 5.36.0-7+deb12u3 [4196 kB]
#17 132.4 Get:5 http://deb.debian.org/debian bookworm/main amd64 perl amd64 5.36.0-7+deb12u3 [239 kB]
#17 137.0 Get:6 http://deb.debian.org/debian bookworm/main amd64 netbase all 6.4 [12.8 kB]
#17 137.2 Get:7 http://deb.debian.org/debian bookworm/main amd64 readline-common all 8.2-1.3 [69.0 kB]
#17 138.1 Get:8 http://deb.debian.org/debian bookworm/main amd64 sensible-utils all 0.0.17+nmu1 [19.0 kB]
#17 138.2 Get:9 http://deb.debian.org/debian bookworm/main amd64 libkrb5support0 amd64 1.20.1-2+deb12u5 [33.2 kB]
#17 138.4 Get:10 http://deb.debian.org/debian bookworm/main amd64 libk5crypto3 amd64 1.20.1-2+deb12u5 [79.7 kB]
#17 139.4 Get:11 http://deb.debian.org/debian bookworm/main amd64 libkeyutils1 amd64 1.6.3-2 [8808 B]
#17 139.6 Get:12 http://deb.debian.org/debian bookworm/main amd64 libkrb5-3 amd64 1.20.1-2+deb12u5 [332 kB]
#17 145.8 Get:13 http://deb.debian.org/debian bookworm/main amd64 libgssapi-krb5-2 amd64 1.20.1-2+deb12u5 [135 kB]
#17 149.0 Get:14 http://deb.debian.org/debian bookworm/main amd64 libsasl2-modules-db amd64 2.1.28+dfsg-10 [20.3 kB]
#17 149.5 Get:15 http://deb.debian.org/debian bookworm/main amd64 libsasl2-2 amd64 2.1.28+dfsg-10 [59.7 kB]
#17 150.3 Get:16 http://deb.debian.org/debian bookworm/main amd64 libldap-2.5-0 amd64 2.5.13+dfsg-5 [183 kB]
#17 152.8 Get:17 http://deb.debian.org/debian-security bookworm-security/main amd64 libpq5 amd64 15.19-0+deb12u1 [203 kB]
#17 157.0 Get:18 http://deb.debian.org/debian bookworm/main amd64 libreadline8 amd64 8.2-1.3 [166 kB]
#17 159.6 Get:19 http://deb.debian.org/debian bookworm/main amd64 postgresql-client-common all 248+deb12u1 [35.2 kB]
#17 160.1 Get:20 http://deb.debian.org/debian-security bookworm-security/main amd64 postgresql-client-15 amd64 15.19-0+deb12u1 [1759 kB]
#17 196.2 Get:21 http://deb.debian.org/debian bookworm/main amd64 postgresql-client all 15+248+deb12u1 [10.2 kB]
#17 196.9 debconf: delaying package configuration, since apt-utils is not installed
#17 197.0 Fetched 10.5 MB in 3min 11s (55.0 kB/s)
#17 197.1 Selecting previously unselected package perl-modules-5.36.
#17 197.1 (Reading database ... (Reading database ... 5%(Reading database ... 10%(Reading database ... 15%(Reading database ... 20%(Reading database ... 25%(Reading database ... 30%(Reading database ... 35%(Reading database ... 40%(Reading database ... 45%(Reading database ... 50%(Reading database ... 55%(Reading database ... 60%(Reading database ... 65%(Reading database ... 70%(Reading database ... 75%(Reading database ... 80%(Reading database ... 85%(Reading database ... 90%(Reading database ... 95%(Reading database ... 100%(Reading database ... 6593 files and directories currently installed.)
#17 197.1 Preparing to unpack .../00-perl-modules-5.36_5.36.0-7+deb12u3_all.deb ...
#17 197.1 Unpacking perl-modules-5.36 (5.36.0-7+deb12u3) ...
#17 198.0 Selecting previously unselected package libgdbm6:amd64.
#17 198.0 Preparing to unpack .../01-libgdbm6_1.23-3_amd64.deb ...
#17 198.0 Unpacking libgdbm6:amd64 (1.23-3) ...
#17 198.1 Selecting previously unselected package libgdbm-compat4:amd64.
#17 198.1 Preparing to unpack .../02-libgdbm-compat4_1.23-3_amd64.deb ...
#17 198.1 Unpacking libgdbm-compat4:amd64 (1.23-3) ...
#17 198.1 Selecting previously unselected package libperl5.36:amd64.
#17 198.1 Preparing to unpack .../03-libperl5.36_5.36.0-7+deb12u3_amd64.deb ...
#17 198.1 Unpacking libperl5.36:amd64 (5.36.0-7+deb12u3) ...
#17 198.9 Selecting previously unselected package perl.
#17 198.9 Preparing to unpack .../04-perl_5.36.0-7+deb12u3_amd64.deb ...
#17 198.9 Unpacking perl (5.36.0-7+deb12u3) ...
#17 199.0 Selecting previously unselected package netbase.
#17 199.0 Preparing to unpack .../05-netbase_6.4_all.deb ...
#17 199.0 Unpacking netbase (6.4) ...
#17 199.1 Selecting previously unselected package readline-common.
#17 199.1 Preparing to unpack .../06-readline-common_8.2-1.3_all.deb ...
#17 199.1 Unpacking readline-common (8.2-1.3) ...
#17 199.2 Selecting previously unselected package sensible-utils.
#17 199.2 Preparing to unpack .../07-sensible-utils_0.0.17+nmu1_all.deb ...
#17 199.2 Unpacking sensible-utils (0.0.17+nmu1) ...
#17 199.2 Selecting previously unselected package libkrb5support0:amd64.
#17 199.3 Preparing to unpack .../08-libkrb5support0_1.20.1-2+deb12u5_amd64.deb ...
#17 199.3 Unpacking libkrb5support0:amd64 (1.20.1-2+deb12u5) ...
#17 199.3 Selecting previously unselected package libk5crypto3:amd64.
#17 199.3 Preparing to unpack .../09-libk5crypto3_1.20.1-2+deb12u5_amd64.deb ...
#17 199.3 Unpacking libk5crypto3:amd64 (1.20.1-2+deb12u5) ...
#17 199.4 Selecting previously unselected package libkeyutils1:amd64.
#17 199.4 Preparing to unpack .../10-libkeyutils1_1.6.3-2_amd64.deb ...
#17 199.4 Unpacking libkeyutils1:amd64 (1.6.3-2) ...
#17 199.5 Selecting previously unselected package libkrb5-3:amd64.
#17 199.5 Preparing to unpack .../11-libkrb5-3_1.20.1-2+deb12u5_amd64.deb ...
#17 199.5 Unpacking libkrb5-3:amd64 (1.20.1-2+deb12u5) ...
#17 199.6 Selecting previously unselected package libgssapi-krb5-2:amd64.
#17 199.6 Preparing to unpack .../12-libgssapi-krb5-2_1.20.1-2+deb12u5_amd64.deb ...
#17 199.7 Unpacking libgssapi-krb5-2:amd64 (1.20.1-2+deb12u5) ...
#17 199.7 Selecting previously unselected package libsasl2-modules-db:amd64.
#17 199.7 Preparing to unpack .../13-libsasl2-modules-db_2.1.28+dfsg-10_amd64.deb ...
#17 199.7 Unpacking libsasl2-modules-db:amd64 (2.1.28+dfsg-10) ...
#17 199.8 Selecting previously unselected package libsasl2-2:amd64.
#17 199.8 Preparing to unpack .../14-libsasl2-2_2.1.28+dfsg-10_amd64.deb ...
#17 199.8 Unpacking libsasl2-2:amd64 (2.1.28+dfsg-10) ...
#17 199.9 Selecting previously unselected package libldap-2.5-0:amd64.
#17 199.9 Preparing to unpack .../15-libldap-2.5-0_2.5.13+dfsg-5_amd64.deb ...
#17 199.9 Unpacking libldap-2.5-0:amd64 (2.5.13+dfsg-5) ...
#17 200.0 Selecting previously unselected package libpq5:amd64.
#17 200.0 Preparing to unpack .../16-libpq5_15.19-0+deb12u1_amd64.deb ...
#17 200.0 Unpacking libpq5:amd64 (15.19-0+deb12u1) ...
#17 200.1 Selecting previously unselected package libreadline8:amd64.
#17 200.1 Preparing to unpack .../17-libreadline8_8.2-1.3_amd64.deb ...
#17 200.1 Unpacking libreadline8:amd64 (8.2-1.3) ...
#17 200.2 Selecting previously unselected package postgresql-client-common.
#17 200.2 Preparing to unpack .../18-postgresql-client-common_248+deb12u1_all.deb ...
#17 200.2 Unpacking postgresql-client-common (248+deb12u1) ...
#17 200.3 Selecting previously unselected package postgresql-client-15.
#17 200.3 Preparing to unpack .../19-postgresql-client-15_15.19-0+deb12u1_amd64.deb ...
#17 200.3 Unpacking postgresql-client-15 (15.19-0+deb12u1) ...
#17 200.8 Selecting previously unselected package postgresql-client.
#17 200.8 Preparing to unpack .../20-postgresql-client_15+248+deb12u1_all.deb ...
#17 200.8 Unpacking postgresql-client (15+248+deb12u1) ...
#17 200.9 Setting up libkeyutils1:amd64 (1.6.3-2) ...
#17 200.9 Setting up libkrb5support0:amd64 (1.20.1-2+deb12u5) ...
#17 200.9 Setting up libsasl2-modules-db:amd64 (2.1.28+dfsg-10) ...
#17 200.9 Setting up perl-modules-5.36 (5.36.0-7+deb12u3) ...
#17 200.9 Setting up libk5crypto3:amd64 (1.20.1-2+deb12u5) ...
#17 200.9 Setting up libsasl2-2:amd64 (2.1.28+dfsg-10) ...
#17 201.0 Setting up sensible-utils (0.0.17+nmu1) ...
#17 201.0 Setting up netbase (6.4) ...
#17 201.0 Setting up libkrb5-3:amd64 (1.20.1-2+deb12u5) ...
#17 201.0 Setting up readline-common (8.2-1.3) ...
#17 201.0 Setting up libgdbm6:amd64 (1.23-3) ...
#17 201.0 Setting up libreadline8:amd64 (8.2-1.3) ...
#17 201.1 Setting up libldap-2.5-0:amd64 (2.5.13+dfsg-5) ...
#17 201.1 Setting up libgssapi-krb5-2:amd64 (1.20.1-2+deb12u5) ...
#17 201.1 Setting up libgdbm-compat4:amd64 (1.23-3) ...
#17 201.1 Setting up libperl5.36:amd64 (5.36.0-7+deb12u3) ...
#17 201.1 Setting up libpq5:amd64 (15.19-0+deb12u1) ...
#17 201.1 Setting up perl (5.36.0-7+deb12u3) ...
#17 201.2 Setting up postgresql-client-common (248+deb12u1) ...
#17 201.2 Setting up postgresql-client-15 (15.19-0+deb12u1) ...
#17 203.0 update-alternatives: using /usr/share/postgresql/15/man/man1/psql.1.gz to provide /usr/share/man/man1/psql.1.gz (psql.1.gz) in auto mode
#17 203.1 Setting up postgresql-client (15+248+deb12u1) ...
#17 203.1 Processing triggers for libc-bin (2.36-9+deb12u13) ...
#17 DONE 203.5s

#39 [infra-pulse] exporting to image
#39 exporting layers
### Состояние контейнеров
zapiski-api | Up 14 minutes (healthy)
cmpas-app | Up 3 hours
cmpas-infra-pulse | Up 3 hours
zapiski-postgres | Up 3 days (healthy)
cmpas-mailer | Up 3 days (healthy)
cmpas-postgres | Up 3 days (healthy)
cmpas-singbox | Exited (1) 3 days ago
### Достижим ли Т-Банк с сервера
-- имя разрешается в:
178.130.128.34  securepay.tinkoff.ru
-- curl с хоста:
код 405, время 0.220874s
-- curl из контейнера приложения:
sh: 1: curl: not found
-- версия node на хосте:
v20.19.6
### Кто выдал сертификат Т-Банка
subject=CN = *.tinkoff.ru, C = RU, L = Moscow, ST = 77 \D0\B3.\D0\9C\D0\BE\D1\81\D0\BA\D0\B2\D0\B0, O = TBank, OGRN = 1027739642281, 1.2.643.100.4 = 7710140679
issuer=C = RU, O = The Ministry of Digital Development and Communications, CN = Russian Trusted Sub CA
-- есть ли в системе российский корневой центр:
russian_trusted_root_ca.crt
russian_trusted_sub_ca.crt
российского корня в доверенных нет
### Платежи: последние записи
cmpas_cml2q6tfe0001kioc5j6tpyxu_9d5aaff1e1925d6c | pending | 99000 | site | 2026-08-18 15:19:45.018
cmpas_cml2q6tfe0001kioc5j6tpyxu_8244a60cc6f1cbad | pending | 99000 | site | 2026-05-08 06:42:16.349
cmpas_cml2q6tfe0001kioc5j6tpyxu_9d0e50bfb33d4818 | pending | 99000 | site | 2026-04-26 17:56:56.241
cmpas_cml3mp4xd0006hgrnbw9v9jnl_3f86dcb647887e91 | pending | 99000 | site | 2026-04-13 09:47:32.003
cmpas_cml2q6tfe0001kioc5j6tpyxu_1c2fea9fbc778f8d | pending | 99000 | site | 2026-04-06 07:38:00.896
cmpas_cml2q6tfe0001kioc5j6tpyxu_f640f4f81b5009ea | pending | 99000 | site | 2026-04-05 18:50:14.401
всего платежей=9
### Заданы ли ключи терминалов в окружении сервера (значения не печатаем)
TINKOFF_TERMINAL_KEY: задан
TINKOFF_PASSWORD: задан
TINKOFF_APP_TERMINAL_KEY: НЕ задан
TINKOFF_APP_PASSWORD: НЕ задан
SMTP_USER: НЕ задан
SMTP_PASSWORD: НЕ задан
### Отвечает ли приложение внутри сервера
http://localhost:3000/ -> 200
http://localhost:3000/diary -> 307
http://localhost:3000/api/admin/health -> 403
### Отвечает ли сайт снаружи (с самого сервера, через полный путь)
https://cmpas.ru/ -> 200 за 0.157618s
https://cmpas.ru/diary -> 307 за 0.203340s
https://cmpas.ru/admin -> 307 за 0.395591s
### Сертификат cmpas.ru
notBefore=Jul  4 23:22:19 2026 GMT
notAfter=Oct  2 23:22:18 2026 GMT
subject=CN = cmpas.ru
issuer=C = US, O = Let's Encrypt, CN = YE1
### Кто слушает 80 и 443
LISTEN 0      4096                                       0.0.0.0:3000       0.0.0.0:*    users:(("docker-proxy",pid=2144813,fd=7))                                                                                                                                        
LISTEN 0      511                                        0.0.0.0:443        0.0.0.0:*    users:(("nginx",pid=2140643,fd=11),("nginx",pid=2140642,fd=11),("nginx",pid=2140641,fd=11),("nginx",pid=2140640,fd=11),("nginx",pid=901,fd=11))                                  
LISTEN 0      511                                        0.0.0.0:80         0.0.0.0:*    users:(("nginx",pid=2140643,fd=12),("nginx",pid=2140642,fd=12),("nginx",pid=2140641,fd=12),("nginx",pid=2140640,fd=12),("nginx",pid=901,fd=12))                                  
LISTEN 0      4096                                          [::]:3000          [::]:*    users:(("docker-proxy",pid=2144819,fd=7))                                                                                                                                        
LISTEN 0      511                                           [::]:443           [::]:*    users:(("nginx",pid=2140643,fd=13),("nginx",pid=2140642,fd=13),("nginx",pid=2140641,fd=13),("nginx",pid=2140640,fd=13),("nginx",pid=901,fd=13))                                  
LISTEN 0      511                                           [::]:80            [::]:*    users:(("nginx",pid=2140643,fd=14),("nginx",pid=2140642,fd=14),("nginx",pid=2140641,fd=14),("nginx",pid=2140640,fd=14),("nginx",pid=901,fd=14))                                  
### Журнал приложения, последние 60 строк
[startup] Verifying required production schema...
[schema] Все 47 таблиц и их колонки на месте.
[schema] Чтение User через клиент Prisma прошло.
[schema] Чтение DiaryClient через клиент Prisma прошло.
[schema] Чтение DiarySession через клиент Prisma прошло.
[schema] Prisma migration history has no unfinished entries.
[startup] Schema is ready. Starting Next.js...
▲ Next.js 16.1.1
- Local:         http://11fee9ef954a:3000
- Network:       http://11fee9ef954a:3000

✓ Starting...
✓ Ready in 326ms
[AUTH] AUTH_SECRET fingerprint: IKXOHxDD... (stable = sessions preserved)
[CRON] Инструментация: cron-задачи зарегистрированы
[AUTH] AUTH_SECRET fingerprint: IKXOHxDD... (stable = sessions preserved)
[TG Bot] API root: https://api.telegram.org
[MAX] Webhook registration on startup: {"success":true}
[AUTH] AUTH_SECRET fingerprint: IKXOHxDD... (stable = sessions preserved)
[CRON] Запуск рассылки уведомлений (каждые 15 минут)
The width(-1) and height(-1) of chart should be greater than 0,
       please check the style of container, or the props width(100%) and height(100%),
       or add a minWidth(0) or minHeight(undefined) or use aspect(undefined) to control the
       height and width.
[CRON] Запуск рассылки уведомлений (каждые 15 минут)
[CRON] Запуск рассылки уведомлений (каждые 15 минут)
[CRON] Запуск рассылки уведомлений (каждые 15 минут)
The width(-1) and height(-1) of chart should be greater than 0,
       please check the style of container, or the props width(100%) and height(100%),
       or add a minWidth(0) or minHeight(undefined) or use aspect(undefined) to control the
       height and width.
Error: Failed to find Server Action "x". This request might be from an older or newer deployment.
Read more: https://nextjs.org/docs/messages/failed-to-find-server-action
    at ignore-listed frames
[CRON] Запуск рассылки уведомлений (каждые 15 минут)
[CRON] Запуск рассылки уведомлений (каждые 15 минут)
Error: Failed to find Server Action "x". This request might be from an older or newer deployment.
Read more: https://nextjs.org/docs/messages/failed-to-find-server-action
    at ignore-listed frames
[CRON] Запуск рассылки уведомлений (каждые 15 минут)
[CRON] Запуск рассылки уведомлений (каждые 15 минут)
Error: Failed to find Server Action "x". This request might be from an older or newer deployment.
Read more: https://nextjs.org/docs/messages/failed-to-find-server-action
    at ignore-listed frames
The width(-1) and height(-1) of chart should be greater than 0,
       please check the style of container, or the props width(100%) and height(100%),
       or add a minWidth(0) or minHeight(undefined) or use aspect(undefined) to control the
       height and width.
[CRON] Запуск рассылки уведомлений (каждые 15 минут)
[CRON] Запуск рассылки уведомлений (каждые 15 минут)
[CRON] Запуск рассылки уведомлений (каждые 15 минут)
[CRON] Запуск рассылки уведомлений (каждые 15 минут)
[CRON] Запуск рассылки уведомлений (каждые 15 минут)
[CRON] Запуск рассылки уведомлений (каждые 15 минут)
### Журнал контейнера в цикле перезапуска
[31mFATAL[0m[0000] decode config at /etc/sing-box/config.json: outbounds[0]: unknown outbound type: mieru
[31mFATAL[0m[0000] decode config at /etc/sing-box/config.json: outbounds[0]: unknown outbound type: mieru
[31mFATAL[0m[0000] decode config at /etc/sing-box/config.json: outbounds[0]: unknown outbound type: mieru
[31mFATAL[0m[0000] decode config at /etc/sing-box/config.json: outbounds[0]: unknown outbound type: mieru
[31mFATAL[0m[0000] decode config at /etc/sing-box/config.json: outbounds[0]: unknown outbound type: mieru
[31mFATAL[0m[0000] decode config at /etc/sing-box/config.json: outbounds[0]: unknown outbound type: mieru
[31mFATAL[0m[0000] decode config at /etc/sing-box/config.json: outbounds[0]: unknown outbound type: mieru
[31mFATAL[0m[0000] decode config at /etc/sing-box/config.json: outbounds[0]: unknown outbound type: mieru
[31mFATAL[0m[0000] decode config at /etc/sing-box/config.json: outbounds[0]: unknown outbound type: mieru
[31mFATAL[0m[0000] decode config at /etc/sing-box/config.json: outbounds[0]: unknown outbound type: mieru
[31mFATAL[0m[0000] decode config at /etc/sing-box/config.json: outbounds[0]: unknown outbound type: mieru
[31mFATAL[0m[0000] decode config at /etc/sing-box/config.json: outbounds[0]: unknown outbound type: mieru
[31mFATAL[0m[0000] decode config at /etc/sing-box/config.json: outbounds[0]: unknown outbound type: mieru
[31mFATAL[0m[0000] decode config at /etc/sing-box/config.json: outbounds[0]: unknown outbound type: mieru
[31mFATAL[0m[0000] decode config at /etc/sing-box/config.json: outbounds[0]: unknown outbound type: mieru
[31mFATAL[0m[0000] decode config at /etc/sing-box/config.json: outbounds[0]: unknown outbound type: mieru
[31mFATAL[0m[0000] decode config at /etc/sing-box/config.json: outbounds[0]: unknown outbound type: mieru
[31mFATAL[0m[0000] decode config at /etc/sing-box/config.json: outbounds[0]: unknown outbound type: mieru
[31mFATAL[0m[0000] decode config at /etc/sing-box/config.json: outbounds[0]: unknown outbound type: mieru
[31mFATAL[0m[0000] decode config at /etc/sing-box/config.json: outbounds[0]: unknown outbound type: mieru
[31mFATAL[0m[0000] decode config at /etc/sing-box/config.json: outbounds[0]: unknown outbound type: mieru
[31mFATAL[0m[0000] decode config at /etc/sing-box/config.json: outbounds[0]: unknown outbound type: mieru
[31mFATAL[0m[0000] decode config at /etc/sing-box/config.json: outbounds[0]: unknown outbound type: mieru
[31mFATAL[0m[0000] decode config at /etc/sing-box/config.json: outbounds[0]: unknown outbound type: mieru
[31mFATAL[0m[0000] decode config at /etc/sing-box/config.json: outbounds[0]: unknown outbound type: mieru
[31mFATAL[0m[0000] decode config at /etc/sing-box/config.json: outbounds[0]: unknown outbound type: mieru
[31mFATAL[0m[0000] decode config at /etc/sing-box/config.json: outbounds[0]: unknown outbound type: mieru
[31mFATAL[0m[0000] decode config at /etc/sing-box/config.json: outbounds[0]: unknown outbound type: mieru
[31mFATAL[0m[0000] decode config at /etc/sing-box/config.json: outbounds[0]: unknown outbound type: mieru
[31mFATAL[0m[0000] decode config at /etc/sing-box/config.json: outbounds[0]: unknown outbound type: mieru
### Почему перезапускался app (последний выход)
запусков=0 статус=running код выхода=0 убит по памяти=false стартовал=2026-08-23T15:07:43.723555862Z
### Свободное место подробно
Filesystem      Size  Used Avail Use% Mounted on
/dev/vda2        89G   23G   62G  27% /
/dev/vda2        89G   23G   62G  27% /
### Какой образ реально запущен
образ=cmpasru-app создан=2026-08-23T15:07:42.551579176Z запущен=2026-08-23T15:07:43.723555862Z
cmpasru-app:latest 16ccefa29a00 4 minutes ago
zapiski-api:latest e3f55738faa2 3 hours ago
cmpasru-infra-pulse:latest 2ac0ba3456ae 3 hours ago
postgres:16-alpine 57c72fd2a128 6 weeks ago
ghcr.io/sagernet/sing-box:latest c8b67944345d 8 weeks ago
boky/postfix:latest aafc77238423 7 months ago
postgres:15-alpine b3968e348b48 8 months ago
### Метка сборки внутри контейнера
-rw-r--r-- 1 nextjs nodejs 21 Aug 23 15:04 /app/.next/BUILD_ID
qq2mwjX2-f6Zj2FKRud_J### Есть ли панель в запущенной сборке
(chrome)
panel
### Хвост журнала последней выкладки
#17 200.0 Unpacking libpq5:amd64 (15.19-0+deb12u1) ...
#17 200.1 Selecting previously unselected package libreadline8:amd64.
#17 200.1 Preparing to unpack .../17-libreadline8_8.2-1.3_amd64.deb ...
#17 200.1 Unpacking libreadline8:amd64 (8.2-1.3) ...
#17 200.2 Selecting previously unselected package postgresql-client-common.
#17 200.2 Preparing to unpack .../18-postgresql-client-common_248+deb12u1_all.deb ...
#17 200.2 Unpacking postgresql-client-common (248+deb12u1) ...
#17 200.3 Selecting previously unselected package postgresql-client-15.
#17 200.3 Preparing to unpack .../19-postgresql-client-15_15.19-0+deb12u1_amd64.deb ...
#17 200.3 Unpacking postgresql-client-15 (15.19-0+deb12u1) ...
#17 200.8 Selecting previously unselected package postgresql-client.
#17 200.8 Preparing to unpack .../20-postgresql-client_15+248+deb12u1_all.deb ...
#17 200.8 Unpacking postgresql-client (15+248+deb12u1) ...
#17 200.9 Setting up libkeyutils1:amd64 (1.6.3-2) ...
#17 200.9 Setting up libkrb5support0:amd64 (1.20.1-2+deb12u5) ...
#17 200.9 Setting up libsasl2-modules-db:amd64 (2.1.28+dfsg-10) ...
#17 200.9 Setting up perl-modules-5.36 (5.36.0-7+deb12u3) ...
#17 200.9 Setting up libk5crypto3:amd64 (1.20.1-2+deb12u5) ...
#17 200.9 Setting up libsasl2-2:amd64 (2.1.28+dfsg-10) ...
#17 201.0 Setting up sensible-utils (0.0.17+nmu1) ...
#17 201.0 Setting up netbase (6.4) ...
#17 201.0 Setting up libkrb5-3:amd64 (1.20.1-2+deb12u5) ...
#17 201.0 Setting up readline-common (8.2-1.3) ...
#17 201.0 Setting up libgdbm6:amd64 (1.23-3) ...
#17 201.0 Setting up libreadline8:amd64 (8.2-1.3) ...
#17 201.1 Setting up libldap-2.5-0:amd64 (2.5.13+dfsg-5) ...
#17 201.1 Setting up libgssapi-krb5-2:amd64 (1.20.1-2+deb12u5) ...
#17 201.1 Setting up libgdbm-compat4:amd64 (1.23-3) ...
#17 201.1 Setting up libperl5.36:amd64 (5.36.0-7+deb12u3) ...
#17 201.1 Setting up libpq5:amd64 (15.19-0+deb12u1) ...
#17 201.1 Setting up perl (5.36.0-7+deb12u3) ...
#17 201.2 Setting up postgresql-client-common (248+deb12u1) ...
#17 201.2 Setting up postgresql-client-15 (15.19-0+deb12u1) ...
#17 203.0 update-alternatives: using /usr/share/postgresql/15/man/man1/psql.1.gz to provide /usr/share/man/man1/psql.1.gz (psql.1.gz) in auto mode
#17 203.1 Setting up postgresql-client (15+248+deb12u1) ...
#17 203.1 Processing triggers for libc-bin (2.36-9+deb12u13) ...
#17 DONE 203.5s

#39 [infra-pulse] exporting to image
#39 exporting layers
### Флаги аналитики в /var/www/cmpas.ru/.env
ANALYTICS_INGEST_ENABLED=true
ANALYTICS_TRACKING_ENABLED=true
ANALYTICS_INGEST_SECRET: задан (длина 64)
### Файлы с секретом приёмника
/etc/simpas/ingest-secret: есть, 65 байт, права 600, владелец root
/var/www/zapiski/.ingest-secret: есть, 65 байт, права 600, владелец root
### Контейнер infra-pulse
cmpas-infra-pulse | Up 3 hours | cmpasru-infra-pulse
### Свежесть строк InfraPulse
строк всего=48
последняя=2026-08-23 18:33:13.734 возраст_мин=1
### Таблицы аналитического контура
ReminderOutbox
Subscription
analytics_device_consent
events
events_rejected
### Наполнение событий и подписок
events=503
подписок=1
### Разделение секретов по продуктам
ANALYTICS_INGEST_SECRET: задан, длина 64
ANALYTICS_INGEST_SECRET_MOMENTS: НЕ ЗАДАН (МОМЕНТЫ получат 401 — как и сегодня)
запрос не прошёл: fetch failed
### Мобильные маршруты аналитики (без токена — ждём 401)
запрос не прошёл: fetch failed
запрос не прошёл: fetch failed
### Срок хранения событий
событий старше 180 дней: 0
### Приёмник изнутри сервера (без заголовка — ждём 401)
запрос не прошёл: fetch failed
```

## Миграции, лежащие в репозитории

```
20260118_add_orders
20260118_add_visitor_analytics
20260118_enhanced_analytics
20260215171500_add_diary_models
20260221_add_calendar_integration_fields
20260222000000_add_advanced_scheduling
20260226_sync_schema
20260307_consent_and_onboarding
20260308_user_consent
20260315_add_legal_documents
20260323_add_sync_from_to_calendar_integration
20260404_add_max_chat_id
20260404_add_trial_ends_at
20260405_add_max_chat_id_to_diary_client
20260405_add_subscription_payments
20260411_add_pageview
20260411_admin_crm_models
20260411_schedule_v2
20260419_add_schedule_rules
20260426_add_system_config
20260531_configurable_documents_payments
20260531_specialist_client_documents
20260610_scheduled_messages_fcm
20260705183000_add_diary_session_payment_status
20260705_practice_notifications
20260709_feature_interest
20260709_legal_acceptance_audit_fields
20260710120000_legal_acceptance_schema_sync
20260817120000_analytics_f0_f1
20260817140000_booking_a_b
20260818090000_ingest_anonymous
20260818100000_infra_pulse
20260820120000_infra_pulse_panel_fields
20260823090000_reminder_outbox
20260823093000_analytics_event_id
20260823094500_app_response_time
20260823100000_visitor_analytics_account_id
20260823170000_client_request_id
```
