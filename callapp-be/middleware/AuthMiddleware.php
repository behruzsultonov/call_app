<?php
/**
 * Authentication Middleware for CallApp
 * Validates user tokens for protected endpoints
 */

require_once __DIR__ . '/../config/database.php';

/**
 * Validates user authentication token
 * @param PDO $pdo Database connection
 * @param int $userId User ID
 * @param string $token Authentication token
 * @return bool True if token is valid, false otherwise
 */
function validateUserToken($pdo, $userId, $token) {
    try {
        // Check if database connection is available
        if (!$pdo) {
            error_log("Database connection failed in validateUserToken");
            return false;
        }
        
        // Validate token
        $stmt = $pdo->prepare("
            SELECT id 
            FROM users 
            WHERE id = ? 
            AND auth_token = ?
        ");
        $stmt->execute([$userId, $token]);
        $result = $stmt->fetch();
        
        return $result ? true : false;
    } catch (Exception $e) {
        error_log("Token validation error: " . $e->getMessage());
        return false;
    }
}

/**
 * Gets user ID from token
 * @param PDO $pdo Database connection
 * @param string $token Authentication token
 * @return int|null User ID if token is valid, null otherwise
 */
function getUserIdFromToken($pdo, $token) {
    try {
        // Check if database connection is available
        if (!$pdo) {
            error_log("Database connection failed in getUserIdFromToken");
            return null;
        }
        
        error_log("Looking for user with token: " . $token);
        
        // Get user ID from token
        $stmt = $pdo->prepare("
            SELECT id 
            FROM users 
            WHERE auth_token = ?
        ");
        $stmt->execute([$token]);
        $result = $stmt->fetch();
        
        error_log("Token lookup result: " . ($result ? $result['id'] : 'null'));
        
        return $result ? $result['id'] : null;
    } catch (Exception $e) {
        error_log("Get user ID from token error: " . $e->getMessage());
        return null;
    }
}

/**
 * Middleware function to protect API endpoints
 * @param PDO $pdo Database connection
 * @return array|null User data if authenticated, null if not
 */
function authenticateRequest($pdo) {
    error_log("Starting authentication request");
    
    // Get token from headers or query parameters
    $token = null;
    
    // Check for Authorization header
    $headers = getallheaders();
    if (isset($headers['Authorization'])) {
        $authHeader = $headers['Authorization'];
        if (strpos($authHeader, 'Bearer ') === 0) {
            $token = substr($authHeader, 7);
        }
    }
    
    // If no token in header, check query parameters
    if (!$token && isset($_GET['token'])) {
        $token = $_GET['token'];
    }
    
    // If still no token, check POST data
    if (!$token && isset($_POST['token'])) {
        $token = $_POST['token'];
    }
    
    // If still no token, check JSON input
    if (!$token) {
        $input = json_decode(file_get_contents('php://input'), true);
        if (isset($input['token'])) {
            $token = $input['token'];
        }
    }
    
    error_log("Token found: " . ($token ? $token : 'null'));
    
    if (!$token) {
        error_log("No token provided");
        return null;
    }
    
    // Get user ID from token
    $userId = getUserIdFromToken($pdo, $token);
    error_log("User ID from token: " . ($userId ? $userId : 'null'));
    if (!$userId) {
        error_log("Invalid token");
        return null;
    }
    
    // Get user data
    $stmt = $pdo->prepare("SELECT id, username, phone_number, avatar, auth_token FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    $user = $stmt->fetch();
    
    error_log("User data retrieved: " . ($user ? json_encode($user) : 'null'));
    
    return $user;
}
?>