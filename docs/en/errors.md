# Error Codes

ApiPay.kz uses standard HTTP status codes with detailed error messages.

## HTTP Status Codes

| Code | Name | Description |
|------|------|-------------|
| 200 | OK | Request succeeded |
| 201 | Created | Resource created |
| 202 | Accepted | Request accepted for async processing |
| 400 | Bad Request | Invalid request format |
| 401 | Unauthorized | Invalid, missing, or expired API key |
| 403 | Forbidden | Organization not verified or access denied |
| 404 | Not Found | Resource not found |
| 410 | Gone | Resource expired (e.g., verification timeout) |
| 422 | Validation Error | Invalid field values |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Server Error | Internal server error |
| 502 | Bad Gateway | Kaspi API error |
| 503 | Service Unavailable | Kaspi session expired |

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

**Solution:** Contact support to reconnect Kaspi Business session.

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

- **Limit:** 60 requests per minute per API key
- **Header:** `X-RateLimit-Remaining` shows remaining requests
- **Response:** 429 status includes `retry_after` in seconds
