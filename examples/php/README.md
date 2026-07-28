# PHP Examples

Plain PHP, no Composer and no dependencies — the only requirement is the bundled
cURL extension (`ext-curl`), which is enabled in virtually every PHP build.

## Requirements

- PHP 7.4 or newer (tested on 8.4)
- `ext-curl` and `ext-json` enabled

Check both at once:

```bash
php -m | grep -E '^(curl|json)$'
```

## Configuration

The API key is read from an environment variable — never hardcode it and never
commit it. Get the key in the dashboard: Settings → Connection.

```bash
export API_KEY="your_api_key"
```

Base URL for every example is `https://api.apipay.kz/api/v1`, authentication is
the `X-API-Key` header.

## Running the examples

| File | What it shows | How to run |
|------|---------------|------------|
| `create-invoice.php` | Create a payment invoice | `API_KEY=your_key php create-invoice.php` |
| `check-client.php` | Check whether a phone number is registered in Kaspi | `APIPAY_API_KEY=your_key php check-client.php` |
| `create-subscription.php` | Recurring billing | `API_KEY=your_key php create-subscription.php` |
| `manage-catalog.php` | Product catalog operations | `API_KEY=your_key php manage-catalog.php` |
| `webhook-handler.php` | Receive a webhook and verify its signature | see below |
| `partner-onboarding.php` | Onboard a merchant via the Partner API | see below |

> `check-client.php` reads `APIPAY_API_KEY` while the other scripts read `API_KEY`.
> Export both to the same value if you want to run everything in one session.

### webhook-handler.php

This one is not a CLI script — it is an endpoint. Serve it and point the webhook
URL in the dashboard at it:

```bash
WEBHOOK_SECRET=your_secret php -S 0.0.0.0:8000 webhook-handler.php
```

The secret comes from the dashboard together with the webhook URL. Without
`WEBHOOK_SECRET` the script refuses to process anything and answers `500` — that
is deliberate: an unverified webhook must never be trusted. For a local run,
expose the port with a tunnel; note that not-yet-approved organizations must use
a real domain, tunnels and bare IPs are rejected. See
[Webhooks](../../docs/en/webhooks.md).

### partner-onboarding.php

Runs in two phases, because the cashier confirms the connection with an SMS code:

```bash
# 1. Create the organization and send the SMS
PARTNER_KEY=pk_... CASHIER_PHONE=77001234567 php partner-onboarding.php

# 2. Finish once the merchant gives you the code
PARTNER_KEY=pk_... ORG_ID=50 OTP=1234 php partner-onboarding.php
```

`PARTNER_KEY` is a partner key, not a merchant API key — see
[Partner API](../../docs/en/partner-api.md).

## Notes

- Amounts are in tenge (KZT); phone numbers use the `87001234567` form.
- `POST /invoices` answers `201` with `status: "processing"` — the invoice is
  accepted but has not reached Kaspi yet. The final status arrives via the
  `invoice.status_changed` webhook or from `GET /invoices/{id}`. Do not re-create
  an invoice while it is `processing`, or you get a second invoice for the same
  amount.
- Branch on `error_code`, not on the `message` text — the wording can change.
  Full list: [Error Codes](../../docs/en/errors.md).

Examples in other languages: [JavaScript](../javascript/), [Python](../python/),
[cURL](../curl/).
