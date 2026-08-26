# PHP

An example in plain PHP with the cURL extension: no dependencies and no composer.
The key is read from the `APIPAY_API_KEY` environment variable, so do not keep it in
the code and do not commit it to a repository.

## Creating an Invoice

```php
<?php

$apiKey  = getenv('APIPAY_API_KEY');
$baseUrl = 'https://api.apipay.kz/api/v1';

if ($apiKey === false || $apiKey === '') {
    fwrite(STDERR, "The APIPAY_API_KEY environment variable is not set\n");
    exit(1);
}

$payload = [
    'amount'            => 10000,           // amount in tenge
    'phone_number'      => '87001234567',   // customer phone, format 8XXXXXXXXXX
    'description'       => 'Payment for order #123',
    'external_order_id' => 'order_123',     // your own order ID for matching
];

$ch = curl_init($baseUrl . '/invoices');
curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_HTTPHEADER     => [
        'X-API-Key: ' . $apiKey,
        'Content-Type: application/json',
        'Accept: application/json',
    ],
    CURLOPT_POSTFIELDS     => json_encode($payload, JSON_UNESCAPED_UNICODE),
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 30,
]);

$response  = curl_exec($ch);
$httpCode  = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

if ($response === false) {
    fwrite(STDERR, "The request failed to send: {$curlError}\n");
    exit(1);
}

$invoice = json_decode($response, true);
if (!is_array($invoice)) {
    $invoice = [];
}

if ($httpCode >= 400) {
    // The stable snake_case code lives in error_code, and in some responses in error.
    // A 422 from the field validator carries no error_code at all: there you only get
    // message and an errors object broken down by field, hence the fallback.
    $code = $invoice['error_code'] ?? $invoice['error'] ?? 'error';

    fwrite(STDERR, "HTTP {$httpCode}, code: {$code}\n");
    fwrite(STDERR, ($invoice['message'] ?? 'Unknown error') . "\n");

    foreach ($invoice['errors'] ?? [] as $field => $messages) {
        fwrite(STDERR, "  {$field}: " . implode('; ', (array) $messages) . "\n");
    }

    exit(1);
}

echo "Invoice #{$invoice['id']} created, status: {$invoice['status']}\n";
```

Running it:

```bash
APIPAY_API_KEY=your_api_key php create-invoice.php
```

## Branching on the Error

Branch your logic on the code, not on the text of `message`: the text can change.

```php
switch ($code) {
    case 'client_not_found':
        // The number is not registered in Kaspi. Ask for another one; retrying will not help.
        break;
    case 'kaspi_session_invalid':
    case 'kaspi_session_not_configured':
        // The Kaspi cashier is not connected or the session was reset.
        // Reconnect it in the dashboard.
        break;
    case 'kaspi_throttled':
    case 'network_unavailable':
        // A temporary cause. Create a new invoice in a couple of minutes.
        break;
    default:
        // Everything else goes to the log, together with $httpCode and the response body.
}
```

The full list of codes is in [Errors](../errors.md).

## The `processing` Status Is Not a Failure

A successful `POST /invoices` response returns the invoice in the `processing` status:
we have accepted it, but it has not reached Kaspi yet. There is no terminal answer at
this point, so wait for the move to `pending` (the customer has the invoice) or to
`error` (sending failed, and the reason is in `error_code` and `error_message`).

There are two ways to learn about that move: subscribe to the `invoice.status_changed`
webhook (see [Webhooks](../webhooks.md)) or poll `GET /invoices/{id}`. While the invoice
is in `processing`, do not create it again, or you will end up with a second invoice for
the same amount. If a repeat request is possible anyway (a retry after a network
timeout), pass `external_order_id_idempotency`: a repeat call with the same value returns
`409 duplicate_idempotency_key` instead of a second invoice.

## Ready-Made Examples

Complete working scripts live in [`examples/php/`](https://github.com/bazarbaykz/apipay-docs/tree/main/examples/php):

| File | What it shows |
|------|---------------|
| `create-invoice.php` | Creating an invoice |
| `check-client.php` | Checking a customer by phone number |
| `create-subscription.php` | A subscription (recurring charges) |
| `manage-catalog.php` | Working with the product catalog |
| `webhook-handler.php` | Receiving a webhook and verifying its signature |
| `partner-onboarding.php` | Onboarding an organization through the Partner API |
