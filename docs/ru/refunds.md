# Возвраты

Обработка полных и частичных возвратов по оплаченным счетам.

## Создание возврата

**Эндпоинт:** `POST /invoices/{id}/refund`

### Полный возврат

```bash
curl -X POST https://bpapi.bazarbay.site/api/v1/invoices/42/refund \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"reason": "По запросу клиента"}'
```

### Частичный возврат

```bash
curl -X POST https://bpapi.bazarbay.site/api/v1/invoices/42/refund \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"amount": 5000, "reason": "Частичный возврат"}'
```

### Параметры

| Поле | Тип | Обязательно | Описание |
|------|-----|-------------|----------|
| `amount` | number | Нет | Сумма частичного возврата (0.01-99999999.99). Пропустите для полного возврата. |
| `reason` | string | Нет | Причина возврата (макс. 500 символов) |

### Ответ

```json
{
  "message": "Возврат инициирован успешно",
  "refund": {
    "id": 1,
    "invoice_id": 42,
    "amount": "5000.00",
    "status": "pending",
    "reason": "Частичный возврат",
    "initiated_by": "api",
    "created_at": "2025-01-31T14:00:00Z"
  },
  "invoice": {
    "id": 42,
    "amount": "10000.00",
    "status": "partially_refunded",
    "total_refunded": "5000.00",
    "available_for_refund": "5000.00"
  }
}
```

## Список всех возвратов

**Эндпоинт:** `GET /refunds`

```bash
curl "https://bpapi.bazarbay.site/api/v1/refunds?page=1&per_page=20&status[]=completed" \
  -H "X-API-Key: YOUR_API_KEY"
```

### Параметры запроса

| Параметр | Тип | Описание |
|----------|-----|----------|
| `page` | integer | Номер страницы (по умолчанию: 1) |
| `per_page` | integer | Элементов на странице (1-100, по умолчанию: 10) |
| `status[]` | array | Фильтр: `pending`, `processing`, `completed`, `failed` |
| `invoice_id` | integer | Фильтр по ID счёта |
| `date_from` | string | Начальная дата (YYYY-MM-DD) |
| `date_to` | string | Конечная дата (YYYY-MM-DD) |

## Список возвратов по счёту

**Эндпоинт:** `GET /invoices/{id}/refunds`

```bash
curl https://bpapi.bazarbay.site/api/v1/invoices/42/refunds \
  -H "X-API-Key: YOUR_API_KEY"
```

## Статусы возвратов

| Статус | Описание |
|--------|----------|
| `pending` | Возврат инициирован, ожидает обработки |
| `processing` | Обрабатывается Kaspi |
| `completed` | Успешно завершён |
| `failed` | Не удался (напр., отклонён Kaspi) |

## Правила возвратов

1. **Только оплаченные счета** — Можно вернуть счета со статусом `paid` или `partially_refunded`
2. **Несколько частичных возвратов** — Можно сделать несколько частичных возвратов до исходной суммы
3. **Валидация суммы** — Сумма не может превышать `available_for_refund`

## Примеры кода

### JavaScript

```javascript
// Полный возврат
await fetch('https://bpapi.bazarbay.site/api/v1/invoices/42/refund', {
  method: 'POST',
  headers: { 'X-API-Key': 'YOUR_API_KEY', 'Content-Type': 'application/json' },
  body: JSON.stringify({ reason: 'Отмена заказа клиентом' })
})

// Частичный возврат
await fetch('https://bpapi.bazarbay.site/api/v1/invoices/42/refund', {
  method: 'POST',
  headers: { 'X-API-Key': 'YOUR_API_KEY', 'Content-Type': 'application/json' },
  body: JSON.stringify({ amount: 5000, reason: 'Частичный возврат' })
})

// Список возвратов с фильтрами
const refunds = await fetch(
  'https://bpapi.bazarbay.site/api/v1/refunds?status[]=completed&date_from=2025-01-01',
  { headers: { 'X-API-Key': 'YOUR_API_KEY' } }
)
```

### Python

```python
import requests

# Полный возврат
requests.post('https://bpapi.bazarbay.site/api/v1/invoices/42/refund',
    headers={'X-API-Key': 'YOUR_API_KEY', 'Content-Type': 'application/json'},
    json={'reason': 'Отмена заказа клиентом'})

# Частичный возврат
requests.post('https://bpapi.bazarbay.site/api/v1/invoices/42/refund',
    headers={'X-API-Key': 'YOUR_API_KEY', 'Content-Type': 'application/json'},
    json={'amount': 5000, 'reason': 'Частичный возврат'})
```

### PHP

```php
// Полный возврат
$ch = curl_init('https://bpapi.bazarbay.site/api/v1/invoices/42/refund');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => ['X-API-Key: YOUR_API_KEY', 'Content-Type: application/json'],
    CURLOPT_POSTFIELDS => json_encode(['reason' => 'Отмена заказа клиентом']),
    CURLOPT_RETURNTRANSFER => true
]);
$refund = json_decode(curl_exec($ch), true);
```
