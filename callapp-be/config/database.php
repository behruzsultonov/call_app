<?php
// Database configuration
define('DB_HOST', 'k98108ya.beget.tech');
define('DB_NAME', 'k98108ya_callapp');
define('DB_USER', 'k98108ya_callapp');
define('DB_PASS', 'Eu9nj9!rLtRz');

// Create PDO connection with better error handling
$pdo = null;
try {
    $pdo = new PDO("mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4", DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
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
?>