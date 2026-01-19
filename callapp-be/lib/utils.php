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
    
    // Safely encode JSON to avoid errors
    $json_response = json_encode($response);
    if ($json_response === false) {
        // If JSON encoding fails, send a basic error response
        error_log("JSON encoding failed: " . json_last_error_msg());
        $json_response = json_encode([
            'success' => false,
            'message' => 'Internal server error: Response encoding failed',
            'data' => null
        ]);
    }
    
    error_log("Full response: " . $json_response);
    echo $json_response;
    exit;
}

function validateInput($input) {
    // Trim whitespace and handle UTF-8 characters properly
    // Use ENT_QUOTES | ENT_HTML5 flags to preserve emojis and other UTF-8 characters
    return htmlspecialchars(trim($input), ENT_QUOTES | ENT_HTML5, 'UTF-8');
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

// Get chat by ID with participants
function getChatWithParticipants($pdo, $chatId) {
    // Check if database connection is available
    if (!$pdo) {
        return false;
    }
    
    $stmt = $pdo->prepare(
        "SELECT 
            c.id,
            c.chat_name,
            c.chat_type,
            c.created_by,
            c.created_at,
            c.updated_at,
            c.is_deleted_for_everyone,
            c.is_deleted_for_me
        FROM chats c
        WHERE c.id = ?"
    );
    $stmt->execute([$chatId]);
    $chat = $stmt->fetch();
    
    if ($chat) {
        // Get participants for the chat
        $participantsStmt = $pdo->prepare(
            "SELECT 
                u.id,
                u.username,
                cp.is_admin,
                cp.joined_at,
                cp.left_at
            FROM chat_participants cp
            JOIN users u ON cp.user_id = u.id
            WHERE cp.chat_id = ?
            ORDER BY cp.joined_at ASC"
        );
        $participantsStmt->execute([$chatId]);
        $participants = $participantsStmt->fetchAll();
        
        $chat['participants'] = $participants;
    }
    
    return $chat;
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