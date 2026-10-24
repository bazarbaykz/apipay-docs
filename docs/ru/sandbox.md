# Песочница

Новая организация создаётся в песочнице: счета не уходят в Kaspi, деньги не двигаются, анкета о бизнесе и кассир для неё не нужны. API-ключ тот же, что будет работать в рабочем режиме, — переключение режима его не меняет.

Песочница отвечает теми же кодами и телами отказов, что бой, поэтому в ней можно прогнать не только оплату, но и все ошибки, которые обрабатывает ваша интеграция. Исход задаётся тремя способами: заголовком `X-Sandbox-Scenario` (синхронный отказ), состоянием организации (`/sandbox/state`) и заказанным исходом (поле `simulate` и двери `…/simulate*`). Двери `…/simulate*` и `/sandbox/*` работают только у песочной организации — у боевой они отвечают `403 not_sandbox`. А заголовок `X-Sandbox-Scenario`, магические номера и поле `simulate` в счёте, отмене, возврате, ссылке покупателю, каталоге и закрытии смены у боевой организации отказа не дают и не действуют: запрос выполнится по-настоящему — счёт уйдёт покупателю, возврат вернёт деньги (см. [Боевая организация](#боевая-организация)).

> Машиночитаемая матрица сценариев, магических номеров и симуляций — `sandbox-scenarios.json` в корне этого репозитория.

## Лимиты песочницы

| Что | Лимит |
|---|---|
| Тестовые счета | 1000 на организацию (`400 sandbox_invoice_limit`) |
| Тестовые подписки | 10 на организацию (`400 sandbox_subscription_limit`) |
| Позиции каталога | 1000 |
| `POST /invoices/{id}/simulate-status` | 60 запросов в минуту на ключ, отдельно от общего лимита |

Песочные счета в дневной лимит тарифа не входят.

## Синхронный отказ — `X-Sandbox-Scenario`

Заголовок `X-Sandbox-Scenario: <slug>` даёт ровно тот ответ, что вернула бы боевая дверь, ещё до проверки тела запроса. Ответ несёт `X-Sandbox-Scenario-Applied: <slug>`. Если сценарий к этому запросу не относится, запрос идёт обычным путём, а ответ несёт `X-Sandbox-Scenario-Ignored: not_applicable`. Неизвестный slug — `422 sandbox_scenario_unknown` со списком сценариев.

> ⛔ Примеры этой главы — только с ключом песочной организации. У боевой организации заголовок игнорируется, и запрос уйдёт как обычный — с настоящим счётом.

```bash
curl -i -X POST https://api.apipay.kz/api/v1/invoices \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "X-Sandbox-Scenario: tariff_inactive" \
  -H "Content-Type: application/json" \
  -d '{"amount": 5000, "phone_number": "87770000001"}'
```

| slug | Где | Ответ |
|---|---|---|
| `tariff_inactive` | платные операции | `403` |
| `kaspi_session_expired` | `POST /invoices` | `409` |
| `kaspi_session_invalid` | `POST /invoices` | `503` |
| `kaspi_session_not_configured` | `POST /invoices` | `400` |
| `trial_daily_limit`, `tariff_limit_reached`, `kyc_daily_limit_reached` | `POST /invoices` | `429` и `Retry-After` |
| `kyc_rejected` | `POST /invoices` | `403` |
| `connection_ambiguous` | `POST /invoices` | `422` |
| `organization_not_verified` | `POST /invoices` | `400` |
| `invoices_disabled` | `POST /invoices`, `POST /invoices/bulk`, `POST /invoices/qr`, `POST /static-qr` | `503` |
| `qr_rate_limit` | `POST /invoices/qr` без `static` | `429` |
| `static_qr_disabled` | `POST /invoices/qr` со `static: true` | `403` |
| `recipient_name_unavailable` | `POST /static-qr`, `POST /invoices/qr` со `static: true` | `422` |
| `request_rate_limited` | любой запрос | `429` и `Retry-After` |

## Состояние организации — `/sandbox/state`

`PUT /sandbox/state` задаёт, что песочница изображает на все следующие запросы приложения без заголовка; `GET /sandbox/state` показывает текущее состояние. `PUT` меняет только переданные поля, неизвестное поле — `422`. Состояние сбрасывается сменой режима и очисткой песочницы.

```bash
curl -X PUT https://api.apipay.kz/api/v1/sandbox/state \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"cashier_session": "expired"}'
```

| Поле | Значения | Что изображает |
|---|---|---|
| `tariff` | `active`, `inactive`, `trial_exhausted`, `limit_reached` | `403 tariff_inactive` на платных операциях, `429 trial_daily_limit` или `429 tariff_limit_reached` на `POST /invoices` |
| `kyc` | `approved`, `pending`, `rejected` | `rejected` — `403 kyc_rejected` на `POST /invoices` |
| `cashier_session` | `ok`, `expired`, `invalid`, `not_configured` | отказы сессии кассира на `POST /invoices`; `GET /account/health` показывает то же состояние |
| `kaspi_egress` | `open`, `paused` | `paused` — телефонный счёт принимается и держится в `processing`, пока паузу не снимут |
| `webhook_retry_grid` | `short`, `live` | повторы вебхука песочного счёта: `short` — несколько коротких попыток, `live` — столько же попыток, сколько в бою, со сжатыми интервалами |
| `hold` | `true`, `false` | `GET /account/health` показывает накопление счетов |

⛔ Состояние действует только на запросы вашего приложения по API-ключу. Кабинет и статус подключения в нём показывают правду.

## Заказанный исход

| Что | Как |
|---|---|
| Счёт по номеру телефона | поле `simulate` в `POST /invoices` (`{"status": "pending"}` или `{"status": "error", "error_code": "client_not_found"}`) либо магический номер покупателя (ниже) |
| QR-счёт | `simulate` в `POST /invoices/qr`: строка `paid`, `cancelled` или `expired` — сразу перевести счёт в статус; объект `{"status": "error", "error_code": "kaspi_error"}` — синхронный отказ теми же ответами, что в бою. Со `static: true` поле запрещено |
| Статус счёта | `POST /invoices/{invoice}/simulate-status` — по таблице переходов ниже |
| Отмена счёта | `simulate` в `POST /invoices/{id}/cancel`: `{"outcome": "cancelled"}` (по умолчанию), `rejected` (Kaspi отказал — счёт тихо возвращается в `pending` без вебхука) или `error` с `error_code` |
| Чек Kaspi по счёту | `POST /invoices/{id}/receipt/simulate` с `outcome`: `pending_then_ready` (по умолчанию — сначала `202`, затем `200`) или боевой отказ |
| Возврат | `simulate` в `POST /invoices/{id}/refund`: `{"status": "completed" \| "failed" \| "uncertain", "error_code": …}`; разбор неизвестного исхода — `POST /invoices/{invoice}/refunds/{refund}/simulate-resolve`, снятие удержания — `POST /invoices/{invoice}/refunds/{refund}/simulate-release-hold` |
| Ссылка покупателю «Возврат ApiPay» | `simulate` в `POST /qr-refunds/links` и в `execute` — исход денежного выполнения; шаги покупателя — `POST /qr-refunds/{id}/simulate` |
| Позиция каталога | `items[].simulate` в `POST /catalog` |
| Фискальный чек | `simulate` в `POST /receipts` |
| Закрытие смены | `simulate` в `POST /cashbox/shifts/close` |
| Подписка | `POST /subscriptions/{subscription}/simulate-billing`, `POST /subscriptions/{subscription}/simulate` |
| Ссылка на оплату и печатный лист | `POST /static-qr/{id}/simulate` |
| Подпись вебхука | `POST /webhook-test` с `signature`: `valid`, `invalid` или `missing` |
| Повтор доставки | `POST /webhook-logs/{id}/retry` |

### Счёт по номеру телефона и магические номера

Без поля `simulate` исход задаёт номер покупателя. Магические номера дают `error` с боевым кодом и текстом и вебхук `invoice.status_changed`:

| Номер | `error_code` |
|---|---|
| `87770000002` | `client_not_found` |
| `87770100003` | `kaspi_throttled` |
| `87770100004` | `network_unavailable` |
| `87770100005` | `session_transient` |
| `87770100006` | `kaspi_error` |
| `87770100007` | `unknown_error` |
| `87770100008` | `organization_not_configured` |
| `87770100009` | `kaspi_session_unavailable` |

Остальные номера — `pending`. ⛔ У боевой организации магический номер — обычный номер: счёт уйдёт настоящему абоненту. Не используйте эти номера вне песочницы.

### Переходы статуса счёта — `simulate-status`

`POST /invoices/{invoice}/simulate-status` переводит песочный счёт только по переходам, которые бывают в бою, и шлёт вебхук `invoice.status_changed`:

| Из | В | Что изображает |
|---|---|---|
| `pending` | `paid`, `cancelled`, `expired`, `error`, `qr_scanned` | исходы ожидания и скан QR |
| `cancelled`, `expired` | `paid` | поздняя оплата |
| `error` | `pending` | сверка нашла живой счёт — приходит вебхук `pending`, как в бою |
| `cancelling` | `cancelled`, `pending`, `error` | исходы отмены; возврат в `pending` — без вебхука |
| `paid` | `qr_scanned` | скан пришёл после оплаты |

Пары нет в таблице — `400 invalid_status_transition` с `current_status` и `allowed_from`. `qr_scanned` статус не меняет и шлёт `invoice.qr_scanned`; у счёта не по QR — `400 not_qr_invoice`, повтор — `400 already_scanned`. При `status: error` можно задать `error_code` (по умолчанию `sandbox_simulated_error`) и `error_message`.

```bash
curl -X POST https://api.apipay.kz/api/v1/invoices/42/simulate-status \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"status": "paid"}'
```

> ⚠️ После `error` может снова прийти `pending` — это новый переход, а не дубль, даже если `pending` по этому счёту уже приходил; после такого `pending` может снова прийти `error`. Проверьте, что ваша дедупликация не отбрасывает ни один из них (см. [Webhooks → Дедупликация](webhooks.md#дедупликация)).

### Ссылка покупателю — `POST /qr-refunds/{id}/simulate`

Ссылка в песочнице, как в бою, начинает с `awaiting_customer`.

| `event` | Переход |
|---|---|
| `activated` | покупатель нажал «вернуть»: `awaiting_customer → awaiting_scan` |
| `identified` | покупатель подтвердил себя: `awaiting_scan → customer_identified`; у ссылки под счёт запускает автопроведение |
| `expired` | окно скана закрыто: если окна остались, ссылка возвращается в `awaiting_customer`, иначе `expired` |
| `link_expired` | срок ссылки истёк без ожидания суток |
| `failed` с `error_code: qr_refund_activation_failed` | подтверждение не началось |
| `failed` с другим кодом, `execution_uncertain` | заказ исхода следующего денежного выполнения |

Событие, которое из текущего состояния не исполняется, — `409 qr_refund_simulation_not_applicable`, переход не выполнен.

**Запасной путь возврата целиком:** возврат с `hold_for_buyer_confirmation: true` и `simulate: {"status": "failed", "error_code": "refund_requires_buyer_confirmation"}` → ваше приложение выпускает ссылку `POST /qr-refunds/links` с `invoice_id` и `source_refund_id` → `activated` → `identified`. После `qr_refund.completed` песочница, как бой, присылает второй сигнал: `invoice.refunded` со `status: completed` и другим `refund.id`, а у исходного возврата в `GET /invoices/{id}/refunds` появляется `successor_refund_id`. Подробнее — [Возвраты](refunds.md#запасной-путь-ссылка-покупателю).

### Подписки

- `POST /subscriptions/{subscription}/simulate-billing` с `outcome` — выставляет счёт подписки, не дожидаясь `next_billing_at`, и доводит его до исхода: `paid` → `subscription.payment_succeeded`; `expired`, `cancelled`, `error` → `subscription.payment_failed`; `payer_refused` → подписка отменяется (`subscription.cancelled`, `reason: payer_refused`); `payer_error` → отказ по номеру плательщика (`client_not_found`). Ответ `202`, исход приходит вебхуком. Неприменимо (календарный автоплатёж, нет оставшихся оплат, уже висит счёт) — `409 subscription_simulation_not_applicable`.
- `POST /subscriptions/{subscription}/simulate` с `event`: `grace_expired` — льготный период закончился сейчас (`subscription.expired`); `busy_lock` — выставление подписки занято на `duration_seconds` (не больше 120), пропуск периода отвечает `409 subscription_busy`.

### Ссылка на оплату и печатный лист — `POST /static-qr/{id}/simulate`

Изображает покупателя на странице оплаты. `scanned` создаёт попытку оплаты — счёт, как при нажатии «Оплатить»: его `invoice.id` приходит в ответе, у счёта заполнен `static_qr_id`. `paid` и `cancelled` — последний открытый счёт ссылки или листа оплачен или отменён. Дальнейшие исходы попытки (истечение, поздняя оплата) играются `simulate-status` по её `invoice.id`. Ссылка или лист сейчас счёт не выставляют — `409 static_qr_unavailable`.

Так воспроизводится вторая оплата одного заказа: попытка A `scanned` → `simulate-status` `expired` по A → снова `scanned` (попытка B) → `paid` по B → `simulate-status` `paid` по A. Ваш обработчик должен принять оплату B и распознать оплату A как вторые деньги (см. [Счета → Ссылка на оплату и печатный QR](invoices.md#ссылка-на-оплату-и-печатный-qr)).

## Что в песочнице так же, как в бою

- **Отмена счёта.** QR-счёт отменить нельзя — `409 qr_cancel_unsupported`. Счёт по номеру, уже переданный в Kaspi, отвечает `202` со статусом `cancelling`, итог приходит вебхуком.
- **Чек Kaspi по счёту.** `GET /invoices/{id}/receipt` сначала отвечает `202`, затем `200`; ссылки в песочном чеке — заглушки, покупателю их не отдавайте.
- **Проверка статусов.** `POST /invoices/status/check` работает.
- **Ссылка покупателю** начинает с `awaiting_customer`.
- **Тест подписи.** `POST /webhook-test` с `signature: invalid` или `missing` присылает на адрес ключа поддельное или неподписанное тело — ваш обработчик должен ему отказать. Эти формы работают только в песочнице.
- **Повтор доставки.** Неудачная доставка повторяется так же, как кнопкой повтора в «Логе уведомлений» кабинета: в песочнице `POST /webhook-logs/{id}/retry` шлёт то же тело на текущий адрес ключа (`422 webhook_log_not_retryable` для строки `skipped` и успешной, `409 webhook_circuit_open` на паузе отправки). У боевой организации эта дверь отвечает `403 not_sandbox`.
- **QR-ссылка.** `qr_token_url` песочного QR-счёта ведёт не в Kaspi, а на тестовую страницу ApiPay. Путь адреса не разбирайте — его формат не входит в контракт; признак песочницы — `is_sandbox`.

## Очистка

`POST /sandbox/clear` удаляет песочные счета, подписки, возвраты, ссылки покупателю и позиции каталога, заказанные исходы и состояние песочницы. Слишком частая очистка — `429 clear_cooldown`, очистка уже идёт — `409 operation_in_progress`. В кабинете то же делает кнопка «Очистить тестовые данные».

## Боевая организация

- Заголовок `X-Sandbox-Scenario` игнорируется, ответ несёт `X-Sandbox-Scenario-Ignored: live_organization`.
- `simulate` в `POST /invoices`, отмене, возврате, выпуске ссылки возврата, каталоге и закрытии смены не действует; строковое `simulate` в `POST /invoices/qr` игнорируется, объектное отклоняется `422`.
- `simulate` в `POST /receipts` и в `POST /qr-refunds/{id}/execute`, двери `…/simulate*`, `/sandbox/*`, `POST /webhook-logs/{id}/retry` и поддельная подпись `POST /webhook-test` отвечают `403 not_sandbox`.

⛔ Проигнорированные заголовок `X-Sandbox-Scenario` и поле `simulate` не делают запрос пробным: он выполняется по-настоящему — счёт уходит покупателю, отмена отменяет настоящий счёт, возврат уходит настоящими деньгами, ссылка покупателю выпускается настоящая, позиция каталога заводится, смена закрывается. Магический номер — обычный номер: счёт уйдёт настоящему абоненту. Уберите `simulate` и `X-Sandbox-Scenario` из боевого кода. Порядок перехода в рабочий режим — [Начало работы](getting-started.md#путь-в-рабочий-режим).
