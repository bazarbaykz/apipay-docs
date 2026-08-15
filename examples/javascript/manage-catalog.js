/**
 * ApiPay.kz - Manage Catalog Example
 *
 * This example demonstrates how to manage catalog items:
 * list the catalog, create items and read the per-item rejected[] result,
 * then run a full synchronization that removes whatever is no longer in the feed.
 * uploadImage() below is a helper for POST /catalog/upload-image.
 *
 * Usage: API_KEY=your_key node manage-catalog.js
 */

const fs = require('fs')
const path = require('path')

const API_KEY = process.env.API_KEY
const API_BASE_URL = 'https://api.apipay.kz/api/v1'

async function uploadImage(filePath) {
  const formData = new FormData()
  const file = new Blob([fs.readFileSync(filePath)])
  formData.append('image', file, path.basename(filePath))

  const response = await fetch(`${API_BASE_URL}/catalog/upload-image`, {
    method: 'POST',
    headers: { 'X-API-Key': API_KEY },
    body: formData
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Upload Error: ${error.message}`)
  }

  return response.json()
}

async function createItems(items, syncToken) {
  // sync_token marks every item the request mentions, including the ones that
  // needed no work. It is what a later bulk-delete uses to find the remainder.
  const body = syncToken ? { items, sync_token: syncToken } : { items }

  const response = await fetch(`${API_BASE_URL}/catalog`, {
    method: 'POST',
    headers: {
      'X-API-Key': API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Create Error: ${error.message}`)
  }

  return response.json()
}

async function listItems(page = 1, perPage = 50) {
  const response = await fetch(
    `${API_BASE_URL}/catalog?page=${page}&per_page=${perPage}`,
    { headers: { 'X-API-Key': API_KEY } }
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`List Error: ${error.message}`)
  }

  return response.json()
}

async function bulkDelete(body) {
  const response = await fetch(`${API_BASE_URL}/catalog/bulk-delete`, {
    method: 'POST',
    headers: {
      'X-API-Key': API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })

  const payload = await response.json()

  if (!response.ok) {
    // reason narrows catalog_delete_filter_invalid / catalog_delete_scope_required.
    // The list of reason values is open — keep a generic branch.
    throw new Error(
      `Bulk delete error: ${payload.error_code || payload.error}` +
      (payload.reason ? ` (${payload.reason})` : '')
    )
  }

  return payload
}

/**
 * Full synchronization: upload the whole feed under one run marker, then remove
 * everything that marker did not touch.
 *
 * The bulk deletion is a background operation that can run for a day, so the 202
 * means "accepted", not "deleted" — watch poll_url or the catalog.batch_processed
 * webhook with kind: delete.
 *
 * The API key must be issued by the organization owner, otherwise the call is
 * refused with 403 catalog_delete_owner_key_required.
 */
async function fullSync(syncToken, items) {
  // 1. Upload every chunk of the run with the SAME sync_token.
  for (let i = 0; i < items.length; i += 100) {
    await createItems(items.slice(i, i + 100), syncToken)
  }

  // 2. Scout: how many items would be removed, and which ones.
  //    include_never_stamped also removes items that never took part in any run —
  //    those added by hand at the till or pulled in from the Kaspi catalog.
  const filter = { sync_token_not: syncToken, include_never_stamped: false }
  const preview = await bulkDelete({ filter, dry_run: true })
  console.log(`Would delete: ${preview.would_delete}`)

  if (preview.would_delete === 0) return null

  // 3. Confirm with the number from the dry run. A mismatch means the catalog
  //    changed in between: 409 catalog_bulk_delete_mismatch carries actual_count.
  return bulkDelete({ filter, expected_count: preview.would_delete })
}

async function main() {
  if (!API_KEY) {
    console.error('Error: API_KEY environment variable is required')
    process.exit(1)
  }

  try {
    // List existing items
    console.log('Fetching catalog...')
    const catalog = await listItems()
    console.log(`Found ${catalog.meta.total} items`)

    // Create new items (without image)
    console.log('\nCreating catalog items...')
    const result = await createItems([
      { name: 'Coffee Latte', selling_price: 1500, unit_id: 1, external_ref: 'SKU-LATTE' },
      { name: 'Cookie', selling_price: 500, unit_id: 1, external_ref: 'SKU-COOKIE' }
    ])

    // Валидация по позициям: битая позиция не роняет батч, она приходит в rejected[].
    // rejected[] есть в ответе всегда — проверяйте его, иначе часть каталога не зальётся.
    console.log(`Accepted: ${result.data.length}, rejected: ${result.rejected.length}`)
    for (const item of result.rejected) {
      console.error(`  item #${item.index}: ${item.error_code} — ${item.error_message}`)
    }
    // Production: позиции создаются в статусе pending, синхронизация в Kaspi асинхронная.
    // Sandbox: позиции активны сразу. Итог сверяйте через GET /catalog?external_refs[]=...

    // Full synchronization. Use one marker per run — a timestamp or a job id.
    // console.log('\nRunning full sync...')
    // const sync = await fullSync('run-2026-08-15-a', wholeFeed)
    // if (sync) console.log(`Queued for removal: ${sync.queued}`)

  } catch (error) {
    console.error('Error:', error.message)
    process.exit(1)
  }
}

main()
