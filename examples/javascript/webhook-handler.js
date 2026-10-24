/**
 * ApiPay.kz - Webhook Handler Example
 *
 * This example demonstrates how to:
 * 1. Receive webhook notifications
 * 2. Verify the signature
 * 3. Discard sandbox events unless APIPAY_SANDBOX_MODE=true (production mode is the default)
 * 4. Deduplicate repeated deliveries by an event key
 * 5. Handle payment events (invoices, refunds, refund links, receipts and subscriptions)
 *
 * Without APIPAY_SANDBOX_MODE=true the handler assumes production mode and discards sandbox
 * events (it still answers 200). Set it to exactly true while you test in the sandbox; remove
 * it once the organization works in production mode.
 *
 * Usage while you test in the sandbox:
 *   APIPAY_SANDBOX_MODE=true WEBHOOK_SECRET=your_secret PORT=3000 node webhook-handler.js
 *
 * Usage in production mode:
 *   WEBHOOK_SECRET=your_secret PORT=3000 node webhook-handler.js
 *
 * Test with:
 *   curl -X POST http://localhost:3000/webhook \
 *     -H "Content-Type: application/json" \
 *     -H "X-Webhook-Signature: sha256=..." \
 *     -d '{"event":"invoice.status_changed","is_sandbox":false,"invoice":{"id":42,"status":"paid"},"source":"api"}'
 */

const http = require('http')
const crypto = require('crypto')

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET
const PORT = process.env.PORT || 3000
// Set APIPAY_SANDBOX_MODE=true while you test in the ApiPay sandbox; leave it unset in
// production mode. Your system knows its own mode: the root `is_sandbox` of an event
// describes the event's object, not the organization's current mode.
const SANDBOX_MODE = process.env.APIPAY_SANDBOX_MODE === 'true'

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
 * Processed events. Delivery is not guaranteed, and the same event may arrive more than once;
 * one invoice legitimately gets several different events — so the key is built from a
 * pair of values, not from the invoice id alone.
 *
 * This in-memory Set is reset on restart and is not shared between processes: it is fine
 * for a sandbox test only. In production use a database table with a UNIQUE event key:
 *   claim:   INSERT ... ON CONFLICT DO NOTHING — a row was inserted, so the event is new
 *   release: DELETE ... WHERE event_key = ?
 */
const processedEvents = new Set()

function claimEvent(key) {
  if (processedEvents.has(key)) return false
  processedEvents.add(key)
  return true
}

function releaseEvent(key) {
  processedEvents.delete(key)
}

/**
 * Deduplication key of an event. null — nothing to do (webhook.test, unknown events).
 */
function eventKey(e) {
  const name = e.event || ''
  if (name === 'invoice.status_changed') return `invoice:${e.invoice.id}:${e.invoice.status}`
  if (name === 'invoice.qr_scanned') return `qr_scanned:${e.invoice.id}`
  if (name === 'invoice.refunded') return `refund:${e.refund.id}:${e.refund.status}`
  if (name.startsWith('qr_refund.')) return `${name}:${e.qr_refund.id}`
  if (name.startsWith('receipt.')) return `${name}:${e.receipt.id}`
  if (name.startsWith('cashbox.')) return `${name}:${e.operation.id}`
  // period_skipped has no invoice_id: the skipped period may have no invoice at all
  if (name === 'subscription.period_skipped') return `${name}:${e.subscription.id}:${e.billing_period_start}`
  // invoice_id is present only in payment_succeeded, payment_failed and in cancelled
  // with reason payer_refused / payer_error; for other subscription events it is empty
  if (name.startsWith('subscription.')) return `${name}:${e.subscription.id}:${e.invoice_id ?? ''}`
  return null
}

/**
 * Handle invoice status change event
 */
function handleInvoiceStatusChanged(invoice) {
  console.log(`\nInvoice #${invoice.id} status changed to: ${invoice.status}`)

  // `pending` after `error`, and `error` after such a `pending`, are new transitions, not
  // duplicates: the chain error -> pending -> ... -> error is possible. Release the opposite
  // key so the deduplication does not swallow the next transition.
  if (invoice.status === 'error') releaseEvent(`invoice:${invoice.id}:pending`)
  if (invoice.status === 'pending') releaseEvent(`invoice:${invoice.id}:error`)

  switch (invoice.status) {
    case 'paid':
      console.log(`  Payment received!`)
      console.log(`  Amount: ${invoice.amount} KZT`)
      console.log(`  Client: ${invoice.client_name}`)
      console.log(`  Paid at: ${invoice.paid_at}`)
      if (invoice.external_order_id) {
        console.log(`  Order ID: ${invoice.external_order_id}`)
        // A repeated delivery is already filtered out by the (invoice.id, status) key in
        // handleRequest. Another invoice.id of the same order with status paid is the buyer's
        // second payment, not a duplicate: refund it or pass it to a person for review.
        // Answer 200 within 5 seconds and move the fulfilment itself to a background job.
        // TODO: Fulfill the order (idempotently, in the background)
      }
      break

    case 'cancelled':
      console.log(`  Invoice was cancelled`)
      break

    case 'expired':
      console.log(`  Invoice expired`)
      break

    // cancelled, expired and error are not final: paid (or pending after error) may follow.
    // Do not close the order for good on them.
    default:
      console.log(`  Status: ${invoice.status}`)
  }
}

/**
 * Handle invoice refunded event
 */
function handleInvoiceRefunded(refund, invoice) {
  console.log(`\nRefund #${refund.id} for invoice #${invoice.id} completed`)
  console.log(`  Status: ${invoice.status}`)
  console.log(`  Total refunded: ${invoice.total_refunded} KZT`)
  // A refund.id you never created (for example, after qr_refund.completed of a refund link)
  // may be the same money recorded again, not a second refund. Check it in
  // GET /invoices/{id}/refunds: if some refund there has successor_refund_id equal to this
  // refund.id, count the money once.
}

/**
 * Handle refund link events (qr_refund.*)
 */
function handleQrRefundEvent(eventType, qrRefund) {
  console.log(`\nRefund link #${qrRefund.id} — ${eventType}`)
  switch (eventType) {
    case 'qr_refund.completed':
      console.log('  Money returned to the buyer')
      break
    case 'qr_refund.failed':
    case 'qr_refund.expired':
      // Money did not move. A new link is needed if the refund is still due
      console.log(`  Not refunded: ${qrRefund.error_code || 'see GET /qr-refunds/{id}'}`)
      break
    case 'qr_refund.execution_uncertain':
      // The outcome is not proven, money may have left. Do not repeat the refund
      console.log('  Outcome unknown — do not repeat the refund')
      break
  }
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

    default:
      console.log(`  Subscription status: ${sub.status}`)
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

    let event
    try {
      event = JSON.parse(body)
    } catch (error) {
      console.error('Error parsing webhook:', error.message)
      res.writeHead(400)
      res.end('Invalid JSON')
      return
    }

    console.log(`\nReceived event: ${event.event} (source: ${event.source})`)
    console.log(`Timestamp: ${event.timestamp}`)

    // In production mode, discard events about sandbox objects: reply 200 and do not
    // act on them. An event sent before the organization switched to production may
    // arrive after the switch. The signature is verified above, so the dashboard's
    // `webhook.test` (always is_sandbox: true) still gets its 200 only with a valid secret.
    if (!SANDBOX_MODE && event.is_sandbox === true) {
      console.log(`Discarded sandbox event: ${event.event} (set APIPAY_SANDBOX_MODE=true while testing in the sandbox)`)
      res.writeHead(200)
      res.end('OK')
      return
    }

    const key = eventKey(event)
    if (!key) {
      // webhook.test and unknown events: nothing to do
      console.log(`No action for event: ${event.event}`)
      res.writeHead(200)
      res.end('OK')
      return
    }

    // The key is claimed BEFORE processing: a repeated delivery of the same event is answered
    // with 200 and is not processed twice
    if (!claimEvent(key)) {
      console.log(`Duplicate delivery skipped: ${key}`)
      res.writeHead(200)
      res.end('OK')
      return
    }

    try {
      switch (event.event) {
        case 'invoice.status_changed':
          handleInvoiceStatusChanged(event.invoice)
          break

        case 'invoice.refunded':
          // The event arrives for both a successful and a failed refund — check refund.status
          if (event.refund.status === 'completed') {
            handleInvoiceRefunded(event.refund, event.invoice)
          } else {
            console.log(`\nRefund #${event.refund.id} failed: ${event.refund.error_code}`)
            console.log('  The money was NOT returned to the buyer')
            // refund_requires_buyer_confirmation / refund_rejected_by_kaspi — issue the buyer a
            // link via POST /qr-refunds/links with invoice_id and this refund's source_refund_id
          }
          break

        case 'invoice.qr_scanned':
          // The buyer opened the invoice; this is not a payment yet
          console.log(`\nInvoice #${event.invoice.id} scanned — waiting for payment`)
          break

        case 'receipt.issued':
        case 'receipt.failed':
          // A receipt event may also arrive twice: it is deduplicated by (event, receipt.id)
          console.log(`\nReceipt #${event.receipt.id} — ${event.receipt.status}`)
          break

        default:
          if (event.event.startsWith('qr_refund.')) {
            handleQrRefundEvent(event.event, event.qr_refund)
          } else if (event.event.startsWith('subscription.')) {
            handleSubscriptionEvent(event.event, event)
          } else {
            console.log(`Unhandled event type: ${event.event}`)
          }
      }

      res.writeHead(200)
      res.end('OK')
    } catch (error) {
      // Release the key: ApiPay retries the delivery and the event is processed again
      releaseEvent(key)
      console.error(`Error processing ${event.event}:`, error.message)
      res.writeHead(500)
      res.end('Processing failed')
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
  if (SANDBOX_MODE) {
    console.log('Mode: sandbox — sandbox events are processed. Remove APIPAY_SANDBOX_MODE once the organization works in production mode')
  } else {
    console.log('Mode: production — sandbox events are discarded. Set APIPAY_SANDBOX_MODE=true while testing in the sandbox')
  }
  console.log('\nWaiting for webhook events...')
})
