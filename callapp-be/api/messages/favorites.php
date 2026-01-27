<?php
// Favorites API endpoints
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../lib/utils.php';
require_once __DIR__ . '/../../middleware/AuthMiddleware.php';

// Check if database connection is available
if (!$pdo) {
    sendResponse(false, "Database connection failed. Please check server configuration.");
}

// Get the request method
$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        handleGetFavorites();
        break;
        
    case 'POST':
        handleFavoriteMessage();
        break;
        
    case 'DELETE':
        handleUnfavoriteMessage();
        break;
        
    default:
        sendResponse(false, "Method not allowed");
}

function handleGetFavorites() {
    global $pdo;
    
    // Authenticate request
    $user = authenticateRequest($pdo);
    if (!$user) {
        sendResponse(false, "Authentication required");
    }
    
    $userId = $user['id'];
    $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 50;
    $offset = isset($_GET['offset']) ? (int)$_GET['offset'] : 0;
    
    try {
        // Get favorite messages with message details and sender info
        $sql = "
            SELECT f.id as favorite_id, f.created_at as favorited_at, 
                   m.*, 
                   u.username as sender_name,
                   f.target_user_id
            FROM favorites f
            JOIN messages m ON f.message_id = m.id
            JOIN users u ON f.target_user_id = u.id
            WHERE f.user_id = ?
            ORDER BY f.created_at DESC
            LIMIT ? OFFSET ?
        ";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute([$userId, $limit, $offset]);
        $favorites = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Enhance with contact names where available
        foreach ($favorites as &$favorite) {
            $contactSql = "
                SELECT contact_name 
                FROM contacts 
                WHERE user_id = ? AND contact_user_id = ?
                LIMIT 1
            ";
            $contactStmt = $pdo->prepare($contactSql);
            $contactStmt->execute([$userId, $favorite['target_user_id']]);
            $contact = $contactStmt->fetch();
            
            if ($contact && !empty($contact['contact_name'])) {
                $favorite['sender_name'] = $contact['contact_name'];
            }
        }
        
        // Add status information to each message
        foreach ($favorites as &$favorite) {
            // Get message status for this user
            $stmt = $pdo->prepare("
                SELECT receipt_type as status 
                FROM message_receipts 
                WHERE message_id = ? AND user_id = ?
                ORDER BY received_at DESC 
                LIMIT 1
            ");
            $stmt->execute([$favorite['id'], $userId]);
            $receipt = $stmt->fetch();
            
            $favorite['status'] = $receipt ? $receipt['status'] : 'sent';
        }
        
        sendResponse(true, "Favorites retrieved successfully", $favorites);
    } catch (Exception $e) {
        error_log("Error retrieving favorites: " . $e->getMessage());
        sendResponse(false, "Error retrieving favorites: " . $e->getMessage());
    }
}

function handleFavoriteMessage() {
    global $pdo;
    
    // Authenticate request
    $user = authenticateRequest($pdo);
    if (!$user) {
        sendResponse(false, "Authentication required");
    }
    
    // Get JSON input
    $input = json_decode(file_get_contents('php://input'), true);
    
    $messageId = isset($input['message_id']) ? (int)validateInput($input['message_id']) : null;
    $userId = $user['id'];
    
    if (!$messageId) {
        sendResponse(false, "Message ID is required");
    }
    
    try {
        // Check if message exists and user has access to it
        $stmt = $pdo->prepare("
            SELECT m.id, m.sender_id 
            FROM messages m
            JOIN chat_participants cp ON m.chat_id = cp.chat_id
            WHERE m.id = ? AND cp.user_id = ?
        ");
        $stmt->execute([$messageId, $userId]);
        $message = $stmt->fetch();
        
        if (!$message) {
            sendResponse(false, "Message not found or you don't have access to it");
        }
        
        // Check if message is already favorited
        $stmt = $pdo->prepare("SELECT id FROM favorites WHERE user_id = ? AND message_id = ?");
        $stmt->execute([$userId, $messageId]);
        $existingFavorite = $stmt->fetch();
        
        if ($existingFavorite) {
            sendResponse(false, "Message is already favorited");
        }
        
        // Add message to favorites with target_user_id (the sender of the message)
        $stmt = $pdo->prepare("INSERT INTO favorites (user_id, target_user_id, message_id, created_at) VALUES (?, ?, ?, NOW())");
        $stmt->execute([$userId, $message['sender_id'], $messageId]);
        
        sendResponse(true, "Message added to favorites successfully");
    } catch (Exception $e) {
        error_log("Error favoriting message: " . $e->getMessage());
        sendResponse(false, "Error favoriting message: " . $e->getMessage());
    }
}

function handleUnfavoriteMessage() {
    global $pdo;
    
    // Authenticate request
    $user = authenticateRequest($pdo);
    if (!$user) {
        sendResponse(false, "Authentication required");
    }
    
    // Get JSON input
    $input = json_decode(file_get_contents('php://input'), true);
    
    $messageId = isset($input['message_id']) ? (int)validateInput($input['message_id']) : null;
    $userId = $user['id'];
    
    if (!$messageId) {
        sendResponse(false, "Message ID is required");
    }
    
    try {
        // Remove message from favorites
        $stmt = $pdo->prepare("DELETE FROM favorites WHERE user_id = ? AND message_id = ?");
        $stmt->execute([$userId, $messageId]);
        
        if ($stmt->rowCount() > 0) {
            sendResponse(true, "Message removed from favorites successfully");
        } else {
            sendResponse(false, "Message was not in favorites");
        }
    } catch (Exception $e) {
        error_log("Error unfavoriting message: " . $e->getMessage());
        sendResponse(false, "Error unfavoriting message: " . $e->getMessage());
    }
}
?>