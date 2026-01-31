# Рекуррентные платежи

Рекуррентные счета позволяют автоматически списывать средства с клиентов по расписанию — идеально для подписок, членств и регулярных платежей.

## Создание рекуррентного счёта

**Эндпоинт:** `POST /recurring-invoices`

Создаёт новое расписание рекуррентных платежей.

### Запрос

```bash
curl -X POST https://bpapi.bazarbay.site/api/recurring-invoices \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 5000,
    "phone_number": "87001234567",
    "description": "Ежемесячная подписка",
    "interval": "monthly",
    "start_date": "2025-02-01",
    "end_date": "2025-12-31",
    "webhook_id": 1
  }'
```

### Параметры

| Поле | Тип | Обязательно | Описание |
|------|-----|-------------|----------|
| `amount` | number | Да | Сумма в тенге (0.01 - 99 999 999.99) |
| `phone_number` | string | Да | Телефон клиента (формат: 8XXXXXXXXXX) |
| `description` | string | Нет | Описание платежа (макс. 500 символов) |
| `interval` | string | Да | Интервал: `daily`, `weekly`, `monthly`, `yearly` |
| `start_date` | string | Нет | Дата начала (YYYY-MM-DD, по умолчанию: сегодня) |
| `end_date` | string | Нет | Дата окончания (YYYY-MM-DD) |
| `webhook_id` | number | Нет | ID конкретного webhook |

### Ответ

```json
{
  "id": 1,
  "amount": "5000.00",
  "phone_number": "87001234567",
  "description": "Ежемесячная подписка",
  "interval": "monthly",
  "status": "active",
  "start_date": "2025-02-01",
  "end_date": "2025-12-31",
  "next_billing_date": "2025-02-01",
  "created_at": "2025-01-31T12:00:00Z"
}
```

## Список рекуррентных счетов

**Эндпоинт:** `GET /recurring-invoices`

### Запрос

```bash
curl "https://bpapi.bazarbay.site/api/recurring-invoices?status=active" \
  -H "X-API-Key: YOUR_API_KEY"
```

### Параметры запроса

| Параметр | Тип | Описание |
|----------|-----|----------|
| `page` | integer | Номер страницы |
| `per_page` | integer | Элементов на странице |
| `status` | string | Фильтр: `active`, `paused`, `cancelled` |

## Получение рекуррентного счёта

**Эндпоинт:** `GET /recurring-invoices/:id`

```bash
curl https://bpapi.bazarbay.site/api/recurring-invoices/1 \
  -H "X-API-Key: YOUR_API_KEY"
```

## Обновление рекуррентного счёта

**Эндпоинт:** `PUT /recurring-invoices/:id`

Обновление суммы, описания или интервала.

```bash
curl -X PUT https://bpapi.bazarbay.site/api/recurring-invoices/1 \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 7500,
    "description": "Премиум ежемесячная подписка"
  }'
```

## Приостановка рекуррентного счёта

**Эндпоинт:** `POST /recurring-invoices/:id/pause`

Временно останавливает списания. Можно возобновить позже.

```bash
curl -X POST https://bpapi.bazarbay.site/api/recurring-invoices/1/pause \
  -H "X-API-Key: YOUR_API_KEY"
```

## Возобновление рекуррентного счёта

**Эндпоинт:** `POST /recurring-invoices/:id/resume`

Возобновляет приостановленный рекуррентный счёт.

```bash
curl -X POST https://bpapi.bazarbay.site/api/recurring-invoices/1/resume \
  -H "X-API-Key: YOUR_API_KEY"
```

## Отмена рекуррентного счёта

**Эндпоинт:** `POST /recurring-invoices/:id/cancel`

Окончательно отменяет рекуррентный счёт. Нельзя возобновить.

```bash
curl -X POST https://bpapi.bazarbay.site/api/recurring-invoices/1/cancel \
  -H "X-API-Key: YOUR_API_KEY"
```

## Немедленное списание

**Эндпоинт:** `POST /recurring-invoices/:id/bill-now`

Запускает немедленное списание, создавая новый счёт прямо сейчас.

```bash
curl -X POST https://bpapi.bazarbay.site/api/recurring-invoices/1/bill-now \
  -H "X-API-Key: YOUR_API_KEY"
```

## Пропуск периода

**Эндпоинт:** `POST /recurring-invoices/:id/skip-period`

Пропускает следующий период списания без создания счёта.

```bash
curl -X POST https://bpapi.bazarbay.site/api/recurring-invoices/1/skip-period \
  -H "X-API-Key: YOUR_API_KEY"
```

## Статусы рекуррентных счетов

| Статус | Описание |
|--------|----------|
| `active` | Списания по расписанию |
| `paused` | Временно приостановлен |
| `cancelled` | Окончательно отменён |

## Переходы статусов

```
active ←→ paused
   ↓
cancelled
```

## Примеры кода

### JavaScript

```javascript
// Создание ежемесячной подписки
const response = await fetch('https://bpapi.bazarbay.site/api/recurring-invoices', {
  method: 'POST',
  headers: {
    'X-API-Key': 'YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    amount: 5000,
    phone_number: '87001234567',
    description: 'Ежемесячная подписка',
    interval: 'monthly'
  })
})
const subscription = await response.json()
console.log(`Следующее списание: ${subscription.next_billing_date}`)
```

### Python

```python
import requests

# Создание еженедельного рекуррентного счёта
response = requests.post(
    'https://bpapi.bazarbay.site/api/recurring-invoices',
    headers={
        'X-API-Key': 'YOUR_API_KEY',
        'Content-Type': 'application/json'
    },
    json={
        'amount': 1000,
        'phone_number': '87001234567',
        'description': 'Еженедельная доставка',
        'interval': 'weekly'
    }
)
subscription = response.json()
```

### PHP

```php
// Создание годовой подписки
$ch = curl_init('https://bpapi.bazarbay.site/api/recurring-invoices');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => [
        'X-API-Key: YOUR_API_KEY',
        'Content-Type: application/json'
    ],
    CURLOPT_POSTFIELDS => json_encode([
        'amount' => 50000,
        'phone_number' => '87001234567',
        'description' => 'Годовое членство',
        'interval' => 'yearly'
    ]),
    CURLOPT_RETURNTRANSFER => true
]);
$subscription = json_decode(curl_exec($ch), true);
```

## Интервалы списания

| Интервал | Описание |
|----------|----------|
| `daily` | Каждый день в то же время |
| `weekly` | Каждые 7 дней |
| `monthly` | В тот же день каждого месяца |
| `yearly` | В тот же день каждого года |

## Лучшие практики

1. **Устанавливайте дату окончания для пробных периодов** — Используйте `end_date` для ограниченных предложений
2. **Используйте webhooks** — Получайте уведомления об успешных и неудачных платежах
3. **Обрабатывайте ошибки** — Приостановленные подписки означают проблемы с оплатой
4. **Позволяйте клиентам приостанавливать** — Лучше, чем отмена
5. **Обновляйте, а не пересоздавайте** — Используйте PUT для изменения условий подписки
