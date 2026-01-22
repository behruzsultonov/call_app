<?php
// Enable error reporting for debugging
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Chat notification settings API endpoints
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../lib/utils.php';
require_once __DIR__ . '/../../middleware/AuthMiddleware.php';

// Check if database connection is available
if (!$pdo) {
    error_log("Database connection failed in notification settings API");
    sendResponse(false, "Database connection failed. Please check server configuration.");
    exit;
}

// Get the request method
$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        handleGetChatNotificationSetting();
        break;
        
    case 'POST':
        handleSetChatNotificationSetting();
        break;
        
    default:
        sendResponse(false, "Method not allowed");
        exit;
}

/**
 * Get notification setting for a specific chat
 */
function handleGetChatNotificationSetting() {
    global $pdo;
    
    error_log("Starting handleGetChatNotificationSetting");
    
    // Authenticate request
    $user = authenticateRequest($pdo);
    error_log("User authentication result: " . ($user ? "success" : "failed"));
    if (!$user) {
        sendResponse(false, "Authentication required");
        exit;
    }
    
    // Get parameters from query string
    $userId = isset($_GET['user_id']) ? (int)validateInput($_GET['user_id']) : null;
    $chatId = isset($_GET['chat_id']) ? (int)validateInput($_GET['chat_id']) : null;
    
    error_log("Parameters - userId: $userId, chatId: $chatId, authenticated user id: " . $user['id']);
    
    // Verify that the authenticated user is the same as the user in the request
    if ($user['id'] != $userId) {
        sendResponse(false, "User ID mismatch");
                exit;
    }
    
    if (!$userId || !$chatId) {
        sendResponse(false, "User ID and Chat ID are required");
                exit;
    }
    
    try {
        // Check if user is in chat
        if (!isUserInChat($pdo, $userId, $chatId)) {
            sendResponse(false, "User is not a participant in this chat");
                        exit;
        }
        
        // Get notification setting
        $stmt = $pdo->prepare("
            SELECT notifications_enabled 
            FROM chat_notification_settings 
            WHERE user_id = ? AND chat_id = ?
        ");
        $stmt->execute([$userId, $chatId]);
        $setting = $stmt->fetch();
        
        // If no setting exists, return default (enabled)
        $isEnabled = $setting ? (bool)$setting['notifications_enabled'] : true;
        
        sendResponse(true, "Notification setting retrieved successfully", [
            'chat_id' => $chatId,
            'notifications_enabled' => $isEnabled
        ]);
    } catch (Exception $e) {
        error_log("Error retrieving chat notification setting: " . $e->getMessage());
        sendResponse(false, "Error retrieving notification setting: " . $e->getMessage());
        exit;
    }
}

/**
 * Set notification setting for a specific chat
 */
function handleSetChatNotificationSetting() {
    global $pdo;
    
    error_log("Starting handleSetChatNotificationSetting");
    
    // Authenticate request
    $user = authenticateRequest($pdo);
    error_log("Set - User authentication result: " . ($user ? "success" : "failed"));
    if (!$user) {
        sendResponse(false, "Authentication required");
        exit;
    }
    
    // Get JSON input
    $input = json_decode(file_get_contents('php://input'), true);
    error_log("JSON input: " . print_r($input, true));
    
    $userId = isset($input['user_id']) ? (int)validateInput($input['user_id']) : null;
    $chatId = isset($input['chat_id']) ? (int)validateInput($input['chat_id']) : null;
    $notificationsEnabled = isset($input['notifications_enabled']) ? (bool)$input['notifications_enabled'] : true;
    
    // Verify that the authenticated user is the same as the user in the request
    if ($user['id'] != $userId) {
        sendResponse(false, "User ID mismatch");
                exit;
    }
    
    if (!$userId || !$chatId) {
        sendResponse(false, "User ID and Chat ID are required");
                exit;
    }
    
    try {
        // Check if user is in chat
        if (!isUserInChat($pdo, $userId, $chatId)) {
            sendResponse(false, "User is not a participant in this chat");
                        exit;
        }
        
        // Upsert notification setting
        $stmt = $pdo->prepare("
            INSERT INTO chat_notification_settings (user_id, chat_id, notifications_enabled)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE 
            notifications_enabled = VALUES(notifications_enabled),
            updated_at = CURRENT_TIMESTAMP
        ");
        $result = $stmt->execute([$userId, $chatId, $notificationsEnabled ? 1 : 0]);
        
        if ($result) {
            sendResponse(true, "Notification setting updated successfully", [
                'chat_id' => $chatId,
                'notifications_enabled' => $notificationsEnabled
            ]);
        } else {
            sendResponse(false, "Failed to update notification setting");
        }
    } catch (Exception $e) {
        error_log("Error updating chat notification setting: " . $e->getMessage());
        sendResponse(false, "Error updating notification setting: " . $e->getMessage());
        exit;
    }
}



?>
