-- phpMyAdmin SQL Dump
-- version 4.9.7
-- https://www.phpmyadmin.net/
--
-- Хост: localhost
-- Время создания: Дек 03 2025 г., 12:59
-- Версия сервера: 8.0.34-26-beget-1-1
-- Версия PHP: 5.6.40

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET AUTOCOMMIT = 0;
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- База данных: `k98108ya_callapp`
--

-- --------------------------------------------------------

--
-- Структура таблицы `blocked_contacts`
--
-- Создание: Ноя 24 2025 г., 04:31
--

DROP TABLE IF EXISTS `blocked_contacts`;
CREATE TABLE `blocked_contacts` (
  `id` int NOT NULL,
  `user_id` int NOT NULL,
  `blocked_user_id` int NOT NULL,
  `blocked_phone` varchar(20) DEFAULT NULL,
  `blocked_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;

-- --------------------------------------------------------

--
-- Структура таблицы `call_history`
--
-- Создание: Ноя 28 2025 г., 04:21
--

DROP TABLE IF EXISTS `call_history`;
CREATE TABLE `call_history` (
  `id` int NOT NULL,
  `caller_id` varchar(10) NOT NULL,
  `callee_id` varchar(10) NOT NULL,
  `call_type` enum('outgoing','incoming','missed') NOT NULL,
  `call_status` enum('completed','missed','rejected','failed') NOT NULL,
  `duration` int DEFAULT '0',
  `call_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;

-- --------------------------------------------------------

--
-- Структура таблицы `chats`
--
-- Создание: Ноя 24 2025 г., 04:31
-- Последнее обновление: Дек 03 2025 г., 09:24
--

DROP TABLE IF EXISTS `chats`;
CREATE TABLE `chats` (
  `id` bigint NOT NULL,
  `chat_name` varchar(100) DEFAULT NULL,
  `chat_type` enum('private','group') DEFAULT 'private',
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;

--
-- Дамп данных таблицы `chats`
--

INSERT INTO `chats` (`id`, `chat_name`, `chat_type`, `created_by`, `created_at`) VALUES
(4, 'Test Chat', 'private', NULL, '2025-12-01 04:47:12'),
(6, 'Behruz', 'private', NULL, '2025-12-01 10:57:37'),
(7, 'Bob', 'private', NULL, '2025-12-02 03:24:51');

-- --------------------------------------------------------

--
-- Структура таблицы `chat_participants`
--
-- Создание: Ноя 24 2025 г., 04:31
-- Последнее обновление: Дек 03 2025 г., 09:24
--

DROP TABLE IF EXISTS `chat_participants`;
CREATE TABLE `chat_participants` (
  `id` bigint NOT NULL,
  `chat_id` bigint NOT NULL,
  `user_id` int NOT NULL,
  `joined_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `left_at` timestamp NULL DEFAULT NULL,
  `is_admin` tinyint(1) DEFAULT '0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;

--
-- Дамп данных таблицы `chat_participants`
--

INSERT INTO `chat_participants` (`id`, `chat_id`, `user_id`, `joined_at`, `left_at`, `is_admin`) VALUES
(12, 6, 1, '2025-12-01 10:57:37', NULL, 0);

-- --------------------------------------------------------

--
-- Структура таблицы `contacts`
--
-- Создание: Ноя 28 2025 г., 04:11
--

DROP TABLE IF EXISTS `contacts`;
CREATE TABLE `contacts` (
  `id` int NOT NULL,
  `user_id` varchar(10) NOT NULL,
  `contact_user_id` varchar(10) DEFAULT NULL,
  `contact_name` varchar(100) DEFAULT NULL,
  `contact_phone` varchar(20) DEFAULT NULL,
  `is_favorite` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;

-- --------------------------------------------------------

--
-- Структура таблицы `messages`
--
-- Создание: Ноя 24 2025 г., 04:31
-- Последнее обновление: Дек 03 2025 г., 09:24
--

DROP TABLE IF EXISTS `messages`;
CREATE TABLE `messages` (
  `id` bigint NOT NULL,
  `chat_id` bigint NOT NULL,
  `sender_id` int NOT NULL,
  `message_text` text,
  `message_type` enum('text','image','audio','video','file') DEFAULT 'text',
  `file_url` varchar(500) DEFAULT NULL,
  `file_name` varchar(255) DEFAULT NULL,
  `file_size` int DEFAULT NULL,
  `reply_to` bigint DEFAULT NULL,
  `edited_at` timestamp NULL DEFAULT NULL,
  `is_deleted_for_everyone` tinyint(1) DEFAULT '0',
  `is_deleted_for_me` tinyint(1) DEFAULT '0',
  `sent_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;

-- --------------------------------------------------------

--
-- Структура таблицы `message_receipts`
--
-- Создание: Ноя 24 2025 г., 04:31
-- Последнее обновление: Дек 03 2025 г., 09:24
--

DROP TABLE IF EXISTS `message_receipts`;
CREATE TABLE `message_receipts` (
  `id` bigint NOT NULL,
  `message_id` bigint NOT NULL,
  `user_id` int NOT NULL,
  `receipt_type` enum('delivered','seen') DEFAULT 'delivered',
  `received_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;

-- --------------------------------------------------------

--
-- Структура таблицы `users`
--
-- Создание: Ноя 28 2025 г., 04:21
-- Последнее обновление: Дек 03 2025 г., 09:33
--

DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` int NOT NULL,
  `username` varchar(50) DEFAULT NULL,
  `phone_number` varchar(20) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `avatar` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;

--
-- Дамп данных таблицы `users`
--

INSERT INTO `users` (`id`, `username`, `phone_number`, `email`, `avatar`, `created_at`) VALUES
(1, 'Behruz', '+1234567890', NULL, '693003f8da13c_1.jpg', '2025-11-24 04:31:01');

-- --------------------------------------------------------

--
-- Структура таблицы `user_settings`
--
-- Создание: Ноя 24 2025 г., 04:31
-- Последнее обновление: Дек 03 2025 г., 09:24
--

DROP TABLE IF EXISTS `user_settings`;
CREATE TABLE `user_settings` (
  `id` int NOT NULL,
  `user_id` int NOT NULL,
  `language` varchar(10) DEFAULT 'en',
  `theme` varchar(10) DEFAULT 'light',
  `ringtone` varchar(100) DEFAULT 'default',
  `vibration` tinyint(1) DEFAULT '1',
  `speakerphone` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;

--
-- Дамп данных таблицы `user_settings`
--

INSERT INTO `user_settings` (`id`, `user_id`, `language`, `theme`, `ringtone`, `vibration`, `speakerphone`, `created_at`) VALUES
(1, 1, 'en', 'dark', 'default', 1, 0, '2025-11-24 04:31:02');

--
-- Индексы сохранённых таблиц
--

--
-- Индексы таблицы `blocked_contacts`
--
ALTER TABLE `blocked_contacts`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`);

--
-- Индексы таблицы `call_history`
--
ALTER TABLE `call_history`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_call_history_caller_id` (`caller_id`),
  ADD KEY `idx_call_history_callee_id` (`callee_id`),
  ADD KEY `idx_call_history_call_time` (`call_time`);

--
-- Индексы таблицы `chats`
--
ALTER TABLE `chats`
  ADD PRIMARY KEY (`id`),
  ADD KEY `created_by` (`created_by`);

--
-- Индексы таблицы `chat_participants`
--
ALTER TABLE `chat_participants`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_participant` (`chat_id`,`user_id`),
  ADD KEY `idx_chat_participants_chat_id` (`chat_id`),
  ADD KEY `idx_chat_participants_user_id` (`user_id`);

--
-- Индексы таблицы `contacts`
--
ALTER TABLE `contacts`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_contacts_user_id` (`user_id`);

--
-- Индексы таблицы `messages`
--
ALTER TABLE `messages`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_messages_chat_id` (`chat_id`),
  ADD KEY `idx_messages_sender_id` (`sender_id`),
  ADD KEY `idx_messages_sent_at` (`sent_at`),
  ADD KEY `idx_messages_reply_to` (`reply_to`);

--
-- Индексы таблицы `message_receipts`
--
ALTER TABLE `message_receipts`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_receipt` (`message_id`,`user_id`,`receipt_type`),
  ADD KEY `idx_message_receipts_message_id` (`message_id`),
  ADD KEY `idx_message_receipts_user_id` (`user_id`);

--
-- Индексы таблицы `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `phone_number` (`phone_number`);

--
-- Индексы таблицы `user_settings`
--
ALTER TABLE `user_settings`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `user_id` (`user_id`),
  ADD KEY `idx_user_settings_user_id` (`user_id`);

--
-- AUTO_INCREMENT для сохранённых таблиц
--

--
-- AUTO_INCREMENT для таблицы `blocked_contacts`
--
ALTER TABLE `blocked_contacts`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT для таблицы `call_history`
--
ALTER TABLE `call_history`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT для таблицы `chats`
--
ALTER TABLE `chats`
  MODIFY `id` bigint NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT для таблицы `chat_participants`
--
ALTER TABLE `chat_participants`
  MODIFY `id` bigint NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=15;

--
-- AUTO_INCREMENT для таблицы `contacts`
--
ALTER TABLE `contacts`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT для таблицы `messages`
--
ALTER TABLE `messages`
  MODIFY `id` bigint NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=16;

--
-- AUTO_INCREMENT для таблицы `message_receipts`
--
ALTER TABLE `message_receipts`
  MODIFY `id` bigint NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=28;

--
-- AUTO_INCREMENT для таблицы `users`
--
ALTER TABLE `users`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT для таблицы `user_settings`
--
ALTER TABLE `user_settings`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT для таблицы `sms_codes`
--
ALTER TABLE `sms_codes`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- Ограничения внешнего ключа сохраненных таблиц
--

--
-- Ограничения внешнего ключа таблицы `blocked_contacts`
--
ALTER TABLE `blocked_contacts`
  ADD CONSTRAINT `blocked_contacts_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Ограничения внешнего ключа таблицы `chats`
--
ALTER TABLE `chats`
  ADD CONSTRAINT `chats_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Ограничения внешнего ключа таблицы `chat_participants`
--
ALTER TABLE `chat_participants`
  ADD CONSTRAINT `chat_participants_ibfk_1` FOREIGN KEY (`chat_id`) REFERENCES `chats` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `chat_participants_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Ограничения внешнего ключа таблицы `messages`
--
ALTER TABLE `messages`
  ADD CONSTRAINT `messages_ibfk_1` FOREIGN KEY (`chat_id`) REFERENCES `chats` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `messages_ibfk_2` FOREIGN KEY (`sender_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `messages_ibfk_3` FOREIGN KEY (`reply_to`) REFERENCES `messages` (`id`) ON DELETE SET NULL;

--
-- Ограничения внешнего ключа таблицы `message_receipts`
--
ALTER TABLE `message_receipts`
  ADD CONSTRAINT `message_receipts_ibfk_1` FOREIGN KEY (`message_id`) REFERENCES `messages` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `message_receipts_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Ограничения внешнего ключа таблицы `user_settings`
--
ALTER TABLE `user_settings`
  ADD CONSTRAINT `user_settings_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

-- --------------------------------------------------------
--
-- Структура таблицы `sms_codes`
--
-- Создание: Дек 03 2025 г., 12:59
--

DROP TABLE IF EXISTS `sms_codes`;
CREATE TABLE `sms_codes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `phone_number` varchar(20) NOT NULL,
  `code` varchar(10) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` timestamp NOT NULL,
  `is_used` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `idx_phone_number` (`phone_number`),
  KEY `idx_expires_at` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;

COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
