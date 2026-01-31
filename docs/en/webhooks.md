# Webhooks

Webhooks allow you to receive real-time notifications when payment events occur. Instead of polling for status changes, ApiPay.kz will send HTTP POST requests to your server.

## Configuration

Webhooks are configured in the [ApiPay.kz Dashboard](https://baypay.bazarbay.site):

1. Go to **Settings → Connection**
2. Click **Add Webhook**
3. Enter your webhook URL
4. Save and copy the **secret** (shown only once!)

> **Important**: Store the webhook secret securely. You'll need it to verify incoming requests.

## Multiple Webhooks

You can create multiple webhooks for different purposes:

- Production vs staging environments
- Different services within your organization
- Separate endpoints for different event types

When creating an invoice, specify which webhook to use:

```json
{
  "amount": 10000,
  "phone_number": "87001234567",
  "webhook_id": 1
}
```

## Events

### invoice.status_changed

Sent when an invoice status changes (paid, cancelled, expired).

**Payload:**

```json
{
  "event": "invoice.status_changed",
  "invoice": {
    "id": 42,
    "external_order_id": "order_123",
    "amount": "15000.00",
    "status": "paid",
    "description": "Order payment",
    "kaspi_invoice_id": "13234689513",
    "client_name": "John Doe",
    "client_phone": "87071234567",
    "paid_at": "2025-12-25T14:35:00Z"
  },
  "timestamp": "2025-12-25T14:35:01Z"
}
```

**Status-specific fields:**

| Status | Additional Field |
|--------|------------------|
| `paid` | `paid_at` — Payment timestamp |
| `cancelled` | `cancelled_at` — Cancellation timestamp |
| `expired` | `expired_at` — Expiration timestamp |

## Signature Verification

Every webhook request includes an `X-Webhook-Signature` header for verification.

**Format:** `sha256=<HMAC-SHA256 hash of body using webhook_secret>`

**Always verify signatures** to ensure requests come from ApiPay.kz and haven't been tampered with.

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

  // Handle event
  switch (event.event) {
    case 'invoice.status_changed':
      if (event.invoice.status === 'paid') {
        // Payment received - fulfill order
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
            # Payment received - fulfill order
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
            // Payment received - fulfill order
            $this->fulfillOrder($invoice['external_order_id']);
        }
    }

    return response('OK', 200);
});
```

## Response Requirements

Your webhook endpoint must:

1. **Return 2xx status** — Any 2xx status code is considered successful
2. **Respond quickly** — Return within 30 seconds
3. **Be idempotent** — Handle duplicate deliveries gracefully

## Retry Policy

If your endpoint fails to respond with 2xx:

- ApiPay.kz will retry up to 3 times
- Retries occur at increasing intervals
- After all retries fail, the webhook is marked as failed

## Testing Webhooks

1. Use a service like [webhook.site](https://webhook.site) for testing
2. Configure the test URL in your dashboard
3. Create a test invoice and complete payment
4. Verify the webhook payload

## Security Best Practices

1. **Always verify signatures** — Never process unverified webhooks
2. **Use HTTPS** — Webhook URLs must use HTTPS in production
3. **Store secrets securely** — Use environment variables
4. **Validate payload** — Check required fields exist
5. **Use idempotency keys** — `invoice.id` + `status` to prevent duplicate processing

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Not receiving webhooks | Check URL accessibility from internet |
| Signature mismatch | Ensure you're using raw body, not parsed JSON |
| Duplicate events | Implement idempotency check |
| Timeout errors | Process asynchronously, respond immediately |
