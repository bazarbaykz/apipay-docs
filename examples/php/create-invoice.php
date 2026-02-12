<?php
/**
 * ApiPay.kz - Create Invoice Example
 *
 * This example demonstrates how to create a payment invoice.
 *
 * Usage: API_KEY=your_key php create-invoice.php
 */

$API_KEY = getenv('API_KEY');
$API_BASE_URL = 'https://bpapi.bazarbay.site/api/v1';

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
            'external_order_id' => $externalOrderId
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
    echo "Phone: {$invoice['phone_number']}\n";
    echo "\nThe customer will receive a payment notification in the Kaspi app.\n";

} catch (Exception $e) {
    echo "Error: {$e->getMessage()}\n";
    exit(1);
}
