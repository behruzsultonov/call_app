<?php
// Avatar upload and management endpoints
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../lib/utils.php';

// Check if database connection is available
if (!$pdo) {
    sendResponse(false, "Database connection failed. Please check server configuration.");
}

// Get the request method
$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'POST':
        handleUploadAvatar();
        break;
        
    case 'GET':
        handleGetAvatar();
        break;
        
    default:
        sendResponse(false, "Method not allowed");
}

function handleUploadAvatar() {
    global $pdo;
    
    // Check if user_id is provided (this refers to the 'id' field in the users table)
    $userId = isset($_POST['user_id']) ? (int)validateInput($_POST['user_id']) : null;
    
    if (!$userId) {
        sendResponse(false, "User ID is required");
    }
    
    // Check if file was uploaded
    if (!isset($_FILES['avatar'])) {
        sendResponse(false, "No avatar file provided in request");
    }
    
    if ($_FILES['avatar']['error'] !== UPLOAD_ERR_OK) {
        $errorMessages = [
            UPLOAD_ERR_INI_SIZE => "The uploaded file exceeds the upload_max_filesize directive in php.ini",
            UPLOAD_ERR_FORM_SIZE => "The uploaded file exceeds the MAX_FILE_SIZE directive in HTML form",
            UPLOAD_ERR_PARTIAL => "The uploaded file was only partially uploaded",
            UPLOAD_ERR_NO_FILE => "No file was uploaded",
            UPLOAD_ERR_NO_TMP_DIR => "Missing a temporary folder",
            UPLOAD_ERR_CANT_WRITE => "Failed to write file to disk",
            UPLOAD_ERR_EXTENSION => "A PHP extension stopped the file upload"
        ];
        
        $errorMessage = isset($errorMessages[$_FILES['avatar']['error']]) 
            ? $errorMessages[$_FILES['avatar']['error']] 
            : "Unknown upload error: " . $_FILES['avatar']['error'];
            
        sendResponse(false, "Avatar upload error: " . $errorMessage);
    }
    
    try {
        // Validate file type
        $allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
        $fileType = mime_content_type($_FILES['avatar']['tmp_name']);
        
        if (!in_array($fileType, $allowedTypes)) {
            sendResponse(false, "Invalid file type. Only JPG, PNG, and GIF files are allowed. Detected type: " . $fileType);
        }
        
        // Validate file size (max 5MB)
        $maxFileSize = 5 * 1024 * 1024; // 5MB in bytes
        if ($_FILES['avatar']['size'] > $maxFileSize) {
            sendResponse(false, "File size exceeds 5MB limit. File size: " . $_FILES['avatar']['size']);
        }
        
        // Generate unique filename
        $fileExtension = pathinfo($_FILES['avatar']['name'], PATHINFO_EXTENSION);
        $fileName = uniqid() . '_' . $userId . '.' . $fileExtension;
        $uploadDir = __DIR__ . '/../../uploads/avatars/';
        
        // Create upload directory if it doesn't exist
        if (!is_dir($uploadDir)) {
            if (!mkdir($uploadDir, 0755, true)) {
                sendResponse(false, "Failed to create upload directory: " . $uploadDir);
            }
        }
        
        // Check if directory is writable
        if (!is_writable($uploadDir)) {
            sendResponse(false, "Upload directory is not writable: " . $uploadDir);
        }
        
        $filePath = $uploadDir . $fileName;
        
        // Debug information
        error_log("Attempting to move file:");
        error_log("Temp file: " . $_FILES['avatar']['tmp_name']);
        error_log("Destination: " . $filePath);
        error_log("Temp file exists: " . (file_exists($_FILES['avatar']['tmp_name']) ? "Yes" : "No"));
        error_log("Temp file size: " . $_FILES['avatar']['size']);
        
        // Move uploaded file
        if (!move_uploaded_file($_FILES['avatar']['tmp_name'], $filePath)) {
            sendResponse(false, "Failed to save avatar file. Check server error logs for more details.");
        }
        
        // Verify file was moved
        if (!file_exists($filePath)) {
            sendResponse(false, "File was not moved to destination: " . $filePath);
        }
        
        // Update user record with avatar filename
        $stmt = $pdo->prepare("UPDATE users SET avatar = ? WHERE id = ?");
        $stmt->execute([$fileName, $userId]);
        
        // Get the updated user
        $user = getUserById($pdo, $userId);
        
        sendResponse(true, "Avatar uploaded successfully", [
            'user' => $user,
            'avatar_url' => getAvatarUrl($userId),
            'file_path' => $filePath
        ]);
    } catch (Exception $e) {
        sendResponse(false, "Error uploading avatar: " . $e->getMessage());
    }
}

function handleGetAvatar() {
    $userId = isset($_GET['user_id']) ? (int)validateInput($_GET['user_id']) : null;
    
    if (!$userId) {
        // Return 404 if no user ID provided
        http_response_code(404);
        exit;
    }
    
    try {
        global $pdo;
        
        // Get user avatar filename
        $stmt = $pdo->prepare("SELECT avatar FROM users WHERE id = ?");
        $stmt->execute([$userId]);
        $result = $stmt->fetch();
        
        if (!$result || !$result['avatar']) {
            // Return 404 if no avatar found
            http_response_code(404);
            exit;
        }
        
        $avatarFile = __DIR__ . '/../../uploads/avatars/' . $result['avatar'];
        
        if (!file_exists($avatarFile)) {
            // Return 404 if file doesn't exist
            http_response_code(404);
            exit;
        }
        
        // Set appropriate content type based on file extension
        $extension = pathinfo($avatarFile, PATHINFO_EXTENSION);
        switch (strtolower($extension)) {
            case 'jpg':
            case 'jpeg':
                header('Content-Type: image/jpeg');
                break;
            case 'png':
                header('Content-Type: image/png');
                break;
            case 'gif':
                header('Content-Type: image/gif');
                break;
            default:
                header('Content-Type: image/png');
        }
        
        // Output the image
        readfile($avatarFile);
        exit;
    } catch (Exception $e) {
        // Return 404 on error
        http_response_code(404);
        exit;
    }
}

function getAvatarUrl($userId) {
    // Return the URL to get the avatar
    return $_SERVER['REQUEST_SCHEME'] . '://' . $_SERVER['HTTP_HOST'] . '/chat-be/index.php?action=avatar&user_id=' . $userId;
}
?>