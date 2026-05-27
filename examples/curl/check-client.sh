#!/bin/bash
# Проверить, зарегистрирован ли номер в Kaspi, перед созданием счёта.
# Не использовать для массового перебора номеров — приведёт к блокировке организации.

API_KEY="${APIPAY_API_KEY:-YOUR_API_KEY}"
BASE_URL="https://bpapi.bazarbay.site/api/v1"

curl -sS -X POST "$BASE_URL/clients/check" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"phone": "77001234567"}'

# Пример ответа:
# {"phone":"87001234567","has_kaspi":true,"client_name":"Иван И."}
