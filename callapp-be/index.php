<?php
// Enable CORS for cross-origin requests
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Get the action parameter
$action = isset($_GET['action']) ? $_GET['action'] : '';

// Route to appropriate API endpoint
switch ($action) {
    case 'users':
        require_once __DIR__ . '/api/users/users.php';
        break;
        
    case 'contacts':
        require_once __DIR__ . '/api/contacts/contacts.php';
        break;
        
    case 'chats':
        require_once __DIR__ . '/api/chats/chats.php';
        break;
        
    case 'messages':
        require_once __DIR__ . '/api/messages/messages.php';
        break;
        
    case 'upload_image':
        require_once __DIR__ . '/api/messages/upload_image.php';
        break;
        
    case 'upload_video':
        require_once __DIR__ . '/api/messages/upload_video.php';
        break;
        
    case 'messages_read':
        require_once __DIR__ . '/api/messages/messages_read.php';
        break;
        
    case 'avatar':
        require_once __DIR__ . '/api/users/avatar.php';
        break;
        
    case 'verify_otp':
        require_once __DIR__ . '/api/auth/otp.php';
        break;
        
    case 'test_sms':
        require_once __DIR__ . '/api/auth/test_sms.php';
        break;
        
    case 'test':
        // Simple test endpoint
        header('Content-Type: application/json');
        echo json_encode([
            'success' => true,
            'message' => 'Test endpoint working',
            'time' => date('Y-m-d H:i:s')
        ]);
        break;
        
    case 'test_db':
        // Simple database test endpoint
        require_once __DIR__ . '/config/database.php';
        try {
            // Check if database connection is available
            if (!$pdo) {
                header('Content-Type: application/json');
                echo json_encode([
                    'success' => false,
                    'message' => 'Database connection failed. Please check server configuration.'
                ]);
                break;
            }
            
            // Test database connection
            $stmt = $pdo->prepare("SELECT COUNT(*) as count FROM users");
            $stmt->execute();
            $result = $stmt->fetch();
            
            header('Content-Type: application/json');
            echo json_encode([
                'success' => true,
                'message' => 'Database connection successful',
                'user_count' => $result['count']
            ]);
        } catch (Exception $e) {
            header('Content-Type: application/json');
            echo json_encode([
                'success' => false,
                'message' => 'Database connection failed: ' . $e->getMessage()
            ]);
        }
        break;
        
    default:
        header('Content-Type: application/json');
        echo json_encode([
            'success' => false,
            'message' => 'Invalid action parameter'
        ]);
}
?>