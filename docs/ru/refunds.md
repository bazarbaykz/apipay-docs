# Возвраты

Обработка полных и частичных возвратов по оплаченным счетам.

## Создание возврата

**Эндпоинт:** `POST /invoices/:id/refund`

Создаёт возврат по оплаченному счёту. Можно вернуть полную сумму или часть.

### Полный возврат

```bash
curl -X POST https://bpapi.bazarbay.site/api/invoices/42/refund \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "По запросу клиента"
  }'
```

### Частичный возврат

```bash
curl -X POST https://bpapi.bazarbay.site/api/invoices/42/refund \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 5000,
    "reason": "Частичный возврат"
  }'
```

### Параметры

| Поле | Тип | Обязательно | Описание |
|------|-----|-------------|----------|
| `amount` | number | Нет | Сумма частичного возврата. Пропустите для полного возврата. |
| `reason` | string | Нет | Причина возврата (макс. 500 символов) |

### Ответ

```json
{
  "id": 1,
  "invoice_id": 42,
  "amount": "5000.00",
  "status": "completed",
  "reason": "Частичный возврат",
  "created_at": "2025-01-31T14:00:00Z"
}
```

## Список всех возвратов

**Эндпоинт:** `GET /refunds`

Возвращает все возвраты по всем счетам.

```bash
curl "https://bpapi.bazarbay.site/api/refunds?page=1&per_page=20" \
  -H "X-API-Key: YOUR_API_KEY"
```

### Параметры запроса

| Параметр | Тип | Описание |
|----------|-----|----------|
| `page` | integer | Номер страницы |
| `per_page` | integer | Элементов на странице |

### Ответ

```json
{
  "data": [
    {
      "id": 1,
      "invoice_id": 42,
      "amount": "5000.00",
      "status": "completed",
      "reason": "Частичный возврат",
      "created_at": "2025-01-31T14:00:00Z"
    }
  ],
  "meta": {
    "current_page": 1,
    "per_page": 20,
    "total": 5
  }
}
```

## Получение возврата

**Эндпоинт:** `GET /refunds/:id`

Получение деталей конкретного возврата.

```bash
curl https://bpapi.bazarbay.site/api/refunds/1 \
  -H "X-API-Key: YOUR_API_KEY"
```

## Список возвратов по счёту

**Эндпоинт:** `GET /invoices/:id/refunds`

Получение всех возвратов по конкретному счёту.

```bash
curl https://bpapi.bazarbay.site/api/invoices/42/refunds \
  -H "X-API-Key: YOUR_API_KEY"
```

### Ответ

```json
{
  "data": [
    {
      "id": 1,
      "amount": "3000.00",
      "status": "completed",
      "reason": "Первый частичный возврат",
      "created_at": "2025-01-31T14:00:00Z"
    },
    {
      "id": 2,
      "amount": "2000.00",
      "status": "completed",
      "reason": "Второй частичный возврат",
      "created_at": "2025-01-31T15:00:00Z"
    }
  ]
}
```

## Правила возвратов

1. **Только оплаченные счета** — Можно вернуть только счета со статусом `status: "paid"`
2. **Несколько частичных возвратов** — Можно сделать несколько частичных возвратов до исходной суммы
3. **Валидация суммы** — Сумма частичного возврата не может превышать оставшуюся для возврата сумму

## Примеры кода

### JavaScript

```javascript
// Полный возврат
const fullRefund = await fetch('https://bpapi.bazarbay.site/api/invoices/42/refund', {
  method: 'POST',
  headers: {
    'X-API-Key': 'YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    reason: 'Отмена заказа клиентом'
  })
})

// Частичный возврат
const partialRefund = await fetch('https://bpapi.bazarbay.site/api/invoices/42/refund', {
  method: 'POST',
  headers: {
    'X-API-Key': 'YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    amount: 5000,
    reason: 'Частичный возврат - повреждённый товар'
  })
})
```

### Python

```python
import requests

# Полный возврат
response = requests.post(
    'https://bpapi.bazarbay.site/api/invoices/42/refund',
    headers={
        'X-API-Key': 'YOUR_API_KEY',
        'Content-Type': 'application/json'
    },
    json={
        'reason': 'Отмена заказа клиентом'
    }
)

# Частичный возврат
response = requests.post(
    'https://bpapi.bazarbay.site/api/invoices/42/refund',
    headers={
        'X-API-Key': 'YOUR_API_KEY',
        'Content-Type': 'application/json'
    },
    json={
        'amount': 5000,
        'reason': 'Частичный возврат'
    }
)
```

### PHP

```php
// Полный возврат
$ch = curl_init('https://bpapi.bazarbay.site/api/invoices/42/refund');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => [
        'X-API-Key: YOUR_API_KEY',
        'Content-Type: application/json'
    ],
    CURLOPT_POSTFIELDS => json_encode([
        'reason' => 'Отмена заказа клиентом'
    ]),
    CURLOPT_RETURNTRANSFER => true
]);
$refund = json_decode(curl_exec($ch), true);

// Частичный возврат
$ch = curl_init('https://bpapi.bazarbay.site/api/invoices/42/refund');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => [
        'X-API-Key: YOUR_API_KEY',
        'Content-Type: application/json'
    ],
    CURLOPT_POSTFIELDS => json_encode([
        'amount' => 5000,
        'reason' => 'Частичный возврат'
    ]),
    CURLOPT_RETURNTRANSFER => true
]);
$refund = json_decode(curl_exec($ch), true);
```

## Лучшие практики

1. **Всегда указывайте причину** — Помогает с бухгалтерией и обслуживанием клиентов
2. **Отслеживайте суммы возвратов** — Ведите записи общей суммы возвратов по счёту
3. **Валидируйте перед возвратом** — Проверяйте статус счёта и оставшуюся сумму
4. **Уведомляйте клиентов** — Отправляйте подтверждение при обработке возврата
