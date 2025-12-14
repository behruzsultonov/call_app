# Chat Deletion Feature - Corrected Implementation

## Overview
This document explains the corrected implementation of the chat deletion feature with two options:
1. **Delete for Me** - Deletes the chat only for the current user
2. **Delete for Everyone** - Deletes the chat for all participants

## Problem with Initial Implementation
The initial implementation had a critical flaw:
- It used `is_deleted_for_me` field in the `chats` table
- This field applied to all users, not individually
- When one user deleted a chat for themselves, it appeared deleted for everyone

## Corrected Implementation

### Database Structure

#### New Table: `chat_deletion_status`
This table tracks individual user deletion status for each chat:

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

#### Existing Table: `chats`
The `chats` table retains the `is_deleted_for_everyone` field:

```sql
-- Relevant columns in chats table
is_deleted_for_everyone TINYINT(1) DEFAULT 0
```

### How It Works

#### Scenario: User A deletes a chat for themselves
1. User A sends DELETE request with `delete_for_everyone = false`
2. Backend inserts/updates record in `chat_deletion_status`:
   - `chat_id` = 3
   - `user_id` = A's ID
   - `is_deleted_for_me` = 1
3. User B still has no record or `is_deleted_for_me` = 0
4. When User A retrieves chats, the query filters out chats where:
   - `is_deleted_for_everyone` = 1, OR
   - User has `is_deleted_for_me` = 1 in `chat_deletion_status`
5. User B still sees the chat because they have no deletion record

#### Scenario: User A deletes a chat for everyone
1. User A sends DELETE request with `delete_for_everyone = true`
2. Backend sets `is_deleted_for_everyone` = 1 in `chats` table
3. All users will see the chat as deleted because:
   - The query filters out chats where `is_deleted_for_everyone` = 1

### Database Queries

#### Retrieving Chats for a User
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
AND (cds.is_deleted_for_me IS NULL OR cds.is_deleted_for_me = 0)
ORDER BY c.created_at DESC
```

#### Deleting for Me
```sql
INSERT INTO chat_deletion_status (chat_id, user_id, is_deleted_for_me, deleted_at)
VALUES (?, ?, 1, NOW())
ON DUPLICATE KEY UPDATE 
is_deleted_for_me = 1, 
deleted_at = NOW()
```

#### Deleting for Everyone
```sql
UPDATE chats 
SET is_deleted_for_everyone = 1, updated_at = NOW()
WHERE id = ?
```

## Files Modified

1. `callapp-be/api/chats/chats.php` - Updated API endpoints
2. `final_chat_deletion_migration.sql` - Database migration script
3. `chat_deletion_fix.sql` - Correction script

## Migration Steps

1. Run `final_chat_deletion_migration.sql` to create the new table
2. If you previously implemented the incorrect approach, uncomment the removal lines in the migration script
3. Deploy the updated backend code
4. Test the functionality

## Benefits of This Approach

1. **Individual Tracking**: Each user's deletion status is tracked separately
2. **Scalability**: The solution scales well with any number of users
3. **Data Integrity**: Proper foreign key constraints maintain data consistency
4. **Performance**: Indexes ensure efficient querying
5. **Clarity**: The implementation is clear and easy to understand