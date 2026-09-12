<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';

requireAuth();

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    if (($_GET['action'] ?? '') === 'random') {
        $row = db()->query('SELECT id, text, created_at FROM gratitude_entries ORDER BY RAND() LIMIT 1')->fetch();
        respond(['entry' => $row ?: null]);
    }

    $count = (int) db()->query('SELECT COUNT(*) AS c FROM gratitude_entries')->fetch()['c'];
    $limit = min(500, max(1, (int) ($_GET['limit'] ?? 200)));
    $rows = db()
        ->query("SELECT id, text, created_at FROM gratitude_entries ORDER BY created_at DESC LIMIT $limit")
        ->fetchAll();
    respond(['entries' => $rows, 'count' => $count]);
}

if ($method === 'POST') {
    $body = bodyJson();
    $text = trim((string) ($body['text'] ?? ''));
    if ($text === '') {
        fail('text is required');
    }
    if (mb_strlen($text) > 500) {
        fail('Keep it under 500 characters');
    }
    $stmt = db()->prepare('INSERT INTO gratitude_entries (text) VALUES (?)');
    $stmt->execute([$text]);
    $count = (int) db()->query('SELECT COUNT(*) AS c FROM gratitude_entries')->fetch()['c'];
    respond(['id' => (int) db()->lastInsertId(), 'count' => $count], 201);
}

if ($method === 'DELETE') {
    $id = (int) ($_GET['id'] ?? 0);
    if ($id <= 0) {
        fail('id is required');
    }
    $stmt = db()->prepare('DELETE FROM gratitude_entries WHERE id = ?');
    $stmt->execute([$id]);
    $count = (int) db()->query('SELECT COUNT(*) AS c FROM gratitude_entries')->fetch()['c'];
    respond(['ok' => true, 'count' => $count]);
}

fail('Method not allowed', 405);
