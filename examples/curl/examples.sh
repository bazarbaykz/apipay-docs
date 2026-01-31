#!/bin/bash
#
# ApiPay.kz - cURL Examples
#
# These examples demonstrate how to use the ApiPay.kz API with cURL.
#
# Usage:
#   export API_KEY="your_api_key"
#   ./examples.sh
#
# Or run individual commands by copying them.

API_KEY="${API_KEY:-your_api_key}"
BASE_URL="https://bpapi.bazarbay.site/api"

echo "ApiPay.kz API Examples"
echo "======================"
echo ""

# =====================================================
# ORGANIZATION VERIFICATION
# =====================================================

echo "1. Start Organization Verification"
echo "-----------------------------------"
echo 'curl -X POST $BASE_URL/organizations/verify \'
echo '  -H "X-API-Key: $API_KEY" \'
echo '  -H "Content-Type: application/json" \'
echo '  -d '\''{"idn": "123456789012"}'\'
echo ""

# Actual command (uncomment to run):
# curl -X POST "$BASE_URL/organizations/verify" \
#   -H "X-API-Key: $API_KEY" \
#   -H "Content-Type: application/json" \
#   -d '{"idn": "123456789012"}'

echo "2. Check Verification Status"
echo "----------------------------"
echo 'curl $BASE_URL/organizations/1/status \'
echo '  -H "X-API-Key: $API_KEY"'
echo ""

# =====================================================
# INVOICES
# =====================================================

echo "3. Create Invoice"
echo "-----------------"
echo 'curl -X POST $BASE_URL/invoices \'
echo '  -H "X-API-Key: $API_KEY" \'
echo '  -H "Content-Type: application/json" \'
echo '  -d '\''{'
echo '    "amount": 10000,'
echo '    "phone_number": "87001234567",'
echo '    "description": "Order #123",'
echo '    "external_order_id": "order_123"'
echo '  }'\'
echo ""

# Actual command (uncomment to run):
# curl -X POST "$BASE_URL/invoices" \
#   -H "X-API-Key: $API_KEY" \
#   -H "Content-Type: application/json" \
#   -d '{
#     "amount": 10000,
#     "phone_number": "87001234567",
#     "description": "Order #123",
#     "external_order_id": "order_123"
#   }'

echo "4. List Invoices"
echo "----------------"
echo 'curl "$BASE_URL/invoices?page=1&per_page=20&status[]=paid" \'
echo '  -H "X-API-Key: $API_KEY"'
echo ""

echo "5. Get Invoice"
echo "--------------"
echo 'curl $BASE_URL/invoices/42 \'
echo '  -H "X-API-Key: $API_KEY"'
echo ""

echo "6. Cancel Invoice"
echo "-----------------"
echo 'curl -X POST $BASE_URL/invoices/42/cancel \'
echo '  -H "X-API-Key: $API_KEY"'
echo ""

# =====================================================
# REFUNDS
# =====================================================

echo "7. Full Refund"
echo "--------------"
echo 'curl -X POST $BASE_URL/invoices/42/refund \'
echo '  -H "X-API-Key: $API_KEY" \'
echo '  -H "Content-Type: application/json" \'
echo '  -d '\''{"reason": "Customer request"}'\'
echo ""

echo "8. Partial Refund"
echo "-----------------"
echo 'curl -X POST $BASE_URL/invoices/42/refund \'
echo '  -H "X-API-Key: $API_KEY" \'
echo '  -H "Content-Type: application/json" \'
echo '  -d '\''{"amount": 5000, "reason": "Partial return"}'\'
echo ""

echo "9. List Refunds"
echo "---------------"
echo 'curl $BASE_URL/refunds \'
echo '  -H "X-API-Key: $API_KEY"'
echo ""

# =====================================================
# RECURRING INVOICES
# =====================================================

echo "10. Create Recurring Invoice"
echo "----------------------------"
echo 'curl -X POST $BASE_URL/recurring-invoices \'
echo '  -H "X-API-Key: $API_KEY" \'
echo '  -H "Content-Type: application/json" \'
echo '  -d '\''{'
echo '    "amount": 5000,'
echo '    "phone_number": "87001234567",'
echo '    "description": "Monthly subscription",'
echo '    "interval": "monthly"'
echo '  }'\'
echo ""

echo "11. Pause Recurring Invoice"
echo "---------------------------"
echo 'curl -X POST $BASE_URL/recurring-invoices/1/pause \'
echo '  -H "X-API-Key: $API_KEY"'
echo ""

echo "12. Resume Recurring Invoice"
echo "----------------------------"
echo 'curl -X POST $BASE_URL/recurring-invoices/1/resume \'
echo '  -H "X-API-Key: $API_KEY"'
echo ""

echo "13. Cancel Recurring Invoice"
echo "----------------------------"
echo 'curl -X POST $BASE_URL/recurring-invoices/1/cancel \'
echo '  -H "X-API-Key: $API_KEY"'
echo ""

echo "14. Bill Now (Immediate)"
echo "------------------------"
echo 'curl -X POST $BASE_URL/recurring-invoices/1/bill-now \'
echo '  -H "X-API-Key: $API_KEY"'
echo ""

echo "15. Skip Period"
echo "---------------"
echo 'curl -X POST $BASE_URL/recurring-invoices/1/skip-period \'
echo '  -H "X-API-Key: $API_KEY"'
echo ""

echo "======================"
echo "Done! Copy and paste the commands above to test the API."
echo "Remember to set your API_KEY environment variable first."
