/**
 * ApiPay.kz - Webhook Handler Example
 *
 * This example demonstrates how to:
 * 1. Receive webhook notifications
 * 2. Verify the signature
 * 3. Handle payment events
 *
 * Usage:
 *   WEBHOOK_SECRET=your_secret PORT=3000 node webhook-handler.js
 *
 * Test with:
 *   curl -X POST http://localhost:3000/webhook \
 *     -H "Content-Type: application/json" \
 *     -H "X-Webhook-Signature: sha256=..." \
 *     -d '{"event":"invoice.status_changed","invoice":{"id":42,"status":"paid"}}'
 */

const http = require('http')
const crypto = require('crypto')

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET
const PORT = process.env.PORT || 3000

/**
 * Verify webhook signature using HMAC-SHA256
 */
function verifySignature(payload, signature, secret) {
  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')

  // Use timing-safe comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  } catch {
    return false
  }
}

/**
 * Handle invoice status change event
 */
function handleInvoiceStatusChanged(invoice) {
  console.log(`\nInvoice #${invoice.id} status changed to: ${invoice.status}`)

  switch (invoice.status) {
    case 'paid':
      console.log(`  Payment received!`)
      console.log(`  Amount: ${invoice.amount} KZT`)
      console.log(`  Client: ${invoice.client_name}`)
      console.log(`  Paid at: ${invoice.paid_at}`)
      if (invoice.external_order_id) {
        console.log(`  Order ID: ${invoice.external_order_id}`)
        // TODO: Fulfill the order
        // fulfillOrder(invoice.external_order_id)
      }
      break

    case 'cancelled':
      console.log(`  Invoice was cancelled`)
      console.log(`  Cancelled at: ${invoice.cancelled_at}`)
      // TODO: Handle cancellation
      break

    case 'expired':
      console.log(`  Invoice expired`)
      console.log(`  Expired at: ${invoice.expired_at}`)
      // TODO: Handle expiration
      break

    default:
      console.log(`  Unknown status: ${invoice.status}`)
  }
}

/**
 * HTTP request handler
 */
function handleRequest(req, res) {
  // Only handle POST /webhook
  if (req.method !== 'POST' || req.url !== '/webhook') {
    res.writeHead(404)
    res.end('Not Found')
    return
  }

  let body = ''

  req.on('data', chunk => {
    body += chunk.toString()
  })

  req.on('end', () => {
    // Get signature from header
    const signature = req.headers['x-webhook-signature']

    if (!signature) {
      console.log('Missing signature header')
      res.writeHead(401)
      res.end('Missing signature')
      return
    }

    // Verify signature
    if (!verifySignature(body, signature, WEBHOOK_SECRET)) {
      console.log('Invalid signature')
      res.writeHead(401)
      res.end('Invalid signature')
      return
    }

    // Parse and handle event
    try {
      const event = JSON.parse(body)
      console.log(`\nReceived event: ${event.event}`)
      console.log(`Timestamp: ${event.timestamp}`)

      switch (event.event) {
        case 'invoice.status_changed':
          handleInvoiceStatusChanged(event.invoice)
          break

        default:
          console.log(`Unknown event type: ${event.event}`)
      }

      // Always respond with 200 to acknowledge receipt
      res.writeHead(200)
      res.end('OK')

    } catch (error) {
      console.error('Error parsing webhook:', error.message)
      res.writeHead(400)
      res.end('Invalid JSON')
    }
  })
}

// Main
if (!WEBHOOK_SECRET) {
  console.error('Error: WEBHOOK_SECRET environment variable is required')
  console.error('Usage: WEBHOOK_SECRET=your_secret node webhook-handler.js')
  process.exit(1)
}

const server = http.createServer(handleRequest)

server.listen(PORT, () => {
  console.log(`Webhook server listening on port ${PORT}`)
  console.log(`Endpoint: POST http://localhost:${PORT}/webhook`)
  console.log('\nWaiting for webhook events...')
})
