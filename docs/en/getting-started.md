# Getting Started

## Prerequisites

Start in the sandbox: it needs neither the business profile nor a cashier.

1. **Sign up** at [apipay.kz/login](https://apipay.kz/login) — log in with your phone number via WhatsApp. A new organization is created in the sandbox: invoices do not go to Kaspi, money does not move.
2. **Get an API key** in Settings → Connection. The key is the same for the sandbox and production mode — switching the mode does not change it.
3. **Build and test the integration in the sandbox** — payment, cancellation, expiry, error, refund and refund refusal, repeated webhook delivery. How to request each outcome — [Sandbox](sandbox.md).
4. **Switch the organization to production mode** — business profile, Kaspi cashier, tariff and the switch, see [Path to production mode](#path-to-production-mode).

## Configuration

| Parameter | Value |
|-----------|-------|
| Base URL | `https://api.apipay.kz/api/v1` |
| Authentication | Header `X-API-Key: your_api_key` |
| Content-Type | `application/json` |
| Rate Limit | 200 requests/minute per API key. Separate endpoints: `POST /clients/check` — 60/min and 10,000/day, `POST /invoices/qr` — 200/min per organization, `GET /invoices/{id}` — 1000/min, `POST /invoices/bulk` — 20/min, `POST /catalog/scan` — 30/min and 2000/day |

## First Invoice

```bash
curl -X POST https://api.apipay.kz/api/v1/invoices \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"amount": 10000, "phone_number": "87001234567"}'
```

Response:
```json
{
  "id": 124,
  "amount": "10000.00",
  "status": "processing",
  "paid_at": null,
  "phone": "87001234567",
  "is_imported": false,
  "created_at": "2026-01-15T10:00:00+00:00"
}
```

The customer receives a notification in the Kaspi app and can pay. In the sandbox, payment is simulated by `POST /invoices/{invoice}/simulate-status` with `{"status": "paid"}`.

## Path to production mode

The order: **sandbox → business profile → profile review → Kaspi cashier → tariff → switch to production mode.** All of this is done by a person in the dashboard.

### 1. Business profile

A short "Расскажите о вашем бизнесе" (tell us about your business) form (~5 minutes in the dashboard, `/business-profile`): what you sell, where you sell, the approximate average ticket, a link to the point of sale and screenshots. The organization name and BIN or IIN are entered by the owner. The profile data is used to set limits that match your turnover. ApiPay reviews the profile; the review status is visible in the dashboard.

Until the profile is approved, production invoices are not issued at all: the very first `POST /invoices` (as well as `POST /invoices/qr` and subscription invoices) returns `429 kyc_daily_limit_reached` — `meta.limit` is `0`, and `meta.reset_at` is the daily window. Waiting for a new window does not help: the restriction is lifted by approval. In the sandbox this restriction does not apply. If the organization has a `kyc_deadline` in the future (grace), the restriction does not apply until the deadline.

### 2. Kaspi cashier

⛔ A cashier cannot be connected before the profile is approved: `POST /connections/{id}/auth/init` and `POST /connections/{id}/auth/send-phone` return `403 kyc_required`, and no SMS is sent to the cashier.

After approval — the wizard in the dashboard: [apipay.kz/connect-cashier](https://apipay.kz/connect-cashier) (Settings → Kaspi Authorization). It takes 2–3 minutes: add an employee number with the **"Cashier"** role in the Kaspi Pay app (Settings → Employees), enter that number in the wizard and confirm the SMS code. Detailed guide (in Russian) — ["How to connect your Kaspi cashier"](https://apipay.kz/guides/podklyuchenie-kassira-kaspi).

> **Important:** after linking, do not log in to the Kaspi Pay app with the cashier's number — the session will break and the cashier will have to be connected again.
>
> If the wizard does not work, we will help manually: [support WhatsApp (+7 700 307 65 12)](https://wa.me/77003076512).

### 3. Tariff and switch

Pay the tariff in the dashboard and switch the organization to production mode (Settings, the "Переключить в рабочий режим" (switch to production mode) button; Owner and Developer roles). On the switch, the organization's sandbox data is deleted — test invoices, refunds, refund links to buyers, subscriptions and catalog items; export what you need beforehand. Payment links and printed QR sheets from the sandbox are not deleted and stay test ones — issue new ones for buyers in production mode and switch the old ones off. After the switch, the same API key issues real invoices. After the switch, `GET /account/health` returns `mode: production`.

Before the switch:

- for organizations not yet approved, the production webhook must be on a real domain — IP addresses and tunnels (ngrok) are rejected (see [Webhooks](webhooks.md));
- remove `simulate` and the sandbox magic numbers from production code;
- in production mode, after verifying the signature, discard events with `is_sandbox: true` at the body root: respond `2xx` and do not act on them. An event about a sandbox object sent before the organization switched to production mode may arrive after the switch. More — [Webhooks](webhooks.md).

## Connecting with an AI assistant

The integration can be delegated to an AI assistant (Claude Code, Codex, Cursor and others). The sandbox comes first, without real money.

**With MCP.** The ["Подключить с ИИ"](https://apipay.kz/setup/ai) (connect with AI) screen in the dashboard (Settings → Connection) gives a ready configuration for your AI client. The service address is `https://mcp.apipay.kz/mcp`, the server name is `apipay-setup`. For Claude Code:

```bash
claude mcp add --transport http --scope user apipay-setup 'https://mcp.apipay.kz/mcp'
claude mcp login apipay-setup
```

Then tell the assistant: «Встрой apipay.» ("Integrate apipay."). The assistant leads the connection step by step: studies the project, asks the missing questions, writes the code and checks the required outcomes in the sandbox. The sandbox checks run after you sign in to ApiPay in the browser; signing in to ApiPay from Cursor is not supported — the assistant only has the documentation search and the connection plan. The API key is not used to sign in to MCP and is not added to the AI client settings.

**Without MCP.** Give the assistant the short instruction [apipay.kz/SKILL.md](https://apipay.kz/SKILL.md) and the playbook [apipay.kz/for-ai.md](https://apipay.kz/for-ai.md). Ready server code by payment method and stack — [recipes](https://apipay.kz/recipes/index.md), machine-readable — [apipay-recipes.json](https://apipay.kz/apipay-recipes.json).

What stays with the person:

- issuing the key and the webhook signing secret — the person puts the values into the server's environment variables, they are not shared in the chat;
- the business profile: the assistant can prepare a draft, but the organization name, BIN or IIN, screenshots and submission are done by the person. The assistant does not promise a review time — the status is visible in the dashboard;
- the Kaspi cashier with the SMS code, paying the tariff and switching to production mode.

The assistant's access is granted on the consent screen: the person ticks the organizations the assistant will work with. A production organization is available to the assistant only with a separate permission — Settings → "Кто имеет доступ к организации" (who has access to the organization) → "ИИ-агенты" (AI agents); access is revoked there too. After the organization switches to production mode, this permission has to be granted again.

> ⚠️ ApiPay has no ready-made SDK. Packages named `apipay` on npm and similar names on PyPI and Packagist have nothing to do with ApiPay.kz — do not install them.

## What's Next?

- [Invoices](invoices.md) — Create, list, cancel, cart items, payment link
- [Clients](clients.md) — Check a number before issuing an invoice
- [Subscriptions](subscriptions.md) — Automatic invoicing on a schedule
- [Catalog](catalog.md) — Product management
- [Refunds](refunds.md) — Full and partial refunds, link fallback
- [Fiscal Receipts](receipts.md) — Receipts via Kaspi OFD
- [Webhooks](webhooks.md) — Payment notifications
- [Sandbox](sandbox.md) — Scenarios, outcomes and errors without real money
- [Error Codes](errors.md) — Error handling
- [Partner API](partner-api.md) — Connecting client organizations
