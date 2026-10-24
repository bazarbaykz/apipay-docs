# Sandbox

A new organization is created in the sandbox: invoices do not go to Kaspi, money does not move, and neither the business profile nor a cashier is needed. The API key is the same one that will work in production mode — switching the mode does not change it.

The sandbox answers with the same refusal codes and bodies as production, so you can run not only the payment but every error your integration handles. An outcome is set in three ways: the `X-Sandbox-Scenario` header (a synchronous refusal), the organization state (`/sandbox/state`) and a requested outcome (the `simulate` field and the `…/simulate*` endpoints). The `…/simulate*` and `/sandbox/*` endpoints work only for a sandbox organization — for a production one they return `403 not_sandbox`. But the `X-Sandbox-Scenario` header, the magic numbers and the `simulate` field in an invoice, cancellation, refund, buyer link, catalog or shift closing produce no refusal for a production organization and have no effect: the request runs for real — the invoice goes to the buyer, the refund returns money (see [Production organization](#production-organization)).

> A machine-readable matrix of scenarios, magic numbers and simulations — `sandbox-scenarios.json` at the root of this repository.

## Sandbox limits

| What | Limit |
|---|---|
| Test invoices | 1000 per organization (`400 sandbox_invoice_limit`) |
| Test subscriptions | 10 per organization (`400 sandbox_subscription_limit`) |
| Catalog items | 1000 |
| `POST /invoices/{id}/simulate-status` | 60 requests per minute per key, separate from the general limit |

Sandbox invoices do not count towards the tariff's daily limit.

## Synchronous refusal — `X-Sandbox-Scenario`

The `X-Sandbox-Scenario: <slug>` header returns exactly the response the production endpoint would give, even before the request body is validated. The response carries `X-Sandbox-Scenario-Applied: <slug>`. If the scenario does not apply to this request, the request goes the normal way and the response carries `X-Sandbox-Scenario-Ignored: not_applicable`. An unknown slug — `422 sandbox_scenario_unknown` with the list of scenarios.

> ⛔ The examples in this chapter are for a sandbox organization's key only. In a live organization the header is ignored and the request goes through as usual — with a real invoice.

```bash
curl -i -X POST https://api.apipay.kz/api/v1/invoices \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "X-Sandbox-Scenario: tariff_inactive" \
  -H "Content-Type: application/json" \
  -d '{"amount": 5000, "phone_number": "87770000001"}'
```

| slug | Where | Response |
|---|---|---|
| `tariff_inactive` | paid operations | `403` |
| `kaspi_session_expired` | `POST /invoices` | `409` |
| `kaspi_session_invalid` | `POST /invoices` | `503` |
| `kaspi_session_not_configured` | `POST /invoices` | `400` |
| `trial_daily_limit`, `tariff_limit_reached`, `kyc_daily_limit_reached` | `POST /invoices` | `429` and `Retry-After` |
| `kyc_rejected` | `POST /invoices` | `403` |
| `connection_ambiguous` | `POST /invoices` | `422` |
| `organization_not_verified` | `POST /invoices` | `400` |
| `invoices_disabled` | `POST /invoices`, `POST /invoices/bulk`, `POST /invoices/qr`, `POST /static-qr` | `503` |
| `qr_rate_limit` | `POST /invoices/qr` without `static` | `429` |
| `static_qr_disabled` | `POST /invoices/qr` with `static: true` | `403` |
| `recipient_name_unavailable` | `POST /static-qr`, `POST /invoices/qr` with `static: true` | `422` |
| `request_rate_limited` | any request | `429` and `Retry-After` |

## Organization state — `/sandbox/state`

`PUT /sandbox/state` sets what the sandbox simulates for all subsequent application requests without the header; `GET /sandbox/state` shows the current state. `PUT` changes only the fields passed; an unknown field — `422`. The state is reset by a mode switch and by clearing the sandbox.

```bash
curl -X PUT https://api.apipay.kz/api/v1/sandbox/state \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"cashier_session": "expired"}'
```

| Field | Values | What it simulates |
|---|---|---|
| `tariff` | `active`, `inactive`, `trial_exhausted`, `limit_reached` | `403 tariff_inactive` on paid operations, `429 trial_daily_limit` or `429 tariff_limit_reached` on `POST /invoices` |
| `kyc` | `approved`, `pending`, `rejected` | `rejected` — `403 kyc_rejected` on `POST /invoices` |
| `cashier_session` | `ok`, `expired`, `invalid`, `not_configured` | cashier session refusals on `POST /invoices`; `GET /account/health` shows the same state |
| `kaspi_egress` | `open`, `paused` | `paused` — a phone invoice is accepted and held in `processing` until the pause is lifted |
| `webhook_retry_grid` | `short`, `live` | webhook retries for a sandbox invoice: `short` — a few short attempts, `live` — as many attempts as in production, with compressed intervals |
| `hold` | `true`, `false` | `GET /account/health` shows invoice accumulation |

⛔ The state affects only your application's requests made with an API key. The dashboard and the connection status in it show the truth.

## Requested outcome

| What | How |
|---|---|
| Phone invoice | the `simulate` field in `POST /invoices` (`{"status": "pending"}` or `{"status": "error", "error_code": "client_not_found"}`) or a magic buyer number (below) |
| QR invoice | `simulate` in `POST /invoices/qr`: the string `paid`, `cancelled` or `expired` — move the invoice to that status right away; the object `{"status": "error", "error_code": "kaspi_error"}` — a synchronous refusal with the same responses as in production. Forbidden with `static: true` |
| Invoice status | `POST /invoices/{invoice}/simulate-status` — by the transition table below |
| Invoice cancellation | `simulate` in `POST /invoices/{id}/cancel`: `{"outcome": "cancelled"}` (default), `rejected` (Kaspi refused — the invoice silently returns to `pending` without a webhook) or `error` with `error_code` |
| Kaspi receipt for an invoice | `POST /invoices/{id}/receipt/simulate` with `outcome`: `pending_then_ready` (default — first `202`, then `200`) or a production refusal |
| Refund | `simulate` in `POST /invoices/{id}/refund`: `{"status": "completed" \| "failed" \| "uncertain", "error_code": …}`; resolving an unknown outcome — `POST /invoices/{invoice}/refunds/{refund}/simulate-resolve`, lifting the hold — `POST /invoices/{invoice}/refunds/{refund}/simulate-release-hold` |
| "Возврат ApiPay" buyer link | `simulate` in `POST /qr-refunds/links` and in `execute` — the outcome of the money execution; the buyer's steps — `POST /qr-refunds/{id}/simulate` |
| Catalog item | `items[].simulate` in `POST /catalog` |
| Fiscal receipt | `simulate` in `POST /receipts` |
| Shift closing | `simulate` in `POST /cashbox/shifts/close` |
| Subscription | `POST /subscriptions/{subscription}/simulate-billing`, `POST /subscriptions/{subscription}/simulate` |
| Payment link and printed sheet | `POST /static-qr/{id}/simulate` |
| Webhook signature | `POST /webhook-test` with `signature`: `valid`, `invalid` or `missing` |
| Delivery retry | `POST /webhook-logs/{id}/retry` |

### Phone invoice and magic numbers

Without the `simulate` field the outcome is set by the buyer's number. Magic numbers produce `error` with a production code and text, and an `invoice.status_changed` webhook:

| Number | `error_code` |
|---|---|
| `87770000002` | `client_not_found` |
| `87770100003` | `kaspi_throttled` |
| `87770100004` | `network_unavailable` |
| `87770100005` | `session_transient` |
| `87770100006` | `kaspi_error` |
| `87770100007` | `unknown_error` |
| `87770100008` | `organization_not_configured` |
| `87770100009` | `kaspi_session_unavailable` |

Other numbers — `pending`. ⛔ For a production organization a magic number is an ordinary number: the invoice goes to a real subscriber. Do not use these numbers outside the sandbox.

### Invoice status transitions — `simulate-status`

`POST /invoices/{invoice}/simulate-status` moves a sandbox invoice only along transitions that happen in production, and sends an `invoice.status_changed` webhook:

| From | To | What it simulates |
|---|---|---|
| `pending` | `paid`, `cancelled`, `expired`, `error`, `qr_scanned` | outcomes of waiting and a QR scan |
| `cancelled`, `expired` | `paid` | late payment |
| `error` | `pending` | reconciliation found a live invoice — a `pending` webhook arrives, as in production |
| `cancelling` | `cancelled`, `pending`, `error` | cancellation outcomes; the return to `pending` — without a webhook |
| `paid` | `qr_scanned` | the scan arrived after payment |

A pair not in the table — `400 invalid_status_transition` with `current_status` and `allowed_from`. `qr_scanned` does not change the status and sends `invoice.qr_scanned`; for a non-QR invoice — `400 not_qr_invoice`, a repeat — `400 already_scanned`. With `status: error` you can set `error_code` (default `sandbox_simulated_error`) and `error_message`.

```bash
curl -X POST https://api.apipay.kz/api/v1/invoices/42/simulate-status \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"status": "paid"}'
```

> ⚠️ After `error`, `pending` may arrive again — it is a new transition, not a duplicate, even if `pending` already arrived for this invoice; after such a `pending`, `error` may arrive again. Make sure your deduplication drops neither (see [Webhooks → Deduplication](webhooks.md#deduplication)).

### Buyer link — `POST /qr-refunds/{id}/simulate`

In the sandbox, as in production, the link starts in `awaiting_customer`.

| `event` | Transition |
|---|---|
| `activated` | the buyer pressed "refund": `awaiting_customer → awaiting_scan` |
| `identified` | the buyer confirmed their identity: `awaiting_scan → customer_identified`; for a link tied to an invoice it starts automatic execution |
| `expired` | the scan window closed: if windows remain, the link returns to `awaiting_customer`, otherwise `expired` |
| `link_expired` | the link's validity ran out without waiting 24 hours |
| `failed` with `error_code: qr_refund_activation_failed` | confirmation did not start |
| `failed` with another code, `execution_uncertain` | requests the outcome of the next money execution |

An event that cannot be executed from the current state — `409 qr_refund_simulation_not_applicable`, the transition is not performed.

**The whole refund fallback:** a refund with `hold_for_buyer_confirmation: true` and `simulate: {"status": "failed", "error_code": "refund_requires_buyer_confirmation"}` → your application issues a link `POST /qr-refunds/links` with `invoice_id` and `source_refund_id` → `activated` → `identified`. After `qr_refund.completed` the sandbox, like production, sends a second signal: `invoice.refunded` with `status: completed` and a different `refund.id`, and the original refund in `GET /invoices/{id}/refunds` gets `successor_refund_id`. More — [Refunds](refunds.md#fallback-a-link-to-the-buyer).

### Subscriptions

- `POST /subscriptions/{subscription}/simulate-billing` with `outcome` — issues a subscription invoice without waiting for `next_billing_at` and brings it to the outcome: `paid` → `subscription.payment_succeeded`; `expired`, `cancelled`, `error` → `subscription.payment_failed`; `payer_refused` → the subscription is cancelled (`subscription.cancelled`, `reason: payer_refused`); `payer_error` → a refusal by the payer's number (`client_not_found`). The response is `202`; the outcome arrives by webhook. Not applicable (a calendar autopayment, no remaining payments, an invoice already pending) — `409 subscription_simulation_not_applicable`.
- `POST /subscriptions/{subscription}/simulate` with `event`: `grace_expired` — the grace period ended now (`subscription.expired`); `busy_lock` — subscription billing is busy for `duration_seconds` (at most 120), skipping a period returns `409 subscription_busy`.

### Payment link and printed sheet — `POST /static-qr/{id}/simulate`

Simulates the buyer on the payment page. `scanned` creates a payment attempt — an invoice, as when "Pay" is pressed: its `invoice.id` comes in the response, and the invoice has `static_qr_id` set. `paid` and `cancelled` — the latest open invoice of the link or sheet is paid or cancelled. Further outcomes of the attempt (expiry, late payment) are played with `simulate-status` on its `invoice.id`. If the link or sheet is not issuing invoices right now — `409 static_qr_unavailable`.

This is how a second payment for one order is reproduced: attempt A `scanned` → `simulate-status` `expired` on A → `scanned` again (attempt B) → `paid` on B → `simulate-status` `paid` on A. Your handler must accept payment B and recognize payment A as a second payment (see [Invoices → Payment link and printed QR](invoices.md#payment-link-and-printed-qr)).

## What works in the sandbox as in production

- **Invoice cancellation.** A QR invoice cannot be cancelled — `409 qr_cancel_unsupported`. A phone invoice already passed to Kaspi returns `202` with status `cancelling`; the outcome arrives by webhook.
- **Kaspi receipt for an invoice.** `GET /invoices/{id}/receipt` first returns `202`, then `200`; the links in a sandbox receipt are stubs — do not give them to the buyer.
- **Status check.** `POST /invoices/status/check` works.
- **Buyer link** starts in `awaiting_customer`.
- **Signature test.** `POST /webhook-test` with `signature: invalid` or `missing` sends a forged or unsigned body to the key's address — your handler must reject it. These forms work only in the sandbox.
- **Delivery retry.** A failed delivery is repeated the same way as with the retry button in the dashboard's «Лог уведомлений» (notification log): in the sandbox, `POST /webhook-logs/{id}/retry` sends the same body to the key's current address (`422 webhook_log_not_retryable` for a `skipped` or successful row, `409 webhook_circuit_open` while sending is paused). In a live organization this endpoint returns `403 not_sandbox`.
- **QR link.** The `qr_token_url` of a sandbox QR invoice leads not to Kaspi but to an ApiPay test page. Do not parse the address path — its format is not part of the contract; the sandbox flag is `is_sandbox`.

## Clearing

`POST /sandbox/clear` deletes sandbox invoices, subscriptions, refunds, buyer links and catalog items, requested outcomes and the sandbox state. Clearing too often — `429 clear_cooldown`; clearing already in progress — `409 operation_in_progress`. In the dashboard the "Очистить тестовые данные" (clear test data) button does the same.

## Production organization

- The `X-Sandbox-Scenario` header is ignored; the response carries `X-Sandbox-Scenario-Ignored: live_organization`.
- `simulate` in `POST /invoices`, cancellation, refund, refund link issuance, catalog and shift closing has no effect; the string `simulate` in `POST /invoices/qr` is ignored, the object is rejected with `422`.
- `simulate` in `POST /receipts` and in `POST /qr-refunds/{id}/execute`, the `…/simulate*` endpoints, `/sandbox/*`, `POST /webhook-logs/{id}/retry` and a forged signature in `POST /webhook-test` return `403 not_sandbox`.

⛔ An ignored `X-Sandbox-Scenario` header or `simulate` field does not make the request a trial one: it runs for real — the invoice goes to the buyer, a cancellation cancels the real invoice, a refund sends real money, a real buyer link is issued, the catalog item is created, the shift is closed. A magic number is an ordinary number: the invoice goes to a real subscriber. Remove `simulate` and `X-Sandbox-Scenario` from production code. The path to production mode — [Getting Started](getting-started.md#path-to-production-mode).
