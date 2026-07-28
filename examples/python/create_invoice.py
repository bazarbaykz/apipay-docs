#!/usr/bin/env python3
"""
ApiPay.kz - Create Invoice Example

This example demonstrates how to create a payment invoice.

Usage: API_KEY=your_key python create_invoice.py
"""

import os
import requests
import sys

API_KEY = os.environ.get('API_KEY')
API_BASE_URL = 'https://api.apipay.kz/api/v1'


def create_invoice(
    amount: int,
    phone_number: str,
    description: str = None,
    external_order_id: str = None,
    external_order_id_idempotency: str = None
) -> dict:
    """Create a payment invoice."""
    response = requests.post(
        f'{API_BASE_URL}/invoices',
        headers={
            'X-API-Key': API_KEY,
            'Content-Type': 'application/json'
        },
        json={
            'amount': amount,
            'phone_number': phone_number,
            'description': description,
            'external_order_id': external_order_id,
            # Idempotency key (up to 191 chars, unique within your organization).
            # A repeat request with the same value does not create a duplicate:
            # the API answers 409 with error `duplicate_idempotency_key` and returns
            # invoice_id / status of the existing invoice. Re-issuing with the same key
            # is possible only once the previous invoice is expired, cancelled or error.
            'external_order_id_idempotency': external_order_id_idempotency
        }
    )

    if not response.ok:
        error = response.json()
        raise Exception(f"API Error: {error.get('message', 'Unknown error')}")

    return response.json()


def main():
    if not API_KEY:
        print('Error: API_KEY environment variable is required')
        print('Usage: API_KEY=your_key python create_invoice.py')
        sys.exit(1)

    try:
        print('Creating invoice...')

        invoice = create_invoice(
            amount=10000,              # amount in KZT
            phone_number='87001234567',  # customer phone
            description='Test payment',  # description
            external_order_id='order_123',  # your order ID
            external_order_id_idempotency='order_123'  # idempotency key (optional)
        )

        print('\nInvoice created successfully!')
        print('----------------------------')
        print(f"Invoice ID: {invoice['id']}")
        print(f"Amount: {invoice['amount']} KZT")
        print(f"Status: {invoice['status']}")
        print(f"Phone: {invoice['phone']}")
        print(
            '\nStatus is "processing": the invoice is queued and Kaspi has not been called yet. '
            'Wait for the invoice.status_changed webhook (or poll GET /invoices/{id}) — '
            'the customer sees the payment request only after the status becomes "pending".'
        )

    except Exception as e:
        print(f'Error: {e}')
        sys.exit(1)


if __name__ == '__main__':
    main()
