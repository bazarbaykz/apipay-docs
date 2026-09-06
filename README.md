# ApiPay.kz — Kaspi Pay REST API

[![API Version](https://img.shields.io/badge/API-v2.1.0-blue.svg)](https://api.apipay.kz/api/v1)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**REST API for Kaspi Pay — invoices by phone number, payment QR codes, refunds,
subscriptions, product catalog and fiscal receipts.**

ApiPay.kz is an independent service built on top of Kaspi Pay. It is not affiliated with
Kaspi Bank; money goes straight to the merchant's own Kaspi account.

Kaspi and Kaspi Pay are trademarks of their respective owner.

## Documentation

| | |
|---|---|
| 🇷🇺 **Русская документация** | [`docs/ru/`](docs/ru/README.md) |
| 🇬🇧 **English documentation** | [`docs/en/`](docs/en/README.md) |

Russian is the source of the documentation; English is its translation. Both are kept in
step by a check that runs on every pull request — see [CONTRIBUTING.md](CONTRIBUTING.md).

## For machines

| File | What it is |
|---|---|
| [`openapi.yaml`](openapi.yaml) | OpenAPI specification, public API (`X-API-Key`) |
| [`openapi-partner.yaml`](openapi-partner.yaml) | OpenAPI specification, Partner API (`X-Partner-Key`) |
| [`llms.txt`](llms.txt) | Condensed reference for AI agents, with the API changelog |

These three are mirrors of the upstream contract and are overwritten by the next sync —
if you spot a problem in them, open an issue rather than a pull request.

## Code examples

Runnable samples in [`examples/`](examples/): [cURL](examples/curl),
[JavaScript](examples/javascript), [Python](examples/python), [PHP](examples/php).

## Quick reference

- **Base URL** — `https://api.apipay.kz/api/v1`
- **Auth** — `X-API-Key: your_api_key`
- **Rate limit** — 200 requests per minute per key; some endpoints have tighter limits of their own — see [Errors](docs/en/errors.md#rate-limiting)
- **Support** — [apipay.kz](https://apipay.kz) · [WhatsApp +7 700 307 65 12](https://wa.me/77003076512) · [GitHub Issues](https://github.com/bazarbaykz/apipay-docs/issues)

## About the service

ApiPay is operated by **ApiPay LLP** (ТОО «ApiPay»), BIN **260740019652**, registered at
Seifullin Avenue 498, unit 53b, Almalinsky district, Almaty 050012, Kazakhstan. The service
has been operating since 2 February 2026.

Statements here about how Kaspi Pay itself behaves follow
[Kaspi's own help](https://guide.kaspi.kz/) — check it for the current rules on the Kaspi
side.

| | |
|---|---|
| Site | [apipay.kz](https://apipay.kz) |
| Support | [WhatsApp +7 700 307 65 12](https://wa.me/77003076512) |

## Contributing

Pull requests are welcome for `docs/**` and `examples/**`. Read
[CONTRIBUTING.md](CONTRIBUTING.md) first — it explains which files are editable, where the
truth for each layer lives, and how to run the parity check locally.

## License

[MIT](LICENSE)
