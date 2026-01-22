<?php

function b64url($data) {
  return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function fcm_load_sa($path) {
  $json = json_decode(file_get_contents($path), true);
  if (!$json) throw new Exception("Invalid service account JSON");
  return $json;
}

function fcm_create_jwt($clientEmail, $privateKey, $tokenUri) {
  $now = time();
  $header = ['alg' => 'RS256', 'typ' => 'JWT'];
  $payload = [
    'iss' => $clientEmail,
    'scope' => 'https://www.googleapis.com/auth/firebase.messaging',
    'aud' => $tokenUri,
    'iat' => $now,
    'exp' => $now + 3600,
  ];

  $segments = [
    b64url(json_encode($header)),
    b64url(json_encode($payload)),
  ];
  $signingInput = implode('.', $segments);

  $signature = '';
  if (!openssl_sign($signingInput, $signature, $privateKey, 'sha256')) {
    throw new Exception("openssl_sign failed");
  }

  $segments[] = b64url($signature);
  return implode('.', $segments);
}

function fcm_get_access_token_cached($saPath, $cachePath) {
  // 1) try cache
  if (file_exists($cachePath)) {
    $cache = json_decode(@file_get_contents($cachePath), true);
    if ($cache && isset($cache['access_token'], $cache['expires_at'])) {
      // add 60s safety window
      if (time() < ((int)$cache['expires_at'] - 60)) {
        return $cache['access_token'];
      }
    }
  }

  // 2) fetch new token
  $sa = fcm_load_sa($saPath);
  $tokenUri = $sa['token_uri'] ?? 'https://oauth2.googleapis.com/token';
  $jwt = fcm_create_jwt($sa['client_email'], $sa['private_key'], $tokenUri);

  $ch = curl_init($tokenUri);
  curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded'],
    CURLOPT_POSTFIELDS => http_build_query([
      'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      'assertion' => $jwt,
    ]),
    CURLOPT_TIMEOUT => 20,
  ]);
  $resp = curl_exec($ch);
  $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
  $err  = curl_error($ch);
  curl_close($ch);

  if ($resp === false) throw new Exception("Token request failed: $err");
  $data = json_decode($resp, true);

  if ($code < 200 || $code >= 300 || empty($data['access_token'])) {
    throw new Exception("Token HTTP $code: $resp");
  }

  $accessToken = $data['access_token'];
  $expiresIn = (int)($data['expires_in'] ?? 3600);

  @file_put_contents($cachePath, json_encode([
    'access_token' => $accessToken,
    'expires_at' => time() + $expiresIn,
  ]));

  return $accessToken;
}

function fcm_send_v1($saPath, $cachePath, $deviceToken, array $data, $notification = null) {
  if (!$deviceToken) return ['ok' => false, 'error' => 'empty token'];

  $sa = fcm_load_sa($saPath);
  $projectId = $sa['project_id'];
  $accessToken = fcm_get_access_token_cached($saPath, $cachePath);

  // data values must be strings
  $safeData = [];
  foreach ($data as $k => $v) $safeData[(string)$k] = (string)$v;

  $message = [
    'token' => (string)$deviceToken,
    'data' => $safeData,
  ];

  // optional (можно не использовать в мессенджере)
  if (is_array($notification)) {
    $message['notification'] = [
      'title' => (string)($notification['title'] ?? ''),
      'body'  => (string)($notification['body'] ?? ''),
    ];
  }

  $payload = ['message' => $message];

  $url = "https://fcm.googleapis.com/v1/projects/{$projectId}/messages:send";
  $ch = curl_init($url);
  curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
      "Authorization: Bearer {$accessToken}",
      "Content-Type: application/json; charset=UTF-8",
    ],
    CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE),
    CURLOPT_TIMEOUT => 20,
  ]);

  $resp = curl_exec($ch);
  $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
  $err  = curl_error($ch);
  curl_close($ch);

  $json = json_decode($resp, true);

  return [
    'ok' => ($code >= 200 && $code < 300),
    'http_code' => $code,
    'error' => $err ?: null,
    'response_raw' => $resp,
    'response_json' => $json,
  ];
}

// Convenience wrapper function for sending notifications
function sendFirebaseNotification($deviceToken, $title, $body, $data = [], $sound = true, $vibrate = true) {
    // Configuration paths
    $saPath = __DIR__ . '/../call-app-5b1d2-firebase-adminsdk-fbsvc-bea6b4975a.json';
    $cachePath = sys_get_temp_dir() . '/fcm_access_token.json';
    
    // Prepare notification data
    $notificationData = array_merge($data, [
        'click_action' => 'FLUTTER_NOTIFICATION_CLICK',
        'sound' => $sound ? 'default' : 'none'
    ]);
    
    // Add vibration data if needed
    if ($vibrate) {
        $notificationData['vibrate'] = 'true';
    }
    
    // Send notification
    $result = fcm_send_v1($saPath, $cachePath, $deviceToken, $notificationData, [
        'title' => $title,
        'body' => $body
    ]);
    
    return [
        'success' => $result['ok'],
        'response' => $result
    ];
}

?>