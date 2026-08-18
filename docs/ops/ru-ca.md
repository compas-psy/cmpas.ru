# Доверие корню Минцифры

Прогон 32132573808.

```
Warning: Permanently added '45.144.30.190' (ED25519) to the list of known hosts.
[ru-ca] Скачиваю корневой и промежуточный сертификаты Минцифры.
[ru-ca] --- root ---
subject=C = RU, O = The Ministry of Digital Development and Communications, CN = Russian Trusted Root CA
issuer=C = RU, O = The Ministry of Digital Development and Communications, CN = Russian Trusted Root CA
notBefore=Mar  1 21:04:15 2022 GMT
notAfter=Feb 27 21:04:15 2032 GMT
[ru-ca] отпечаток SHA-256: D2:6D:2D:02:31:B7:C3:9F:92:CC:73:85:12:BA:54:10:35:19:E4:40:5D:68:B5:BD:70:3E:97:88:CA:8E:CF:31
[ru-ca] --- sub ---
subject=C = RU, O = The Ministry of Digital Development and Communications, CN = Russian Trusted Sub CA
issuer=C = RU, O = The Ministry of Digital Development and Communications, CN = Russian Trusted Root CA
notBefore=Mar  2 11:25:19 2022 GMT
notAfter=Mar  6 11:25:19 2027 GMT
[ru-ca] отпечаток SHA-256: BB:BD:E2:10:3E:79:0B:99:9E:C6:2B:D0:3C:F6:25:A5:A2:E7:C3:16:E1:0A:FE:6A:49:0E:ED:EA:D8:B3:FD:9B
[ru-ca] Устанавливаю в доверенные системы.
Updating certificates in /etc/ssl/certs...
0 added, 0 removed; done.
Running hooks in /etc/ca-certificates/update.d...
done.
[ru-ca] Складываю связку для контейнера приложения.
[ru-ca] Связка собрана, сертификатов внутри: 2
[ru-ca] Проверяю связку глазами Node:
[ru-ca] Node получил код 200
[ru-ca] Проверяю платёжный шлюз с хоста:
[ru-ca] код ответа 405
[ru-ca] Готово. Доверие установлено, шлюз отвечает.
EXIT_CODE=0
```
