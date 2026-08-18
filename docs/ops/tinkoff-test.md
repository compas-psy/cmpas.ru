# Самопроверка эквайринга Т-Банк (тестовый терминал)

Прогон: 2026-08-18T11:38:16.898Z

## Что подставлено

- терминал сайта: TINK…EY (длина 25)
- пароль сайта: задан
- терминал приложения: 1775…MO (длина 17)
- пароль приложения: задан

## 1. Алгоритм подписи

- **сходится**: сортировка по имени поля, склейка значений, добавление пароля, SHA-256

## 2. Создание платежа на терминале сайта

- **отказ:** fetch failed

## 4. Терминал приложения


---

**САМОПРОВЕРКА УПАЛА С ОШИБКОЙ**

```
TypeError: fetch failed
    at node:internal/deps/undici/undici:14976:13
    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)
    at async post (/home/runner/work/cmpas.ru/cmpas.ru/scripts/tinkoff-selftest.ts:26:17)
    at async main (/home/runner/work/cmpas.ru/cmpas.ru/scripts/tinkoff-selftest.ts:127:19)
```

## Обращение к Т-Банку с сервера

```
Warning: Permanently added '45.144.30.190' (ED25519) to the list of known hosts.
### сайт
Success: false | Status:  | ErrorCode: 501
Message: Неверные параметры. Терминал не найден.
### приложение
Success: true | Status: NEW | ErrorCode: 0
PaymentURL: https://pay.tbank.ru/jEsyvEIJ
GetState: Success=true Status=NEW
```
