<?php
/**
 * ApiPay.kz - Webhook Handler Example
 *
 * This example demonstrates how to:
 * 1. Receive webhook notifications
 * 2. Verify the signature
 * 3. Handle payment events (invoices and subscriptions)
 *
 * Deploy this script to your server and configure the webhook URL
 * in the ApiPay.kz dashboard.
 */

// Configuration
$WEBHOOK_SECRET = getenv('WEBHOOK_SECRET') ?: 'your_webhook_secret_here';

/**
 * Verify webhook signature using HMAC-SHA256
 */
function verifySignature($payload, $signature, $secret) {
    $expected = 'sha256=' . hash_hmac('sha256', $payload, $secret);
    return hash_equals($expected, $signature);
}

/**
 * Handle invoice status change event
 */
function handleInvoiceStatusChanged($invoice) {
    $invoiceId = $invoice['id'];
    $status = $invoice['status'];

    error_log("Invoice #{$invoiceId} status changed to: {$status}");

    switch ($status) {
        case 'paid':
            error_log("Payment received! Amount: {$invoice['amount']} KZT");
            if (!empty($invoice['external_order_id'])) {
                error_log("Order ID: {$invoice['external_order_id']}");
                // TODO: Fulfill the order
            }
            break;

        case 'cancelled':
            error_log("Invoice cancelled");
            break;

        case 'expired':
            error_log("Invoice expired");
            break;
    }
}

/**
 * Handle invoice refunded event
 */
function handleInvoiceRefunded($invoice) {
    error_log("Invoice #{$invoice['id']} refunded — status: {$invoice['status']}, total refunded: {$invoice['total_refunded']}");
}

/**
 * Handle subscription events
 */
function handleSubscriptionEvent($eventType, $data) {
    $sub = $data['subscription'];
    error_log("Subscription #{$sub['id']} — {$eventType}");

    switch ($eventType) {
        case 'subscription.payment_succeeded':
            $inv = $data['invoice'];
            error_log("Payment succeeded! Invoice #{$inv['id']}: {$inv['amount']} KZT");
            break;

        case 'subscription.payment_failed':
            error_log("Payment failed: " . ($data['reason'] ?? 'Unknown'));
            break;

        case 'subscription.grace_period_started':
            error_log("Grace period: {$sub['grace_period_days']} days, {$sub['retry_attempts_remaining']} retries left");
            break;

        case 'subscription.expired':
            error_log("Subscription expired");
            break;
    }
}

// Main handler
$payload = file_get_contents('php://input');
$signature = $_SERVER['HTTP_X_WEBHOOK_SIGNATURE'] ?? '';

if (empty($signature)) {
    http_response_code(401);
    echo 'Missing signature';
    exit;
}

if (!verifySignature($payload, $signature, $WEBHOOK_SECRET)) {
    http_response_code(401);
    echo 'Invalid signature';
    exit;
}

$event = json_decode($payload, true);

if (!$event) {
    http_response_code(400);
    echo 'Invalid JSON';
    exit;
}

$eventType = $event['event'];
error_log("Received event: {$eventType} (source: " . ($event['source'] ?? 'unknown') . ")");

switch ($eventType) {
    case 'invoice.status_changed':
        handleInvoiceStatusChanged($event['invoice']);
        break;

    case 'invoice.refunded':
        handleInvoiceRefunded($event['invoice']);
        break;

    case 'subscription.payment_succeeded':
    case 'subscription.payment_failed':
    case 'subscription.grace_period_started':
    case 'subscription.expired':
        handleSubscriptionEvent($eventType, $event['data']);
        break;

    default:
        error_log("Unknown event type: {$eventType}");
}

http_response_code(200);
echo 'OK';
