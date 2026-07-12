// Проверить, зарегистрирован ли номер в Kaspi, перед созданием счёта.
// Не использовать для массового перебора номеров — приведёт к блокировке организации.

const API_KEY = process.env.APIPAY_API_KEY || 'YOUR_API_KEY'
const BASE_URL = 'https://api.apipay.kz/api/v1'

async function checkClient(phone) {
  const res = await fetch(`${BASE_URL}/clients/check`, {
    method: 'POST',
    headers: {
      'X-API-Key': API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ phone })
  })

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${await res.text()}`)
  }

  return res.json()
}

const result = await checkClient('77001234567')
// { phone: '87001234567', has_kaspi: true, client_name: 'Иван И.' }

if (!result.has_kaspi) {
  console.error('Клиент не зарегистрирован в Kaspi — попросите другой номер')
} else {
  console.log(`Выставить счёт: ${result.client_name} (${result.phone})`)
}
