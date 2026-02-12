#!/usr/bin/env python3
"""
ApiPay.kz - Webhook Handler Example

This example demonstrates how to:
1. Receive webhook notifications
2. Verify the signature
3. Handle payment events (invoices and subscriptions)

Usage:
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
            # TODO: Fulfill the order

    elif status == 'cancelled':
        print('  Invoice was cancelled')

    elif status == 'expired':
        print('  Invoice expired')


def handle_invoice_refunded(invoice: dict):
    """Handle invoice refunded event."""
    print(f"\nInvoice #{invoice['id']} refunded")
    print(f"  Status: {invoice.get('status')}")
    print(f"  Total refunded: {invoice.get('total_refunded')} KZT")


def handle_subscription_event(event_type: str, data: dict):
    """Handle subscription events."""
    sub = data['subscription']
    print(f"\nSubscription #{sub['id']} — {event_type}")

    if event_type == 'subscription.payment_succeeded':
        inv = data['invoice']
        print(f"  Payment succeeded! Invoice #{inv['id']}: {inv['amount']} KZT")

    elif event_type == 'subscription.payment_failed':
        print(f"  Payment failed: {data.get('reason')}")

    elif event_type == 'subscription.grace_period_started':
        print(f"  Grace period: {sub.get('grace_period_days')} days, {sub.get('retry_attempts_remaining')} retries left")

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

        if event_type == 'invoice.status_changed':
            handle_invoice_status_changed(event['invoice'])

        elif event_type == 'invoice.refunded':
            handle_invoice_refunded(event['invoice'])

        elif event_type.startswith('subscription.'):
            handle_subscription_event(event_type, event['data'])

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
    print('\nWaiting for webhook events...')

    app.run(host='0.0.0.0', port=port)


if __name__ == '__main__':
    main()
