/**
 * ApiPay.kz - Manage Catalog Example
 *
 * This example demonstrates how to manage catalog items:
 * upload images, create items, update and delete.
 *
 * Usage: API_KEY=your_key node manage-catalog.js
 */

const fs = require('fs')
const path = require('path')

const API_KEY = process.env.API_KEY
const API_BASE_URL = 'https://bpapi.bazarbay.site/api/v1'

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
      { name: 'Coffee Latte', selling_price: 1500, unit_id: 1 },
      { name: 'Cookie', selling_price: 500, unit_id: 1 }
    ])
    console.log('Items created (202 Accepted — processing async)')

  } catch (error) {
    console.error('Error:', error.message)
    process.exit(1)
  }
}

main()
