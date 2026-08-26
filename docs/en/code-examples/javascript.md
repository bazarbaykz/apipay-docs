# JavaScript

A dependency-free example for Node.js 18+ — `fetch` is built in.
The key is read from the `APIPAY_API_KEY` environment variable, so do not keep it in
the code and do not commit it to a repository.

## Creating an Invoice

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
      amount: 10000, // amount in tenge
      phone_number: '87001234567', // customer phone, format 8XXXXXXXXXX
      description: 'Payment for order #123',
      external_order_id: 'order_123' // your own order ID for matching
    })
  })

  if (!response.ok) {
    const error = await response.json()
    // The stable snake_case code lives in error_code. On 422 (validation error)
    // there is no such field at all: you get message and an errors object
    // broken down by field, which is why a fallback is needed.
    throw new Error(`HTTP ${response.status}: ${error.error_code ?? error.message}`)
  }

  return response.json()
}

async function main() {
  if (!API_KEY) {
    console.error('The APIPAY_API_KEY environment variable is not set')
    process.exit(1)
  }

  const invoice = await createInvoice()
  console.log(`Invoice #${invoice.id} created, status: ${invoice.status}`)
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
```

Running it:

```bash
APIPAY_API_KEY=your_api_key node create-invoice.js
```

Branch your logic on `error_code`, not on the text of `message`: the text can change.
The full list of codes is in [Errors](../errors.md).

## The `processing` Status Is Not a Failure

The `201` response comes back with `status: "processing"`: we have accepted the invoice,
but it has not reached Kaspi yet. The final status arrives in the `invoice.status_changed`
webhook (see [Webhooks](../webhooks.md)) or through `GET /invoices/{id}`. Do not create
the invoice again while it is in `processing`, or you will end up with a second invoice
for the same amount.

## Ready-Made Examples

Complete working scripts live in [`examples/javascript/`](https://github.com/bazarbaykz/apipay-docs/tree/main/examples/javascript):

| File | What it shows |
|------|---------------|
| `create-invoice.js` | Creating an invoice |
| `check-client.js` | Checking a customer by phone number |
| `create-subscription.js` | A subscription (recurring charges) |
| `manage-catalog.js` | Working with the product catalog |
| `webhook-handler.js` | Receiving a webhook and verifying its signature |
| `partner-onboarding.js` | Onboarding an organization through the Partner API |
