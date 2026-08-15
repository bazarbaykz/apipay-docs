# Фискальные чеки

Выбивание фискального чека в Kaspi OFD для оплат, которые **не** прошли через Kaspi QR.

Когда клиент платит через Kaspi QR, чек формирует сам Kaspi — вам ничего делать не нужно. Но если оплата прошла **наличными** или **через POS-терминал другого банка**, фискальный чек Kaspi не создаёт — его нужно выбить через API. Тип оплаты задаётся полем `payment_type`:

| `payment_type` | Способ оплаты |
|----------------|---------------|
| `3` | Наличные |
| `5` | POS-терминал другого банка |

## Предусловия

Перед выбиванием чека убедитесь, что:

1. **Запись через кассира не приостановлена.** Выбивание чеков доступно безусловно; `403 fiscal_receipts_disabled` приходит только когда приостановлена запись через кассира, на которого адресован чек — используйте другого кассира (`kaspi_connection_id`) или возобновите запись. Чтение истории (`GET /receipts`, `GET /receipts/{id}`) не гейтится ничем.
2. **Подключён кассир Kaspi.** Нужен активный кассир (Настройки → Авторизация Kaspi). Иначе — `409 kaspi_session_not_configured`. Если у организации несколько активных касс и основная не выбрана — передайте `kaspi_connection_id` (иначе `422 connection_ambiguous`).
3. **Смена открыта.** Смену открывает мерчант в приложении Kaspi Pos. Если смена закрыта, чек упадёт со статусом `failed` и `error_code = shift_closed`.
4. **Позиции фискальные.** В чек попадают только товары из синхронизированного каталога (по `catalog_item_id`), зарегистрированные фискально (с НТИН и штрихкодом). Позиция без НТИН уронит чек с `item_not_fiscal`. Резолв НТИН — через `POST /catalog/scan` + `PATCH /catalog/{id}` (см. [Каталог](catalog.md)).

## Превью чека

Синхронный предпросмотр чека перед выбиванием — например, чтобы показать кассиру строки чека (сумму и способ оплаты) на экране.

**Эндпоинт:** `POST /receipts/preview`

```bash
curl -X POST https://api.apipay.kz/api/v1/receipts/preview \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "payment_type": 3,
    "total_price": 10.00
  }'
```

### Параметры

| Поле | Тип | Обязательно | Описание |
|------|-----|-------------|----------|
| `payment_type` | integer | Да | `3` — наличные, `5` — POS другого банка |
| `total_price` | number | Да | Сумма чека |
| `kaspi_connection_id` | integer | Нет | Конкретный кассир. По умолчанию — основной / единственный активный |

### Ответ

```json
{
  "data": [
    { "Title": "Способ оплаты", "Subtitle": "Наличные", "isBoldText": false },
    { "Title": "Итого", "Subtitle": "10.00 ₸", "isBoldText": true }
  ]
}
```

> В песочнице превью детерминированное и формируется без обращения к Kaspi.

## Выбить чек

Асинхронно выбивает фискальный чек. Запрос создаёт чек в статусе `pending` и ставит задачу выбивания; итог узнаётся поллингом или вебхуком (см. ниже).

**Эндпоинт:** `POST /receipts`

```bash
curl -X POST https://api.apipay.kz/api/v1/receipts \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "payment_type": 3,
    "client_operation_id": "pos-2026-07-12-0042",
    "received_amt": 500,
    "cart_items": [
      { "catalog_item_id": 12345, "quantity": 1 }
    ]
  }'
```

### Параметры

| Поле | Тип | Обязательно | Описание |
|------|-----|-------------|----------|
| `payment_type` | integer | Да | `3` — наличные, `5` — POS другого банка |
| `client_operation_id` | string | Да | Ключ идемпотентности, уникальный на организацию (макс. 191 символ). См. [Идемпотентность](#идемпотентность) |
| `cart_items` | array | Да | Позиции чека из каталога (1–100). У каждой — `catalog_item_id` и `quantity`; опционально `price` (цена за единицу, по умолчанию `selling_price` из каталога) |
| `received_amt` | number | Нет | **Только наличные:** полученная от клиента сумма (>= итога, для расчёта сдачи). Для POS другого банка (`5`) игнорируется и приравнивается к итогу |
| `kaspi_connection_id` | integer | Нет | Конкретный кассир. По умолчанию — основной / единственный активный |

### Ответ

```json
{
  "id": 4210,
  "status": "pending",
  "client_operation_id": "pos-2026-07-12-0042"
}
```

HTTP-статус — `202 Accepted`: чек принят в обработку, но ещё не выбит. Дождитесь терминального статуса (`issued` или `failed`) через поллинг или вебхук.

## Узнать результат

Чек выбивается асинхронно. Итог можно узнать двумя равноправными способами.

### Поллинг статуса

**Эндпоинт:** `GET /receipts/{id}`

```bash
curl https://api.apipay.kz/api/v1/receipts/4210 \
  -H "X-API-Key: YOUR_API_KEY"
```

```json
{
  "id": 4210,
  "status": "issued",
  "payment_type": 3,
  "client_operation_id": "pos-2026-07-12-0042",
  "total_price": "10.00",
  "received_amt": "500",
  "fpd": "000000000000",
  "operation_id": "KKM00000000",
  "operation_time": "2026-07-12T16:25:40+00:00",
  "shift_number": 106,
  "link": "https://receipt.kaspi.kz/preview/cashier?extTranId=KKM00000000",
  "error_code": null,
  "error_message": null,
  "created_at": "2026-07-12T16:25:38+00:00"
}
```

Пока чек не выбит — `status: "pending"`, а реквизиты (`fpd`, `operation_id`, `link`, `shift_number`) равны `null`. После успеха — `status: "issued"` и заполненные реквизиты. При неудаче — `status: "failed"`, реквизиты `null`, причина в `error_code` / `error_message`. Чужой `id` (чек другой организации) → `404 receipt_not_found`.

### Вебхук

Тот же итог приходит вебхуком `receipt.issued` (успех) или `receipt.failed` (неудача) — см. [Вебхуки](webhooks.md). Вебхуки за отдельным гейтом; если они у вас не включены, используйте поллинг.

## Идемпотентность

`client_operation_id` — ваш ключ идемпотентности, **уникальный на организацию**. Он защищает от двойного выбивания чека при повторной отправке запроса (обрыв связи, ретрай, двойной клик кассира).

- Повтор `POST /receipts` с уже использованным `client_operation_id` **не** выбивает второй чек, а возвращает `409 duplicate_client_operation_id`. В теле ответа — `receipt_id` и текущий `status` первого чека: по ним найдите исходный чек через `GET /receipts/{id}`.
- Если предыдущая попытка завершилась `failed`, повтор с тем же `client_operation_id` **разрешён** — можно перевыбить чек.

> Генерируйте `client_operation_id` детерминированно от операции продажи (например, `pos-2026-07-12-0042`), а не случайно на каждый запрос — тогда сетевой ретрай попадёт в тот же ключ и дубля не будет.

## Статусы чека

| Статус | Описание |
|--------|----------|
| `pending` | Чек создан, задача выбивания поставлена в очередь |
| `issued` | Чек успешно выбит в Kaspi OFD; реквизиты (`fpd`, `operation_id`, `link`) заполнены |
| `failed` | Выбить не удалось; причина — в `error_code` / `error_message`. Повтор разрешён с тем же `client_operation_id` |

## Коды ошибок

| Код | HTTP | Когда | Что делать |
|-----|------|-------|------------|
| `fiscal_receipts_disabled` | 403 | Фича фискальных чеков выключена | Обратитесь в поддержку для включения |
| `kaspi_session_not_configured` | 409 | Нет активного кассира Kaspi | Подключите кассира: ЛК → Настройки → Авторизация Kaspi |
| `duplicate_client_operation_id` | 409 | `client_operation_id` уже использован | Найдите исходный чек по `receipt_id` из тела ответа; повтор разрешён только после `failed` |
| `connection_ambiguous` | 422 | Несколько активных касс, основная не выбрана | Передайте `kaspi_connection_id` |
| `receipt_preview_unavailable` | 503 | Kaspi недоступен для превью | Повторите запрос позже |
| `receipt_not_found` | 404 | Чек не найден или принадлежит другой организации | Проверьте `id` |
| `shift_closed` | — (в `failed`) | Смена в Kaspi Pos закрыта | Откройте смену в приложении Kaspi Pos и выбейте чек заново |
| `item_not_fiscal` | — (в `failed`) | Позиция без НТИН — не фискальная | Дорезолвите НТИН (`POST /catalog/scan` + `PATCH /catalog/{id}`) и повторите |
| `rfo_missing` | — (в `failed`) | Не определена торговая точка (РФО) | Обратитесь в поддержку |
| `receipt_kaspi_error` | — (в `failed`) | Kaspi отклонил выбивание | Причина — в `error_message`; при необходимости обратитесь в поддержку |
| `receipt_dispatch_error` | — (в `failed`) | Технический сбой отправки | Повторите с тем же `client_operation_id` |
| `receipt_ofd_token_revoked` | — (в `failed`) | Отозвана фискальная привязка кассы к ОФД | Мерчанту нужно перепривязать ОФД в приложении Kaspi, после чего выбить чек заново. Временем не лечится |
| `kaspi_session_invalid` | — (в `failed`) | Сессия кассира недействительна | Переподключите кассира и выбейте чек заново |
| `kaspi_session_expired` | 409 | Сессия кассира Kaspi мертва — чек в Kaspi не уйдёт | Переподключите кассира (ЛК → Настройки → Авторизация Kaspi) и выбейте чек заново |
| `tariff_inactive` | 403 | Подписка на ApiPay не активна | Оплатите тариф в кабинете: платные операции, включая чеки, закрываются сразу по окончании срока |

> Коды без HTTP приходят на неудачном чеке (`status=failed`) — в поле `error_code` ответа `GET /receipts/{id}` и в вебхуке `receipt.failed`. Стройте логику по `error_code`, а не по тексту `error_message`.

### Отозванная привязка к ОФД

`receipt_ofd_token_revoked` означает, что Kaspi отозвал **фискальную** привязку кассы. Приходит в вебхуке `receipt.failed` и в `GET /receipts/{id}`; в ответе самого `POST /receipts` его не будет — ручка асинхронная и всегда отдаёт `202` со `status: pending`, а код проставляется позже.

- **Приём оплат при этом работает** — счета и QR выставляются как обычно. Встают только фискальный чек и изменение каталога.
- **Повтор не поможет, пока привязка отозвана.** Действие на стороне мерчанта — перепривязать ОФД в приложении Kaspi. После этого чек выбивается заново: фискальный документ не создан, тот же `client_operation_id` допустим.
- **Не путайте с `kaspi_session_invalid`:** там мертва платёжная сессия и кассира надо переподключать, здесь сессия жива.
- Раньше этот случай приходил как `receipt_kaspi_error`. Если вы ветвитесь по нему — добавьте новый код в разбор.
- В песочнице параметром `simulate` этот исход не воспроизводится.

## Примеры кода

### JavaScript

```javascript
// 1. Превью чека
const preview = await fetch('https://api.apipay.kz/api/v1/receipts/preview', {
  method: 'POST',
  headers: { 'X-API-Key': 'YOUR_API_KEY', 'Content-Type': 'application/json' },
  body: JSON.stringify({ payment_type: 3, total_price: 10.0 })
}).then(r => r.json())

// 2. Выбить чек (наличные)
const receipt = await fetch('https://api.apipay.kz/api/v1/receipts', {
  method: 'POST',
  headers: { 'X-API-Key': 'YOUR_API_KEY', 'Content-Type': 'application/json' },
  body: JSON.stringify({
    payment_type: 3,
    client_operation_id: 'pos-2026-07-12-0042',
    received_amt: 500,
    cart_items: [{ catalog_item_id: 12345, quantity: 1 }]
  })
}).then(r => r.json())

// 3. Дождаться результата (поллинг)
async function pollReceipt(id) {
  for (let i = 0; i < 20; i++) {
    const r = await fetch(`https://api.apipay.kz/api/v1/receipts/${id}`, {
      headers: { 'X-API-Key': 'YOUR_API_KEY' }
    }).then(r => r.json())
    if (r.status !== 'pending') return r
    await new Promise(res => setTimeout(res, 3000))
  }
}
const result = await pollReceipt(receipt.id)
```

### Python

```python
import requests, time

BASE = 'https://api.apipay.kz/api/v1'
HEADERS = {'X-API-Key': 'YOUR_API_KEY', 'Content-Type': 'application/json'}

# 1. Выбить чек (наличные)
receipt = requests.post(f'{BASE}/receipts', headers=HEADERS, json={
    'payment_type': 3,
    'client_operation_id': 'pos-2026-07-12-0042',
    'received_amt': 500,
    'cart_items': [{'catalog_item_id': 12345, 'quantity': 1}],
}).json()

# 2. Дождаться результата (поллинг)
def poll_receipt(receipt_id):
    for _ in range(20):
        r = requests.get(f'{BASE}/receipts/{receipt_id}', headers=HEADERS).json()
        if r['status'] != 'pending':
            return r
        time.sleep(3)

result = poll_receipt(receipt['id'])
```

### PHP

```php
$base = 'https://api.apipay.kz/api/v1';
$headers = ['X-API-Key: YOUR_API_KEY', 'Content-Type: application/json'];

// Выбить чек (наличные)
$ch = curl_init("$base/receipts");
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => $headers,
    CURLOPT_POSTFIELDS => json_encode([
        'payment_type' => 3,
        'client_operation_id' => 'pos-2026-07-12-0042',
        'received_amt' => 500,
        'cart_items' => [['catalog_item_id' => 12345, 'quantity' => 1]],
    ]),
    CURLOPT_RETURNTRANSFER => true,
]);
$receipt = json_decode(curl_exec($ch), true);

// Проверить статус
$ch = curl_init("$base/receipts/{$receipt['id']}");
curl_setopt_array($ch, [
    CURLOPT_HTTPHEADER => $headers,
    CURLOPT_RETURNTRANSFER => true,
]);
$status = json_decode(curl_exec($ch), true);
```
