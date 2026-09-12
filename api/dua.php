<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';

requireAuth();

function isFavorited(int $duaId): bool
{
    $stmt = db()->prepare('SELECT 1 FROM dua_favorites WHERE dua_id = ?');
    $stmt->execute([$duaId]);
    return (bool) $stmt->fetchColumn();
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $action = $_GET['action'] ?? '';

    if ($action === 'favorites') {
        $rows = db()->query(
            'SELECT d.id, d.category, d.arabic, d.transliteration, d.translation, d.repeat_count, d.source, f.created_at AS favorited_at
             FROM dua_favorites f
             JOIN duas d ON d.id = f.dua_id
             ORDER BY f.created_at DESC'
        )->fetchAll();
        respond(['favorites' => $rows]);
    }

    $total = (int) db()->query('SELECT COUNT(*) AS c FROM duas')->fetch()['c'];
    if ($total === 0) {
        respond(['dua' => null]);
    }

    $dayOfYear = (int) (new DateTime('today'))->format('z');
    $offset = $dayOfYear % $total;

    $stmt = db()->prepare(
        'SELECT id, category, arabic, transliteration, translation, repeat_count, source
         FROM duas ORDER BY id ASC LIMIT 1 OFFSET ' . $offset
    );
    $stmt->execute();
    $dua = $stmt->fetch();
    if ($dua) {
        $dua['isFavorite'] = isFavorited((int) $dua['id']);
    }
    respond(['dua' => $dua ?: null]);
}

if ($method === 'POST') {
    $body = bodyJson();
    $action = $body['action'] ?? '';
    $duaId = (int) ($body['dua_id'] ?? 0);
    if ($duaId <= 0) {
        fail('dua_id is required');
    }

    if ($action === 'favorite') {
        $stmt = db()->prepare('INSERT IGNORE INTO dua_favorites (dua_id) VALUES (?)');
        $stmt->execute([$duaId]);
        respond(['ok' => true]);
    }

    if ($action === 'unfavorite') {
        $stmt = db()->prepare('DELETE FROM dua_favorites WHERE dua_id = ?');
        $stmt->execute([$duaId]);
        respond(['ok' => true]);
    }

    fail('Unknown action');
}

fail('Method not allowed', 405);
