<?php
// Video upload endpoint for messages
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../lib/utils.php';
require_once __DIR__ . '/../../middleware/AuthMiddleware.php';

// Check if database connection is available
if (!$pdo) {
    sendResponse(false, "Database connection failed. Please check server configuration.");
}

// Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendResponse(false, "Method not allowed");
}

// Authenticate request
$user = authenticateRequest($pdo);
if (!$user) {
    sendResponse(false, "Authentication required");
}

try {
    error_log("=== Starting video upload process ===");
    
    // Check if file was uploaded
    if (!isset($_FILES['video']) || $_FILES['video']['error'] !== UPLOAD_ERR_OK) {
        $errorCode = $_FILES['video']['error'] ?? 'unknown';
        error_log("File upload error. Error code: " . $errorCode);
        sendResponse(false, "Video upload failed. Please try again. Error code: " . $errorCode);
    }
    
    $video = $_FILES['video'];
    $chatId = isset($_POST['chat_id']) ? (int)validateInput($_POST['chat_id']) : null;
    $senderId = isset($_POST['sender_id']) ? (int)validateInput($_POST['sender_id']) : null;
    
    error_log("Upload video request - Chat ID: " . $chatId . ", Sender ID: " . $senderId);
    error_log("Video file info: " . print_r($video, true));
    
    // Verify that the authenticated user is the same as the sender
    if ($user['id'] != $senderId) {
        sendResponse(false, "User ID mismatch");
    }
    
    if (!$chatId || !$senderId) {
        sendResponse(false, "Chat ID and Sender ID are required");
    }
    
    // Check if user is in chat
    if (!isUserInChat($pdo, $senderId, $chatId)) {
        sendResponse(false, "User is not a participant in this chat");
    }
    
    // Validate file type
    $allowedTypes = ['video/mp4', 'video/avi', 'video/mov', 'video/quicktime'];
    if (!in_array($video['type'], $allowedTypes)) {
        sendResponse(false, "Invalid file type. Only MP4, AVI, MOV videos are allowed. Received: " . $video['type']);
    }
    
    // Validate file size (max 20MB for videos)
    if ($video['size'] > 20 * 1024 * 1024) {
        sendResponse(false, "File size too large. Maximum allowed size is 20MB. Received: " . ($video['size'] / 1024 / 1024) . " MB");
    }
    
    // Generate unique filename
    $extension = pathinfo($video['name'], PATHINFO_EXTENSION);
    $filename = uniqid('vid_', true) . '.' . $extension;
    $uploadDir = __DIR__ . '/../../uploads/messages/';
    
    error_log("Upload directory path: " . $uploadDir);
    error_log("Current working directory: " . getcwd());
    error_log("Script directory: " . __DIR__);
    
    // Create upload directory if it doesn't exist
    if (!is_dir($uploadDir)) {
        error_log("Upload directory doesn't exist, creating it...");
        if (!mkdir($uploadDir, 0755, true)) {
            $error = error_get_last();
            error_log("Failed to create upload directory. Error: " . print_r($error, true));
            sendResponse(false, "Failed to create upload directory");
        }
        error_log("Upload directory created successfully");
    } else {
        error_log("Upload directory exists");
    }
    
    // Check if directory is writable
    if (!is_writable($uploadDir)) {
        error_log("Upload directory is not writable: " . $uploadDir);
        sendResponse(false, "Upload directory is not writable");
    }
    
    $filePath = $uploadDir . $filename;
    error_log("Full file path: " . $filePath);
    
    // Check if source file exists
    if (!file_exists($video['tmp_name'])) {
        error_log("Source file does not exist: " . $video['tmp_name']);
        sendResponse(false, "Source file does not exist");
    }
    
    error_log("Source file size: " . filesize($video['tmp_name']));
    error_log("Source file permissions: " . substr(sprintf('%o', fileperms($video['tmp_name'])), -4));
    
    // Move uploaded file
    error_log("Attempting to move file from " . $video['tmp_name'] . " to " . $filePath);
    $moveResult = move_uploaded_file($video['tmp_name'], $filePath);
    
    if (!$moveResult) {
        $error = error_get_last();
        error_log("Failed to move uploaded file. Error: " . print_r($error, true));
        error_log("Source: " . $video['tmp_name'] . ", Destination: " . $filePath);
        error_log("Source exists: " . (file_exists($video['tmp_name']) ? "Yes" : "No"));
        error_log("Destination directory exists: " . (is_dir(dirname($filePath)) ? "Yes" : "No"));
        error_log("Destination directory writable: " . (is_writable(dirname($filePath)) ? "Yes" : "No"));
        sendResponse(false, "Failed to save video file. Check server permissions.");
    }
    
    error_log("File moved successfully to: " . $filePath);
    error_log("File exists after move: " . (file_exists($filePath) ? "Yes" : "No"));
    if (file_exists($filePath)) {
        error_log("Saved file size: " . filesize($filePath));
    }
    
    // File URL relative to the web root
    $fileUrl = 'uploads/messages/' . $filename;
    
    error_log("File URL: " . $fileUrl);
    
    // Insert message record in database
    $stmt = $pdo->prepare("
        INSERT INTO messages (chat_id, sender_id, message_text, message_type, file_url, file_name, file_size, sent_at) 
        VALUES (?, ?, ?, 'video', ?, ?, ?, NOW())
    ");
    $result = $stmt->execute([$chatId, $senderId, '', $fileUrl, $video['name'], $video['size']]);
    
    if (!$result) {
        error_log("Failed to insert message into database: " . print_r($stmt->errorInfo(), true));
        sendResponse(false, "Failed to save message to database");
    }
    
    // Get the created message ID
    $messageId = $pdo->lastInsertId();
    error_log("Message inserted with ID: " . $messageId);
    
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
    
    error_log("Video uploaded successfully. Message ID: " . $messageId);
    sendResponse(true, "Video uploaded successfully", $message);
} catch (Exception $e) {
    error_log("Error uploading video: " . $e->getMessage());
    error_log("Stack trace: " . $e->getTraceAsString());
    sendResponse(false, "Error uploading video: " . $e->getMessage());
}
?>