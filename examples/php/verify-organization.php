<?php
/**
 * ApiPay.kz - Organization Verification Example
 *
 * This example demonstrates the complete organization verification flow:
 * 1. Start verification with IIN/BIN
 * 2. Poll for status until verified or timeout
 *
 * Prerequisites:
 * - Add phone 77056610934 to Kaspi Business as "Cashier"
 *
 * Usage: API_KEY=your_key IDN=123456789012 php verify-organization.php
 */

$API_KEY = getenv('API_KEY');
$IDN = getenv('IDN');
$API_BASE_URL = 'https://bpapi.bazarbay.site/api';

$POLL_INTERVAL = 2;  // seconds
$MAX_TIMEOUT = 120;  // seconds

/**
 * Start organization verification
 */
function startVerification($idn) {
    global $API_KEY, $API_BASE_URL;

    $ch = curl_init("{$API_BASE_URL}/organizations/verify");
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => [
            "X-API-Key: {$API_KEY}",
            'Content-Type: application/json'
        ],
        CURLOPT_POSTFIELDS => json_encode(['idn' => $idn]),
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

/**
 * Check verification status
 */
function checkStatus($organizationId) {
    global $API_KEY, $API_BASE_URL;

    $ch = curl_init("{$API_BASE_URL}/organizations/{$organizationId}/status");
    curl_setopt_array($ch, [
        CURLOPT_HTTPHEADER => ["X-API-Key: {$API_KEY}"],
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

/**
 * Poll for verification status until verified or timeout
 */
function waitForVerification($organizationId) {
    global $POLL_INTERVAL, $MAX_TIMEOUT;

    $startTime = time();

    while (time() - $startTime < $MAX_TIMEOUT) {
        $data = checkStatus($organizationId);
        $organization = $data['organization'];
        $status = $organization['status'];
        $timeRemaining = $organization['time_remaining'] ?? 0;

        echo "Status: {$status}, Time remaining: {$timeRemaining}s\n";

        if ($status === 'verified') {
            return $organization;
        }

        if ($status === 'failed') {
            throw new Exception('Verification failed');
        }

        sleep($POLL_INTERVAL);
    }

    throw new Exception('Verification timeout');
}

// Main
if (!$API_KEY || !$IDN) {
    echo "Error: API_KEY and IDN environment variables are required\n";
    echo "Usage: API_KEY=your_key IDN=123456789012 php verify-organization.php\n";
    exit(1);
}

try {
    echo "Starting organization verification...\n";
    echo "IIN/BIN: {$IDN}\n\n";
    echo "Please confirm in Kaspi Business app within 2 minutes.\n";
    echo "---\n";

    $result = startVerification($IDN);
    $organizationId = $result['organization']['id'];

    echo "Organization ID: {$organizationId}\n";
    echo "Waiting for confirmation...\n\n";

    $organization = waitForVerification($organizationId);

    echo "\nVerification successful!\n";
    echo "------------------------\n";
    echo "Organization ID: {$organization['id']}\n";
    echo "IIN/BIN: {$organization['idn']}\n";
    echo "Status: {$organization['status']}\n";
    echo "\nYou can now create invoices!\n";

} catch (Exception $e) {
    echo "\nError: {$e->getMessage()}\n";
    exit(1);
}
