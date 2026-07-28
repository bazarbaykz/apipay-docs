/**
 * ApiPay.kz - Webhook Handler Example
 *
 * This example demonstrates how to:
 * 1. Receive webhook notifications
 * 2. Verify the signature
 * 3. Handle payment events (invoices and subscriptions)
 *
 * Usage:
 *   WEBHOOK_SECRET=your_secret PORT=3000 node webhook-handler.js
 *
 * Test with:
 *   curl -X POST http://localhost:3000/webhook \
 *     -H "Content-Type: application/json" \
 *     -H "X-Webhook-Signature: sha256=..." \
 *     -d '{"event":"invoice.status_changed","invoice":{"id":42,"status":"paid"},"source":"api"}'
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
        // ВАЖНО: доставка вебхуков — at-least-once. Один и тот же переход статуса
        // может прийти повторно, поэтому дедуплицируйте по паре (invoice.id, status)
        // ДО отгрузки заказа — иначе клиент получит товар дважды.
        // Отвечайте 200 в пределах 5 секунд, а саму отгрузку выносите в фоновую задачу.
        // TODO: Fulfill the order (идемпотентно, в фоне)
      }
      break

    case 'cancelled':
      console.log(`  Invoice was cancelled`)
      break

    case 'expired':
      console.log(`  Invoice expired`)
      break

    default:
      console.log(`  Status: ${invoice.status}`)
  }
}

/**
 * Handle invoice refunded event
 */
function handleInvoiceRefunded(invoice) {
  console.log(`\nInvoice #${invoice.id} refunded`)
  console.log(`  Status: ${invoice.status}`)
  console.log(`  Total refunded: ${invoice.total_refunded} KZT`)
}

/**
 * Handle subscription events
 */
function handleSubscriptionEvent(eventType, data) {
  const sub = data.subscription
  console.log(`\nSubscription #${sub.id} — ${eventType}`)

  switch (eventType) {
    case 'subscription.payment_succeeded':
      console.log(`  Payment succeeded! Invoice #${data.invoice_id}: ${data.amount} KZT`)
      break

    case 'subscription.payment_failed':
      console.log(`  Payment failed: ${data.reason}`)
      break

    case 'subscription.grace_period_started':
      console.log(`  Grace period: ${data.grace_period_days} days, ends at ${data.expires_at}`)
      break

    case 'subscription.expired':
      console.log(`  Subscription expired`)
      break
  }
}

/**
 * HTTP request handler
 */
function handleRequest(req, res) {
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
    const signature = req.headers['x-webhook-signature']

    if (!signature) {
      res.writeHead(401)
      res.end('Missing signature')
      return
    }

    if (!verifySignature(body, signature, WEBHOOK_SECRET)) {
      res.writeHead(401)
      res.end('Invalid signature')
      return
    }

    try {
      const event = JSON.parse(body)
      console.log(`\nReceived event: ${event.event} (source: ${event.source})`)
      console.log(`Timestamp: ${event.timestamp}`)

      switch (event.event) {
        case 'invoice.status_changed':
          handleInvoiceStatusChanged(event.invoice)
          break

        case 'invoice.refunded':
          // Событие приходит и на успешный, и на неудачный возврат — смотрите refund.status
          if (event.refund.status === 'completed') {
            handleInvoiceRefunded(event.invoice)
          } else {
            console.log(`\nRefund #${event.refund.id} failed: ${event.refund.error_code}`)
            console.log('  Деньги клиенту НЕ возвращены — новый возврат создаётся отдельно')
          }
          break

        case 'subscription.payment_succeeded':
        case 'subscription.payment_failed':
        case 'subscription.grace_period_started':
        case 'subscription.expired':
          handleSubscriptionEvent(event.event, event)
          break

        default:
          console.log(`Unknown event type: ${event.event}`)
      }

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
