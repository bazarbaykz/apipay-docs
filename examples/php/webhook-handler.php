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
$WEBHOOK_SECRET = getenv('WEBHOOK_SECRET');

if ($WEBHOOK_SECRET === false || $WEBHOOK_SECRET === '') {
    error_log('WEBHOOK_SECRET is not set — refusing to process webhooks');
    http_response_code(500);
    echo 'Server misconfigured';
    exit;
}

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
            // The same delivery may arrive more than once: deduplicate by the
            // (invoice.id, status) pair and make fulfilment idempotent — never
            // ship an order or credit a balance twice for the same pair.
            // Answer 200 within 5 seconds: acknowledge first, then do the slow
            // work (fulfilment, e-mail, ERP sync) asynchronously — in a queue
            // job or a background worker, not inside this handler.
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
            error_log("Payment succeeded! Invoice #{$data['invoice_id']}: {$data['amount']} KZT");
            break;

        case 'subscription.payment_failed':
            error_log("Payment failed: " . ($data['reason'] ?? 'Unknown'));
            break;

        case 'subscription.grace_period_started':
            error_log("Grace period: {$data['grace_period_days']} days, ends at {$data['expires_at']}");
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
        // Событие приходит и на успешный, и на неудачный возврат — смотрите refund.status
        if (($event['refund']['status'] ?? null) === 'completed') {
            handleInvoiceRefunded($event['invoice']);
        } else {
            $code = $event['refund']['error_code'] ?? 'unknown';
            error_log("Refund #{$event['refund']['id']} failed: {$code} — деньги клиенту не возвращены");
        }
        break;

    case 'subscription.payment_succeeded':
    case 'subscription.payment_failed':
    case 'subscription.grace_period_started':
    case 'subscription.expired':
        handleSubscriptionEvent($eventType, $event);
        break;

    default:
        error_log("Unknown event type: {$eventType}");
}

http_response_code(200);
echo 'OK';
