<?php
/**
 * ApiPay.kz - Manage Catalog Example
 *
 * This example demonstrates how to manage catalog items:
 * list the catalog, create items and read the per-item rejected[] result.
 * uploadImage() below is a helper for POST /catalog/upload-image.
 *
 * Usage: API_KEY=your_key php manage-catalog.php
 */

$API_KEY = getenv('API_KEY');
$API_BASE_URL = 'https://api.apipay.kz/api/v1';

function uploadImage($filePath) {
    global $API_KEY, $API_BASE_URL;

    $ch = curl_init("{$API_BASE_URL}/catalog/upload-image");
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => ["X-API-Key: {$API_KEY}"],
        CURLOPT_POSTFIELDS => ['image' => new CURLFile($filePath)],
        CURLOPT_RETURNTRANSFER => true
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $result = json_decode($response, true);

    if ($httpCode >= 400) {
        throw new Exception("Upload Error: " . ($result['message'] ?? 'Unknown error'));
    }

    return $result;
}

/**
 * Create catalog items (batch, 1-100 items per request).
 *
 * The answer is always 202 "accepted": in production the items get status
 * pending and are pushed to Kaspi afterwards. An exact repeat under the same
 * Idempotency-Key answers 200 with idempotent_replay: true.
 */
function createItems($items, $idempotencyKey = null) {
    global $API_KEY, $API_BASE_URL;

    $headers = [
        "X-API-Key: {$API_KEY}",
        'Content-Type: application/json'
    ];
    if ($idempotencyKey !== null) {
        $headers[] = "Idempotency-Key: {$idempotencyKey}";
    }

    $ch = curl_init("{$API_BASE_URL}/catalog");
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_POSTFIELDS => json_encode(['items' => $items]),
        CURLOPT_RETURNTRANSFER => true
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $result = json_decode($response, true);

    if ($httpCode >= 400) {
        throw new Exception("Create Error: " . ($result['message'] ?? 'Unknown error'));
    }

    return $result;
}

/**
 * Catalog queue remainder: total (create), updating and deleting counters.
 *
 * There is no overall handle for a bulk operation, so this endpoint plus
 * GET /catalog/errors is how you follow the work through.
 */
function queueStatus() {
    global $API_KEY, $API_BASE_URL;

    $ch = curl_init("{$API_BASE_URL}/catalog/queue");
    curl_setopt_array($ch, [
        CURLOPT_HTTPHEADER => ["X-API-Key: {$API_KEY}"],
        CURLOPT_RETURNTRANSFER => true
    ]);

    $response = curl_exec($ch);
    curl_close($ch);

    return json_decode($response, true);
}

/**
 * Failed catalog operations. The window filters by failed_at; without $from
 * the last 7 days are returned.
 */
function listErrors($from = null, $to = null) {
    global $API_KEY, $API_BASE_URL;

    $query = array_filter(['from' => $from, 'to' => $to], fn($v) => $v !== null);
    $url = "{$API_BASE_URL}/catalog/errors";
    if ($query) {
        $url .= '?' . http_build_query($query);
    }

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_HTTPHEADER => ["X-API-Key: {$API_KEY}"],
        CURLOPT_RETURNTRANSFER => true
    ]);

    $response = curl_exec($ch);
    curl_close($ch);

    return json_decode($response, true);
}

/**
 * Bulk-delete catalog items (POST, not DELETE: 1C clients handle a body poorly).
 *
 * The body takes exactly one target list: ids[] or external_refs[], up to 200
 * values. There is no filter mode - the integrator builds the removal list.
 */
function bulkDelete($body, $idempotencyKey = null) {
    global $API_KEY, $API_BASE_URL;

    $headers = [
        "X-API-Key: {$API_KEY}",
        'Content-Type: application/json'
    ];
    if ($idempotencyKey !== null) {
        $headers[] = "Idempotency-Key: {$idempotencyKey}";
    }

    $ch = curl_init("{$API_BASE_URL}/catalog/bulk-delete");
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_POSTFIELDS => json_encode($body),
        CURLOPT_RETURNTRANSFER => true
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $result = json_decode($response, true);

    if ($httpCode >= 400) {
        // catalog_delete_scope_required  - no list, or both lists at once.
        // catalog_match_overflow         - more than 200 values in the list.
        // catalog_bulk_delete_mismatch   - expected_count no longer matches; the
        //                                  body carries actual_count and nothing
        //                                  was deleted.
        $code = $result['error_code'] ?? $result['error'] ?? 'unknown';
        throw new Exception("Bulk delete error: {$code}");
    }

    return $result;
}

/**
 * Upload the current feed, then remove the items you know are gone.
 *
 * The removal list is yours to build: the server cannot tell an interrupted
 * export from an honest shrink of the catalog, so it will not guess a
 * destructive set for you.
 *
 * The deletion is a background operation that can run for a day: 202 means
 * "accepted", not "deleted". There is no overall handle - follow the work
 * through GET /catalog/queue, targeted GET /catalog?external_refs[]=,
 * GET /catalog/errors and the per-item catalog.item_processed webhook.
 *
 * The API key must be issued by the organization owner, otherwise the call is
 * refused with 403 catalog_delete_owner_key_required.
 */
function fullSync($items, $goneExternalRefs) {
    // 1. Upload the current catalog, 100 items per request.
    foreach (array_chunk($items, 100) as $chunk) {
        createItems($chunk);
    }

    // 2. Remove the items that are gone, in chunks of 200 or fewer.
    $results = [];
    foreach (array_chunk($goneExternalRefs, 200) as $chunk) {
        // 2a. Scout: how many items would be removed, and which ones.
        $preview = bulkDelete(['external_refs' => $chunk, 'dry_run' => true]);
        echo "Would delete: {$preview['would_delete']}\n";

        if ($preview['would_delete'] === 0) {
            continue;
        }

        // 2b. Confirm with the number from the dry run and a UNIQUE key per
        //     chunk. A mismatch means the set changed in between: 409
        //     catalog_bulk_delete_mismatch carries actual_count, nothing is
        //     deleted, repeat the dry run.
        $results[] = bulkDelete(
            ['external_refs' => $chunk, 'expected_count' => $preview['would_delete']],
            'catalog-sync-' . bin2hex(random_bytes(16))
        );
    }

    return $results;
}

function listItems($page = 1, $perPage = 50) {
    global $API_KEY, $API_BASE_URL;

    $ch = curl_init("{$API_BASE_URL}/catalog?page={$page}&per_page={$perPage}");
    curl_setopt_array($ch, [
        CURLOPT_HTTPHEADER => ["X-API-Key: {$API_KEY}"],
        CURLOPT_RETURNTRANSFER => true
    ]);

    $response = curl_exec($ch);
    curl_close($ch);

    return json_decode($response, true);
}

if (!$API_KEY) {
    echo "Error: API_KEY environment variable is required\n";
    echo "Usage: API_KEY=your_key php manage-catalog.php\n";
    exit(1);
}

try {
    // List existing items
    echo "Fetching catalog...\n";
    $catalog = listItems();
    echo "Found {$catalog['meta']['total']} items\n";

    // Create new items (without image)
    echo "\nCreating catalog items...\n";
    $result = createItems([
        ['name' => 'Coffee Latte', 'selling_price' => 1500, 'unit_id' => 1, 'external_ref' => 'SKU-LATTE'],
        ['name' => 'Cookie', 'selling_price' => 500, 'unit_id' => 1, 'external_ref' => 'SKU-COOKIE']
    ]);

    // Валидация по позициям: битая позиция не роняет батч, она приходит в rejected[].
    // rejected[] есть в ответе всегда — проверяйте его, иначе часть каталога не зальётся.
    $rejected = $result['rejected'] ?? [];
    echo 'Accepted: ' . count($result['data'] ?? []) . ', rejected: ' . count($rejected) . "\n";
    foreach ($rejected as $item) {
        echo "  item #{$item['index']}: {$item['error_code']} — {$item['error_message']}\n";
    }
    // Production: позиции создаются в статусе pending, синхронизация в Kaspi асинхронная.
    // Sandbox: позиции активны сразу. Итог сверяйте через GET /catalog?external_refs[]=...

    // Сколько работы ещё не закрыто. total — создание, updating — правки, ждущие
    // подтверждения Kaspi, deleting — снятие.
    $queue = queueStatus();
    echo "\nQueue: {$queue['total']} to create, {$queue['updating']} updating, "
        . "{$queue['deleting']} deleting (state: {$queue['queue']['state']})\n";

    // Что отказало за последние 7 дней.
    $failures = listErrors();
    echo "Failed operations: {$failures['total']}\n";
    foreach (array_slice($failures['data'], 0, 5) as $row) {
        echo "  {$row['external_ref']}: {$row['operation']} -> {$row['error_code']}"
            . " at {$row['failed_at']}\n";
    }

    // Полная синхронизация: залить актуальное и снять то, чего больше нет.
    // $sync = fullSync($wholeFeed, ['1C-000123', '1C-000124']);
    // foreach ($sync as $chunk) { echo "Queued for removal: {$chunk['queued']}\n"; }

} catch (Exception $e) {
    echo "Error: {$e->getMessage()}\n";
    exit(1);
}
