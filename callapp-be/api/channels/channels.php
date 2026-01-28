<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/php-errors.log');

// Channels API endpoints
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

if ($action === 'channels' && $subaction === 'subscribe') {
    handleSubscribeChannel();
} elseif ($action === 'channels' && $subaction === 'unsubscribe') {
    handleUnsubscribeChannel();
} elseif ($action === 'channels' && $subaction === 'posts') {
    handleGetChannelPosts();
} elseif ($action === 'channels' && $subaction === 'my_channels') {
    handleGetMySubscribedChannels();
} elseif ($action === 'channels' && $subaction === 'by_id') {
    handleGetChannelById();
} else {
    switch ($method) {
        case 'GET':
            handleGetChannels();
            break;
            
        case 'POST':
            handleCreateChannel();
            break;
            
        case 'PUT':
            handleUpdateChannel();
            break;
            
        case 'DELETE':
            handleDeleteChannel();
            break;
            
        default:
            sendResponse(false, "Method not allowed");
    }
}

function handleGetChannels() {
    global $pdo;
    
    // Authenticate request
    $user = authenticateRequest($pdo);
    if (!$user) {
        sendResponse(false, "Authentication required");
        exit;
    }
    
    $userId = $user['id'];
    
    try {
        // Get all public channels with subscriber counts
        $stmt = $pdo->prepare("
            SELECT 
                c.id,
                c.title,
                c.description,
                c.avatar_url,
                c.username,
                c.owner_id,
                c.created_at,
                (SELECT COUNT(*) FROM channel_members cm WHERE cm.channel_id = c.id) AS subscriber_count,
                (SELECT 1 FROM channel_members cm WHERE cm.channel_id = c.id AND cm.user_id = ?) AS is_subscribed
            FROM channels c
            ORDER BY c.created_at DESC
        ");
        $stmt->execute([$userId]);
        $channels = $stmt->fetchAll();
        
        sendResponse(true, "Channels retrieved successfully", $channels);
    } catch (Throwable $e) {
        error_log("Error retrieving channels: " . $e->getMessage());
        sendResponse(false, "Error retrieving channels: " . $e->getMessage());
        exit;
    }
}

function handleCreateChannel() {
    global $pdo;
    
    // Authenticate request
    $user = authenticateRequest($pdo);
    if (!$user) {
        sendResponse(false, "Authentication required");
        exit;
    }
    
    // Get JSON input
    $input = json_decode(file_get_contents('php://input'), true);
    
    $title = isset($input['title']) ? validateInput($input['title']) : null;
    $description = isset($input['description']) ? validateInput($input['description']) : null;
    $avatarUrl = isset($input['avatar_url']) ? validateInput($input['avatar_url']) : null;
    $username = isset($input['username']) ? validateInput($input['username']) : null;
    
    if (!$title || !$username) {
        sendResponse(false, "Title and username are required");
        exit;
    }
    
    // Validate username format (alphanumeric and underscores only)
    if (!preg_match('/^[a-zA-Z0-9_]+$/', $username)) {
        sendResponse(false, "Username can only contain letters, numbers, and underscores");
        exit;
    }
    
    try {
        // Check if username already exists
        $checkStmt = $pdo->prepare("SELECT id FROM channels WHERE username = ?");
        $checkStmt->execute([$username]);
        $existingChannel = $checkStmt->fetch();
        
        if ($existingChannel) {
            sendResponse(false, "Username already exists");
            exit;
        }
        
        // Insert channel
        $stmt = $pdo->prepare("
            INSERT INTO channels (owner_id, title, description, avatar_url, username, created_at) 
            VALUES (?, ?, ?, ?, ?, NOW())
        ");
        $stmt->execute([$user['id'], $title, $description, $avatarUrl, $username]);
        
        $channelId = $pdo->lastInsertId();
        
        // Return the created channel
        $stmt = $pdo->prepare("
            SELECT 
                c.id,
                c.title,
                c.description,
                c.avatar_url,
                c.username,
                c.owner_id,
                c.created_at,
                (SELECT COUNT(*) FROM channel_members cm WHERE cm.channel_id = c.id) AS subscriber_count
            FROM channels c
            WHERE c.id = ?
        ");
        $stmt->execute([$channelId]);
        $channel = $stmt->fetch();
        
        sendResponse(true, "Channel created successfully", $channel);
    } catch (Throwable $e) {
        error_log("Error creating channel: " . $e->getMessage());
        sendResponse(false, "Error creating channel: " . $e->getMessage());
        exit;
    }
}

function handleUpdateChannel() {
    global $pdo;
    
    // Authenticate request
    $user = authenticateRequest($pdo);
    if (!$user) {
        sendResponse(false, "Authentication required");
        exit;
    }
    
    // Get JSON input
    $input = json_decode(file_get_contents('php://input'), true);
    
    $channelId = isset($input['channel_id']) ? (int)validateInput($input['channel_id']) : null;
    $title = isset($input['title']) ? validateInput($input['title']) : null;
    $description = isset($input['description']) ? validateInput($input['description']) : null;
    $avatarUrl = isset($input['avatar_url']) ? validateInput($input['avatar_url']) : null;
    
    if (!$channelId) {
        sendResponse(false, "Channel ID is required");
        exit;
    }
    
    try {
        // Check if user is the owner of the channel
        $stmt = $pdo->prepare("SELECT owner_id FROM channels WHERE id = ?");
        $stmt->execute([$channelId]);
        $channel = $stmt->fetch();
        
        if (!$channel) {
            sendResponse(false, "Channel not found");
            exit;
        }
        
        if ($channel['owner_id'] != $user['id']) {
            sendResponse(false, "You are not authorized to update this channel");
            exit;
        }
        
        // Update channel
        $stmt = $pdo->prepare("
            UPDATE channels 
            SET title = COALESCE(?, title), 
                description = COALESCE(?, description), 
                avatar_url = COALESCE(?, avatar_url),
                updated_at = NOW()
            WHERE id = ?
        ");
        $stmt->execute([$title, $description, $avatarUrl, $channelId]);
        
        // Return the updated channel
        $stmt = $pdo->prepare("
            SELECT 
                c.id,
                c.title,
                c.description,
                c.avatar_url,
                c.username,
                c.owner_id,
                c.created_at,
                (SELECT COUNT(*) FROM channel_members cm WHERE cm.channel_id = c.id) AS subscriber_count
            FROM channels c
            WHERE c.id = ?
        ");
        $stmt->execute([$channelId]);
        $channel = $stmt->fetch();
        
        sendResponse(true, "Channel updated successfully", $channel);
    } catch (Throwable $e) {
        error_log("Error updating channel: " . $e->getMessage());
        sendResponse(false, "Error updating channel: " . $e->getMessage());
        exit;
    }
}

function handleDeleteChannel() {
    global $pdo;
    
    // Authenticate request
    $user = authenticateRequest($pdo);
    if (!$user) {
        sendResponse(false, "Authentication required");
        exit;
    }
    
    // Get JSON input
    $input = json_decode(file_get_contents('php://input'), true);
    
    $channelId = isset($input['channel_id']) ? (int)validateInput($input['channel_id']) : null;
    
    if (!$channelId) {
        sendResponse(false, "Channel ID is required");
        exit;
    }
    
    try {
        // Check if user is the owner of the channel
        $stmt = $pdo->prepare("SELECT owner_id FROM channels WHERE id = ?");
        $stmt->execute([$channelId]);
        $channel = $stmt->fetch();
        
        if (!$channel) {
            sendResponse(false, "Channel not found");
            exit;
        }
        
        if ($channel['owner_id'] != $user['id']) {
            sendResponse(false, "You are not authorized to delete this channel");
            exit;
        }
        
        // Delete channel (this will cascade delete members and posts due to foreign key constraints)
        $stmt = $pdo->prepare("DELETE FROM channels WHERE id = ?");
        $stmt->execute([$channelId]);
        
        sendResponse(true, "Channel deleted successfully");
    } catch (Throwable $e) {
        error_log("Error deleting channel: " . $e->getMessage());
        sendResponse(false, "Error deleting channel: " . $e->getMessage());
        exit;
    }
}

function handleSubscribeChannel() {
    global $pdo;
    
    // Authenticate request
    $user = authenticateRequest($pdo);
    if (!$user) {
        sendResponse(false, "Authentication required");
        exit;
    }
    
    $channelId = isset($_GET['channel_id']) ? (int)validateInput($_GET['channel_id']) : null;
    
    if (!$channelId) {
        sendResponse(false, "Channel ID is required");
        exit;
    }
    
    try {
        // Check if channel exists
        $stmt = $pdo->prepare("SELECT id FROM channels WHERE id = ?");
        $stmt->execute([$channelId]);
        $channel = $stmt->fetch();
        
        if (!$channel) {
            sendResponse(false, "Channel not found");
            exit;
        }
        
        // Check if already subscribed
        $stmt = $pdo->prepare("SELECT * FROM channel_members WHERE channel_id = ? AND user_id = ?");
        $stmt->execute([$channelId, $user['id']]);
        $existingSubscription = $stmt->fetch();
        
        if ($existingSubscription) {
            sendResponse(false, "Already subscribed to this channel");
            exit;
        }
        
        // Subscribe to channel
        $stmt = $pdo->prepare("
            INSERT INTO channel_members (channel_id, user_id, joined_at) 
            VALUES (?, ?, NOW())
        ");
        $stmt->execute([$channelId, $user['id']]);
        
        // Get updated subscriber count
        $stmt = $pdo->prepare("SELECT COUNT(*) as count FROM channel_members WHERE channel_id = ?");
        $stmt->execute([$channelId]);
        $subscriberCount = $stmt->fetch()['count'];
        
        sendResponse(true, "Successfully subscribed to channel", ['subscriber_count' => $subscriberCount]);
    } catch (Throwable $e) {
        error_log("Error subscribing to channel: " . $e->getMessage());
        sendResponse(false, "Error subscribing to channel: " . $e->getMessage());
        exit;
    }
}

function handleUnsubscribeChannel() {
    global $pdo;
    
    // Authenticate request
    $user = authenticateRequest($pdo);
    if (!$user) {
        sendResponse(false, "Authentication required");
        exit;
    }
    
    $channelId = isset($_GET['channel_id']) ? (int)validateInput($_GET['channel_id']) : null;
    
    if (!$channelId) {
        sendResponse(false, "Channel ID is required");
        exit;
    }
    
    try {
        // Check if channel exists
        $stmt = $pdo->prepare("SELECT id FROM channels WHERE id = ?");
        $stmt->execute([$channelId]);
        $channel = $stmt->fetch();
        
        if (!$channel) {
            sendResponse(false, "Channel not found");
            exit;
        }
        
        // Unsubscribe from channel
        $stmt = $pdo->prepare("DELETE FROM channel_members WHERE channel_id = ? AND user_id = ?");
        $result = $stmt->execute([$channelId, $user['id']]);
        
        if ($stmt->rowCount() == 0) {
            sendResponse(false, "Not subscribed to this channel");
            exit;
        }
        
        // Get updated subscriber count
        $stmt = $pdo->prepare("SELECT COUNT(*) as count FROM channel_members WHERE channel_id = ?");
        $stmt->execute([$channelId]);
        $subscriberCount = $stmt->fetch()['count'];
        
        sendResponse(true, "Successfully unsubscribed from channel", ['subscriber_count' => $subscriberCount]);
    } catch (Throwable $e) {
        error_log("Error unsubscribing from channel: " . $e->getMessage());
        sendResponse(false, "Error unsubscribing from channel: " . $e->getMessage());
        exit;
    }
}

function handleGetChannelPosts() {
    global $pdo;
    
    // Authenticate request
    $user = authenticateRequest($pdo);
    if (!$user) {
        sendResponse(false, "Authentication required");
        exit;
    }
    
    $channelId = isset($_GET['channel_id']) ? (int)validateInput($_GET['channel_id']) : null;
    
    if (!$channelId) {
        sendResponse(false, "Channel ID is required");
        exit;
    }
    
    try {
        // Check if channel exists and user has access
        $stmt = $pdo->prepare("SELECT id FROM channels WHERE id = ?");
        $stmt->execute([$channelId]);
        $channel = $stmt->fetch();
        
        if (!$channel) {
            sendResponse(false, "Channel not found");
            exit;
        }
        
        // Get all posts for the channel ordered by creation date (most recent first)
        $stmt = $pdo->prepare("
            SELECT 
                cp.id,
                cp.channel_id,
                cp.author_id,
                cp.text,
                cp.media_type,
                cp.media_url,
                cp.created_at,
                cp.updated_at,
                cp.is_deleted,
                u.username as author_username,
                u.avatar as author_avatar
            FROM channel_posts cp
            JOIN users u ON cp.author_id = u.id
            WHERE cp.channel_id = ? AND cp.is_deleted = 0
            ORDER BY cp.created_at DESC
        ");
        $stmt->execute([$channelId]);
        $posts = $stmt->fetchAll();
        
        sendResponse(true, "Channel posts retrieved successfully", $posts);
    } catch (Throwable $e) {
        error_log("Error retrieving channel posts: " . $e->getMessage());
        sendResponse(false, "Error retrieving channel posts: " . $e->getMessage());
        exit;
    }
}

function handleGetMySubscribedChannels() {
    global $pdo;
    
    // Authenticate request
    $user = authenticateRequest($pdo);
    if (!$user) {
        sendResponse(false, "Authentication required");
        exit;
    }
    
    $userId = $user['id'];
    
    try {
        // Get channels the user is subscribed to OR channels owned by the user
        $stmt = $pdo->prepare(
            "SELECT 
                c.id,
                c.title,
                c.description,
                c.avatar_url,
                c.username,
                c.owner_id,
                c.created_at,
                (SELECT COUNT(*) FROM channel_members cm WHERE cm.channel_id = c.id) AS subscriber_count,
                (SELECT MAX(cp.created_at) FROM channel_posts cp WHERE cp.channel_id = c.id) AS last_post_date
            FROM channels c
            WHERE c.id IN (
                SELECT channel_id FROM channel_members WHERE user_id = ?
                UNION
                SELECT id FROM channels WHERE owner_id = ?
            )
            ORDER BY last_post_date DESC
        ");
        $stmt->execute([$userId, $userId]);
        $channels = $stmt->fetchAll();
        
        sendResponse(true, "Subscribed channels retrieved successfully", $channels);
    } catch (Throwable $e) {
        error_log("Error retrieving subscribed channels: " . $e->getMessage());
        sendResponse(false, "Error retrieving subscribed channels: " . $e->getMessage());
        exit;
    }
}

function handleGetChannelById() {
    global $pdo;
    
    // Authenticate request
    $user = authenticateRequest($pdo);
    if (!$user) {
        sendResponse(false, "Authentication required");
        exit;
    }
    
    $channelId = isset($_GET['channel_id']) ? (int)validateInput($_GET['channel_id']) : null;
    
    if (!$channelId) {
        sendResponse(false, "Channel ID is required");
        exit;
    }
    
    try {
        // Get specific channel with subscription status and ownership info
        $stmt = $pdo->prepare(
            "SELECT 
                c.id,
                c.title,
                c.description,
                c.avatar_url,
                c.username,
                c.owner_id,
                c.created_at,
                (SELECT COUNT(*) FROM channel_members cm WHERE cm.channel_id = c.id) AS subscriber_count,
                (SELECT 1 FROM channel_members cm WHERE cm.channel_id = c.id AND cm.user_id = ?) AS is_subscribed,
                (c.owner_id = ?) AS is_owner
            FROM channels c
            WHERE c.id = ?
        ");
        $stmt->execute([$user['id'], $user['id'], $channelId]);
        $channel = $stmt->fetch();
        
        if (!$channel) {
            sendResponse(false, "Channel not found");
            exit;
        }
        
        sendResponse(true, "Channel retrieved successfully", $channel);
    } catch (Throwable $e) {
        error_log("Error retrieving channel: " . $e->getMessage());
        sendResponse(false, "Error retrieving channel: " . $e->getMessage());
        exit;
    }
}
?>