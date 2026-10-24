# Возвраты

Полные и частичные возвраты по оплаченным счетам. Возврат асинхронный: ответ `201` со `status: pending` значит «заявка принята», а не «деньги вернулись». Итог приходит вебхуком `invoice.refunded` (`completed` или `failed`) и виден в `GET /invoices/{id}/refunds`.

## Создание возврата

**Эндпоинт:** `POST /invoices/{id}/refund`

### Полный возврат

```bash
curl -X POST https://api.apipay.kz/api/v1/invoices/42/refund \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Idempotency-Key: refund-order_123-1" \
  -H "Content-Type: application/json" \
  -d '{"reason": "По запросу клиента", "hold_for_buyer_confirmation": true}'
```

### Частичный возврат

```bash
curl -X POST https://api.apipay.kz/api/v1/invoices/42/refund \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Idempotency-Key: refund-order_123-2" \
  -H "Content-Type: application/json" \
  -d '{"amount": 5000, "reason": "Частичный возврат", "hold_for_buyer_confirmation": true}'
```

### Параметры

| Поле | Тип | Обязательно | Описание |
|------|-----|-------------|----------|
| `amount` | number | Нет | Сумма частичного возврата (0.01-99999999.99). Пропустите для полного возврата. |
| `reason` | string | Нет | Причина возврата (макс. 500 символов) |
| `return_items` | array | Нет | Массив позиций для поэлементного возврата из корзины. На каждую позицию укажите РОВНО одно из полей: `count` (целые штуки) ЛИБО `amount` (произвольная сумма по позиции). Указание обоих или ни одного — ошибка 422. |
| `hold_for_buyer_confirmation` | boolean | Нет | Удержание до подтверждения покупателя (по умолчанию `false`). Если Kaspi откажет кодом `refund_requires_buyer_confirmation` или `refund_rejected_by_kaspi`, счёт останется за этим возвратом, и по нему пройдёт только ссылка покупателю с его `source_refund_id`. Интеграциям — всегда `true`, см. [Запасной путь](#запасной-путь-ссылка-покупателю). |
| `idempotency_key` | string | Нет | Ключ идемпотентности в теле — то же, что заголовок `Idempotency-Key` (до 191 символа). Если переданы оба, действует заголовок. |

Заголовок `Idempotency-Key` — см. [Идемпотентность и повтор](#идемпотентность-и-повтор).

### Возврат по товарам (корзина)

На каждую позицию — либо `count` (вернуть целыми штуками, сумма = `price × count`), либо `amount` (вернуть произвольную часть стоимости позиции, например для неделимой услуги с `count: 1`). В одном запросе позиции можно смешивать.

```bash
curl -X POST https://api.apipay.kz/api/v1/invoices/42/refund \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Idempotency-Key: refund-order_123-3" \
  -H "Content-Type: application/json" \
  -d '{
    "return_items": [
      { "catalog_item_id": 101, "count": 2 },
      { "catalog_item_id": 205, "amount": 19750 }
    ],
    "reason": "Возврат части заказа",
    "hold_for_buyer_confirmation": true
  }'
```

> У позиции, возвращённой по `amount`, в ответе и в вебхуке `invoice.refunded` будет `refund.items[].count = 0`, а сумма — в `amount`. Это нормально.

### Ответ

`201` — возврат принят и поставлен в очередь:

```json
{
  "message": "Refund queued for processing",
  "refund": {
    "id": 1,
    "invoice_id": 42,
    "amount": "5000.00",
    "status": "pending",
    "reason": "Частичный возврат",
    "created_at": "2026-01-31T14:00:00+00:00",
    "idempotency_key": "refund-order_123-2",
    "buyer_hold": "held"
  },
  "invoice": {
    "id": 42,
    "amount": "10000.00",
    "total_refunded": "0.00",
    "pending_refund_amount": 5000,
    "available_for_refund": 5000
  }
}
```

`200` с `idempotent_replay: true` — повтор той же просьбы с тем же ключом: тот же возврат в его текущем статусе, ничего нового не создано. `buyer_hold`: `held` — удержание выбрано, `released` — снято сотрудником в кабинете ApiPay, `null` или поля нет — удержание не выбирали.

## Идемпотентность и повтор

- **Передавайте `Idempotency-Key`** — свой ключ на каждую просьбу о возврате, например `refund-order_123-1`. Сохраните его рядом с заказом до отправки запроса. Пространство ключей — счёт, регистр значим.
- **Ответ потерялся (таймаут, обрыв связи) — повторяйте только с тем же ключом и тем же телом.** Повтор отвечает `200` с `idempotent_replay: true` и тем же возвратом: второго возврата, нового запроса в Kaspi и повторного вебхука нет. Повтор распознаётся раньше проверок занятости и остатка, поэтому ретрай после собственного успеха не получит «нечего возвращать».
- **Без ключа повтор не распознаётся:** пока первый возврат идёт, придёт `409 qr_refund_link_invoice_busy`, а после него частичный возврат пройдёт второй раз. Без ключа сначала прочитайте `GET /invoices/{id}/refunds`.
- **Тот же ключ с другим телом** — `409 idempotency_key_conflict`: возьмите новый ключ.
- **Новый ключ — только для новой просьбы.** После итогового `failed` устраните причину и отправьте возврат с новым ключом: старый ключ вернёт прежний `failed`.

## Список всех возвратов

**Эндпоинт:** `GET /refunds`

```bash
curl "https://api.apipay.kz/api/v1/refunds?page=1&per_page=20&status[]=completed" \
  -H "X-API-Key: YOUR_API_KEY"
```

### Параметры запроса

| Параметр | Тип | Описание |
|----------|-----|----------|
| `page` | integer | Номер страницы (по умолчанию: 1) |
| `per_page` | integer | Элементов на странице (1-100, по умолчанию: 10) |
| `status[]` | array | Фильтр: `pending`, `processing`, `completed`, `failed` |
| `invoice_id` | integer | Фильтр по ID счёта |
| `date_from` | string | Начало окна включительно: `YYYY-MM-DD` (= календарные сутки мерчанта целиком) или `YYYY-MM-DD HH:MM`. Зона — Asia/Almaty; окно режется по времени операции возврата |
| `date_to` | string | Конец окна включительно, тот же формат |

### Ответ

```json
{
  "data": [
    {
      "id": 5,
      "invoice_id": 42,
      "amount": "5000.00",
      "reason": "Возврат товара",
      "status": "completed",
      "kaspi_refund_id": "REF-123456",
      "kaspi_status": "completed",
      "initiated_by": "api",
      "error_message": null,
      "created_at": "2026-01-31T12:00:00+00:00",
      "invoice": {
        "id": 42,
        "external_order_id": "ORDER-100",
        "amount": "10000.00",
        "status": "partially_refunded",
        "kaspi_invoice_id": "KSP-789"
      },
      "items": [
        {
          "id": 1,
          "refund_id": 5,
          "invoice_item_id": 10,
          "catalog_item_id": 101,
          "name": "Товар А",
          "price": "2500.00",
          "count": 2,
          "amount": "5000.00"
        }
      ]
    }
  ],
  "meta": {
    "current_page": 1,
    "last_page": 3,
    "per_page": 10,
    "total": 25
  }
}
```

`initiated_by` — кто начал возврат: `api`, `dashboard` или `system` (строка, которую синхронизация завела по проведённой операции, например после возврата по ссылке покупателю).

## Список возвратов по счёту

**Эндпоинт:** `GET /invoices/{id}/refunds`

```bash
curl https://api.apipay.kz/api/v1/invoices/42/refunds \
  -H "X-API-Key: YOUR_API_KEY"
```

Это ответ на вопрос «что с деньгами заказа», и именно его стоит регулярно опрашивать для сверки: вебхук может не дойти, а этот список показывает итог.

| Поле | Описание |
|------|----------|
| `invoice.available_for_refund` | Сколько ещё можно вернуть (число, не строка). Учитывает и проведённую ссылку, ещё не подтянутую синхронизацией, и незавершённые возвраты, поэтому может быть меньше `amount − total_refunded`. То же значение приходит в ответе `POST /invoices/{id}/refund` |
| `invoice.refund_in_progress` | Счёт занят: есть незавершённый или неразобранный возврат, живая ссылка покупателю либо удержание. Пока `true`, новый возврат и новая ссылка получат `409 qr_refund_link_invoice_busy` |
| `refunds[].operation_state` | Состояние операции возврата вместе со ссылкой, которую она породила — см. таблицу ниже |
| `refunds[].successor_refund_id` | Строка возврата, которую синхронизация завела по ссылке покупателю, выпущенной по этому возврату. Деньги учитывайте один раз — по преемнику |
| `refunds[].resolved_refund_id` | Разбор неизвестного исхода нашёл ту же операцию Kaspi уже заведённой отдельной строкой: id этой строки |
| `qr_refund_sessions` | Ссылки «Возврат ApiPay» по этому счёту, с `source_refund_id`. Адреса ссылки здесь нет |

| `operation_state` | Что значит |
|---|---|
| `processing` | В очереди или выполняется |
| `completed` | Деньги вернулись — прямым возвратом или ссылкой по нему |
| `failed` | Отказ, деньги не двигались |
| `awaiting_buyer` | Kaspi требует покупателя, а ссылки по возврату ещё нет или все истекли — выпустите ссылку |
| `buyer_link_active` | Ссылка по возврату выпущена и жива |
| `uncertain` | Исход не доказан, деньги, возможно, ушли: не повторяйте |
| `released` | Удержание снято, а завершённой, неразобранной или живой ссылки по возврату нет |

## Статусы возвратов

| Статус | Описание |
|--------|----------|
| `pending` | Возврат инициирован, ожидает обработки |
| `processing` | Обрабатывается Kaspi |
| `completed` | Успешно завершён |
| `failed` | Не удался (напр., отклонён Kaspi) |

### Почему возврат не удался

У возврата со статусом `failed` причина приходит кодом в поле `error_code` — в `GET /invoices/{id}/refunds` и в вебхуке `invoice.refunded` (`refund.error_code`):

| Код | Что значит | Что делать |
|-----|------------|------------|
| `refund_requires_buyer_confirmation` | По этой операции Kaspi требует подтверждения покупателя | Выпустите покупателю ссылку `POST /qr-refunds/links` с `invoice_id` и `source_refund_id` этого возврата — см. [Запасной путь](#запасной-путь-ссылка-покупателю) |
| `refund_rejected_by_kaspi` | Kaspi отклонил возврат по этой операции | То же: ссылка покупателю с `source_refund_id`. Если возврат создан без удержания, его можно повторить позже с новым `Idempotency-Key`. Если покупатель недоступен — сначала отзовите живые ссылки по счёту (`DELETE /qr-refunds/links/{id}`; `id` — в `qr_refund_sessions` ответа `GET /invoices/{id}/refunds`). Ссылку, выпущенную без `source_refund_id`, видно только там: своего `operation_state` у неё нет. Уже открытое окно скана отзыв не прерывает: дождитесь его конца и перечитайте список. Деньги по счёту ещё могут уйти, пока у возврата `operation_state` — `processing` или `buyer_link_active`, а у ссылки статус — `awaiting_customer`, `activating`, `awaiting_scan`, `customer_identified` или `executing`; при `uncertain` у возврата и `execution_uncertain` у ссылки они, возможно, уже ушли. Ни одного такого состояния по счёту остаться не должно: `uncertain` и `execution_uncertain` сначала разберите в кабинете ApiPay. Этот возврат не должен стать `completed`, и после отказа по счёту не должно появиться новой записи `completed` — так выглядит проведённая ссылка без `source_refund_id`. Только после этого проводите возврат вручную в приложении Kaspi Pay — иначе покупатель получит деньги второй раз. После ручного возврата отметьте его в своей системе и по этому возврату ссылку больше не выпускайте, даже если сверка покажет `awaiting_buyer`; если возврат создан с удержанием, снимите его в кабинете ApiPay. |
| `refund_insufficient_funds` | На счёте Kaspi Pay не хватило денег на возврат | Ссылку не выпускайте — она не поможет. Пополните счёт и отправьте новый возврат с новым ключом |
| `refund_window_expired` | Kaspi отклонил возврат: возможно, истёк срок возврата либо возврат уже сделан. Приходит только вебхуком: синхронного `422` у создания возврата нет | Не повторяйте, ссылку не выпускайте |
| `refund_resolved_not_executed` | Неизвестный исход разобран: деньги не ушли | Счёт свободен, при необходимости — новый возврат с новым ключом |
| `refund_resolved_executed` | Неизвестный исход разобран: деньги ушли и учтены строкой `resolved_refund_id` | Новый возврат не создавайте — деньги уже у покупателя |

> ⛔ Сервер не повторяет неудавшийся возврат сам: строка со статусом `failed` сразу финальная. Повтор — новый запрос с **новым** `Idempotency-Key`, и только при кодах, где он имеет смысл.

Полный список кодов — [Коды ошибок](errors.md).

### Неизвестный исход — не повторяйте

⛔ Возврат в статусе `processing` с `error_code: refund_execution_uncertain` (в `GET /invoices/{id}/refunds` у него `operation_state: uncertain`) — исход денежного запроса не доказан, деньги могли уйти. Не повторяйте возврат ни запросом, ни ссылкой покупателю, ни вручную в приложении Kaspi Pay: если деньги уже ушли, ручной возврат вернёт их покупателю второй раз.

Исход отмечает владелец или разработчик организации в карточке счёта в кабинете ApiPay, сверившись с историей операций в Kaspi Pay; если не уверены — поддержка ApiPay. Пока исход не отмечен, счёт занят (`409 qr_refund_link_invoice_busy`) и вебхука нет. После разбора возврат станет `failed` с `refund_resolved_not_executed` (придёт `invoice.refunded`) или `refund_resolved_executed` (вебхука по исходному возврату нет — статус читайте в `GET /invoices/{id}/refunds`).

## Запасной путь: ссылка покупателю

Kaspi иногда не даёт вернуть деньги сразу: возврат завершается `failed` с `refund_requires_buyer_confirmation` или `refund_rejected_by_kaspi`. Тогда приложение само выпускает покупателю ссылку «Возврат ApiPay»: покупатель открывает её и подтверждает возврат, и возврат проводится сам.

1. Создавайте возврат с `hold_for_buyer_confirmation: true`. При отказе этими кодами счёт останется за возвратом: другой возврат и другая ссылка по нему получат `409 qr_refund_link_invoice_busy`, пройдёт только ссылка с его `source_refund_id`. Без флага отказ счёт не держит.
2. На `invoice.refunded` со `status: failed` и одним из двух кодов — либо на `operation_state: awaiting_buyer` при сверке — выпустите ссылку:

```bash
curl -X POST https://api.apipay.kz/api/v1/qr-refunds/links \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"invoice_id": 42, "source_refund_id": 6}'
```

3. Сумму, товары и причину сервер берёт из отказанного возврата: `amount` и `return_items` вместе с `source_refund_id` не передаются.
4. В ответе `201` — `customer_url`. Он выдаётся **ровно один раз** и повторно не получается ни через `GET /qr-refunds/{id}`, ни как-либо ещё. Ссылка предъявительская: кто её откроет, тот и подтвердит возврат. Не пишите адрес в логи, аналитику и тикеты, сразу доставьте покупателю. Срок неактивированной ссылки — `link_expires_at` (24 часа).
5. Ссылка под счёт проводит возврат сама, после подтверждения покупателя. `POST /qr-refunds/{id}/execute` для неё не нужен (он для ссылки без `invoice_id`), немедленный `POST /qr-refunds` — deprecated. Итог приходит вебхуками `qr_refund.*`: `completed`, `failed` (в том числе после `qr_refund.identified`), `expired`, `execution_uncertain` — см. [Webhooks](webhooks.md). При `execution_uncertain` ничего не повторяйте — ни запросом, ни новой ссылкой, ни вручную в приложении Kaspi Pay: обратитесь в поддержку ApiPay.
6. После `qr_refund.completed` может прийти `invoice.refunded` со `status: completed` и **другим** `refund.id` — это строка, которую синхронизация завела по той же операции. Это та же сумма, а не второй возврат: у исходного возврата в `GET /invoices/{id}/refunds` появится `successor_refund_id`, равный этому id.

При других отказах (`refund_insufficient_funds`, `refund_window_expired`) ссылку не выпускайте — покажите причину оператору.

**Новая ссылка по тому же возврату.** Один отказанный возврат — одни деньги. Пока по нему есть живая ссылка или ссылка с неизвестным исходом, новая отклоняется: счёт занят — `409 qr_refund_link_invoice_busy`, источник уже использован — `422` с `errors.source_refund_id`. Истёкшая или несостоявшаяся ссылка источник возвращает — тогда новая ссылка выпускается (`201`). Неактивированную ссылку можно отозвать: `DELETE /qr-refunds/links/{id}`; после подтверждения покупателя — `409 qr_refund_link_not_revocable`.

Снять удержание может сотрудник в кабинете ApiPay — тогда счёт освобождается, а у возврата `operation_state: released`.

## Сверка

Вебхук может не дойти: доставка не гарантирована, а во время паузы отправки события возвратов не досылаются (см. [Webhooks → Доставка](webhooks.md#доставка)). Поэтому по каждому незавершённому возврату периодически читайте `GET /invoices/{id}/refunds` и действуйте по `operation_state`: `awaiting_buyer` — выпустить ссылку, `uncertain` — передать владельцу или разработчику организации: исход отмечается в карточке счёта в кабинете ApiPay, сам по себе он не разберётся; `completed` — отметить возврат в заказе.

## Правила возвратов

1. **Только оплаченные счета** — Можно вернуть счета со статусом `paid` или `partially_refunded`
2. **Несколько частичных возвратов** — Можно сделать несколько частичных возвратов до исходной суммы
3. **Валидация суммы** — Сумма не может превышать `available_for_refund` (в `GET /invoices/{id}/refunds` и в ответе `POST /invoices/{id}/refund`)
4. **Один незавершённый возврат на счёт** — пока по счёту идёт возврат, есть ссылка покупателю или удержание, новый возврат получает `409 qr_refund_link_invoice_busy`
5. **Нужна подключённая Kaspi-касса** — возврат проводится через подключённого кассира. Если кассир отключён, вернуть деньги через API нельзя — возврат делают вручную в приложении Kaspi Pay.

## Песочница

Исход возврата песочного счёта заказывается полем `simulate`: `{"status": "completed"}`, `{"status": "failed", "error_code": "refund_requires_buyer_confirmation"}` (боевой код и вебхук `invoice.refunded`) или `{"status": "uncertain"}` (неизвестный исход, вебхука нет). Отказ с удержанием держит счёт, как в бою. Неизвестный исход разбирает `POST /invoices/{invoice}/refunds/{refund}/simulate-resolve`, удержание снимает `POST /invoices/{invoice}/refunds/{refund}/simulate-release-hold`. Шаги покупателя по ссылке — `POST /qr-refunds/{id}/simulate`. Подробнее — [Песочница](sandbox.md).

## Примеры кода

### JavaScript

```javascript
// Полный возврат: свой ключ на просьбу, удержание до подтверждения покупателя
await fetch('https://api.apipay.kz/api/v1/invoices/42/refund', {
  method: 'POST',
  headers: {
    'X-API-Key': process.env.APIPAY_API_KEY,
    'Idempotency-Key': 'refund-order_123-1',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ reason: 'Отмена заказа клиентом', hold_for_buyer_confirmation: true })
})

// Сверка: что с деньгами заказа
const state = await fetch('https://api.apipay.kz/api/v1/invoices/42/refunds', {
  headers: { 'X-API-Key': process.env.APIPAY_API_KEY }
}).then(r => r.json())
```

### Python

```python
import os
import requests

# Частичный возврат. При таймауте повторяйте с тем же Idempotency-Key и тем же телом.
requests.post('https://api.apipay.kz/api/v1/invoices/42/refund',
    headers={'X-API-Key': os.environ['APIPAY_API_KEY'],
             'Idempotency-Key': 'refund-order_123-2',
             'Content-Type': 'application/json'},
    json={'amount': 5000, 'reason': 'Частичный возврат', 'hold_for_buyer_confirmation': True},
    timeout=15)
```

### PHP

```php
// Полный возврат
$ch = curl_init('https://api.apipay.kz/api/v1/invoices/42/refund');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => [
        'X-API-Key: ' . getenv('APIPAY_API_KEY'),
        'Idempotency-Key: refund-order_123-1',
        'Content-Type: application/json',
    ],
    CURLOPT_POSTFIELDS => json_encode([
        'reason' => 'Отмена заказа клиентом',
        'hold_for_buyer_confirmation' => true,
    ]),
    CURLOPT_RETURNTRANSFER => true
]);
$refund = json_decode(curl_exec($ch), true);
```
