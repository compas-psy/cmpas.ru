# Состояние базы на боевом сервере

Снято прогоном 32958784751. Файл перезаписывается каждой диагностикой.

```
Warning: Permanently added '45.144.30.190' (ED25519) to the list of known hosts.
### Журнал миграций существует?
t
### Записей в журнале
38
### Незавершённых миграций
0
### Последние 20 записей журнала
20260823170000_client_request_id  finished=2026-08-23 18:35:50.620241+00
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
### Сессии по статусам (панель считает NSM только по completed)
completed=32
pending=6
confirmed=3
### Сессии по свежести
за 7 дней=0
за 30 дней=0
специалистов с сессией за 30 дней=0
самая свежая сессия=2026-07-18 00:00:00
### Специалисты по свежести регистрации
зарегистрировано за 30 дней=2
зарегистрировано за 90 дней=7
### События приёмника по продуктам и свежести
zapiski всего=1197 свежайшее=2026-08-26 10:20:08.739
событий за 30 дней=1197
### Согласие на аналитику
пользователей с согласием=0
### Платежи и подписки по статусам
pending=6
failed=2
paid=1
подписок всего=1
### Триалы: панель видит их через Subscription, дашборд — через User
User.trialEndsAt в будущем=2
User.trialEndsAt задан вообще=11
User.subscriptionEndsAt задан=1
churned=1
### Источники трафика: панель требует привязку к аккаунту, старая аналитика — нет
VisitorAnalytics всего=270
из них с accountId=0
из них с utmSource=9
### Последнее показание InfraPulse: какие поля заполнены
collectedAt=2026-08-26 10:31:31.25
certDaysLeft=37 | backupAgeHours=62.39975452718099 | backupReadable=true | responseP95Ms=NULL | remindersDue=0 | remindersSent=0 | migrationsApplied=38 | migrationsDrift={"onlyInDb": [], "onlyInRepo": []} | cpuPercent=65.85365853658536 | containers=[{"name": "zapiski-api", "running": true
### События по имени (панель ищет узкие срезы)
note_saved=748
sync_completed=394
note_searched=52
export_requested=2
consent_updated=1
### Таблицы, из которых панель читает: пустые или нет
InfraPulse=816
DeployLog=9
ReminderOutbox=0
events=1197
events_rejected=5
Subscription=1
Payment=9
### Место на диске
Filesystem      Size  Used Avail Use% Mounted on
/dev/vda2        89G   24G   61G  29% /
/dev/vda2        89G   24G   61G  29% /
### Память
               total        used        free      shared  buff/cache   available
Mem:            7941        2314        1554          55        4434        5627
Swap:            511          83         428
### Что занимает docker
Error response from daemon: failed to calculate image disk usage: NotFound: snapshot xzt9gld4388b8uz785yy24k7v does not exist: not found
### Убитые по нехватке памяти за сутки
0
0
не удалось прочитать
### Хвост журнала последней выкладки (/tmp/cmpas-deploy.log)
#17 5.547   libgdbm-compat4 libgdbm6 libgssapi-krb5-2 libk5crypto3 libkeyutils1
#17 5.547   libkrb5-3 libkrb5support0 libldap-2.5-0 libperl5.36 libpq5 libreadline8
#17 5.547   libsasl2-2 libsasl2-modules-db netbase perl perl-modules-5.36
#17 5.547   postgresql-client postgresql-client-15 postgresql-client-common
#17 5.547   readline-common sensible-utils
#17 5.731 0 upgraded, 21 newly installed, 0 to remove and 13 not upgraded.
#17 5.731 Need to get 10.5 MB of archives.
#17 5.731 After this operation, 61.7 MB of additional disk space will be used.
#17 5.731 Get:1 http://deb.debian.org/debian bookworm/main amd64 perl-modules-5.36 all 5.36.0-7+deb12u3 [2815 kB]
#17 6.044 Get:2 http://deb.debian.org/debian bookworm/main amd64 libgdbm6 amd64 1.23-3 [72.2 kB]
#17 6.047 Get:3 http://deb.debian.org/debian bookworm/main amd64 libgdbm-compat4 amd64 1.23-3 [48.2 kB]
#17 6.056 Get:4 http://deb.debian.org/debian bookworm/main amd64 libperl5.36 amd64 5.36.0-7+deb12u3 [4196 kB]
#17 6.275 Get:5 http://deb.debian.org/debian bookworm/main amd64 perl amd64 5.36.0-7+deb12u3 [239 kB]
#17 6.291 Get:6 http://deb.debian.org/debian bookworm/main amd64 netbase all 6.4 [12.8 kB]
#17 6.294 Get:7 http://deb.debian.org/debian bookworm/main amd64 readline-common all 8.2-1.3 [69.0 kB]
#17 6.296 Get:8 http://deb.debian.org/debian bookworm/main amd64 sensible-utils all 0.0.17+nmu1 [19.0 kB]
#17 6.296 Get:9 http://deb.debian.org/debian bookworm/main amd64 libkrb5support0 amd64 1.20.1-2+deb12u5 [33.2 kB]
#17 6.298 Get:10 http://deb.debian.org/debian bookworm/main amd64 libk5crypto3 amd64 1.20.1-2+deb12u5 [79.7 kB]
#17 6.318 Get:11 http://deb.debian.org/debian bookworm/main amd64 libkeyutils1 amd64 1.6.3-2 [8808 B]
#17 6.321 Get:12 http://deb.debian.org/debian bookworm/main amd64 libkrb5-3 amd64 1.20.1-2+deb12u5 [332 kB]
#17 6.329 Get:13 http://deb.debian.org/debian bookworm/main amd64 libgssapi-krb5-2 amd64 1.20.1-2+deb12u5 [135 kB]
#17 6.335 Get:14 http://deb.debian.org/debian bookworm/main amd64 libsasl2-modules-db amd64 2.1.28+dfsg-10 [20.3 kB]
#17 6.366 Get:15 http://deb.debian.org/debian bookworm/main amd64 libsasl2-2 amd64 2.1.28+dfsg-10 [59.7 kB]
#17 6.368 Get:16 http://deb.debian.org/debian bookworm/main amd64 libldap-2.5-0 amd64 2.5.13+dfsg-5 [183 kB]
#17 6.376 Get:17 http://deb.debian.org/debian-security bookworm-security/main amd64 libpq5 amd64 15.19-0+deb12u1 [203 kB]
#17 6.382 Get:18 http://deb.debian.org/debian bookworm/main amd64 libreadline8 amd64 8.2-1.3 [166 kB]
#17 6.388 Get:19 http://deb.debian.org/debian bookworm/main amd64 postgresql-client-common all 248+deb12u1 [35.2 kB]
#17 6.412 Get:20 http://deb.debian.org/debian-security bookworm-security/main amd64 postgresql-client-15 amd64 15.19-0+deb12u1 [1759 kB]
#17 6.462 Get:21 http://deb.debian.org/debian bookworm/main amd64 postgresql-client all 15+248+deb12u1 [10.2 kB]
#17 6.884 debconf: delaying package configuration, since apt-utils is not installed
#17 6.992 Fetched 10.5 MB in 1s (11.9 MB/s)
#17 7.051 Selecting previously unselected package perl-modules-5.36.
#17 7.051 (Reading database ... (Reading database ... 5%(Reading database ... 10%(Reading database ... 15%(Reading database ... 20%(Reading database ... 25%(Reading database ... 30%(Reading database ... 35%(Reading database ... 40%(Reading database ... 45%(Reading database ... 50%(Reading database ... 55%(Reading database ... 60%(Reading database ... 65%(Reading database ... 70%(Reading database ... 75%(Reading database ... 80%(Reading database ... 85%(Reading database ... 90%(Reading database ... 95%(Reading database ... 100%(Reading database ... 6593 files and directories currently installed.)
#17 7.109 Preparing to unpack .../00-perl-modules-5.36_5.36.0-7+deb12u3_all.deb ...
#17 7.123 Unpacking perl-modules-5.36 (5.36.0-7+deb12u3) ...
#17 7.951 Selecting previously unselected package libgdbm6:amd64.
#17 7.958 Preparing to unpack .../01-libgdbm6_1.23-3_amd64.deb ...
#17 7.984 Unpacking libgdbm6:amd64 (1.23-3) ...
#17 8.059 Selecting previously unselected package libgdbm-compat4:amd64.
#17 8.062 Preparing to unpack .../02-libgdbm-compat4_1.23-3_amd64.deb ...
#17 8.067 Unpacking libgdbm-compat4:amd64 (1.23-3) ...
#17 8.151 Selecting previously unselected package libperl5.36:amd64.
#17 8.151 Preparing to unpack .../03-libperl5.36_5.36.0-7+deb12u3_amd64.deb ...
#17 8.167 Unpacking libperl5.36:amd64 (5.36.0-7+deb12u3) ...
#17 ...

#18 [app runner  5/20] COPY deploy/certs/ /usr/local/share/ca-certificates/max-ru/
#18 CACHED

#19 [app runner  6/20] RUN update-ca-certificates || true
#19 CACHED

#20 [app runner  8/20] RUN mkdir -p ./public/uploads/client-documents && chown -R nextjs:nodejs ./public
#20 CACHED

#21 [app runner  3/20] RUN adduser --system --uid 1001 --home /home/nextjs nextjs
#21 CACHED

#22 [app runner  7/20] COPY --from=builder /app/public ./public
#22 CACHED

#23 [app runner  9/20] RUN mkdir .next
#23 CACHED

#24 [app runner  2/20] RUN addgroup --system --gid 1001 nodejs
#24 CACHED

#25 [app runner  4/20] RUN mkdir -p /home/nextjs && chown -R nextjs:nodejs /home/nextjs
#25 CACHED

#26 [app runner 10/20] RUN chown nextjs:nodejs .next
#26 CACHED

#27 [app runner 11/20] COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
#27 DONE 2.2s

#17 [infra-pulse infra-pulse-collector 2/2] RUN apt-get update -y && apt-get install -y --no-install-recommends postgresql-client && rm -rf /var/lib/apt/lists/*
#17 9.081 Selecting previously unselected package perl.
#17 9.085 Preparing to unpack .../04-perl_5.36.0-7+deb12u3_amd64.deb ...
#17 9.106 Unpacking perl (5.36.0-7+deb12u3) ...
#17 9.299 Selecting previously unselected package netbase.
#17 9.302 Preparing to unpack .../05-netbase_6.4_all.deb ...
#17 9.310 Unpacking netbase (6.4) ...
#17 9.406 Selecting previously unselected package readline-common.
#17 9.407 Preparing to unpack .../06-readline-common_8.2-1.3_all.deb ...
#17 9.411 Unpacking readline-common (8.2-1.3) ...
#17 9.477 Selecting previously unselected package sensible-utils.
#17 9.481 Preparing to unpack .../07-sensible-utils_0.0.17+nmu1_all.deb ...
#17 9.483 Unpacking sensible-utils (0.0.17+nmu1) ...
#17 9.549 Selecting previously unselected package libkrb5support0:amd64.
#17 9.554 Preparing to unpack .../08-libkrb5support0_1.20.1-2+deb12u5_amd64.deb ...
#17 9.559 Unpacking libkrb5support0:amd64 (1.20.1-2+deb12u5) ...
#17 9.622 Selecting previously unselected package libk5crypto3:amd64.
#17 9.625 Preparing to unpack .../09-libk5crypto3_1.20.1-2+deb12u5_amd64.deb ...
#17 9.629 Unpacking libk5crypto3:amd64 (1.20.1-2+deb12u5) ...
#17 9.732 Selecting previously unselected package libkeyutils1:amd64.
#17 9.735 Preparing to unpack .../10-libkeyutils1_1.6.3-2_amd64.deb ...
#17 9.740 Unpacking libkeyutils1:amd64 (1.6.3-2) ...
#17 9.909 Selecting previously unselected package libkrb5-3:amd64.
#17 9.914 Preparing to unpack .../11-libkrb5-3_1.20.1-2+deb12u5_amd64.deb ...
#17 9.928 Unpacking libkrb5-3:amd64 (1.20.1-2+deb12u5) ...
#17 10.45 Selecting previously unselected package libgssapi-krb5-2:amd64.
#17 10.45 Preparing to unpack .../12-libgssapi-krb5-2_1.20.1-2+deb12u5_amd64.deb ...
#17 10.46 Unpacking libgssapi-krb5-2:amd64 (1.20.1-2+deb12u5) ...
#17 10.57 Selecting previously unselected package libsasl2-modules-db:amd64.
#17 ...

#28 [app runner 12/20] COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
#28 DONE 0.3s

#17 [infra-pulse infra-pulse-collector 2/2] RUN apt-get update -y && apt-get install -y --no-install-recommends postgresql-client && rm -rf /var/lib/apt/lists/*
#17 10.57 Preparing to unpack .../13-libsasl2-modules-db_2.1.28+dfsg-10_amd64.deb ...
#17 10.58 Unpacking libsasl2-modules-db:amd64 (2.1.28+dfsg-10) ...
#17 10.65 Selecting previously unselected package libsasl2-2:amd64.
#17 10.65 Preparing to unpack .../14-libsasl2-2_2.1.28+dfsg-10_amd64.deb ...
#17 10.67 Unpacking libsasl2-2:amd64 (2.1.28+dfsg-10) ...
#17 10.81 Selecting previously unselected package libldap-2.5-0:amd64.
#17 10.81 Preparing to unpack .../15-libldap-2.5-0_2.5.13+dfsg-5_amd64.deb ...
#17 10.81 Unpacking libldap-2.5-0:amd64 (2.5.13+dfsg-5) ...
#17 10.98 Selecting previously unselected package libpq5:amd64.
### Состояние контейнеров
zapiski-api | Up 8 minutes (healthy)
cmpas-app | Up 2 days
cmpas-infra-pulse | Up 2 days
zapiski-postgres | Up 5 days (healthy)
cmpas-mailer | Up 5 days (healthy)
cmpas-postgres | Up 5 days (healthy)
cmpas-singbox | Exited (1) 5 days ago
### Достижим ли Т-Банк с сервера
-- имя разрешается в:
178.130.128.34  securepay.tinkoff.ru
-- curl с хоста:
код 405, время 0.159968s
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
### Платежи: возраст и полнота записи (без секретов)
pending | tinkoffPaymentId=true | terminal=site | возраст_ч=187
pending | tinkoffPaymentId=true | terminal=site | возраст_ч=2644
pending | tinkoffPaymentId=true | terminal=site | возраст_ч=2921
pending | tinkoffPaymentId=true | terminal=site | возраст_ч=3241
pending | tinkoffPaymentId=true | terminal=site | возраст_ч=3411
pending | tinkoffPaymentId=true | terminal=site | возраст_ч=3424
paid | tinkoffPaymentId=true | terminal=site | возраст_ч=3425
failed | tinkoffPaymentId=false | terminal=site | возраст_ч=3425
failed | tinkoffPaymentId=false | terminal=site | возраст_ч=3425
### Демонстрационный терминал: не подменяет ли он боевой (по журналу приложения)
упоминаний в журнале контейнера: 0
### Журнал колбэков Т-Кассы за 7 суток (RebillId и Token вычищены построчно)
### Куда Т-Касса должна слать колбэк (URL, не секрет)
AUTH_URL=https://cmpas.ru
### Живёт ли контейнер дольше, чем застрявшие платежи (иначе журнал ничего не покажет)
запущен=2026-08-23T20:09:55.301957251Z
### Достижим ли маршрут колбэка снаружи (безвредный запрос, без валидного токена)
POST /api/payments/callback (снаружи, через cmpas.ru) -> 400
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
https://cmpas.ru/ -> 200 за 0.156094s
https://cmpas.ru/diary -> 307 за 0.128304s
https://cmpas.ru/admin -> 307 за 0.451334s
### Сертификат cmpas.ru
notBefore=Jul  4 23:22:19 2026 GMT
notAfter=Oct  2 23:22:18 2026 GMT
subject=CN = cmpas.ru
issuer=C = US, O = Let's Encrypt, CN = YE1
### Кто слушает 80 и 443
LISTEN 0      4096                                       0.0.0.0:3000       0.0.0.0:*    users:(("docker-proxy",pid=2332097,fd=7))                                                                                                                                            
LISTEN 0      511                                        0.0.0.0:443        0.0.0.0:*    users:(("nginx",pid=3955973,fd=11),("nginx",pid=3955970,fd=11),("nginx",pid=3955968,fd=11),("nginx",pid=3955967,fd=11),("nginx",pid=3955966,fd=11))                                  
LISTEN 0      511                                        0.0.0.0:80         0.0.0.0:*    users:(("nginx",pid=3955973,fd=12),("nginx",pid=3955970,fd=12),("nginx",pid=3955968,fd=12),("nginx",pid=3955967,fd=12),("nginx",pid=3955966,fd=12))                                  
LISTEN 0      4096                                          [::]:3000          [::]:*    users:(("docker-proxy",pid=2332103,fd=7))                                                                                                                                            
LISTEN 0      511                                           [::]:443           [::]:*    users:(("nginx",pid=3955973,fd=13),("nginx",pid=3955970,fd=13),("nginx",pid=3955968,fd=13),("nginx",pid=3955967,fd=13),("nginx",pid=3955966,fd=13))                                  
LISTEN 0      511                                           [::]:80            [::]:*    users:(("nginx",pid=3955973,fd=14),("nginx",pid=3955970,fd=14),("nginx",pid=3955968,fd=14),("nginx",pid=3955967,fd=14),("nginx",pid=3955966,fd=14))                                  
### Журнал приложения, последние 60 строк
Read more: https://nextjs.org/docs/messages/failed-to-find-server-action
    at ignore-listed frames
Error: Failed to find Server Action "mo". This request might be from an older or newer deployment.
Read more: https://nextjs.org/docs/messages/failed-to-find-server-action
    at ignore-listed frames
Error: Failed to find Server Action "mo". This request might be from an older or newer deployment.
Read more: https://nextjs.org/docs/messages/failed-to-find-server-action
    at ignore-listed frames
Error: Failed to find Server Action "mo". This request might be from an older or newer deployment.
Read more: https://nextjs.org/docs/messages/failed-to-find-server-action
    at ignore-listed frames
[CRON] Запуск рассылки уведомлений (каждые 15 минут)
[CRON] Запуск рассылки уведомлений (каждые 15 минут)
Error: Failed to find Server Action "x". This request might be from an older or newer deployment.
Read more: https://nextjs.org/docs/messages/failed-to-find-server-action
    at ignore-listed frames
Error: Failed to find Server Action "x". This request might be from an older or newer deployment.
Read more: https://nextjs.org/docs/messages/failed-to-find-server-action
    at ignore-listed frames
Error: Failed to find Server Action "x". This request might be from an older or newer deployment.
Read more: https://nextjs.org/docs/messages/failed-to-find-server-action
    at ignore-listed frames
Error: Failed to find Server Action "x". This request might be from an older or newer deployment.
Read more: https://nextjs.org/docs/messages/failed-to-find-server-action
    at ignore-listed frames
Error: Failed to find Server Action "x". This request might be from an older or newer deployment.
Read more: https://nextjs.org/docs/messages/failed-to-find-server-action
    at ignore-listed frames
Error: Failed to find Server Action "x". This request might be from an older or newer deployment.
Read more: https://nextjs.org/docs/messages/failed-to-find-server-action
    at ignore-listed frames
Error: Failed to find Server Action "x". This request might be from an older or newer deployment.
Read more: https://nextjs.org/docs/messages/failed-to-find-server-action
    at ignore-listed frames
[CRON] Запуск рассылки уведомлений (каждые 15 минут)
Error: Failed to find Server Action "d7abf88ab6d5c4dcff69f90704bc77efb631146c". This request might be from an older or newer deployment.
Read more: https://nextjs.org/docs/messages/failed-to-find-server-action
    at ignore-listed frames
⨯ Error: Failed to find Server Action. This request might be from an older or newer deployment.
Read more: https://nextjs.org/docs/messages/failed-to-find-server-action
    at async m (.next/server/chunks/ssr/_adf2bbda._.js:1:6738)
    at async o (.next/server/chunks/ssr/_adf2bbda._.js:2:2712)
    at async Module.I (.next/server/chunks/ssr/_adf2bbda._.js:2:7927)
⨯ Error: Failed to find Server Action. This request might be from an older or newer deployment.
Read more: https://nextjs.org/docs/messages/failed-to-find-server-action
    at async m (.next/server/chunks/ssr/_adf2bbda._.js:1:6738)
    at async o (.next/server/chunks/ssr/_adf2bbda._.js:2:2712)
    at async Module.I (.next/server/chunks/ssr/_adf2bbda._.js:2:7927)
⨯ Error: Failed to find Server Action. This request might be from an older or newer deployment.
Read more: https://nextjs.org/docs/messages/failed-to-find-server-action
    at async m (.next/server/chunks/ssr/_adf2bbda._.js:1:6738)
    at async o (.next/server/chunks/ssr/_adf2bbda._.js:2:2712)
    at async Module.I (.next/server/chunks/ssr/_adf2bbda._.js:2:7927)
⨯ Error: Failed to find Server Action. This request might be from an older or newer deployment.
Read more: https://nextjs.org/docs/messages/failed-to-find-server-action
    at async m (.next/server/chunks/ssr/_adf2bbda._.js:1:6738)
    at async o (.next/server/chunks/ssr/_adf2bbda._.js:2:2712)
    at async Module.I (.next/server/chunks/ssr/_adf2bbda._.js:2:7927)
[Tinkoff callback] {"OrderId":"doctor-probe-nonexistent","TerminalKey":"doctor-probe","Status":"REJECTED","PaymentId":1,"Amount":1,"Token":"0000000000000000000000000000000000000000000000000000000000"}
[Tinkoff callback] Invalid token, OrderId: doctor-probe-nonexistent
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
запусков=0 статус=running код выхода=0 убит по памяти=false стартовал=2026-08-23T20:09:55.301957251Z
### Свободное место подробно
Filesystem      Size  Used Avail Use% Mounted on
/dev/vda2        89G   25G   60G  29% /
/dev/vda2        89G   25G   60G  29% /
### Какой образ реально запущен
образ=cmpasru-app создан=2026-08-23T20:09:53.861347468Z запущен=2026-08-23T20:09:55.301957251Z
cmpasru-infra-pulse:latest 2edc39c80ed9 2 days ago
cmpasru-app:latest dadef0c1993e 2 days ago
zapiski-api:latest f9cc805917ad 2 days ago
postgres:16-alpine 57c72fd2a128 7 weeks ago
ghcr.io/sagernet/sing-box:latest c8b67944345d 2 months ago
boky/postfix:latest aafc77238423 7 months ago
postgres:15-alpine b3968e348b48 8 months ago
### Метка сборки внутри контейнера
-rw-r--r-- 1 nextjs nodejs 21 Aug 23 20:08 /app/.next/BUILD_ID
RXep4MGGI6mMDCSCus77T### Есть ли панель в запущенной сборке
(chrome)
panel
### Хвост журнала последней выкладки
#17 12.24 Setting up libsasl2-modules-db:amd64 (2.1.28+dfsg-10) ...
#17 12.26 Setting up perl-modules-5.36 (5.36.0-7+deb12u3) ...
#17 12.27 Setting up libk5crypto3:amd64 (1.20.1-2+deb12u5) ...
#17 12.30 Setting up libsasl2-2:amd64 (2.1.28+dfsg-10) ...
#17 12.32 Setting up sensible-utils (0.0.17+nmu1) ...
#17 12.34 Setting up netbase (6.4) ...
#17 12.40 Setting up libkrb5-3:amd64 (1.20.1-2+deb12u5) ...
#17 12.41 Setting up readline-common (8.2-1.3) ...
#17 12.42 Setting up libgdbm6:amd64 (1.23-3) ...
#17 12.43 Setting up libreadline8:amd64 (8.2-1.3) ...
#17 12.45 Setting up libldap-2.5-0:amd64 (2.5.13+dfsg-5) ...
#17 12.46 Setting up libgssapi-krb5-2:amd64 (1.20.1-2+deb12u5) ...
#17 12.48 Setting up libgdbm-compat4:amd64 (1.23-3) ...
#17 12.53 Setting up libperl5.36:amd64 (5.36.0-7+deb12u3) ...
#17 ...

#34 [app runner 18/20] COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
#34 DONE 0.4s

#17 [infra-pulse infra-pulse-collector 2/2] RUN apt-get update -y && apt-get install -y --no-install-recommends postgresql-client && rm -rf /var/lib/apt/lists/*
#17 12.61 Setting up libpq5:amd64 (15.19-0+deb12u1) ...
#17 12.63 Setting up perl (5.36.0-7+deb12u3) ...
#17 12.67 Setting up postgresql-client-common (248+deb12u1) ...
#17 12.71 Setting up postgresql-client-15 (15.19-0+deb12u1) ...
#17 ...

#35 [app runner 19/20] COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
#35 DONE 0.6s

#36 [app runner 20/20] COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma
#36 DONE 0.3s

#17 [infra-pulse infra-pulse-collector 2/2] RUN apt-get update -y && apt-get install -y --no-install-recommends postgresql-client && rm -rf /var/lib/apt/lists/*
#17 14.97 update-alternatives: using /usr/share/postgresql/15/man/man1/psql.1.gz to provide /usr/share/man/man1/psql.1.gz (psql.1.gz) in auto mode
#17 15.14 Setting up postgresql-client (15+248+deb12u1) ...
#17 15.17 Processing triggers for libc-bin (2.36-9+deb12u13) ...
#17 DONE 15.4s

#37 [app] exporting to image
#37 exporting layers
### Флаги аналитики в /var/www/cmpas.ru/.env
ANALYTICS_INGEST_ENABLED=true
ANALYTICS_TRACKING_ENABLED=true
ANALYTICS_INGEST_SECRET: задан (длина 64)
### Файлы с секретом приёмника
/etc/simpas/ingest-secret: есть, 65 байт, права 600, владелец root
/var/www/zapiski/.ingest-secret: есть, 65 байт, права 600, владелец root
### Контейнер infra-pulse
cmpas-infra-pulse | Up 2 days | cmpasru-infra-pulse
### Свежесть строк InfraPulse
строк всего=816
последняя=2026-08-26 10:31:31.25 возраст_мин=2
### Таблицы аналитического контура
ReminderOutbox
Subscription
analytics_device_consent
events
events_rejected
### Наполнение событий и подписок
events=1197
подписок=1
### Куда на самом деле слушает приложение
HOSTNAME внутри контейнера: e82916877e3b
IP контейнера: 172.18.0.2 
### Приёмник без ключа (ждём 401)
POST /api/ingest без Authorization -> 401
  ответ: {"accepted":false,"reason":"unauthorized"}
### Разделение секретов по продуктам
ANALYTICS_INGEST_SECRET: задан, длина 64
ANALYTICS_INGEST_SECRET_MOMENTS: задан, длина 64
секретом ПРАКТИКИ шлём событие МОМЕНТОВ -> HTTP 200 {"accepted":false,"reason":"secret not allowed for product moments"}
ПРИВЯЗКА РАБОТАЕТ: чужой продукт отвергнут
### Мобильные маршруты аналитики (без токена — ждём 401)
POST /api/mobile/analytics -> 401
GET  /api/mobile/analytics/consent -> 401
PUT  /api/mobile/analytics/consent -> 401
### Срок хранения событий
событий старше 180 дней: 0
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
