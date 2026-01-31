# Счета

Счета — основа ApiPay.kz. Каждый счёт представляет запрос на оплату, который вы отправляете клиенту.

## Создание счёта

**Эндпоинт:** `POST /invoices`

Создаёт новый счёт на оплату. Клиент должен оплатить до истечения срока действия.

### Запрос

```bash
curl -X POST https://bpapi.bazarbay.site/api/invoices \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 10000,
    "phone_number": "87001234567",
    "description": "Оплата заказа #123",
    "external_order_id": "order_123",
    "webhook_id": 1
  }'
```

### Параметры

| Поле | Тип | Обязательно | Описание |
|------|-----|-------------|----------|
| `amount` | number | Да | Сумма в тенге (0.01 - 99 999 999.99) |
| `phone_number` | string | Да | Телефон клиента (формат: 8XXXXXXXXXX) |
| `description` | string | Нет | Описание платежа (макс. 500 символов) |
| `external_order_id` | string | Нет | Ваш ID заказа для сопоставления (макс. 255 символов) |
| `webhook_id` | number | Нет | ID конкретного webhook из личного кабинета |

### Ответ

```json
{
  "id": 42,
  "kaspi_invoice_id": "13234689513",
  "kaspi_qr_token": "abc123xyz",
  "payment_url": "https://kaspi.kz/pay/...",
  "amount": "10000.00",
  "status": "pending",
  "description": "Оплата заказа #123",
  "external_order_id": "order_123",
  "created_at": "2025-01-31T12:00:00Z"
}
```

### Поля ответа

| Поле | Описание |
|------|----------|
| `id` | Внутренний ID счёта |
| `kaspi_invoice_id` | ID счёта в системе Kaspi |
| `kaspi_qr_token` | Токен для генерации QR-кода |
| `payment_url` | URL для редиректа клиента на оплату |
| `amount` | Сумма счёта |
| `status` | Текущий статус |
| `created_at` | Время создания |

## Список счетов

**Эндпоинт:** `GET /invoices`

Возвращает список счетов с пагинацией.

### Запрос

```bash
curl "https://bpapi.bazarbay.site/api/invoices?page=1&per_page=20&status[]=paid" \
  -H "X-API-Key: YOUR_API_KEY"
```

### Параметры запроса

| Параметр | Тип | По умолчанию | Описание |
|----------|-----|--------------|----------|
| `page` | integer | 1 | Номер страницы |
| `per_page` | integer | 10 | Элементов на странице (1-100) |
| `search` | string | — | Поиск по описанию/ID заказа (макс. 100 символов) |
| `status[]` | array | — | Фильтр по статусу (pending, paid, cancelled, expired) |
| `date_from` | string | — | Начальная дата (YYYY-MM-DD) |
| `date_to` | string | — | Конечная дата (YYYY-MM-DD, должна быть >= date_from) |

### Ответ

```json
{
  "data": [
    {
      "id": 42,
      "amount": "10000.00",
      "status": "paid",
      "description": "Заказ #123",
      "created_at": "2025-01-31T12:00:00Z",
      "paid_at": "2025-01-31T12:05:00Z"
    }
  ],
  "meta": {
    "current_page": 1,
    "per_page": 20,
    "total": 150
  }
}
```

## Получение счёта

**Эндпоинт:** `GET /invoices/:id`

Возвращает детали конкретного счёта.

### Запрос

```bash
curl https://bpapi.bazarbay.site/api/invoices/42 \
  -H "X-API-Key: YOUR_API_KEY"
```

### Ответ

```json
{
  "id": 42,
  "kaspi_invoice_id": "13234689513",
  "amount": "10000.00",
  "status": "paid",
  "description": "Оплата заказа #123",
  "external_order_id": "order_123",
  "client_name": "Иван Иванов",
  "client_phone": "87001234567",
  "created_at": "2025-01-31T12:00:00Z",
  "paid_at": "2025-01-31T12:05:00Z"
}
```

## Отмена счёта

**Эндпоинт:** `POST /invoices/:id/cancel`

Отменяет ожидающий счёт. Можно отменить только счета со статусом `status: "pending"`.

### Запрос

```bash
curl -X POST https://bpapi.bazarbay.site/api/invoices/42/cancel \
  -H "X-API-Key: YOUR_API_KEY"
```

### Ответ

```json
{
  "id": 42,
  "status": "cancelled",
  "cancelled_at": "2025-01-31T12:10:00Z"
}
```

### Ошибки

| Статус | Описание |
|--------|----------|
| 400 | Счёт нельзя отменить (не pending) |
| 404 | Счёт не найден |

## Статусы счетов

| Статус | Описание | Можно отменить | Можно вернуть |
|--------|----------|----------------|---------------|
| `pending` | Ожидает оплаты | Да | Нет |
| `paid` | Оплачен | Нет | Да |
| `cancelled` | Отменён вручную | Нет | Нет |
| `expired` | Истёк срок оплаты | Нет | Нет |

## Переходы статусов

```
pending → paid → (refunded)
    ↓
cancelled

pending → expired
```

## Примеры кода

### JavaScript

```javascript
// Создание счёта
const response = await fetch('https://bpapi.bazarbay.site/api/invoices', {
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
// Редирект клиента на invoice.payment_url
```

### Python

```python
import requests

response = requests.post(
    'https://bpapi.bazarbay.site/api/invoices',
    headers={
        'X-API-Key': 'YOUR_API_KEY',
        'Content-Type': 'application/json'
    },
    json={
        'amount': 10000,
        'phone_number': '87001234567',
        'description': 'Оплата заказа #123'
    }
)
invoice = response.json()
# Редирект клиента на invoice['payment_url']
```

### PHP

```php
$ch = curl_init('https://bpapi.bazarbay.site/api/invoices');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => [
        'X-API-Key: YOUR_API_KEY',
        'Content-Type: application/json'
    ],
    CURLOPT_POSTFIELDS => json_encode([
        'amount' => 10000,
        'phone_number' => '87001234567',
        'description' => 'Оплата заказа #123'
    ]),
    CURLOPT_RETURNTRANSFER => true
]);
$response = json_decode(curl_exec($ch), true);
// Редирект клиента на $response['payment_url']
```

## Лучшие практики

1. **Всегда сохраняйте `external_order_id`** — Используйте для сопоставления счетов с заказами
2. **Обрабатывайте все статусы** — Проверяйте статус счёта перед действием
3. **Настройте webhooks** — Не полагайтесь на polling для проверки статуса
4. **Проверяйте суммы** — Убедитесь, что суммы соответствуют вашим заказам
5. **Обрабатывайте истечение** — Счета истекают, создавайте новые при необходимости
