<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/lib.php';

requireAuth();

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $date = (string) ($_GET['date'] ?? '');
    if (!isValidDate($date)) {
        fail('Valid date=YYYY-MM-DD is required');
    }

    $items = db()->query(
        'SELECT id, category, label, icon, type, target_value, unit, sort_order
         FROM items WHERE active = 1 ORDER BY sort_order ASC, id ASC'
    )->fetchAll();

    $stmt = db()->prepare('SELECT item_id, value FROM entries WHERE entry_date = ?');
    $stmt->execute([$date]);
    $entries = [];
    foreach ($stmt->fetchAll() as $row) {
        $entries[(int) $row['item_id']] = $row['value'];
    }

    $noteStmt = db()->prepare('SELECT note FROM daily_notes WHERE entry_date = ?');
    $noteStmt->execute([$date]);
    $noteRow = $noteStmt->fetch();

    respond([
        'date' => $date,
        'items' => $items,
        'entries' => $entries,
        'note' => $noteRow ? $noteRow['note'] : '',
    ]);
}

if ($method === 'POST') {
    $body = bodyJson();
    $action = $body['action'] ?? 'set-entry';

    if ($action === 'note') {
        $date = (string) ($body['date'] ?? '');
        if (!isValidDate($date)) {
            fail('Valid date is required');
        }
        $note = (string) ($body['note'] ?? '');
        $stmt = db()->prepare(
            'INSERT INTO daily_notes (entry_date, note) VALUES (?, ?)
             ON DUPLICATE KEY UPDATE note = VALUES(note)'
        );
        $stmt->execute([$date, $note]);
        respond(['ok' => true]);
    }

    $date = (string) ($body['date'] ?? '');
    $itemId = (int) ($body['item_id'] ?? 0);
    if (!isValidDate($date) || $itemId <= 0) {
        fail('Valid date and item_id are required');
    }
    $value = $body['value'] ?? null;

    if ($value === null || $value === '') {
        $stmt = db()->prepare('DELETE FROM entries WHERE entry_date = ? AND item_id = ?');
        $stmt->execute([$date, $itemId]);
    } else {
        $stmt = db()->prepare(
            'INSERT INTO entries (entry_date, item_id, value) VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE value = VALUES(value)'
        );
        $stmt->execute([$date, $itemId, (string) $value]);
    }

    respond(['ok' => true]);
}

fail('Method not allowed', 405);
