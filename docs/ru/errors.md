# Коды ошибок

ApiPay.kz использует стандартные HTTP коды статуса с подробными сообщениями об ошибках.

## HTTP коды статуса

| Код | Название | Описание |
|-----|----------|----------|
| 200 | OK | Запрос успешен |
| 201 | Created | Ресурс создан |
| 202 | Accepted | Запрос принят для асинхронной обработки |
| 400 | Bad Request | Некорректный запрос или недопустимое состояние — см. `message` или `error` |
| 401 | Unauthorized | API-ключ отсутствует, неверен, истёк или не привязан к организации; либо аккаунт деактивирован |
| 403 | Forbidden | Организация заморожена или не верифицирована для рабочего режима |
| 404 | Not Found | Ресурс не найден или принадлежит другой организации |
| 410 | Gone | Ресурс истёк (например, таймаут верификации) |
| 422 | Validation Error | Ошибка валидации полей — детали в объекте `errors` |
| 429 | Too Many Requests | Превышен лимит запросов (общий — 200/мин на API-ключ) — см. заголовок `Retry-After` |
| 500 | Server Error | Внутренняя ошибка сервера |
| 502 | Bad Gateway | Ошибка на стороне Kaspi API |
| 503 | Service Unavailable | Сессия Kaspi недействительна или истекла |

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
{"message": "Организация не верифицирована"}
```

**Решение:** Дождитесь верификации организации или тестируйте в песочнице. Если кассир Kaspi ещё не подключён — подключите его в кабинете (Настройки → Авторизация Kaspi); если мастер подключения не проходит, напишите в поддержку.

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
  "message": "Too Many Requests"
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

**Решение:** Переподключите кассира Kaspi в кабинете (Настройки → Авторизация Kaspi) или обратитесь в поддержку.

## Коды ошибок приложения

При неуспешной операции со счётом, возвратом или подпиской тело ответа
содержит поле `error` с одним из кодов ниже. Стабильный snake_case-код также
приходит в поле `error_code` — стройте логику по нему, а не по тексту `message`.

Колонка **Доставка** показывает, как код доходит до вас: синхронно (sync —
в HTTP-ответе с указанным кодом) и/или асинхронно (async — в вебхуке: счёт
переходит в `error` с `invoice.error_code`, возврат — в `failed` с
`refund.error_code`).

| Код | HTTP | Доставка | Значение и решение |
|-----|------|----------|--------------------|
| `organization_required` | 400 | sync | Организация не подключена. Создайте sandbox-организацию для тестов или подключите кассира Kaspi. |
| `Organization not found or not verified` | 400 | sync | Рабочий режим: организация не верифицирована. Дождитесь верификации или тестируйте в песочнице. |
| `kaspi_session_not_configured` | 400 | sync | Кассир Kaspi не подключён. Подключите его в кабинете (Настройки → Авторизация Kaspi) или через поддержку. |
| `kaspi_session_invalid` | 503 | sync + async (`invoice.status_changed`, `status=error`) | Сессия кассира Kaspi истекла или сброшена. Переподключите кассира и запросите новый SMS-код. |
| `connection_ambiguous` | 422 | sync | У организации несколько активных касс, основная не выбрана. Передайте `kaspi_connection_id`. |
| `sandbox_invoice_limit` | 400 | sync | Достигнут лимит тестовых счетов на организацию. Очистите песочницу в кабинете. |
| `sandbox_subscription_limit` | 400 | sync | Достигнут лимит тестовых подписок на организацию. Очистите песочницу. |
| `qr_rate_limit` | 429 | sync | Слишком много QR-запросов для организации (лимит 60/мин). Подождите минуту. |
| `qr_render_failed` | 500 | sync + async (`invoice.status_changed`, `status=error`) | Не удалось сформировать изображение QR-кода. Повторите запрос позже. |
| `kaspi_error` | 502 | sync + async для QR-счетов (`invoice.status_changed`, `status=error`) | Kaspi API вернул ошибку. Текст причины — в `message`/`error_message`. Повторите позже. |
| `client_not_found` | — | async (`invoice.status_changed`, `status=error`) | Номер телефона не зарегистрирован в Kaspi. Не повторяйте с тем же номером — попросите другой. |
| `network_unavailable` | — | async (`invoice.status_changed`, `status=error`) | Сеть/Kaspi были недоступны; ретраи исчерпаны. Создайте новый счёт через 1–2 минуты. |
| `kaspi_throttled` | — / 429 | async (`invoice.status_changed`, `status=error`); sync при `POST /catalog/scan` | Kaspi ограничил частоту запросов. По счетам — создайте новый через 2–3 минуты. При `POST /catalog/scan` приходит синхронно (HTTP 429): `retry_after_seconds` в теле, заголовок `Retry-After`. Подождите указанное время и повторите. |
| `kaspi_session_expired` | 400 | sync | Сессия Kaspi мерчанта истекла при `POST /catalog/scan`. Переподключите кассира Kaspi и повторите. |
| `kaspi_scan_unavailable` | 503 | sync | Нацкаталог Kaspi временно недоступен при `POST /catalog/scan`. Повторите позже. |
| `refund_window_expired` | — | async (`invoice.refunded`, `refund.status=failed`) | Истёк срок возврата (~14 дней) или возврат уже сделан. Не повторяйте. |
| `Invoice cannot be cancelled` | 400 | sync | Отменить можно только счёт в статусе `pending` или `processing`. |
| `Invoice is not refundable` | 400 | sync | Возврат возможен только по оплаченному счёту, ещё не возвращённому полностью. |
| `Refund amount exceeds available amount` | 400 | sync | Сумма возврата больше доступной. Смотрите `available_for_refund` в `GET /invoices/{id}`. |
| `Organization not verified` | 403 | sync | Подписки в рабочем режиме доступны только верифицированной организации. |
| `kyc_daily_limit_reached` | 429 | sync | Молодая организация: до одобрения анкеты о бизнесе — 1 реальный счёт в сутки (окно Asia/Almaty; счета в песочнице не считаются). В `meta.reset_at` — когда лимит сбросится. Заполните короткую анкету в кабинете (`/business-profile`), одобрение обычно за 1 рабочий день — лимит снимется. |
| `kyc_rejected` | 403 | sync | Приём платежей закрыт по итогам проверки бизнеса. Не повторяемая — обратитесь в поддержку, если считаете это ошибкой. |
| `tariff_limit_reached` | 429 | sync | Достигнут лимит счетов по оплаченному тарифу — счёт НЕ создан. В `meta`: `mode` (`daily` — расчётные сутки, `monthly` — 30-дневный блок), `limit`, `used`, `reset_at`; в теле `retry_after_seconds`, в заголовках `Retry-After`. Повторяйте не раньше `reset_at` либо перейдите на более высокий тариф. Разовое превышение не блокирует; счета, созданные из кабинета, и счета песочницы в лимит не входят. |
| `cashier_unavailable` | 409 | sync | Кассира сейчас нельзя подключить. Состояние постоянное — повтор не поможет; покажите пользователю нейтральный текст и направьте в поддержку. |
| `rate_limited` | 429 | sync | На `send-phone` — слишком много попыток подключения разных номеров кассиров. Окно суточное: `Retry-After` и `retry_after_seconds` содержат секунды до обнуления счётчика (часы, не минуты). Уже подключённые кассиры в счётчик не входят — переавторизация рабочей точки под лимит не попадает. |
| `file_too_large` | 413 | sync | Изображение товара больше 6 МБ (`POST /catalog/upload-image`). Повтор без уменьшения файла бесполезен. |
| `invalid_file_type` | 422 | sync | Содержимое файла не JPEG и не PNG. Тип определяется по содержимому, а не по расширению и `Content-Type`: gif, webp, bmp и svg отклоняются — конвертируйте их на своей стороне. |
| `image_rejected` | 422 | sync | Габариты изображения вне допустимого (стороны 64…6000 px, площадь до 12 Мпикс) либо файл повреждён. |
| `image_processing_unavailable` | 500 | sync | Обработка изображений временно недоступна. Изображение не сохранено, `image_id` не выдан — повторять запрос безопасно. |
| `webhook_url_requires_domain` | 422 | sync | Адрес webhook должен быть на вашем домене — IP-адреса не принимаются (для ещё не одобренных организаций в рабочем режиме; в песочнице правило мягче). |
| `webhook_url_tunnel_forbidden` | 422 | sync | Туннели (ngrok и подобные) нельзя использовать для рабочих webhook — они временны и отключатся. Укажите адрес на вашем домене. В песочнице туннель для теста допустим. |
| `fiscal_receipts_disabled` | 403 | sync | Фича фискальных чеков выключена. Обратитесь в поддержку для включения. |
| `duplicate_client_operation_id` | 409 | sync | При выбивании чека (`POST /receipts`) `client_operation_id` уже использован. В теле — `receipt_id`/`status` исходного чека; повтор разрешён только после `failed`. |
| `receipt_preview_unavailable` | 503 | sync | Kaspi временно недоступен для превью чека (`POST /receipts/preview`). Повторите позже. |
| `receipt_not_found` | 404 | sync | Чек не найден или принадлежит другой организации (`GET /receipts/{id}`). |
| `shift_closed` | — | async (`receipt.failed`, `status=failed`) | Смена в Kaspi Pos закрыта. Откройте смену в приложении Kaspi Pos и выбейте чек заново. |
| `item_not_fiscal` | — | async (`receipt.failed`, `status=failed`) | Позиция чека без НТИН — не фискальная. Дорезолвите НТИН (`POST /catalog/scan` + `PATCH /catalog/{id}`) и повторите. |
| `rfo_missing` | — | async (`receipt.failed`, `status=failed`) | Не определена торговая точка (РФО) для чека. Обратитесь в поддержку. |
| `receipt_kaspi_error` | — | async (`receipt.failed`, `status=failed`) | Kaspi отклонил выбивание чека. Текст причины — в `error_message`. |
| `receipt_dispatch_error` | — | async (`receipt.failed`, `status=failed`) | Технический сбой отправки чека. Повторите с **новым** `client_operation_id`. |

> Коды `kaspi_session_not_configured` и `connection_ambiguous` (выше) относятся и к чекам:
> `POST /receipts` / `/receipts/preview` требуют активного кассира, а при нескольких
> активных кассах — `kaspi_connection_id`. Подробнее — [Фискальные чеки](receipts.md).

> Подробная матрица «что делает система и что делать вам» по каждому
> асинхронному коду — в разделе [Webhooks → Сценарии реагирования](webhooks.md).

## Асинхронные ошибки Kaspi

`POST /invoices` и `POST /invoices/qr` возвращают `201 Created` со статусом
`processing`. Затем счёт асинхронно отправляется в Kaspi. Если Kaspi не
смог его обработать, статус меняется на `error`, а причина появляется в
поле `error_message` — получите её через `GET /invoices/{id}`.

У Kaspi нет фиксированных кодов ошибок; `error_message` содержит обычный текст:

- **Номер не зарегистрирован в Kaspi** — например, *«Этот номер телефона не зарегистрирован в Kaspi…»*. У клиента нет приложения Kaspi — попросите другой номер.
- **Временный сбой Kaspi** — например, *«Ошибка обработки платежа…»* или *«Не удалось обработать счёт после нескольких попыток»*. Повторите создание счёта позже.

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
      case 429: {
        const retry = Number(response.headers.get('Retry-After')) || 60
        if (options.__retried) throw new Error(`Лимит запросов исчерпан, повторите через ${retry} с`)
        await new Promise(r => setTimeout(r, retry * 1000))
        return apiRequest(url, { ...options, __retried: true }) // одна повторная попытка
      }
      default:
        throw new Error(error.message || 'Неизвестная ошибка')
    }
  }

  return response.json()
}
```

## Rate Limiting

- **Общий лимит:** 200 запросов в минуту на API-ключ
- **`POST /clients/check`:** 60 запросов в минуту и 10 000 в сутки на API-ключ (отдельный счётчик)
- **`POST /catalog/scan`:** 30 запросов в минуту и 2000 в сутки на API-ключ
- **QR-счета:** отдельный лимит — 60 запросов в минуту на организацию (`POST /invoices/qr`)
- **Заголовок:** `Retry-After` показывает количество секунд до следующей попытки
- **Ответ:** статус 429, тело `{"message": "Too Many Requests"}` — не долбите эндпоинт, дождитесь указанного времени
