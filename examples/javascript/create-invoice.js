/**
 * ApiPay.kz - Create Invoice Example
 *
 * This example demonstrates how to create a payment invoice.
 *
 * Usage: API_KEY=your_key node create-invoice.js
 */

const API_KEY = process.env.API_KEY
const API_BASE_URL = 'https://bpapi.bazarbay.site/api/v1'

async function createInvoice(amount, phoneNumber, description, externalOrderId) {
  const response = await fetch(`${API_BASE_URL}/invoices`, {
    method: 'POST',
    headers: {
      'X-API-Key': API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      amount,
      phone_number: phoneNumber,
      description,
      external_order_id: externalOrderId
    })
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`API Error: ${error.message}`)
  }

  return response.json()
}

async function main() {
  if (!API_KEY) {
    console.error('Error: API_KEY environment variable is required')
    console.error('Usage: API_KEY=your_key node create-invoice.js')
    process.exit(1)
  }

  try {
    console.log('Creating invoice...')

    const invoice = await createInvoice(
      10000,              // amount in KZT
      '87001234567',      // customer phone
      'Test payment',     // description
      'order_123'         // your order ID
    )

    console.log('\nInvoice created successfully!')
    console.log('----------------------------')
    console.log(`Invoice ID: ${invoice.id}`)
    console.log(`Amount: ${invoice.amount} KZT`)
    console.log(`Status: ${invoice.status}`)
    console.log(`Phone: ${invoice.phone_number}`)
    console.log('\nThe customer will receive a payment notification in the Kaspi app.')

  } catch (error) {
    console.error('Error:', error.message)
    process.exit(1)
  }
}

main()
