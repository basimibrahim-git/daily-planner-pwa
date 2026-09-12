<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';

function getConfigValue(string $key): ?string
{
    $stmt = db()->prepare('SELECT `value` FROM app_config WHERE `key` = ?');
    $stmt->execute([$key]);
    $row = $stmt->fetch();
    return $row ? $row['value'] : null;
}

function setConfigValue(string $key, string $value): void
{
    $stmt = db()->prepare(
        'INSERT INTO app_config (`key`, `value`) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)'
    );
    $stmt->execute([$key, $value]);
}

function seedDefaultItems(): void
{
    $count = (int) db()->query('SELECT COUNT(*) AS c FROM items')->fetch()['c'];
    if ($count > 0) {
        return;
    }

    // [category, label, icon, type, target_value, unit, counts_toward_streak]
    // Every item is 'standard' (gets both a checkbox and a counter); target/unit
    // just give the counter something to show alongside (e.g. "/3 L").
    $seed = [
        ['Prayer', 'Fajr', 'moon', 'standard', null, null, 1],
        ['Prayer', 'Dhuhr', 'sun', 'standard', null, null, 1],
        ['Prayer', 'Asr', 'sun', 'standard', null, null, 1],
        ['Prayer', 'Maghrib', 'sunset', 'standard', null, null, 1],
        ['Prayer', 'Isha', 'star', 'standard', null, null, 1],
        ['Quran & Dhikr', 'Quran Recitation', 'book', 'standard', '1', 'pages', 1],
        ['Quran & Dhikr', 'Surah Yaseen', 'book-open', 'standard', null, null, 0],
        ['Quran & Dhikr', 'Surah Al-Mulk', 'book-open', 'standard', null, null, 0],
        ['Quran & Dhikr', 'Surah Ar-Rahman', 'book-open', 'standard', null, null, 0],
        ['Quran & Dhikr', 'Surah Al-Waqiah', 'book-open', 'standard', null, null, 0],
        ['Quran & Dhikr', 'Istighfar', 'heart', 'standard', '100', 'times', 0],
        ['Quran & Dhikr', 'Darood Sharif', 'heart', 'standard', '75', 'times', 0],
        ['Health & Body', 'Water Intake', 'droplet', 'standard', '3', 'L', 0],
        ['Health & Body', 'Exercise', 'dumbbell', 'standard', null, null, 0],
        ['Health & Body', 'Walk', 'shoe', 'standard', '30', 'min', 0],
        ['Health & Body', 'Skincare', 'sparkle', 'standard', null, null, 0],
        ['Health & Body', 'No Junk Food', 'no-food', 'standard', null, null, 0],
        ['Growth & Home', 'Read a Book', 'book', 'standard', '5', 'pages', 0],
        ['Growth & Home', 'Learn Something New', 'bulb', 'standard', null, null, 0],
        ['Growth & Home', 'House Chores', 'basket', 'standard', null, null, 0],
        ['Growth & Home', 'Message a Friend or Family', 'chat', 'standard', null, null, 0],
    ];

    $stmt = db()->prepare(
        'INSERT INTO items (category, label, icon, type, target_value, unit, counts_toward_streak, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    foreach ($seed as $i => $row) {
        $stmt->execute([...$row, $i]);
    }
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $hash = getConfigValue('password_hash');
    respond([
        'setupRequired' => $hash === null,
        'authed' => !empty($_SESSION['authed']),
    ]);
}

if ($method === 'POST') {
    $body = bodyJson();
    $action = $body['action'] ?? '';

    if ($action === 'setup') {
        if (getConfigValue('password_hash') !== null) {
            fail('Already set up', 409);
        }
        $password = (string) ($body['password'] ?? '');
        if (strlen($password) < 4) {
            fail('Password must be at least 4 characters');
        }
        setConfigValue('password_hash', password_hash($password, PASSWORD_DEFAULT));
        seedDefaultItems();
        session_regenerate_id(true);
        $_SESSION['authed'] = true;
        respond(['ok' => true]);
    }

    if ($action === 'login') {
        $hash = getConfigValue('password_hash');
        $password = (string) ($body['password'] ?? '');
        if ($hash === null || !password_verify($password, $hash)) {
            fail('Incorrect password', 401);
        }
        session_regenerate_id(true);
        $_SESSION['authed'] = true;
        respond(['ok' => true]);
    }

    if ($action === 'logout') {
        $_SESSION = [];
        session_destroy();
        respond(['ok' => true]);
    }

    if ($action === 'change-password') {
        requireAuth();
        $hash = getConfigValue('password_hash');
        $current = (string) ($body['currentPassword'] ?? '');
        $next = (string) ($body['newPassword'] ?? '');
        if ($hash === null || !password_verify($current, $hash)) {
            fail('Current password is incorrect', 401);
        }
        if (strlen($next) < 4) {
            fail('New password must be at least 4 characters');
        }
        setConfigValue('password_hash', password_hash($next, PASSWORD_DEFAULT));
        respond(['ok' => true]);
    }

    fail('Unknown action');
}

fail('Method not allowed', 405);
