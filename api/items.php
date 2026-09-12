<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';

requireAuth();

$method = $_SERVER['REQUEST_METHOD'];
$allowedTypes = ['standard', 'text'];

if ($method === 'GET') {
    $rows = db()->query(
        'SELECT id, category, label, icon, type, target_value, unit, sort_order, counts_toward_streak, has_checkbox, has_counter
         FROM items WHERE active = 1 ORDER BY sort_order ASC, id ASC'
    )->fetchAll();
    respond(['items' => $rows]);
}

if ($method === 'POST') {
    $body = bodyJson();

    if (($body['action'] ?? '') === 'reorder') {
        $order = $body['order'] ?? [];
        if (!is_array($order)) {
            fail('order must be an array of item ids');
        }
        $stmt = db()->prepare('UPDATE items SET sort_order = ? WHERE id = ?');
        foreach (array_values($order) as $index => $id) {
            $stmt->execute([$index, (int) $id]);
        }
        respond(['ok' => true]);
    }

    $category = trim((string) ($body['category'] ?? ''));
    $label = trim((string) ($body['label'] ?? ''));
    $icon = trim((string) ($body['icon'] ?? 'star'));
    $type = (string) ($body['type'] ?? 'standard');
    $target = $body['target_value'] ?? null;
    $unit = $body['unit'] ?? null;
    $countsTowardStreak = !empty($body['counts_toward_streak']) ? 1 : 0;
    $hasCheckbox = array_key_exists('has_checkbox', $body) ? (!empty($body['has_checkbox']) ? 1 : 0) : 1;
    $hasCounter = array_key_exists('has_counter', $body) ? (!empty($body['has_counter']) ? 1 : 0) : 1;

    if ($category === '' || $label === '') {
        fail('category and label are required');
    }
    if (!in_array($type, $allowedTypes, true)) {
        fail('Invalid type');
    }

    $maxOrder = (int) db()->query('SELECT COALESCE(MAX(sort_order), -1) AS m FROM items')->fetch()['m'];

    $stmt = db()->prepare(
        'INSERT INTO items (category, label, icon, type, target_value, unit, counts_toward_streak, has_checkbox, has_counter, sort_order, active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)'
    );
    $stmt->execute([$category, $label, $icon, $type, $target, $unit, $countsTowardStreak, $hasCheckbox, $hasCounter, $maxOrder + 1]);

    respond(['id' => (int) db()->lastInsertId()], 201);
}

if ($method === 'PUT') {
    $body = bodyJson();
    $id = (int) ($body['id'] ?? 0);
    if ($id <= 0) {
        fail('id is required');
    }

    $fields = [];
    $params = [];
    foreach (['category', 'label', 'icon', 'target_value', 'unit'] as $field) {
        if (array_key_exists($field, $body)) {
            $fields[] = "$field = ?";
            $params[] = $body[$field];
        }
    }
    if (array_key_exists('type', $body)) {
        if (!in_array($body['type'], $allowedTypes, true)) {
            fail('Invalid type');
        }
        $fields[] = 'type = ?';
        $params[] = $body['type'];
    }
    if (array_key_exists('counts_toward_streak', $body)) {
        $fields[] = 'counts_toward_streak = ?';
        $params[] = !empty($body['counts_toward_streak']) ? 1 : 0;
    }
    if (array_key_exists('has_checkbox', $body)) {
        $fields[] = 'has_checkbox = ?';
        $params[] = !empty($body['has_checkbox']) ? 1 : 0;
    }
    if (array_key_exists('has_counter', $body)) {
        $fields[] = 'has_counter = ?';
        $params[] = !empty($body['has_counter']) ? 1 : 0;
    }
    if (empty($fields)) {
        fail('No fields to update');
    }
    $params[] = $id;

    $stmt = db()->prepare('UPDATE items SET ' . implode(', ', $fields) . ' WHERE id = ?');
    $stmt->execute($params);

    respond(['ok' => true]);
}

if ($method === 'DELETE') {
    $id = (int) ($_GET['id'] ?? 0);
    if ($id <= 0) {
        fail('id is required');
    }
    $stmt = db()->prepare('UPDATE items SET active = 0 WHERE id = ?');
    $stmt->execute([$id]);
    respond(['ok' => true]);
}

fail('Method not allowed', 405);
