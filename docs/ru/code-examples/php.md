# PHP

Пример на чистом PHP с расширением cURL — без зависимостей и composer.
Ключ читается из переменной окружения `APIPAY_API_KEY`: не храните его в коде
и не коммитьте в репозиторий.

## Создание счёта

```php
<?php

$apiKey  = getenv('APIPAY_API_KEY');
$baseUrl = 'https://api.apipay.kz/api/v1';

if ($apiKey === false || $apiKey === '') {
    fwrite(STDERR, "Не задана переменная окружения APIPAY_API_KEY\n");
    exit(1);
}

$payload = [
    'amount'            => 10000,           // сумма в тенге
    'phone_number'      => '87001234567',   // телефон клиента, формат 8XXXXXXXXXX
    'description'       => 'Оплата заказа #123',
    'external_order_id' => 'order_123',     // ваш ID заказа для сопоставления
];

$ch = curl_init($baseUrl . '/invoices');
curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_HTTPHEADER     => [
        'X-API-Key: ' . $apiKey,
        'Content-Type: application/json',
        'Accept: application/json',
    ],
    CURLOPT_POSTFIELDS     => json_encode($payload, JSON_UNESCAPED_UNICODE),
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 30,
]);

$response  = curl_exec($ch);
$httpCode  = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

if ($response === false) {
    fwrite(STDERR, "Запрос не ушёл: {$curlError}\n");
    exit(1);
}

$invoice = json_decode($response, true);
if (!is_array($invoice)) {
    $invoice = [];
}

if ($httpCode >= 400) {
    // Стабильный snake_case-код лежит в error_code, у части ответов — в error.
    // На 422 от валидатора полей error_code не приходит вовсе: там только
    // message и объект errors с разбивкой по полям — поэтому нужен запасной.
    $code = $invoice['error_code'] ?? $invoice['error'] ?? 'error';

    fwrite(STDERR, "HTTP {$httpCode}, код: {$code}\n");
    fwrite(STDERR, ($invoice['message'] ?? 'Неизвестная ошибка') . "\n");

    foreach ($invoice['errors'] ?? [] as $field => $messages) {
        fwrite(STDERR, "  {$field}: " . implode('; ', (array) $messages) . "\n");
    }

    exit(1);
}

echo "Счёт №{$invoice['id']} создан, статус: {$invoice['status']}\n";
```

Запуск:

```bash
APIPAY_API_KEY=your_api_key php create-invoice.php
```

## Ветвление по ошибке

Логику стройте по коду, а не по тексту `message` — текст может меняться:

```php
switch ($code) {
    case 'client_not_found':
        // Номер не зарегистрирован в Kaspi — попросите другой, повтор не поможет.
        break;
    case 'kaspi_session_invalid':
    case 'kaspi_session_not_configured':
        // Кассир Kaspi не подключён или сессия сброшена — переподключите в кабинете.
        break;
    case 'kaspi_throttled':
    case 'network_unavailable':
        // Временная причина — создайте новый счёт через пару минут.
        break;
    default:
        // Остальное — в лог, вместе с $httpCode и телом ответа.
}
```

Полный список кодов — в разделе [Ошибки](../errors.md).

## Статус `processing` — это не отказ

Успешный ответ `POST /invoices` возвращает счёт в статусе `processing`: он
принят нами, но ещё не ушёл в Kaspi. Терминального ответа тут не будет —
дождитесь перехода в `pending` (счёт у клиента) или в `error` (отправить не
удалось, причина в `error_code` и `error_message`).

Узнать о переходе можно двумя способами: подписаться на вебхук
`invoice.status_changed` (см. [Вебхуки](../webhooks.md)) или опрашивать
`GET /invoices/{id}`. Пока счёт в `processing`, не создавайте его повторно —
получите второй счёт на ту же сумму. Если повтор запроса всё же возможен
(ретрай по таймауту сети), передавайте `external_order_id_idempotency`:
повторный вызов с тем же значением вернёт `409 duplicate_idempotency_key`
вместо второго счёта.

## Готовые примеры

Рабочие скрипты целиком лежат в [`examples/php/`](https://github.com/bazarbaykz/apipay-docs/tree/main/examples/php):

| Файл | Что показывает |
|------|----------------|
| `create-invoice.php` | Создание счёта |
| `check-client.php` | Проверка клиента по номеру телефона |
| `create-subscription.php` | Подписка (регулярные списания) |
| `manage-catalog.php` | Работа с каталогом товаров |
| `webhook-handler.php` | Приём и проверка подписи вебхука |
| `partner-onboarding.php` | Подключение организации через Partner API |
