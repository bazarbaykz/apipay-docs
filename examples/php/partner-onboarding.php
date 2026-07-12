<?php
/**
 * ApiPay.kz - Partner API: Merchant Onboarding Example
 *
 * Onboards a merchant end-to-end: create the organization, authorize the
 * Kaspi cashier (SMS-based), and issue the merchant's API key.
 *
 * The flow has two phases because the cashier receives an SMS code:
 *   1. First run  — creates the org and sends the SMS:
 *        PARTNER_KEY=pk_... CASHIER_PHONE=77001234567 php partner-onboarding.php
 *   2. Second run — finishes once the merchant gives you the code:
 *        PARTNER_KEY=pk_... ORG_ID=50 OTP=1234 php partner-onboarding.php
 */

$PARTNER_KEY = getenv('PARTNER_KEY');
$BASE_URL = 'https://api.apipay.kz';

/**
 * Send a Partner API request
 */
function api($method, $path, $body = null) {
    global $PARTNER_KEY, $BASE_URL;

    $ch = curl_init("{$BASE_URL}{$path}");
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_HTTPHEADER => [
            "X-Partner-Key: {$PARTNER_KEY}",
            'Content-Type: application/json'
        ],
        CURLOPT_POSTFIELDS => $body !== null ? json_encode($body) : null,
        CURLOPT_RETURNTRANSFER => true
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $data = json_decode($response, true);

    if ($httpCode >= 400 || (isset($data['success']) && $data['success'] === false)) {
        $reason = $data['error'] ?? $data['message'] ?? 'Unknown error';
        throw new Exception("API Error ({$httpCode}): {$reason}");
    }

    return $data;
}

/**
 * Phase 1: create the organization and start cashier authorization
 */
function startOnboarding($cashierPhone, $externalId) {
    echo "1. Creating merchant organization...\n";
    $organization = api('POST', '/api/partner/organizations', [
        'external_id' => $externalId
    ])['organization'];
    echo "   organization id: {$organization['id']}\n";

    echo "2. Starting Kaspi cashier authorization...\n";
    api('POST', "/api/partner/organizations/{$organization['id']}/kaspi-auth/init");

    echo "3. Sending the cashier phone — Kaspi will text an SMS code...\n";
    api('POST', "/api/partner/organizations/{$organization['id']}/kaspi-auth/send-phone", [
        'cashier_phone' => $cashierPhone
    ]);

    echo "\nSMS sent. Ask the merchant for the code, then run again:\n";
    echo "  PARTNER_KEY=... ORG_ID={$organization['id']} OTP=<code> php partner-onboarding.php\n";
}

/**
 * Phase 2: confirm the SMS code and issue the merchant's API key
 */
function finishOnboarding($orgId, $otp, $webhookUrl) {
    echo "4. Verifying the SMS code...\n";
    $verified = api('POST', "/api/partner/organizations/{$orgId}/kaspi-auth/verify-otp", [
        'otp' => $otp
    ]);
    echo "   cashier connected, organization status: {$verified['organization']['status']}\n";

    echo "5. Issuing the merchant API key...\n";
    $key = api('POST', "/api/partner/organizations/{$orgId}/api-key", [
        'name' => 'CRM key',
        'webhook_url' => $webhookUrl
    ]);

    echo "\nOnboarding complete!\n";
    echo "--------------------\n";
    echo "X-API-Key:      {$key['key']}\n";
    echo "Webhook secret: {$key['webhook_secret']}\n";
    echo "\nStore the key securely — it is shown only once.\n";
    echo "Use it as X-API-Key for the regular API to create invoices for this merchant.\n";
}

// Main
if (!$PARTNER_KEY) {
    echo "Error: PARTNER_KEY environment variable is required\n";
    exit(1);
}

try {
    if (getenv('OTP') && getenv('ORG_ID')) {
        finishOnboarding(
            getenv('ORG_ID'),
            getenv('OTP'),
            'https://your-crm.example.com/webhooks/kaspi'
        );
    } else {
        startOnboarding(
            getenv('CASHIER_PHONE') ?: '77001234567',
            'crm-client-42'
        );
    }
} catch (Exception $e) {
    echo "Error: {$e->getMessage()}\n";
    exit(1);
}
