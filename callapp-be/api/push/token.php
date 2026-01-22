<?php
// Push token management API
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../lib/utils.php';
require_once __DIR__ . '/../../middleware/AuthMiddleware.php';

// Check if database connection is available
if (!$pdo) {
    sendResponse(false, "Database connection failed. Please check server configuration.");
}

// Get the request method
$method = $_SERVER['REQUEST_METHOD'];

if ($method !== 'POST') {
    sendResponse(false, "Method not allowed. Use POST method.");
}

// Authenticate request
$user = authenticateRequest($pdo);
if (!$user) {
    sendResponse(false, "Authentication required");
}

// Get JSON input
$input = json_decode(file_get_contents('php://input'), true);

$fcmToken = isset($input['fcm_token']) ? validateInput($input['fcm_token']) : null;
$platform = isset($input['platform']) ? validateInput($input['platform']) : 'android';

if (!$fcmToken) {
    sendResponse(false, "FCM token is required");
}

try {
    // Update user's FCM token
    $stmt = $pdo->prepare("UPDATE users SET fcm_token = ?, updated_at = NOW() WHERE id = ?");
    $result = $stmt->execute([$fcmToken, $user['id']]);
    
    if ($result) {
        sendResponse(true, "FCM token updated successfully");
    } else {
        sendResponse(false, "Failed to update FCM token");
    }
} catch (Exception $e) {
    error_log("Error updating FCM token: " . $e->getMessage());
    sendResponse(false, "Error updating FCM token: " . $e->getMessage());
}

?>