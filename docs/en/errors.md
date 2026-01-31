# Error Codes

ApiPay.kz uses standard HTTP status codes and returns detailed error messages to help you handle issues.

## HTTP Status Codes

| Code | Name | Description |
|------|------|-------------|
| 200 | OK | Request succeeded |
| 400 | Bad Request | Invalid request format |
| 401 | Unauthorized | Invalid, missing, or expired API key |
| 404 | Not Found | Resource not found |
| 410 | Gone | Resource expired (e.g., verification timeout) |
| 422 | Validation Error | Invalid field values |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Server Error | Internal server error |

## Error Response Format

All errors return a JSON object with details:

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

**Invalid API Key:**
```json
{
  "message": "Invalid API key"
}
```

**Solution:** Check your API key in the dashboard and ensure it's correctly included in the `X-API-Key` header.

**Missing API Key:**
```json
{
  "message": "API key is required"
}
```

**Solution:** Add the `X-API-Key` header to your request.

### 410 Gone

**Verification Timeout:**
```json
{
  "message": "Verification expired. Please start again."
}
```

**Solution:** Organization verification timed out after 120 seconds. Start the verification process again.

### 422 Validation Error

**Invalid Phone Number:**
```json
{
  "message": "Validation failed",
  "errors": {
    "phone_number": ["Phone number must be in format 8XXXXXXXXXX"]
  }
}
```

**Invalid Amount:**
```json
{
  "message": "Validation failed",
  "errors": {
    "amount": ["Amount must be between 0.01 and 99999999.99"]
  }
}
```

**Invalid IIN/BIN:**
```json
{
  "message": "Validation failed",
  "errors": {
    "idn": ["IDN must be exactly 12 digits"]
  }
}
```

**Invalid Webhook URL (SSRF Protection):**
```json
{
  "message": "Validation failed",
  "errors": {
    "url": ["Invalid webhook URL"]
  }
}
```

### 429 Too Many Requests

**Rate Limit Exceeded:**
```json
{
  "message": "Too many requests. Please retry after 60 seconds.",
  "retry_after": 60
}
```

**Solution:** Wait for the specified `retry_after` period before making new requests. Current limit: 60 requests/minute.

## Error Handling Examples

### JavaScript

```javascript
async function createInvoice(data) {
  try {
    const response = await fetch('https://bpapi.bazarbay.site/api/invoices', {
      method: 'POST',
      headers: {
        'X-API-Key': 'YOUR_API_KEY',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    })

    if (!response.ok) {
      const error = await response.json()

      switch (response.status) {
        case 401:
          throw new Error('Invalid API key')
        case 422:
          const fields = Object.keys(error.errors).join(', ')
          throw new Error(`Validation failed: ${fields}`)
        case 429:
          throw new Error(`Rate limited. Retry after ${error.retry_after}s`)
        default:
          throw new Error(error.message || 'Unknown error')
      }
    }

    return await response.json()
  } catch (error) {
    console.error('API Error:', error.message)
    throw error
  }
}
```

### Python

```python
import requests

def create_invoice(data):
    response = requests.post(
        'https://bpapi.bazarbay.site/api/invoices',
        headers={
            'X-API-Key': 'YOUR_API_KEY',
            'Content-Type': 'application/json'
        },
        json=data
    )

    if response.status_code == 401:
        raise Exception('Invalid API key')

    if response.status_code == 422:
        errors = response.json().get('errors', {})
        fields = ', '.join(errors.keys())
        raise Exception(f'Validation failed: {fields}')

    if response.status_code == 429:
        retry_after = response.json().get('retry_after', 60)
        raise Exception(f'Rate limited. Retry after {retry_after}s')

    response.raise_for_status()
    return response.json()
```

### PHP

```php
function createInvoice($data) {
    $ch = curl_init('https://bpapi.bazarbay.site/api/invoices');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => [
            'X-API-Key: YOUR_API_KEY',
            'Content-Type: application/json'
        ],
        CURLOPT_POSTFIELDS => json_encode($data),
        CURLOPT_RETURNTRANSFER => true
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $result = json_decode($response, true);

    if ($httpCode === 401) {
        throw new Exception('Invalid API key');
    }

    if ($httpCode === 422) {
        $fields = implode(', ', array_keys($result['errors'] ?? []));
        throw new Exception("Validation failed: {$fields}");
    }

    if ($httpCode === 429) {
        $retryAfter = $result['retry_after'] ?? 60;
        throw new Exception("Rate limited. Retry after {$retryAfter}s");
    }

    if ($httpCode >= 400) {
        throw new Exception($result['message'] ?? 'Unknown error');
    }

    return $result;
}
```

## Best Practices

1. **Always check status codes** — Don't assume success
2. **Parse error details** — Use the `errors` object for field-specific issues
3. **Implement retry logic** — For 429 and 5xx errors
4. **Log errors** — Keep records for debugging
5. **Show user-friendly messages** — Don't expose raw API errors to users

## Rate Limiting

- **Limit:** 60 requests per minute per API key
- **Header:** `X-RateLimit-Remaining` shows remaining requests
- **Response:** 429 status includes `retry_after` in seconds

**Handling rate limits:**

```javascript
async function apiRequest(url, options, retries = 3) {
  const response = await fetch(url, options)

  if (response.status === 429 && retries > 0) {
    const { retry_after } = await response.json()
    await new Promise(r => setTimeout(r, retry_after * 1000))
    return apiRequest(url, options, retries - 1)
  }

  return response
}
```
