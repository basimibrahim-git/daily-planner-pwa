<?php
declare(strict_types=1);

// Every "today"/"day of year" calculation server-side (dua rotation, streaks,
// default stats range) should agree with the app's actual users rather than
// whatever timezone the host's PHP happens to default to (often UTC).
date_default_timezone_set('Asia/Dubai');

require_once __DIR__ . '/db.php';

$isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
    || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');

session_set_cookie_params([
    'lifetime' => 60 * 60 * 24 * 30, // 30 days
    'path' => '/',
    'secure' => $isHttps,
    'httponly' => true,
    'samesite' => 'Lax',
]);
session_start();

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

function respond($data, int $code = 200): void
{
    http_response_code($code);
    echo json_encode($data);
    exit;
}

function fail(string $message, int $code = 400): void
{
    respond(['error' => $message], $code);
}

function requireAuth(): void
{
    if (empty($_SESSION['authed'])) {
        fail('Not authenticated', 401);
    }
}

function bodyJson(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        return [];
    }
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

set_exception_handler(function (Throwable $e): void {
    error_log('[planner] ' . $e->getMessage());
    respond(['error' => 'Server error'], 500);
});
