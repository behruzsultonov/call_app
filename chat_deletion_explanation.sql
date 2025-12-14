-- Explanation of how chat deletion works in the system

-- 1. The chats table has deletion flags that apply to all users
-- is_deleted_for_everyone = 1 means ALL users see the chat as deleted
-- is_deleted_for_me = 1 means only the CURRENT USER sees the chat as deleted

-- 2. To check if a chat is deleted for a specific user, we need to join with chat_participants
-- Here's how the system filters chats for a specific user (e.g., user_id = 1):

SELECT 
    c.id as chat_id,
    c.chat_name,
    cp.user_id,
    c.is_deleted_for_everyone,
    c.is_deleted_for_me
FROM chats c
JOIN chat_participants cp ON c.id = cp.chat_id
WHERE cp.user_id = 1  -- This is the current user
AND (c.is_deleted_for_everyone = 0 OR c.is_deleted_for_everyone IS NULL)  -- Not deleted for everyone
AND (c.is_deleted_for_me = 0 OR c.is_deleted_for_me IS NULL);  -- Not deleted for this specific user

-- 3. When you delete a chat for yourself, only your view changes:
-- Your client sends a request with delete_for_everyone = false
-- The backend sets is_deleted_for_me = 1 for that chat
-- Other users still see is_deleted_for_me = 0, so they can still access the chat

-- 4. When someone deletes a chat for everyone:
-- The backend sets is_deleted_for_everyone = 1 for that chat
-- ALL users will see the chat as deleted because of the query condition above

-- Example scenario:
-- Chat #3 has two participants: User 1 and User 2
-- If User 1 deletes the chat for themselves:
--   is_deleted_for_me = 1 (but only for User 1's view)
--   User 2 still sees is_deleted_for_me = 0, so they can still access the chat
--   Both users see is_deleted_for_everyone = 0, so it's not deleted for everyone

-- To properly check deletion status for a specific user, we should modify our approach:
-- The current implementation in handleGetChats() is correct:
-- It joins with chat_participants to ensure we only get chats for the current user
-- And it filters out chats where is_deleted_for_everyone = 1 or is_deleted_for_me = 1