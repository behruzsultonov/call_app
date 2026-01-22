<?php
// Firebase Configuration for FCM Service Account Authentication

// Path to Firebase Service Account JSON file
// Your file is named: call-app-5b1d2-firebase-adminsdk-fbsvc-bea6b4975a.json
define('FCM_SA_PATH', __DIR__ . '/../call-app-5b1d2-firebase-adminsdk-fbsvc-bea6b4975a.json');

// Path to cache FCM access token (temporary file)
define('FCM_TOKEN_CACHE', sys_get_temp_dir() . '/fcm_access_token.json');

// FCM API endpoint
define('FCM_API_URL', 'https://fcm.googleapis.com/v1/projects/');

// Your Firebase project ID from service account file
define('FIREBASE_PROJECT_ID', 'call-app-5b1d2');

?>