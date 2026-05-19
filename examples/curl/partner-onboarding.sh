#!/bin/bash
#
# ApiPay.kz - Partner API: Merchant Onboarding (cURL)
#
# Onboards a merchant end-to-end via the Partner API. The cashier receives an
# SMS code, so steps 3 and 4 are split — collect the code from the merchant
# between them. The init process_id is valid for 10 minutes.
#
# Usage:
#   export PARTNER_KEY="pk_your_partner_key_here"
#   ./partner-onboarding.sh
#
# Or run individual commands by copying them.

PARTNER_KEY="${PARTNER_KEY:-pk_your_partner_key_here}"
BASE_URL="https://bpapi.bazarbay.site"

echo "ApiPay.kz Partner API - Merchant Onboarding"
echo "==========================================="
echo ""

echo "1. Create merchant organization"
echo "-------------------------------"
echo 'curl -X POST $BASE_URL/api/partner/organizations \'
echo '  -H "X-Partner-Key: $PARTNER_KEY" \'
echo '  -H "Content-Type: application/json" \'
echo '  -d '\''{"external_id": "crm-client-42"}'\'
echo '# response: { "success": true, "organization": { "id": 50, ... } }'
echo ""

echo "2. Start Kaspi cashier authorization"
echo "------------------------------------"
echo 'curl -X POST $BASE_URL/api/partner/organizations/50/kaspi-auth/init \'
echo '  -H "X-Partner-Key: $PARTNER_KEY"'
echo '# response: { "success": true, "process_id": "..." }  (valid 10 minutes)'
echo ""

echo "3. Send the cashier phone (Kaspi texts an SMS code)"
echo "---------------------------------------------------"
echo 'curl -X POST $BASE_URL/api/partner/organizations/50/kaspi-auth/send-phone \'
echo '  -H "X-Partner-Key: $PARTNER_KEY" \'
echo '  -H "Content-Type: application/json" \'
echo '  -d '\''{"cashier_phone": "77001234567"}'\'
echo ""

echo "4. Verify the SMS code (collect it from the merchant)"
echo "-----------------------------------------------------"
echo 'curl -X POST $BASE_URL/api/partner/organizations/50/kaspi-auth/verify-otp \'
echo '  -H "X-Partner-Key: $PARTNER_KEY" \'
echo '  -H "Content-Type: application/json" \'
echo '  -d '\''{"otp": "1234"}'\'
echo ""

echo "5. Issue the merchant API key + webhook"
echo "---------------------------------------"
echo 'curl -X POST $BASE_URL/api/partner/organizations/50/api-key \'
echo '  -H "X-Partner-Key: $PARTNER_KEY" \'
echo '  -H "Content-Type: application/json" \'
echo '  -d '\''{"name": "CRM key", "webhook_url": "https://your-crm.example.com/webhooks/kaspi"}'\'
echo '# response includes "key" (X-API-Key) and "webhook_secret" — shown once'
echo ""

echo "Other endpoints"
echo "---------------"
echo 'curl "$BASE_URL/api/partner/organizations?per_page=25&page=1" -H "X-Partner-Key: $PARTNER_KEY"'
echo 'curl $BASE_URL/api/partner/organizations/50 -H "X-Partner-Key: $PARTNER_KEY"'
echo 'curl $BASE_URL/api/partner/organizations/50/kaspi-auth/status -H "X-Partner-Key: $PARTNER_KEY"'
echo 'curl -X DELETE $BASE_URL/api/partner/organizations/50 -H "X-Partner-Key: $PARTNER_KEY"'
echo ""

echo "==========================================="
echo "Done! After onboarding, use the merchant's X-API-Key with the"
echo "regular API (\$BASE_URL/api/v1) to create invoices on their behalf."
