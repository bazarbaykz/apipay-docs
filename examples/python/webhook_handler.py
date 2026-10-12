#!/usr/bin/env python3
"""
ApiPay.kz - Webhook Handler Example

This example demonstrates how to:
1. Receive webhook notifications
2. Verify the signature
3. Discard sandbox events unless APIPAY_SANDBOX_MODE=true (production mode is the default)
4. Handle payment events (invoices and subscriptions)

Without APIPAY_SANDBOX_MODE=true the handler assumes production mode and discards sandbox
events (it still answers 200). Set it to exactly true while you test in the sandbox; remove
it once the organization works in production mode.

Usage while you test in the sandbox:
    APIPAY_SANDBOX_MODE=true WEBHOOK_SECRET=your_secret python webhook_handler.py

Usage in production mode:
    WEBHOOK_SECRET=your_secret python webhook_handler.py

Requirements:
    pip install flask
"""

import hashlib
import hmac
import os
import sys

from flask import Flask, request, abort

app = Flask(__name__)

WEBHOOK_SECRET = os.environ.get('WEBHOOK_SECRET')
# Set APIPAY_SANDBOX_MODE=true while you test in the ApiPay sandbox; leave it unset in
# production mode. Your system knows its own mode: the root `is_sandbox` of an event
# describes the event's object, not the organization's current mode.
SANDBOX_MODE = os.environ.get('APIPAY_SANDBOX_MODE') == 'true'


def verify_signature(payload: bytes, signature: str, secret: str) -> bool:
    """Verify webhook signature using HMAC-SHA256."""
    expected = 'sha256=' + hmac.new(
        secret.encode(),
        payload,
        hashlib.sha256
    ).hexdigest()

    return hmac.compare_digest(expected, signature)


def handle_invoice_status_changed(invoice: dict):
    """Handle invoice status change event."""
    print(f"\nInvoice #{invoice['id']} status changed to: {invoice['status']}")

    status = invoice['status']

    if status == 'paid':
        print('  Payment received!')
        print(f"  Amount: {invoice.get('amount')} KZT")
        print(f"  Client: {invoice.get('client_name')}")
        if invoice.get('external_order_id'):
            print(f"  Order ID: {invoice['external_order_id']}")
            # TODO: fulfill the order — deduplicate first!
            # Delivery is at-least-once: the same (invoice.id, invoice.status) pair
            # can arrive more than once. Skip the event if you already processed it.

    elif status == 'cancelled':
        print('  Invoice was cancelled')

    elif status == 'expired':
        print('  Invoice expired')


def handle_invoice_refunded(refund: dict, invoice: dict):
    """Handle invoice refunded event — fires for both successful and failed refunds."""
    if refund.get('status') != 'completed':
        print(f"\nRefund #{refund['id']} for invoice #{invoice['id']} FAILED: {refund.get('error_code')}")
        print('  Money was NOT returned. Do not mark the order as refunded.')
        return

    print(f"\nInvoice #{invoice['id']} refunded")
    print(f"  Status: {invoice.get('status')}")
    print(f"  Total refunded: {invoice.get('total_refunded')} KZT")


def handle_subscription_event(event_type: str, data: dict):
    """Handle subscription events."""
    sub = data['subscription']
    print(f"\nSubscription #{sub['id']} — {event_type}")

    if event_type == 'subscription.payment_succeeded':
        print(f"  Payment succeeded! Invoice #{data['invoice_id']}: {data['amount']} KZT")
        print(f"  Paid at: {data.get('paid_at')}")

    elif event_type == 'subscription.payment_failed':
        print(f"  Payment failed: {data.get('reason')}")

    elif event_type == 'subscription.grace_period_started':
        print(f"  Grace period: {data.get('grace_period_days')} days, expires at {data.get('expires_at')}")

    elif event_type == 'subscription.expired':
        print('  Subscription expired')


@app.route('/webhook', methods=['POST'])
def webhook():
    """Handle incoming webhook requests."""
    payload = request.get_data()
    signature = request.headers.get('X-Webhook-Signature', '')

    if not signature:
        abort(401)

    if not verify_signature(payload, signature, WEBHOOK_SECRET):
        abort(401)

    try:
        event = request.get_json()
        event_type = event['event']
        print(f"\nReceived event: {event_type} (source: {event.get('source')})")
        print(f"Timestamp: {event.get('timestamp')}")

        # In production mode, discard events about sandbox objects: reply 200 and do not
        # act on them. An event sent before the organization switched to production may
        # arrive after the switch. The signature is verified above, so the dashboard's
        # `webhook.test` (always is_sandbox: true) still gets its 200 only with a valid secret.
        if not SANDBOX_MODE and event.get('is_sandbox') is True:
            print(f"Discarded sandbox event: {event_type} (set APIPAY_SANDBOX_MODE=true while testing in the sandbox)")
            return 'OK', 200

        if event_type == 'invoice.status_changed':
            handle_invoice_status_changed(event['invoice'])

        elif event_type == 'invoice.refunded':
            handle_invoice_refunded(event['refund'], event['invoice'])

        elif event_type.startswith('subscription.'):
            handle_subscription_event(event_type, event)

        else:
            print(f"Unknown event type: {event_type}")

        return 'OK', 200

    except Exception as e:
        print(f'Error parsing webhook: {e}')
        abort(400)


def main():
    if not WEBHOOK_SECRET:
        print('Error: WEBHOOK_SECRET environment variable is required')
        print('Usage: WEBHOOK_SECRET=your_secret python webhook_handler.py')
        sys.exit(1)

    port = int(os.environ.get('PORT', 5000))
    print(f'Webhook server listening on port {port}')
    print(f'Endpoint: POST http://localhost:{port}/webhook')
    if SANDBOX_MODE:
        print('Mode: sandbox — sandbox events are processed. Remove APIPAY_SANDBOX_MODE once the organization works in production mode')
    else:
        print('Mode: production — sandbox events are discarded. Set APIPAY_SANDBOX_MODE=true while testing in the sandbox')
    print('\nWaiting for webhook events...')

    app.run(host='0.0.0.0', port=port)


if __name__ == '__main__':
    main()
