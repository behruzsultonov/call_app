# Corrected Chat Deletion Approach

## Issue with Current Implementation

The current approach has a fundamental flaw:
- Using `is_deleted_for_me` in the `chats` table applies to all users
- We need to track deletion status per user

## Correct Approach

We need to create a new table to track user-specific chat deletion status:

### 1. Create a new table for chat deletion status

```sql
CREATE TABLE chat_deletion_status (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    chat_id BIGINT NOT NULL,
    user_id INT NOT NULL,
    is_deleted_for_me TINYINT(1) DEFAULT 0,
    deleted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_chat_user (chat_id, user_id)
);
```

### 2. Modify the chat retrieval query

Instead of checking `is_deleted_for_me` in the `chats` table, we need to left join with the new table:

```sql
SELECT 
    c.id,
    c.chat_name,
    c.chat_type,
    c.created_by,
    c.is_deleted_for_everyone
FROM chats c
JOIN chat_participants cp ON c.id = cp.chat_id
LEFT JOIN chat_deletion_status cds ON c.id = cds.chat_id AND cp.user_id = cds.user_id
WHERE cp.user_id = ?
AND (c.is_deleted_for_everyone = 0 OR c.is_deleted_for_everyone IS NULL)
AND (cds.is_deleted_for_me = 0 OR cds.is_deleted_for_me IS NULL)
ORDER BY c.created_at DESC
```

### 3. Modify the deletion API

When deleting for me:
- Insert or update a record in `chat_deletion_status` with `is_deleted_for_me = 1`

When deleting for everyone:
- Set `is_deleted_for_everyone = 1` in the `chats` table

### 4. Benefits of this approach

1. Each user's deletion status is tracked individually
2. We can easily determine if a chat is deleted for a specific user
3. The system remains scalable and efficient
4. We maintain data integrity with proper foreign key constraints