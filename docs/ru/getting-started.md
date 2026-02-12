# Начало работы

## Подготовка

Для использования API ApiPay.kz:

1. **Зарегистрируйтесь** на [apipay.kz/login](https://apipay.kz/login)
2. **Подключите организацию** — напишите в [WhatsApp поддержки (+7 708 516 74 89)](https://wa.me/77085167489), мы подключим ваш Kaspi Business с правами **"Кассира"**
3. **Дождитесь подключения** (обычно 5-30 минут)
4. **Получите API ключ** в Настройки → Подключение

## Конфигурация

| Параметр | Значение |
|----------|----------|
| Base URL | `https://bpapi.bazarbay.site/api/v1` |
| Аутентификация | Заголовок `X-API-Key: your_api_key` |
| Content-Type | `application/json` |
| Rate Limit | 60 запросов/минуту |

## Проверка доступности

```bash
curl https://bpapi.bazarbay.site/api/v1/status
```

## Первый счёт

```bash
curl -X POST https://bpapi.bazarbay.site/api/v1/invoices \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"amount": 10000, "phone_number": "87001234567"}'
```

Клиент получит уведомление в приложении Kaspi и сможет оплатить.

## Что дальше?

- [Счета](invoices.md) — Создание, список, отмена, корзина товаров
- [Подписки](subscriptions.md) — Автоматические списания
- [Каталог](catalog.md) — Управление товарами
- [Возвраты](refunds.md) — Полные и частичные возвраты
- [Webhooks](webhooks.md) — Уведомления о платежах
- [Коды ошибок](errors.md) — Обработка ошибок
