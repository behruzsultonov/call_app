<?php
// Utility functions for the chat backend

function sendResponse($success, $message, $data = null) {
    // Debug: Log response data
    error_log("Sending response: success=" . ($success ? 'true' : 'false') . ", message=" . $message);
    error_log("Response data: " . print_r($data, true));
    
    header('Content-Type: application/json');
    $response = [
        'success' => $success,
        'message' => $message,
        'data' => $data
    ];
    error_log("Full response: " . json_encode($response));
    echo json_encode($response);
    exit;
}

function validateInput($input) {
    return htmlspecialchars(trim($input));
}

// Check if user is in chat
// $userId refers to the 'id' field in the users table
function isUserInChat($pdo, $userId, $chatId) {
    // Check if database connection is available
    if (!$pdo) {
        return false;
    }
    
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM chat_participants WHERE user_id = ? AND chat_id = ?");
    $stmt->execute([$userId, $chatId]);
    return $stmt->fetchColumn() > 0;
}

// Get user by ID
// $userId refers to the 'id' field in the users table
function getUserById($pdo, $userId) {
    // Check if database connection is available
    if (!$pdo) {
        return false;
    }
    
    $stmt = $pdo->prepare("SELECT id, username, phone_number, avatar FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    return $stmt->fetch();
}

// Get chat by ID
function getChatById($pdo, $chatId) {
    // Check if database connection is available
    if (!$pdo) {
        return false;
    }
    
    $stmt = $pdo->prepare("SELECT * FROM chats WHERE id = ?");
    $stmt->execute([$chatId]);
    return $stmt->fetch();
}

// Check if user is admin of chat
// $userId refers to the 'id' field in the users table
function isUserAdmin($pdo, $userId, $chatId) {
    // Check if database connection is available
    if (!$pdo) {
        return false;
    }
    
    $stmt = $pdo->prepare("SELECT is_admin FROM chat_participants WHERE user_id = ? AND chat_id = ?");
    $stmt->execute([$userId, $chatId]);
    $result = $stmt->fetch();
    return $result && $result['is_admin'];
}

// Send message receipt
// $userId refers to the 'id' field in the users table
function sendReceipt($pdo, $messageId, $userId, $receiptType = 'seen') {
    // Check if database connection is available
    if (!$pdo) {
        return;
    }
    
    // Insert or update receipt
    $stmt = $pdo->prepare("
        INSERT INTO message_receipts (message_id, user_id, receipt_type) 
        VALUES (?, ?, ?) 
        ON DUPLICATE KEY UPDATE received_at = CURRENT_TIMESTAMP
    ");
    $stmt->execute([$messageId, $userId, $receiptType]);
}
?>