-- Database migration script for chat deletion functionality
-- This script adds the necessary columns to support chat deletion features

-- Add columns for chat deletion to the chats table
ALTER TABLE `chats` 
ADD COLUMN `is_deleted_for_everyone` TINYINT(1) DEFAULT '0' AFTER `updated_at`,
ADD COLUMN `is_deleted_for_me` TINYINT(1) DEFAULT '0' AFTER `is_deleted_for_everyone`;

-- Add indexes for better performance on these columns
ALTER TABLE `chats` 
ADD INDEX `idx_chats_deleted_for_everyone` (`is_deleted_for_everyone`),
ADD INDEX `idx_chats_deleted_for_me` (`is_deleted_for_me`);

-- Update the existing records to ensure they have default values
UPDATE `chats` 
SET `is_deleted_for_everyone` = 0, `is_deleted_for_me` = 0 
WHERE `is_deleted_for_everyone` IS NULL OR `is_deleted_for_me` IS NULL;