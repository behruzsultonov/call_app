-- Final chat deletion migration script
-- This script implements the correct approach for chat deletion

-- Step 1: Create the chat_deletion_status table
CREATE TABLE IF NOT EXISTS chat_deletion_status (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    chat_id BIGINT NOT NULL,
    user_id INT NOT NULL,
    is_deleted_for_me TINYINT(1) DEFAULT 0,
    deleted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_chat_user (chat_id, user_id)
);

-- Step 2: Add index for better performance
CREATE INDEX idx_chat_deletion_status_chat_id ON chat_deletion_status (chat_id);
CREATE INDEX idx_chat_deletion_status_user_id ON chat_deletion_status (user_id);

-- Step 3: If you previously added incorrect columns to chats table, remove them
-- Uncomment the following lines if you added these columns incorrectly:
-- ALTER TABLE chats DROP COLUMN IF EXISTS is_deleted_for_me;

-- Step 4: Migrate any existing deletion data (if applicable)
-- This would only be needed if you had previously implemented the incorrect approach
-- INSERT INTO chat_deletion_status (chat_id, user_id, is_deleted_for_me)
-- SELECT id as chat_id, created_by as user_id, is_deleted_for_me 
-- FROM chats 
-- WHERE is_deleted_for_me = 1
-- ON DUPLICATE KEY UPDATE is_deleted_for_me = 1;