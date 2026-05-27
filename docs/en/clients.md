# Clients

Spot-check phone numbers before creating an invoice or a subscription. Helps you avoid issuing an invoice to a number that has no Kaspi app installed (such an invoice would land in `error` with a descriptive `error_message`, but still burn your quota).

> ⚠️ **Bulk number enumeration is prohibited.** Use the endpoint only for a one-off confirmation in the context of a known customer — before creating an invoice/subscription or processing a refund. The server runs a multi-layer anomaly detector (it factors in request distribution, number patterns, behavioural signals and a combination of other heuristics — the exact thresholds are intentionally not published). When the detector trips, the API key is deactivated without warning, the organization is blocked pending manual review, and the data is forwarded to Kaspi. This protection exists to safeguard Kaspi users — please use the endpoint for its intended purpose.

## Check a phone number

**Endpoint:** `POST /clients/check`

Returns whether the phone is registered in Kaspi, and the client's display name if available.

### Request

```bash
curl -X POST https://bpapi.bazarbay.site/api/v1/clients/check \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"phone": "77001234567"}'
```

### Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `phone` | string | Yes | Customer phone number. Accepts `77XXXXXXXXX`, `87XXXXXXXXX`, `+77XXXXXXXXX`, with spaces/dashes. Must normalize to 11 digits. |

**Normalization:** the leading `7` or `+7` is replaced with `8`; spaces, dashes and plus signs are stripped. Any format that yields 11 digits after normalization is accepted.

### Response 200

```json
{
  "phone": "87001234567",
  "has_kaspi": true,
  "client_name": "Ivan I."
}
```

| Field | Type | Description |
|-------|------|-------------|
| `phone` | string | Normalized phone (`8XXXXXXXXXX`, 11 digits). |
| `has_kaspi` | boolean | `true` — the customer has the Kaspi app and is registered. `false` — not found; do not issue an invoice to this number. |
| `client_name` | string \| null | Customer name from Kaspi formatted as `Firstname L.`. `null` when `has_kaspi=false`. |

### Errors

| Status | Body | When |
|--------|------|------|
| `401` | `{"error": "Invalid API key", "message": "..."}` or `{"error": "API key is missing", ...}` | Missing or invalid `X-API-Key`. |
| `422` | `{"error": "Validation failed", "field": "phone", "message": "..."}` | `phone` is empty, missing, or fails to normalize to 11 digits. |
| `429` | `{"message": "Too Many Requests"}` | Per-key rate limit exceeded (60/min or 10 000/day). See the `Retry-After` header. |

See also [Errors and limits](errors.md).

### Typical flow

```javascript
// Before creating an invoice/subscription
const check = await fetch('https://bpapi.bazarbay.site/api/v1/clients/check', {
  method: 'POST',
  headers: { 'X-API-Key': KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ phone: customerPhone })
}).then(r => r.json())

if (!check.has_kaspi) {
  // Tell the user they need the Kaspi app to pay
  return showError('This number is not registered in Kaspi. Please use another.')
}

// You can show the Kaspi name back to the user as a confirmation
showConfirmation(`Bill ${check.client_name} (${check.phone})?`)
```
