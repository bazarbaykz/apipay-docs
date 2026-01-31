#!/usr/bin/env python3
"""
ApiPay.kz - Organization Verification Example

This example demonstrates the complete organization verification flow:
1. Start verification with IIN/BIN
2. Poll for status until verified or timeout

Prerequisites:
- Add phone 77056610934 to Kaspi Business as "Cashier"

Usage: API_KEY=your_key IDN=123456789012 python verify_organization.py
"""

import os
import requests
import sys
import time

API_KEY = os.environ.get('API_KEY')
IDN = os.environ.get('IDN')
API_BASE_URL = 'https://bpapi.bazarbay.site/api'

POLL_INTERVAL = 2  # seconds
MAX_TIMEOUT = 120  # seconds


def start_verification(idn: str) -> dict:
    """Start organization verification."""
    response = requests.post(
        f'{API_BASE_URL}/organizations/verify',
        headers={
            'X-API-Key': API_KEY,
            'Content-Type': 'application/json'
        },
        json={'idn': idn}
    )

    if not response.ok:
        error = response.json()
        raise Exception(f"API Error: {error.get('message', 'Unknown error')}")

    return response.json()


def check_status(organization_id: int) -> dict:
    """Check verification status."""
    response = requests.get(
        f'{API_BASE_URL}/organizations/{organization_id}/status',
        headers={'X-API-Key': API_KEY}
    )

    if not response.ok:
        error = response.json()
        raise Exception(f"API Error: {error.get('message', 'Unknown error')}")

    return response.json()


def wait_for_verification(organization_id: int) -> dict:
    """Poll for verification status until verified or timeout."""
    start_time = time.time()

    while time.time() - start_time < MAX_TIMEOUT:
        data = check_status(organization_id)
        organization = data['organization']
        status = organization['status']
        time_remaining = organization.get('time_remaining', 0)

        print(f'Status: {status}, Time remaining: {time_remaining}s')

        if status == 'verified':
            return organization

        if status == 'failed':
            raise Exception('Verification failed')

        time.sleep(POLL_INTERVAL)

    raise Exception('Verification timeout')


def main():
    if not API_KEY or not IDN:
        print('Error: API_KEY and IDN environment variables are required')
        print('Usage: API_KEY=your_key IDN=123456789012 python verify_organization.py')
        sys.exit(1)

    try:
        print('Starting organization verification...')
        print(f'IIN/BIN: {IDN}')
        print('')
        print('Please confirm in Kaspi Business app within 2 minutes.')
        print('---')

        result = start_verification(IDN)
        organization_id = result['organization']['id']

        print(f'Organization ID: {organization_id}')
        print('Waiting for confirmation...\n')

        organization = wait_for_verification(organization_id)

        print('\nVerification successful!')
        print('------------------------')
        print(f"Organization ID: {organization['id']}")
        print(f"IIN/BIN: {organization['idn']}")
        print(f"Status: {organization['status']}")
        print('\nYou can now create invoices!')

    except Exception as e:
        print(f'\nError: {e}')
        sys.exit(1)


if __name__ == '__main__':
    main()
