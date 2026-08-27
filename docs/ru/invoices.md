# Счета

Счета — основа ApiPay.kz. Каждый счёт представляет запрос на оплату, который вы отправляете клиенту.

## Создание счёта

**Эндпоинт:** `POST /invoices`

Поддерживает два режима: фиксированная сумма или корзина товаров.

### Запрос (фиксированная сумма)

```bash
curl -X POST https://api.apipay.kz/api/v1/invoices \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 10000,
    "phone_number": "87001234567",
    "description": "Оплата заказа #123",
    "external_order_id": "order_123"
  }'
```

### Запрос (с корзиной товаров)

Для организаций с подключённым каталогом:

```bash
curl -X POST https://api.apipay.kz/api/v1/invoices \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "87001234567",
    "description": "Заказ из каталога",
    "cart_items": [
      {"catalog_item_id": 101, "count": 2, "price": 4500.00},
      {"catalog_item_id": 205, "count": 3}
    ],
    "discount_percentage": 10
  }'
```

Сумма рассчитывается автоматически из цен товаров каталога. Поддерживает кастомные цены и скидки.

### Параметры

| Поле | Тип | Обязательно | Описание |
|------|-----|-------------|----------|
| `amount` | number | Да* | Сумма в тенге, **только целая**: 1 - 99 999 999. Дробная → `422 amount_must_be_whole_tenge`; проверяется и `amount`, и итог `cart_items` после скидок. Нужны тиыны — используйте `POST /invoices/qr`. *Не обязательно при наличии cart_items. |
| `phone_number` | string | Да | Телефон клиента (формат: 8XXXXXXXXXX) |
| `description` | string | Нет | Описание платежа (макс. 60 символов — Kaspi показывает покупателю только первые 60) |
| `external_order_id` | string | Нет | Ваш ID заказа для сопоставления (макс. 255 символов) |
| `cart_items` | array | Нет | Массив товаров корзины (заменяет amount) |
| `discount_percentage` | number | Нет | Глобальный % скидки (1-99). Применяется ко всему чеку. |

### Поля товара корзины

| Поле | Тип | Обязательно | Описание |
|------|-----|-------------|----------|
| `catalog_item_id` | integer | Да | ID товара из каталога (из GET /catalog) |
| `count` | integer | Да | Количество (мин. 1) |
| `price` | number | Нет | Кастомная цена (0.01 - 99999999.99). Заменяет каталожную цену. |

### Ответ

```json
{
  "id": 124,
  "amount": "9500.00",
  "status": "processing",
  "description": "Оплата заказа #123",
  "external_order_id": "order_123",
  "phone_number": "87001234567",
  "subtotal": "10000.00",
  "discount_sum": "500.00",
  "discount_percentage": "10",
  "error_message": null,
  "paid_at": null,
  "created_at": "2025-01-31T12:00:00Z"
}
```

> **Примечание:** Поля `subtotal`, `discount_sum` и `discount_percentage` появляются только при наличии скидки (обратная совместимость).

## Создание QR-счёта (на экране кассы)

**Эндпоинт:** `POST /invoices/qr`

Оплата по QR-коду на экране кассы — без номера телефона клиента. Касса показывает QR, покупатель сканирует приложением Kaspi и оплачивает. Подходит для оффлайн-точек, касс, торговых терминалов.

В отличие от обычного `POST /invoices`:
- Не нужен `phone_number`.
- Ответ синхронный — возвращается готовый QR (`qr_token_url` + PNG-изображение).
- Жизненный цикл QR-счёта — **минуты** (vs 24 часа у обычного, по номеру телефона). Точный момент истечения диктует Kaspi; терминальный статус (`paid`/`cancelled`/`expired`) приходит вебхуком. Поле `qr_expires_at` — справочно, не для локальной терминализации.
- Отмена QR-счёта не поддерживается — если оплата не пришла, счёт через несколько минут переходит в `expired` (по терминалу от Kaspi). Возврат по оплаченному QR-счёту выполняется отдельной веткой `POST /qr-refunds`: покупатель сканирует возвратный QR (см. `openapi.yaml`).
- Per-org rate limit: **60 QR-запросов в минуту на организацию** (отдельно от общего лимита API).

> ℹ️ **QR-счета сосуществуют.** Создание нового QR на той же кассе **не отменяет** прежние — старый QR остаётся в статусе `pending` и мониторится до своего терминала. Реагируйте на `paid`/`cancelled`/`expired` по каждому `invoice.id` отдельно (при оплате нескольких QR придёт несколько `paid`). Счета по номеру телефона живут 24 часа в Kaspi.

Тело запроса зависит от настройки организации (`has_catalog`):

### Запрос (без каталога)

```bash
curl -X POST https://api.apipay.kz/api/v1/invoices/qr \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 5000,
    "description": "Заказ №123",
    "external_order_id": "order-123"
  }'
```

### Запрос (с каталогом)

```bash
curl -X POST https://api.apipay.kz/api/v1/invoices/qr \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Заказ №123",
    "cart_items": [
      {"catalog_item_id": 608400, "count": 2, "price": 1500}
    ],
    "discount_percentage": 10
  }'
```

### Параметры

| Поле | Тип | Обязательно | Описание |
|------|-----|-------------|----------|
| `amount` | number | Да* | Сумма (только если has_catalog=false), 0.01 - 99 999 999.99 ₸ |
| `description` | string | Нет | Описание (макс. 100). Используется как наименование позиции в QR-чеке Kaspi |
| `external_order_id` | string | Нет | Ваш ID заказа (макс. 255) |
| `cart_items` | array | Да* | Только если has_catalog=true. От 1 до 100 позиций |
| `discount_percentage` | number | Нет | Скидка на весь чек, 1-99% |
| `simulate` | string | Нет | Только для sandbox: `paid` \| `cancelled` \| `expired`. См. [Sandbox-режим](#sandbox-режим) |

\* зависит от `has_catalog`: либо `amount`, либо `cart_items`.

### Ответ 201

```json
{
  "id": 63474,
  "amount": "100.00",
  "status": "pending",
  "paid_at": null,
  "phone": null,
  "created_at": "2026-05-09T07:27:37+00:00",
  "is_qr_token": true,
  "qr_token_url": "https://qr.kaspi.kz/0000000000000000000000000000000000000000",
  "qr_image_url": "https://api.apipay.kz/storage/qr/00000000-0000-0000-0000-000000000000.png",
  "qr_expires_at": "2026-05-09T07:32:38+00:00"
}
```

| Поле | Описание |
|------|----------|
| `id` | ID счёта в нашей системе. По нему получать статус (`GET /invoices/{id}`) и приходят webhook-уведомления. |
| `is_qr_token` | Флаг QR-счёта. Также возвращается в `GET /invoices/{id}` и в webhook-теле. |
| `qr_token_url` | Прямая ссылка от Kaspi (`qr.kaspi.kz/...`). Та же информация, что закодирована в PNG. Можно перерисовать QR на стороне клиента, если нужен другой стиль/размер. |
| `qr_image_url` | Готовый PNG 600×600 с логотипом Kaspi в центре (ECC=High). На нашем CDN-storage, доступен без авторизации, живёт `qr_expires_at` + 60 сек (после этого 404). |
| `qr_expires_at` | Крайний момент, когда QR ещё можно **отсканировать** (UTC). Длительность окна задаёт Kaspi — считайте её из этого поля, а не константой. Окно ограничивает только скан: оплата, начатая под конец окна, завершится уже после `qr_expires_at`. Терминальный статус диктует Kaspi — ждите вебхук, а не локальный отсчёт. |

### Жизненный цикл и обработка статуса

1. После создания счёт в статусе `pending`. Сервис сам отслеживает изменение статуса на стороне Kaspi.
2. При смене статуса на терминальный (`paid`, `cancelled`, `expired`) прилетает обычный webhook `invoice.status_changed` — точно такой же по формату, как для обычных счетов, но в `invoice` есть `is_qr_token: true` и QR-поля.
3. Альтернативный poll: клиент может опрашивать `GET /invoices/{id}` каждые 2-3 сек.
4. Через несколько минут без оплаты статус становится `expired` — но только когда Kaspi отдал терминал (вебхуком), а не по локальному таймеру. PNG исчезает из storage в течение минуты — `qr_image_url` начнёт возвращать 404.
5. Отмена QR-счёта не поддерживается — просто дождитесь истечения (несколько минут). Возврат по оплаченному QR-счёту выполняется через отдельную ветку `POST /qr-refunds` — покупатель сканирует возвратный QR.

### Sandbox-режим

Если у организации `sandbox_mode=true`, эндпоинт работает БЕЗ обращения к Kaspi: возвращается фиктивный `qr_token_url` (`https://qr.kaspi.kz/sandbox/<uuid>`) и реально отрисованный PNG. Его можно отобразить в UI и протестировать всю фронтенд-логику, но реальное приложение Kaspi такой QR не примет — он не существует на стороне Kaspi.

#### Параметр `simulate` (только sandbox)

Для быстрого теста терминальных сценариев можно передать `simulate` прямо в теле создания — клиент в одном вызове получает уже готовый завершённый счёт нужного статуса (без необходимости отдельной ручки `/simulate-status`):

| `simulate` | Результирующий `status` | `qr_expires_at` | `paid_at` | Webhook сразу? |
|------------|------------------------|-----------------|-----------|----------------|
| (не передан) | `pending` | now + 5 мин | `null` | нет |
| `expired` | `expired` | now − 1 мин (в прошлом) | `null` | да |
| `paid` | `paid` | now + 5 мин | now | да |
| `cancelled` | `cancelled` | now + 5 мин | `null` | да |

- Параметр игнорируется (молча) для не-sandbox организаций — для боевых организаций реальный жизненный цикл управляется Kaspi.
- Допустимые значения проходят через стандартную validation, неизвестные → 422.

##### Пример: получить уже истёкший QR

```bash
curl -X POST https://api.apipay.kz/api/v1/invoices/qr \
  -H "X-API-Key: <sandbox_api_key>" \
  -H "Content-Type: application/json" \
  -d '{"amount": 250, "simulate": "expired"}'
```

Ответ (фрагмент):

```json
{
  "id": 63497,
  "status": "expired",
  "is_qr_token": true,
  "qr_token_url": "https://qr.kaspi.kz/sandbox/b5d6ffe9-…",
  "qr_image_url": "https://api.apipay.kz/storage/qr/b5d6ffe9-….png",
  "qr_expires_at": "2026-05-09T07:52:08+00:00"
}
```

Отдельно `POST /api/v1/invoices/{id}/simulate-status` тоже работает с QR-инвойсами (для динамических сценариев: создал `pending` → подождал в UI → явно перевёл в `paid`/`cancelled`/`expired`).

### Ошибки

| Код | error | Когда |
|-----|-------|-------|
| 400 | `organization_required` | У api-key нет организации |
| 400 | `kaspi_session_not_configured` | У организации не подключён кассир Kaspi (Настройки → Авторизация Kaspi) |
| 400 | `Organization not found or not verified` | Боевая организация в статусе ≠ `verified` |
| 400 | `sandbox_invoice_limit` | Превышен лимит sandbox-счетов |
| 422 | `Validation failed` | Невалидные параметры (см. body schema) |
| 422 | `catalog_requires_cart_items` | `has_catalog=true`, но `cart_items` не передан |
| 422 | `catalog_not_supported` | `has_catalog=false`, но передан `cart_items` |
| 422 | — | В корзине есть позиция в статусе `deleting`; причина — в `errors["cart_items.N.catalog_item_id"]`, отдельного `error_code` у этой ветки нет. Верните позицию или уберите её из корзины, см. [Каталог → Статусы товара](catalog.md#статусы-товара) |
| 429 | `qr_rate_limit` | Per-org лимит 60 QR/мин |
| 500 | `qr_render_failed` | Не удалось отрисовать PNG |
| 502 | `kaspi_error` | Kaspi API вернул ошибку |
| 503 | `kaspi_session_invalid` | Сессия Kaspi истекла |

> Два кода паритета каталога приходят в поле **`error_code`**, а не `error`, и без объекта `errors` — рядом лежит только `message`. Тексты `message` при их появлении не менялись, так что разбор по строке продолжает работать; переводите ветвление на `error_code`.

## Список счетов

**Эндпоинт:** `GET /invoices`

```bash
curl "https://api.apipay.kz/api/v1/invoices?page=1&per_page=20&status[]=paid&sort_by=created_at&sort_order=desc" \
  -H "X-API-Key: YOUR_API_KEY"
```

### Параметры запроса

| Параметр | Тип | По умолчанию | Описание |
|----------|-----|--------------|----------|
| `page` | integer | 1 | Номер страницы |
| `per_page` | integer | 10 | Элементов на странице (1-100) |
| `search` | string | — | Поиск по описанию/ID заказа |
| `status[]` | array | — | Фильтр по статусу |
| `date_from` | string | — | Начало окна включительно: `YYYY-MM-DD` (= календарные сутки мерчанта целиком) или `YYYY-MM-DD HH:MM` (точная минута). Зона — Asia/Almaty |
| `date_to` | string | — | Конец окна включительно, тот же формат |
| `date_field` | string | created_at | По какому полю режется окно: `created_at` или `paid_at` (второй отсекает неоплаченные) |
| `sort_by` | string | created_at | Поле сортировки |
| `sort_order` | string | desc | `asc` или `desc` |

## Получение счёта

**Эндпоинт:** `GET /invoices/{id}`

```bash
curl https://api.apipay.kz/api/v1/invoices/42 \
  -H "X-API-Key: YOUR_API_KEY"
```

> Ответ включает массив `items` — снимок товаров корзины при создании счёта: `[{ id, invoice_id, catalog_item_id, name, price, count, unit_id, original_price, discount }]`. Поля `subtotal`, `discount_sum`, `discount_percentage` появляются на верхнем уровне только при наличии скидки.

**Поле `kaspi_qr_link`** — ссылка на оплату этого счёта по QR вида `https://kaspi.kz/qr/pay?tranId=QR…`. Нарисуйте из неё QR-код покупателю. Поле есть и в каждом элементе `data` у `GET /invoices`. Вычисляется из идентификатора Kaspi и не хранится, поэтому приходит `null`, пока Kaspi этот идентификатор не присвоил (статус `processing`), и всегда `null` в песочнице.

> ⚠️ Не путайте `kaspi_qr_link` с `qr_token_url`: последний относится к отдельному механизму QR-счетов (`POST /invoices/qr`).

## Чек Kaspi по счёту

**Эндпоинт:** `GET /invoices/{id}/receipt`

Ссылки на чек Kaspi по оплаченному счёту — чтобы отдать чек покупателю.

> Это чек Kaspi по оплате счёта. Фискальные чеки за наличные и POS другого банка — отдельный раздел [Фискальные чеки](receipts.md) (Kaspi OFD), к этой ручке он отношения не имеет.

```bash
curl https://api.apipay.kz/api/v1/invoices/42/receipt \
  -H "X-API-Key: YOUR_API_KEY"
```

**Ответ асинхронный.** Первый вызов ставит задачу и отдаёт `202`:

```json
{ "status": "pending", "poll_after": 2 }
```

Повторите запрос через `poll_after` секунд — интервал берите из ответа, а не из своей константы. Как только чек получен, тот же URL отдаёт `200`:

```json
{
  "status": "ready",
  "receipt_link": "https://kaspi.kz/...",
  "download_link": "https://kaspi.kz/...&hash=...",
  "share_link": "https://kaspi.kz/...&hash=...",
  "sale_date": "2026-08-10 09:14:00.000000",
  "fetched_at": "2026-08-10T09:15:02+00:00"
}
```

`sale_date` приходит в том виде, в каком его отдал Kaspi (`ГГГГ-ММ-ДД ЧЧ:ММ:СС.мкс`), а не в ISO 8601; микросекунды значащие — не отбрасывайте их. Остальные поля времени — ISO 8601.

Готовый чек кэшируется: повторный запрос по тому же счёту отвечает сразу.

Ссылки различаются назначением: `share_link` — та, что предназначена покупателю; `download_link` — прямой PDF для вашей системы; `receipt_link` — фискальная форма чека, её можно показывать где угодно.

> ⛔ `download_link` и `share_link` содержат секретный параметр `hash` — по нему чек откроет кто угодно. Не публикуйте их, не кладите в логи и не подставляйте в URL своих страниц. Выданную ссылку отозвать нельзя: если она утекла, закрыть доступ нечем. `receipt_link` секрета не несёт.

Чек существует только у счёта в статусе `paid` или `partially_refunded` — частичный возврат остаётся оплаченным счётом. Вебхука на это событие нет: запрашивайте чек после перехода счёта в `paid`. В песочнице ручка отвечает сразу, а ссылки помечены `sandbox=1` — это заглушки, настоящего чека по ним нет, покупателю их отдавать нельзя.

**Ошибки:**

| Код | HTTP | Когда |
|-----|------|-------|
| `receipt_not_available_for_status` | 409 | Счёт не в `paid`/`partially_refunded`, либо у оплаченного счёта ещё нет числового идентификатора Kaspi |
| `kaspi_session_expired` | 409 | Кассир по счёту требует переподключения |
| `kaspi_session_unavailable` | 409 | Кассир временно недоступен |
| `receipt_rate_limited` | 429 | У ручки собственный минутный лимит, он строже общего |
| `receipt_unavailable` | 503 | Kaspi не отдал чек — обычно помогает повтор через минуту |

## Отмена счёта

**Эндпоинт:** `POST /invoices/{id}/cancel`

Можно отменить счета со статусом `pending` или `processing`. В sandbox возвращает `200 OK` (синхронно), в production — `202 Accepted` со статусом `cancelling` (асинхронная обработка через Kaspi).

> ⛔ **QR-счёт (`is_qr_token: true`) отменить нельзя** — запрос отвечает `409 qr_cancel_unsupported`, статус счёта не меняется. В теле ответа приходит `expires_at` — момент, после которого QR перестанет быть оплачиваемым. Дождитесь `expired` или выставьте новый счёт.

```bash
curl -X POST https://api.apipay.kz/api/v1/invoices/42/cancel \
  -H "X-API-Key: YOUR_API_KEY"
```

### Ответ 202 (production)

```json
{
  "message": "Invoice cancellation queued",
  "invoice_id": 42
}
```

## Проверка статуса счетов

**Эндпоинт:** `POST /invoices/status/check`

Принудительная проверка статуса указанных счетов. Принимает массив ID счетов (до 100). Полезно при задержке webhooks.

### Параметры

| Поле | Тип | Обязательно | Описание |
|------|-----|-------------|----------|
| `invoice_ids` | array | Да | Массив ID счетов для проверки (макс. 100) |

```bash
curl -X POST https://api.apipay.kz/api/v1/invoices/status/check \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "invoice_ids": [42, 43, 44]
  }'
```

### Ответ

```json
{
  "invoices": [
    {
      "id": 42,
      "status": "paid",
      "kaspi_invoice_id": "ABC123",
      "amount": "5000.00",
      "error_message": null,
      "updated_at": "2026-02-26T10:30:00+06:00"
    }
  ]
}
```

## Возврат по счёту

**Эндпоинт:** `POST /invoices/{id}/refund`

Подробнее: [Возвраты](refunds.md).

## Список возвратов по счёту

**Эндпоинт:** `GET /invoices/{id}/refunds`

```bash
curl https://api.apipay.kz/api/v1/invoices/42/refunds \
  -H "X-API-Key: YOUR_API_KEY"
```

## Статусы счетов

| Статус | Описание | Можно отменить | Можно вернуть |
|--------|----------|----------------|---------------|
| `processing` | Ожидает отправки в Kaspi | Да | Нет |
| `pending` | Ожидает оплаты | Да | Нет |
| `cancelling` | Отменяется (асинхронно) | Нет | Нет |
| `paid` | Оплачен | Нет | Да |
| `cancelled` | Отменён вручную | Нет | Нет |
| `expired` | Истёк срок оплаты | Нет | Нет |
| `error` | Ошибка отправки в Kaspi (см. `error_message`) | Нет | Нет |
| `partially_refunded` | Частичный возврат | Нет | Да |

> Статуса `refunded` не существует: полный возврат статус не меняет — счёт остаётся `paid` (или `partially_refunded`, если ранее был частичный), а полнота возврата видна по `is_fully_refunded=true`.

## Переходы статусов

```
processing → pending → paid → partially_refunded
    ↓           ↓
  error    cancelling
                ↓
            cancelled

pending → expired
processing → cancelled (через cancel)
```

## Примеры кода

### JavaScript

```javascript
const response = await fetch('https://api.apipay.kz/api/v1/invoices', {
  method: 'POST',
  headers: {
    'X-API-Key': 'YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    amount: 10000,
    phone_number: '87001234567',
    description: 'Оплата заказа #123'
  })
})
const invoice = await response.json()
```

### Python

```python
import requests

response = requests.post(
    'https://api.apipay.kz/api/v1/invoices',
    headers={'X-API-Key': 'YOUR_API_KEY', 'Content-Type': 'application/json'},
    json={'amount': 10000, 'phone_number': '87001234567', 'description': 'Заказ #123'}
)
invoice = response.json()
```

### PHP

```php
$ch = curl_init('https://api.apipay.kz/api/v1/invoices');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => ['X-API-Key: YOUR_API_KEY', 'Content-Type: application/json'],
    CURLOPT_POSTFIELDS => json_encode([
        'amount' => 10000, 'phone_number' => '87001234567', 'description' => 'Заказ #123'
    ]),
    CURLOPT_RETURNTRANSFER => true
]);
$invoice = json_decode(curl_exec($ch), true);
```
