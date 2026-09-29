<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/lib.php';

requireAuth();

const DEFAULT_MOODS = [
    ['Poor', '😞', '#E8849A', 1],
    ['Neutral', '😐', '#E8C25B', 3],
    ['Good', '😊', '#6CC4A0', 5],
];

$method = $_SERVER['REQUEST_METHOD'];

function allOptions(): array
{
    $rows = db()->query(
        'SELECT id, label, emoji, color, score, sort_order, active FROM mood_options ORDER BY sort_order ASC, id ASC'
    )->fetchAll();
    if (!$rows) {
        $stmt = db()->prepare('INSERT INTO mood_options (label, emoji, color, score, sort_order) VALUES (?, ?, ?, ?, ?)');
        foreach (DEFAULT_MOODS as $i => [$label, $emoji, $color, $score]) {
            $stmt->execute([$label, $emoji, $color, $score, $i]);
        }
        return allOptions();
    }
    return array_map(fn($r) => [
        'id' => (int) $r['id'],
        'label' => $r['label'],
        'emoji' => $r['emoji'],
        'color' => $r['color'],
        'score' => (int) $r['score'],
        'active' => (int) $r['active'],
    ], $rows);
}

function checkinsFor(string $date): array
{
    $stmt = db()->prepare(
        'SELECT id, option_id, score, note, logged_time FROM mood_checkins WHERE entry_date = ? ORDER BY logged_time ASC, id ASC'
    );
    $stmt->execute([$date]);
    return array_map(fn($r) => [
        'id' => (int) $r['id'],
        'option_id' => (int) $r['option_id'],
        'score' => (int) $r['score'],
        'note' => $r['note'] ?? '',
        'time' => substr($r['logged_time'], 0, 5),
    ], $stmt->fetchAll());
}

// Daily average of check-in scores between two dates (inclusive); days with
// no check-ins are left out of the map.
function dailyAverages(string $start, string $end): array
{
    $stmt = db()->prepare(
        'SELECT entry_date, AVG(score) AS avg_score, COUNT(*) AS n FROM mood_checkins
         WHERE entry_date BETWEEN ? AND ? GROUP BY entry_date'
    );
    $stmt->execute([$start, $end]);
    $out = [];
    foreach ($stmt->fetchAll() as $r) {
        $out[$r['entry_date']] = ['avg' => round((float) $r['avg_score'], 2), 'count' => (int) $r['n']];
    }
    return $out;
}

function meanOfDays(array $byDate): ?float
{
    if (!$byDate) {
        return null;
    }
    return round(array_sum(array_column($byDate, 'avg')) / count($byDate), 2);
}

function validOptionFields(array $body): array
{
    $label = trim((string) ($body['label'] ?? ''));
    $emoji = trim((string) ($body['emoji'] ?? ''));
    $color = (string) ($body['color'] ?? '');
    $score = (int) ($body['score'] ?? 0);
    if ($label === '' || mb_strlen($label) > 40) {
        fail('Give the mood a name (up to 40 characters)');
    }
    if ($emoji === '' || mb_strlen($emoji) > 8) {
        fail('Pick an emoji for the mood');
    }
    if (!isValidColor($color)) {
        fail('Pick a color for the mood');
    }
    if ($score < 1 || $score > 5) {
        fail('Score must be between 1 and 5');
    }
    return [$label, $emoji, $color, $score];
}

if ($method === 'GET') {
    $action = $_GET['action'] ?? '';

    if ($action === 'stats') {
        $start = (string) ($_GET['start'] ?? '');
        $end = (string) ($_GET['end'] ?? '');
        if (!isValidDate($start) || !isValidDate($end) || $start > $end) {
            fail('Valid start/end are required');
        }

        $byDate = dailyAverages($start, $end);
        $days = [];
        $period = new DatePeriod(new DateTime($start), new DateInterval('P1D'), (new DateTime($end))->modify('+1 day'));
        foreach ($period as $dt) {
            $d = $dt->format('Y-m-d');
            $days[] = ['date' => $d, 'avg' => $byDate[$d]['avg'] ?? null, 'count' => $byDate[$d]['count'] ?? 0];
        }

        $length = count($days);
        $prevEnd = (new DateTime($start))->modify('-1 day')->format('Y-m-d');
        $prevStart = (new DateTime($start))->modify("-$length days")->format('Y-m-d');

        $stmt = db()->prepare(
            'SELECT option_id, COUNT(*) AS n FROM mood_checkins WHERE entry_date BETWEEN ? AND ? GROUP BY option_id'
        );
        $stmt->execute([$start, $end]);
        $countsByOption = [];
        foreach ($stmt->fetchAll() as $r) {
            $countsByOption[(int) $r['option_id']] = (int) $r['n'];
        }
        $total = array_sum($countsByOption);
        $distribution = [];
        foreach (allOptions() as $opt) {
            $n = $countsByOption[$opt['id']] ?? 0;
            if (!$opt['active'] && $n === 0) {
                continue;
            }
            $distribution[] = $opt + ['count' => $n, 'percent' => $total ? (int) round($n / $total * 100) : 0];
        }

        respond([
            'start' => $start,
            'end' => $end,
            'days' => $days,
            'distribution' => $distribution,
            'totalCheckins' => $total,
            'daysLogged' => count($byDate),
            'avg' => meanOfDays($byDate),
            'prevAvg' => meanOfDays(dailyAverages($prevStart, $prevEnd)),
        ]);
    }

    $date = (string) ($_GET['date'] ?? '');
    if (!isValidDate($date)) {
        fail('Valid date=YYYY-MM-DD is required');
    }
    respond(['date' => $date, 'options' => allOptions(), 'checkins' => checkinsFor($date)]);
}

if ($method === 'POST') {
    $body = bodyJson();
    $action = $body['action'] ?? '';

    if ($action === 'checkin') {
        $date = (string) ($body['date'] ?? '');
        $time = (string) ($body['time'] ?? '');
        $optionId = (int) ($body['option_id'] ?? 0);
        $note = trim((string) ($body['note'] ?? ''));
        if (!isValidDate($date) || !preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $time)) {
            fail('Valid date and time are required');
        }
        if (mb_strlen($note) > 280) {
            fail('Keep the note under 280 characters');
        }
        $stmt = db()->prepare('SELECT score FROM mood_options WHERE id = ?');
        $stmt->execute([$optionId]);
        $score = $stmt->fetchColumn();
        if ($score === false) {
            fail('Unknown mood');
        }
        $stmt = db()->prepare(
            'INSERT INTO mood_checkins (entry_date, logged_time, option_id, score, note) VALUES (?, ?, ?, ?, ?)'
        );
        $stmt->execute([$date, $time, $optionId, (int) $score, $note === '' ? null : $note]);
        respond(['id' => (int) db()->lastInsertId()], 201);
    }

    if ($action === 'option-save') {
        [$label, $emoji, $color, $score] = validOptionFields($body);
        $id = (int) ($body['id'] ?? 0);
        if ($id > 0) {
            $stmt = db()->prepare('UPDATE mood_options SET label = ?, emoji = ?, color = ?, score = ? WHERE id = ?');
            $stmt->execute([$label, $emoji, $color, $score, $id]);
        } else {
            $next = (int) db()->query('SELECT COALESCE(MAX(sort_order), -1) + 1 FROM mood_options')->fetchColumn();
            $stmt = db()->prepare('INSERT INTO mood_options (label, emoji, color, score, sort_order) VALUES (?, ?, ?, ?, ?)');
            $stmt->execute([$label, $emoji, $color, $score, $next]);
        }
        respond(['options' => allOptions()]);
    }

    if ($action === 'option-remove') {
        $active = (int) db()->query('SELECT COUNT(*) FROM mood_options WHERE active = 1')->fetchColumn();
        if ($active <= 1) {
            fail('Keep at least one mood');
        }
        // Soft delete, so past check-ins that used this mood keep their label/emoji.
        $stmt = db()->prepare('UPDATE mood_options SET active = 0 WHERE id = ?');
        $stmt->execute([(int) ($body['id'] ?? 0)]);
        respond(['options' => allOptions()]);
    }

    if ($action === 'option-reorder') {
        $order = $body['order'] ?? [];
        if (!is_array($order)) {
            fail('order must be a list of ids');
        }
        $stmt = db()->prepare('UPDATE mood_options SET sort_order = ? WHERE id = ?');
        foreach (array_values($order) as $i => $id) {
            $stmt->execute([$i, (int) $id]);
        }
        respond(['options' => allOptions()]);
    }

    fail('Unknown action');
}

if ($method === 'DELETE') {
    $id = (int) ($_GET['id'] ?? 0);
    if ($id <= 0) {
        fail('id is required');
    }
    $stmt = db()->prepare('DELETE FROM mood_checkins WHERE id = ?');
    $stmt->execute([$id]);
    respond(['ok' => true]);
}

fail('Method not allowed', 405);
