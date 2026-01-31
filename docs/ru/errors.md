# Коды ошибок

ApiPay.kz использует стандартные HTTP коды статуса и возвращает подробные сообщения об ошибках для помощи в обработке проблем.

## HTTP коды статуса

| Код | Название | Описание |
|-----|----------|----------|
| 200 | OK | Запрос успешен |
| 400 | Bad Request | Неверный формат запроса |
| 401 | Unauthorized | Неверный, отсутствующий или истёкший API ключ |
| 404 | Not Found | Ресурс не найден |
| 410 | Gone | Ресурс истёк (например, таймаут верификации) |
| 422 | Validation Error | Неверные значения полей |
| 429 | Too Many Requests | Превышен лимит запросов |
| 500 | Server Error | Внутренняя ошибка сервера |

## Формат ответа об ошибке

Все ошибки возвращают JSON объект с деталями:

```json
{
  "message": "Описание ошибки",
  "errors": {
    "field_name": ["Детали ошибки"]
  }
}
```

## Частые ошибки

### 401 Unauthorized

**Неверный API ключ:**
```json
{
  "message": "Неверный API ключ"
}
```

**Решение:** Проверьте ваш API ключ в личном кабинете и убедитесь, что он правильно указан в заголовке `X-API-Key`.

**Отсутствует API ключ:**
```json
{
  "message": "API ключ обязателен"
}
```

**Решение:** Добавьте заголовок `X-API-Key` к вашему запросу.

### 410 Gone

**Таймаут верификации:**
```json
{
  "message": "Верификация истекла. Пожалуйста, начните заново."
}
```

**Решение:** Верификация организации истекла через 120 секунд. Начните процесс верификации заново.

### 422 Validation Error

**Неверный номер телефона:**
```json
{
  "message": "Ошибка валидации",
  "errors": {
    "phone_number": ["Номер телефона должен быть в формате 8XXXXXXXXXX"]
  }
}
```

**Неверная сумма:**
```json
{
  "message": "Ошибка валидации",
  "errors": {
    "amount": ["Сумма должна быть от 0.01 до 99999999.99"]
  }
}
```

**Неверный ИИН/БИН:**
```json
{
  "message": "Ошибка валидации",
  "errors": {
    "idn": ["ИИН/БИН должен содержать ровно 12 цифр"]
  }
}
```

**Неверный URL webhook (SSRF защита):**
```json
{
  "message": "Ошибка валидации",
  "errors": {
    "url": ["Недопустимый URL webhook"]
  }
}
```

### 429 Too Many Requests

**Превышен лимит запросов:**
```json
{
  "message": "Слишком много запросов. Повторите через 60 секунд.",
  "retry_after": 60
}
```

**Решение:** Подождите указанный период `retry_after` перед новыми запросами. Текущий лимит: 60 запросов/минуту.

## Примеры обработки ошибок

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
          throw new Error('Неверный API ключ')
        case 422:
          const fields = Object.keys(error.errors).join(', ')
          throw new Error(`Ошибка валидации: ${fields}`)
        case 429:
          throw new Error(`Превышен лимит. Повторите через ${error.retry_after} сек`)
        default:
          throw new Error(error.message || 'Неизвестная ошибка')
      }
    }

    return await response.json()
  } catch (error) {
    console.error('Ошибка API:', error.message)
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
        raise Exception('Неверный API ключ')

    if response.status_code == 422:
        errors = response.json().get('errors', {})
        fields = ', '.join(errors.keys())
        raise Exception(f'Ошибка валидации: {fields}')

    if response.status_code == 429:
        retry_after = response.json().get('retry_after', 60)
        raise Exception(f'Превышен лимит. Повторите через {retry_after} сек')

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
        throw new Exception('Неверный API ключ');
    }

    if ($httpCode === 422) {
        $fields = implode(', ', array_keys($result['errors'] ?? []));
        throw new Exception("Ошибка валидации: {$fields}");
    }

    if ($httpCode === 429) {
        $retryAfter = $result['retry_after'] ?? 60;
        throw new Exception("Превышен лимит. Повторите через {$retryAfter} сек");
    }

    if ($httpCode >= 400) {
        throw new Exception($result['message'] ?? 'Неизвестная ошибка');
    }

    return $result;
}
```

## Лучшие практики

1. **Всегда проверяйте коды статуса** — Не предполагайте успех
2. **Разбирайте детали ошибок** — Используйте объект `errors` для ошибок конкретных полей
3. **Реализуйте логику повторов** — Для ошибок 429 и 5xx
4. **Логируйте ошибки** — Сохраняйте записи для отладки
5. **Показывайте понятные сообщения** — Не показывайте сырые ошибки API пользователям

## Rate Limiting

- **Лимит:** 60 запросов в минуту на API ключ
- **Заголовок:** `X-RateLimit-Remaining` показывает оставшиеся запросы
- **Ответ:** статус 429 включает `retry_after` в секундах

**Обработка rate limits:**

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
