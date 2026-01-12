<?php
// Search API endpoints
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../lib/utils.php';
require_once __DIR__ . '/../../middleware/AuthMiddleware.php';

// Check if database connection is available
if (!$pdo) {
    sendResponse(false, "Database connection failed. Please check server configuration.");
}

// Get the request method
$method = $_SERVER['REQUEST_METHOD'];

// Get the search type from the query
$searchType = isset($_GET['type']) ? $_GET['type'] : '';

switch ($method) {
    case 'GET':
        switch ($searchType) {
            case 'chats':
                handleSearchChats();
                break;
            case 'messages':
                handleSearchMessages();
                break;
            case 'contacts':
                handleSearchContacts();
                break;
            default:
                sendResponse(false, "Invalid search type. Use 'chats', 'messages', or 'contacts'");
        }
        break;
    default:
        sendResponse(false, "Method not allowed");
}

function handleSearchChats() {
    global $pdo;

    // Authenticate request
    $user = authenticateRequest($pdo);
    if (!$user) {
        sendResponse(false, "Authentication required");
    }

    $userId = $user['id'];
    $searchTerm = isset($_GET['q']) ? trim(validateInput($_GET['q'])) : '';
    
    if (empty($searchTerm)) {
        sendResponse(false, "Search term is required");
    }

    try {
        // Query to search chats by name or by participant names (including contact names)
        $sql = "
            SELECT DISTINCT
                c.id,
                c.chat_name,
                c.chat_type,
                c.created_by,
                c.created_at,
                c.updated_at,
                c.is_deleted_for_everyone,
                CASE 
                    WHEN c.chat_type = 'private' THEN other_participant.username
                    ELSE c.chat_name
                END as display_name
            FROM chats c
            JOIN chat_participants cp ON c.id = cp.chat_id
            LEFT JOIN chat_deletion_status cds ON c.id = cds.chat_id AND cp.user_id = cds.user_id
            LEFT JOIN (
                SELECT 
                    cp.chat_id,
                    u.username,
                    u.id as user_id,
                    COALESCE(ct.contact_name, u.username) as display_name
                FROM chat_participants cp
                JOIN users u ON cp.user_id = u.id
                LEFT JOIN contacts ct ON ct.user_id = ? AND ct.contact_user_id = u.id
                WHERE cp.user_id != ?
            ) AS other_participant ON c.id = other_participant.chat_id
            WHERE cp.user_id = ?
            AND (c.is_deleted_for_everyone = 0 OR c.is_deleted_for_everyone IS NULL)
            AND (cds.is_deleted_for_me IS NULL OR cds.is_deleted_for_me = 0)
            AND (
                c.chat_name LIKE ? 
                OR other_participant.display_name LIKE ?
            )
            ORDER BY c.created_at DESC
        ";
        
        $stmt = $pdo->prepare($sql);
        $searchParam = '%' . $searchTerm . '%';
        $stmt->execute([$userId, $userId, $userId, $searchParam, $searchParam]);
        $chats = $stmt->fetchAll();

        // Add last message info to each chat
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
                    $chat['other_participant_id'] = $participant['id'];
                    
                    // Check if there's a contact name for this user
                    $contactStmt = $pdo->prepare("
                        SELECT contact_name
                        FROM contacts
                        WHERE user_id = ? AND contact_user_id = ?
                        LIMIT 1
                    ");
                    $contactStmt->execute([$userId, $participant['id']]);
                    $contact = $contactStmt->fetch();
                    
                    // Use contact name if available, otherwise use username
                    $chat['other_participant_name'] = $contact ? $contact['contact_name'] : $participant['username'];
                }
            }
        }

        sendResponse(true, "Chats search completed successfully", $chats);
    } catch (Exception $e) {
        error_log("Error searching chats: " . $e->getMessage());
        sendResponse(false, "Error searching chats: " . $e->getMessage());
    }
}

function handleSearchMessages() {
    global $pdo;

    // Authenticate request
    $user = authenticateRequest($pdo);
    if (!$user) {
        sendResponse(false, "Authentication required");
    }

    $userId = $user['id'];
    $searchTerm = isset($_GET['q']) ? trim(validateInput($_GET['q'])) : '';
    $chatId = isset($_GET['chat_id']) ? (int)$_GET['chat_id'] : null;
    
    if (empty($searchTerm)) {
        sendResponse(false, "Search term is required");
    }

    try {
        // Check if user is in the specified chat (if chat_id is provided)
        if ($chatId) {
            if (!isUserInChat($pdo, $userId, $chatId)) {
                sendResponse(false, "User is not a participant in this chat");
            }
            
            // Search messages within a specific chat
            $sql = "
                SELECT m.*, u.username as sender_name 
                FROM messages m 
                JOIN users u ON m.sender_id = u.id 
                WHERE m.chat_id = ? 
                AND m.is_deleted_for_everyone = 0
                AND m.message_text LIKE ?
                ORDER BY m.sent_at DESC
            ";
            
            $stmt = $pdo->prepare($sql);
            $searchParam = '%' . $searchTerm . '%';
            $stmt->execute([$chatId, $searchParam]);
        } else {
            // Search messages across all chats the user participates in
            $sql = "
                SELECT m.*, u.username as sender_name, c.chat_name
                FROM messages m 
                JOIN users u ON m.sender_id = u.id 
                JOIN chats c ON m.chat_id = c.id
                JOIN chat_participants cp ON c.id = cp.chat_id
                WHERE cp.user_id = ?
                AND m.is_deleted_for_everyone = 0
                AND m.message_text LIKE ?
                ORDER BY m.sent_at DESC
            ";
            
            $stmt = $pdo->prepare($sql);
            $searchParam = '%' . $searchTerm . '%';
            $stmt->execute([$userId, $searchParam]);
        }
        
        $messages = $stmt->fetchAll();
        
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

        sendResponse(true, "Messages search completed successfully", $messages);
    } catch (Exception $e) {
        error_log("Error searching messages: " . $e->getMessage());
        sendResponse(false, "Error searching messages: " . $e->getMessage());
    }
}

function handleSearchContacts() {
    global $pdo;

    // Authenticate request
    $authenticatedUser = authenticateRequest($pdo);
    if (!$authenticatedUser) {
        sendResponse(false, "Authentication required");
    }

    $userId = $authenticatedUser['id'];
    $searchTerm = isset($_GET['q']) ? trim(validateInput($_GET['q'])) : '';
    
    if (empty($searchTerm)) {
        sendResponse(false, "Search term is required");
    }

    try {
        // Search contacts by name or phone number
        $stmt = $pdo->prepare("
            SELECT id, user_id, contact_user_id, contact_name, contact_phone, is_favorite, created_at, updated_at 
            FROM contacts 
            WHERE user_id = ? 
            AND (
                contact_name LIKE ? 
                OR contact_phone LIKE ?
            )
            ORDER BY is_favorite DESC, contact_name ASC
        ");
        
        $searchParam = '%' . $searchTerm . '%';
        $stmt->execute([$userId, $searchParam, $searchParam]);
        $contacts = $stmt->fetchAll();

        sendResponse(true, "Contacts search completed successfully", $contacts);
    } catch (Exception $e) {
        error_log("Error searching contacts: " . $e->getMessage());
        sendResponse(false, "Error searching contacts: " . $e->getMessage());
    }
}
?>