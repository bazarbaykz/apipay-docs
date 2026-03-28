# Подписки

Подписки позволяют автоматически выставлять счета клиентам по расписанию.

## Создание подписки

**Эндпоинт:** `POST /subscriptions`

```bash
curl -X POST https://bpapi.bazarbay.site/api/v1/subscriptions \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 5000,
    "phone_number": "87001234567",
    "subscriber_name": "Иван Иванов",
    "description": "Ежемесячная подписка",
    "billing_period": "monthly",
    "billing_day": 1
  }'
```

### Параметры

| Поле | Тип | Обязательно | Описание |
|------|-----|-------------|----------|
| `amount` | number | Условно | Сумма в тенге (100 - 1 000 000). Не нужно при `cart_items` |
| `phone_number` | string | Да | Телефон клиента (формат: 8XXXXXXXXXX) |
| `billing_period` | string | Да | Период списания |
| `billing_day` | integer | Нет | День списания (1-28) |
| `description` | string | Нет | Описание (макс. 255) |
| `subscriber_name` | string | Нет | Имя подписчика (макс. 255) |
| `external_subscriber_id` | string | Нет | Ваш ID подписчика (макс. 255) |
| `started_at` | string | Нет | Дата начала (YYYY-MM-DD) |
| `max_retry_attempts` | integer | Нет | Макс. попыток повтора (1-10) |
| `retry_interval_hours` | integer | Нет | Часов между попытками (1-168) |
| `grace_period_days` | integer | Нет | Льготный период в днях (1-30) |
| `metadata` | object | Нет | Произвольные данные |
| `webhook_id` | number | Нет | ID webhook из личного кабинета |
| `cart_items` | array | Нет | Корзина `[{ catalog_item_id, count }]` (для организаций с каталогом, пересчитывает amount) |

### Периоды списания

| Период | Описание |
|--------|----------|
| `daily` | Каждый день |
| `weekly` | Раз в неделю |
| `biweekly` | Раз в две недели |
| `monthly` | Раз в месяц |
| `quarterly` | Раз в квартал |
| `yearly` | Раз в год |

## Список подписок

**Эндпоинт:** `GET /subscriptions`

### Параметры запроса

| Параметр | Тип | Описание |
|----------|-----|----------|
| `page` | integer | Номер страницы (по умолч. 1) |
| `per_page` | integer | Элементов на странице (1-100, по умолч. 10) |
| `status` | string | Фильтр: `active`, `paused`, `cancelled`, `expired` |
| `phone_number` | string | Фильтр по телефону |
| `external_subscriber_id` | string | Фильтр по вашему ID подписчика |
| `search` | string | Поиск по имени/телефону |
| `billing_period` | string | Фильтр: daily, weekly, biweekly, monthly, quarterly, yearly |
| `sort_by` | string | Поле сортировки (id, amount, subscriber_name, next_billing_at, created_at) |
| `sort_order` | string | `asc` или `desc` |

## Получение подписки

**Эндпоинт:** `GET /subscriptions/{id}`

Возвращает подписку со статистикой и последним платежом.

### Поля stats

| Поле | Тип | Описание |
|------|-----|----------|
| `total_payments` | integer | Всего платежей |
| `successful_payments` | integer | Успешных платежей |
| `failed_payments` | integer | Неуспешных платежей |
| `total_collected` | string | Общая собранная сумма |

### Поле last_payment

| Поле | Тип | Описание |
|------|-----|----------|
| `amount` | string | Сумма платежа |
| `status` | string | Статус |
| `paid_at` | string | Дата оплаты (ISO 8601) |

## Обновление подписки

**Эндпоинт:** `PUT /subscriptions/{id}`

Обновляемые поля: `amount`, `billing_day`, `description`, `subscriber_name`, `max_retry_attempts`, `retry_interval_hours`, `grace_period_days`, `metadata`, `cart_items`.

## Приостановка

**Эндпоинт:** `POST /subscriptions/{id}/pause`

## Возобновление

**Эндпоинт:** `POST /subscriptions/{id}/resume`

## Отмена

**Эндпоинт:** `POST /subscriptions/{id}/cancel`

Отмена окончательна — нельзя возобновить.

## Счета подписки

**Эндпоинт:** `GET /subscriptions/{id}/invoices`

### Структура элемента (SubscriptionInvoiceResource)

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | integer | ID записи подписочного счёта |
| `invoice_id` | integer | ID связанного счёта |
| `billing_period_start` | string | Начало периода (YYYY-MM-DD) |
| `billing_period_end` | string | Конец периода (YYYY-MM-DD) |
| `billing_period_label` | string | Человекочитаемый период |
| `amount` | string | Сумма |
| `attempt_number` | integer | Номер попытки |
| `status` | string | Статус |
| `status_label` | string | Человекочитаемый статус |
| `status_color` | string | Цвет для UI |
| `paid_at` | string\|null | Дата оплаты (ISO 8601) |
| `failure_reason` | string\|null | Причина ошибки |
| `invoice` | object | `{ id, kaspi_invoice_id, status }` |
| `created_at` | string | Дата создания (ISO 8601) |

## Статусы

| Статус | Описание |
|--------|----------|
| `active` | Списания по расписанию |
| `paused` | Приостановлена |
| `cancelled` | Отменена |
| `expired` | Истекла (grace period закончился) |

## Grace Period

При неудачном платеже запускается льготный период:

1. **Платёж не прошёл** — система повторяет попытку
2. **Повторы** — до `max_retry_attempts` раз с интервалом `retry_interval_hours`
3. **Подписка активна** — во время повторов подписка остаётся `active`
4. **Истечение** — если все повторы неудачны, подписка переходит в `expired`

Webhook-события: `subscription.payment_failed`, `subscription.grace_period_started`, `subscription.payment_succeeded`, `subscription.expired`. См. [Webhooks](webhooks.md).

## Примеры кода

### JavaScript

```javascript
const response = await fetch('https://bpapi.bazarbay.site/api/v1/subscriptions', {
  method: 'POST',
  headers: { 'X-API-Key': 'YOUR_API_KEY', 'Content-Type': 'application/json' },
  body: JSON.stringify({
    amount: 5000, phone_number: '87001234567', billing_period: 'monthly', billing_day: 1
  })
})
```

### Python

```python
import requests
requests.post('https://bpapi.bazarbay.site/api/v1/subscriptions',
    headers={'X-API-Key': 'YOUR_API_KEY', 'Content-Type': 'application/json'},
    json={'amount': 5000, 'phone_number': '87001234567', 'billing_period': 'monthly'})
```

### PHP

```php
$ch = curl_init('https://bpapi.bazarbay.site/api/v1/subscriptions');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => ['X-API-Key: YOUR_API_KEY', 'Content-Type: application/json'],
    CURLOPT_POSTFIELDS => json_encode(['amount' => 5000, 'phone_number' => '87001234567', 'billing_period' => 'monthly']),
    CURLOPT_RETURNTRANSFER => true
]);
$subscription = json_decode(curl_exec($ch), true);
```
