# Python

An example built on the [`requests`](https://pypi.org/project/requests/) library: creating an invoice for payment.

```bash
pip install requests
```

The key is read from an environment variable, so do not keep it in the code.

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
        'description': 'Payment for order #123',
    },
    timeout=30,
)
response.raise_for_status()

invoice = response.json()
print(invoice['id'], invoice['status'])
```

Running it:

```bash
APIPAY_API_KEY=your_api_key python create_invoice.py
```

The `processing` status in the response means the invoice has been accepted and queued, but it has not reached Kaspi yet. Wait for the `invoice.status_changed` webhook (or poll `GET /invoices/{id}`): the customer sees the payment request only once the status becomes `pending`.

Full examples covering invoice creation, customer checks, subscriptions, the catalog and a webhook handler live in [`examples/python/`](https://github.com/bazarbaykz/apipay-docs/tree/main/examples/python).
