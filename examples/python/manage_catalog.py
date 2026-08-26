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
import uuid

API_KEY = os.environ.get('API_KEY')
API_BASE_URL = 'https://api.apipay.kz/api/v1'

# Both catalog list endpoints cap a chunk at 200 values.
CHUNK_SIZE = 200


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


def create_items(items: list, idempotency_key: str = None) -> dict:
    """Create catalog items (batch, 1-100 items per request).

    The answer is always 202 "accepted": in production the items get status
    "pending" and are pushed to Kaspi afterwards. An exact repeat under the same
    Idempotency-Key answers 200 with idempotent_replay: true.
    """
    headers = {'X-API-Key': API_KEY, 'Content-Type': 'application/json'}
    if idempotency_key:
        headers['Idempotency-Key'] = idempotency_key

    response = requests.post(
        f'{API_BASE_URL}/catalog',
        headers=headers,
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


def queue_status() -> dict:
    """Catalog queue remainder: total (create), updating and deleting counters.

    There is no overall handle for a bulk operation, so this endpoint plus
    GET /catalog/errors is how you follow the work through.
    """
    response = requests.get(
        f'{API_BASE_URL}/catalog/queue',
        headers={'X-API-Key': API_KEY}
    )

    if not response.ok:
        error = response.json()
        raise Exception(f"Queue Error: {error.get('message', 'Unknown error')}")

    return response.json()


def list_errors(date_from: str = None, date_to: str = None) -> dict:
    """Failed catalog operations. The window filters by failed_at.

    Without date_from the last 7 days are returned.
    """
    params = {}
    if date_from:
        params['from'] = date_from
    if date_to:
        params['to'] = date_to

    response = requests.get(
        f'{API_BASE_URL}/catalog/errors',
        headers={'X-API-Key': API_KEY},
        params=params
    )

    if not response.ok:
        error = response.json()
        raise Exception(f"Errors Error: {error.get('message', 'Unknown error')}")

    return response.json()


def bulk_delete(body: dict, idempotency_key: str = None) -> dict:
    """Bulk-delete catalog items (POST, not DELETE: 1C clients handle a body poorly).

    The body takes exactly one target list: ids[] or external_refs[], up to 200
    values. There is no filter mode - the integrator builds the removal list.
    """
    headers = {'X-API-Key': API_KEY, 'Content-Type': 'application/json'}
    if idempotency_key:
        headers['Idempotency-Key'] = idempotency_key

    response = requests.post(
        f'{API_BASE_URL}/catalog/bulk-delete',
        headers=headers,
        json=body
    )

    payload = response.json()

    if not response.ok:
        # catalog_delete_scope_required - no list, or both lists at once.
        # catalog_match_overflow      - more than 200 values in the list.
        # catalog_bulk_delete_mismatch - expected_count no longer matches; the
        #                                body carries actual_count and nothing
        #                                was deleted.
        code = payload.get('error_code') or payload.get('error')
        raise Exception(f"Bulk delete error: {code}")

    return payload


def full_sync(items: list, gone_external_refs: list) -> list:
    """Upload the current feed, then remove the items you know are gone.

    The removal list is yours to build: the server cannot tell an interrupted
    export from an honest shrink of the catalog, so it will not guess a
    destructive set for you.

    The deletion is a background operation that can run for a day: 202 means
    "accepted", not "deleted". There is no overall handle - follow the work
    through GET /catalog/queue, targeted GET /catalog?external_refs[]=,
    GET /catalog/errors and the per-item catalog.item_processed webhook.

    The API key must be issued by the organization owner, otherwise the call is
    refused with 403 catalog_delete_owner_key_required.
    """
    # 1. Upload the current catalog, 100 items per request.
    for start in range(0, len(items), 100):
        create_items(items[start:start + 100])

    # 2. Remove the items that are gone, in chunks of 200 or fewer.
    results = []
    for start in range(0, len(gone_external_refs), CHUNK_SIZE):
        chunk = gone_external_refs[start:start + CHUNK_SIZE]

        # 2a. Scout: how many items would be removed, and which ones.
        preview = bulk_delete({'external_refs': chunk, 'dry_run': True})
        print(f"Would delete: {preview['would_delete']}")

        if preview['would_delete'] == 0:
            continue

        # 2b. Confirm with the number from the dry run and a UNIQUE key per
        #     chunk. A mismatch means the set changed in between: 409
        #     catalog_bulk_delete_mismatch carries actual_count, nothing is
        #     deleted, repeat the dry run.
        results.append(bulk_delete(
            {'external_refs': chunk, 'expected_count': preview['would_delete']},
            idempotency_key=f'catalog-sync-{uuid.uuid4()}'
        ))

    return results


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

        # How much work is still open. total counts creations, updating counts
        # edits waiting for Kaspi to confirm them, deleting counts removals.
        queue = queue_status()
        print(f"\nQueue: {queue['total']} to create, "
              f"{queue['updating']} updating, {queue['deleting']} deleting "
              f"(state: {queue['queue']['state']})")

        # What failed lately (last 7 days by default).
        failures = list_errors()
        print(f"Failed operations: {failures['total']}")
        for row in failures['data'][:5]:
            print(f"  {row['external_ref']}: {row['operation']} -> "
                  f"{row['error_code']} at {row['failed_at']}")

        # Full synchronization: upload the current feed and remove what is gone.
        # sync = full_sync(whole_feed, ['1C-000123', '1C-000124'])
        # for chunk in sync:
        #     print(f"Queued for removal: {chunk['queued']}")

    except Exception as e:
        print(f'Error: {e}')
        sys.exit(1)


if __name__ == '__main__':
    main()
