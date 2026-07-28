<?php
/**
 * Проверить, зарегистрирован ли номер в Kaspi, перед созданием счёта.
 * Массовый перебор номеров запрещён: при использовании не по назначению ключ может быть
 * деактивирован без предупреждения.
 */

$apiKey = getenv('APIPAY_API_KEY') ?: 'YOUR_API_KEY';
$baseUrl = 'https://api.apipay.kz/api/v1';

function checkClient(string $phone, string $apiKey, string $baseUrl): array
{
    $ch = curl_init($baseUrl . '/clients/check');

    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => [
            'X-API-Key: ' . $apiKey,
            'Content-Type: application/json',
        ],
        CURLOPT_POSTFIELDS => json_encode(['phone' => $phone]),
        CURLOPT_RETURNTRANSFER => true,
    ]);

    $body = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($status >= 400) {
        throw new RuntimeException("HTTP $status: $body");
    }

    return json_decode($body, true);
}

$result = checkClient('77001234567', $apiKey, $baseUrl);
// ['phone' => '87001234567', 'has_kaspi' => true, 'client_name' => 'Иван И.']

if (!$result['has_kaspi']) {
    fwrite(STDERR, "Клиент не зарегистрирован в Kaspi — попросите другой номер\n");
} else {
    echo "Выставить счёт: {$result['client_name']} ({$result['phone']})\n";
}
