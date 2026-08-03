# Каталог

API каталога позволяет управлять товарами. Товары из каталога используются при создании счетов с корзиной (`cart_items`).

## Единицы измерения

**Эндпоинт:** `GET /catalog/units`

Возвращает доступные единицы измерения для товаров каталога.

```bash
curl https://api.apipay.kz/api/v1/catalog/units \
  -H "X-API-Key: YOUR_API_KEY"
```

Ответ: `{ "data": [{ "id": 1, "name": "шт", "name_kaz": "дана" }, ...] }`

## Список товаров

**Эндпоинт:** `GET /catalog`

Фильтры: `search`, `barcode`, `first_char`, `statuses[]` (можно несколько значений: `active`, `pending`, `deleting`, `failed`), `without_ntin`. Пагинация: `page`, `per_page` (1-200).

Фильтр `without_ntin=true` возвращает только позиции без НТИН (`ntin` = `null`), независимо от наличия штрихкода — шире, чем поле ответа `ntin_missing` (оно требует непустой `barcode`). Удобно оценивать остаток «сколько позиций осталось доделать» по `meta.total`. Компонуется со всеми режимами и фильтрами.

Каждый товар в ответе содержит поле `created_at` — дата создания в системе (ISO 8601). Доступно сразу после создания, даже если Kaspi ещё не вернул `date_added`.

Каждый товар также содержит поле `gtin` (строка или `null`) — GTIN из Нацкаталога, если товар был создан с ним. Листинг Kaspi значение `gtin` не возвращает, поэтому синхронизация каталога его не затирает.

## Загрузка изображения

**Эндпоинт:** `POST /catalog/upload-image`

```bash
curl -X POST https://api.apipay.kz/api/v1/catalog/upload-image \
  -H "X-API-Key: YOUR_API_KEY" \
  -F "image=@photo.jpg"
```

Формат: `multipart/form-data`. Только JPEG и PNG, макс. 6 МБ, стороны 64…6000 px, площадь до 12 Мпикс. Файлы gif, webp, bmp и svg отклоняются (`422 invalid_file_type`) — конвертируйте их на своей стороне. Файл больше 6 МБ — `413 file_too_large`. Лимит: 60 запросов в минуту и 2000 в сутки на ключ.

Ответ: `{"image_id": "550e8400-..."}`.

## Сканирование штрихкода (Нацкаталог)

**Эндпоинт:** `POST /catalog/scan`

Резолвит штрихкод в Нацкаталоге Kaspi и возвращает карточки товаров-кандидатов. Используйте перед созданием товара, чтобы подтянуть официальное название, НТИН и GTIN. Работает синхронно.

```bash
curl -X POST https://api.apipay.kz/api/v1/catalog/scan \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"input": "4607015232646"}'
```

Поле: `input` (обяз., строка, макс. 64) — штрихкод, введённый вручную или полученный со сканера.

Ответ `200 OK`:

```json
{
  "data": [
    {
      "id": 1118196,
      "name": "ВАФЛИ ЯШКИНО ОРЕХОВЫЕ 300Г",
      "ntin": "0200009461097",
      "gtin": "4607015232646",
      "barcode": "4607015232646",
      "unit_id": null,
      "image_link": null
    }
  ],
  "normalized_barcode": "4607015232646",
  "scan_result": { "code": "ok", "message": null }
}
```

Один штрихкод может вернуть несколько кандидатов (общий `gtin`, разные `ntin`) — окончательный выбор делает продавец. Поля кандидата (`id`, `name`, `ntin`, `gtin`, `barcode`, `unit_id`, `image_link`) затем передаются в создание товара.

Если товар не найден — приходит `data: []` и/или `scan_result.code` отличный от `"ok"`. Это **не ошибка**: HTTP по-прежнему `200`. В этом случае создавайте товар обычным путём, без `ntin`/`gtin`.

**Ошибки:**

| Код | Значение | Что делать |
|-----|----------|------------|
| `422` | `input` пустой или длиннее 64 символов | Исправьте ввод |
| `400` `kaspi_session_expired` | Сессия Kaspi истекла | Переподключите кассира Kaspi, затем повторите |
| `429` `kaspi_throttled` | Слишком часто (в теле `retry_after_seconds`, в заголовке `Retry-After`) | Подождите указанное время и повторите |
| `503` `kaspi_scan_unavailable` | Нацкаталог временно недоступен | Повторите позже |

**Лимиты:** 30 запросов/мин и 2000/сутки на API-ключ. Если Kaspi ограничил частоту, эндпоинт отвечает `429 kaspi_throttled` — дождитесь времени из `retry_after_seconds` (заголовок `Retry-After`) и повторите.

**Типовой сценарий:** сканирование штрихкода → `POST /catalog/scan` → показать `data[]` (если пусто — создать товар без `ntin`/`gtin`) → продавец выбирает кандидата → `POST /catalog` с `ntin`/`gtin`/`from_catalog: true` → товар создаётся в статусе `pending` → асинхронно уходит в Kaspi → `active`.

## Создание товаров

**Эндпоинт:** `POST /catalog`

Пакетное создание: 1–100 позиций за запрос.

```bash
curl -X POST https://api.apipay.kz/api/v1/catalog \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"items": [{"name": "Кофе латте", "selling_price": 1500, "unit_id": 1, "image_id": "550e8400-..."}]}'
```

Поля: `name` (обяз., строка, макс. 255), `selling_price` (обяз., число, мин. 0.01), `unit_id` (обяз., целое), `image_id` (опц., UUID из `POST /catalog/upload-image`), `barcode` (опц., строка, макс. 32).

Поля Нацкаталога (опц., заполняются из выбранного кандидата `POST /catalog/scan`):

- `ntin` (строка, макс. 50) — НТИН выбранного кандидата.
- `gtin` (строка, макс. 50) — GTIN, только для кандидатов GS1.
- `from_catalog` (bool, по умолчанию `false`) — признак, что товар создан из Нацкаталога.

Пример элемента с данными Нацкаталога: `{"name": "ВАФЛИ ЯШКИНО ОРЕХОВЫЕ 300Г", "selling_price": 450, "unit_id": 1, "barcode": "4607015232646", "ntin": "0200009461097", "gtin": "4607015232646", "from_catalog": true}`.

**Код ответа:** `202 Accepted` (асинхронная обработка). В ответе у товара присутствует поле `gtin`.

## Обновление товара

**Эндпоинт:** `PATCH /catalog/{id}`

Поля: `name`, `selling_price`, `unit_id`, `image_id`, `is_image_deleted`, `barcode`, `ntin` (опц., строка, макс. 50), `gtin` (опц., строка, макс. 50).

> ⚠️ **Важно про `ntin`/`gtin`.** Передавайте эти поля только когда действительно хотите изменить идентичность Нацкаталога. При обычной правке (например, только цены) **не передавайте** `ntin`/`gtin` — иначе `null` затрёт идентичность Нацкаталога в Kaspi. Восстановить её синхронизацией нельзя: листинг Kaspi значение `gtin` не отдаёт.

**Код ответа:** `200 OK` (sandbox) / `202 Accepted` (production).

## Удаление товара

**Эндпоинт:** `DELETE /catalog/{id}`

**Код ответа:** `200 OK` (sandbox) / `202 Accepted` (production).

## Использование с корзиной

```bash
curl -X POST https://api.apipay.kz/api/v1/invoices \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "87001234567",
    "cart_items": [
      {"catalog_item_id": 101, "count": 2}
    ]
  }'
```

Подробнее: [Счета](invoices.md).

## Примеры кода

### JavaScript

```javascript
// ⚠️ X-API-Key — секрет. Все вызовы API выполняйте со своего сервера;
// в код, который попадает в браузер, ключ помещать нельзя.
import fs from 'node:fs/promises'

const formData = new FormData()
formData.append('image', new Blob([await fs.readFile('photo.jpg')]), 'photo.jpg')
const upload = await fetch('https://api.apipay.kz/api/v1/catalog/upload-image', {
  method: 'POST', headers: { 'X-API-Key': process.env.APIPAY_KEY }, body: formData
})
const { image_id } = await upload.json()

await fetch('https://api.apipay.kz/api/v1/catalog', {
  method: 'POST',
  headers: { 'X-API-Key': process.env.APIPAY_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ items: [{ name: 'Кофе латте', selling_price: 1500, unit_id: 1, image_id }] })
})
```

### Python

```python
import requests
# Загрузка изображения
with open('photo.jpg', 'rb') as f:
    resp = requests.post('https://api.apipay.kz/api/v1/catalog/upload-image',
        headers={'X-API-Key': 'YOUR_API_KEY'}, files={'image': f})
image_id = resp.json()['image_id']

# Создание товаров
requests.post('https://api.apipay.kz/api/v1/catalog',
    headers={'X-API-Key': 'YOUR_API_KEY', 'Content-Type': 'application/json'},
    json={'items': [{'name': 'Кофе латте', 'selling_price': 1500, 'unit_id': 1, 'image_id': image_id}]})
```
