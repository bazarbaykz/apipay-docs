<?php
/**
 * ApiPay.kz - Create Invoice Example
 *
 * This example demonstrates how to create a payment invoice.
 *
 * Usage: API_KEY=your_key php create-invoice.php
 */

$API_KEY = getenv('API_KEY');
$API_BASE_URL = 'https://api.apipay.kz/api/v1';

/**
 * Create a payment invoice
 */
function createInvoice($amount, $phoneNumber, $description = null, $externalOrderId = null) {
    global $API_KEY, $API_BASE_URL;

    $ch = curl_init("{$API_BASE_URL}/invoices");
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => [
            "X-API-Key: {$API_KEY}",
            'Content-Type: application/json'
        ],
        CURLOPT_POSTFIELDS => json_encode([
            'amount' => $amount,
            'phone_number' => $phoneNumber,
            'description' => $description,
            'external_order_id' => $externalOrderId,
            // Idempotency key (unique per organization): a repeat with the same value
            // returns 409 duplicate_idempotency_key instead of a second invoice.
            'external_order_id_idempotency' => $externalOrderId
        ]),
        CURLOPT_RETURNTRANSFER => true
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $data = json_decode($response, true);

    if ($httpCode >= 400) {
        throw new Exception("API Error: " . ($data['message'] ?? 'Unknown error'));
    }

    return $data;
}

// Main
if (!$API_KEY) {
    echo "Error: API_KEY environment variable is required\n";
    echo "Usage: API_KEY=your_key php create-invoice.php\n";
    exit(1);
}

try {
    echo "Creating invoice...\n";

    $invoice = createInvoice(
        10000,              // amount in KZT
        '87001234567',      // customer phone
        'Test payment',     // description
        'order_123'         // your order ID
    );

    echo "\nInvoice created successfully!\n";
    echo "----------------------------\n";
    echo "Invoice ID: {$invoice['id']}\n";
    echo "Amount: {$invoice['amount']} KZT\n";
    echo "Status: {$invoice['status']}\n";
    echo "Phone: {$invoice['phone']}\n";
    echo "\nStatus \"processing\" means the invoice has not reached Kaspi yet.\n";
    echo "The final status (pending or error) arrives via the invoice.status_changed\n";
    echo "webhook, or poll GET /invoices/{id}. Do not re-create the invoice meanwhile.\n";

} catch (Exception $e) {
    echo "Error: {$e->getMessage()}\n";
    exit(1);
}
