/**
 * ApiPay.kz - Manage Catalog Example
 *
 * This example demonstrates how to manage catalog items:
 * list the catalog, create items and read the per-item rejected[] result.
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

async function createItems(items) {
  const response = await fetch(`${API_BASE_URL}/catalog`, {
    method: 'POST',
    headers: {
      'X-API-Key': API_KEY,
      'Content-Type': 'application/json'
    },
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

  } catch (error) {
    console.error('Error:', error.message)
    process.exit(1)
  }
}

main()
