<?php
// Shared message functions
// Note: This file assumes that database connection ($pdo) and utils are already available

/**
 * Send push notifications to chat participants when a message is sent
 */
function sendMessageNotifications($pdo, $chatId, $senderId, $message) {
    try {
        // Get chat information
        $stmt = $pdo->prepare("SELECT chat_name, chat_type FROM chats WHERE id = ?");
        $stmt->execute([$chatId]);
        $chat = $stmt->fetch();
        
        if (!$chat) {
            return;
        }
        
        // Get chat participants (excluding sender)
        $stmt = $pdo->prepare("
            SELECT user_id FROM chat_participants 
            WHERE chat_id = ? AND user_id != ?
        ");
        $stmt->execute([$chatId, $senderId]);
        $participants = $stmt->fetchAll();
        
        if (empty($participants)) {
            return;
        }
        
        // Prepare message preview
        $messagePreview = '';
        if ($message['message_type'] === 'text') {
            $messagePreview = strlen($message['message_text']) > 50 
                ? substr($message['message_text'], 0, 50) . '...' 
                : $message['message_text'];
        } elseif ($message['message_type'] === 'image') {
            $messagePreview = '📷 Photo';
        } elseif ($message['message_type'] === 'audio') {
            $messagePreview = '🎤 Voice message';
        } elseif ($message['message_type'] === 'video') {
            $messagePreview = '📹 Video';
        } else {
            $messagePreview = '📎 File';
        }
        
        // Send notification to each participant
        foreach ($participants as $participant) {
            $receiverId = $participant['user_id'];
            
            // Check chat-specific notification setting first
            $stmt = $pdo->prepare("
                SELECT notifications_enabled 
                FROM chat_notification_settings 
                WHERE user_id = ? AND chat_id = ?
            ");
            $stmt->execute([$receiverId, $chatId]);
            $chatSetting = $stmt->fetch();
            
            // If chat-specific setting exists and is disabled, skip notification
            if ($chatSetting && $chatSetting['notifications_enabled'] == 0) {
                continue;
            }
            
            // Get receiver's FCM token and global notification settings
            $stmt = $pdo->prepare("
                SELECT u.fcm_token, ns.message_notifications
                FROM users u
                LEFT JOIN notification_settings ns ON ns.user_id = u.id
                WHERE u.id = ?
            ");
            $stmt->execute([$receiverId]);
            $receiverData = $stmt->fetch();
            
            // Check if notifications are enabled and FCM token exists
            if (!$receiverData || !$receiverData['fcm_token'] || 
                ($receiverData['message_notifications'] !== null && $receiverData['message_notifications'] == 0)) {
                continue; // Skip this user
            }
            
            // Get sender's display name - check if sender is in receiver's contacts
            $stmt = $pdo->prepare("
                SELECT c.contact_name
                FROM contacts c
                WHERE c.user_id = ? AND c.contact_user_id = ?
            ");
            $stmt->execute([$receiverId, $senderId]);
            $contact = $stmt->fetch();
            
            // Use contact name if available, otherwise use sender's username
            $senderDisplayName = $contact ? $contact['contact_name'] : $message['sender_name'];
            
            // Send push notification using FCM client
            require_once __DIR__ . '/../lib/fcm_client.php';
            
            $result = fcm_send_v1(
                __DIR__ . '/../call-app-5b1d2-firebase-adminsdk-fbsvc-bea6b4975a.json',
                sys_get_temp_dir() . '/fcm_access_token.json',
                $receiverData['fcm_token'],
                [
                    "type" => "message",
                    "chatId" => (string)$chatId,
                    "messageId" => (string)$message['id'],
                    "senderId" => (string)$senderId,
                    "senderName" => $senderDisplayName,  // Include sender's display name
                    "text" => $messagePreview,
                    "chatType" => $chat['chat_type'],
                    "click_action" => "FLUTTER_NOTIFICATION_CLICK"
                ],
                [
                    "title" => $chat['chat_type'] === 'group' ? $chat['chat_name'] : $senderDisplayName,
                    "body" => $messagePreview
                ]
            );
            
            // Log the result but don't fail the message sending
            if (!$result['ok']) {
                error_log("Failed to send push notification to user {$receiverId}: " . json_encode($result));
            }
        }
    } catch (Exception $e) {
        // Log error but don't fail the message sending
        error_log("Error sending message notifications: " . $e->getMessage());
    }
}
