<?php
/**
 * ApiPay.kz - Create Subscription Example
 *
 * This example demonstrates how to create a recurring subscription.
 *
 * Usage: API_KEY=your_key php create-subscription.php
 */

$API_KEY = getenv('API_KEY');
$API_BASE_URL = 'https://bpapi.bazarbay.site/api/v1';

function createSubscription($data) {
    global $API_KEY, $API_BASE_URL;

    $ch = curl_init("{$API_BASE_URL}/subscriptions");
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => [
            "X-API-Key: {$API_KEY}",
            'Content-Type: application/json'
        ],
        CURLOPT_POSTFIELDS => json_encode($data),
        CURLOPT_RETURNTRANSFER => true
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $result = json_decode($response, true);

    if ($httpCode >= 400) {
        throw new Exception("API Error: " . ($result['message'] ?? 'Unknown error'));
    }

    return $result;
}

if (!$API_KEY) {
    echo "Error: API_KEY environment variable is required\n";
    echo "Usage: API_KEY=your_key php create-subscription.php\n";
    exit(1);
}

try {
    echo "Creating subscription...\n";

    $subscription = createSubscription([
        'amount' => 5000,
        'phone_number' => '87001234567',
        'billing_period' => 'monthly',
        'billing_day' => 1,
        'subscriber_name' => 'John Doe',
        'description' => 'Monthly subscription'
    ]);

    echo "\nSubscription created successfully!\n";
    echo "----------------------------------\n";
    echo "Subscription ID: {$subscription['id']}\n";
    echo "Amount: {$subscription['amount']} KZT\n";
    echo "Period: {$subscription['billing_period']}\n";
    echo "Status: {$subscription['status']}\n";
    echo "Next billing: {$subscription['next_billing_date']}\n";

} catch (Exception $e) {
    echo "Error: {$e->getMessage()}\n";
    exit(1);
}
