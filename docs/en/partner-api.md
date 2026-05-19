# Partner API

The Partner API lets platforms and CRM systems connect their own clients to
ApiPay and issue invoices on their behalf — without manual account setup.

> **Who this is for:** integrators (CRM systems, marketplaces, platforms)
> that onboard merchants programmatically. If you only need to accept
> payments for your own business, use the regular [API](getting-started.md).

## Authentication

All Partner API requests use the `X-Partner-Key` header:

```
X-Partner-Key: pk_your_partner_key_here
```

The partner key is issued by the ApiPay team once your partnership
application is approved. It is shown only once at issuance and stored as a
hash — save it securely, it cannot be recovered.

| Parameter | Value |
|-----------|-------|
| Base URL | `https://bpapi.bazarbay.site` |
| Authentication | Header `X-Partner-Key: pk_...` |
| Content-Type | `application/json` |

## Merchant Onboarding Flow

The core use case: onboard a merchant into ApiPay programmatically. Cashier
authorization is based on a Kaspi SMS code — the merchant gives you the code
they receive from Kaspi.

| Step | Request | Purpose |
|------|---------|---------|
| 1 | `POST /api/partner/organizations` | Create the merchant organization |
| 2 | `POST /api/partner/organizations/{id}/kaspi-auth/init` | Start cashier authorization |
| 3 | `POST /api/partner/organizations/{id}/kaspi-auth/send-phone` | Kaspi sends an SMS to the cashier |
| 4 | `POST /api/partner/organizations/{id}/kaspi-auth/verify-otp` | Confirm the SMS code |
| 5 | `POST /api/partner/organizations/{id}/api-key` | Issue the merchant's API key + webhook |

> **Important:** the authorization `process_id` is valid for 10 minutes.
> Steps 3 and 4 must be completed within that window.

A full runnable example is in [examples/](../../examples/) —
`partner-onboarding.{js,py,php}` and `examples/curl/partner-onboarding.sh`.

## Endpoints

### POST /api/partner/organizations

Create a merchant organization. Idempotent by `external_id` — a repeated
request returns the existing organization.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `has_catalog` | boolean | No | Create the organization with a product catalog |
| `external_id` | string | No | Your own client identifier from your CRM |

**Response** `201 Created` (or `200 OK` on an idempotent repeat):

```json
{ "success": true, "organization": { ... } }
```

### GET /api/partner/organizations

List your organizations, paginated.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `per_page` | number | No | Page size: 1–100 (default 25) |
| `page` | number | No | Page number (default 1) |

**Response:**

```json
{
  "success": true,
  "organizations": [ ... ],
  "current_page": 1,
  "per_page": 25,
  "total": 42,
  "last_page": 2
}
```

### GET /api/partner/organizations/{id}

Get a single organization card.

**Response:** `{ "success": true, "organization": { ... } }`

### DELETE /api/partner/organizations/{id}

Detach an organization: deactivates its API keys and soft-deletes it.

**Response:** `{ "success": true }`

### POST /api/partner/organizations/{id}/kaspi-auth/init

Onboarding step 1 — start Kaspi cashier authorization.

**Response:** `{ "success": true, "process_id": "..." }` — the `process_id` is valid for 10 minutes.

### POST /api/partner/organizations/{id}/kaspi-auth/send-phone

Onboarding step 2 — Kaspi sends an SMS code to the cashier's phone.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `cashier_phone` | string | Yes | Cashier phone number in `7XXXXXXXXXX` format |

**Response:** `{ "success": true }`.
Possible errors: `invalid_phone` (422), `not_cashier` (422), `no_process` (409), `sms_failed` (502).

### POST /api/partner/organizations/{id}/kaspi-auth/verify-otp

Onboarding step 3 — confirm the SMS code.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `otp` | string | Yes | SMS code, 4–6 digits |

**Response** on success: `{ "success": true, "mode": "self", "organization": { ... } }`.
On a wrong code: `{ "success": false, "error": "invalid_otp" }`.

### GET /api/partner/organizations/{id}/kaspi-auth/status

Cashier authorization status.

**Response:** `{ "success": true, "status": "pending|active|...", "kaspi_connected": true, "expires_at": "..." }`

### POST /api/partner/organizations/{id}/api-key

Create or regenerate the merchant's `X-API-Key` and webhook. Idempotent.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | No | A label for the key |
| `webhook_url` | string | Yes | URL for webhook notifications (private or internal addresses are rejected) |
| `webhook_secret` | string | No | Secret for webhook signatures (auto-generated if omitted) |

**Response:**

```json
{
  "success": true,
  "key": "<plaintext, shown once>",
  "key_id": 200,
  "webhook_url": "https://your-crm.example.com/webhooks/kaspi",
  "webhook_secret": "<plaintext>",
  "is_org_default": true,
  "regenerated": false
}
```

The `key` is shown only once — store it securely. Use it as the `X-API-Key`
for the regular API to act on behalf of the merchant.

## Organization Object

All endpoints return the organization in a single format:

```json
{
  "id": 50,
  "name": "Example LLP",
  "idn": "123456789012",
  "status": "pending|verified|suspended",
  "sandbox_mode": false,
  "has_catalog": false,
  "kaspi_connected": true,
  "session_mode": "self",
  "external_id": "crm-client-42",
  "payment_status": "none|active|expired",
  "payment_expires_at": "2026-06-16T00:00:00+00:00",
  "has_active_payment": false,
  "created_at": "2026-05-16T10:00:00+00:00"
}
```

## Rate Limits

| Group | Limit |
|-------|-------|
| `partner-api` (all endpoints) | 120 requests/minute per partner |
| `partner-kaspi-auth` (`send-phone`, `verify-otp`) | 10 requests/minute per partner + organization |

## Error Codes

| HTTP | Meaning |
|------|---------|
| 401 | Invalid or missing `X-Partner-Key` |
| 403 | No access to the requested resource |
| 409 | Conflict — `no_process` (authorization not started or expired), `already_exists` |
| 422 | Field validation failed — `invalid_phone`, `not_cashier`, or a `webhook_url` pointing to a private/internal address |
| 502 | Kaspi API unavailable — `sms_failed` |

## Issuing Invoices for a Merchant

After onboarding, use the merchant's `X-API-Key` (from step 5) with the
regular API — `POST /api/v1/invoices`, subscriptions, refunds, and so on.
See [Getting Started](getting-started.md) and [Invoices](invoices.md).
