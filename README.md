# ApiPay.kz

[![API Version](https://img.shields.io/badge/API-v2.0-blue.svg)](https://bpapi.bazarbay.site/api/v1)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Documentation](https://img.shields.io/badge/docs-available-green.svg)](docs/en/getting-started.md)

**REST API for Kaspi Pay — automated invoicing, refunds, subscriptions, and catalog management.**

ApiPay.kz is an independent service that provides a REST API for Kaspi Pay. Automate invoice creation by phone number, process refunds, manage subscriptions, and maintain your product catalog.

[Russian Documentation (Русская документация)](README.ru.md)

## Quick Start

### 1. Prerequisites

Before creating invoices, you must connect your organization:

1. Get your API key from [ApiPay.kz Dashboard](https://apipay.kz/login)
2. Contact support via [WhatsApp (+7 708 516 74 89)](https://wa.me/77085167489) to connect your Kaspi Business as **"Cashier"**
3. Wait for organization to be connected (usually 5-30 minutes)

### 2. Create Invoice

```bash
curl -X POST https://bpapi.bazarbay.site/api/v1/invoices \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"amount": 10000, "phone_number": "87001234567"}'
```

Response:
```json
{
  "id": 124,
  "amount": "10000.00",
  "status": "pending",
  "created_at": "2025-01-15T10:00:00Z"
}
```

## API Overview

| Endpoint | Description |
|----------|-------------|
| `POST /invoices` | Create payment invoice |
| `GET /invoices` | List invoices |
| `GET /invoices/{id}` | Get invoice details |
| `POST /invoices/{id}/cancel` | Cancel pending invoice |
| `POST /invoices/{id}/refund` | Refund paid invoice |
| `GET /invoices/{id}/refunds` | Invoice refunds |
| `GET /invoices/stats` | Invoice statistics |
| `GET /refunds` | List all refunds |
| `GET /catalog` | List catalog items |
| `POST /catalog/upload-image` | Upload catalog image |
| `POST /catalog` | Create catalog items |
| `PATCH /catalog/{id}` | Update catalog item |
| `DELETE /catalog/{id}` | Delete catalog item |
| `POST /subscriptions` | Create subscription |
| `GET /subscriptions` | List subscriptions |
| `GET /subscriptions/{id}` | Get subscription |
| `PUT /subscriptions/{id}` | Update subscription |
| `POST /subscriptions/{id}/pause` | Pause subscription |
| `POST /subscriptions/{id}/resume` | Resume subscription |
| `POST /subscriptions/{id}/cancel` | Cancel subscription |
| `GET /subscriptions/{id}/invoices` | Subscription invoices |

## Configuration

| Parameter | Value |
|-----------|-------|
| Base URL | `https://bpapi.bazarbay.site/api/v1` |
| Authentication | Header `X-API-Key: your_api_key` |
| Rate Limit | 60 requests/minute |

## Documentation

- [Getting Started](docs/en/getting-started.md) — Prerequisites, connection, first invoice
- [Invoices](docs/en/invoices.md) — Create, list, cancel invoices
- [Subscriptions](docs/en/subscriptions.md) — Recurring billing and subscription management
- [Catalog](docs/en/catalog.md) — Product catalog management
- [Refunds](docs/en/refunds.md) — Full and partial refunds
- [Webhooks](docs/en/webhooks.md) — Real-time payment notifications
- [Error Codes](docs/en/errors.md) — HTTP status codes and error handling

## Code Examples

Ready-to-run examples in multiple languages:

- [JavaScript/Node.js](examples/javascript/)
- [Python](examples/python/)
- [PHP](examples/php/)
- [cURL](examples/curl/)

## OpenAPI Specification

Full OpenAPI 3.0 specification is available at [openapi.yaml](openapi.yaml).

You can import it into [Swagger Editor](https://editor.swagger.io/), [Postman](https://www.postman.com/), or any other OpenAPI-compatible tool.

## Support

- **WhatsApp**: [+7 708 516 7489](https://wa.me/77085167489)
- **Dashboard**: [apipay.kz](https://apipay.kz)
- **Issues**: [GitHub Issues](../../issues)

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

Made with love in Kazakhstan
