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
| Base URL | `https://api.apipay.kz` |
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

Runnable end-to-end examples are in [examples/](../../examples/):
`javascript/partner-onboarding.js`, `python/partner_onboarding.py`,
`php/partner-onboarding.php`, and `curl/partner-onboarding.sh`.

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
Possible errors: `kyc_required` (403) — the organization profile is not approved yet: a cashier can be connected only after approval, and no SMS is sent to the cashier. Retrying before approval will not help; the current status is in `GET /api/partner/organizations/{id}/kyc`, and the decision arrives via the `kyc.status_changed` webhook.

### POST /api/partner/organizations/{id}/kaspi-auth/send-phone

Onboarding step 2 — Kaspi sends an SMS code to the cashier's phone.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `cashier_phone` | string | Yes | Cashier phone number in `7XXXXXXXXXX` format |

**Response:** `{ "success": true }`.
Possible errors: `invalid_phone` (422), `not_cashier` (422), `no_process` (409), `sms_failed` (502), `kyc_required` (403) — the organization profile is not approved yet: a cashier can be connected only after approval, and no SMS is sent to the cashier. Retrying before approval will not help; the current status is in `GET /api/partner/organizations/{id}/kyc`, and the decision arrives via the `kyc.status_changed` webhook.

### POST /api/partner/organizations/{id}/kaspi-auth/verify-otp

Onboarding step 3 — confirm the SMS code.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `otp` | string | Yes | SMS code, 4–6 digits |

**Response** on success: `{ "success": true, "mode": "self", "organization": { ... } }`.
On a wrong code: `{ "success": false, "error": "invalid_otp" }`.
`kyc_required` (403) — terminal: the profile approval stopped being valid between the steps. Kaspi has already accepted the code, but the connection is not created; the session is closed — after approval, start over with a new `init`.

**Kaspi organization identity.** The pair "BIN + Kaspi organization identifier" is pinned on the first connection and does not change afterwards. Connecting a cashier does not by itself transfer ownership:

| Code | HTTP | What it means |
|------|------|---------------|
| `organization_identity_conflict` | 409 | The Kaspi organization did not match the pinned one, or that pair is already taken by another organization. The response deliberately does not reveal the other organization's details. If the business owner really changed, the request goes to support at 77003076512 |
| `organization_identity_unavailable` | 502 | Kaspi did not return reliable data. The connection is not blocked and any previously confirmed pair is kept: the attempt simply ends, so start over with a new code request |

Other terminal outcomes of this step: `context_expired` (409, Kaspi lost the process context — you need a new `init`, not another OTP), `no_process` (409), `cashier_unavailable` (409), `not_registered` (422, the number is not registered as a cashier — the session is closed and retrying is pointless).

### GET /api/partner/organizations/{id}/kaspi-auth/status

Cashier authorization status.

**Response:** `{ "success": true, "status": "pending|active|...", "process_status": "...", "attempt_status": "none", "kaspi_connected": true, "expires_at": "..." }`

The `attempt_status` field is the status of an individual authorization attempt. It is always a string; when there is no attempt it is `none`. The values are not fixed by the contract: branch on `status` and `process_status`, not on this field. The working session is not cleared when a re-authorization starts, so `status` and `attempt_status` are read separately.

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

## Merchant Tariffs

A merchant's ApiPay subscription is arranged by the partner. All paths below are relative to `https://api.apipay.kz/api/partner`, and authentication uses the same `X-Partner-Key`.

### Two Tariff Billing Modes

| Mode | What the partner does |
|------|-----------------------|
| `payment` (default) | Pays for the merchant's tariff — with a Kaspi invoice (`.../tariff/pay`) or a company invoice (`.../tariff/invoice`) |
| `assignment` | Assigns the tariff for free (`.../tariff/assign`) and settles with ApiPay separately, under contract |

The billing mode is set by ApiPay and cannot be changed through the API. It is not exposed as a field to `X-Partner-Key`: a partner in `payment` mode calling the assignment endpoint gets `403 assignment_not_enabled`.

Your limits grid is visible in the tariff catalog — `GET /tariff-plans` returns `tiers[].daily_limit`, `tiers[].label` and `tiers[].limits_source`.

### GET /tariff-plans

The tariff catalog: 4 tiers (`start`, `business`, `pro`, `pro_max`) and 12 plans — tier × period of 1/3/6 months, with discounts for longer periods.

The catalog is returned **through the eyes of your partner account**. If ApiPay assigned you a limits grid (white-label), `tiers[].daily_limit` and `tiers[].label` carry your values, and `tiers[].limits_source` shows the source: `partner_grid` for the grid, `config` for the global catalog. **The grid never changes prices**: `base_price` and `plans[].price` are always global. Another partner's grid is never returned.

Daily limits in the global catalog: Start — up to 30 invoices, Business — up to 100, Pro — up to 300, Pro Max — up to 600.

### GET /organizations/{id}/tariff

A snapshot of the merchant's subscription. No tariff is `status: "none"`, not a `404`. The `next_payment.amount` field is always present.

Fields for individually negotiated terms: `is_custom` (`true` when the merchant is on negotiated terms), `tier_label` (the tariff name as sold to this merchant) and `daily_limit`.

> ⚠️ With `is_custom: true` the `tier` field stays an **ordinary** identifier (`pro`) — there is no `custom` value. Display the name from `tier_label`, but branch on `tier`.

### POST /organizations/{id}/tariff/pay

Pays for the merchant's tariff with a Kaspi invoice. Body: `tier_id`, `period_months`, `phone` (the **payer's** phone, format `8XXXXXXXXXX`, not the cashier's), optionally `set_billing_phone`.

The tariff is activated asynchronously after payment — wait for the `invoice.status_changed` webhook with the `paid` status. The trial is preserved: the payment extends the subscription from the end of the trial or the current period. A test organization is activated instantly: `201`, `payment.status: "completed"`, `self_api_invoice_id: null`.

This endpoint knows nothing about upgrades — it always charges the full plan price.

### POST /organizations/{id}/tariff/assign

Assigns a tariff to the merchant for free, in `assignment` mode. Body: `tier_id`, `period_months`. The tariff is activated **synchronously** — there is no Kaspi invoice and no payer phone is needed.

- `201` — the tariff was assigned and the term extended, `already_assigned: false`.
- `200` — the requested horizon is already covered by an assignment of the same tariff: the term is not extended, no second payment is created, `already_assigned: true`. Idempotency is defined by **coverage** (the expiry date is not earlier than the requested horizon) rather than by a time window, so CRM retries are safe.

> ⛔ The `tariff.activated` webhook is not sent to a partner for their **own** assignment — that would echo their own request. The whole result is in the response (`payment.expires_at`) and in `GET .../tariff`.

> ⛔ Partners cannot revoke an assignment: ApiPay removes a tariff on request.

If a limits grid is set, only tiers from it are allowed — otherwise `422 tier_not_in_partner_grid`. The daily limit of an assigned tariff also comes from the grid.

**Refusals:** `403 assignment_not_enabled`, `403 partner_not_active`, `403 production_access_required`, `409 test_organization`, `409 hard_limited_org` (a hard tariff restriction is not lifted by an assignment), `409 custom_tariff_locked`, `409 tariff_payment_pending`, `422 tier_not_in_partner_grid`, `422 assignment_horizon_exceeded` (the assignment would push the expiry date more than 12 months ahead).

### POST /organizations/{id}/tariff/invoice

A company invoice for the tariff: synchronously builds a PDF with the buyer's details and returns a public `download_url`. Body: `tier_id`, `period_months`, `buyer_bin`, `buyer_name`, optionally `contract` and `upgrade`.

> ⛔ `download_url` opens **without authentication** — anyone holding the string gets the PDF. Pass it to the buyer directly; do not publish it and do not write it to your logs.

Payment is by bank transfer; **there is no auto-activation** — the ApiPay owner grants the tariff once the funds arrive. The invoice appears in `GET .../tariff/payments` as `payment_method: invoice` with an `invoice` sub-object; the payment moving from `pending` to `completed` means the tariff was granted. Activation is announced by the `tariff.activated` webhook.

**The `upgrade: true` flag** issues an invoice for moving between tiers: the amount is the difference of base prices (Start → Business is 15,000 KZT, not 25,000), `period_months` must be `1`, and `tier_id` is the target tier. The server determines which tier you are moving *from* by the organization's active paid tariff; you cannot pass that value.

The tier the upgrade came from arrives in `upgrade_from` — in the invoice object, in the payment history and in the `tariff.activated` webhook. For a regular plan it is `null`.

> ⛔ **`409 invoice_pdf_failed` must not be retried.** The invoice has already been issued: the records exist and a number was allocated; only the PDF failed to build. A retry would print a second accounting document. The body carries `invoice` with `payment_id` and `number`, without `download_url`; take the number and contact support. If your handler treats this code as retryable, remove the retry.

**Refusals:** `400 downgrade_not_supported` (the target tier is not higher than the current one; downgrades are arranged with support), `409 invoice_locked`, `409 test_organization`, `409 organization_deleted`, `409 no_paid_tariff` (with `upgrade` only — there is nothing to move from), `409 upgrade_invoice_pending` (an unpaid upgrade invoice already exists and is returned in the `invoice` field), `409 custom_tariff_locked`, `422 invalid_tariff_plan`, `422 invalid_upgrade_plan`, `422 upgrade_period_not_supported`, `429 invoice_cooldown` (too many invoices issued in the last 24 hours — wait for `Retry-After`, also `retry_after_seconds` in the body).

### GET /organizations/{id}/tariff/payments and /payments/{paymentId}

The payment history for the merchant's tariff, and a single payment.

### Individually Negotiated Terms

For a merchant on negotiated terms, the tariff is their base tier plus their own limit and price. Switching tiers for such a merchant is refused with `409 custom_tariff_locked` and is arranged with support; **renewing the same tier is not blocked** — that is a payment, not a change of terms. You can detect it up front via `is_custom` in `GET /organizations/{id}/tariff`; the partner plan catalog is organization-agnostic and carries no such flag.

## Rate Limits

| Group | Limit |
|-------|-------|
| All Partner API endpoints | 120 requests/minute per partner |
| Cashier authorization (`send-phone`, `verify-otp`) | 10 requests/minute per partner and organization |

## Error Codes

| HTTP | Meaning |
|------|---------|
| 401 | Invalid or missing `X-Partner-Key` |
| 403 | No access to the requested resource |
| 409 | Conflict — `no_process` (authorization not started or expired), `already_connected` (the organization is already linked to Kaspi; to change the cashier, repeat `init` with `force: true`), `organization_identity_conflict` |
| 422 | Field validation failed — `invalid_phone`, `not_cashier`, or a `webhook_url` pointing to a private/internal address |
| 502 | Kaspi API unavailable — `sms_failed`, `organization_identity_unavailable` |

The codes of the tariff endpoints are listed under [Merchant Tariffs](#merchant-tariffs) — each endpoint has its own set. A refusal body always carries `success: false`, `error` and `error_code` holding the same value; build your logic on `error_code`.

## Issuing Invoices for a Merchant

After onboarding, use the merchant's `X-API-Key` (from step 5) with the
regular API — `POST /api/v1/invoices`, subscriptions, refunds, and so on.
See [Getting Started](getting-started.md) and [Invoices](invoices.md).
