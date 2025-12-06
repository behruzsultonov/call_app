<?php
// Chats API endpoints
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
        handleGetChats();
        break;
        
    case 'POST':
        handleCreateChat();
        break;
        
    case 'PUT':
        handleUpdateChat();
        break;
        
    case 'DELETE':
        handleDeleteChat();
        break;
        
    default:
        sendResponse(false, "Method not allowed");
}

function handleGetChats() {
    global $pdo;
    
    error_log("Handling get chats request");
    
    // Authenticate request
    $user = authenticateRequest($pdo);
    error_log("Authentication result: " . ($user ? 'success' : 'failed'));
    if (!$user) {
        sendResponse(false, "Authentication required");
    }
    
    $userId = $user['id'];
    error_log("User ID: " . $userId);
    
    try {
        
        // Simplified query to get chats for user
        $stmt = $pdo->prepare("
            SELECT 
                c.id,
                c.chat_name,
                c.chat_type
            FROM chats c
            JOIN chat_participants cp ON c.id = cp.chat_id
            WHERE cp.user_id = ?
            ORDER BY c.created_at DESC
        ");
        $stmt->execute([$userId]);
        $chats = $stmt->fetchAll();
        
        // Add last message info to each chat
        foreach ($chats as &$chat) {
            // Get last message for this chat
            $msgStmt = $pdo->prepare("
                SELECT message_text, sent_at, sender_id
                FROM messages 
                WHERE chat_id = ? AND is_deleted_for_everyone = 0
                ORDER BY sent_at DESC 
                LIMIT 1
            ");
            $msgStmt->execute([$chat['id']]);
            $lastMessage = $msgStmt->fetch();
            
            if ($lastMessage) {
                $chat['last_message'] = $lastMessage['message_text'];
                $chat['last_message_time'] = $lastMessage['sent_at'];
                $chat['last_message_sender_id'] = $lastMessage['sender_id'];
                
                // Get message status
                $statusStmt = $pdo->prepare("
                    SELECT receipt_type 
                    FROM message_receipts 
                    WHERE message_id = (
                        SELECT id FROM messages 
                        WHERE chat_id = ? AND is_deleted_for_everyone = 0
                        ORDER BY sent_at DESC 
                        LIMIT 1
                    ) AND user_id = ?
                    ORDER BY received_at DESC 
                    LIMIT 1
                ");
                $statusStmt->execute([$chat['id'], $userId]);
                $status = $statusStmt->fetch();
                $chat['last_message_status'] = $status ? $status['receipt_type'] : 'sent';
                
                // Get unread count
                $unreadStmt = $pdo->prepare("
                    SELECT COUNT(*) as unread_count
                    FROM messages m
                    LEFT JOIN message_receipts mr ON m.id = mr.message_id AND mr.user_id = ?
                    WHERE m.chat_id = ? 
                    AND m.sender_id != ? 
                    AND mr.id IS NULL
                    AND m.is_deleted_for_everyone = 0
                ");
                $unreadStmt->execute([$userId, $chat['id'], $userId]);
                $unread = $unreadStmt->fetch();
                $chat['unread_count'] = $unread ? (int)$unread['unread_count'] : 0;
            } else {
                $chat['last_message'] = '';
                $chat['last_message_time'] = null;
                $chat['last_message_sender_id'] = null;
                $chat['last_message_status'] = 'sent';
                $chat['unread_count'] = 0;
            }
        }
        
        sendResponse(true, "Chats retrieved successfully", $chats);
    } catch (Exception $e) {
        // Log the actual error for debugging
        error_log("Error retrieving chats: " . $e->getMessage());
        sendResponse(false, "Error retrieving chats: " . $e->getMessage());
    }
}

function handleCreateChat() {
    global $pdo;
    
    // Authenticate request
    $user = authenticateRequest($pdo);
    if (!$user) {
        sendResponse(false, "Authentication required");
    }
    
    // Get JSON input
    $input = json_decode(file_get_contents('php://input'), true);
    
    $chatName = isset($input['chat_name']) ? validateInput($input['chat_name']) : null;
    $chatType = isset($input['chat_type']) ? validateInput($input['chat_type']) : 'private';
    $createdBy = isset($input['created_by']) ? (int)validateInput($input['created_by']) : null; // This refers to the 'id' field in the users table
    $participants = isset($input['participants']) ? $input['participants'] : [];
    
    // Verify that the authenticated user is the same as the creator
    if ($user['id'] != $createdBy) {
        sendResponse(false, "User ID mismatch");
    }
    
    if (!$chatName || !$createdBy) {
        sendResponse(false, "Chat Name and Created By are required");
    }
    
    try {
        // Begin transaction
        $pdo->beginTransaction();
        
        // Insert chat
        $stmt = $pdo->prepare("
            INSERT INTO chats (chat_name, chat_type, created_by, created_at) 
            VALUES (?, ?, ?, NOW())
        ");
        $stmt->execute([$chatName, $chatType, $createdBy]);
        
        // Get the created chat ID
        $chatId = $pdo->lastInsertId();
        
        // Add creator as admin participant
        $stmt = $pdo->prepare("
            INSERT INTO chat_participants (chat_id, user_id, is_admin, joined_at) 
            VALUES (?, ?, 1, NOW())
        ");
        $stmt->execute([$chatId, $createdBy]);
        
        // Add other participants
        foreach ($participants as $participantId) {
            if ($participantId != $createdBy) { // Don't add creator again
                $stmt = $pdo->prepare("
                    INSERT INTO chat_participants (chat_id, user_id, is_admin, joined_at) 
                    VALUES (?, ?, 0, NOW())
                ");
                $stmt->execute([$chatId, (int)$participantId]);
            }
        }
        
        // Commit transaction
        $pdo->commit();
        
        // Get the created chat
        $chat = getChatById($pdo, $chatId);
        
        sendResponse(true, "Chat created successfully", $chat);
    } catch (Exception $e) {
        // Rollback transaction on error
        $pdo->rollback();
        sendResponse(false, "Error creating chat: " . $e->getMessage());
    }
}

function handleUpdateChat() {
    global $pdo;
    
    // Authenticate request
    $user = authenticateRequest($pdo);
    if (!$user) {
        sendResponse(false, "Authentication required");
    }
    
    // Get JSON input
    $input = json_decode(file_get_contents('php://input'), true);
    
    $chatId = isset($input['chat_id']) ? (int)validateInput($input['chat_id']) : null;
    $userId = isset($input['user_id']) ? (int)validateInput($input['user_id']) : null; // This refers to the 'id' field in the users table
    $chatName = isset($input['chat_name']) ? validateInput($input['chat_name']) : null;
    
    // Verify that the authenticated user is the same as the user in the request
    if ($user['id'] != $userId) {
        sendResponse(false, "User ID mismatch");
    }
    
    if (!$chatId || !$userId) {
        sendResponse(false, "Chat ID and User ID are required");
    }
    
    try {
        // Check if user is admin of the chat
        if (!isUserAdmin($pdo, $userId, $chatId)) {
            sendResponse(false, "User is not authorized to update this chat");
        }
        
        // Update chat
        $stmt = $pdo->prepare("
            UPDATE chats 
            SET chat_name = COALESCE(?, chat_name), updated_at = NOW()
            WHERE id = ?
        ");
        $stmt->execute([$chatName, $chatId]);
        
        // Get the updated chat
        $chat = getChatById($pdo, $chatId);
        
        sendResponse(true, "Chat updated successfully", $chat);
    } catch (Exception $e) {
        sendResponse(false, "Error updating chat: " . $e->getMessage());
    }
}

function handleDeleteChat() {
    global $pdo;
    
    // Authenticate request
    $user = authenticateRequest($pdo);
    if (!$user) {
        sendResponse(false, "Authentication required");
    }
    
    // Get JSON input
    $input = json_decode(file_get_contents('php://input'), true);
    
    $chatId = isset($input['chat_id']) ? (int)validateInput($input['chat_id']) : null;
    $userId = isset($input['user_id']) ? (int)validateInput($input['user_id']) : null; // This refers to the 'id' field in the users table
    
    // Verify that the authenticated user is the same as the user in the request
    if ($user['id'] != $userId) {
        sendResponse(false, "User ID mismatch");
    }
    
    if (!$chatId || !$userId) {
        sendResponse(false, "Chat ID and User ID are required");
    }
    
    try {
        // Check if user is admin of the chat
        if (!isUserAdmin($pdo, $userId, $chatId)) {
            sendResponse(false, "User is not authorized to delete this chat");
        }
        
        // Delete chat (will cascade delete related records)
        $stmt = $pdo->prepare("DELETE FROM chats WHERE id = ?");
        $stmt->execute([$chatId]);
        
        sendResponse(true, "Chat deleted successfully");
    } catch (Exception $e) {
        sendResponse(false, "Error deleting chat: " . $e->getMessage());
    }
}
?>