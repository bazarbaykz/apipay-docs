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
# INVOICES
# =====================================================

# NOTE: Organization verification is done via Dashboard → Verification
# Complete verification before using the API

echo "1. Create Invoice"
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

echo "2. List Invoices"
echo "----------------"
echo 'curl "$BASE_URL/invoices?page=1&per_page=20&status[]=paid" \'
echo '  -H "X-API-Key: $API_KEY"'
echo ""

echo "3. Get Invoice"
echo "--------------"
echo 'curl $BASE_URL/invoices/42 \'
echo '  -H "X-API-Key: $API_KEY"'
echo ""

echo "4. Cancel Invoice"
echo "-----------------"
echo 'curl -X POST $BASE_URL/invoices/42/cancel \'
echo '  -H "X-API-Key: $API_KEY"'
echo ""

# =====================================================
# REFUNDS
# =====================================================

echo "5. Full Refund"
echo "--------------"
echo 'curl -X POST $BASE_URL/invoices/42/refund \'
echo '  -H "X-API-Key: $API_KEY" \'
echo '  -H "Content-Type: application/json" \'
echo '  -d '\''{"reason": "Customer request"}'\'
echo ""

echo "6. Partial Refund"
echo "-----------------"
echo 'curl -X POST $BASE_URL/invoices/42/refund \'
echo '  -H "X-API-Key: $API_KEY" \'
echo '  -H "Content-Type: application/json" \'
echo '  -d '\''{"amount": 5000, "reason": "Partial return"}'\'
echo ""

echo "7. List Refunds"
echo "---------------"
echo 'curl $BASE_URL/refunds \'
echo '  -H "X-API-Key: $API_KEY"'
echo ""

# =====================================================
# RECURRING INVOICES
# =====================================================

echo "8. Create Recurring Invoice"
echo "---------------------------"
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

echo "9. Pause Recurring Invoice"
echo "--------------------------"
echo 'curl -X POST $BASE_URL/recurring-invoices/1/pause \'
echo '  -H "X-API-Key: $API_KEY"'
echo ""

echo "10. Resume Recurring Invoice"
echo "----------------------------"
echo 'curl -X POST $BASE_URL/recurring-invoices/1/resume \'
echo '  -H "X-API-Key: $API_KEY"'
echo ""

echo "11. Cancel Recurring Invoice"
echo "----------------------------"
echo 'curl -X POST $BASE_URL/recurring-invoices/1/cancel \'
echo '  -H "X-API-Key: $API_KEY"'
echo ""

echo "12. Bill Now (Immediate)"
echo "------------------------"
echo 'curl -X POST $BASE_URL/recurring-invoices/1/bill-now \'
echo '  -H "X-API-Key: $API_KEY"'
echo ""

echo "13. Skip Period"
echo "---------------"
echo 'curl -X POST $BASE_URL/recurring-invoices/1/skip-period \'
echo '  -H "X-API-Key: $API_KEY"'
echo ""

echo "======================"
echo "Done! Copy and paste the commands above to test the API."
echo "Remember to set your API_KEY environment variable first."
