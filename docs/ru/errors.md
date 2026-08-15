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

> Ошибки Public API v1 приходят **в JSON независимо от заголовка `Accept`** — разбираемое тело получит и голый `curl`, который шлёт `*/*`.

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
    "amount": ["Сумма счёта на номер телефона должна быть целой, от 1 ₸"]
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
| `refund_window_expired` | — | async (`invoice.refunded`, `refund.status=failed`) | Kaspi отклонил возврат: возможно, истёк срок возврата либо возврат уже сделан. Не повторяйте. |
| `Invoice cannot be cancelled` | 400 | sync | Отменить можно только счёт в статусе `pending` или `processing`. |
| `qr_cancel_unsupported` | 409 | sync | QR-счёт (`is_qr_token: true`) отменить нельзя: статус не меняется, в теле приходит `expires_at`. Дождитесь `expired` или выставьте новый счёт. |
| `amount_must_be_whole_tenge` | 422 | sync (в `POST /invoices/bulk` — по позиции) | Сумма счёта на номер телефона должна быть целой: проверяется и `amount`, и итог корзины после скидок. Округлите сумму или выставьте счёт через `POST /invoices/qr`. |
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
| `receipt_dispatch_error` | — | async (`receipt.failed`, `status=failed`) | Технический сбой отправки чека. Повторите с тем же `client_operation_id`: фискальный документ не создан, после `failed` прежний ключ освобождается. |
| `receipt_ofd_token_revoked` | — | async (`receipt.failed`, `status=failed`) | Фискальная привязка кассы к ОФД отозвана. Приём оплат работает, встают только чек и изменение каталога. Мерчанту нужно перепривязать ОФД в приложении Kaspi — временем не лечится. Подробнее — [Фискальные чеки](receipts.md). |
| `receipt_not_available_for_status` | 409 | sync | `GET /invoices/{id}/receipt`: счёт не в статусе `paid`/`partially_refunded`, либо у оплаченного счёта ещё нет числового идентификатора Kaspi. |
| `receipt_rate_limited` | 429 | sync | У `GET /invoices/{id}/receipt` собственный минутный лимит, строже общего. Дождитесь `Retry-After`. |
| `receipt_unavailable` | 503 | sync | Kaspi не отдал чек по счёту. Обычно помогает повтор через минуту. |
| `kaspi_session_unavailable` | 409 | sync | Кассир по счёту временно недоступен. Повторите позже. |
| `catalog_requires_cart_items` | 422 | sync | У организации включён каталог, а `cart_items` не переданы. Тело несёт `message` и `error_code`, без `errors`. |
| `catalog_not_supported` | 400 / 422 | sync | Каталог у организации не включён. `422` — если всё же переданы `cart_items`; `400` на `POST /catalog/bulk-delete`, где это предусловие организации. |
| `catalog_delete_scope_required` | 422 | sync | `POST /catalog/bulk-delete` без режима или сразу с двумя. Уточнение в `reason`: `mode_required`, `expected_count_required`. |
| `catalog_delete_filter_invalid` | 422 | sync | Фильтру удаления нельзя верить. `reason: token_never_used` — токен не тот; `reason: coverage_too_low` — прогон не завершился, повторите заливку целиком (числа в `stamped`/`visible`). Список `reason` открыт. |
| `catalog_delete_owner_key_required` | 403 | sync | Массовое удаление требует ключ, выпущенный владельцем организации. Перевыпустите ключ от имени владельца. |
| `catalog_delete_in_progress` | 409 / — | sync: `409` на `PATCH /catalog/{id}`, запись в `rejected[]` на `POST /catalog` | Снятие позиции уже отправлено в Kaspi, отменить его в этом окне нельзя. Повторите через несколько секунд. |
| `catalog_bulk_delete_mismatch` | 409 | sync | `expected_count` разошёлся с фактом (в теле `actual_count`): каталог изменился между `dry_run` и командой. Повторите `dry_run`. |
| `catalog_multi_tradepoint` | 409 | sync | У организации несколько торговых точек — удаление каталога через API недоступно. Обратитесь в поддержку. |
| `catalog_match_overflow` | 422 | sync | Слишком много значений в точечном запросе или в списке на удаление: суммарно не больше 200 значений, а в точечном `GET /catalog` — ещё и не больше 1000 найденных строк. Разбейте на батчи. |
| `catalog_busy` | 409 | sync | Каталог занят другой операцией. Повторите через несколько секунд. |
| `idempotency_key_conflict` | 409 | sync | `Idempotency-Key` уже занят операцией другого типа — пространство ключей общее у заливки и массового удаления. Возьмите новый ключ. |
| `custom_tariff_locked` | 409 | sync | У организации индивидуальные условия тарифа: сменить тариф самостоятельно нельзя, это оформляет поддержка. Продление того же тарифа не блокируется. Состояние видно заранее: `is_custom` в `GET /tariff` и `can_change_tier` в каталоге планов. |
| `request_rate_limited` | 429 | sync | Превышен поминутный лимит запросов. Не путайте с `rate_limited` — это разные коды. См. [Rate Limiting](#rate-limiting). |
| `cashbox_disabled` | 403 | sync | Кассовые операции организации недоступны. |
| `cashbox_kkm_unknown` | 409 | sync | К аккаунту Kaspi Pay не подключена касса Kaspi (ОФД) — смен у организации нет. См. [Касса](cashbox.md). |
| `rfo_missing` (Касса) | 409 | sync | Тот же признак отсутствия кассы Kaspi у `GET /cashbox/summary` и тумблеров. |
| `cashbox_no_open_shift` | — | async (`cashbox.shift_close_failed`) | Открытой смены нет — закрывать нечего. Код приходит в `operation.error_code`. |
| `cashbox_shift_already_closed` | — | — | Смена уже была закрыта. Отказом не приходит: операция завершается статусом `completed` — целевое состояние достигнуто. |
| `cashbox_shift_not_found` | 404 | sync | Смена с таким id недоступна: её не отдавал `GET /cashbox/shifts`. |
| `cashbox_operation_not_found` | 404 | sync | Кассовая операция с таким id не найдена. |
| `cashbox_duplicate_operation` | 409 | sync | `client_operation_id` закрытия смены уже использован. ⚠️ Ключ не освобождается даже после `failed` — повторяйте закрытие новым `client_operation_id`. |
| `cashbox_busy` | — | async (`cashbox.shift_close_failed`) | По кассе уже выполняется операция. Повторите закрытие новым `client_operation_id`. |
| `cashbox_operation_failed` | — | async | Кассовая операция не удалась (`cashbox.shift_close_failed`). |
| `cashbox_unavailable` | 503 | sync | Касса Kaspi временно недоступна. |
| `cashbox_report_unavailable` | 503 | sync | Отчёт по смене сейчас не сформировать. Повторите позже. |
| `cashbox_toggle_in_progress` | 503 | sync | Переключение тумблера уже выполняется. Повторите позже. |
| `cashbox_toggle_unavailable` | 503 | sync | Текущее значение на кассе проверить не удалось, переключение не выполнено. |

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
- **`POST /catalog/bulk-delete`:** 10 запросов в минуту на API-ключ
- **Касса (`/cashbox/*`):** 30 запросов в минуту на API-ключ
- **`GET /invoices/{id}/receipt`:** собственный минутный лимит, строже общего

### Тело и заголовки `429`

Отказ поминутного лимитера машиночитаем:

```json
{
  "message": "Too Many Attempts.",
  "error": "request_rate_limited",
  "error_code": "request_rate_limited",
  "limit": 200,
  "remaining": 0,
  "reset_at": "2026-08-13T09:31:00+00:00",
  "retry_after_seconds": 17
}
```

Заголовки: `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining` (на `429` всегда `0`), `X-RateLimit-Reset` (Unix-время обнуления окна).

> ⚠️ Поле `message` намеренно осталось прежним — `"Too Many Attempts."`. Интеграции, разбиравшие строку, продолжают работать; всё машиночитаемое добавлено рядом.

> ⚠️ `limit` и `X-RateLimit-Limit` показывают **самый дефицитный бакет этого запроса**, а не лимит конкретной ручки: к запросу применяется несколько лимитеров сразу.

Дождитесь `Retry-After` — не долбите эндпоинт. Отказы по тарифу (`tariff_limit_reached`) и по квотам (`kyc_daily_limit_reached`) тоже приходят с `429`, но это другие коды и другая логика: смотрите `error_code`, а не только статус.
