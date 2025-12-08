<?php
// Contacts API endpoints
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../lib/utils.php';
require_once __DIR__ . '/../../middleware/AuthMiddleware.php';

// Check if database connection is available
if (!$pdo) {
    sendResponse(false, "Database connection failed. Please check server configuration.");
}

// Get the request method
$method = $_SERVER['REQUEST_METHOD'];
$subaction = isset($_GET['subaction']) ? $_GET['subaction'] : '';

switch ($method) {
    case 'GET':
        if ($subaction === 'add_by_phone') {
            handleAddContactByPhone();
        } else {
            handleGetContacts();
        }
        break;
        
    case 'POST':
        handleCreateContact();
        break;
        
    case 'PUT':
        handleUpdateContact();
        break;
        
    case 'DELETE':
        handleDeleteContact();
        break;
        
    default:
        sendResponse(false, "Method not allowed");
}

function handleGetContacts() {
    global $pdo;
    
    // Authenticate request
    $authenticatedUser = authenticateRequest($pdo);
    if (!$authenticatedUser) {
        sendResponse(false, "Authentication required");
        return;
    }
    
    // Get user ID from query parameters
    $userId = isset($_GET['user_id']) ? (int)validateInput($_GET['user_id']) : null;
    
    try {
        if ($userId) {
            // Get contacts for a specific user from the contacts table
            $stmt = $pdo->prepare("SELECT id, user_id, contact_user_id, contact_name, contact_phone, is_favorite, created_at, updated_at FROM contacts WHERE user_id = ? ORDER BY is_favorite DESC, contact_name ASC");
            $stmt->execute([$userId]);
            $contacts = $stmt->fetchAll();
            
            sendResponse(true, "Contacts retrieved successfully", $contacts);
        } else {
            sendResponse(false, "User ID is required");
        }
    } catch (Exception $e) {
        sendResponse(false, "Error retrieving contacts: " . $e->getMessage());
    }
}

function handleAddContactByPhone() {
    global $pdo;
    
    // Authenticate request
    $authenticatedUser = authenticateRequest($pdo);
    if (!$authenticatedUser) {
        sendResponse(false, "Authentication required");
        return;
    }
    
    // Get phone number from query parameters
    $phoneNumber = isset($_GET['phone']) ? validateInput($_GET['phone']) : null;
    $userId = isset($_GET['user_id']) ? (int)validateInput($_GET['user_id']) : null;
    
    if (!$phoneNumber) {
        sendResponse(false, "Phone number is required");
        return;
    }
    
    if (!$userId) {
        sendResponse(false, "User ID is required");
        return;
    }
    
    try {
        // First, search for the user by phone number
        $stmt = $pdo->prepare("SELECT id, username, phone_number FROM users WHERE phone_number = ? LIMIT 1");
        $stmt->execute([$phoneNumber]);
        $user = $stmt->fetch();
        
        if (!$user) {
            sendResponse(false, "User not found");
            return;
        }
        
        // Check if contact already exists
        $stmt = $pdo->prepare("SELECT id FROM contacts WHERE user_id = ? AND contact_user_id = ? LIMIT 1");
        $stmt->execute([$userId, $user['id']]);
        $existingContact = $stmt->fetch();
        
        if ($existingContact) {
            sendResponse(false, "Contact already exists");
            return;
        }
        
        // Add the user as a contact
        $stmt = $pdo->prepare("INSERT INTO contacts (user_id, contact_user_id, contact_name, contact_phone, is_favorite, created_at) VALUES (?, ?, ?, ?, ?, NOW())");
        $stmt->execute([$userId, $user['id'], $user['username'], $user['phone_number'], 0]);
        
        // Get the created contact ID
        $contactId = $pdo->lastInsertId();
        
        // Get the created contact
        $stmt = $pdo->prepare("SELECT id, user_id, contact_user_id, contact_name, contact_phone, is_favorite, created_at, updated_at FROM contacts WHERE id = ?");
        $stmt->execute([$contactId]);
        $contact = $stmt->fetch();
        
        sendResponse(true, "Contact added successfully", $contact);
    } catch (Exception $e) {
        error_log("Error in handleAddContactByPhone: " . $e->getMessage());
        sendResponse(false, "Error adding contact: " . $e->getMessage());
    }
}

function handleCreateContact() {
    global $pdo;
    
    // Authenticate request
    $authenticatedUser = authenticateRequest($pdo);
    if (!$authenticatedUser) {
        sendResponse(false, "Authentication required");
        return;
    }
    
    // Get JSON input
    $input = json_decode(file_get_contents('php://input'), true);
    
    $userId = isset($input['user_id']) ? validateInput($input['user_id']) : null;
    $contactUserId = isset($input['contact_user_id']) ? validateInput($input['contact_user_id']) : null;
    $contactName = isset($input['contact_name']) ? validateInput($input['contact_name']) : null;
    $contactPhone = isset($input['contact_phone']) ? validateInput($input['contact_phone']) : null;
    $isFavorite = isset($input['is_favorite']) ? (int)$input['is_favorite'] : 0;
    
    if (!$userId || !$contactName || !$contactPhone) {
        sendResponse(false, "User ID, contact name, and contact phone are required");
        return;
    }
    
    try {
        // Insert new contact
        $stmt = $pdo->prepare("INSERT INTO contacts (user_id, contact_user_id, contact_name, contact_phone, is_favorite, created_at) VALUES (?, ?, ?, ?, ?, NOW())");
        $stmt->execute([$userId, $contactUserId, $contactName, $contactPhone, $isFavorite]);
        
        // Get the created contact ID
        $contactId = $pdo->lastInsertId();
        
        // Get the created contact
        $stmt = $pdo->prepare("SELECT id, user_id, contact_user_id, contact_name, contact_phone, is_favorite, created_at, updated_at FROM contacts WHERE id = ?");
        $stmt->execute([$contactId]);
        $contact = $stmt->fetch();
        
        sendResponse(true, "Contact created successfully", $contact);
    } catch (Exception $e) {
        sendResponse(false, "Error creating contact: " . $e->getMessage());
    }
}

function handleUpdateContact() {
    global $pdo;
    
    // Authenticate request
    $authenticatedUser = authenticateRequest($pdo);
    if (!$authenticatedUser) {
        sendResponse(false, "Authentication required");
        return;
    }
    
    // Get JSON input
    $input = json_decode(file_get_contents('php://input'), true);
    
    $contactId = isset($input['contact_id']) ? (int)validateInput($input['contact_id']) : null;
    $contactName = isset($input['contact_name']) ? validateInput($input['contact_name']) : null;
    $contactPhone = isset($input['contact_phone']) ? validateInput($input['contact_phone']) : null;
    $isFavorite = isset($input['is_favorite']) ? (int)$input['is_favorite'] : 0;
    
    if (!$contactId) {
        sendResponse(false, "Contact ID is required");
        return;
    }
    
    try {
        // Update contact
        $stmt = $pdo->prepare("UPDATE contacts SET contact_name = COALESCE(?, contact_name), contact_phone = COALESCE(?, contact_phone), is_favorite = ?, updated_at = NOW() WHERE id = ?");
        $stmt->execute([$contactName, $contactPhone, $isFavorite, $contactId]);
        
        // Get the updated contact
        $stmt = $pdo->prepare("SELECT id, user_id, contact_user_id, contact_name, contact_phone, is_favorite, created_at, updated_at FROM contacts WHERE id = ?");
        $stmt->execute([$contactId]);
        $contact = $stmt->fetch();
        
        sendResponse(true, "Contact updated successfully", $contact);
    } catch (Exception $e) {
        sendResponse(false, "Error updating contact: " . $e->getMessage());
    }
}

function handleDeleteContact() {
    global $pdo;
    
    // Authenticate request
    $authenticatedUser = authenticateRequest($pdo);
    if (!$authenticatedUser) {
        sendResponse(false, "Authentication required");
        return;
    }
    
    // Get JSON input
    $input = json_decode(file_get_contents('php://input'), true);
    
    $contactId = isset($input['contact_id']) ? (int)validateInput($input['contact_id']) : null;
    
    if (!$contactId) {
        sendResponse(false, "Contact ID is required");
        return;
    }
    
    try {
        // Delete contact
        $stmt = $pdo->prepare("DELETE FROM contacts WHERE id = ?");
        $stmt->execute([$contactId]);
        
        sendResponse(true, "Contact deleted successfully");
    } catch (Exception $e) {
        sendResponse(false, "Error deleting contact: " . $e->getMessage());
    }
}
?>