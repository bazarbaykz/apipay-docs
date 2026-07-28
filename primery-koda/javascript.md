# JavaScript

Пример на Node.js 18+ — без зависимостей: `fetch` там встроенный.
Ключ читается из переменной окружения `APIPAY_API_KEY`: не храните его в коде
и не коммитьте в репозиторий.

## Создание счёта

```js
const API_KEY = process.env.APIPAY_API_KEY
const API_BASE_URL = 'https://api.apipay.kz/api/v1'

async function createInvoice() {
  const response = await fetch(`${API_BASE_URL}/invoices`, {
    method: 'POST',
    headers: {
      'X-API-Key': API_KEY,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({
      amount: 10000, // сумма в тенге
      phone_number: '87001234567', // телефон клиента, формат 8XXXXXXXXXX
      description: 'Оплата заказа #123',
      external_order_id: 'order_123' // ваш ID заказа для сопоставления
    })
  })

  if (!response.ok) {
    const error = await response.json()
    // Стабильный snake_case-код лежит в error_code. На 422 (ошибка валидации)
    // его нет вовсе — там message и объект errors с разбивкой по полям,
    // поэтому нужен запасной вариант.
    throw new Error(`HTTP ${response.status}: ${error.error_code ?? error.message}`)
  }

  return response.json()
}

async function main() {
  if (!API_KEY) {
    console.error('Не задана переменная окружения APIPAY_API_KEY')
    process.exit(1)
  }

  const invoice = await createInvoice()
  console.log(`Счёт №${invoice.id} создан, статус: ${invoice.status}`)
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
```

Запуск:

```bash
APIPAY_API_KEY=your_api_key node create-invoice.js
```

Логику стройте по `error_code`, а не по тексту `message` — текст может меняться.
Полный список кодов — в разделе [Ошибки](../docs/ru/errors.md).

## Статус `processing` — это не отказ

Ответ `201` приходит со `status: "processing"`: счёт принят нами, но в Kaspi ещё
не ушёл. Финальный статус придёт вебхуком `invoice.status_changed`
(см. [Вебхуки](../docs/ru/webhooks.md)) либо по `GET /invoices/{id}`. Не создавайте
счёт заново, пока он в `processing`, — получите второй счёт на ту же сумму.

## Готовые примеры

Рабочие скрипты целиком лежат в [`../examples/javascript/`](../examples/javascript/):

| Файл | Что показывает |
|------|----------------|
| `create-invoice.js` | Создание счёта |
| `check-client.js` | Проверка клиента по номеру телефона |
| `create-subscription.js` | Подписка (регулярные списания) |
| `manage-catalog.js` | Работа с каталогом товаров |
| `webhook-handler.js` | Приём и проверка подписи вебхука |
| `partner-onboarding.js` | Подключение организации через Partner API |
