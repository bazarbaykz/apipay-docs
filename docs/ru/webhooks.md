# Webhooks

Webhooks доставляют уведомления в реальном времени при возникновении платёжных событий.

## Настройка

Настройте webhooks в [Личном кабинете ApiPay.kz](https://apipay.kz) → Настройки → Подключение:

1. Нажмите **Добавить Webhook**
2. Введите URL вашего webhook
3. Сохраните и скопируйте **secret** (показывается только один раз!)

**Требования к URL:** публичный HTTPS-адрес без вашей авторизации; приватные IP и localhost отклоняются (422). Для ещё не одобренных организаций в рабочем режиме адрес должен быть на **реальном домене**: IP → `422 webhook_url_requires_domain`, туннели (ngrok и подобные) → `422 webhook_url_tunnel_forbidden` (туннель временный и отключится — уведомления перестанут приходить). В песочнице туннель для локального теста допустим. Ограничение снимается после одобрения анкеты о бизнесе (см. [Начало работы → Верификация бизнеса](getting-started.md)).

> **Все даты в вебхуках — в UTC** (ISO 8601, `+00:00`).

## События

ApiPay отправляет 23 типа событий:

| Событие | Описание |
|---------|----------|
| `invoice.status_changed` | Изменился статус счёта |
| `invoice.qr_scanned` | Клиент отсканировал QR (status остаётся `pending`, `qr_substate=scanned`) |
| `invoice.refunded` | Прошёл (или не прошёл) возврат по счёту |
| `qr_refund.identified` | Покупатель отсканировал возвратный QR (сессия → `customer_identified`) |
| `qr_refund.completed` | Возврат по ссылке покупателю выполнен (`refunded_amount`, `receipt_url`) |
| `qr_refund.expired` | Ссылка исчерпана без возврата: истёк срок, ссылка отозвана или пропущено последнее окно скана. У ссылки под счёт бывает и после `qr_refund.identified`, если возврат не успел провестись. Деньги не двигались — нужна новая ссылка |
| `qr_refund.failed` | Возврат по ссылке не состоялся, деньги не двигались. Причина — в `error_code`; у ссылки под счёт бывает и после `qr_refund.identified` (например, `refund_insufficient_funds`) |
| `qr_refund.execution_uncertain` | Исход возврата по ссылке не доказан: деньги могли уйти. Не повторяйте возврат ни запросом, ни новой ссылкой, ни вручную в приложении Kaspi Pay — разбор вручную через поддержку |
| `catalog.item_processed` | Операция над позицией каталога закрыта. Приходит **по каждой позиции, всегда** — агрегата пакетной операции больше нет |
| `receipt.issued` | Фискальный чек успешно выбит (Kaspi OFD) |
| `receipt.failed` | Выбить фискальный чек не удалось |
| `subscription.created` | Создана подписка |
| `subscription.payment_succeeded` | Оплачен очередной счёт подписки |
| `subscription.payment_failed` | Счёт подписки не оплачен |
| `subscription.grace_period_started` | Подписка вошла в льготный период |
| `subscription.expired` | Подписка истекла |
| `subscription.paused` | Подписка приостановлена |
| `subscription.resumed` | Подписка возобновлена |
| `subscription.period_skipped` | Период подписки пропущен без оплаты |
| `subscription.cancelled` | Подписка отменена |
| `cashbox.shift_closed` | Кассовая смена закрыта |
| `cashbox.shift_close_failed` | Закрыть кассовую смену не удалось (`error_code`) |
| `webhook.test` | Тестовое событие из личного кабинета |

> Полные payload'ы событий `qr_refund.*` — в `openapi.yaml`, раздел `x-webhooks`. Как выпускать ссылку покупателю и что делать с каждым событием — [Возвраты → Запасной путь](refunds.md#запасной-путь-ссылка-покупателю).

> ⛔ Событие `catalog.batch_processed` **не отправляется никогда**: агрегат пакетных операций с каталогом убран. Адрес и подпись прежние — просто тишина, по ошибке об этом не узнать. Если вы ждали этот вебхук как признак «заливка завершена», переходите на `catalog.item_processed` и собственный список `external_ref`.

### invoice.status_changed

Отправляется при изменении статуса счёта.

```json
{
  "event": "invoice.status_changed",
  "is_sandbox": false,
  "invoice": {
    "id": 42,
    "external_order_id": "order_123",
    "amount": "15000.00",
    "subtotal": "16500.00",
    "discount_sum": "1500.00",
    "discount_percentage": "10",
    "status": "paid",
    "description": "Оплата заказа",
    "kaspi_invoice_id": "13234689513",
    "client_name": "Иван Иванов",
    "client_phone": "87071234567",
    "is_sandbox": false,
    "kaspi_source_type": "GOLD",
    "kaspi_sale_type": "Remote",
    "paid_at": "2026-02-12T14:35:00+00:00"
  },
  "source": "My API Key",
  "timestamp": "2026-02-12T14:35:01+00:00"
}
```

> **Примечание:** Поля `subtotal`, `discount_sum` и `discount_percentage` появляются только при наличии скидки в счёте. Поле `is_sandbox` в корне подписанного тела есть у каждого события и показывает, создан ли объект события в песочнице; вложенный `is_sandbox` (здесь — у `invoice`) с ним совпадает. Корневой `is_sandbox` относится к объекту события, а не к текущему режиму организации: свой режим ваша система знает сама. Как обрабатывать песочные события в рабочем режиме — в разделе «Требования к ответу». Поля `kaspi_source_type` и `kaspi_sale_type` гейтятся по наличию значения от Kaspi (обрабатывайте как nullable). Рядом с `client_phone` приходит `phone` — тот же номер под именем из REST. У попытки оплаты по ссылке на оплату или печатному листу в `invoice` есть `static_qr_id` и его синоним `static_qr_code_id` — по ним заказ и находится (см. [Счета → Ссылка на оплату и печатный QR](invoices.md#ссылка-на-оплату-и-печатный-qr)). QR-полей (`is_qr_token`, `qr_token_url`, `qr_image_url`) в этом событии нет — они есть в `GET /invoices/{id}`.

#### Счёт не обработан (status: error)

```json
{
  "event": "invoice.status_changed",
  "is_sandbox": false,
  "invoice": {
    "id": 43,
    "external_order_id": "order_124",
    "amount": "15000.00",
    "status": "error",
    "description": "Оплата заказа",
    "kaspi_invoice_id": null,
    "client_name": null,
    "client_phone": "87071234567",
    "is_sandbox": false,
    "errored_at": "2026-02-12T14:40:00+00:00",
    "error_message": "Этот номер телефона не зарегистрирован в Kaspi. Укажите номер с установленным приложением Kaspi.",
    "error_code": "client_not_found"
  },
  "source": "My API Key",
  "timestamp": "2026-02-12T14:40:01+00:00"
}
```

#### Счёт истёк (status: expired)

```json
{
  "event": "invoice.status_changed",
  "is_sandbox": false,
  "invoice": {
    "id": 46,
    "external_order_id": "order_125",
    "amount": "15000.00",
    "status": "expired",
    "description": "Оплата заказа",
    "kaspi_invoice_id": "13234689515",
    "client_name": "Иван Иванов",
    "client_phone": "87071234567",
    "is_sandbox": false,
    "expired_at": "2026-02-13T14:35:00+00:00"
  },
  "source": "My API Key",
  "timestamp": "2026-02-13T14:35:01+00:00"
}
```

#### QR-счёт отменён клиентом (status: cancelled)

```json
{
  "event": "invoice.status_changed",
  "is_sandbox": false,
  "invoice": {
    "id": 44,
    "external_order_id": null,
    "amount": "15000.00",
    "status": "cancelled",
    "description": "QR на кассе",
    "kaspi_invoice_id": "13234689514",
    "client_name": null,
    "client_phone": null,
    "is_sandbox": false,
    "cancelled_at": "2026-02-12T14:45:00+00:00"
  },
  "source": "My API Key",
  "timestamp": "2026-02-12T14:45:01+00:00"
}
```

**Поля payload**

| Поле | Тип | Описание |
|------|-----|----------|
| `invoice.status` | string | Статус счёта: `pending` / `paid` / `cancelled` / `expired` / `error` / `partially_refunded`. Статуса `refunded` не существует — полный возврат оставляет `paid` + `is_fully_refunded=true`. |
| `invoice.kaspi_invoice_id` | string \| null | ID счёта в Kaspi. Появляется уже при `pending` (когда счёт создан в Kaspi); `null` — пока счёт не дошёл до Kaspi. |
| `invoice.paid_at` | string \| null | Время оплаты (ISO 8601). Поле **отсутствует** во всех статусах, кроме `paid` (а не `null` до оплаты). |
| `invoice.cancelled_at` / `expired_at` / `errored_at` | string \| null | Время перехода в соответствующий статус (ISO 8601). Присутствует только при этом статусе. |
| `invoice.error_message` | string \| null | Человекочитаемая причина. При `status=error` присутствует всегда; при `status=cancelled` — только если заполнена (обычно отсутствует при отмене клиентом или через API). В статусах `paid`/`pending`/`expired` отсутствует. |
| `invoice.error_code` | string \| null | Стабильный snake_case-код из каталога (см. [Коды ошибок](errors.md)). Присутствует только если не `null` и только при `status=error`/`cancelled`. Стройте логику по нему, а не по тексту. |
| `invoice.subtotal` / `discount_sum` / `discount_percentage` | string \| null | Только для счетов с корзиной/скидкой (`subtotal` и `discount_sum` приходят вместе). |
| `invoice.kaspi_source_type` | string \| null | Источник средств клиента: `GOLD`, `RED`, `LOAN`, `BUSINESSACCOUNT`, `BANKINTEGRATIONACCOUNT`. Гейтится по наличию значения от Kaspi; список может расширяться. |
| `invoice.kaspi_sale_type` | string \| null | Способ приёма счёта: `Remote`, `QR`, `Restaurant`, `Static`. Гейтится по наличию значения от Kaspi; список может расширяться. |
| `invoice.static_qr_id` / `static_qr_code_id` | integer | Ссылка на оплату или печатный лист, попыткой которого является счёт. Только у таких счетов. |
| `invoice.phone` | string \| null | Синоним `client_phone` (имя из REST). |

### invoice.qr_scanned

Только для QR-счетов. Отправляется, когда клиент отсканировал QR и оказался на экране оплаты в приложении Kaspi. Это **суб-состояние**: статус счёта остаётся `pending`, а маркер `qr_substate: "scanned"` показывает, что покупатель уже на шаге оплаты. Шлётся ровно **один раз** на QR и транзиентно — следом приходит терминальный вебхук (`paid` или `cancelled`). Подпись проверяется так же, как у остальных событий.

```json
{
  "event": "invoice.qr_scanned",
  "is_sandbox": false,
  "invoice": {
    "id": 63474,
    "external_order_id": "order-123",
    "amount": "5000.00",
    "status": "pending",
    "qr_substate": "scanned",
    "description": "Заказ №123",
    "kaspi_invoice_id": "13234689514",
    "client_name": null,
    "client_phone": null,
    "is_sandbox": false
  },
  "source": "My API Key",
  "timestamp": "2026-06-14T10:00:00+00:00"
}
```

**Поля payload**

| Поле | Тип | Описание |
|------|-----|----------|
| `invoice.status` | string | Всегда `pending` — это суб-состояние, а не смена статуса. Терминальный статус придёт отдельным `invoice.status_changed`. |
| `invoice.qr_substate` | string | `scanned` — клиент отсканировал QR и находится на экране оплаты. |
| `invoice.kaspi_invoice_id` | string \| null | ID счёта в Kaspi. |
| `invoice.client_name` / `client_phone` | null | На этапе сканирования данные клиента ещё неизвестны. |

> Используйте событие как сигнал «покупатель приступил к оплате» (например, обновить UI кассы). Не считайте счёт оплаченным — дождитесь `paid`. Событие транзиентно и может не прийти, если клиент оплатил мгновенно.

### invoice.refunded

Отправляется при возврате по счёту — как при успешном (`completed`), так и при неудачном (`failed`).

```json
{
  "event": "invoice.refunded",
  "is_sandbox": false,
  "refund": {
    "id": 5,
    "amount": "2000.00",
    "status": "completed",
    "kaspi_refund_id": "1126827352",
    "reason": "Возврат товара",
    "created_at": "2026-02-12T10:00:00+00:00",
    "items": [
      {"catalog_item_id": 12, "name": "Кофе", "price": "1000.00", "count": 2, "amount": "2000.00"}
    ]
  },
  "invoice": {
    "id": 42,
    "external_order_id": "order_123",
    "amount": "5000.00",
    "subtotal": "5500.00",
    "discount_sum": "500.00",
    "total_refunded": "2000.00",
    "available_for_refund": 3000,
    "is_fully_refunded": false,
    "is_sandbox": false,
    "status": "paid",
    "kaspi_invoice_id": "13234689513"
  },
  "source": "My API Key",
  "timestamp": "2026-02-12T10:00:01+00:00"
}
```

#### Возврат не удался (refund.status: failed)

```json
{
  "event": "invoice.refunded",
  "is_sandbox": false,
  "refund": {
    "id": 6,
    "amount": "2000.00",
    "status": "failed",
    "kaspi_refund_id": null,
    "reason": "Возврат товара",
    "created_at": "2026-02-12T10:00:00+00:00",
    "error_code": "refund_window_expired"
  },
  "invoice": {
    "id": 42,
    "external_order_id": "order_123",
    "amount": "5000.00",
    "total_refunded": "0.00",
    "available_for_refund": 5000,
    "is_fully_refunded": false,
    "is_sandbox": false,
    "status": "paid",
    "kaspi_invoice_id": "13234689513"
  },
  "source": "My API Key",
  "timestamp": "2026-02-12T10:00:01+00:00"
}
```

**Поля payload**

| Поле | Тип | Описание |
|------|-----|----------|
| `refund.status` | string | `pending` / `processing` / `completed` / `failed`. Вебхук приходит и на `completed`, и на `failed`. |
| `refund.kaspi_refund_id` | string \| null | ID возврата в Kaspi; `null` при неудаче. |
| `refund.error_code` | string \| null | Только при `status=failed`. `refund_requires_buyer_confirmation` и `refund_rejected_by_kaspi` — сигнал запасного пути: выпустите ссылку покупателю с `source_refund_id` этого возврата (см. [Возвраты](refunds.md#запасной-путь-ссылка-покупателю)). Поля `error_message` в вебхуке нет by design — текст смотрите в `GET /invoices/{id}/refunds` или резолвите код по каталогу. |
| `refund.items` | array \| null | Позиции возврата (только для позиционных возвратов): `catalog_item_id`, `name`, `price`, `count`, `amount`. |
| `invoice.available_for_refund` | number | Сумма, ещё доступная для возврата. Приходит числом (float), в отличие от `amount` и `total_refunded` (строки). |
| `invoice.status` | string | Статус счёта после возврата. Полный возврат статус **НЕ меняет** (остаётся `paid` — или `partially_refunded`, если ранее был частичный) + `is_fully_refunded=true`; первый частичный переводит в `partially_refunded` (и дополнительно приходит `invoice.status_changed`). |

> ⚠️ После `qr_refund.completed` может прийти `invoice.refunded` со `status: completed` и **незнакомым** `refund.id` — строка, которую синхронизация завела по операции, проведённой ссылкой покупателю. Это та же сумма, а не второй возврат: у исходного возврата в `GET /invoices/{id}/refunds` будет `successor_refund_id`, равный этому id. Разбор неизвестного исхода «деньги ушли» (`refund_resolved_executed`) вебхука по исходному возврату не шлёт.

### catalog.item_processed

Отправляется, когда операция над позицией каталога закрыта — создание, правка или снятие, успешно или с отказом.

> ⚠️ **Событие приходит по каждой позиции, всегда.** Агрегата пакетной операции больше нет: заливка 50 позиций даёт **до 50 доставок** вместо одной. Приёмник должен это выдержать.

```json
{
  "event": "catalog.item_processed",
  "is_sandbox": false,
  "catalog_item": {
    "id": 12345,
    "external_ref": "1C-000123",
    "kaspi_item_id": "MP-000000",
    "name": "Кофе зерновой 1 кг",
    "barcode": "4870000000001",
    "ntin": "00000000000001",
    "gtin": null,
    "ntin_missing": false,
    "status": "active",
    "sellable": true,
    "in_kaspi_catalog": true,
    "operation": null,
    "error_code": null,
    "error_message": null,
    "failed_at": null
  },
  "timestamp": "2026-08-26T14:37:00+00:00"
}
```

**Поля payload**

| Поле | Тип | Описание |
|------|-----|----------|
| `catalog_item.external_ref` | string \| null | Ваша ссылка на позицию (например код номенклатуры 1С) — ключ сверки. |
| `catalog_item.status` | string | Тот же производный статус и тот же словарь, что у `GET /catalog`: `active`, `pending`, `deleting`, `deleted`, `failed`. Значения в push и в листинге совпадают всегда. |
| `catalog_item.operation` | string \| null | Что именно происходило с позицией: `create`, `update`, `delete`. `null` после успешного завершения; при отказе значение сохраняется. |
| `catalog_item.sellable` | boolean | Примут ли позицию в корзину счёта, QR или подписки. |
| `catalog_item.in_kaspi_catalog` | boolean | Есть ли у позиции боевая идентичность номенклатуры Kaspi. В песочнице всегда `false`. |
| `catalog_item.error_code` | string \| null | Код отказа операции. |
| `catalog_item.failed_at` | string \| null | Момент отказа (ISO 8601). |
| `catalog_item.ntin_missing` | boolean | `true` — у позиции есть штрихкод, но нет НТИН: в фискальный чек она не попадёт как маркированная. |

Подробнее про статусы, ось `operation` и флаги — [Каталог](catalog.md#статусы-товара).

Признак «пакетная работа закончена» считайте у себя по своему списку `external_ref`. Остаток очереди и отказы дополнительно видны в `GET /catalog/queue` и `GET /catalog/errors`.

### receipt.issued

Отправляется, когда фискальный чек успешно выбит в Kaspi OFD (после `POST /receipts`). Равноправен поллингу `GET /receipts/{id}`. Если вебхуки чеков вам не приходят, используйте поллинг — результат тот же. Подробнее о фиче — [Фискальные чеки](receipts.md).

```json
{
  "event": "receipt.issued",
  "is_sandbox": false,
  "receipt": {
    "id": 4210,
    "client_operation_id": "pos-2026-07-12-0042",
    "payment_type": 3,
    "status": "issued",
    "fpd": "000000000000",
    "operation_id": "KKM00000000",
    "link": "https://receipt.kaspi.kz/preview/cashier?extTranId=KKM00000000",
    "shift_number": 106,
    "total_price": "10.00",
    "error_code": null,
    "error_message": null
  },
  "timestamp": "2026-07-12T16:25:43+00:00"
}
```

### receipt.failed

Отправляется, когда выбить фискальный чек не удалось. Причина — в `receipt.error_code`: `shift_closed` — смена закрыта; `item_not_fiscal` — позиция без НТИН; `rfo_missing`; `kaspi_session_invalid` — сессия кассира недействительна, переподключите кассира; `kaspi_session_not_configured`; `fiscal_receipts_disabled`; `receipt_ofd_token_revoked` — отозвана фискальная привязка кассы к ОФД, мерчанту нужно перепривязать её в приложении Kaspi; `receipt_kaspi_error`; `receipt_dispatch_error`. Фискальный документ **не** создан — повторите с **тем же** `client_operation_id`: после `failed` прежний ключ освобождается. При `shift_closed` сначала откройте смену в Kaspi Pos.

```json
{
  "event": "receipt.failed",
  "is_sandbox": false,
  "receipt": {
    "id": 4210,
    "client_operation_id": "pos-2026-07-12-0042",
    "payment_type": 3,
    "status": "failed",
    "fpd": null,
    "operation_id": null,
    "link": null,
    "shift_number": null,
    "total_price": "10.00",
    "error_code": "shift_closed",
    "error_message": "Смена не открыта"
  },
  "timestamp": "2026-07-12T16:25:43+00:00"
}
```

**Поля payload**

| Поле | Тип | Описание |
|------|-----|----------|
| `receipt.status` | string | `issued` (успех) или `failed` (неудача). |
| `receipt.fpd` | string \| null | Фискальный признак документа. Заполнен при `issued`, `null` при `failed`. |
| `receipt.operation_id` | string \| null | ID операции в Kaspi. Заполнен при `issued`. |
| `receipt.link` | string \| null | Ссылка на чек на `receipt.kaspi.kz`. Заполнена при `issued`. |
| `receipt.shift_number` | integer \| null | Номер смены. Заполнен при `issued`. |
| `receipt.error_code` | string \| null | Только при `status=failed` — стабильный код из каталога (см. [Коды ошибок](errors.md)). Стройте логику по нему. |

> Дедуп по `(event, receipt.id)`: после сбоя вашего сервера (5xx, 429, сеть) уведомление о чеке повторяется автоматически, поэтому одно событие `receipt.*` может прийти дважды. Все даты — в UTC (`+00:00`).

### subscription.created

Отправляется при создании подписки.

```json
{
  "event": "subscription.created",
  "is_sandbox": false,
  "subscription": {
    "id": 10,
    "external_subscriber_id": "CLIENT-001",
    "phone_number": "87071234567",
    "subscriber_name": "Иван Иванов",
    "amount": "5000.00",
    "billing_period": "monthly",
    "status": "active",
    "next_billing_at": "2026-03-01T08:00:00+00:00",
    "failed_attempts": 0,
    "in_grace_period": false,
    "is_sandbox": false
  },
  "source": "My API Key",
  "timestamp": "2026-02-01T12:00:01+00:00"
}
```

Первый счёт будет выставлен в `next_billing_at` (или сразу, если при создании передан `bill_immediately`).

### subscription.payment_succeeded

Отправляется при успешном платеже по подписке.

```json
{
  "event": "subscription.payment_succeeded",
  "is_sandbox": false,
  "subscription": {
    "id": 10,
    "external_subscriber_id": "CLIENT-001",
    "phone_number": "87071234567",
    "subscriber_name": "Иван Иванов",
    "amount": "5000.00",
    "billing_period": "monthly",
    "status": "active",
    "next_billing_at": "2026-03-01T08:00:00+00:00",
    "failed_attempts": 0,
    "in_grace_period": false,
    "is_sandbox": false
  },
  "invoice_id": 200,
  "amount": "5000.00",
  "paid_at": "2026-02-01T12:00:00+00:00",
  "source": "My API Key",
  "timestamp": "2026-02-01T12:00:01+00:00"
}
```

### subscription.payment_failed

Отправляется при неудачном платеже по подписке.

```json
{
  "event": "subscription.payment_failed",
  "is_sandbox": false,
  "subscription": {
    "id": 10,
    "phone_number": "87071234567",
    "amount": "5000.00",
    "billing_period": "monthly",
    "status": "active",
    "failed_attempts": 2,
    "in_grace_period": false,
    "is_sandbox": false
  },
  "invoice_id": 201,
  "amount": "5000.00",
  "reason": "Invoice expired",
  "attempt_number": 2,
  "source": "My API Key",
  "timestamp": "2026-02-02T12:00:01+00:00"
}
```

> Счёт система перевыставляет **сама** — ничего пересоздавать не нужно, просто уведомите клиента (`attempt_number`, `reason`). При `bill_until_paid: false` повтор идёт, пока `attempt_number` меньше `max_retry_attempts` (по умолчанию 3), с интервалом `retry_interval_hours` (по умолчанию 24 ч). При `bill_until_paid: true` истёкший счёт перевыставляется до момента следующего планового списания, а после отмены или ошибки счёта (кроме ошибки на стороне сервиса) следующий придёт в следующем периоде. Счёт подписки в статусе `error` тоже даёт это событие, код — в `error_code`. Исключение: у подписки с `bill_until_paid: true` и `error_code = client_not_found` вместо него приходит `subscription.cancelled` с `reason: payer_error`.

### subscription.grace_period_started

Отправляется когда подписка входит в льготный период после неудачных попыток.

```json
{
  "event": "subscription.grace_period_started",
  "is_sandbox": false,
  "subscription": {
    "id": 10,
    "phone_number": "87071234567",
    "amount": "5000.00",
    "status": "active",
    "failed_attempts": 3,
    "in_grace_period": true,
    "is_sandbox": false
  },
  "grace_period_days": 3,
  "expires_at": "2026-02-05T12:00:00+00:00",
  "source": "My API Key",
  "timestamp": "2026-02-02T12:00:01+00:00"
}
```

Подписка ещё активна `grace_period_days` дней (по умолчанию 3). Любая успешная оплата снимает льготный период. У подписки с `bill_until_paid: true` это событие не приходит.

### subscription.expired

Отправляется когда подписка истекает после всех неудачных повторов.

```json
{
  "event": "subscription.expired",
  "is_sandbox": false,
  "subscription": {
    "id": 10,
    "phone_number": "87071234567",
    "amount": "5000.00",
    "status": "expired",
    "next_billing_at": null,
    "failed_attempts": 3,
    "in_grace_period": false,
    "is_sandbox": false
  },
  "source": "My API Key",
  "timestamp": "2026-02-05T12:00:01+00:00"
}
```

Биллинг по подписке остановлен. Подписку, истёкшую по окончании льготного периода, можно возобновить: `POST /subscriptions/{id}/resume`. Подписку, получившую все оплаты `total_cycles`, возобновить нельзя — создайте новую.

### subscription.paused

Отправляется при приостановке подписки (`POST /subscriptions/{id}/pause`).

```json
{
  "event": "subscription.paused",
  "is_sandbox": false,
  "subscription": {
    "id": 10,
    "external_subscriber_id": "CLIENT-001",
    "phone_number": "87071234567",
    "subscriber_name": "Иван Иванов",
    "amount": "5000.00",
    "billing_period": "monthly",
    "status": "paused",
    "next_billing_at": "2026-03-01T08:00:00+00:00",
    "failed_attempts": 0,
    "in_grace_period": false,
    "is_sandbox": false
  },
  "source": "My API Key",
  "timestamp": "2026-02-10T09:00:00+00:00"
}
```

Счета не выставляются до возобновления.

### subscription.resumed

Отправляется при возобновлении подписки.

```json
{
  "event": "subscription.resumed",
  "is_sandbox": false,
  "subscription": {
    "id": 10,
    "external_subscriber_id": "CLIENT-001",
    "phone_number": "87071234567",
    "subscriber_name": "Иван Иванов",
    "amount": "5000.00",
    "billing_period": "monthly",
    "status": "active",
    "next_billing_at": "2026-03-15T09:30:00+00:00",
    "failed_attempts": 0,
    "in_grace_period": false,
    "is_sandbox": false
  },
  "source": "My API Key",
  "timestamp": "2026-02-15T09:30:00+00:00"
}
```

`next_billing_at` пересчитан от момента возобновления — пропущенные периоды не доначисляются.

### subscription.period_skipped

Отправляется, когда продавец пропустил период подписки без оплаты — через `POST /subscriptions/{id}/skip-period` или в кабинете ApiPay. Причину пропуска событие не несёт.

```json
{
  "event": "subscription.period_skipped",
  "is_sandbox": false,
  "subscription": {
    "id": 10,
    "external_subscriber_id": "CLIENT-001",
    "phone_number": "87071234567",
    "subscriber_name": "Иван Иванов",
    "amount": "5000.00",
    "billing_period": "monthly",
    "status": "active",
    "next_billing_at": "2026-04-01T08:00:00+00:00",
    "failed_attempts": 0,
    "in_grace_period": false,
    "is_sandbox": false
  },
  "billing_period_start": "2026-03-01",
  "billing_period_end": "2026-03-31",
  "cancelled_invoice_id": 202,
  "source": "My API Key",
  "timestamp": "2026-03-02T09:00:00+00:00"
}
```

Доп. поля в корне payload: `billing_period_start` и `billing_period_end` — границы пропущенного периода, `cancelled_invoice_id` — счёт периода, отмену которого запросил пропуск (`null`, если счёт ещё не выставлялся). Подписка остаётся активной, следующий период выставляется по расписанию; в истории платежей у периода статус `skipped`.

Итог отмены счёта приходит отдельным `invoice.status_changed`. Если Kaspi отмену не примет, счёт вернётся в `pending` без вебхука и останется доступен покупателю. Если покупатель оплатит этот счёт, период засчитывается оплаченным: придёт `subscription.payment_succeeded` с `invoice_id`, равным `cancelled_invoice_id`. События могут прийти в любом порядке — итог периода `paid`. Если покупатель уже рассчитался с вами другим способом, лишнюю оплату верните сами через `POST /invoices/{id}/refund`.

Дедуп по `(event, subscription.id, billing_period_start)`: у пропущенного периода счёта может не быть.

### subscription.cancelled

Отправляется при отмене подписки.

```json
{
  "event": "subscription.cancelled",
  "is_sandbox": false,
  "subscription": {
    "id": 10,
    "external_subscriber_id": "CLIENT-001",
    "phone_number": "87071234567",
    "subscriber_name": "Иван Иванов",
    "amount": "5000.00",
    "billing_period": "monthly",
    "status": "cancelled",
    "next_billing_at": "2026-03-01T08:00:00+00:00",
    "failed_attempts": 0,
    "in_grace_period": false,
    "is_sandbox": false
  },
  "source": "My API Key",
  "timestamp": "2026-02-20T18:00:00+00:00"
}
```

Подписка отменена безвозвратно: `next_billing_at` сохраняет последнее значение, счета больше не выставляются. Для возобновления создайте новую подписку.

Отмена приходит и без вашего запроса: если плательщик отклонил счёт в Kaspi, подписка отменяется сразу, и в корне payload приходят `reason: payer_refused` и `invoice_id`. Нехватка средств у плательщика отказом не считается: без `bill_until_paid: true` идут обычные повторы, с ним период закрывается без повтора.

У подписки с `bill_until_paid: true` отмена приходит и тогда, когда счёт упал с `error_code = client_not_found` (номер не зарегистрирован в Kaspi): в корне payload — `reason: payer_error`, `invoice_id` и `error_code`.

### webhook.test

Отправляется кнопкой «Проверить уведомления» в карточке ключа в личном кабинете или запросом `POST /webhook-test` вашим ключом — синхронно, одной попыткой, с исходом в ответе. Фиктивный счёт со `status=test` — receiver должен спокойно его игнорировать.

```json
{
  "event": "webhook.test",
  "is_sandbox": true,
  "invoice": {
    "id": null,
    "external_order_id": "TEST-ORDER-123",
    "amount": "1000.00",
    "status": "test",
    "description": "Test webhook notification",
    "kaspi_invoice_id": null,
    "client_name": "Test Client",
    "client_phone": "87771234567",
    "is_sandbox": true,
    "kaspi_source_type": "GOLD",
    "kaspi_sale_type": "Remote"
  },
  "source": "My API Key",
  "timestamp": "2026-01-15T10:00:00+00:00"
}
```

У `webhook.test` корневой `is_sandbox` всегда `true`: обработчик в рабочем режиме отбросит его с ответом `2xx`, и проверка пройдёт. Проверяйте подпись до отбрасывания песочных событий — тогда успешная проверка подтверждает и верный секрет.

`POST /webhook-test` принимает `signature`: `valid` (по умолчанию), `invalid` (подпись чужим секретом) или `missing` (без `X-Webhook-Signature`). Две последние проверяют, что обработчик **отказывает** поддельному и неподписанному телу, и работают только в песочнице (у боевой организации — `403 not_sandbox`). Успешная проверка также снимает отключение отправки (см. «Пауза отправки»).

## Когда приходит вебхук

Этот раздел перечисляет события, при которых ApiPay шлёт вебхук, и в каком статусе он приходит. Технические статусы `processing`/`cancelling` вебхуков **не порождают**.

| Событие | Статус | Когда приходит |
|---------|--------|----------------|
| `invoice.status_changed` | `pending` | Счёт создан в Kaspi и ожидает оплату. Для счетов по номеру (`POST /invoices`) это первый вебхук после 201-ответа со `status=processing`. Для QR-счетов (`POST /invoices/qr`) `pending`-вебхук **не** отправляется — статус возвращается синхронно в 201-ответе; первый вебхук по QR-счёту — оплата, отмена, истечение или ошибка. |
| `invoice.qr_scanned` | `pending` | Только QR: клиент отсканировал QR (`qr_substate=scanned`). Статус остаётся `pending`, суб-состояние. Один раз, транзиентно — далее `paid` или `cancelled`. |
| `invoice.status_changed` | `paid` | Счёт оплачен. Может прийти и **после** `cancelled`/`expired` — оплата в последний момент выигрывает гонку (см. «Переходы статусов»). |
| `invoice.status_changed` | `cancelled` | Счёт отменён: клиентом (свернул/закрыл приложение), вами через API или кассиром. Новый QR на той же кассе старый **не** отменяет. |
| `invoice.status_changed` | `expired` | Счёт истёк: счёт по номеру — 24 часа в Kaspi; QR — минуты, только когда Kaspi отдал терминал (не по локальному таймеру). |
| `invoice.status_changed` | `error` | Техническая ошибка — счёт финализирован, система больше **не** повторяет попытки по этому счёту. Причина — в `error_code`/`error_message` (см. «Сценарии реагирования»). |
| `invoice.status_changed` | `partially_refunded` | Первый частичный возврат по счёту (дополнительно к `invoice.refunded`). Повторные частичные возвраты статус не меняют. |
| `invoice.refunded` | `completed` | Возврат проведён. Включает возвраты, сделанные кассиром в приложении Kaspi (импортируются автоматически). |
| `invoice.refunded` | `failed` | Возврат не удался (`refund.error_code`). Система сама **не** повторяет. При `refund_requires_buyer_confirmation` и `refund_rejected_by_kaspi` выпустите ссылку покупателю с `source_refund_id`; при `hold_for_buyer_confirmation: true` счёт держится за этим возвратом. |
| `receipt.issued` | — | Фискальный чек выбит в Kaspi OFD (после `POST /receipts`). Реквизиты — `fpd`/`operation_id`/`link`. Равноправен поллингу `GET /receipts/{id}`. Может прийти повторно. |
| `receipt.failed` | — | Чек не выбит (`receipt.error_code`). Фискальный документ не создан — повторите с тем же `client_operation_id` (при `shift_closed` сначала откройте смену в Kaspi Pos, при `receipt_ofd_token_revoked` — перепривяжите ОФД). |
| `subscription.created` | — | Подписка создана. Счета по подписке выставляет система автоматически в `next_billing_at` (или сразу при `bill_immediately`). По каждому счёту приходят обычные invoice-вебхуки. |
| `subscription.payment_succeeded` | — | Очередной счёт подписки оплачен. `failed_attempts` сброшен, льготный период (если был) снят. |
| `subscription.payment_failed` | — | Счёт подписки истёк, отменён или ушёл в `error` (`reason`, `error_code`). Система сама перевыставит счёт по правилам режима `bill_until_paid` — ничего пересоздавать не нужно. |
| `subscription.grace_period_started` | — | Все попытки исчерпаны; подписка ещё активна `grace_period_days` дней. Любая успешная оплата снимает льготный период. Не приходит при `bill_until_paid: true`. |
| `subscription.expired` | — | Биллинг остановлен: истёк льготный период либо исчерпаны оплаты `total_cycles` — во втором случае в корне payload приходят `reason: total_cycles_reached`, `cycles_paid` и `total_cycles`. Истёкшую по льготному периоду подписку можно возобновить (`POST /subscriptions/{id}/resume`); после `total_cycles` — только новая подписка. |
| `subscription.paused` | — | Подписка приостановлена. Счета не выставляются. |
| `subscription.resumed` | — | Подписка возобновлена; `next_billing_at` пересчитан от момента возобновления. |
| `subscription.period_skipped` | — | Продавец пропустил период без оплаты. Подписка остаётся активной; в корне payload — `billing_period_start`, `billing_period_end`, `cancelled_invoice_id`. Если счёт периода был выставлен, ApiPay запросил его отмену: итог придёт `invoice.status_changed`, а если Kaspi отмену не примет — вебхука не будет, счёт останется `pending`. |
| `subscription.cancelled` | — | Подписка отменена безвозвратно: вашим запросом либо явным отказом плательщика в Kaspi — во втором случае в корне payload приходят `reason: payer_refused` и `invoice_id`. У подписки с `bill_until_paid: true` — ещё и по `client_not_found`: `reason: payer_error`, `invoice_id`, `error_code`. |
| `webhook.test` | — | Ручной тест из ЛК. Фиктивный счёт со `status=test` — спокойно игнорируйте. |

## Переходы статусов

ApiPay не порождает повторных событий одного статуса: дубли подряд одного статуса, технические `processing`/`cancelling`, «протухший» `pending` после терминального статуса и `error` после `paid` — подавляются. Но доставка не гарантирована, и одно событие может прийти повторно; во время паузы отправки события счёта и возвратов не отправляются и потом не досылаются (см. [Пауза отправки](#пауза-отправки)). Дедуплицируйте по `(invoice.id, invoice.status)` и `(refund.id, refund.status)`, состояние сверяйте GET-методами. Отвечайте `200 OK` быстро (≤5 секунд), обрабатывайте асинхронно.

> ⚠️ После `error` может снова прийти `pending`, даже если `pending` по этому счёту уже приходил: это новый переход, а не дубль. Не отбрасывайте его — когда приходит `error`, снимите из таблицы обработанных событий ключ `pending` этого счёта, а когда приходит `pending` — ключ `error`: цепочка `error → pending → … → error` возможна. В песочнице этот переход тоже присылает вебхук, как в бою.

**Разрешённые переходы:**

| Из | В | Комментарий |
|----|---|-------------|
| `pending` | `paid` / `cancelled` / `expired` / `error` | обычный жизненный цикл |
| `cancelled` / `expired` | `paid` | оплата в последний момент выигрывает гонку — обработайте как «деньги получены»: отгрузите или сделайте возврат. Это не баг. |
| `error` | `pending` | реконсиляция: счёт на самом деле успел создаться в Kaspi — следуйте последнему статусу. Если по заказу уже выставлен новый счёт, отмените один из двух, иначе покупатель сможет оплатить оба |
| `paid` | `partially_refunded` | первый частичный возврат |

**Никогда не происходят:**

| Переход | Комментарий |
|---------|-------------|
| терминальный → `pending` | кроме `error → pending` (реконсиляция) |
| `paid → error` | подавляется как инцидент |
| `error → paid` | невозможен |

**Без вебхука:** ответ 202 на отмену переводит счёт в `cancelling` **без** вебхука; если Kaspi отказал в отмене (обычно счёт уже оплачен) — счёт тихо возвращается в `pending`, а реальный статус (обычно `paid`) доставит синхронизация в течение минут. После 202 не считайте счёт отменённым — ждите вебхук.

## Сценарии реагирования

Когда вебхук приносит `status=error` (счёт) или `status=failed` (возврат) — операция финализирована: система уже исчерпала собственные ретраи и больше **не** будет повторять её сама. «Повторить» всегда означает «создать новую операцию». Пока счёт в `processing` — система ретраит сама, вмешиваться не нужно (легитимный бэклог может держать счёт в `processing` больше часа при троттлинге Kaspi).

| Код ошибки | Что произошло | Что делает система | Что делать вам |
|-----------|---------------|--------------------|----------------|
| `client_not_found` | Номер телефона не зарегистрирован в Kaspi | Финализирует счёт сразу, без ретраев | Запросите у клиента другой номер и создайте новый счёт |
| `network_unavailable` | Сеть/Kaspi были недоступны | Ретраила сама; вебхук означает, что ретраи исчерпаны | Создайте новый счёт/возврат через 1–2 минуты |
| `session_transient` | Временный сбой сессии кассира | Автоматически инвалидировала сессию и ретраила | Создайте новый счёт позже; если повторяется — переподключите кассира в ЛК |
| `kaspi_throttled` | Kaspi ограничил частоту запросов кассы | Распределяет счета этой кассы во времени и ретраит; вебхук = финализация | Пока счёт в `processing` — ничего. После `error` — новый счёт через 2–3 минуты; снизьте темп создания счетов |
| `organization_not_configured` | К организации не подключён кассир Kaspi | Финализирует сразу | Подключите кассира: ЛК → Настройки → Авторизация Kaspi |
| `invoice_already_paid` | Попытка отменить уже оплаченный счёт | Отмену остановила; деньги получены | Не отменяйте; если нужно вернуть деньги — создайте возврат |
| `invoice_already_cancelled` | Счёт уже отменён | — | Ничего: желаемое состояние уже достигнуто |
| `invoice_not_found_in_kaspi` | Kaspi не нашёл счёт при отмене | Финализирует `error` | Обратитесь в поддержку |
| `refund_window_expired` | Kaspi отклонил возврат: возможно, истёк срок возврата либо возврат уже сделан | Возврат `failed`, ретраев нет | Не повторяйте; сообщите клиенту или обратитесь в поддержку |
| `qr_render_failed` | Не сформировалось изображение QR | Счёт финализирован в `error` (и 500-ответ, и вебхук) | Повторите `POST /invoices/qr` — создастся новый счёт |
| `kaspi_session_invalid` | Сессия кассира истекла в момент создания QR | Счёт финализирован в `error`; сессия инвалидирована | Повторите позже; если повторяется — переподключите кассира |
| `kaspi_error` | Неклассифицированная ошибка Kaspi | Зависит от причины; для QR — счёт `error` + вебхук | Читайте `message`/`error_message`; повторите или обратитесь в поддержку |
| `unknown_error` | Непредвиденная ошибка (в т.ч. исчерпаны все попытки создания) | Финализировала после всех ретраев | Создайте новый счёт; если повторяется — поддержка |

**Сценарии без `error_code`:**

- **Новый QR на той же кассе** — QR-счета сосуществуют: создание нового QR **не** отменяет прежние, вебхука-замены (`cancelled` с «Заменён новым QR-счётом #N») больше нет. Два параллельных `POST /invoices/qr` оба получают `201` + `pending`. Реагируйте по каждому `invoice.id` отдельно — при оплате нескольких QR придёт несколько `paid`. (`409 superseded` — defensive-ветка, на практике недостижима, на ней логику не стройте.)
- **Клиент отменил QR** — вебхук `cancelled` = реальная отмена клиентом (свернул или закрыл приложение Kaspi), а не системная замена. При необходимости создайте новый счёт.
- **Клиент отсканировал QR** — вебхук `invoice.qr_scanned` (`qr_substate=scanned`, статус остаётся `pending`): покупатель на экране оплаты. Сигнал «оплата начата», не считайте счёт оплаченным — дождитесь `paid`.
- **Счёт истёк** — вебхук `expired` (счёт по номеру — 24 ч; QR — минуты, по терминалу от Kaspi). При необходимости создайте новый счёт.
- **Оплата после отмены/истечения** — вебхук `paid` после `cancelled`/`expired`: деньги получены — отгрузите или сделайте возврат.
- **Возврат к `pending` после `error`** — корректирующий `pending`-вебхук (реконсиляция). Это новый переход, а не дубль — даже если `pending` по счёту уже приходил. Следуйте последнему статусу и не закрывайте заказ навсегда по `error`.

## Верификация подписи

Каждый запрос включает заголовок `X-Webhook-Signature: sha256=<HMAC-SHA256>` — это HMAC-SHA256 по сырому телу запроса. Заголовок отсутствует, если у ключа не задан webhook secret.

### JavaScript

```javascript
const crypto = require('crypto')

function verifyWebhook(payload, signature, secret) {
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex')
  const expectedBuf = Buffer.from(expected)
  const receivedBuf = Buffer.from(signature || '')
  if (receivedBuf.length !== expectedBuf.length) return false
  return crypto.timingSafeEqual(expectedBuf, receivedBuf)
}
```

### Python

```python
import hmac, hashlib

def verify_webhook(payload, signature, secret):
    expected = 'sha256=' + hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)
```

### PHP

```php
function verifyWebhook($payload, $signature, $secret) {
    $expected = 'sha256=' . hash_hmac('sha256', $payload, $secret);
    return hash_equals($expected, $signature);
}
```

## Доставка

Неудачная доставка повторяется автоматически. Число попыток зависит от события и режима:

| Событие | Попыток в рабочем режиме | Попыток в песочнице |
|---|---|---|
| `invoice.status_changed` | до 11 | до 3 (до 11 при `webhook_retry_grid: live` в [состоянии песочницы](sandbox.md)) |
| `invoice.refunded`, `subscription.*` | до 11 | до 11 |
| `invoice.qr_scanned`, `qr_refund.*`, `cashbox.*` | до 11 | до 3 |
| `receipt.*`, `catalog.item_processed` | до 3 | до 3 |
| `webhook.test` | одна синхронная попытка | одна синхронная попытка |

- **Интервалы в рабочем режиме** (попытки считаются вместе с первой, интервалы приблизительные):
  - `invoice.status_changed`, `invoice.refunded`, `subscription.*` — повторы через 10с, 30с, 1м, 1.5м, 2м, 5м, 10м, 15м, 30м, 1ч: около 2 часов от первой попытки до последней;
  - `qr_refund.*`, `cashbox.*` — через 10с, 30с, 1м, 1.5м, 2м, 5м, дальше по 10м: около 50 минут;
  - `invoice.qr_scanned` — через 10с, 30с, 1м, дальше по 2м: около 16 минут, скан важен, пока QR жив;
  - `receipt.*`, `catalog.item_processed` — через 10с и 1м.
- **Интервалы в песочнице.** `invoice.refunded`, `subscription.*`, `receipt.*` и `catalog.item_processed` повторяются как в рабочем режиме. У `invoice.status_changed`, `invoice.qr_scanned`, `qr_refund.*` и `cashbox.*` — повторы через 5с и 15с; `invoice.status_changed` при `webhook_retry_grid: live` — 11 попыток с интервалами рабочего режима, сжатыми примерно до 10 минут.
- **Успех:** доставка считается успешной только при HTTP-ответе **2xx**
- **Что повторяется:** HTTP ≥500, ровно 429 и сетевые ошибки. Ответы 4xx (кроме 429) не повторяются: попытка фиксируется как неуспешная (`status: failed`), и этот переход сам больше не отправится.
- **Редиректы:** 307 и 308 проходятся — тот же `POST` с тем же телом и подписью. 301, 302 и 303 не проходятся (по ним клиент обязан сменить метод и потерять тело): доставка неуспешна, без повтора, в журнале — `redirect not followed`. Указывайте сразу конечный адрес на `https://`.
- **Ручной повтор:** неудачную доставку можно переслать в кабинете — «Лог уведомлений», кнопка повтора у записи. В песочнице то же делает `POST /webhook-logs/{id}/retry` — тем же телом на текущий адрес ключа.
- **Все даты в вебхуках — в UTC** (ISO 8601, `+00:00`)

### Журнал доставок

`GET /webhook-logs` — строки всех событий организации, кроме `catalog.item_processed` (у каталога свой журнал `GET /catalog/webhook-logs`): счета, возвраты, `qr_refund.*`, `subscription.*`, `receipt.*`, `cashbox.*`, `webhook.test`. Фильтры — `invoice_id`, `event`, `status` (`success`, `failed`, `skipped`), даты. У строки `qr_refund.*` заполнен `invoice_id` — счёт, под который выпущена ссылка, у `subscription.payment_succeeded` и `subscription.payment_failed` — счёт списания. Журнал хранится 14 дней; детали одной доставки — `GET /webhook-logs/{id}`.

### Пауза отправки

После серии неудачных доставок подряд отправка вебхуков ключа автоматически встаёт на паузу.

- **Что соблюдает паузу:** события счёта (`invoice.status_changed`, `invoice.qr_scanned`), возвратов (`invoice.refunded`) и `qr_refund.*`. Пока пауза действует, они **не отправляются и не откладываются**: каждое ложится в журнал строкой `status: skipped` («пропущено: пауза», `error_message: circuit_open`), и такие события потом не повторяются.
- **Что идёт как обычно:** `subscription.*`, `receipt.*`, `cashbox.*` и `catalog.item_processed` паузу не соблюдают и уходят с обычными повторами.
- **Состояние своего ключа** — `GET /webhook-logs/delivery-state`: `state` (`open`, `paused`, `disabled`), `paused_until`, `consecutive_failures`. `paused` снимается сама после `paused_until`. При затянувшихся отказах отправка отключается (`disabled`) — её включает смена адреса или секрета (в том числе выпуск нового секрета) либо успешная проверка вебхука («Проверить уведомления» в кабинете или `POST /webhook-test`). Те же действия снимают и паузу досрочно.
- **Счётчик неудач подряд** обнуляет успешная доставка события счёта, возврата, `qr_refund.*` или `cashbox.*`.

Пропущенные за паузу переходы восстанавливайте опросом: `GET /invoices/{id}`, `GET /invoices/{id}/refunds`, `GET /qr-refunds/{id}`. События подписок и чеков, не доставленные после всех повторов, сверяйте через `GET /subscriptions/{id}` и `GET /receipts/{id}`.

## Требования к ответу

1. Возвращайте статус **2xx** в течение **5 секунд** (таймаут доставки: 5с на ответ плюс до 3с на установление соединения)
2. Будьте **идемпотентны** — одно и то же событие может прийти несколько раз, в том числе уведомление о чеке; повторная доставка не должна второй раз отгрузить заказ, отправить чек покупателю или записать возврат
3. В рабочем режиме после проверки подписи отбрасывайте события с `is_sandbox: true` в корне тела: отвечайте `2xx` и не исполняйте. Событие по песочному объекту, отправленное до перевода организации в рабочий режим, может прийти уже после него.

### Дедупликация

Дедупликация на стороне клиента **обязательна**: ретрай после частичной доставки нескольким получателям пере-отправляет вебхук всем. Занимайте ключ до обработки и освобождайте его, если обработка упала. Ключи дедупликации:

- `(invoice.id, invoice.status)` — для `invoice.status_changed`. Исключение — `pending` после `error` и `error` после такого `pending`: это новые переходы, а не дубли. Когда приходит `error`, снимите ключ `pending` этого счёта, а когда приходит `pending` — ключ `error`
- `(refund.id, refund.status)` — для возвратов. Незнакомый `refund.id` после `qr_refund.completed` — та же сумма, сверяйте по `successor_refund_id`
- `(event, qr_refund.id)` — для событий ссылки покупателю `qr_refund.*`
- `(event, receipt.id)` — для событий чеков (`receipt.issued`/`receipt.failed`)
- `(event, operation.id)` — для `cashbox.*`
- `(event, subscription.id, invoice_id)` — для событий подписки. `invoice_id` в корне есть только у `subscription.payment_succeeded`, `subscription.payment_failed` и `subscription.cancelled` с `reason` `payer_refused` или `payer_error`; у `subscription.period_skipped` его нет — ключ `(event, subscription.id, billing_period_start)`

Если дедуплицировать только по `invoice.id`, вы потеряете переход `paid → partially_refunded`. И не закрывайте заказ навсегда по `cancelled` или `expired`: `cancelled → paid` и `expired → paid` законны.

## Лучшие практики безопасности

1. **Всегда проверяйте подпись**
2. **Используйте HTTPS** в production
3. **Храните secrets в переменных окружения**
4. **Используйте ключи идемпотентности** (см. «Дедупликация»)
