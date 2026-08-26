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

const crypto = require('crypto')
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

/**
 * Create catalog items (batch, 1–100 items per request).
 *
 * The answer is always 202 "accepted": in production the items get status
 * pending and are pushed to Kaspi afterwards. An exact repeat under the same
 * Idempotency-Key answers 200 with idempotent_replay: true.
 */
async function createItems(items, idempotencyKey) {
  const headers = {
    'X-API-Key': API_KEY,
    'Content-Type': 'application/json'
  }
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey

  const response = await fetch(`${API_BASE_URL}/catalog`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ items })
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

/**
 * Catalog queue remainder: total (create), updating and deleting counters.
 *
 * There is no overall handle for a bulk operation, so this endpoint plus
 * GET /catalog/errors is how you follow the work through.
 */
async function queueStatus() {
  const response = await fetch(`${API_BASE_URL}/catalog/queue`, {
    headers: { 'X-API-Key': API_KEY }
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Queue Error: ${error.message}`)
  }

  return response.json()
}

/**
 * Failed catalog operations. The window filters by failed_at; without `from`
 * the last 7 days are returned.
 */
async function listErrors({ from, to } = {}) {
  const params = new URLSearchParams()
  if (from) params.set('from', from)
  if (to) params.set('to', to)

  const query = params.toString()
  const response = await fetch(
    `${API_BASE_URL}/catalog/errors${query ? `?${query}` : ''}`,
    { headers: { 'X-API-Key': API_KEY } }
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Errors Error: ${error.message}`)
  }

  return response.json()
}

/**
 * Bulk-delete catalog items (POST, not DELETE: 1C clients handle a body poorly).
 *
 * The body takes exactly one target list: ids[] or external_refs[], up to 200
 * values. There is no filter mode — the integrator builds the removal list.
 */
async function bulkDelete(body, idempotencyKey) {
  const headers = {
    'X-API-Key': API_KEY,
    'Content-Type': 'application/json'
  }
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey

  const response = await fetch(`${API_BASE_URL}/catalog/bulk-delete`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  })

  const payload = await response.json()

  if (!response.ok) {
    // catalog_delete_scope_required — no list, or both lists at once.
    // catalog_match_overflow        — more than 200 values in the list.
    // catalog_bulk_delete_mismatch  — expected_count no longer matches; the body
    //                                 carries actual_count and nothing was deleted.
    throw new Error(`Bulk delete error: ${payload.error_code || payload.error}`)
  }

  return payload
}

/**
 * Full synchronization: upload the current feed, then remove the items you know
 * are gone.
 *
 * The removal list is yours to build: the server cannot tell an interrupted
 * export from an honest shrink of the catalog, so it will not guess a
 * destructive set for you.
 *
 * The bulk deletion is a background operation that can run for a day, so the 202
 * means "accepted", not "deleted". There is no overall handle — follow the work
 * through GET /catalog/queue, targeted GET /catalog?external_refs[]=,
 * GET /catalog/errors and the per-item catalog.item_processed webhook.
 *
 * The API key must be issued by the organization owner, otherwise the call is
 * refused with 403 catalog_delete_owner_key_required.
 */
async function fullSync(items, goneExternalRefs) {
  // 1. Upload the current catalog, 100 items per request.
  for (let i = 0; i < items.length; i += 100) {
    await createItems(items.slice(i, i + 100))
  }

  // 2. Remove the items that are gone, in chunks of 200 or fewer.
  const results = []
  for (let i = 0; i < goneExternalRefs.length; i += 200) {
    const chunk = goneExternalRefs.slice(i, i + 200)

    // 2a. Scout: how many items would be removed, and which ones.
    const preview = await bulkDelete({ external_refs: chunk, dry_run: true })
    console.log(`Would delete: ${preview.would_delete}`)

    if (preview.would_delete === 0) continue

    // 2b. Confirm with the number from the dry run and a UNIQUE key per chunk.
    //     A mismatch means the set changed in between: 409
    //     catalog_bulk_delete_mismatch carries actual_count, nothing is deleted,
    //     repeat the dry run.
    results.push(await bulkDelete(
      { external_refs: chunk, expected_count: preview.would_delete },
      `catalog-sync-${crypto.randomUUID()}`
    ))
  }

  return results
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

    // Сколько работы ещё не закрыто. total — создание, updating — правки, ждущие
    // подтверждения Kaspi, deleting — снятие.
    const queue = await queueStatus()
    console.log(
      `\nQueue: ${queue.total} to create, ${queue.updating} updating, ` +
      `${queue.deleting} deleting (state: ${queue.queue.state})`
    )

    // Что отказало за последние 7 дней.
    const failures = await listErrors()
    console.log(`Failed operations: ${failures.total}`)
    for (const row of failures.data.slice(0, 5)) {
      console.error(
        `  ${row.external_ref}: ${row.operation} -> ${row.error_code} at ${row.failed_at}`
      )
    }

    // Полная синхронизация: залить актуальное и снять то, чего больше нет.
    // console.log('\nRunning full sync...')
    // const sync = await fullSync(wholeFeed, ['1C-000123', '1C-000124'])
    // for (const chunk of sync) console.log(`Queued for removal: ${chunk.queued}`)

  } catch (error) {
    console.error('Error:', error.message)
    process.exit(1)
  }
}

main()
