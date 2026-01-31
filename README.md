# ApiPay.kz

[![API Version](https://img.shields.io/badge/API-v1.0-blue.svg)](https://bpapi.bazarbay.site/api)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Documentation](https://img.shields.io/badge/docs-available-green.svg)](docs/en/getting-started.md)

**Accept Kaspi Pay payments in Kazakhstan without a bank contract.**

ApiPay.kz provides a simple REST API for accepting payments via Kaspi Pay using customer phone numbers. No bank agreements required, no commissions.

[Russian Documentation (Русская документация)](README.ru.md)

## Quick Start

### 1. Prerequisites

Before creating invoices, you must verify your organization:

1. Get your API key from [ApiPay.kz Dashboard](https://baypay.bazarbay.site/login)
2. Open **Kaspi Business** app on your phone
3. Go to **Settings → Employees → Add Employee**
4. Add phone number **77056610934** with **"Cashier"** rights
5. Verify your organization via API (see below)

### 2. Verify Organization

```bash
curl -X POST https://bpapi.bazarbay.site/api/organizations/verify \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"idn": "123456789012"}'
```

Poll status every 2 seconds until `status: "verified"`:

```bash
curl https://bpapi.bazarbay.site/api/organizations/{id}/status \
  -H "X-API-Key: YOUR_API_KEY"
```

### 3. Create Invoice

```bash
curl -X POST https://bpapi.bazarbay.site/api/invoices \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"amount": 10000, "phone_number": "87001234567"}'
```

Response:
```json
{
  "id": 42,
  "payment_url": "https://kaspi.kz/pay/...",
  "status": "pending"
}
```

**Redirect your customer to `payment_url` to complete payment.**

## API Overview

| Endpoint | Description |
|----------|-------------|
| `POST /organizations/verify` | Start organization verification |
| `GET /organizations/:id/status` | Check verification status |
| `POST /invoices` | Create payment invoice |
| `GET /invoices` | List invoices |
| `GET /invoices/:id` | Get invoice details |
| `POST /invoices/:id/cancel` | Cancel pending invoice |
| `POST /invoices/:id/refund` | Refund paid invoice |
| `POST /recurring-invoices` | Create recurring invoice |
| `GET /recurring-invoices` | List recurring invoices |

## Configuration

| Parameter | Value |
|-----------|-------|
| Base URL | `https://bpapi.bazarbay.site/api` |
| Authentication | Header `X-API-Key: your_api_key` |
| Rate Limit | 60 requests/minute |

## Documentation

- [Getting Started](docs/en/getting-started.md) — Prerequisites, verification, first invoice
- [Invoices](docs/en/invoices.md) — Create, list, cancel invoices
- [Recurring Payments](docs/en/recurring.md) — Subscription billing
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
- **Dashboard**: [baypay.bazarbay.site](https://baypay.bazarbay.site)
- **Issues**: [GitHub Issues](../../issues)

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

Made with love in Kazakhstan
