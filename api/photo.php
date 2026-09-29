<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';

requireAuth();

$id = (int) ($_GET['id'] ?? 0);
$stmt = db()->prepare('SELECT filename FROM gratitude_photos WHERE id = ?');
$stmt->execute([$id]);
$filename = $stmt->fetchColumn();

if (!$filename || !preg_match('/^[a-f0-9]{32}\.(jpg|png|webp)$/', $filename, $m)) {
    fail('Not found', 404);
}
$path = dirname(__DIR__) . '/uploads/gratitude/' . $filename;
if (!is_file($path)) {
    fail('Not found', 404);
}

$types = ['jpg' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp'];
// session_start() adds no-cache headers meant for the JSON API; a photo never changes.
header_remove('Pragma');
header_remove('Expires');
header('Content-Type: ' . $types[$m[1]]);
header('Content-Length: ' . filesize($path));
// "private" keeps any CDN in front of the site from caching a logged-in-only photo.
header('Cache-Control: private, max-age=31536000, immutable');
readfile($path);
