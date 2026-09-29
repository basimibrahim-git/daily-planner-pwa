<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/lib.php';

requireAuth();

const MAX_PHOTOS = 3;
const MAX_PHOTO_BYTES = 6 * 1024 * 1024;
const PHOTO_TYPES = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
const FONT_KEYS = ['caveat', 'patrick', 'dancing', 'quicksand', 'typewriter', 'playfair'];
const SIZE_KEYS = ['s', 'm', 'l', 'xl'];

$method = $_SERVER['REQUEST_METHOD'];

function totalCount(): int
{
    return (int) db()->query('SELECT COUNT(*) AS c FROM gratitude_entries')->fetch()['c'];
}

// Returns a normalized style array, or null for "default look". Anything that
// isn't on the whitelist is dropped, since it's rendered into a style attribute.
function normalizeStyle($raw): ?array
{
    if (is_string($raw)) {
        $raw = json_decode($raw, true);
    }
    if (!is_array($raw)) {
        return null;
    }
    $style = [
        'font' => in_array($raw['font'] ?? '', FONT_KEYS, true) ? $raw['font'] : 'quicksand',
        'size' => in_array($raw['size'] ?? '', SIZE_KEYS, true) ? $raw['size'] : 'm',
        'color' => isValidColor((string) ($raw['color'] ?? '')) ? $raw['color'] : null,
        'bold' => !empty($raw['bold']) ? 1 : 0,
        'italic' => !empty($raw['italic']) ? 1 : 0,
    ];
    return $style;
}

function withPhotos(array $rows): array
{
    if (!$rows) {
        return $rows;
    }
    $ids = array_map(fn($r) => (int) $r['id'], $rows);
    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $stmt = db()->prepare(
        "SELECT id, entry_id FROM gratitude_photos WHERE entry_id IN ($placeholders) ORDER BY sort_order ASC, id ASC"
    );
    $stmt->execute($ids);
    $byEntry = [];
    foreach ($stmt->fetchAll() as $p) {
        $byEntry[(int) $p['entry_id']][] = (int) $p['id'];
    }
    return array_map(function ($r) use ($byEntry) {
        $id = (int) $r['id'];
        return [
            'id' => $id,
            'text' => $r['text'],
            'style' => $r['style'] ? json_decode($r['style'], true) : null,
            'photos' => $byEntry[$id] ?? [],
            'created_at' => $r['created_at'],
        ];
    }, $rows);
}

function photoDir(): string
{
    $dir = dirname(__DIR__) . '/uploads/gratitude';
    if (!is_dir($dir) && !mkdir($dir, 0755, true) && !is_dir($dir)) {
        throw new RuntimeException('Could not create uploads folder');
    }
    return $dir;
}

// Flattens PHP's $_FILES['photos'] (name[]/tmp_name[]/...) into a list of files.
function uploadedPhotos(): array
{
    $f = $_FILES['photos'] ?? null;
    if (!$f || !is_array($f['tmp_name'])) {
        return [];
    }
    $out = [];
    foreach ($f['tmp_name'] as $i => $tmp) {
        $out[] = ['tmp' => $tmp, 'error' => $f['error'][$i], 'size' => $f['size'][$i]];
    }
    return $out;
}

if ($method === 'GET') {
    if (($_GET['action'] ?? '') === 'random') {
        $row = db()->query('SELECT id, text, style, created_at FROM gratitude_entries ORDER BY RAND() LIMIT 1')->fetch();
        respond(['entry' => $row ? withPhotos([$row])[0] : null]);
    }

    $limit = min(500, max(1, (int) ($_GET['limit'] ?? 200)));
    $rows = db()
        ->query("SELECT id, text, style, created_at FROM gratitude_entries ORDER BY created_at DESC LIMIT $limit")
        ->fetchAll();
    respond(['entries' => withPhotos($rows), 'count' => totalCount()]);
}

if ($method === 'POST') {
    $isMultipart = stripos($_SERVER['CONTENT_TYPE'] ?? '', 'multipart/form-data') === 0;
    $body = $isMultipart ? $_POST : bodyJson();
    $text = trim((string) ($body['text'] ?? ''));
    $style = normalizeStyle($body['style'] ?? null);
    $photos = $isMultipart ? uploadedPhotos() : [];

    if ($text === '' && !$photos) {
        fail('Add some text or a photo');
    }
    if (mb_strlen($text) > 500) {
        fail('Keep it under 500 characters');
    }
    if (count($photos) > MAX_PHOTOS) {
        fail('Up to ' . MAX_PHOTOS . ' photos per note');
    }

    $validated = [];
    foreach ($photos as $p) {
        if ($p['error'] !== UPLOAD_ERR_OK) {
            fail('A photo failed to upload — try again');
        }
        if ($p['size'] > MAX_PHOTO_BYTES) {
            fail('A photo is too large');
        }
        $info = @getimagesize($p['tmp']);
        $mime = $info['mime'] ?? '';
        if (!isset(PHOTO_TYPES[$mime])) {
            fail('Photos must be JPEG, PNG or WebP images');
        }
        $validated[] = ['tmp' => $p['tmp'], 'ext' => PHOTO_TYPES[$mime]];
    }

    $pdo = db();
    $moved = [];
    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare('INSERT INTO gratitude_entries (text, style) VALUES (?, ?)');
        $stmt->execute([$text, $style ? json_encode($style) : null]);
        $entryId = (int) $pdo->lastInsertId();

        if ($validated) {
            $dir = photoDir();
            $photoStmt = $pdo->prepare('INSERT INTO gratitude_photos (entry_id, filename, sort_order) VALUES (?, ?, ?)');
            foreach ($validated as $i => $p) {
                $filename = bin2hex(random_bytes(16)) . '.' . $p['ext'];
                if (!move_uploaded_file($p['tmp'], "$dir/$filename")) {
                    throw new RuntimeException('Could not store photo');
                }
                $moved[] = "$dir/$filename";
                $photoStmt->execute([$entryId, $filename, $i]);
            }
        }
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        foreach ($moved as $path) {
            @unlink($path);
        }
        throw $e;
    }

    respond(['id' => $entryId, 'count' => totalCount()], 201);
}

if ($method === 'DELETE') {
    $id = (int) ($_GET['id'] ?? 0);
    if ($id <= 0) {
        fail('id is required');
    }
    $stmt = db()->prepare('SELECT filename FROM gratitude_photos WHERE entry_id = ?');
    $stmt->execute([$id]);
    $files = $stmt->fetchAll(PDO::FETCH_COLUMN);

    $stmt = db()->prepare('DELETE FROM gratitude_entries WHERE id = ?');
    $stmt->execute([$id]);

    $dir = dirname(__DIR__) . '/uploads/gratitude';
    foreach ($files as $filename) {
        if (preg_match('/^[a-f0-9]{32}\.(jpg|png|webp)$/', $filename)) {
            @unlink("$dir/$filename");
        }
    }
    respond(['ok' => true, 'count' => totalCount()]);
}

fail('Method not allowed', 405);
