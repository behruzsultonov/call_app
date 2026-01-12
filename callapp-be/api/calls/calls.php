<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../lib/utils.php';
require_once __DIR__ . '/../../middleware/AuthMiddleware.php';

// Enable CORS
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Authenticate request
$authenticatedUser = authenticateRequest($pdo);
if (!$authenticatedUser) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}

// Get the subaction parameter
$subaction = isset($_GET['subaction']) ? $_GET['subaction'] : '';

switch ($subaction) {
    case 'get_history':
        getCallHistory();
        break;
    
    case 'save_call':
        saveCall();
        break;
        
    case 'delete_call':
        deleteCall();
        break;
        
    default:
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid subaction parameter']);
}

function getCallHistory() {
    global $pdo;
    
    // Access the globally authenticated user
    global $authenticatedUser;
    
    try {
        // Use the authenticated user's ID instead of the parameter from URL
        $user_id = $authenticatedUser['id'];
        
        error_log('Debug: authenticated user_id = ' . var_export($user_id, true));
        error_log('Debug: $_GET = ' . var_export($_GET, true));
        
        if (!$user_id) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'User ID is required']);
            return;
        }
        
        // Log for debugging
        error_log('Fetching call history for user_id: ' . $user_id . ', type: ' . gettype($user_id));
        
        $user_id = intval($user_id); // Ensure user_id is an integer
        $sql = "
            SELECT 
                ch.id,
                ch.caller_id,
                ch.callee_id,
                ch.call_type,
                ch.call_status,
                ch.duration,
                ch.call_time,
                u1.username as caller_name,
                u2.username as callee_name,
                u1.phone_number as caller_phone,
                u2.phone_number as callee_phone
            FROM call_history ch
            LEFT JOIN users u1 ON (ch.caller_id = u1.id)
            LEFT JOIN users u2 ON (ch.callee_id = u2.id)
            WHERE ch.caller_id = :user_id1 OR ch.callee_id = :user_id2
            ORDER BY ch.call_time DESC
            LIMIT 50
        ";
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':user_id1', $user_id, PDO::PARAM_INT);
        $stmt->bindParam(':user_id2', $user_id, PDO::PARAM_INT);
        $stmt->execute();
        
        $calls = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Format the calls for the app
        $formatted_calls = [];
        foreach ($calls as $call) {
            $is_outgoing = $call['caller_id'] == $user_id;
            $other_user_name = $is_outgoing ? $call['callee_name'] : $call['caller_name'];
            $other_user_phone = $is_outgoing ? $call['callee_phone'] : $call['caller_phone'];
            
            // Determine call type for UI
            $display_type = $call['call_type'];
            if ($call['call_status'] === 'missed' && $display_type === 'incoming') {
                $display_type = 'missed';
            }
            
            // Format duration for display
            $duration_display = $call['duration'] > 0 ? formatDuration($call['duration']) : '';
            
            $formatted_calls[] = [
                'id' => $call['id'],
                'number' => $other_user_phone ?: $other_user_name,
                'type' => $display_type,
                'time' => formatDate($call['call_time']),
                'date' => formatDateDetailed($call['call_time']),
                'duration' => $duration_display,
                'is_outgoing' => $is_outgoing
            ];
        }
        
        header('Content-Type: application/json');
        echo json_encode([
            'success' => true,
            'data' => $formatted_calls,
            'count' => count($formatted_calls)
        ]);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Error fetching call history: ' . $e->getMessage()
        ]);
    }
}

function saveCall() {
    global $pdo;
    
    // Access the globally authenticated user
    global $authenticatedUser;
    
    try {
        $input = json_decode(file_get_contents('php://input'), true);
        
        $caller_id = $input['caller_id'] ?? null;
        $callee_id = $input['callee_id'] ?? null;
        $call_type = $input['call_type'] ?? null; // 'outgoing', 'incoming'
        $call_status = $input['call_status'] ?? null; // 'completed', 'missed', 'rejected', 'failed'
        $duration = $input['duration'] ?? 0;
        
        if (!$caller_id || !$callee_id || !$call_type || !$call_status) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Missing required fields']);
            return;
        }
        
        // Validate that the authenticated user is either the caller or callee
        if ($authenticatedUser['id'] != $caller_id && $authenticatedUser['id'] != $callee_id) {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Forbidden: Cannot save call for other users']);
            return;
        }
        
        $sql = "
            INSERT INTO call_history (caller_id, callee_id, call_type, call_status, duration)
            VALUES (:caller_id, :callee_id, :call_type, :call_status, :duration)
        ";
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':caller_id', $caller_id, PDO::PARAM_INT);
        $stmt->bindParam(':callee_id', $callee_id, PDO::PARAM_INT);
        $stmt->bindParam(':call_type', $call_type, PDO::PARAM_STR);
        $stmt->bindParam(':call_status', $call_status, PDO::PARAM_STR);
        $stmt->bindParam(':duration', $duration, PDO::PARAM_INT);
        
        if ($stmt->execute()) {
            header('Content-Type: application/json');
            echo json_encode([
                'success' => true,
                'message' => 'Call saved successfully',
                'id' => $pdo->lastInsertId()
            ]);
        } else {
            throw new Exception('Failed to save call');
        }
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Error saving call: ' . $e->getMessage()
        ]);
    }
}

function deleteCall() {
    global $pdo;
    
    // Access the globally authenticated user
    global $authenticatedUser;
    
    try {
        $call_id = $_GET['call_id'] ?? null;
        $user_id = $_GET['user_id'] ?? null;
        
        // Validate required parameters
        if (!$call_id || !$user_id) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Call ID and User ID are required']);
            return;
        }
        
        // Ensure the authenticated user is the one making the request
        $authenticated_user_id = $authenticatedUser['id'];
        if ($authenticated_user_id != $user_id) {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Permission denied: Invalid user ID']);
            return;
        }
        
        // Verify that the call belongs to the user (either caller or callee)
        $sql = "SELECT id FROM call_history WHERE id = :call_id AND (caller_id = :user_id1 OR callee_id = :user_id2)";
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':call_id', $call_id, PDO::PARAM_INT);
        $stmt->bindParam(':user_id1', $authenticated_user_id, PDO::PARAM_INT);
        $stmt->bindParam(':user_id2', $authenticated_user_id, PDO::PARAM_INT);
        $stmt->execute();
        
        if (!$stmt->fetch()) {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Permission denied: Call does not belong to user']);
            return;
        }
        
        // Delete the call record
        $delete_sql = "DELETE FROM call_history WHERE id = :call_id";
        $delete_stmt = $pdo->prepare($delete_sql);
        $delete_stmt->bindParam(':call_id', $call_id, PDO::PARAM_INT);
        
        if ($delete_stmt->execute()) {
            header('Content-Type: application/json');
            echo json_encode([
                'success' => true,
                'message' => 'Call deleted successfully'
            ]);
        } else {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Failed to delete call']);
        }
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Error deleting call: ' . $e->getMessage()]);
    }
}

function formatDuration($seconds) {
    if ($seconds < 60) {
        return $seconds . 's';
    } else {
        $minutes = floor($seconds / 60);
        $remainingSeconds = $seconds % 60;
        return $minutes . 'm ' . $remainingSeconds . 's';
    }
}

function formatDate($datetime) {
    $date = new DateTime($datetime);
    $now = new DateTime();
    
    if ($date->format('Y-m-d') === $now->format('Y-m-d')) {
        // Today: Show time only
        return $date->format('H:i');
    } elseif ($date->format('Y') === $now->format('Y')) {
        // Same year: Show day and month
        return $date->format('d M');
    } else {
        // Different year: Show full date
        return $date->format('d M Y');
    }
}

function formatDateDetailed($datetime) {
    $date = new DateTime($datetime);
    return $date->format('M d, Y H:i');
}
?>