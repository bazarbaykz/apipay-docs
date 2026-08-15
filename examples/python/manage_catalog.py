#!/usr/bin/env python3
"""
ApiPay.kz - Manage Catalog Example

This example demonstrates how to list catalog items and create them in a batch.
Image upload is shown in upload_image() — pass the returned image_id in an item.

Usage: API_KEY=your_key python manage_catalog.py
"""

import os
import requests
import sys

API_KEY = os.environ.get('API_KEY')
API_BASE_URL = 'https://api.apipay.kz/api/v1'


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


def create_items(items: list, sync_token: str = None) -> dict:
    """Create catalog items (batch, 1-100 items per request).

    sync_token marks every item the request mentions, including the ones that
    needed no work. It is what a later bulk-delete uses to find the remainder.
    """
    payload = {'items': items}
    if sync_token:
        payload['sync_token'] = sync_token

    response = requests.post(
        f'{API_BASE_URL}/catalog',
        headers={
            'X-API-Key': API_KEY,
            'Content-Type': 'application/json'
        },
        json=payload
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


def bulk_delete(body: dict) -> dict:
    """Bulk-delete catalog items (POST, not DELETE: 1C clients handle a body poorly)."""
    response = requests.post(
        f'{API_BASE_URL}/catalog/bulk-delete',
        headers={
            'X-API-Key': API_KEY,
            'Content-Type': 'application/json'
        },
        json=body
    )

    payload = response.json()

    if not response.ok:
        # reason narrows catalog_delete_filter_invalid / catalog_delete_scope_required.
        # The list of reason values is open - keep a generic branch.
        code = payload.get('error_code') or payload.get('error')
        reason = payload.get('reason')
        raise Exception(f"Bulk delete error: {code}" + (f" ({reason})" if reason else ''))

    return payload


def full_sync(sync_token: str, items: list) -> dict:
    """Upload the whole feed under one run marker, then remove what it did not touch.

    The deletion is a background operation that can run for a day: 202 means
    "accepted", not "deleted" - watch poll_url or the catalog.batch_processed
    webhook with kind: delete.

    The API key must be issued by the organization owner, otherwise the call is
    refused with 403 catalog_delete_owner_key_required.
    """
    # 1. Upload every chunk of the run with the SAME sync_token.
    for start in range(0, len(items), 100):
        create_items(items[start:start + 100], sync_token)

    # 2. Scout: how many items would be removed, and which ones.
    #    include_never_stamped also removes items that never took part in any run -
    #    those added by hand at the till or pulled in from the Kaspi catalog.
    filter_ = {'sync_token_not': sync_token, 'include_never_stamped': False}
    preview = bulk_delete({'filter': filter_, 'dry_run': True})
    print(f"Would delete: {preview['would_delete']}")

    if preview['would_delete'] == 0:
        return None

    # 3. Confirm with the number from the dry run. A mismatch means the catalog
    #    changed in between: 409 catalog_bulk_delete_mismatch carries actual_count.
    return bulk_delete({'filter': filter_, 'expected_count': preview['would_delete']})


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
        print(f"Accepted: {len(result['data'])}, rejected: {len(result.get('rejected', []))}")
        for bad in result.get('rejected', []):
            print(f"  rejected: {bad}")
        print('Accepted items are created with status "pending" and synced to Kaspi asynchronously.')

        # Full synchronization. Use one marker per run - a timestamp or a job id.
        # sync = full_sync('run-2026-08-15-a', whole_feed)
        # if sync:
        #     print(f"Queued for removal: {sync['queued']}")

    except Exception as e:
        print(f'Error: {e}')
        sys.exit(1)


if __name__ == '__main__':
    main()
