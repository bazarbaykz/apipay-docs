#!/usr/bin/env python3
"""
ApiPay.kz - Create Subscription Example

This example demonstrates how to create a recurring subscription.

Usage: API_KEY=your_key python create_subscription.py
"""

import os
import requests
import sys

API_KEY = os.environ.get('API_KEY')
API_BASE_URL = 'https://bpapi.bazarbay.site/api/v1'


def create_subscription(data: dict) -> dict:
    """Create a recurring subscription."""
    response = requests.post(
        f'{API_BASE_URL}/subscriptions',
        headers={
            'X-API-Key': API_KEY,
            'Content-Type': 'application/json'
        },
        json=data
    )

    if not response.ok:
        error = response.json()
        raise Exception(f"API Error: {error.get('message', 'Unknown error')}")

    return response.json()


def main():
    if not API_KEY:
        print('Error: API_KEY environment variable is required')
        print('Usage: API_KEY=your_key python create_subscription.py')
        sys.exit(1)

    try:
        print('Creating subscription...')

        subscription = create_subscription({
            'amount': 5000,
            'phone_number': '87001234567',
            'billing_period': 'monthly',
            'billing_day': 1,
            'subscriber_name': 'John Doe',
            'description': 'Monthly subscription'
        })

        print('\nSubscription created successfully!')
        print('----------------------------------')
        print(f"Subscription ID: {subscription['id']}")
        print(f"Amount: {subscription['amount']} KZT")
        print(f"Period: {subscription['billing_period']}")
        print(f"Status: {subscription['status']}")
        print(f"Next billing: {subscription.get('next_billing_date')}")

    except Exception as e:
        print(f'Error: {e}')
        sys.exit(1)


if __name__ == '__main__':
    main()
