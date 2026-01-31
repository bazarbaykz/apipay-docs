#!/usr/bin/env python3
"""
ApiPay.kz - Webhook Handler Example

This example demonstrates how to:
1. Receive webhook notifications
2. Verify the signature
3. Handle payment events

Usage:
    WEBHOOK_SECRET=your_secret python webhook_handler.py

Test with:
    curl -X POST http://localhost:5000/webhook \
      -H "Content-Type: application/json" \
      -H "X-Webhook-Signature: sha256=..." \
      -d '{"event":"invoice.status_changed","invoice":{"id":42,"status":"paid"}}'

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
        print(f"  Paid at: {invoice.get('paid_at')}")
        if invoice.get('external_order_id'):
            print(f"  Order ID: {invoice['external_order_id']}")
            # TODO: Fulfill the order
            # fulfill_order(invoice['external_order_id'])

    elif status == 'cancelled':
        print('  Invoice was cancelled')
        print(f"  Cancelled at: {invoice.get('cancelled_at')}")
        # TODO: Handle cancellation

    elif status == 'expired':
        print('  Invoice expired')
        print(f"  Expired at: {invoice.get('expired_at')}")
        # TODO: Handle expiration

    else:
        print(f'  Unknown status: {status}')


@app.route('/webhook', methods=['POST'])
def webhook():
    """Handle incoming webhook requests."""
    payload = request.get_data()
    signature = request.headers.get('X-Webhook-Signature', '')

    if not signature:
        print('Missing signature header')
        abort(401)

    if not verify_signature(payload, signature, WEBHOOK_SECRET):
        print('Invalid signature')
        abort(401)

    try:
        event = request.get_json()
        print(f"\nReceived event: {event['event']}")
        print(f"Timestamp: {event.get('timestamp')}")

        if event['event'] == 'invoice.status_changed':
            handle_invoice_status_changed(event['invoice'])
        else:
            print(f"Unknown event type: {event['event']}")

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
