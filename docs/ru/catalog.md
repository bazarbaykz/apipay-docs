# Каталог

API каталога позволяет управлять товарами. Товары из каталога используются при создании счетов с корзиной (`cart_items`).

## Список товаров

**Эндпоинт:** `GET /catalog`

Фильтры: `search`, `barcode`, `first_char`. Пагинация: `page`, `per_page` (1-200).

## Загрузка изображения

**Эндпоинт:** `POST /catalog/upload-image`

```bash
curl -X POST https://bpapi.bazarbay.site/api/v1/catalog/upload-image \
  -H "X-API-Key: YOUR_API_KEY" \
  -F "image=@photo.jpg"
```

Формат: `multipart/form-data`. Макс. 10 МБ. Форматы: jpg, png, gif, webp.

Ответ: `{"image_id": "550e8400-..."}`.

## Создание товаров

**Эндпоинт:** `POST /catalog`

Пакетное создание 1-50 товаров.

```bash
curl -X POST https://bpapi.bazarbay.site/api/v1/catalog \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"items": [{"name": "Кофе латте", "selling_price": 1500, "unit_id": 1, "image_id": "550e8400-..."}]}'
```

Поля: `name` (обяз.), `selling_price` (обяз.), `unit_id` (обяз.), `image_id` (опц.).

## Обновление товара

**Эндпоинт:** `PATCH /catalog/{id}`

Поля: `name`, `selling_price`, `unit_id`, `image_id`, `is_image_deleted`.

## Удаление товара

**Эндпоинт:** `DELETE /catalog/{id}`

## Использование с корзиной

```bash
curl -X POST https://bpapi.bazarbay.site/api/v1/invoices \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "87001234567",
    "cart_items": [
      {"Name": "Кофе латте", "Price": 1500, "Count": 2, "Type": "CATALOGUE", "NomenclatureId": 101, "UnitId": 1}
    ]
  }'
```

Подробнее: [Счета](invoices.md).

## Примеры кода

### JavaScript

```javascript
// Загрузка изображения
const formData = new FormData()
formData.append('image', fileInput.files[0])
const upload = await fetch('https://bpapi.bazarbay.site/api/v1/catalog/upload-image', {
  method: 'POST', headers: { 'X-API-Key': 'YOUR_API_KEY' }, body: formData
})
const { image_id } = await upload.json()

// Создание товаров
await fetch('https://bpapi.bazarbay.site/api/v1/catalog', {
  method: 'POST',
  headers: { 'X-API-Key': 'YOUR_API_KEY', 'Content-Type': 'application/json' },
  body: JSON.stringify({ items: [{ name: 'Кофе латте', selling_price: 1500, unit_id: 1, image_id }] })
})
```

### Python

```python
import requests
# Загрузка изображения
with open('photo.jpg', 'rb') as f:
    resp = requests.post('https://bpapi.bazarbay.site/api/v1/catalog/upload-image',
        headers={'X-API-Key': 'YOUR_API_KEY'}, files={'image': f})
image_id = resp.json()['image_id']

# Создание товаров
requests.post('https://bpapi.bazarbay.site/api/v1/catalog',
    headers={'X-API-Key': 'YOUR_API_KEY', 'Content-Type': 'application/json'},
    json={'items': [{'name': 'Кофе латте', 'selling_price': 1500, 'unit_id': 1, 'image_id': image_id}]})
```
