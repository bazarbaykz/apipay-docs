# cURL

Минимальный сценарий: выставить счёт и узнать, оплачен ли он.

## Подготовка

Ключ берётся в кабинете: Настройки → Подключение. Держите его в переменной окружения, чтобы не вставлять в команды руками:

```bash
export APIPAY_API_KEY="your_api_key"
```

Base URL — `https://api.apipay.kz/api/v1`, аутентификация — заголовок `X-API-Key`.

## Создание счёта

```bash
curl -X POST https://api.apipay.kz/api/v1/invoices \
  -H "X-API-Key: $APIPAY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 10000,
    "phone_number": "87001234567",
    "description": "Заказ №123",
    "external_order_id": "order_123"
  }'
```

Ответ:

```json
{
  "id": 124,
  "amount": "10000.00",
  "status": "processing",
  "phone": "87001234567",
  "created_at": "2026-01-15T10:00:00+00:00"
}
```

`id` из ответа — идентификатор счёта в ApiPay, по нему смотрят статус и делают возврат.

## Проверка статуса

```bash
curl https://api.apipay.kz/api/v1/invoices/124 \
  -H "X-API-Key: $APIPAY_API_KEY"
```

## Про `processing` и вебхуки

Счёт создаётся в статусе `processing` — это значит «принят и ждёт отправки в Kaspi», а не «оплачен». Дальше он сам перейдёт в `pending` (уведомление ушло клиенту) и затем в `paid`, `expired` или `cancelled`. Полный список — [Статусы счетов](../invoices.md#статусы-счетов).

Узнавать об оплате лучше вебхуком `invoice.status_changed`, а не опросом `GET /invoices/{id}` в цикле: вебхук приходит сразу после изменения статуса, поллинг же тратит лимит запросов и всё равно отстаёт. Оставьте поллинг как запасной путь — например, если вебхук не дошёл или вы ещё не настроили приёмник. Настройка и проверка подписи — [Вебхуки](../webhooks.md).

## Касса: отчёт по смене

```bash
# Шаг 1 — найти смену (обе границы обязательны, окно <= 31 дня).
curl "https://api.apipay.kz/api/v1/cashbox/shifts?date_from=2026-08-09&date_to=2026-08-09" \
  -H "X-API-Key: $APIPAY_API_KEY"

# Шаг 2 — получить временную ссылку на PDF и сразу скачать файл.
curl "https://api.apipay.kz/api/v1/cashbox/shifts/118275707/report" \
  -H "X-API-Key: $APIPAY_API_KEY"
```

Ссылка из ответа живёт около 15 минут — храните файл, а не ссылку. Сверка по той же смене:
`GET /cashbox/reconciliation?shift_id=118275707`; она требует, чтобы список смен был запрошен
заранее. Подробности — [Касса](../cashbox.md).

## Каталог: полная синхронизация из 1С

```bash
# Шаг 1 — залейте актуальный каталог (1–100 позиций за запрос).
curl -X POST "https://api.apipay.kz/api/v1/catalog" \
  -H "X-API-Key: $APIPAY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {"name": "Кофе латте", "selling_price": 1500, "unit_id": 1, "external_ref": "SKU-LATTE"}
    ]
  }'

# Шаг 2 — разведка по чанку: сколько позиций из вашего списка уйдёт под удаление.
#          Ровно один список — ids[] ЛИБО external_refs[], не больше 200 значений.
curl -X POST "https://api.apipay.kz/api/v1/catalog/bulk-delete" \
  -H "X-API-Key: $APIPAY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"external_refs": ["SKU-OLD-1", "SKU-OLD-2"], "dry_run": true}'

# Шаг 3 — подтверждение с числом из разведки и УНИКАЛЬНЫМ ключом на чанк.
curl -X POST "https://api.apipay.kz/api/v1/catalog/bulk-delete" \
  -H "X-API-Key: $APIPAY_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: catalog-sync-2026-08-26-chunk-01" \
  -d '{"external_refs": ["SKU-OLD-1", "SKU-OLD-2"], "expected_count": 2}'

# Шаг 4 — исход: остаток очереди и отказы.
curl "https://api.apipay.kz/api/v1/catalog/queue" -H "X-API-Key: $APIPAY_API_KEY"
curl "https://api.apipay.kz/api/v1/catalog/errors?from=2026-08-26" -H "X-API-Key: $APIPAY_API_KEY"
```

Список снятия строит интегратор: режима «удали всё, чего не было в моей заливке» нет.
Ключ должен быть выпущен **владельцем** организации, иначе придёт `403 catalog_delete_owner_key_required`.
Ответ `202` означает «принято в работу», а не «удалено»: снятие идёт фоном и на большом каталоге
занимает сутки с небольшим. Общего хендла у операции нет — исход смотрите в `GET /catalog/queue`,
`GET /catalog/errors` и точечным `GET /catalog?external_refs[]=`; итог каждой позиции присылает
вебхук `catalog.item_processed`.
Подробности и коды отказов — [Каталог → Массовое удаление](../catalog.md#массовое-удаление).

## Больше примеров

Готовый скрипт со всеми операциями (счета, возвраты, каталог, подписки) — [`examples/curl/`](https://github.com/bazarbaykz/apipay-docs/tree/main/examples/curl).
