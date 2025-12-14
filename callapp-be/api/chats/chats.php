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

// Check for special actions
$action = isset($_GET['action']) ? $_GET['action'] : '';
$subaction = isset($_GET['subaction']) ? $_GET['subaction'] : '';

if ($action === 'chats' && $subaction === 'check_private') {
    handleCheckPrivateChat();
} else {
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
        
        // Query to get chats for user, excluding deleted chats
        $stmt = $pdo->prepare("
            SELECT 
                c.id,
                c.chat_name,
                c.chat_type,
                c.created_by,
                c.is_deleted_for_everyone
            FROM chats c
            JOIN chat_participants cp ON c.id = cp.chat_id
            LEFT JOIN chat_deletion_status cds ON c.id = cds.chat_id AND cp.user_id = cds.user_id
            WHERE cp.user_id = ?
            AND (c.is_deleted_for_everyone = 0 OR c.is_deleted_for_everyone IS NULL)
            AND (cds.is_deleted_for_me IS NULL OR cds.is_deleted_for_me = 0)
            ORDER BY c.created_at DESC
        ");
        $stmt->execute([$userId]);
        $chats = $stmt->fetchAll();
        
        // Add last message info and participant names to each chat
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
            
            // For private chats, get the other participant's name
            if ($chat['chat_type'] === 'private') {
                $participantStmt = $pdo->prepare("
                    SELECT u.username, u.id
                    FROM chat_participants cp
                    JOIN users u ON cp.user_id = u.id
                    WHERE cp.chat_id = ? AND cp.user_id != ?
                    LIMIT 1
                ");
                $participantStmt->execute([$chat['id'], $userId]);
                $participant = $participantStmt->fetch();
                
                if ($participant) {
                    $chat['other_participant_name'] = $participant['username'];
                    $chat['other_participant_id'] = $participant['id'];
                }
            }
        }
        
        sendResponse(true, "Chats retrieved successfully", $chats);
    } catch (Exception $e) {
        // Log the actual error for debugging
        error_log("Error retrieving chats: " . $e->getMessage());
        sendResponse(false, "Error retrieving chats: " . $e->getMessage());
    }
}

function handleCheckPrivateChat() {
    global $pdo;
    
    error_log("Handling check private chat request");
    
    // Authenticate request
    $user = authenticateRequest($pdo);
    error_log("Authentication result: " . ($user ? 'success' : 'failed'));
    if (!$user) {
        sendResponse(false, "Authentication required");
    }
    
    $userId = $user['id'];
    $otherUserId = isset($_GET['other_user_id']) ? (int)$_GET['other_user_id'] : null;
    
    error_log("Checking for existing chat between user $userId and $otherUserId");
    
    if (!$otherUserId) {
        sendResponse(false, "Other user ID is required");
    }
    
    try {
        // Check if a private chat already exists between these two users
        $existingChat = getPrivateChatBetweenUsers($pdo, $userId, $otherUserId);
        
        if ($existingChat) {
            sendResponse(true, "Existing chat found", $existingChat);
        } else {
            sendResponse(false, "No existing chat found");
        }
    } catch (Exception $e) {
        error_log("Error checking for existing private chat: " . $e->getMessage());
        sendResponse(false, "Error checking for existing chat: " . $e->getMessage());
    }
}

// Add a new function to check if a private chat exists between two users
function getPrivateChatBetweenUsers($pdo, $user1Id, $user2Id) {
    try {
        // Validate that both users exist
        $userCheckStmt = $pdo->prepare("SELECT id FROM users WHERE id = ?");
        $userCheckStmt->execute([$user1Id]);
        $user1Exists = $userCheckStmt->fetch();
        
        if (!$user1Exists) {
            return null;
        }
        
        $userCheckStmt = $pdo->prepare("SELECT id FROM users WHERE id = ?");
        $userCheckStmt->execute([$user2Id]);
        $user2Exists = $userCheckStmt->fetch();
        
        if (!$user2Exists) {
            return null;
        }
        
        // First get all private chats for user1
        $stmt = $pdo->prepare("
            SELECT DISTINCT c.id, c.chat_name, c.chat_type
            FROM chats c
            JOIN chat_participants cp1 ON c.id = cp1.chat_id
            JOIN chat_participants cp2 ON c.id = cp2.chat_id
            WHERE c.chat_type = 'private'
            AND cp1.user_id = ?
            AND cp2.user_id = ?
        ");
        $stmt->execute([$user1Id, $user2Id]);
        $chat = $stmt->fetch();
        
        return $chat;
    } catch (Exception $e) {
        error_log("Error checking for existing private chat: " . $e->getMessage());
        return null;
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
        
        // Add other participants with validation
        foreach ($participants as $participantId) {
            if ($participantId != $createdBy) { // Don't add creator again
                // Validate that the user exists before adding them as a participant
                $userCheckStmt = $pdo->prepare("SELECT id FROM users WHERE id = ?");
                $userCheckStmt->execute([(int)$participantId]);
                $userExists = $userCheckStmt->fetch();
                
                if (!$userExists) {
                    $pdo->rollback();
                    sendResponse(false, "Invalid participant ID: User does not exist");
                }
                
                $stmt = $pdo->prepare("
                    INSERT INTO chat_participants (chat_id, user_id, is_admin, joined_at) 
                    VALUES (?, ?, 0, NOW())
                ");
                $stmt->execute([$chatId, (int)$participantId]);
            }
        }
        
        // Commit transaction
        $pdo->commit();
        
        // Get the created chat with participant information
        $chat = getChatById($pdo, $chatId);
        
        // For private chats, get the other participant's name
        if ($chat && $chat['chat_type'] === 'private') {
            $participantStmt = $pdo->prepare("
                SELECT u.username, u.id
                FROM chat_participants cp
                JOIN users u ON cp.user_id = u.id
                WHERE cp.chat_id = ? AND cp.user_id != ?
                LIMIT 1
            ");
            $participantStmt->execute([$chatId, $createdBy]);
            $participant = $participantStmt->fetch();
            
            if ($participant) {
                $chat['other_participant_name'] = $participant['username'];
                $chat['other_participant_id'] = $participant['id'];
            }
        }
        
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
    $deleteForEveryone = isset($input['delete_for_everyone']) ? (bool)$input['delete_for_everyone'] : false;
    
    // Verify that the authenticated user is the same as the user in the request
    if ($user['id'] != $userId) {
        sendResponse(false, "User ID mismatch");
    }
    
    if (!$chatId || !$userId) {
        sendResponse(false, "Chat ID and User ID are required");
    }
    
    try {
        // Check if user is a participant in this chat
        $stmt = $pdo->prepare("
            SELECT COUNT(*) as count 
            FROM chat_participants 
            WHERE chat_id = ? AND user_id = ?
        ");
        $stmt->execute([$chatId, $userId]);
        $result = $stmt->fetch();
        
        if ($result['count'] == 0) {
            sendResponse(false, "User is not a participant in this chat");
        }
        
        // For "Delete for everyone", we need to check if user is admin or the only participant
        if ($deleteForEveryone) {
            // Check if this is a private chat
            $stmt = $pdo->prepare("SELECT chat_type FROM chats WHERE id = ?");
            $stmt->execute([$chatId]);
            $chat = $stmt->fetch();
            
            if (!$chat) {
                sendResponse(false, "Chat not found");
            }
            
            // For private chats, either participant can delete for everyone
            // For group chats, only admins can delete for everyone
            if ($chat['chat_type'] === 'private') {
                // Check if user is a participant in this private chat (already checked above)
            } else {
                // For group chats, check if user is admin
                if (!isUserAdmin($pdo, $userId, $chatId)) {
                    sendResponse(false, "Only admins can delete group chats for everyone");
                }
            }
            
            // Mark chat as deleted for everyone
            $stmt = $pdo->prepare("
                UPDATE chats 
                SET is_deleted_for_everyone = 1, updated_at = NOW()
                WHERE id = ?
            ");
            $stmt->execute([$chatId]);
            
            sendResponse(true, "Chat deleted for everyone");
        } else {
            // Delete for current user only
            // Insert or update the chat_deletion_status table
            $stmt = $pdo->prepare("
                INSERT INTO chat_deletion_status (chat_id, user_id, is_deleted_for_me, deleted_at)
                VALUES (?, ?, 1, NOW())
                ON DUPLICATE KEY UPDATE 
                is_deleted_for_me = 1, 
                deleted_at = NOW()
            ");
            $stmt->execute([$chatId, $userId]);
            
            sendResponse(true, "Chat deleted for you");
        }
    } catch (Exception $e) {
        sendResponse(false, "Error deleting chat: " . $e->getMessage());
    }
}
?>