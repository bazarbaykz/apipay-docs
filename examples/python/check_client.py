"""
Проверить, зарегистрирован ли номер в Kaspi, перед созданием счёта.
Не использовать для массового перебора номеров — приведёт к блокировке организации.
"""

import os
import requests

API_KEY = os.environ.get("APIPAY_API_KEY", "YOUR_API_KEY")
BASE_URL = "https://api.apipay.kz/api/v1"


def check_client(phone: str) -> dict:
    response = requests.post(
        f"{BASE_URL}/clients/check",
        headers={
            "X-API-Key": API_KEY,
            "Content-Type": "application/json",
        },
        json={"phone": phone},
    )
    response.raise_for_status()
    return response.json()


if __name__ == "__main__":
    result = check_client("77001234567")
    # {'phone': '87001234567', 'has_kaspi': True, 'client_name': 'Иван И.'}

    if not result["has_kaspi"]:
        print("Клиент не зарегистрирован в Kaspi — попросите другой номер")
    else:
        print(f"Выставить счёт: {result['client_name']} ({result['phone']})")
