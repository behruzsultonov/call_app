<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/php-errors.log');
// Chats API endpoints
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../lib/utils.php';
require_once __DIR__ . '/../../middleware/AuthMiddleware.php';

// Check if database connection is available
if (!$pdo) {
    sendResponse(false, "Database connection failed. Please check server configuration.");
    exit;
}

// Get the request method
$method = $_SERVER['REQUEST_METHOD'];

// Check for special actions
$action = isset($_GET['action']) ? $_GET['action'] : '';
$subaction = isset($_GET['subaction']) ? $_GET['subaction'] : '';

if ($action === 'chats' && $subaction === 'check_private') {
    handleCheckPrivateChat();
} elseif ($action === 'chats' && $subaction === 'add_participant') {
    handleAddParticipant();
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
        exit;
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
                SELECT message_text, sent_at, sender_id, message_type
                FROM messages 
                WHERE chat_id = ? AND is_deleted_for_everyone = 0
                ORDER BY sent_at DESC 
                LIMIT 1
            ");
            $msgStmt->execute([$chat['id']]);
            $lastMessage = $msgStmt->fetch();
            
            if ($lastMessage) {
                // Display appropriate text based on message type
                if ($lastMessage['message_type'] == 'image') {
                    $chat['last_message'] = 'Image';
                } else if ($lastMessage['message_type'] == 'video') {
                    $chat['last_message'] = 'Video';
                } else if ($lastMessage['message_type'] == 'audio') {
                    $chat['last_message'] = 'Voice Message';
                } else {
                    $chat['last_message'] = $lastMessage['message_text'];
                }
                
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
                $participantStmt = $pdo->prepare(
                    "SELECT u.username, u.id
                    FROM chat_participants cp
                    JOIN users u ON cp.user_id = u.id
                    WHERE cp.chat_id = ? AND cp.user_id != ?
                    LIMIT 1
                ");
                $participantStmt->execute([$chat['id'], $userId]);
                $participant = $participantStmt->fetch();
                            
                if ($participant) {
                    $chat['other_participant_id'] = $participant['id'];
                                
                    // Check if there's a contact name for this user
                    $contactStmt = $pdo->prepare(
                        "SELECT contact_name
                        FROM contacts
                        WHERE user_id = ? AND contact_user_id = ?
                        LIMIT 1
                    ");
                    $contactStmt->execute([$userId, $participant['id']]);
                    $contact = $contactStmt->fetch();
                                
                    // Use contact name if available, otherwise use username
                    $chat['other_participant_name'] = $contact ? $contact['contact_name'] : $participant['username'];
                }
            } else if ($chat['chat_type'] === 'group') {
                // For group chats, get all participants
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
                $participantsStmt->execute([$chat['id']]);
                $participants = $participantsStmt->fetchAll();
                            
                $chat['participants'] = $participants;
                $chat['member_count'] = count($participants);
            }
        }
        
        sendResponse(true, "Chats retrieved successfully", $chats);
    } catch (Throwable $e) {
        // Log the actual error for debugging
        error_log("Error retrieving chats: " . $e->getMessage());
        sendResponse(false, "Error retrieving chats: " . $e->getMessage());
        exit;
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
        exit;
    }
    
    $userId = $user['id'];
    $otherUserId = isset($_GET['other_user_id']) ? (int)$_GET['other_user_id'] : null;
    
    error_log("Checking for existing chat between user $userId and $otherUserId");
    
    if (!$otherUserId) {
        sendResponse(false, "Other user ID is required");
        exit;
    }
    
    try {
        // Check if a private chat already exists between these two users
        $existingChat = getPrivateChatBetweenUsers($pdo, $userId, $otherUserId);
        
        if ($existingChat) {
            sendResponse(true, "Existing chat found", $existingChat);
        } else {
            sendResponse(false, "No existing chat found");
        }
    } catch (Throwable $e) {
        error_log("Error checking for existing private chat: " . $e->getMessage());
        sendResponse(false, "Error checking for existing chat: " . $e->getMessage());
        exit;
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
    } catch (Throwable $e) {
        error_log("Error checking for existing private chat: " . $e->getMessage());
        return null;
    }
}

function handleAddParticipant() {
    global $pdo;
    
    // Authenticate request
    $user = authenticateRequest($pdo);
    if (!$user) {
        sendResponse(false, "Authentication required");
        exit;
    }
    
    // Get JSON input
    $input = json_decode(file_get_contents('php://input'), true);
    
    $chatId = isset($input['chat_id']) ? (int)validateInput($input['chat_id']) : null;
    $userId = isset($input['user_id']) ? (int)validateInput($input['user_id']) : null; // This refers to the 'id' field in the users table
    $participantId = isset($input['participant_id']) ? (int)validateInput($input['participant_id']) : null;
    
    // Verify that the authenticated user is the same as the user in the request
    if ($user['id'] != $userId) {
        sendResponse(false, "User ID mismatch");
        exit;
    }
    
    if (!$chatId || !$userId || !$participantId) {
        sendResponse(false, "Chat ID, User ID, and Participant ID are required");
        exit;
    }
    
    try {
        // Check if user is admin of the chat
        if (!isUserAdmin($pdo, $userId, $chatId)) {
            sendResponse(false, "User is not authorized to add participants to this chat");
            exit;
        }
            
        // Check if the participant already exists in the chat
        $checkStmt = $pdo->prepare("SELECT COUNT(*) FROM chat_participants WHERE chat_id = ? AND user_id = ?");
        $checkStmt->execute([$chatId, $participantId]);
        $exists = $checkStmt->fetchColumn();
            
        if ($exists > 0) {
            sendResponse(false, "Participant is already in this chat");
            exit;
        }
            
        // Validate that the participant user exists
        $userCheckStmt = $pdo->prepare("SELECT id FROM users WHERE id = ?");
        $userCheckStmt->execute([$participantId]);
        $participantExists = $userCheckStmt->fetch();
            
        if (!$participantExists) {
            sendResponse(false, "Invalid participant ID: User does not exist");
            exit;
        }
        
        // Add participant to chat
        $stmt = $pdo->prepare(
            "INSERT INTO chat_participants (chat_id, user_id, is_admin, joined_at) 
             VALUES (?, ?, 0, NOW())"
        );
        $stmt->execute([$chatId, $participantId]);
        
        sendResponse(true, "Participant added successfully");
    } catch (Throwable $e) {
        sendResponse(false, "Error adding participant: " . $e->getMessage());
        exit;
    }
}

function handleCreateChat() {
    global $pdo;
    
    // Authenticate request
    $user = authenticateRequest($pdo);
    if (!$user) {
        sendResponse(false, "Authentication required");
        exit;
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
        exit;
    }
    
    if (!$chatName || !$createdBy) {
        sendResponse(false, "Chat Name and Created By are required");
        exit;
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
                    throw new Exception("Invalid participant ID: User does not exist");
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
        
        // Get the created chat
        $stmt = $pdo->prepare(
            "SELECT 
                c.id,
                c.chat_name,
                c.chat_type,
                c.created_by,
                c.created_at,
                c.updated_at,
                c.is_deleted_for_everyone
            FROM chats c
            WHERE c.id = ?"
        );
        $stmt->execute([$chatId]);
        $chat = $stmt->fetch();
        
        // Build a simple response without complex nested data that might cause encoding issues
        $response_data = [
            'id' => $chatId,
            'chat_name' => $chatName,
            'chat_type' => $chatType,
            'created_by' => $createdBy,
            'created_at' => date('Y-m-d H:i:s') // Use current time since we just created it
        ];
        
        // For group chats, return member count
        if ($chatType === 'group') {
            // Count participants
            $countStmt = $pdo->prepare("SELECT COUNT(*) as count FROM chat_participants WHERE chat_id = ?");
            $countStmt->execute([$chatId]);
            $countResult = $countStmt->fetch();
            $response_data['member_count'] = (int)$countResult['count'];
        }
                
        sendResponse(true, "Chat created successfully", $response_data);
    } catch (Throwable $e) {
        // Rollback transaction on error only if transaction is active
        if ($pdo && $pdo->inTransaction()) {
            $pdo->rollback();
        }
        sendResponse(false, "Error creating chat: " . $e->getMessage());
    }
}

function handleUpdateChat() {
    global $pdo;
    
    // Authenticate request
    $user = authenticateRequest($pdo);
    if (!$user) {
        sendResponse(false, "Authentication required");
        exit;
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
        $stmt = $pdo->prepare(
            "SELECT 
                c.id,
                c.chat_name,
                c.chat_type,
                c.created_by,
                c.created_at,
                c.updated_at,
                c.is_deleted_for_everyone
            FROM chats c
            WHERE c.id = ?"
        );
        $stmt->execute([$chatId]);
        $chat = $stmt->fetch();
        
        // Build a simple response without complex nested data that might cause encoding issues
        $response_data = [
            'id' => $chatId,
            'chat_name' => $chat['chat_name'],
            'chat_type' => $chat['chat_type'],
            'created_by' => $chat['created_by'],
            'updated_at' => $chat['updated_at'],
            'is_deleted_for_everyone' => $chat['is_deleted_for_everyone']
        ];
        
        // For group chats, include member count
        if ($chat['chat_type'] === 'group') {
            $countStmt = $pdo->prepare("SELECT COUNT(*) as count FROM chat_participants WHERE chat_id = ?");
            $countStmt->execute([$chatId]);
            $countResult = $countStmt->fetch();
            $response_data['member_count'] = (int)$countResult['count'];
        }
        
        sendResponse(true, "Chat updated successfully", $response_data);
    } catch (Throwable $e) {
        sendResponse(false, "Error updating chat: " . $e->getMessage());
        exit;
    }
}

function handleDeleteChat() {
    global $pdo;
    
    // Authenticate request
    $user = authenticateRequest($pdo);
    if (!$user) {
        sendResponse(false, "Authentication required");
        exit;
    }
    
    // Get JSON input
    $input = json_decode(file_get_contents('php://input'), true);
    
    $chatId = isset($input['chat_id']) ? (int)validateInput($input['chat_id']) : null;
    $userId = isset($input['user_id']) ? (int)validateInput($input['user_id']) : null; // This refers to the 'id' field in the users table
    $deleteForEveryone = isset($input['delete_for_everyone']) ? (bool)$input['delete_for_everyone'] : false;
    
    // Verify that the authenticated user is the same as the user in the request
    if ($user['id'] != $userId) {
        sendResponse(false, "User ID mismatch");
        exit;
    }
    
    if (!$chatId || !$userId) {
        sendResponse(false, "Chat ID and User ID are required");
        exit;
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
    } catch (Throwable $e) {
        sendResponse(false, "Error deleting chat: " . $e->getMessage());
        exit;
    }
}

?>