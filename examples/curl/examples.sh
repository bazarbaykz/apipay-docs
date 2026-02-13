#!/bin/bash
#
# ApiPay.kz - cURL Examples (API v2)
#
# These examples demonstrate how to use the ApiPay.kz API with cURL.
#
# Usage:
#   export API_KEY="your_api_key"
#   ./examples.sh
#
# Or run individual commands by copying them.

API_KEY="${API_KEY:-your_api_key}"
BASE_URL="https://bpapi.bazarbay.site/api/v1"

echo "ApiPay.kz API v2 Examples"
echo "========================="
echo ""

# =====================================================
# INVOICES
# =====================================================

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

echo "2. Create Invoice with Cart Items"
echo "----------------------------------"
echo 'curl -X POST $BASE_URL/invoices \'
echo '  -H "X-API-Key: $API_KEY" \'
echo '  -H "Content-Type: application/json" \'
echo '  -d '\''{'
echo '    "phone_number": "87001234567",'
echo '    "cart_items": ['
echo '      {"catalog_item_id": 101, "count": 2},'
echo '      {"catalog_item_id": 205, "count": 3}'
echo '    ]'
echo '  }'\'
echo ""

echo "3. List Invoices"
echo "----------------"
echo 'curl "$BASE_URL/invoices?page=1&per_page=20&status[]=paid&sort_by=created_at&sort_order=desc" \'
echo '  -H "X-API-Key: $API_KEY"'
echo ""

echo "4. Get Invoice"
echo "--------------"
echo 'curl $BASE_URL/invoices/42 \'
echo '  -H "X-API-Key: $API_KEY"'
echo ""

echo "5. Cancel Invoice"
echo "-----------------"
echo 'curl -X POST $BASE_URL/invoices/42/cancel \'
echo '  -H "X-API-Key: $API_KEY"'
echo ""

echo "6. Check Invoice Statuses"
echo "-------------------------"
echo 'curl -X POST $BASE_URL/invoices/status/check \'
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
echo '  -d '\''{"amount": 5000, "reason": "Partial return"}'\/
echo ""

echo "9. List Refunds"
echo "---------------"
echo 'curl "$BASE_URL/refunds?status[]=completed&date_from=2025-01-01" \'
echo '  -H "X-API-Key: $API_KEY"'
echo ""

# =====================================================
# CATALOG
# =====================================================

echo "10. List Catalog Items"
echo "----------------------"
echo 'curl "$BASE_URL/catalog?page=1&per_page=50" \'
echo '  -H "X-API-Key: $API_KEY"'
echo ""

echo "11. Upload Catalog Image"
echo "------------------------"
echo 'curl -X POST $BASE_URL/catalog/upload-image \'
echo '  -H "X-API-Key: $API_KEY" \'
echo '  -F "image=@photo.jpg"'
echo ""

echo "12. Create Catalog Items (batch)"
echo "---------------------------------"
echo 'curl -X POST $BASE_URL/catalog \'
echo '  -H "X-API-Key: $API_KEY" \'
echo '  -H "Content-Type: application/json" \'
echo '  -d '\''{'
echo '    "items": ['
echo '      {"name": "Coffee Latte", "selling_price": 1500, "unit_id": 1, "image_id": "550e8400-..."},'
echo '      {"name": "Cookie", "selling_price": 500, "unit_id": 1}'
echo '    ]'
echo '  }'\'
echo ""

echo "13. Update Catalog Item"
echo "-----------------------"
echo 'curl -X PATCH $BASE_URL/catalog/101 \'
echo '  -H "X-API-Key: $API_KEY" \'
echo '  -H "Content-Type: application/json" \'
echo '  -d '\''{"name": "Updated Name", "selling_price": 2000}'\'
echo ""

echo "14. Delete Catalog Item"
echo "-----------------------"
echo 'curl -X DELETE $BASE_URL/catalog/101 \'
echo '  -H "X-API-Key: $API_KEY"'
echo ""

# =====================================================
# SUBSCRIPTIONS
# =====================================================

echo "15. Create Subscription"
echo "-----------------------"
echo 'curl -X POST $BASE_URL/subscriptions \'
echo '  -H "X-API-Key: $API_KEY" \'
echo '  -H "Content-Type: application/json" \'
echo '  -d '\''{'
echo '    "amount": 5000,'
echo '    "phone_number": "87001234567",'
echo '    "billing_period": "monthly",'
echo '    "billing_day": 1,'
echo '    "subscriber_name": "John Doe",'
echo '    "description": "Monthly subscription"'
echo '  }'\/
echo ""

echo "16. List Subscriptions"
echo "----------------------"
echo 'curl "$BASE_URL/subscriptions?status=active" \'
echo '  -H "X-API-Key: $API_KEY"'
echo ""

echo "17. Pause Subscription"
echo "----------------------"
echo 'curl -X POST $BASE_URL/subscriptions/1/pause \'
echo '  -H "X-API-Key: $API_KEY"'
echo ""

echo "18. Resume Subscription"
echo "-----------------------"
echo 'curl -X POST $BASE_URL/subscriptions/1/resume \'
echo '  -H "X-API-Key: $API_KEY"'
echo ""

echo "19. Cancel Subscription"
echo "-----------------------"
echo 'curl -X POST $BASE_URL/subscriptions/1/cancel \'
echo '  -H "X-API-Key: $API_KEY"'
echo ""

echo "========================="
echo "Done! Copy and paste the commands above to test the API."
echo "Remember to set your API_KEY environment variable first."
