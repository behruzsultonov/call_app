<?php
// Database configuration
define('DB_HOST', 'k98108ya.beget.tech');
define('DB_NAME', 'k98108ya_callapp');
define('DB_USER', 'k98108ya_callapp');
define('DB_PASS', 'Eu9nj9!rLtRz');

// Create PDO connection with better error handling
$pdo = null;
try {
    error_log("Attempting database connection to " . DB_HOST . " with user " . DB_USER);
    $pdo = new PDO("mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4", DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    error_log("Database connection successful");
} catch(PDOException $e) {
    // Log the error to PHP error log
    error_log("Database connection failed: " . $e->getMessage());
    // Don't die here, let the application handle the null $pdo
}

// Function to get chat ID by chat details
function getChatId($pdo, $user1Id, $user2Id) {
    // Check if database connection is available
    if (!$pdo) {
        return null;
    }
    
    // For private chats, we need to find the chat with these two participants
    $stmt = $pdo->prepare("
        SELECT c.id 
        FROM chats c
        JOIN chat_participants cp1 ON c.id = cp1.chat_id
        JOIN chat_participants cp2 ON c.id = cp2.chat_id
        WHERE cp1.user_id = ? AND cp2.user_id = ? AND c.chat_type = 'private'
    ");
    $stmt->execute([$user1Id, $user2Id]);
    $result = $stmt->fetch();
    return $result ? $result['id'] : null;
}

// Function to validate auth token
function validateAuthToken($pdo, $userId, $token) {
    // Check if database connection is available
    if (!$pdo) {
        return false;
    }
    
    $stmt = $pdo->prepare("SELECT id FROM users WHERE id = ? AND auth_token = ?");
    $stmt->execute([$userId, $token]);
    $result = $stmt->fetch();
    return $result ? true : false;
}

// Function to generate and save auth token
function generateAndSaveToken($pdo, $userId) {
    // Check if database connection is available
    if (!$pdo) {
        return false;
    }
    
    // Generate a secure token
    $token = bin2hex(random_bytes(32));
    
    // Update user with new token (no expiration)
    $stmt = $pdo->prepare("UPDATE users SET auth_token = ? WHERE id = ?");
    $stmt->execute([$token, $userId]);
    
    return $token;
}
?>