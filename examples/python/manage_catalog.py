#!/usr/bin/env python3
"""
ApiPay.kz - Manage Catalog Example

This example demonstrates how to manage catalog items:
upload images, create items, update and delete.

Usage: API_KEY=your_key python manage_catalog.py
"""

import os
import requests
import sys

API_KEY = os.environ.get('API_KEY')
API_BASE_URL = 'https://bpapi.bazarbay.site/api/v1'


def upload_image(file_path: str) -> dict:
    """Upload a catalog image."""
    with open(file_path, 'rb') as f:
        response = requests.post(
            f'{API_BASE_URL}/catalog/upload-image',
            headers={'X-API-Key': API_KEY},
            files={'image': f}
        )

    if not response.ok:
        error = response.json()
        raise Exception(f"Upload Error: {error.get('message', 'Unknown error')}")

    return response.json()


def create_items(items: list) -> dict:
    """Create catalog items (batch, 1-50 items)."""
    response = requests.post(
        f'{API_BASE_URL}/catalog',
        headers={
            'X-API-Key': API_KEY,
            'Content-Type': 'application/json'
        },
        json={'items': items}
    )

    if not response.ok:
        error = response.json()
        raise Exception(f"Create Error: {error.get('message', 'Unknown error')}")

    return response.json()


def list_items(page: int = 1, per_page: int = 50) -> dict:
    """List catalog items."""
    response = requests.get(
        f'{API_BASE_URL}/catalog',
        headers={'X-API-Key': API_KEY},
        params={'page': page, 'per_page': per_page}
    )

    if not response.ok:
        error = response.json()
        raise Exception(f"List Error: {error.get('message', 'Unknown error')}")

    return response.json()


def main():
    if not API_KEY:
        print('Error: API_KEY environment variable is required')
        print('Usage: API_KEY=your_key python manage_catalog.py')
        sys.exit(1)

    try:
        # List existing items
        print('Fetching catalog...')
        catalog = list_items()
        print(f"Found {catalog['meta']['total']} items")

        # Create new items (without image)
        print('\nCreating catalog items...')
        result = create_items([
            {'name': 'Coffee Latte', 'selling_price': 1500, 'unit_id': 1},
            {'name': 'Cookie', 'selling_price': 500, 'unit_id': 1}
        ])
        print('Items created (202 Accepted — processing async)')

    except Exception as e:
        print(f'Error: {e}')
        sys.exit(1)


if __name__ == '__main__':
    main()
