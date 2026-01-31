/**
 * ApiPay.kz - Organization Verification Example
 *
 * This example demonstrates the complete organization verification flow:
 * 1. Start verification with IIN/BIN
 * 2. Poll for status until verified or timeout
 *
 * Prerequisites:
 * - Add phone 77056610934 to Kaspi Business as "Cashier"
 *
 * Usage: API_KEY=your_key IDN=123456789012 node verify-organization.js
 */

const API_KEY = process.env.API_KEY
const IDN = process.env.IDN
const API_BASE_URL = 'https://bpapi.bazarbay.site/api'

const POLL_INTERVAL = 2000  // 2 seconds
const MAX_TIMEOUT = 120000  // 120 seconds

async function startVerification(idn) {
  const response = await fetch(`${API_BASE_URL}/organizations/verify`, {
    method: 'POST',
    headers: {
      'X-API-Key': API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ idn })
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`API Error: ${error.message}`)
  }

  return response.json()
}

async function checkStatus(organizationId) {
  const response = await fetch(`${API_BASE_URL}/organizations/${organizationId}/status`, {
    headers: {
      'X-API-Key': API_KEY
    }
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`API Error: ${error.message}`)
  }

  return response.json()
}

async function waitForVerification(organizationId) {
  const startTime = Date.now()

  while (Date.now() - startTime < MAX_TIMEOUT) {
    const data = await checkStatus(organizationId)
    const { status, time_remaining } = data.organization

    console.log(`Status: ${status}, Time remaining: ${time_remaining}s`)

    if (status === 'verified') {
      return data.organization
    }

    if (status === 'failed') {
      throw new Error('Verification failed')
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL))
  }

  throw new Error('Verification timeout')
}

async function main() {
  if (!API_KEY || !IDN) {
    console.error('Error: API_KEY and IDN environment variables are required')
    console.error('Usage: API_KEY=your_key IDN=123456789012 node verify-organization.js')
    process.exit(1)
  }

  try {
    console.log('Starting organization verification...')
    console.log(`IIN/BIN: ${IDN}`)
    console.log('')
    console.log('Please confirm in Kaspi Business app within 2 minutes.')
    console.log('---')

    const result = await startVerification(IDN)
    const organizationId = result.organization.id

    console.log(`Organization ID: ${organizationId}`)
    console.log('Waiting for confirmation...\n')

    const organization = await waitForVerification(organizationId)

    console.log('\nVerification successful!')
    console.log('------------------------')
    console.log(`Organization ID: ${organization.id}`)
    console.log(`IIN/BIN: ${organization.idn}`)
    console.log(`Status: ${organization.status}`)
    console.log('\nYou can now create invoices!')

  } catch (error) {
    console.error('\nError:', error.message)
    process.exit(1)
  }
}

main()
