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

function createItems($items, $syncToken = null) {
    global $API_KEY, $API_BASE_URL;

    // sync_token marks every item the request mentions, including the ones that
    // needed no work. It is what a later bulk-delete uses to find the remainder.
    $payload = ['items' => $items];
    if ($syncToken !== null) {
        $payload['sync_token'] = $syncToken;
    }

    $ch = curl_init("{$API_BASE_URL}/catalog");
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => [
            "X-API-Key: {$API_KEY}",
            'Content-Type: application/json'
        ],
        CURLOPT_POSTFIELDS => json_encode($payload),
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

function bulkDelete($body) {
    global $API_KEY, $API_BASE_URL;

    $ch = curl_init("{$API_BASE_URL}/catalog/bulk-delete");
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => [
            "X-API-Key: {$API_KEY}",
            'Content-Type: application/json'
        ],
        CURLOPT_POSTFIELDS => json_encode($body),
        CURLOPT_RETURNTRANSFER => true
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $result = json_decode($response, true);

    if ($httpCode >= 400) {
        // reason narrows catalog_delete_filter_invalid / catalog_delete_scope_required.
        // The list of reason values is open - keep a generic branch.
        $code = $result['error_code'] ?? $result['error'] ?? 'unknown';
        $reason = isset($result['reason']) ? " ({$result['reason']})" : '';
        throw new Exception("Bulk delete error: {$code}{$reason}");
    }

    return $result;
}

/**
 * Upload the whole feed under one run marker, then remove what it did not touch.
 *
 * The deletion is a background operation that can run for a day: 202 means
 * "accepted", not "deleted" - watch poll_url or the catalog.batch_processed
 * webhook with kind: delete.
 *
 * The API key must be issued by the organization owner, otherwise the call is
 * refused with 403 catalog_delete_owner_key_required.
 */
function fullSync($syncToken, $items) {
    // 1. Upload every chunk of the run with the SAME sync_token.
    foreach (array_chunk($items, 100) as $chunk) {
        createItems($chunk, $syncToken);
    }

    // 2. Scout: how many items would be removed, and which ones.
    //    include_never_stamped also removes items that never took part in any run -
    //    those added by hand at the till or pulled in from the Kaspi catalog.
    $filter = ['sync_token_not' => $syncToken, 'include_never_stamped' => false];
    $preview = bulkDelete(['filter' => $filter, 'dry_run' => true]);
    echo "Would delete: {$preview['would_delete']}\n";

    if ($preview['would_delete'] === 0) {
        return null;
    }

    // 3. Confirm with the number from the dry run. A mismatch means the catalog
    //    changed in between: 409 catalog_bulk_delete_mismatch carries actual_count.
    return bulkDelete(['filter' => $filter, 'expected_count' => $preview['would_delete']]);
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

    // Full synchronization. Use one marker per run - a timestamp or a job id.
    // $sync = fullSync('run-2026-08-15-a', $wholeFeed);
    // if ($sync) { echo "Queued for removal: {$sync['queued']}\n"; }

} catch (Exception $e) {
    echo "Error: {$e->getMessage()}\n";
    exit(1);
}
