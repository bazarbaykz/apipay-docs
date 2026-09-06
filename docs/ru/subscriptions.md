# Подписки

Подписки автоматически выставляют счета Kaspi по расписанию — для абонементов, SaaS и регулярных услуг.

Автосписания нет: в каждую дату списания система создаёт обычный счёт Kaspi, а клиент подтверждает оплату в приложении Kaspi. Если счёт не оплачен, система выставляет его повторно — см. [Grace Period](#grace-period).

## Создание подписки

**Эндпоинт:** `POST /subscriptions`

```bash
curl -X POST https://api.apipay.kz/api/v1/subscriptions \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 5000,
    "phone_number": "87001234567",
    "subscriber_name": "Иван Иванов",
    "description": "Ежемесячная подписка",
    "billing_period": "monthly",
    "billing_day": 1
  }'
```

### Параметры

| Поле | Тип | Обязательно | Описание |
|------|-----|-------------|----------|
| `amount` | number | Условно | Сумма в тенге (100 - 1 000 000), **только целая**. Не нужно при `cart_items` |
| `phone_number` | string | Да | Телефон клиента (формат: 8XXXXXXXXXX) |
| `billing_period` | string | Да | Период списания |
| `billing_day` | integer | Нет | День списания. У `monthly`, `quarterly`, `yearly` — число месяца (1–28). У `weekly` и `biweekly` — **день недели**: 1 — понедельник … 7 — воскресенье; значение больше 7 на этих периодах вернёт `422`. У `daily` не используется. Взаимоисключающе с `billing_day_from_end` |
| `billing_day_from_end` | integer | Нет | Опора от конца месяца: `0` — последний день, `1` — предпоследний. Только для `monthly`, `quarterly`, `yearly`. Взаимоисключающе с `billing_day` |
| `billing_time` | string | Нет | Время списания по Алматы в формате `ЧЧ:ММ`, окно 06:00–22:00. По умолчанию `13:00` |
| `first_billing_at` | string | Нет | Дата первого списания (YYYY-MM-DD, календарь Алматы). Без неё первое списание — `started_at` плюс период. Дата не может быть в прошлом и дальше двух лет вперёд, а вместе с `bill_immediately` вернёт `422`. Задаётся только при создании |
| `total_cycles` | integer | Нет | Сколько **оплаченных** списаний сделать за всю жизнь подписки (1–600). Пусто — бессрочно. Неоплаченная попытка цикл не расходует; по достижении лимита подписка переходит в `expired` |
| `description` | string | Нет | Описание (макс. 60 символов — Kaspi показывает покупателю только первые 60). Без него счёт списания уходит с текстом «Оплата подписки №{id}», в песочнице — «Оплата подписки №{id} (песочница)» |
| `subscriber_name` | string | Нет | Имя подписчика (макс. 255) |
| `external_subscriber_id` | string | Нет | Ваш ID подписчика (макс. 255) |
| `started_at` | string | Нет | Дата начала (YYYY-MM-DD). По умолчанию — сегодня |
| `max_retry_attempts` | integer | Нет | Макс. попыток повтора (1-10) |
| `retry_interval_hours` | integer | Нет | Часов между попытками (1-168) |
| `grace_period_days` | integer | Нет | Льготный период в днях (1-30) |
| `metadata` | object | Нет | Произвольные данные |
| `cart_items` | array | Условно | Корзина `[{ catalog_item_id, count }]`, 1–100 позиций. Для организаций **с каталогом** обязательна — сумму считает сервер, `amount` игнорируется. Организациям **без каталога** передавать нельзя: вернётся `422` |
| `bill_immediately` | boolean | Нет | Если `true` — первый счёт выставляется сразу. По умолчанию `false` (первый счёт по расписанию) |

> ⚠️ **Позиция, снимаемая с продажи, ведёт себя по-разному при создании и при списании.** Создать или обновить подписку с позицией в статусе `deleting` нельзя — придёт `422`, причина в `errors["cart_items.N.catalog_item_id"]`. А вот очередное списание по уже работающей подписке не проваливается, а переносится на следующую попытку списания: счётчик неудач не растёт и подписка не уходит в льготный период из-за временного состояния. Верните позицию обычным `POST /catalog` — см. [Каталог → Статусы товара](catalog.md#статусы-товара). Отложенное списание ничем не сигнализируется: счёт за период не создаётся, вебхука нет, `next_billing_at` не двигается — если деньги нужны раньше, верните позицию сами.

> ⛔ **Сумма списания — только целые тенге.** Списание выставляется счётом на номер телефона, поэтому дробная сумма (и `amount`, и итог `cart_items` после скидок) уходит в статус `error` с `error_code: amount_must_be_whole_tenge` — и так при **каждом** списании. Создание подписки этого не отбивает: проверьте суммы действующих подписок и цены каталожных позиций.

### Периоды списания

| Период | Описание |
|--------|----------|
| `daily` | Каждый день |
| `weekly` | Раз в неделю, в день недели из `billing_day`; без него — через 7 дней от предыдущего списания |
| `biweekly` | Раз в две недели, в тот же день недели; без `billing_day` — через 14 дней |
| `monthly` | То же число каждого месяца |
| `quarterly` | Раз в 3 месяца |
| `yearly` | То же число каждого года |

### Ответ

```json
{
  "message": "Subscription created",
  "subscription": {
    "id": 1,
    "amount": "5000.00",
    "phone_number": "87001234567",
    "subscriber_name": "Иван Иванов",
    "description": "Ежемесячная подписка",
    "billing_period": "monthly",
    "billing_day": 1,
    "billing_day_from_end": null,
    "billing_time": "13:00",
    "total_cycles": null,
    "cycles_paid": 0,
    "status": "active",
    "next_billing_at": "2026-03-01T08:00:00+00:00",
    "next_billing_in_days": 28,
    "next_billing_label": "через 28 дней",
    "created_at": "2026-02-01T12:00:00+00:00"
  }
}
```

`next_billing_at` отдаётся в UTC и содержит время суток: `08:00+00:00` — это 13:00 по Алматы.
`next_billing_in_days` — **знаковое** число дней по календарю Алматы: отрицательное значение
означает просрочку. Если вы сравниваете это поле с нулём, учитывайте знак.

HTTP-статус — `201`. Сама подписка лежит в поле `subscription`; так же устроены ответы `PUT /subscriptions/{id}`, `pause`, `resume` и `cancel`.

## Список подписок

**Эндпоинт:** `GET /subscriptions`

```bash
curl "https://api.apipay.kz/api/v1/subscriptions?status=active&page=1&per_page=20" \
  -H "X-API-Key: YOUR_API_KEY"
```

### Параметры запроса

| Параметр | Тип | Описание |
|----------|-----|----------|
| `page` | integer | Номер страницы (по умолч. 1) |
| `per_page` | integer | Элементов на странице (по умолч. 20, максимум 100 — большее значение приводится к 100) |
| `status` | string | Фильтр: `active`, `paused`, `cancelled`, `expired` |
| `phone_number` | string | Фильтр по телефону |
| `external_subscriber_id` | string | Фильтр по вашему ID подписчика |

> Других фильтров и сортировки на этом эндпоинте нет: список всегда отдаётся в порядке «новые сверху» (`created_at DESC`).

## Получение подписки

**Эндпоинт:** `GET /subscriptions/{id}`

Возвращает подписку со статистикой и последним платежом. Тело ответа — объект `{ "subscription": { … } }`: и сама подписка, и вложенные `stats` / `last_payment` лежат внутри поля `subscription`.

```bash
curl https://api.apipay.kz/api/v1/subscriptions/1 \
  -H "X-API-Key: YOUR_API_KEY"
```

### Ответ

```json
{
  "subscription": {
    "id": 1,
    "amount": "5000.00",
    "phone_number": "87001234567",
    "subscriber_name": "Иван Иванов",
    "billing_period": "monthly",
    "billing_day": 1,
    "status": "active",
    "next_billing_at": "2026-03-01T08:00:00+00:00",
    "stats": {
      "total_payments": 5,
      "successful_payments": 5,
      "failed_payments": 0,
      "total_collected": "25000.00"
    },
    "last_payment": {
      "amount": "5000.00",
      "status": "paid",
      "paid_at": "2026-02-01T10:30:00+00:00"
    },
    "created_at": "2026-01-01T12:00:00+00:00"
  }
}
```

### Поля stats

| Поле | Тип | Описание |
|------|-----|----------|
| `total_payments` | integer | Всего платежей |
| `successful_payments` | integer | Успешных платежей |
| `failed_payments` | integer | Неуспешных платежей |
| `total_collected` | string | Общая собранная сумма |

### Поле last_payment

| Поле | Тип | Описание |
|------|-----|----------|
| `amount` | string | Сумма платежа |
| `status` | string | Статус |
| `paid_at` | string | Дата оплаты (ISO 8601) |

## Обновление подписки

**Эндпоинт:** `PUT /subscriptions/{id}`

```bash
curl -X PUT https://api.apipay.kz/api/v1/subscriptions/1 \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"amount": 7500, "description": "Премиальная подписка"}'
```

Обновляемые поля: `amount`, `billing_day`, `billing_day_from_end`, `billing_time`, `total_cycles`, `description`, `subscriber_name`, `max_retry_attempts`, `retry_interval_hours`, `grace_period_days`, `metadata`, `cart_items`. Дата первого списания `first_billing_at` задаётся только при создании.

> ⚠️ **Описание подписки живёт по тому же правилу, что и описание счёта.** Изменённое описание
> длиннее 60 символов вернёт `422`.
> Проверяется только **изменённое** описание: правка других полей у подписки со
> старым длинным описанием проходит как раньше.

## Приостановка

**Эндпоинт:** `POST /subscriptions/{id}/pause`

```bash
curl -X POST https://api.apipay.kz/api/v1/subscriptions/1/pause \
  -H "X-API-Key: YOUR_API_KEY"
```

## Возобновление

**Эндпоинт:** `POST /subscriptions/{id}/resume`

```bash
curl -X POST https://api.apipay.kz/api/v1/subscriptions/1/resume \
  -H "X-API-Key: YOUR_API_KEY"
```

## Отмена

**Эндпоинт:** `POST /subscriptions/{id}/cancel`

Отмена окончательна — нельзя возобновить.

```bash
curl -X POST https://api.apipay.kz/api/v1/subscriptions/1/cancel \
  -H "X-API-Key: YOUR_API_KEY"
```

## Счета подписки

**Эндпоинт:** `GET /subscriptions/{id}/invoices`

```bash
curl "https://api.apipay.kz/api/v1/subscriptions/1/invoices?page=1&per_page=20" \
  -H "X-API-Key: YOUR_API_KEY"
```

`per_page` — до 100 записей на страницу; большее значение приводится к 100.

### Структура элемента ответа

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | integer | ID записи подписочного счёта |
| `invoice_id` | integer | ID связанного счёта |
| `billing_period_start` | string | Начало периода (YYYY-MM-DD) |
| `billing_period_end` | string | Конец периода (YYYY-MM-DD) |
| `billing_period_label` | string | Человекочитаемый период |
| `amount` | string | Сумма |
| `attempt_number` | integer | Номер попытки |
| `status` | string | Статус |
| `status_label` | string | Человекочитаемый статус |
| `status_color` | string | Цвет для UI |
| `paid_at` | string\|null | Дата оплаты (ISO 8601) |
| `failure_reason` | string\|null | Причина ошибки |
| `invoice` | object | `{ id, kaspi_invoice_id, status }` |
| `created_at` | string | Дата создания (ISO 8601) |

## Статусы

| Статус | Описание |
|--------|----------|
| `active` | Списания по расписанию |
| `paused` | Временно приостановлена, можно возобновить |
| `cancelled` | Отменена окончательно |
| `expired` | Истекла: закончился grace period либо исчерпан `total_cycles` |

## Grace Period

При неудачном платеже запускается льготный период:

1. **Платёж не прошёл** — система повторяет попытку
2. **Повторы** — до `max_retry_attempts` раз с интервалом `retry_interval_hours`. Интервал
   выдерживается для отказов по существу — например, когда у номера нет Kaspi
3. **Истёкший счёт — исключение** — он перевыставляется сразу, интервал не ждёт: срок жизни
   счёта плательщик уже израсходовал
4. **Явный отказ плательщика прерывает всё** — если покупатель отклонил счёт в Kaspi, подписка
   отменяется сразу. Нехватка средств у плательщика отказом не считается и ведёт к обычному повтору
5. **Подписка активна** — во время повторов подписка остаётся `active`
6. **Истечение** — если оплата так и не прошла, подписка переходит в `expired` по окончании льготного периода: через `grace_period_days` со дня последней неудачной попытки

Значения по умолчанию, если не передавать их при создании: `max_retry_attempts` — 3, `retry_interval_hours` — 24, `grace_period_days` — 3.

> **Пропущенные периоды не выставляются пачкой.** Если по подписке долго не удавалось списать —
> например, у организации не было подключённого кассира, — при возобновлении выставляется **один**
> счёт за текущий период, а расписание переходит на ближайшую будущую дату.

Webhook-события: `subscription.payment_failed`, `subscription.grace_period_started`, `subscription.payment_succeeded`, `subscription.expired`. См. [Webhooks](webhooks.md).

## Примеры кода

### JavaScript

```javascript
const response = await fetch('https://api.apipay.kz/api/v1/subscriptions', {
  method: 'POST',
  headers: { 'X-API-Key': 'YOUR_API_KEY', 'Content-Type': 'application/json' },
  body: JSON.stringify({
    amount: 5000, phone_number: '87001234567', billing_period: 'monthly', billing_day: 1
  })
})
```

### Python

```python
import requests
requests.post('https://api.apipay.kz/api/v1/subscriptions',
    headers={'X-API-Key': 'YOUR_API_KEY', 'Content-Type': 'application/json'},
    json={'amount': 5000, 'phone_number': '87001234567', 'billing_period': 'monthly'})
```

### PHP

```php
$ch = curl_init('https://api.apipay.kz/api/v1/subscriptions');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => ['X-API-Key: YOUR_API_KEY', 'Content-Type: application/json'],
    CURLOPT_POSTFIELDS => json_encode(['amount' => 5000, 'phone_number' => '87001234567', 'billing_period' => 'monthly']),
    CURLOPT_RETURNTRANSFER => true
]);
$subscription = json_decode(curl_exec($ch), true);
```
