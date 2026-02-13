# Счета

Счета — основа ApiPay.kz. Каждый счёт представляет запрос на оплату, который вы отправляете клиенту.

## Создание счёта

**Эндпоинт:** `POST /invoices`

Поддерживает два режима: фиксированная сумма или корзина товаров.

### Запрос (фиксированная сумма)

```bash
curl -X POST https://bpapi.bazarbay.site/api/v1/invoices \
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
curl -X POST https://bpapi.bazarbay.site/api/v1/invoices \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "87001234567",
    "description": "Заказ из каталога",
    "cart_items": [
      {"catalog_item_id": 101, "count": 2},
      {"catalog_item_id": 205, "count": 3}
    ]
  }'
```

Сумма рассчитывается автоматически из цен товаров каталога.

### Параметры

| Поле | Тип | Обязательно | Описание |
|------|-----|-------------|----------|
| `amount` | number | Да* | Сумма в тенге (0.01 - 99 999 999.99). *Не обязательно при наличии cart_items. |
| `phone_number` | string | Да | Телефон клиента (формат: 8XXXXXXXXXX) |
| `description` | string | Нет | Описание платежа (макс. 500 символов) |
| `external_order_id` | string | Нет | Ваш ID заказа для сопоставления (макс. 255 символов) |
| `webhook_id` | number | Нет | ID конкретного webhook из личного кабинета |
| `cart_items` | array | Нет | Массив товаров корзины (заменяет amount) |

### Поля товара корзины

| Поле | Тип | Обязательно | Описание |
|------|-----|-------------|----------|
| `catalog_item_id` | integer | Да | ID товара из каталога (из GET /catalog) |
| `count` | integer | Да | Количество (мин. 1) |

### Ответ

```json
{
  "id": 124,
  "amount": "10000.00",
  "status": "pending",
  "description": "Оплата заказа #123",
  "external_order_id": "order_123",
  "phone_number": "87001234567",
  "created_at": "2025-01-31T12:00:00Z"
}
```

## Список счетов

**Эндпоинт:** `GET /invoices`

```bash
curl "https://bpapi.bazarbay.site/api/v1/invoices?page=1&per_page=20&status[]=paid&sort_by=created_at&sort_order=desc" \
  -H "X-API-Key: YOUR_API_KEY"
```

### Параметры запроса

| Параметр | Тип | По умолчанию | Описание |
|----------|-----|--------------|----------|
| `page` | integer | 1 | Номер страницы |
| `per_page` | integer | 10 | Элементов на странице (1-100) |
| `search` | string | — | Поиск по описанию/ID заказа |
| `status[]` | array | — | Фильтр по статусу |
| `date_from` | string | — | Начальная дата (YYYY-MM-DD) |
| `date_to` | string | — | Конечная дата (YYYY-MM-DD) |
| `sort_by` | string | created_at | Поле сортировки |
| `sort_order` | string | desc | `asc` или `desc` |

## Получение счёта

**Эндпоинт:** `GET /invoices/{id}`

```bash
curl https://bpapi.bazarbay.site/api/v1/invoices/42 \
  -H "X-API-Key: YOUR_API_KEY"
```

> Ответ включает массив `items` — снимок товаров корзины при создании счёта: `[{ id, invoice_id, catalog_item_id, name, price, count, unit_id }]`.

## Отмена счёта

**Эндпоинт:** `POST /invoices/{id}/cancel`

Можно отменить только счета со статусом `pending`. Может вернуть `202 Accepted` со статусом `cancelling` при асинхронной обработке.

```bash
curl -X POST https://bpapi.bazarbay.site/api/v1/invoices/42/cancel \
  -H "X-API-Key: YOUR_API_KEY"
```

## Проверка статуса счетов

**Эндпоинт:** `POST /invoices/status/check`

Принудительная проверка статуса всех pending-счетов организации. Полезно при задержке webhooks.

```bash
curl -X POST https://bpapi.bazarbay.site/api/v1/invoices/status/check \
  -H "X-API-Key: YOUR_API_KEY"
```

## Возврат по счёту

**Эндпоинт:** `POST /invoices/{id}/refund`

Подробнее: [Возвраты](refunds.md).

## Список возвратов по счёту

**Эндпоинт:** `GET /invoices/{id}/refunds`

```bash
curl https://bpapi.bazarbay.site/api/v1/invoices/42/refunds \
  -H "X-API-Key: YOUR_API_KEY"
```

## Статусы счетов

| Статус | Описание | Можно отменить | Можно вернуть |
|--------|----------|----------------|---------------|
| `pending` | Ожидает оплаты | Да | Нет |
| `cancelling` | Отменяется (асинхронно) | Нет | Нет |
| `paid` | Оплачен | Нет | Да |
| `cancelled` | Отменён вручную | Нет | Нет |
| `expired` | Истёк срок оплаты | Нет | Нет |
| `partially_refunded` | Частичный возврат | Нет | Да |
| `refunded` | Полный возврат | Нет | Нет |

## Переходы статусов

```
pending → paid → partially_refunded → refunded
    ↓        ↓
cancelling   refunded
    ↓
cancelled

pending → expired
```

## Примеры кода

### JavaScript

```javascript
const response = await fetch('https://bpapi.bazarbay.site/api/v1/invoices', {
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
    'https://bpapi.bazarbay.site/api/v1/invoices',
    headers={'X-API-Key': 'YOUR_API_KEY', 'Content-Type': 'application/json'},
    json={'amount': 10000, 'phone_number': '87001234567', 'description': 'Заказ #123'}
)
invoice = response.json()
```

### PHP

```php
$ch = curl_init('https://bpapi.bazarbay.site/api/v1/invoices');
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
