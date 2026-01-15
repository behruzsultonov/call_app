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
            WHERE (ch.caller_id = :user_id1 OR ch.callee_id = :user_id2)
            AND (
                (ch.caller_id = :user_id3 AND ch.deleted_by_caller = 0) OR
                (ch.callee_id = :user_id4 AND ch.deleted_by_callee = 0)
            )
            ORDER BY ch.call_time DESC
            LIMIT 50
        ";
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':user_id1', $user_id, PDO::PARAM_INT);
        $stmt->bindParam(':user_id2', $user_id, PDO::PARAM_INT);
        $stmt->bindParam(':user_id3', $user_id, PDO::PARAM_INT);
        $stmt->bindParam(':user_id4', $user_id, PDO::PARAM_INT);
        $stmt->execute();
        
        $calls = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Format the calls for the app
        $formatted_calls = [];
        foreach ($calls as $call) {
            $is_outgoing = $call['caller_id'] == $user_id;
            $other_user_name = $is_outgoing ? $call['callee_name'] : $call['caller_name'];
            $other_user_phone = $is_outgoing ? $call['callee_phone'] : $call['caller_phone'];
            
            // Determine call type for UI
            // Since we only save calls from caller's perspective, we need to flip the type for callee
            $display_type = $is_outgoing ? $call['call_type'] : ($call['call_type'] === 'outgoing' ? 'incoming' : 'outgoing');
            
            // Handle missed calls - they should appear as 'missed' for the callee
            if ($call['call_status'] === 'missed' && !$is_outgoing) {
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
            INSERT INTO call_history (caller_id, callee_id, call_type, call_status, duration, deleted_by_caller, deleted_by_callee)
            VALUES (:caller_id, :callee_id, :call_type, :call_status, :duration, 0, 0)
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

// Cleanup function to remove calls that have been deleted by both parties
function cleanupDeletedCalls() {
    global $pdo;
    
    try {
        $sql = "DELETE FROM call_history WHERE deleted_by_caller = 1 AND deleted_by_callee = 1";
        $stmt = $pdo->prepare($sql);
        $stmt->execute();
        
        $deleted_count = $stmt->rowCount();
        error_log("Cleaned up $deleted_count fully deleted calls");
        
        return $deleted_count;
    } catch (Exception $e) {
        error_log("Error cleaning up deleted calls: " . $e->getMessage());
        return 0;
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
        // Also get the caller_id and callee_id to determine which flag to set
        $sql = "SELECT id, caller_id, callee_id FROM call_history WHERE id = :call_id AND (caller_id = :user_id1 OR callee_id = :user_id2)";
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':call_id', $call_id, PDO::PARAM_INT);
        $stmt->bindParam(':user_id1', $authenticated_user_id, PDO::PARAM_INT);
        $stmt->bindParam(':user_id2', $authenticated_user_id, PDO::PARAM_INT);
        $stmt->execute();
        
        $call_record = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$call_record) {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Permission denied: Call does not belong to user']);
            return;
        }
        
        // Determine which deletion flag to set based on user role in the call
        $is_caller = $call_record['caller_id'] == $authenticated_user_id;
        
        if ($is_caller) {
            // Mark as deleted by caller
            $delete_sql = "UPDATE call_history SET deleted_by_caller = 1 WHERE id = :call_id";
        } else {
            // Mark as deleted by callee
            $delete_sql = "UPDATE call_history SET deleted_by_callee = 1 WHERE id = :call_id";
        }
        
        $delete_stmt = $pdo->prepare($delete_sql);
        $delete_stmt->bindParam(':call_id', $call_id, PDO::PARAM_INT);
        
        if ($delete_stmt->execute()) {
            // Check if both users have deleted the call, then remove it completely
            $check_sql = "SELECT deleted_by_caller, deleted_by_callee FROM call_history WHERE id = :call_id";
            $check_stmt = $pdo->prepare($check_sql);
            $check_stmt->bindParam(':call_id', $call_id, PDO::PARAM_INT);
            $check_stmt->execute();
            $result = $check_stmt->fetch(PDO::FETCH_ASSOC);
            
            if ($result && $result['deleted_by_caller'] == 1 && $result['deleted_by_callee'] == 1) {
                // Both users have deleted the call, so remove it completely
                $fully_delete_sql = "DELETE FROM call_history WHERE id = :call_id";
                $fully_delete_stmt = $pdo->prepare($fully_delete_sql);
                $fully_delete_stmt->bindParam(':call_id', $call_id, PDO::PARAM_INT);
                $fully_delete_stmt->execute();
                
                error_log("Call ID $call_id fully deleted by both users");
            }
            
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