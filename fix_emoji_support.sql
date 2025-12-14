-- Script to fix emoji support by converting tables to utf8mb4
-- This needs to be run on the database to support storing emojis in messages

-- Convert the messages table to utf8mb4
ALTER TABLE `messages` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Convert the users table to utf8mb4
ALTER TABLE `users` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Convert the chats table to utf8mb4
ALTER TABLE `chats` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Convert the chat_participants table to utf8mb4
ALTER TABLE `chat_participants` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Convert the contacts table to utf8mb4
ALTER TABLE `contacts` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Convert the blocked_contacts table to utf8mb4
ALTER TABLE `blocked_contacts` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Convert the call_history table to utf8mb4
ALTER TABLE `call_history` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Convert the message_receipts table to utf8mb4
ALTER TABLE `message_receipts` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Convert the user_settings table to utf8mb4
ALTER TABLE `user_settings` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Convert the sms_codes table to utf8mb4
ALTER TABLE `sms_codes` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Also modify the columns that might contain emojis
ALTER TABLE `messages` MODIFY `message_text` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE `users` MODIFY `username` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;