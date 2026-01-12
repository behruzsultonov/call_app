<?php
// Users API endpoints
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../lib/utils.php';
require_once __DIR__ . '/../../middleware/AuthMiddleware.php';

// Check if database connection is available
if (!$pdo) {
    sendResponse(false, "Database connection failed. Please check server configuration.");
}

// Get the request method
$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        handleGetUsers();
        break;
        
    case 'POST':
        handleCreateUser();
        break;
        
    case 'PUT':
        handleUpdateUser();
        break;
        
    case 'DELETE':
        handleDeleteUser();
        break;
        
    default:
        sendResponse(false, "Method not allowed");
}

function handleGetUsers() {
    global $pdo;
    
    // Authenticate request
    $authenticatedUser = authenticateRequest($pdo);
    if (!$authenticatedUser) {
        sendResponse(false, "Authentication required");
    }
    
    // Get parameters
    $userId = isset($_GET['user_id']) ? (int)validateInput($_GET['user_id']) : null;
    $search = isset($_GET['search']) ? validateInput($_GET['search']) : null;
    $subaction = isset($_GET['subaction']) ? validateInput($_GET['subaction']) : null;
    
    try {
        // Handle subactions
        if ($subaction === 'find_by_phone') {
            handleFindUserByPhone($pdo, $search);
            return;
        }
        
        if ($subaction === 'find_by_username') {
            handleFindUserByUsername($pdo, $search);
            return;
        }
        
        if ($userId) {
            // Get specific user
            $user = getUserById($pdo, $userId);
            if ($user) {
                sendResponse(true, "User retrieved successfully", $user);
            } else {
                sendResponse(false, "User not found");
            }
        } else if ($search) {
            // Search users by phone number (exact match first)
            $stmt = $pdo->prepare("SELECT id, username, phone_number, avatar FROM users WHERE phone_number = ? LIMIT 1");
            $stmt->execute([$search]);
            $user = $stmt->fetch();
            
            // If no exact match, try matching the last N digits (common for local calls)
            if (!$user) {
                // Remove all non-digit characters from search term
                $cleanedSearch = preg_replace('/\D/', '', $search);
                $searchLength = strlen($cleanedSearch);
                
                // Only do suffix matching if we have at least 7 digits (reasonable for a phone number)
                if ($searchLength >= 7) {
                    // Search for users whose phone numbers end with the searched digits
                    $stmt = $pdo->prepare("SELECT id, username, phone_number, avatar FROM users WHERE REPLACE(REPLACE(REPLACE(REPLACE(phone_number, ' ', ''), '-', ''), '(', ''), ')', '') LIKE ? LIMIT 1");
                    $stmt->execute(["%$cleanedSearch"]);
                    $user = $stmt->fetch();
                }
            }
            
            if ($user) {
                sendResponse(true, "User found", $user);
            } else {
                sendResponse(false, "User not found");
            }
        } else {
            // Get all users (with limit for performance)
            $stmt = $pdo->prepare("SELECT id, username, phone_number, avatar FROM users LIMIT 100");
            $stmt->execute();
            $users = $stmt->fetchAll();
            sendResponse(true, "Users retrieved successfully", $users);
        }
    } catch (Exception $e) {
        sendResponse(false, "Error retrieving users: " . $e->getMessage());
    }
}

function handleFindUserByPhone($pdo, $phoneNumber) {
    if (!$phoneNumber) {
        sendResponse(false, "Phone number is required");
        return;
    }
    
    try {
        // First try exact match
        $stmt = $pdo->prepare("SELECT id, username, phone_number FROM users WHERE phone_number = ? LIMIT 1");
        $stmt->execute([$phoneNumber]);
        $user = $stmt->fetch();
        
        // If no match and the search number starts with +, try without the +
        if (!$user && substr($phoneNumber, 0, 1) === '+') {
            $withoutPlus = substr($phoneNumber, 1);
            $stmt = $pdo->prepare("SELECT id, username, phone_number FROM users WHERE phone_number = ? LIMIT 1");
            $stmt->execute([$withoutPlus]);
            $user = $stmt->fetch();
        }
        
        // If no match and the database number might have +, try with +
        if (!$user) {
            $withPlus = '+' . $phoneNumber;
            $stmt = $pdo->prepare("SELECT id, username, phone_number FROM users WHERE phone_number = ? LIMIT 1");
            $stmt->execute([$withPlus]);
            $user = $stmt->fetch();
        }
        
        if ($user) {
            sendResponse(true, "User found", $user);
        } else {
            sendResponse(false, "User not found");
        }
    } catch (Exception $e) {
        sendResponse(false, "Error searching for user: " . $e->getMessage());
    }
}

function handleFindUserByUsername($pdo, $username) {
    if (!$username) {
        sendResponse(false, "Username is required");
        return;
    }
    
    try {
        // Try exact match
        $stmt = $pdo->prepare("SELECT id, username, phone_number FROM users WHERE username = ? LIMIT 1");
        $stmt->execute([$username]);
        $user = $stmt->fetch();
        
        if ($user) {
            sendResponse(true, "User found", $user);
        } else {
            sendResponse(false, "User not found");
        }
    } catch (Exception $e) {
        sendResponse(false, "Error searching for user: " . $e->getMessage());
    }
}

function handleCreateUser() {
    global $pdo;
    
    // Authenticate request
    $user = authenticateRequest($pdo);
    if (!$user) {
        sendResponse(false, "Authentication required");
    }
    
    // Get JSON input
    $input = json_decode(file_get_contents('php://input'), true);
    
    $username = isset($input['username']) ? validateInput($input['username']) : null;
    $phoneNumber = isset($input['phone_number']) ? validateInput($input['phone_number']) : null;
    
    if (!$username || !$phoneNumber) {
        sendResponse(false, "Username and phone number are required");
    }
    
    try {
        // Check if user with this phone number already exists
        $stmt = $pdo->prepare("SELECT id FROM users WHERE phone_number = ? LIMIT 1");
        $stmt->execute([$phoneNumber]);
        $existingUser = $stmt->fetch();
        
        if ($existingUser) {
            sendResponse(false, "User with this phone number already exists", $existingUser);
            return;
        }
        
        // Insert new user
        $stmt = $pdo->prepare("INSERT INTO users (username, phone_number, created_at) VALUES (?, ?, NOW())");
        $stmt->execute([$username, $phoneNumber]);
        
        // Get the created user ID
        $userId = $pdo->lastInsertId();
        
        // Get the created user
        $user = getUserById($pdo, $userId);
        
        sendResponse(true, "User created successfully", $user);
    } catch (Exception $e) {
        sendResponse(false, "Error creating user: " . $e->getMessage());
    }
}

function handleUpdateUser() {
    global $pdo;
    
    // Authenticate request
    $authenticatedUser = authenticateRequest($pdo);
    if (!$authenticatedUser) {
        sendResponse(false, "Authentication required");
    }
    
    // Get JSON input
    $input = json_decode(file_get_contents('php://input'), true);
    
    $userId = isset($input['user_id']) ? (int)validateInput($input['user_id']) : null; // This refers to the 'id' field in the users table
    $username = isset($input['username']) ? validateInput($input['username']) : null;
    $phoneNumber = isset($input['phone_number']) ? validateInput($input['phone_number']) : null;
    
    // Verify that the authenticated user is the same as the user being updated
    if ($authenticatedUser['id'] != $userId) {
        sendResponse(false, "User ID mismatch");
    }
    
    if (!$userId) {
        sendResponse(false, "User ID is required");
    }
    
    try {
        // Update user
        $stmt = $pdo->prepare("UPDATE users SET username = COALESCE(?, username), phone_number = COALESCE(?, phone_number), updated_at = NOW() WHERE id = ?");
        $stmt->execute([$username, $phoneNumber, $userId]);
        
        // Get the updated user
        $user = getUserById($pdo, $userId);
        
        sendResponse(true, "User updated successfully", $user);
    } catch (Exception $e) {
        sendResponse(false, "Error updating user: " . $e->getMessage());
    }
}

function handleDeleteUser() {
    global $pdo;
    
    // Authenticate request
    $authenticatedUser = authenticateRequest($pdo);
    if (!$authenticatedUser) {
        sendResponse(false, "Authentication required");
    }
    
    // Get JSON input
    $input = json_decode(file_get_contents('php://input'), true);
    
    $userId = isset($input['user_id']) ? (int)validateInput($input['user_id']) : null; // This refers to the 'id' field in the users table
    
    // Verify that the authenticated user is the same as the user being deleted
    if ($authenticatedUser['id'] != $userId) {
        sendResponse(false, "User ID mismatch");
    }
    
    if (!$userId) {
        sendResponse(false, "User ID is required");
    }
    
    try {
        // Delete user (will cascade delete related records)
        $stmt = $pdo->prepare("DELETE FROM users WHERE id = ?");
        $stmt->execute([$userId]);
        
        sendResponse(true, "User deleted successfully");
    } catch (Exception $e) {
        sendResponse(false, "Error deleting user: " . $e->getMessage());
    }
}
?>