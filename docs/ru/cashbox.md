# Касса

Кассовые смены Kaspi, наличные в кассе и сверка кассы со счетами ApiPay.

Раздел нужен, если у организации есть касса Kaspi: он позволяет закрывать смены, забирать по ним PDF-отчёты, видеть остаток наличных и сопоставлять итог кассы с оплаченными счетами ApiPay — без ручной работы в приложении.

## Предусловия

1. **К аккаунту Kaspi Pay подключена Kaspi Касса (ОФД).** Это та же связка, что включает каталог товаров. Если продажи идут через Kaspi Pos без ОФД, кассовых смен у организации не существует: раздела «Касса» в кабинете нет, а эндпоинты отвечают отказом — `409 cashbox_kkm_unknown` у списка смен и закрытия, `409 rfo_missing` у сводки и тумблеров. Ждать в этом случае нечего: номер кассы не появится.
2. **Подключён кассир Kaspi.** Кассовые эндпоинты работают через активного кассира — исключение только сверка, она читает уже полученные смены. Иначе — `409 kaspi_session_not_configured`. При нескольких активных кассах передавайте `kaspi_connection_id`, иначе `422 connection_ambiguous`.
3. **Определена торговая точка и касса.** Без кода торговой точки приходит `409 rfo_missing`, без номера кассы — `409 cashbox_kkm_unknown`. Если Kaspi Касса подключена, а коды всё равно приходят: при нескольких кассах передайте `kaspi_connection_id` нужной точки, а состояние организации пересверяется переподключением кассира или кнопкой «Обновить информацию об организации» в настройках кабинета. ⚠️ Это действие может включить каталог товаров: после него `POST /invoices/qr` и `POST /static-qr` без `cart_items` отвечают `422 catalog_requires_cart_items`, а напечатанные QR-листы без состава перестают работать.
4. **Активна подписка.** Касса входит в платные возможности.

**В песочнице касса отвечает всегда** — детерминированными данными, независимо от того, подключена ли Kaspi Касса в бою и есть ли кассир. Интеграцию, прошедшую в песочнице, обязательно проверьте на боевой организации. Раздел «Касса» в кабинете тестовой организации при этом появляется, только если организация создана с ответом «касса есть» (ответ меняется в настройках).

**Отдельный лимит:** 30 запросов в минуту на ключ — строже общего.

Все суммы приходят строками вида `"12000.00"` и могут быть `null`. `null` означает «Kaspi не отдал поле», а не ноль.

## Наличные за день

**Эндпоинт:** `GET /cashbox/summary`

```bash
curl "https://api.apipay.kz/api/v1/cashbox/summary?date=2026-08-10" \
  -H "X-API-Key: YOUR_API_KEY"
```

`date` необязателен (по умолчанию сегодня, зона Asia/Almaty); будущая дата → `422`.

| Поле | Описание |
|------|----------|
| `current_cash_balance` | Наличные в кассе сейчас |
| `cash_amount_on_opening` | Было на начало дня |
| `replenishment_sum` / `withdrawal_sum` | Внесено и изъято за день |
| `sale_cash_amt` / `sale_cash_cnt` | Продажи за наличные: сумма и количество |
| `sale_return_cash_amt` / `sale_return_cash_cnt` | Возвраты наличными |
| `auto_withdrawal` | Включено ли автоизъятие наличных |
| `available_cashbox_actions` | `false` — Kaspi временно запретил кассовые операции |

Здесь только наличные. Оплаты по счетам ApiPay в эти суммы не входят — их отдаёт `GET /invoices`.

## Список смен

**Эндпоинт:** `GET /cashbox/shifts`

```bash
curl "https://api.apipay.kz/api/v1/cashbox/shifts?date_from=2026-08-09&date_to=2026-08-09" \
  -H "X-API-Key: YOUR_API_KEY"
```

`date_from` и `date_to` обязательны, окно — не длиннее 31 дня, иначе `422`. Запрос идёт в кассу Kaspi, поэтому отвечает не мгновенно: задайте клиенту таймаут с запасом.

```json
{
  "auto_close_shift": true,
  "shifts": [
    {
      "id": 118275707,
      "shift_number": 106,
      "start_date": "2026-08-09",
      "is_current": false,
      "total_income": "89000.00",
      "total_income_raw": "89 000 ₸",
      "transactions_count": 12
    }
  ]
}
```

`total_income_raw` — готовое форматирование Kaspi для показа человеку, не парсите его. Для арифметики берите `total_income`.

> Этот вызов обязателен перед сверкой: она работает по смене, полученной этим запросом.

## Отчёт по смене

**Эндпоинт:** `GET /cashbox/shifts/{shift}/report`

```bash
curl "https://api.apipay.kz/api/v1/cashbox/shifts/118275707/report" \
  -H "X-API-Key: YOUR_API_KEY"
```

```json
{ "url": "https://...", "expires_at": "2026-08-10T09:15:00+05:00" }
```

Возвращается не файл, а подписанная ссылка со сроком жизни около 15 минут. Скачивайте сразу; понадобится позже — запросите ссылку заново.

Ссылка открывается без API-ключа: отчёт скачает любой, у кого она есть, пока не истёк срок. Не пишите её в логи и не пересылайте дальше, чем нужно, — отозвать выданную ссылку нельзя.

## Закрытие смены

**Эндпоинт:** `POST /cashbox/shifts/close`

```bash
curl -X POST https://api.apipay.kz/api/v1/cashbox/shifts/close \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "client_operation_id": "close-2026-08-10-01", "shift_number": 106 }'
```

Ответ — `202`:

```json
{ "id": 812, "status": "pending", "client_operation_id": "close-2026-08-10-01", "poll_url": "..." }
```

Результат читайте одним из двух способов:

- поллинг `GET /cashbox/operations/{id}` до статуса `completed` или `failed`;
- вебхуки `cashbox.shift_closed` и `cashbox.shift_close_failed`.

### Идемпотентность и повторы

`client_operation_id` (8–191 символов из `A-Za-z0-9._:-`) уникален в пределах организации. Повтор с тем же ключом вернёт `409 cashbox_duplicate_operation` с полем `operation_id` уже принятой операции — его тоже можно поллить.

У операции в статусе `failed` смотрите `resolution.safe_to_retry`:

| Значение | Что означает |
|----------|--------------|
| `true` | Смена осталась открытой — можно повторить закрытие **новым** `client_operation_id` |
| `false` | Неизвестно, закрылась ли смена — автоматический повтор запрещён, проверьте состояние смены |

Прежний ключ после отказа не освобождается. Ответ Kaspi «смена уже закрыта» трактуется как успех: целевое состояние достигнуто.

## Сверка со счетами

**Эндпоинт:** `GET /cashbox/reconciliation`

```bash
curl "https://api.apipay.kz/api/v1/cashbox/reconciliation?shift_id=118275707" \
  -H "X-API-Key: YOUR_API_KEY"
```

`shift_id` обязателен. Смену нужно предварительно получить через `GET /cashbox/shifts`, иначе — `404 cashbox_shift_not_found`. Активная сессия кассира для самой сверки не требуется.

В ответе три блока:

- `ours` — ваши счета ApiPay за окно смены: `sales`, `refunds`, `net_amount` и `sales.refunded_later`. Окно считается по дате оплаты счёта. При нескольких кассах учтите: `sales` считаются по кассиру этой смены, а `refunds` — по всей организации, поэтому `net_amount` в такой конфигурации с одной кассой не сравнивают.
- `kaspi` — итог смены: `total_income`, `transactions_count`, `is_current`, а также `snapshot.stale` (снимок старше 15 минут — обновите список смен).
- `discrepancies[]` — структурные причины расхождения: `kaspi_income_includes_offline_sales`, `shift_not_calendar_day`, `open_shift_moving_target`, `paid_at_timezone_boundary`, `invoices_without_connection` (с полем `count`), `kaspi_snapshot_stale`.

> **Разница не вычисляется.** Итог смены в кассе — единая сумма: продажи наличными и продажи мимо ApiPay в ней не выделены. Полей `verdict`, `comparable` и `delta` в ответе нет — выводы делает человек, глядя на обе цифры и причины.

## Настройки кассы

| Эндпоинт | Что делает |
|----------|------------|
| `GET /cashbox/settings` | Сохранённые значения тумблеров |
| `PUT /cashbox/settings/auto-close` | Автозакрытие смены |
| `PUT /cashbox/settings/auto-withdrawal` | Автоизъятие наличных при закрытии смены |

```bash
curl -X PUT https://api.apipay.kz/api/v1/cashbox/settings/auto-close \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "enabled": true }'
```

```json
{ "changed": true, "new_value": true }
```

Запрос идемпотентен по живому значению на кассе: `changed: false` означает, что там уже стояло запрошенное значение, — такой вызов безопасно повторять при каждом запуске скрипта.

`GET /cashbox/settings` может вернуть `null` — это «сохранённого значения ещё нет», а не «выключено». Живое состояние приходит в других ответах: автозакрытие — в `GET /cashbox/shifts`, автоизъятие — в `GET /cashbox/summary`.

Настройки кассы доступны по API-ключу организации, а в кабинете — только владельцу.

## Вебхуки

| Событие | Когда приходит |
|---------|----------------|
| `cashbox.shift_closed` | Смена закрыта |
| `cashbox.shift_close_failed` | Закрытие не удалось, причина в `operation.error_code` |

```json
{
  "event": "cashbox.shift_closed",
  "operation": {
    "id": 812,
    "operation_type": "close_shift",
    "status": "completed",
    "shift_number": 106,
    "error_code": null
  },
  "timestamp": "2026-08-10T16:25:43+00:00"
}
```

Дедуплицируйте по паре `event` + `operation.id`. Подпись и общие правила доставки — в разделе [Вебхуки](webhooks.md).

## Коды ошибок

| Код | HTTP | Что делать |
|-----|------|------------|
| `cashbox_disabled` | 403 | Кассовые операции для организации сейчас недоступны |
| `cashbox_kkm_unknown` | 409 | К аккаунту Kaspi Pay не подключена касса Kaspi (ОФД) — смен у организации нет |
| `cashbox_shift_not_found` | 404 | Сначала вызвать `GET /cashbox/shifts` |
| `cashbox_no_open_shift` | — (в `operation.error_code`) | Открытой смены нет, закрывать нечего |
| `cashbox_duplicate_operation` | 409 | Операция с таким `client_operation_id` уже принята |
| `cashbox_busy` | — (в `operation.error_code`) | Касса занята другой операцией — повторить закрытие новым `client_operation_id` |
| `cashbox_operation_failed` | — | Kaspi не выполнил операцию; см. `resolution.safe_to_retry` |
| `cashbox_unavailable` | 503 | Касса Kaspi временно недоступна, повторить позже |
| `cashbox_report_unavailable` | 503 | Отчёт сейчас недоступен, повторить позже |
| `cashbox_toggle_in_progress` | 503 | Настройку меняет другой запрос |
| `cashbox_toggle_unavailable` | 503 | Изменение не применено, повторить позже |

Полный справочник — в разделе [Ошибки](errors.md).
