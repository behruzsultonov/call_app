-- Migration to add chat-specific notification settings
-- This allows users to enable/disable notifications for individual chats

CREATE TABLE IF NOT EXISTS `chat_notification_settings` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `chat_id` bigint NOT NULL,
  `notifications_enabled` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_chat_setting` (`user_id`, `chat_id`),
  KEY `idx_chat_notification_settings_user_id` (`user_id`),
  KEY `idx_chat_notification_settings_chat_id` (`chat_id`),
  CONSTRAINT `chat_notification_settings_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chat_notification_settings_ibfk_2` FOREIGN KEY (`chat_id`) REFERENCES `chats` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add some default settings for existing chat participants
-- Enable notifications by default for all existing chat participations
INSERT IGNORE INTO `chat_notification_settings` (user_id, chat_id, notifications_enabled)
SELECT cp.user_id, cp.chat_id, 1
FROM chat_participants cp
LEFT JOIN chat_notification_settings cns ON cp.user_id = cns.user_id AND cp.chat_id = cns.chat_id
WHERE cns.id IS NULL;
