<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/lib.php';

requireAuth();

$start = (string) ($_GET['start'] ?? '');
$end = (string) ($_GET['end'] ?? '');
if (!isValidDate($start) || !isValidDate($end) || $start > $end) {
    fail('Valid start and end (YYYY-MM-DD, start <= end) are required');
}

$items = db()->query(
    'SELECT id, type, counts_toward_streak, has_checkbox, has_counter, target_value FROM items WHERE active = 1'
)->fetchAll();
$itemsById = [];
foreach ($items as $item) {
    $itemsById[(int) $item['id']] = $item;
}
$totalItems = count($items);
$streakTotal = count(array_filter($items, fn($i) => (int) $i['counts_toward_streak'] === 1));

$stmt = db()->prepare(
    'SELECT entry_date, item_id, value FROM entries WHERE entry_date BETWEEN ? AND ?'
);
$stmt->execute([$start, $end]);

$doneByDate = [];
$streakDoneByDate = [];
foreach ($stmt->fetchAll() as $row) {
    $item = $itemsById[(int) $row['item_id']] ?? null;
    if (!$item) {
        continue; // item was removed/deactivated since
    }
    if (isEntryDone($item, $row['value'])) {
        $date = $row['entry_date'];
        $doneByDate[$date] = ($doneByDate[$date] ?? 0) + 1;
        if ((int) $item['counts_toward_streak'] === 1) {
            $streakDoneByDate[$date] = ($streakDoneByDate[$date] ?? 0) + 1;
        }
    }
}

// `days` (used for the calendar heatmap) reflects completion across ALL active
// items. Streaks below are scoped separately, to only the items flagged
// counts_toward_streak (prayers + Quran recitation, by default).
$days = [];
$orderedDates = [];
$streakComplete = [];
$period = new DatePeriod(
    new DateTime($start),
    new DateInterval('P1D'),
    (new DateTime($end))->modify('+1 day')
);
foreach ($period as $dt) {
    $date = $dt->format('Y-m-d');
    $orderedDates[] = $date;
    $done = $doneByDate[$date] ?? 0;
    $percent = $totalItems > 0 ? round(($done / $totalItems) * 100) : 0;
    $days[] = ['date' => $date, 'done' => $done, 'total' => $totalItems, 'percent' => $percent];

    $streakDone = $streakDoneByDate[$date] ?? 0;
    $streakComplete[$date] = $streakTotal > 0 && $streakDone >= $streakTotal;
}

[$currentStreak, $bestStreak] = $streakTotal > 0
    ? computeStreaks($orderedDates, $streakComplete, $start)
    : [0, 0];

respond([
    'days' => $days,
    'currentStreak' => $currentStreak,
    'bestStreak' => $bestStreak,
]);
