<?php
// OTP Verification API endpoints
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../lib/utils.php';

// Check if database connection is available
if (!$pdo) {
    sendResponse(false, "Database connection failed. Please check server configuration.");
}

// Get the request method
$method = $_SERVER['REQUEST_METHOD'];

// Get JSON input
$input = json_decode(file_get_contents('php://input'), true);

// If JSON decode failed, try to get data from POST array
if ($input === null) {
    $input = $_POST;
}

// Debug: Log input data
error_log("OTP API received input: " . print_r($input, true));

switch ($method) {
    case 'POST':
        $action = isset($input['action']) ? validateInput($input['action']) : 'verify';
        
        // Debug: Log action
        error_log("OTP API action: " . $action);
        
        if ($action === 'send') {
            handleSendOTP($input);
        } else {
            handleVerifyOTP($input);
        }
        break;
        
    default:
        sendResponse(false, "Method not allowed");
}

function handleSendOTP($input) {
    global $pdo;
    
    $phoneNumber = isset($input['phone_number']) ? validateInput($input['phone_number']) : null;
    
    if (!$phoneNumber) {
        sendResponse(false, "Phone number is required");
    }
    
    try {
        // For demo purposes, we're using hardcoded code "1111"
        // In production, you would generate a random code and send it via SMS
        $otpCode = "1111";
        
        // Calculate expiration time (5 minutes from now)
        $expiresAt = date('Y-m-d H:i:s', strtotime('+5 minutes'));
        
        // Store the code in the database
        $stmt = $pdo->prepare("INSERT INTO sms_codes (phone_number, code, expires_at) VALUES (?, ?, ?)");
        $stmt->execute([$phoneNumber, $otpCode, $expiresAt]);
        
        // In a real implementation, you would send the code via SMS here
        // For demo purposes, we're just storing it in the database
        
        sendResponse(true, "OTP code sent successfully");
    } catch (Exception $e) {
        sendResponse(false, "Error sending OTP: " . $e->getMessage());
    }
}

function handleVerifyOTP($input) {
    global $pdo;
    
    $phoneNumber = isset($input['phone_number']) ? validateInput($input['phone_number']) : null;
    $otpCode = isset($input['otp_code']) ? validateInput($input['otp_code']) : null;
    
    if (!$phoneNumber || !$otpCode) {
        sendResponse(false, "Phone number and OTP code are required");
    }
    
    try {
        // Check if the code exists and is valid
        $stmt = $pdo->prepare("SELECT id, code, is_used FROM sms_codes WHERE phone_number = ? AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1");
        $stmt->execute([$phoneNumber]);
        $smsCode = $stmt->fetch();
        
        // For demo purposes, we're using hardcoded code "1111"
        // In production, you would check against the sms_codes table
        if ($otpCode === "1111" || ($smsCode && $smsCode['code'] === $otpCode && !$smsCode['is_used'])) {
            // Mark the code as used
            if ($smsCode) {
                $stmt = $pdo->prepare("UPDATE sms_codes SET is_used = 1 WHERE id = ?");
                $stmt->execute([$smsCode['id']]);
            }
            
            // Check if user exists
            $stmt = $pdo->prepare("SELECT id, username, phone_number, avatar, auth_token FROM users WHERE phone_number = ? LIMIT 1");
            $stmt->execute([$phoneNumber]);
            $user = $stmt->fetch();
            
            if ($user) {
                // Debug: Log user data
                error_log("User found: " . print_r($user, true));
                
                // Check if user already has a valid token
                $existingToken = $user['auth_token'];
                
                if ($existingToken && strlen($existingToken) > 0) {
                    // User already has a valid token, use it
                    $token = $existingToken;
                } else {
                    // User doesn't have a token, generate and save one
                    $token = generateAndSaveToken($pdo, $user['id']);
                }
                
                // Get updated user data with token (only if we generated a new one)
                if ($token !== $existingToken) {
                    $stmt = $pdo->prepare("SELECT id, username, phone_number, avatar, auth_token FROM users WHERE id = ?");
                    $stmt->execute([$user['id']]);
                    $updatedUser = $stmt->fetch();
                } else {
                    $updatedUser = $user;
                }
                
                // User exists, return user data
                sendResponse(true, "Authentication successful", [
                    'user' => $updatedUser
                ]);
            } else {
                // User doesn't exist, create new user
                $username = "User_" . uniqid();
                $stmt = $pdo->prepare("INSERT INTO users (username, phone_number, created_at) VALUES (?, ?, NOW())");
                $stmt->execute([$username, $phoneNumber]);
                
                // Get the created user ID
                $userId = $pdo->lastInsertId();
                
                // Generate and save persistent token
                $token = generateAndSaveToken($pdo, $userId);
                
                // Get updated user data with token
                $stmt = $pdo->prepare("SELECT id, username, phone_number, avatar, auth_token FROM users WHERE id = ?");
                $stmt->execute([$userId]);
                $newUser = $stmt->fetch();
                
                // Debug: Log new user data
                error_log("New user created: " . print_r($newUser, true));
                
                sendResponse(true, "User created and authenticated successfully", [
                    'user' => $newUser
                ]);
            }
        } else {
            sendResponse(false, "Invalid or expired OTP code");
        }
    } catch (Exception $e) {
        sendResponse(false, "Error verifying OTP: " . $e->getMessage());
    }
}

function generateToken($userId) {
    // In a real implementation, you would generate a proper JWT or session token
    // For this demo, we'll just return a simple token
    return base64_encode(json_encode([
        'user_id' => $userId,
        'exp' => time() + 3600 // Token expires in 1 hour
    ]));
}
?>