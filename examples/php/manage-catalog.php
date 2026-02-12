<?php
/**
 * ApiPay.kz - Manage Catalog Example
 *
 * This example demonstrates how to manage catalog items:
 * upload images, create items, update and delete.
 *
 * Usage: API_KEY=your_key php manage-catalog.php
 */

$API_KEY = getenv('API_KEY');
$API_BASE_URL = 'https://bpapi.bazarbay.site/api/v1';

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

function createItems($items) {
    global $API_KEY, $API_BASE_URL;

    $ch = curl_init("{$API_BASE_URL}/catalog");
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => [
            "X-API-Key: {$API_KEY}",
            'Content-Type: application/json'
        ],
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
        ['name' => 'Coffee Latte', 'selling_price' => 1500, 'unit_id' => 1],
        ['name' => 'Cookie', 'selling_price' => 500, 'unit_id' => 1]
    ]);
    echo "Items created (202 Accepted — processing async)\n";

} catch (Exception $e) {
    echo "Error: {$e->getMessage()}\n";
    exit(1);
}
