<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/php-errors.log');

// Channel Posts API endpoints
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

if ($action === 'channels' && $subaction === 'create_post') {
    handleCreatePost();
} elseif ($action === 'channels' && $subaction === 'delete_post') {
    handleDeletePost();
} else {
    switch ($method) {
        case 'GET':
            handleGetPosts();
            break;
            
        case 'POST':
            handleCreatePost();
            break;
            
        case 'DELETE':
            handleDeletePost();
            break;
            
        default:
            sendResponse(false, "Method not allowed");
    }
}

function handleGetPosts() {
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
        // Check if user is subscribed to the channel OR is the owner
        $stmt = $pdo->prepare("SELECT c.id FROM channels c WHERE c.id = ? AND c.owner_id = ?");
        $stmt->execute([$channelId, $user['id']]);
        $isOwner = $stmt->fetch();
        
        if (!$isOwner) {
            // If not owner, check if subscribed
            $stmt = $pdo->prepare("SELECT * FROM channel_members WHERE channel_id = ? AND user_id = ?");
            $stmt->execute([$channelId, $user['id']]);
            $subscription = $stmt->fetch();
            
            if (!$subscription) {
                sendResponse(false, "You must be subscribed to this channel to view posts");
                exit;
            }
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

function handleCreatePost() {
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
    $text = isset($input['text']) ? validateInput($input['text']) : null;
    $mediaType = isset($input['media_type']) ? validateInput($input['media_type']) : 'none';
    $mediaUrl = isset($input['media_url']) ? validateInput($input['media_url']) : null;
    
    if (!$channelId) {
        sendResponse(false, "Channel ID is required");
        exit;
    }
    
    if (!$text && !$mediaUrl) {
        sendResponse(false, "Either text or media is required for a post");
        exit;
    }
    
    // Validate media type
    if (!in_array($mediaType, ['image', 'video', 'none'])) {
        $mediaType = 'none';
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
            sendResponse(false, "You are not authorized to post in this channel");
            exit;
        }
        
        // Insert post
        $stmt = $pdo->prepare("
            INSERT INTO channel_posts (channel_id, author_id, text, media_type, media_url, created_at) 
            VALUES (?, ?, ?, ?, ?, NOW())
        ");
        $stmt->execute([$channelId, $user['id'], $text, $mediaType, $mediaUrl]);
        
        $postId = $pdo->lastInsertId();
        
        // Return the created post
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
                u.username as author_username,
                u.avatar as author_avatar
            FROM channel_posts cp
            JOIN users u ON cp.author_id = u.id
            WHERE cp.id = ?
        ");
        $stmt->execute([$postId]);
        $post = $stmt->fetch();
        
        sendResponse(true, "Post created successfully", $post);
    } catch (Throwable $e) {
        error_log("Error creating post: " . $e->getMessage());
        sendResponse(false, "Error creating post: " . $e->getMessage());
        exit;
    }
}

function handleDeletePost() {
    global $pdo;
    
    // Authenticate request
    $user = authenticateRequest($pdo);
    if (!$user) {
        sendResponse(false, "Authentication required");
        exit;
    }
    
    // Get JSON input
    $input = json_decode(file_get_contents('php://input'), true);
    
    $postId = isset($input['post_id']) ? (int)validateInput($input['post_id']) : null;
    
    if (!$postId) {
        sendResponse(false, "Post ID is required");
        exit;
    }
    
    try {
        // Get the post to check ownership
        $stmt = $pdo->prepare("
            SELECT cp.id, cp.channel_id, c.owner_id 
            FROM channel_posts cp
            JOIN channels c ON cp.channel_id = c.id
            WHERE cp.id = ?
        ");
        $stmt->execute([$postId]);
        $post = $stmt->fetch();
        
        if (!$post) {
            sendResponse(false, "Post not found");
            exit;
        }
        
        // Check if user is the owner of the channel (only channel owner can delete posts)
        if ($post['owner_id'] != $user['id']) {
            sendResponse(false, "You are not authorized to delete this post");
            exit;
        }
        
        // Soft delete the post
        $stmt = $pdo->prepare("UPDATE channel_posts SET is_deleted = 1 WHERE id = ?");
        $stmt->execute([$postId]);
        
        sendResponse(true, "Post deleted successfully");
    } catch (Throwable $e) {
        error_log("Error deleting post: " . $e->getMessage());
        sendResponse(false, "Error deleting post: " . $e->getMessage());
        exit;
    }
}
?>