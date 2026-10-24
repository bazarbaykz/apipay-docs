#!/usr/bin/env python3
"""
ApiPay.kz - Webhook Handler Example

This example demonstrates how to:
1. Receive webhook notifications
2. Verify the signature
3. Discard sandbox events unless APIPAY_SANDBOX_MODE=true (production mode is the default)
4. Deduplicate repeated deliveries by an event key
5. Handle payment events (invoices, refunds, refund links, receipts and subscriptions)

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
import json
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


# Processed events. Delivery is not guaranteed, and the same event may arrive more than once;
# one invoice legitimately gets several different events — so the key is built from a
# pair of values, not from the invoice id alone.
#
# This in-memory set is reset on restart and is not shared between processes: it is fine
# for a sandbox test only. In production use a database table with a UNIQUE event key:
#   claim:   INSERT ... ON CONFLICT DO NOTHING — a row was inserted, so the event is new
#   release: DELETE ... WHERE event_key = ?
processed_events = set()


def claim_event(key: str) -> bool:
    if key in processed_events:
        return False
    processed_events.add(key)
    return True


def release_event(key: str) -> None:
    processed_events.discard(key)


def event_key(e: dict):
    """Deduplication key of an event. None — nothing to do (webhook.test, unknown events)."""
    name = e.get('event') or ''
    if name == 'invoice.status_changed':
        return f"invoice:{e['invoice']['id']}:{e['invoice']['status']}"
    if name == 'invoice.qr_scanned':
        return f"qr_scanned:{e['invoice']['id']}"
    if name == 'invoice.refunded':
        return f"refund:{e['refund']['id']}:{e['refund']['status']}"
    if name.startswith('qr_refund.'):
        return f"{name}:{e['qr_refund']['id']}"
    if name.startswith('receipt.'):
        return f"{name}:{e['receipt']['id']}"
    if name.startswith('cashbox.'):
        return f"{name}:{e['operation']['id']}"
    # period_skipped has no invoice_id: the skipped period may have no invoice at all
    if name == 'subscription.period_skipped':
        return f"{name}:{e['subscription']['id']}:{e.get('billing_period_start')}"
    # invoice_id is present only in payment_succeeded, payment_failed and in cancelled
    # with reason payer_refused / payer_error; for other subscription events it is empty
    if name.startswith('subscription.'):
        invoice_id = e.get('invoice_id')
        return f"{name}:{e['subscription']['id']}:{'' if invoice_id is None else invoice_id}"
    return None


def handle_invoice_status_changed(invoice: dict):
    """Handle invoice status change event."""
    print(f"\nInvoice #{invoice['id']} status changed to: {invoice['status']}")

    status = invoice['status']

    # `pending` after `error`, and `error` after such a `pending`, are new transitions, not
    # duplicates: the chain error -> pending -> ... -> error is possible. Release the opposite
    # key so the deduplication does not swallow the next transition.
    if status == 'error':
        release_event(f"invoice:{invoice['id']}:pending")
    if status == 'pending':
        release_event(f"invoice:{invoice['id']}:error")

    if status == 'paid':
        print('  Payment received!')
        print(f"  Amount: {invoice.get('amount')} KZT")
        print(f"  Client: {invoice.get('client_name')}")
        if invoice.get('external_order_id'):
            print(f"  Order ID: {invoice['external_order_id']}")
            # TODO: fulfill the order (idempotently, in the background).
            # A repeated delivery is already filtered by the (invoice.id, status) key in
            # webhook(). Another invoice.id of the same order with status paid is the
            # buyer's second payment, not a duplicate: refund it or hand it to a person.

    elif status == 'cancelled':
        print('  Invoice was cancelled')

    elif status == 'expired':
        print('  Invoice expired')

    # cancelled, expired and error are not final: paid (or pending after error) may follow.
    # Do not close the order for good on them.


def handle_invoice_refunded(refund: dict, invoice: dict):
    """Handle invoice refunded event — fires for both successful and failed refunds."""
    if refund.get('status') != 'completed':
        print(f"\nRefund #{refund['id']} for invoice #{invoice['id']} FAILED: {refund.get('error_code')}")
        print('  Money was NOT returned. Do not mark the order as refunded.')
        # refund_requires_buyer_confirmation / refund_rejected_by_kaspi: issue a refund link
        # to the buyer — POST /qr-refunds/links with invoice_id and source_refund_id of this refund
        return

    print(f"\nRefund #{refund['id']} for invoice #{invoice['id']} completed")
    print(f"  Status: {invoice.get('status')}")
    print(f"  Total refunded: {invoice.get('total_refunded')} KZT")
    # A refund.id you never created (for example, after qr_refund.completed of a refund link)
    # may be the same money recorded again, not a second refund. Check it in
    # GET /invoices/{id}/refunds: if some refund there has successor_refund_id equal to this
    # refund.id, count the money once.


def handle_qr_refund_event(event_type: str, qr_refund: dict):
    """Handle refund link events (qr_refund.*)."""
    print(f"\nRefund link #{qr_refund['id']} — {event_type}")
    if event_type == 'qr_refund.completed':
        print('  Money returned to the buyer')
    elif event_type in ('qr_refund.failed', 'qr_refund.expired'):
        # Money did not move. A new link is needed if the refund is still due
        print(f"  Not refunded: {qr_refund.get('error_code') or 'see GET /qr-refunds/{id}'}")
    elif event_type == 'qr_refund.execution_uncertain':
        # The outcome is not proven, money may have left. Do not repeat the refund
        print('  Outcome unknown — do not repeat the refund')


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

    else:
        print(f"  Subscription status: {sub.get('status')}")


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
        event = json.loads(payload)
        event_type = event['event']
    except Exception as e:
        print(f'Error parsing webhook: {e}')
        abort(400)

    print(f"\nReceived event: {event_type} (source: {event.get('source')})")
    print(f"Timestamp: {event.get('timestamp')}")

    # In production mode, discard events about sandbox objects: reply 200 and do not
    # act on them. An event sent before the organization switched to production may
    # arrive after the switch. The signature is verified above, so the dashboard's
    # `webhook.test` (always is_sandbox: true) still gets its 200 only with a valid secret.
    if not SANDBOX_MODE and event.get('is_sandbox') is True:
        print(f"Discarded sandbox event: {event_type} (set APIPAY_SANDBOX_MODE=true while testing in the sandbox)")
        return 'OK', 200

    key = event_key(event)
    if key is None:
        # webhook.test and unknown events: nothing to do
        print(f"No action for event: {event_type}")
        return 'OK', 200

    # The key is claimed BEFORE processing: a repeated delivery of the same event is
    # answered with 200 and is not processed twice
    if not claim_event(key):
        print(f"Duplicate delivery skipped: {key}")
        return 'OK', 200

    try:
        if event_type == 'invoice.status_changed':
            handle_invoice_status_changed(event['invoice'])

        elif event_type == 'invoice.refunded':
            handle_invoice_refunded(event['refund'], event['invoice'])

        elif event_type == 'invoice.qr_scanned':
            # The buyer opened the invoice; this is not a payment yet
            print(f"\nInvoice #{event['invoice']['id']} scanned — waiting for payment")

        elif event_type.startswith('qr_refund.'):
            handle_qr_refund_event(event_type, event['qr_refund'])

        elif event_type.startswith('receipt.'):
            # A receipt event may also arrive twice: it is deduplicated by (event, receipt.id)
            print(f"\nReceipt #{event['receipt']['id']} — {event['receipt'].get('status')}")

        elif event_type.startswith('subscription.'):
            handle_subscription_event(event_type, event)

        return 'OK', 200

    except Exception as e:
        # Release the key: ApiPay retries the delivery and the event is processed again
        release_event(key)
        print(f'Error processing {event_type}: {e}')
        return 'Processing failed', 500


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
