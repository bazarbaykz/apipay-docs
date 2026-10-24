<?php
/**
 * ApiPay.kz - Webhook Handler Example
 *
 * This example demonstrates how to:
 * 1. Receive webhook notifications
 * 2. Verify the signature
 * 3. Discard sandbox events unless APIPAY_SANDBOX_MODE=true (production mode is the default)
 * 4. Deduplicate repeated deliveries by an event key
 * 5. Handle payment events (invoices, refunds, refund links, receipts and subscriptions)
 *
 * Without APIPAY_SANDBOX_MODE=true the handler assumes production mode and discards sandbox
 * events (it still answers 200). Set it to exactly true while you test in the sandbox; remove
 * it once the organization works in production mode.
 *
 * Deploy this script to your server and configure the webhook URL
 * in the ApiPay.kz dashboard.
 */

// Configuration
$WEBHOOK_SECRET = getenv('WEBHOOK_SECRET');
// Set APIPAY_SANDBOX_MODE=true while you test in the ApiPay sandbox; leave it unset in
// production mode. Your system knows its own mode: the root `is_sandbox` of an event
// describes the event's object, not the organization's current mode.
$SANDBOX_MODE = getenv('APIPAY_SANDBOX_MODE') === 'true';

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
 * Processed events. Delivery is not guaranteed, and the same event may arrive more than once;
 * one invoice legitimately gets several different events — so the key is built from a
 * pair of values, not from the invoice id alone.
 *
 * PHP serves each request in a fresh process, so the example keeps one marker file per key
 * in the temp directory (creating it with mode 'x' is atomic). This is fine for a sandbox
 * test on one server only. In production use a database table with a UNIQUE event key:
 *   claim:   INSERT ... ON CONFLICT DO NOTHING (MySQL: INSERT IGNORE) — a row was inserted,
 *            so the event is new
 *   release: DELETE ... WHERE event_key = ?
 */
function eventMarkerPath($key) {
    $dir = sys_get_temp_dir() . '/apipay-processed-events';
    if (!is_dir($dir)) {
        @mkdir($dir, 0700, true);
    }
    return $dir . '/' . hash('sha256', $key);
}

function claimEvent($key) {
    $path = eventMarkerPath($key);
    $handle = @fopen($path, 'x');
    if ($handle === false) {
        if (file_exists($path)) {
            return false; // already processed (or being processed)
        }
        // The marker could not be written and there is none: this is a storage failure, not
        // a duplicate. Throw so that ApiPay gets 500 and retries the delivery.
        throw new RuntimeException("Cannot record the event marker for {$key}");
    }
    fclose($handle);
    return true;
}

function releaseEvent($key) {
    @unlink(eventMarkerPath($key));
}

/**
 * Deduplication key of an event. null — nothing to do (webhook.test, unknown events).
 */
function eventKey($e) {
    $name = $e['event'] ?? '';
    if ($name === 'invoice.status_changed') {
        return "invoice:{$e['invoice']['id']}:{$e['invoice']['status']}";
    }
    if ($name === 'invoice.qr_scanned') {
        return "qr_scanned:{$e['invoice']['id']}";
    }
    if ($name === 'invoice.refunded') {
        return "refund:{$e['refund']['id']}:{$e['refund']['status']}";
    }
    if (strpos($name, 'qr_refund.') === 0) {
        return "{$name}:{$e['qr_refund']['id']}";
    }
    if (strpos($name, 'cashbox.') === 0) {
        return "{$name}:{$e['operation']['id']}";
    }
    if (strpos($name, 'receipt.') === 0) {
        return "{$name}:{$e['receipt']['id']}";
    }
    // period_skipped has no invoice_id: the skipped period may have no invoice at all
    if ($name === 'subscription.period_skipped') {
        return "{$name}:{$e['subscription']['id']}:" . ($e['billing_period_start'] ?? '');
    }
    // invoice_id is present only in payment_succeeded, payment_failed and in cancelled
    // with reason payer_refused / payer_error; for other subscription events it is empty
    if (strpos($name, 'subscription.') === 0) {
        return "{$name}:{$e['subscription']['id']}:" . ($e['invoice_id'] ?? '');
    }
    return null;
}

/**
 * Handle invoice status change event
 */
function handleInvoiceStatusChanged($invoice) {
    $invoiceId = $invoice['id'];
    $status = $invoice['status'];

    error_log("Invoice #{$invoiceId} status changed to: {$status}");

    // `pending` after `error`, and `error` after such a `pending`, are new transitions, not
    // duplicates: the chain error -> pending -> ... -> error is possible. Release the opposite
    // key so the deduplication does not swallow the next transition.
    if ($status === 'error') {
        releaseEvent("invoice:{$invoiceId}:pending");
    }
    if ($status === 'pending') {
        releaseEvent("invoice:{$invoiceId}:error");
    }

    switch ($status) {
        case 'paid':
            // A repeated delivery is already filtered by the (invoice.id, status) key
            // below; keep fulfilment idempotent anyway. Another invoice.id of the same
            // order with status paid is the buyer's second payment, not a duplicate:
            // refund it or hand it to a person.
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

        // cancelled, expired and error are not final: paid (or pending after error) may
        // follow. Do not close the order for good on them.
    }
}

/**
 * Handle invoice refunded event
 */
function handleInvoiceRefunded($refund, $invoice) {
    error_log("Refund #{$refund['id']} for invoice #{$invoice['id']} completed — status: {$invoice['status']}, total refunded: {$invoice['total_refunded']}");
    // A refund.id you never created (for example, after qr_refund.completed of a refund link)
    // may be the same money recorded again, not a second refund. Check it in
    // GET /invoices/{id}/refunds: if some refund there has successor_refund_id equal to this
    // refund.id, count the money once.
}

/**
 * Handle refund link events (qr_refund.*)
 */
function handleQrRefundEvent($eventType, $qrRefund) {
    error_log("Refund link #{$qrRefund['id']} — {$eventType}");
    switch ($eventType) {
        case 'qr_refund.completed':
            error_log('Money returned to the buyer');
            break;
        case 'qr_refund.failed':
        case 'qr_refund.expired':
            // Money did not move. A new link is needed if the refund is still due
            error_log('Not refunded: ' . ($qrRefund['error_code'] ?? 'see GET /qr-refunds/{id}'));
            break;
        case 'qr_refund.execution_uncertain':
            // The outcome is not proven, money may have left. Do not repeat the refund
            error_log('Outcome unknown — do not repeat the refund');
            break;
    }
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

        default:
            error_log("Subscription status: " . ($sub['status'] ?? 'unknown'));
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

// In production mode, discard events about sandbox objects: reply 200 and do not
// act on them. An event sent before the organization switched to production may
// arrive after the switch. The signature is verified above, so the dashboard's
// `webhook.test` (always is_sandbox: true) still gets its 200 only with a valid secret.
if (!$SANDBOX_MODE && ($event['is_sandbox'] ?? null) === true) {
    error_log("Discarded sandbox event: {$eventType} (set APIPAY_SANDBOX_MODE=true while testing in the sandbox)");
    http_response_code(200);
    echo 'OK';
    exit;
}

$key = eventKey($event);
if ($key === null) {
    // webhook.test and unknown events: nothing to do
    error_log("No action for event: {$eventType}");
    http_response_code(200);
    echo 'OK';
    exit;
}

$claimed = false;
try {
    // The key is claimed BEFORE processing: a repeated delivery of the same event is answered
    // with 200 and is not processed twice. A failure to claim it throws and ends in 500 below.
    if (!claimEvent($key)) {
        error_log("Duplicate delivery skipped: {$key}");
        http_response_code(200);
        echo 'OK';
        exit;
    }
    $claimed = true;

    switch ($eventType) {
        case 'invoice.status_changed':
            handleInvoiceStatusChanged($event['invoice']);
            break;

        case 'invoice.refunded':
            // The event arrives for both a successful and a failed refund — check refund.status
            if (($event['refund']['status'] ?? null) === 'completed') {
                handleInvoiceRefunded($event['refund'], $event['invoice']);
            } else {
                $code = $event['refund']['error_code'] ?? 'unknown';
                error_log("Refund #{$event['refund']['id']} failed: {$code} — the money was not returned to the buyer");
                // refund_requires_buyer_confirmation / refund_rejected_by_kaspi — issue the buyer a
                // link via POST /qr-refunds/links with invoice_id and this refund's source_refund_id
            }
            break;

        case 'invoice.qr_scanned':
            // The buyer opened the invoice; this is not a payment yet
            error_log("Invoice #{$event['invoice']['id']} scanned — waiting for payment");
            break;

        default:
            if (strpos($eventType, 'qr_refund.') === 0) {
                handleQrRefundEvent($eventType, $event['qr_refund']);
            } elseif (strpos($eventType, 'receipt.') === 0) {
                // A receipt event may also arrive twice: it is deduplicated by (event, receipt.id)
                error_log("Receipt #{$event['receipt']['id']} — " . ($event['receipt']['status'] ?? 'unknown'));
            } elseif (strpos($eventType, 'subscription.') === 0) {
                handleSubscriptionEvent($eventType, $event);
            } else {
                error_log("Unhandled event type: {$eventType}");
            }
    }
} catch (Throwable $e) {
    // Release the key: ApiPay retries the delivery and the event is processed again
    if ($claimed) {
        releaseEvent($key);
    }
    error_log("Error processing {$eventType}: " . $e->getMessage());
    http_response_code(500);
    echo 'Processing failed';
    exit;
}

http_response_code(200);
echo 'OK';
