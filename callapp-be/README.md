# CallApp Chat Backend

This is the PHP backend for the CallApp chat functionality.

## Directory Structure

```
chat-be/
├── api/
│   ├── chats/
│   │   └── chats.php      # Chat management endpoints
│   ├── messages/
│   │   └── messages.php   # Message management endpoints
│   └── users/
│       └── users.php      # User management endpoints
├── config/
│   └── database.php       # Database configuration
├── db/
│   └── init.sql           # Database initialization script
├── lib/
│   └── utils.php          # Utility functions
├── uploads/               # Directory for file uploads
└── index.php             # Main entry point
```

## API Endpoints

### Chats
- `GET /chats?user_id={userId}` - Get all chats for a user
- `POST /chats` - Create a new chat
- `PUT /chats` - Update chat details
- `DELETE /chats` - Delete a chat

### Messages
- `GET /messages?chat_id={chatId}&user_id={userId}` - Get messages for a chat
- `POST /messages` - Send a new message
- `PUT /messages` - Update a message
- `DELETE /messages` - Delete a message

### Users
- `GET /users?user_id={userId}` - Get a specific user
- `GET /users?search={term}` - Search for users
- `POST /users` - Create a new user
- `PUT /users` - Update user details
- `DELETE /users` - Delete a user

## Database Setup

1. Create a MySQL database
2. Run the initialization script in `db/init.sql`
3. Update the database configuration in `config/database.php`

## Requirements

- PHP 7.4 or higher
- MySQL 5.7 or higher
- PDO extension for PHP