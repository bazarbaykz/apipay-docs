# Python

Пример на библиотеке [`requests`](https://pypi.org/project/requests/): создание счёта на оплату.

```bash
pip install requests
```

Ключ читается из переменной окружения — не храните его в коде.

```python
import os

import requests

API_KEY = os.environ['APIPAY_API_KEY']
API_BASE_URL = 'https://api.apipay.kz/api/v1'

response = requests.post(
    f'{API_BASE_URL}/invoices',
    headers={
        'X-API-Key': API_KEY,
        'Content-Type': 'application/json',
    },
    json={
        'amount': 10000,
        'phone_number': '87001234567',
        'description': 'Оплата заказа #123',
    },
    timeout=30,
)
response.raise_for_status()

invoice = response.json()
print(invoice['id'], invoice['status'])
```

Запуск:

```bash
APIPAY_API_KEY=ваш_ключ python create_invoice.py
```

Статус `processing` в ответе означает, что счёт принят и поставлен в очередь — в Kaspi он ещё не ушёл. Дождитесь вебхука `invoice.status_changed` (или опросите `GET /invoices/{id}`): клиент увидит запрос на оплату только после того, как статус станет `pending`.

Полные примеры — создание счёта, проверка клиента, подписки, каталог, обработчик вебхуков — лежат в [`examples/python/`](https://github.com/bazarbaykz/apipay-docs/tree/main/examples/python).
