<?php
// Messages API endpoints
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../lib/utils.php';
require_once __DIR__ . '/../../middleware/AuthMiddleware.php';
require_once __DIR__ . '/../../lib/MessageUtils.php';

// Check if database connection is available
if (!$pdo) {
    sendResponse(false, "Database connection failed. Please check server configuration.");
}

// Get the request method
$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        handleGetMessages();
        break;
        
    case 'POST':
        handleSendMessage();
        break;
        
    case 'PUT':
        handleUpdateMessage();
        break;
        
    case 'DELETE':
        handleDeleteMessage();
        break;
        
    default:
        sendResponse(false, "Method not allowed");
}

function handleGetMessages() {
    global $pdo;
    
    // Authenticate request
    $user = authenticateRequest($pdo);
    if (!$user) {
        sendResponse(false, "Authentication required");
    }
    
    // Get parameters from query string
    $chatId = isset($_GET['chat_id']) ? (int)validateInput($_GET['chat_id']) : null;
    $userId = isset($_GET['user_id']) ? (int)validateInput($_GET['user_id']) : null; // This refers to the 'id' field in the users table
    $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 50;
    $offset = isset($_GET['offset']) ? (int)$_GET['offset'] : 0;
    
    // Verify that the authenticated user is the same as the user in the request
    if ($user['id'] != $userId) {
        sendResponse(false, "User ID mismatch");
    }
    
    if (!$chatId || !$userId) {
        sendResponse(false, "Chat ID and User ID are required");
    }
    
    try {
        // Check if user is in chat
        if (!isUserInChat($pdo, $userId, $chatId)) {
            sendResponse(false, "User is not a participant in this chat");
        }
        
        // Get messages
        $stmt = $pdo->prepare("
            SELECT m.*, u.username as sender_name 
            FROM messages m 
            JOIN users u ON m.sender_id = u.id 
            WHERE m.chat_id = ? AND m.is_deleted_for_everyone = 0
            ORDER BY m.sent_at ASC 
            LIMIT ? OFFSET ?
        ");
        $stmt->execute([$chatId, $limit, $offset]);
        $messages = $stmt->fetchAll();
        
        // Mark messages as read for this user (except messages sent by this user)
        foreach ($messages as $message) {
            if ($message['sender_id'] != $userId) {
                sendReceipt($pdo, $message['id'], $userId, 'seen');
            }
        }
        
        // Add status information to each message
        foreach ($messages as &$message) {
            // Get message status for this user
            $stmt = $pdo->prepare("
                SELECT receipt_type as status 
                FROM message_receipts 
                WHERE message_id = ? AND user_id = ?
                ORDER BY received_at DESC 
                LIMIT 1
            ");
            $stmt->execute([$message['id'], $userId]);
            $receipt = $stmt->fetch();
            
            $message['status'] = $receipt ? $receipt['status'] : 'sent';
        }
        
        // Extract message IDs to check favorite status
        $messageIds = array_map(function($message) {
            return (int)$message['id'];
        }, $messages);
        
        // Check which messages are favorited
        $favoritedIds = checkFavoriteStatus($pdo, $userId, $messageIds);
        
        // Add status information to each message
        foreach ($messages as &$message) {
            // Get message status for this user
            $stmt = $pdo->prepare(
                "SELECT receipt_type as status 
                FROM message_receipts 
                WHERE message_id = ? AND user_id = ?
                ORDER BY received_at DESC 
                LIMIT 1"
            );
            $stmt->execute([$message['id'], $userId]);
            $receipt = $stmt->fetch();
            
            $message['status'] = $receipt ? $receipt['status'] : 'sent';
            
            // Add favorite status
            $message['is_favorited'] = in_array((int)$message['id'], $favoritedIds);
        }
        
        sendResponse(true, "Messages retrieved successfully", $messages);
    } catch (Exception $e) {
        error_log("Error retrieving messages: " . $e->getMessage());
        sendResponse(false, "Error retrieving messages: " . $e->getMessage());
    }
}

// Helper function to check if messages are favorited
function checkFavoriteStatus($pdo, $userId, $messageIds) {
    if (empty($messageIds)) {
        return [];
    }
    
    $placeholders = str_repeat('?,', count($messageIds) - 1) . '?';
    $sql = "SELECT message_id FROM favorites WHERE user_id = ? AND message_id IN ($placeholders)";
    $stmt = $pdo->prepare($sql);
    $params = array_merge([$userId], $messageIds);
    $stmt->execute($params);
    
    $favoritedIds = [];
    while ($row = $stmt->fetch()) {
        $favoritedIds[] = (int)$row['message_id'];
    }
    
    return $favoritedIds;
}

function handleSendMessage() {
    global $pdo;
    
    // Authenticate request
    $user = authenticateRequest($pdo);
    if (!$user) {
        sendResponse(false, "Authentication required");
    }
    
    // Get JSON input
    $input = json_decode(file_get_contents('php://input'), true);
    
    $chatId = isset($input['chat_id']) ? (int)validateInput($input['chat_id']) : null;
    $senderId = isset($input['sender_id']) ? (int)validateInput($input['sender_id']) : null; // This refers to the 'id' field in the users table
    $messageText = isset($input['message_text']) ? validateInput($input['message_text']) : '';
    $messageType = isset($input['message_type']) ? validateInput($input['message_type']) : 'text';
    $fileUrl = isset($input['file_url']) ? validateInput($input['file_url']) : null;
    $fileName = isset($input['file_name']) ? validateInput($input['file_name']) : null;
    $fileSize = isset($input['file_size']) ? (int)$input['file_size'] : null;
    
    // Verify that the authenticated user is the same as the sender
    if ($user['id'] != $senderId) {
        sendResponse(false, "User ID mismatch");
    }
    
    // For text messages, require message text. For other types, it's optional.
    if ($messageType === 'text' && empty($messageText)) {
        sendResponse(false, "Message Text is required for text messages");
    }
    
    if (!$chatId || !$senderId) {
        sendResponse(false, "Chat ID and Sender ID are required");
    }
    
    try {
        // Check if user is in chat
        if (!isUserInChat($pdo, $senderId, $chatId)) {
            sendResponse(false, "User is not a participant in this chat");
        }
        
        // Insert message
        if ($messageType === 'image' && $fileUrl) {
            // For image messages, include file information
            $stmt = $pdo->prepare("
                INSERT INTO messages (chat_id, sender_id, message_text, message_type, file_url, file_name, file_size, sent_at) 
                VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
            ");
            $stmt->execute([$chatId, $senderId, $messageText, $messageType, $fileUrl, $fileName, $fileSize]);
        } else {
            // For text messages
            $stmt = $pdo->prepare("
                INSERT INTO messages (chat_id, sender_id, message_text, message_type, sent_at) 
                VALUES (?, ?, ?, ?, NOW())
            ");
            $stmt->execute([$chatId, $senderId, $messageText, $messageType]);
        }
        
        // Get the created message ID
        $messageId = $pdo->lastInsertId();
        
        // Get the created message with sender info
        $stmt = $pdo->prepare("
            SELECT m.*, u.username as sender_name 
            FROM messages m 
            JOIN users u ON m.sender_id = u.id 
            WHERE m.id = ?
        ");
        $stmt->execute([$messageId]);
        $message = $stmt->fetch();
        
        // Send delivery receipts to other participants
        $stmt = $pdo->prepare("
            SELECT user_id FROM chat_participants 
            WHERE chat_id = ? AND user_id != ?
        ");
        $stmt->execute([$chatId, $senderId]);
        $participants = $stmt->fetchAll();
        
        foreach ($participants as $participant) {
            sendReceipt($pdo, $messageId, $participant['user_id'], 'delivered');
        }
        
        // Add default status
        $message['status'] = 'sent';
        
        // Send push notifications to participants (except sender)
        sendMessageNotifications($pdo, $chatId, $senderId, $message);
        
        sendResponse(true, "Message sent successfully", $message);
    } catch (Exception $e) {
        sendResponse(false, "Error sending message: " . $e->getMessage());
    }
}

function sendFirebaseNotificationToUser($fcmToken, $title, $body, $data = []) {
    // Use the new FCM client
    require_once __DIR__ . '/../../lib/fcm_client.php';
    
    $result = sendFirebaseNotification($fcmToken, $title, $body, $data, true, true);
    
    return $result['success'];
}

function handleUpdateMessage() {
    global $pdo;
    
    // Authenticate request
    $user = authenticateRequest($pdo);
    if (!$user) {
        sendResponse(false, "Authentication required");
    }
    
    // Get JSON input
    $input = json_decode(file_get_contents('php://input'), true);
    
    $messageId = isset($input['message_id']) ? (int)validateInput($input['message_id']) : null;
    $userId = isset($input['user_id']) ? (int)validateInput($input['user_id']) : null; // This refers to the 'id' field in the users table
    $messageText = isset($input['message_text']) ? validateInput($input['message_text']) : null;
    
    // Verify that the authenticated user is the same as the user in the request
    if ($user['id'] != $userId) {
        sendResponse(false, "User ID mismatch");
    }
    
    if (!$messageId || !$userId || !$messageText) {
        sendResponse(false, "Message ID, User ID, and Message Text are required");
    }
    
    try {
        // Check if user is admin of the chat containing this message
        $stmt = $pdo->prepare("
            SELECT cp.chat_id 
            FROM messages m
            JOIN chat_participants cp ON m.chat_id = cp.chat_id
            WHERE m.id = ? AND cp.user_id = ? AND cp.is_admin = 1
        ");
        $stmt->execute([$messageId, $userId]);
        $result = $stmt->fetch();
        
        if (!$result) {
            sendResponse(false, "User is not authorized to edit this message");
        }
        
        // Update message
        $stmt = $pdo->prepare("
            UPDATE messages 
            SET message_text = ?, edited_at = NOW()
            WHERE id = ?
        ");
        $stmt->execute([$messageText, $messageId]);
        
        // Get the updated message
        $stmt = $pdo->prepare("
            SELECT m.*, u.username as sender_name 
            FROM messages m 
            JOIN users u ON m.sender_id = u.id 
            WHERE m.id = ?
        ");
        $stmt->execute([$messageId]);
        $message = $stmt->fetch();
        
        // Add default status
        $message['status'] = 'read';
        
        sendResponse(true, "Message updated successfully", $message);
    } catch (Exception $e) {
        sendResponse(false, "Error updating message: " . $e->getMessage());
    }
}

function handleDeleteMessage() {
    global $pdo;
    
    // Authenticate request
    $user = authenticateRequest($pdo);
    if (!$user) {
        sendResponse(false, "Authentication required");
    }
    
    // Get JSON input
    $input = json_decode(file_get_contents('php://input'), true);
    
    $messageId = isset($input['message_id']) ? (int)validateInput($input['message_id']) : null;
    $userId = isset($input['user_id']) ? (int)validateInput($input['user_id']) : null; // This refers to the 'id' field in the users table
    $deleteForEveryone = isset($input['delete_for_everyone']) ? (bool)$input['delete_for_everyone'] : false;
    
    // Verify that the authenticated user is the same as the user in the request
    if ($user['id'] != $userId) {
        sendResponse(false, "User ID mismatch");
    }
    
    if (!$messageId || !$userId) {
        sendResponse(false, "Message ID and User ID are required");
    }
    
    try {
        // Check if user is the sender of the message or an admin
        $stmt = $pdo->prepare("
            SELECT m.sender_id, cp.is_admin
            FROM messages m
            JOIN chat_participants cp ON m.chat_id = cp.chat_id
            WHERE m.id = ? AND cp.user_id = ?
        ");
        $stmt->execute([$messageId, $userId]);
        $result = $stmt->fetch();
        
        if (!$result) {
            sendResponse(false, "Message not found or user is not a participant in this chat");
        }
        
        // For "delete for everyone", only allow if user is the sender or an admin
        if ($deleteForEveryone && $result['sender_id'] != $userId && !$result['is_admin']) {
            sendResponse(false, "User is not authorized to delete this message for everyone");
        }
        
        if ($deleteForEveryone) {
            // Delete message for everyone (just update the status, don't change the text)
            $stmt = $pdo->prepare("
                UPDATE messages 
                SET is_deleted_for_everyone = 1
                WHERE id = ?
            ");
            $stmt->execute([$messageId]);
            sendResponse(true, "Message deleted for everyone");
        } else {
            // Delete message for current user only
            $stmt = $pdo->prepare("
                UPDATE messages 
                SET is_deleted_for_me = 1
                WHERE id = ?
            ");
            $stmt->execute([$messageId]);
            sendResponse(true, "Message deleted for you");
        }
    } catch (Exception $e) {
        sendResponse(false, "Error deleting message: " . $e->getMessage());
    }
}



?>