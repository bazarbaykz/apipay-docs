#!/usr/bin/env python3
"""
ApiPay.kz - Partner API: Merchant Onboarding Example

Onboards a merchant end-to-end: create the organization, authorize the Kaspi
cashier (SMS-based), and issue the merchant's API key.

The flow has two phases because the cashier receives an SMS code:
  1. First run  — creates the org and sends the SMS:
       PARTNER_KEY=pk_... CASHIER_PHONE=77001234567 python partner_onboarding.py
  2. Second run — finishes once the merchant gives you the code:
       PARTNER_KEY=pk_... ORG_ID=50 OTP=1234 python partner_onboarding.py
"""

import os
import sys
import requests

PARTNER_KEY = os.environ.get('PARTNER_KEY')
BASE_URL = 'https://api.apipay.kz'


def api(method: str, path: str, body: dict = None) -> dict:
    """Send a Partner API request."""
    response = requests.request(
        method,
        f'{BASE_URL}{path}',
        headers={
            'X-Partner-Key': PARTNER_KEY,
            'Content-Type': 'application/json'
        },
        json=body
    )

    data = response.json()
    if not response.ok or data.get('success') is False:
        reason = data.get('error') or data.get('message') or 'Unknown error'
        raise Exception(f'API Error ({response.status_code}): {reason}')
    return data


def start_onboarding(cashier_phone: str, external_id: str):
    """Phase 1: create the organization and start cashier authorization."""
    print('1. Creating merchant organization...')
    organization = api('POST', '/api/partner/organizations',
                        {'external_id': external_id})['organization']
    print(f"   organization id: {organization['id']}")

    print('2. Starting Kaspi cashier authorization...')
    api('POST', f"/api/partner/organizations/{organization['id']}/kaspi-auth/init")

    print('3. Sending the cashier phone — Kaspi will text an SMS code...')
    api('POST', f"/api/partner/organizations/{organization['id']}/kaspi-auth/send-phone",
        {'cashier_phone': cashier_phone})

    print('\nSMS sent. Ask the merchant for the code, then run again:')
    print(f"  PARTNER_KEY=... ORG_ID={organization['id']} OTP=<code> python partner_onboarding.py")


def finish_onboarding(org_id: str, otp: str, webhook_url: str):
    """Phase 2: confirm the SMS code and issue the merchant's API key."""
    print('4. Verifying the SMS code...')
    verified = api('POST', f'/api/partner/organizations/{org_id}/kaspi-auth/verify-otp',
                   {'otp': otp})
    print(f"   cashier connected, organization status: {verified['organization']['status']}")

    print('5. Issuing the merchant API key...')
    key = api('POST', f'/api/partner/organizations/{org_id}/api-key',
              {'name': 'CRM key', 'webhook_url': webhook_url})

    print('\nOnboarding complete!')
    print('--------------------')
    print(f"X-API-Key:      {key['key']}")
    print(f"Webhook secret: {key['webhook_secret']}")
    print(f"Webhook review: {key.get('webhook_review_status')}")
    if key.get('webhook_review_status') == 'pending_review':
        print('  Notifications are held until the webhook URL is approved.')
    print('\nStore the key securely — it is shown only once.')
    print('Use it as X-API-Key for the regular API to create invoices for this merchant.')


def main():
    if not PARTNER_KEY:
        print('Error: PARTNER_KEY environment variable is required')
        sys.exit(1)

    try:
        if os.environ.get('OTP') and os.environ.get('ORG_ID'):
            finish_onboarding(
                os.environ['ORG_ID'],
                os.environ['OTP'],
                'https://your-crm.example.com/webhooks/kaspi'
            )
        else:
            start_onboarding(
                os.environ.get('CASHIER_PHONE', '77001234567'),
                'crm-client-42'
            )
    except Exception as e:
        print(f'Error: {e}')
        sys.exit(1)


if __name__ == '__main__':
    main()
