# Cash register

Kaspi register shifts, cash on hand and reconciliation of the register with ApiPay invoices.

Use this section when the organization has a Kaspi register: it lets you close shifts, fetch PDF reports for them, see the cash balance and put the register total next to paid ApiPay invoices — without manual work in the app.

## Prerequisites

1. **A Kaspi register (OFD) is connected to the Kaspi Pay account.** This is the same connection that enables the product catalog. If sales run through Kaspi Pos without OFD, the organization has no register shifts at all: the "Cash register" section is not shown in the dashboard, and the endpoints refuse — `409 cashbox_kkm_unknown` for the shift list and closing, `409 rfo_missing` for the summary and the toggles. There is nothing to wait for: the register number will not appear.
2. **A Kaspi cashier is connected.** Cashbox endpoints work through an active cashier session — except reconciliation, which reads shifts you already fetched. Otherwise you get `409 kaspi_session_not_configured`. With several active registers pass `kaspi_connection_id`, otherwise `422 connection_ambiguous`.
3. **The trade point and register are known.** Without the trade point code you get `409 rfo_missing`, without the register number — `409 cashbox_kkm_unknown`. If the Kaspi register is connected and the codes still arrive: pass the `kaspi_connection_id` of the right point when there are several registers, and have the merchant re-check the organization state by reconnecting the cashier or via the "Refresh organization info" button in the dashboard settings. ⚠️ That action may enable the product catalog: after it `POST /invoices/qr` and `POST /static-qr` without `cart_items` answer `422 catalog_requires_cart_items`, and already printed QR sheets without a basket stop working.
4. **An active subscription.** The cash register is part of the paid features.

**In the sandbox the register always responds** — with deterministic data, regardless of whether a Kaspi register is connected in production and whether there is a cashier. Always verify an integration that passed in the sandbox against a production organization. The "Cash register" section in a test organization's dashboard appears only if the organization was created with the "has a register" answer (the answer can be changed in settings).

**Separate rate limit:** 30 requests per minute per key — stricter than the general one.

All amounts arrive as strings like `"12000.00"` and may be `null`. `null` means "Kaspi did not return the field", not zero.

## Cash for the day

**Endpoint:** `GET /cashbox/summary`

```bash
curl "https://api.apipay.kz/api/v1/cashbox/summary?date=2026-08-10" \
  -H "X-API-Key: YOUR_API_KEY"
```

`date` is optional (today by default, Asia/Almaty); a future date returns `422`.

| Field | Description |
|-------|-------------|
| `current_cash_balance` | Cash in the register right now |
| `cash_amount_on_opening` | Balance at the start of the day |
| `replenishment_sum` / `withdrawal_sum` | Added and withdrawn during the day |
| `sale_cash_amt` / `sale_cash_cnt` | Cash sales: amount and count |
| `sale_return_cash_amt` / `sale_return_cash_cnt` | Cash refunds |
| `auto_withdrawal` | Whether automatic cash withdrawal is on |
| `available_cashbox_actions` | `false` — Kaspi has temporarily disallowed register operations |

Cash only. Payments for ApiPay invoices are not included here — `GET /invoices` returns those.

## List of shifts

**Endpoint:** `GET /cashbox/shifts`

```bash
curl "https://api.apipay.kz/api/v1/cashbox/shifts?date_from=2026-08-09&date_to=2026-08-09" \
  -H "X-API-Key: YOUR_API_KEY"
```

`date_from` and `date_to` are required and the window cannot exceed 31 days, otherwise `422`. The request goes to the Kaspi register, so it is not instant — set a generous client timeout.

```json
{
  "auto_close_shift": true,
  "shifts": [
    {
      "id": 118275707,
      "shift_number": 106,
      "start_date": "2026-08-09",
      "is_current": false,
      "total_income": "89000.00",
      "total_income_raw": "89 000 ₸",
      "transactions_count": 12
    }
  ]
}
```

`total_income_raw` is Kaspi's own formatting meant for display — do not parse it. Use `total_income` for arithmetic.

> This call is required before reconciliation: it works on a shift fetched by this request.

## Shift report

**Endpoint:** `GET /cashbox/shifts/{shift}/report`

```bash
curl "https://api.apipay.kz/api/v1/cashbox/shifts/118275707/report" \
  -H "X-API-Key: YOUR_API_KEY"
```

```json
{ "url": "https://...", "expires_at": "2026-08-10T09:15:00+05:00" }
```

The response is a signed link that lives about 15 minutes, not the file itself. Download it immediately; request the link again if you need it later.

The link opens without an API key: anyone holding it can download the report until it expires — do not log it or forward it further than necessary; an issued link cannot be revoked.

## Closing a shift

**Endpoint:** `POST /cashbox/shifts/close`

```bash
curl -X POST https://api.apipay.kz/api/v1/cashbox/shifts/close \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "client_operation_id": "close-2026-08-10-01", "shift_number": 106 }'
```

The response is `202`:

```json
{ "id": 812, "status": "pending", "client_operation_id": "close-2026-08-10-01", "poll_url": "..." }
```

Read the result in one of two ways:

- poll `GET /cashbox/operations/{id}` until the status is `completed` or `failed`;
- the `cashbox.shift_closed` and `cashbox.shift_close_failed` webhooks.

### Idempotency and retries

`client_operation_id` (8–191 characters from `A-Za-z0-9._:-`) is unique per organization. Reusing it returns `409 cashbox_duplicate_operation` with the `operation_id` of the accepted operation — that one can be polled too.

For a `failed` operation check `resolution.safe_to_retry`:

| Value | Meaning |
|-------|---------|
| `true` | The shift stayed open — retry the closing with a **new** `client_operation_id` |
| `false` | It is unknown whether the shift closed — automatic retries are not allowed, verify the shift state |

The previous key is not released after a failure. A Kaspi response of "shift already closed" counts as success: the target state is reached.

## Reconciliation with invoices

**Endpoint:** `GET /cashbox/reconciliation`

```bash
curl "https://api.apipay.kz/api/v1/cashbox/reconciliation?shift_id=118275707" \
  -H "X-API-Key: YOUR_API_KEY"
```

`shift_id` is required. Fetch the shift via `GET /cashbox/shifts` first, otherwise you get `404 cashbox_shift_not_found`. Reconciliation itself does not need an active cashier session.

The response has three blocks:

- `ours` — your ApiPay invoices within the shift window: `sales`, `refunds`, `net_amount` and `sales.refunded_later`. The window is counted by invoice payment date. With several registers note that `sales` are counted for the cashier of this shift while `refunds` are counted across the whole organization, so `net_amount` is not comparable with a single register in that setup.
- `kaspi` — the shift total: `total_income`, `transactions_count`, `is_current`, plus `snapshot.stale` (a snapshot older than 15 minutes — refresh the list of shifts).
- `discrepancies[]` — structural reasons for the difference: `kaspi_income_includes_offline_sales`, `shift_not_calendar_day`, `open_shift_moving_target`, `paid_at_timezone_boundary`, `invoices_without_connection` (with a `count` field), `kaspi_snapshot_stale`.

> **The difference is not calculated.** The shift total in the register is a single sum where cash sales and sales made outside ApiPay are not separated. The response has no `verdict`, `comparable` or `delta` fields — a human draws the conclusion from both numbers and the reasons.

## Register settings

| Endpoint | What it does |
|----------|--------------|
| `GET /cashbox/settings` | Stored toggle values |
| `PUT /cashbox/settings/auto-close` | Automatic shift closing |
| `PUT /cashbox/settings/auto-withdrawal` | Automatic cash withdrawal when the shift closes |

```bash
curl -X PUT https://api.apipay.kz/api/v1/cashbox/settings/auto-close \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "enabled": true }'
```

```json
{ "changed": true, "new_value": true }
```

The request is idempotent against the live value on the register: `changed: false` means it already had the requested value — such a call is safe to repeat on every script run.

`GET /cashbox/settings` may return `null`, which means "no stored value yet", not "off". The live state arrives in other responses: automatic closing in `GET /cashbox/shifts`, automatic withdrawal in `GET /cashbox/summary`.

The settings are available via the organization API key; in the dashboard they are limited to the organization owner.

## Webhooks

| Event | When it arrives |
|-------|-----------------|
| `cashbox.shift_closed` | The shift is closed |
| `cashbox.shift_close_failed` | Closing failed, the reason is in `operation.error_code` |

```json
{
  "event": "cashbox.shift_closed",
  "operation": {
    "id": 812,
    "operation_type": "close_shift",
    "status": "completed",
    "shift_number": 106,
    "error_code": null
  },
  "timestamp": "2026-08-10T16:25:43+00:00"
}
```

Deduplicate by the `event` + `operation.id` pair. Signature and general delivery rules are in the [Webhooks](webhooks.md) section.

## Error codes

| Code | HTTP | What to do |
|------|------|------------|
| `cashbox_disabled` | 403 | Register operations are currently unavailable for the organization |
| `cashbox_kkm_unknown` | 409 | No Kaspi register (OFD) is linked to the Kaspi Pay account — the organization has no shifts |
| `cashbox_shift_not_found` | 404 | Call `GET /cashbox/shifts` first |
| `cashbox_no_open_shift` | — (in `operation.error_code`) | There is no open shift to close |
| `cashbox_duplicate_operation` | 409 | An operation with this `client_operation_id` was already accepted |
| `cashbox_busy` | — (in `operation.error_code`) | The register is busy with another operation — repeat the closure with a new `client_operation_id` |
| `cashbox_operation_failed` | — | Kaspi did not complete the operation; see `resolution.safe_to_retry` |
| `cashbox_unavailable` | 503 | The Kaspi register is temporarily unavailable, retry later |
| `cashbox_report_unavailable` | 503 | The report is unavailable right now, retry later |
| `cashbox_toggle_in_progress` | 503 | Another request is changing this setting |
| `cashbox_toggle_unavailable` | 503 | The change was not applied, retry later |

The full reference is in the [Errors](errors.md) section.
