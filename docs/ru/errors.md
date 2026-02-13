# Коды ошибок

ApiPay.kz использует стандартные HTTP коды статуса с подробными сообщениями об ошибках.

## HTTP коды статуса

| Код | Название | Описание |
|-----|----------|----------|
| 200 | OK | Запрос успешен |
| 201 | Created | Ресурс создан |
| 202 | Accepted | Запрос принят для асинхронной обработки |
| 400 | Bad Request | Неверный формат запроса |
| 401 | Unauthorized | Неверный, отсутствующий или истёкший API ключ |
| 403 | Forbidden | Организация не подключена или доступ запрещён |
| 404 | Not Found | Ресурс не найден |
| 410 | Gone | Ресурс истёк (например, таймаут верификации) |
| 422 | Validation Error | Неверные значения полей |
| 429 | Too Many Requests | Превышен лимит запросов |
| 500 | Server Error | Внутренняя ошибка сервера |
| 502 | Bad Gateway | Ошибка Kaspi API |
| 503 | Service Unavailable | Сессия Kaspi истекла |

## Формат ответа об ошибке

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

```json
{"message": "Неверный API ключ"}
```

**Решение:** Проверьте ваш API ключ в личном кабинете Настройки → Подключение.

### 403 Forbidden

```json
{"message": "Организация не подключена"}
```

**Решение:** Напишите в поддержку через WhatsApp для подключения организации.

### 422 Validation Error

```json
{
  "message": "Ошибка валидации",
  "errors": {
    "phone_number": ["Номер телефона должен быть в формате 8XXXXXXXXXX"],
    "amount": ["Сумма должна быть от 0.01 до 99999999.99"]
  }
}
```

### 429 Too Many Requests

```json
{
  "message": "Слишком много запросов. Повторите через 60 секунд.",
  "retry_after": 60
}
```

### 502 Bad Gateway

```json
{"message": "Ошибка Kaspi API"}
```

**Решение:** Повторите запрос через несколько секунд. Если ошибка сохраняется, свяжитесь с поддержкой.

### 503 Service Unavailable

```json
{"message": "Сессия Kaspi истекла"}
```

**Решение:** Свяжитесь с поддержкой для переподключения сессии Kaspi Business.

## Пример обработки ошибок

```javascript
async function apiRequest(url, options) {
  const response = await fetch(url, options)

  if (!response.ok) {
    const error = await response.json()

    switch (response.status) {
      case 401: throw new Error('Неверный API ключ')
      case 403: throw new Error('Организация не подключена')
      case 422:
        const fields = Object.keys(error.errors || {}).join(', ')
        throw new Error(`Ошибка валидации: ${fields}`)
      case 429:
        const retry = error.retry_after || 60
        await new Promise(r => setTimeout(r, retry * 1000))
        return apiRequest(url, options) // повтор
      default:
        throw new Error(error.message || 'Неизвестная ошибка')
    }
  }

  return response.json()
}
```

## Rate Limiting

- **Лимит:** 60 запросов в минуту на API ключ
- **Заголовок:** `X-RateLimit-Remaining` показывает оставшиеся запросы
- **Ответ:** статус 429 включает `retry_after` в секундах
