# cURL

The shortest possible scenario: issue an invoice and find out whether it has been paid.

## Setup

Take the key from the dashboard: Settings → Connection. Keep it in an environment variable so you never have to paste it into commands by hand:

```bash
export APIPAY_API_KEY="your_api_key"
```

The base URL is `https://api.apipay.kz/api/v1`, and authentication is the `X-API-Key` header.

## Creating an Invoice

```bash
curl -X POST https://api.apipay.kz/api/v1/invoices \
  -H "X-API-Key: $APIPAY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 10000,
    "phone_number": "87001234567",
    "description": "Order #123",
    "external_order_id": "order_123"
  }'
```

Response:

```json
{
  "id": 124,
  "amount": "10000.00",
  "status": "processing",
  "phone": "87001234567",
  "created_at": "2026-01-15T10:00:00+00:00"
}
```

The `id` in the response is the invoice identifier inside ApiPay; you use it to check the status and to issue a refund.

## Checking the Status

```bash
curl https://api.apipay.kz/api/v1/invoices/124 \
  -H "X-API-Key: $APIPAY_API_KEY"
```

## About `processing` and Webhooks

An invoice is created with the status `processing`, which means "accepted and waiting to be sent to Kaspi", not "paid". It then moves on by itself to `pending` (the customer has been notified) and after that to `paid`, `expired` or `cancelled`. The full list is in [Invoice Statuses](../invoices.md#invoice-statuses).

The better way to learn about payment is the `invoice.status_changed` webhook rather than polling `GET /invoices/{id}` in a loop: the webhook arrives right after the status changes, while polling burns your request limit and still lags behind. Keep polling as a fallback, for example if a webhook does not arrive or you have not set up a receiver yet. Setting one up and verifying the signature is covered in [Webhooks](../webhooks.md).

## Cash register: shift report

```bash
# Step 1: find the shift (both bounds are required, window of 31 days or less).
curl "https://api.apipay.kz/api/v1/cashbox/shifts?date_from=2026-08-09&date_to=2026-08-09" \
  -H "X-API-Key: $APIPAY_API_KEY"

# Step 2: get a temporary link to the PDF and download the file right away.
curl "https://api.apipay.kz/api/v1/cashbox/shifts/118275707/report" \
  -H "X-API-Key: $APIPAY_API_KEY"
```

The link in the response lives for about 15 minutes, so store the file and not the link. Reconciliation
for the same shift is `GET /cashbox/reconciliation?shift_id=118275707`; it requires that the list of
shifts has already been requested. Details are in [Cash register](../cashbox.md).

## Catalog: Full Synchronization from 1C

```bash
# Step 1: upload the current catalog (1 to 100 items per request).
curl -X POST "https://api.apipay.kz/api/v1/catalog" \
  -H "X-API-Key: $APIPAY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {"name": "Latte", "selling_price": 1500, "unit_id": 1, "external_ref": "SKU-LATTE"}
    ]
  }'

# Step 2: dry run over the chunk to see how many of your items would be taken off sale.
#         Exactly one list, ids[] OR external_refs[], no more than 200 values.
curl -X POST "https://api.apipay.kz/api/v1/catalog/bulk-delete" \
  -H "X-API-Key: $APIPAY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"external_refs": ["SKU-OLD-1", "SKU-OLD-2"], "dry_run": true}'

# Step 3: confirmation with the number from the dry run and a UNIQUE key per chunk.
curl -X POST "https://api.apipay.kz/api/v1/catalog/bulk-delete" \
  -H "X-API-Key: $APIPAY_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: catalog-sync-2026-08-26-chunk-01" \
  -d '{"external_refs": ["SKU-OLD-1", "SKU-OLD-2"], "expected_count": 2}'

# Step 4: the outcome, meaning what is left in the queue and what failed.
curl "https://api.apipay.kz/api/v1/catalog/queue" -H "X-API-Key: $APIPAY_API_KEY"
curl "https://api.apipay.kz/api/v1/catalog/errors?from=2026-08-26" -H "X-API-Key: $APIPAY_API_KEY"
```

The integrator builds the removal list itself: there is no "delete everything that was missing from my upload" mode.
The key must be issued by the **owner** of the organization, otherwise you get `403 catalog_delete_owner_key_required`.
A `202` response means "accepted for processing", not "deleted": removal runs in the background and on a large catalog
takes a little over a day. The operation has no single handle, so check the outcome in `GET /catalog/queue`,
`GET /catalog/errors` and with a targeted `GET /catalog?external_refs[]=`; the result for each individual item arrives
in the `catalog.item_processed` webhook.
Details and failure codes are in [Catalog → Bulk Deletion](../catalog.md#bulk-deletion).

## More Examples

A complete script covering every operation (invoices, refunds, catalog, subscriptions) is in [`examples/curl/`](https://github.com/bazarbaykz/apipay-docs/tree/main/examples/curl).
