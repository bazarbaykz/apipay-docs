/**
 * ApiPay.kz - Partner API: Merchant Onboarding Example
 *
 * Onboards a merchant end-to-end: create the organization, authorize the
 * Kaspi cashier (SMS-based), and issue the merchant's API key.
 *
 * The flow has two phases because the cashier receives an SMS code:
 *   1. First run  — creates the org and sends the SMS:
 *        PARTNER_KEY=pk_... CASHIER_PHONE=77001234567 node partner-onboarding.js
 *   2. Second run — finishes once the merchant gives you the code:
 *        PARTNER_KEY=pk_... ORG_ID=50 OTP=1234 node partner-onboarding.js
 */

const PARTNER_KEY = process.env.PARTNER_KEY
const BASE_URL = 'https://api.apipay.kz'

async function api(method, path, body) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'X-Partner-Key': PARTNER_KEY,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  })

  const data = await response.json()
  if (!response.ok || data.success === false) {
    throw new Error(`API Error (${response.status}): ${data.error || data.message || 'Unknown error'}`)
  }
  return data
}

// Phase 1: create the organization and start cashier authorization
async function startOnboarding(cashierPhone, externalId) {
  console.log('1. Creating merchant organization...')
  const { organization } = await api('POST', '/api/partner/organizations', {
    external_id: externalId
  })
  console.log(`   organization id: ${organization.id}`)

  console.log('2. Starting Kaspi cashier authorization...')
  await api('POST', `/api/partner/organizations/${organization.id}/kaspi-auth/init`)

  console.log('3. Sending the cashier phone — Kaspi will text an SMS code...')
  await api('POST', `/api/partner/organizations/${organization.id}/kaspi-auth/send-phone`, {
    cashier_phone: cashierPhone
  })

  console.log('\nSMS sent. Ask the merchant for the code, then run again:')
  console.log(`  PARTNER_KEY=... ORG_ID=${organization.id} OTP=<code> node partner-onboarding.js`)
}

// Phase 2: confirm the SMS code and issue the merchant's API key
async function finishOnboarding(orgId, otp, webhookUrl) {
  console.log('4. Verifying the SMS code...')
  const verified = await api('POST', `/api/partner/organizations/${orgId}/kaspi-auth/verify-otp`, {
    otp
  })
  console.log(`   cashier connected, organization status: ${verified.organization.status}`)

  console.log('5. Issuing the merchant API key...')
  const key = await api('POST', `/api/partner/organizations/${orgId}/api-key`, {
    name: 'CRM key',
    webhook_url: webhookUrl
  })

  console.log('\nOnboarding complete!')
  console.log('--------------------')
  console.log(`X-API-Key:      ${key.key}`)
  console.log(`Webhook secret: ${key.webhook_secret}`)
  console.log('\nStore the key securely — it is shown only once.')
  console.log('Use it as X-API-Key for the regular API to create invoices for this merchant.')
}

async function main() {
  if (!PARTNER_KEY) {
    console.error('Error: PARTNER_KEY environment variable is required')
    process.exit(1)
  }

  try {
    if (process.env.OTP && process.env.ORG_ID) {
      await finishOnboarding(
        process.env.ORG_ID,
        process.env.OTP,
        'https://your-crm.example.com/webhooks/kaspi'
      )
    } else {
      await startOnboarding(
        process.env.CASHIER_PHONE || '77001234567',
        'crm-client-42'
      )
    }
  } catch (error) {
    console.error('Error:', error.message)
    process.exit(1)
  }
}

main()
