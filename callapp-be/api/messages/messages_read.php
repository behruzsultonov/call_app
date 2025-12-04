<?php
// Messages read endpoint - marks messages as read
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../lib/utils.php';

// Check if database connection is available
if (!$pdo) {
    sendResponse(false, "Database connection failed. Please check server configuration.");
}

// Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendResponse(false, "Method not allowed");
}

// Get JSON input
$input = json_decode(file_get_contents('php://input'), true);

$messageId = isset($input['message_id']) ? (int)$input['message_id'] : null;
$userId = isset($input['user_id']) ? (int)validateInput($input['user_id']) : null; // This refers to the 'id' field in the users table

if (!$messageId || !$userId) {
    sendResponse(false, "Message ID and User ID are required");
}

try {
    // Mark message as read
    sendReceipt($pdo, $messageId, $userId, 'seen');
    
    sendResponse(true, "Message marked as read successfully");
} catch (Exception $e) {
    sendResponse(false, "Error marking message as read: " . $e->getMessage());
}
?>