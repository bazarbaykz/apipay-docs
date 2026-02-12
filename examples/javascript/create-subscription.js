/**
 * ApiPay.kz - Create Subscription Example
 *
 * This example demonstrates how to create a recurring subscription.
 *
 * Usage: API_KEY=your_key node create-subscription.js
 */

const API_KEY = process.env.API_KEY
const API_BASE_URL = 'https://bpapi.bazarbay.site/api/v1'

async function createSubscription(data) {
  const response = await fetch(`${API_BASE_URL}/subscriptions`, {
    method: 'POST',
    headers: {
      'X-API-Key': API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
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
    console.error('Usage: API_KEY=your_key node create-subscription.js')
    process.exit(1)
  }

  try {
    console.log('Creating subscription...')

    const subscription = await createSubscription({
      amount: 5000,
      phone_number: '87001234567',
      billing_period: 'monthly',
      billing_day: 1,
      subscriber_name: 'John Doe',
      description: 'Monthly subscription'
    })

    console.log('\nSubscription created successfully!')
    console.log('----------------------------------')
    console.log(`Subscription ID: ${subscription.id}`)
    console.log(`Amount: ${subscription.amount} KZT`)
    console.log(`Period: ${subscription.billing_period}`)
    console.log(`Status: ${subscription.status}`)
    console.log(`Next billing: ${subscription.next_billing_date}`)

  } catch (error) {
    console.error('Error:', error.message)
    process.exit(1)
  }
}

main()
