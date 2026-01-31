# Webhooks

Webhooks позволяют получать уведомления о платежах в реальном времени. Вместо постоянного опроса API ApiPay.kz будет отправлять HTTP POST запросы на ваш сервер.

## Настройка

Webhooks настраиваются в [Личном кабинете ApiPay.kz](https://baypay.bazarbay.site):

1. Перейдите в **Настройки → Подключение**
2. Нажмите **Добавить Webhook**
3. Введите URL вашего webhook
4. Сохраните и скопируйте **secret** (показывается только один раз!)

> **Важно**: Храните webhook secret надёжно. Он нужен для верификации входящих запросов.

## Несколько Webhooks

Вы можете создать несколько webhooks для разных целей:

- Production vs staging окружения
- Разные сервисы в вашей организации
- Отдельные эндпоинты для разных типов событий

При создании счёта указывайте, какой webhook использовать:

```json
{
  "amount": 10000,
  "phone_number": "87001234567",
  "webhook_id": 1
}
```

## События

### invoice.status_changed

Отправляется при изменении статуса счёта (paid, cancelled, expired).

**Payload:**

```json
{
  "event": "invoice.status_changed",
  "invoice": {
    "id": 42,
    "external_order_id": "order_123",
    "amount": "15000.00",
    "status": "paid",
    "description": "Оплата заказа",
    "kaspi_invoice_id": "13234689513",
    "client_name": "Иван Иванов",
    "client_phone": "87071234567",
    "paid_at": "2025-12-25T14:35:00Z"
  },
  "timestamp": "2025-12-25T14:35:01Z"
}
```

**Поля в зависимости от статуса:**

| Статус | Дополнительное поле |
|--------|---------------------|
| `paid` | `paid_at` — Время оплаты |
| `cancelled` | `cancelled_at` — Время отмены |
| `expired` | `expired_at` — Время истечения |

## Верификация подписи

Каждый webhook запрос включает заголовок `X-Webhook-Signature` для верификации.

**Формат:** `sha256=<HMAC-SHA256 хеш тела запроса с использованием webhook_secret>`

**Всегда проверяйте подпись**, чтобы убедиться, что запросы приходят от ApiPay.kz и не были изменены.

### JavaScript/Node.js

```javascript
const crypto = require('crypto')

function verifyWebhook(payload, signature, secret) {
  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
}

// Express.js middleware
app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['x-webhook-signature']

  if (!verifyWebhook(req.body, signature, process.env.WEBHOOK_SECRET)) {
    return res.status(401).send('Invalid signature')
  }

  const event = JSON.parse(req.body)

  // Обработка события
  switch (event.event) {
    case 'invoice.status_changed':
      if (event.invoice.status === 'paid') {
        // Платёж получен - выполняем заказ
        fulfillOrder(event.invoice.external_order_id)
      }
      break
  }

  res.status(200).send('OK')
})
```

### Python

```python
import hmac
import hashlib
from flask import Flask, request, abort

app = Flask(__name__)

def verify_webhook(payload: bytes, signature: str, secret: str) -> bool:
    expected = 'sha256=' + hmac.new(
        secret.encode(),
        payload,
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)

@app.route('/webhook', methods=['POST'])
def webhook():
    payload = request.get_data()
    signature = request.headers.get('X-Webhook-Signature', '')

    if not verify_webhook(payload, signature, WEBHOOK_SECRET):
        abort(401)

    event = request.get_json()

    if event['event'] == 'invoice.status_changed':
        invoice = event['invoice']
        if invoice['status'] == 'paid':
            # Платёж получен - выполняем заказ
            fulfill_order(invoice['external_order_id'])

    return 'OK', 200
```

### PHP

```php
function verifyWebhook($payload, $signature, $secret) {
    $expected = 'sha256=' . hash_hmac('sha256', $payload, $secret);
    return hash_equals($expected, $signature);
}

// Laravel
Route::post('/webhook', function (Request $request) {
    $payload = $request->getContent();
    $signature = $request->header('X-Webhook-Signature');

    if (!verifyWebhook($payload, $signature, config('services.apipay.webhook_secret'))) {
        abort(401, 'Invalid signature');
    }

    $event = json_decode($payload, true);

    if ($event['event'] === 'invoice.status_changed') {
        $invoice = $event['invoice'];
        if ($invoice['status'] === 'paid') {
            // Платёж получен - выполняем заказ
            $this->fulfillOrder($invoice['external_order_id']);
        }
    }

    return response('OK', 200);
});
```

## Требования к ответу

Ваш webhook эндпоинт должен:

1. **Возвращать 2xx статус** — Любой 2xx код считается успешным
2. **Отвечать быстро** — Ответ в течение 30 секунд
3. **Быть идемпотентным** — Корректно обрабатывать повторные доставки

## Политика повторов

Если ваш эндпоинт не отвечает 2xx:

- ApiPay.kz повторит до 3 раз
- Повторы происходят с увеличивающимися интервалами
- После всех неудачных повторов webhook помечается как failed

## Тестирование Webhooks

1. Используйте сервис типа [webhook.site](https://webhook.site) для тестирования
2. Настройте тестовый URL в личном кабинете
3. Создайте тестовый счёт и оплатите его
4. Проверьте полученный payload

## Лучшие практики безопасности

1. **Всегда проверяйте подпись** — Никогда не обрабатывайте непроверенные webhooks
2. **Используйте HTTPS** — URL webhooks должен использовать HTTPS в production
3. **Храните secrets надёжно** — Используйте переменные окружения
4. **Валидируйте payload** — Проверяйте наличие обязательных полей
5. **Используйте ключи идемпотентности** — `invoice.id` + `status` для предотвращения повторной обработки

## Устранение неполадок

| Проблема | Решение |
|----------|---------|
| Не получаю webhooks | Проверьте доступность URL из интернета |
| Несовпадение подписи | Убедитесь, что используете raw body, а не parsed JSON |
| Дублирующиеся события | Реализуйте проверку идемпотентности |
| Ошибки таймаута | Обрабатывайте асинхронно, отвечайте сразу |
