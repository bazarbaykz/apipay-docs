# Error Codes

ApiPay.kz uses standard HTTP status codes with detailed error messages.

## HTTP Status Codes

| Code | Name | Description |
|------|------|-------------|
| 200 | OK | Request succeeded |
| 201 | Created | Resource created |
| 202 | Accepted | Request accepted for async processing |
| 400 | Bad Request | Malformed request or invalid state — see `message` or `error` |
| 401 | Unauthorized | API key missing, invalid, expired, or not linked to an organization; or the account is deactivated |
| 403 | Forbidden | Organization is suspended or not verified for production mode |
| 404 | Not Found | Resource not found, or belongs to another organization |
| 410 | Gone | Resource expired (e.g., verification timeout) |
| 422 | Validation Error | Field validation failed — details in the `errors` object |
| 429 | Too Many Requests | Rate limit exceeded (200/min per API key) — see `retry_after` |
| 500 | Server Error | Internal server error |
| 502 | Bad Gateway | Error on the Kaspi API side |
| 503 | Service Unavailable | Kaspi session invalid or expired |

## Error Response Format

```json
{
  "message": "Error description",
  "errors": {
    "field_name": ["Specific error detail"]
  }
}
```

## Common Errors

### 401 Unauthorized

```json
{"message": "Invalid API key"}
```

**Solution:** Check your API key in dashboard Settings → Connection.

### 403 Forbidden

```json
{"message": "Organization not verified"}
```

**Solution:** Contact support via WhatsApp to connect your organization.

### 422 Validation Error

```json
{
  "message": "Validation failed",
  "errors": {
    "phone_number": ["Phone number must be in format 8XXXXXXXXXX"],
    "amount": ["Amount must be between 0.01 and 99999999.99"]
  }
}
```

### 429 Too Many Requests

```json
{
  "message": "Too many requests. Please retry after 60 seconds.",
  "retry_after": 60
}
```

### 502 Bad Gateway

```json
{"message": "Kaspi API error"}
```

**Solution:** Retry after a short delay. If persistent, contact support.

### 503 Service Unavailable

```json
{"message": "Kaspi session expired"}
```

**Solution:** Reconnect the Kaspi cashier in the dashboard (Settings → Kaspi Authorization), or contact support.

## Application Error Codes

When an invoice, refund, or subscription operation fails, the response body
contains an `error` field with one of the codes below.

| Code | HTTP | Meaning & resolution |
|------|------|----------------------|
| `organization_required` | 400 | Organization is not connected. Create a sandbox organization for testing, or connect a Kaspi cashier. |
| `Organization not found or not verified` | 400 | Production mode: the organization is not verified. Wait for verification or test in the sandbox. |
| `kaspi_session_not_configured` | 400 | The Kaspi cashier is not connected. Connect it in the dashboard (Settings → Kaspi Authorization) or via support. |
| `kaspi_session_invalid` | 503 | The Kaspi cashier session expired or was reset. Reconnect the cashier and request a new SMS code. |
| `connection_ambiguous` | 422 | The organization has several active cashier connections and no primary one. Pass `kaspi_connection_id`. |
| `sandbox_invoice_limit` | 400 | Sandbox invoice limit reached (25 per organization). Clear the sandbox in the dashboard. |
| `sandbox_subscription_limit` | 400 | Sandbox subscription limit reached (10 per organization). Clear the sandbox. |
| `qr_rate_limit` | 429 | Too many QR requests for the organization (limit 60/min). Wait one minute. |
| `qr_render_failed` | 500 | Failed to render the QR code image. Retry later. |
| `kaspi_error` | 502 | Kaspi API returned an error while creating the QR token. Retry later. |
| `Invoice cannot be cancelled` | 400 | Only invoices in `pending` or `processing` status can be cancelled. |
| `Invoice is not refundable` | 400 | Refunds are possible only for a paid invoice that is not yet fully refunded. |
| `Refund amount exceeds available amount` | 400 | The refund amount is larger than available. See `available_for_refund` in `GET /invoices/{id}`. |
| `Organization not verified` | 403 | Subscriptions in production mode are available only to a verified organization. |

## Asynchronous Errors (Kaspi)

`POST /invoices` and `POST /invoices/qr` return `201 Created` with status
`processing`. The invoice is then sent to Kaspi asynchronously. If Kaspi
cannot process it, the status changes to `error` and the reason appears in
the `error_message` field — fetch it with `GET /invoices/{id}`.

Kaspi does not use fixed error codes; `error_message` contains plain text:

- **Phone not registered in Kaspi** — e.g. *"This phone number is not registered in Kaspi..."*. The customer has no Kaspi app — ask for a different number.
- **Temporary Kaspi failure** — e.g. *"Payment processing error..."* or *"Could not process the invoice after several attempts"*. Retry creating the invoice later.

## Error Handling Example

```javascript
async function apiRequest(url, options) {
  const response = await fetch(url, options)

  if (!response.ok) {
    const error = await response.json()

    switch (response.status) {
      case 401: throw new Error('Invalid API key')
      case 403: throw new Error('Organization not verified')
      case 422:
        const fields = Object.keys(error.errors || {}).join(', ')
        throw new Error(`Validation failed: ${fields}`)
      case 429:
        const retry = error.retry_after || 60
        await new Promise(r => setTimeout(r, retry * 1000))
        return apiRequest(url, options) // retry
      default:
        throw new Error(error.message || 'Unknown error')
    }
  }

  return response.json()
}
```

## Rate Limiting

- **Per-key minute:** 60 requests per minute per API key
- **Per-key day:** 10 000 requests per day per API key
- **QR invoices:** a separate limit of 60 requests per minute per organization (`POST /invoices/qr`)
- **Header:** `Retry-After` shows the number of seconds to wait before retrying
- **Response:** HTTP 429 with body `{"message": "Too Many Requests"}` — do not hammer the endpoint, wait for the indicated time
