<?php
/**
 * ApiPay.kz - Webhook Handler Example
 *
 * This example demonstrates how to:
 * 1. Receive webhook notifications
 * 2. Verify the signature
 * 3. Handle payment events
 *
 * Deploy this script to your server and configure the webhook URL
 * in the ApiPay.kz dashboard.
 *
 * For Laravel, see the Laravel-specific example below.
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
            // Payment received - fulfill the order
            error_log("Payment received! Amount: {$invoice['amount']} KZT");
            if (!empty($invoice['external_order_id'])) {
                // TODO: Fulfill the order
                // fulfillOrder($invoice['external_order_id']);
                error_log("Order ID: {$invoice['external_order_id']}");
            }
            break;

        case 'cancelled':
            // Invoice was cancelled
            error_log("Invoice cancelled at: {$invoice['cancelled_at']}");
            // TODO: Handle cancellation
            break;

        case 'expired':
            // Invoice expired
            error_log("Invoice expired at: {$invoice['expired_at']}");
            // TODO: Handle expiration
            break;

        default:
            error_log("Unknown status: {$status}");
    }
}

// Main handler
$payload = file_get_contents('php://input');
$signature = $_SERVER['HTTP_X_WEBHOOK_SIGNATURE'] ?? '';

// Verify signature
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

// Parse and handle event
$event = json_decode($payload, true);

if (!$event) {
    http_response_code(400);
    echo 'Invalid JSON';
    exit;
}

error_log("Received event: {$event['event']}");

switch ($event['event']) {
    case 'invoice.status_changed':
        handleInvoiceStatusChanged($event['invoice']);
        break;

    default:
        error_log("Unknown event type: {$event['event']}");
}

// Always respond with 200 to acknowledge receipt
http_response_code(200);
echo 'OK';

/*
 * =====================================================
 * LARAVEL EXAMPLE
 * =====================================================
 *
 * Add to routes/api.php:
 *
 * Route::post('/webhook/apipay', [ApipayWebhookController::class, 'handle']);
 *
 * Create app/Http/Controllers/ApipayWebhookController.php:
 *
 * <?php
 *
 * namespace App\Http\Controllers;
 *
 * use Illuminate\Http\Request;
 *
 * class ApipayWebhookController extends Controller
 * {
 *     public function handle(Request $request)
 *     {
 *         $payload = $request->getContent();
 *         $signature = $request->header('X-Webhook-Signature');
 *
 *         if (!$this->verifySignature($payload, $signature)) {
 *             abort(401, 'Invalid signature');
 *         }
 *
 *         $event = $request->all();
 *
 *         if ($event['event'] === 'invoice.status_changed') {
 *             $this->handleInvoiceStatusChanged($event['invoice']);
 *         }
 *
 *         return response('OK', 200);
 *     }
 *
 *     private function verifySignature($payload, $signature)
 *     {
 *         $secret = config('services.apipay.webhook_secret');
 *         $expected = 'sha256=' . hash_hmac('sha256', $payload, $secret);
 *         return hash_equals($expected, $signature);
 *     }
 *
 *     private function handleInvoiceStatusChanged($invoice)
 *     {
 *         if ($invoice['status'] === 'paid') {
 *             // Find and fulfill the order
 *             $order = Order::where('external_id', $invoice['external_order_id'])->first();
 *             if ($order) {
 *                 $order->markAsPaid($invoice['paid_at']);
 *             }
 *         }
 *     }
 * }
 *
 * Don't forget to add webhook_secret to config/services.php:
 *
 * 'apipay' => [
 *     'webhook_secret' => env('APIPAY_WEBHOOK_SECRET'),
 * ],
 */
