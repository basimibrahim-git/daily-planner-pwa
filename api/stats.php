<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/lib.php';

requireAuth();

$end = (string) ($_GET['end'] ?? (new DateTime('today'))->format('Y-m-d'));
$start = (string) ($_GET['start'] ?? '');
if ($start === '') {
    $days = max(1, (int) ($_GET['days'] ?? 30));
    $start = (new DateTime($end))->modify("-" . ($days - 1) . " days")->format('Y-m-d');
}
if (!isValidDate($start) || !isValidDate($end) || $start > $end) {
    fail('Valid start/end (or days=) are required');
}

$items = db()->query(
    'SELECT id, category, label, icon, type, target_value, unit, counts_toward_streak, has_checkbox, has_counter
     FROM items WHERE active = 1 ORDER BY sort_order ASC, id ASC'
)->fetchAll();
$itemsById = [];
foreach ($items as $item) {
    $itemsById[(int) $item['id']] = $item;
}
$totalItems = count($items);
$streakItems = array_values(array_filter($items, fn($i) => (int) $i['counts_toward_streak'] === 1));
$streakTotal = count($streakItems);

$stmt = db()->prepare('SELECT entry_date, item_id, value FROM entries WHERE entry_date BETWEEN ? AND ?');
$stmt->execute([$start, $end]);
$rows = $stmt->fetchAll();

$doneByDate = [];
$streakDoneByDate = [];
$doneByItem = array_fill_keys(array_keys($itemsById), 0);
$countSumByItem = array_fill_keys(array_keys($itemsById), 0.0);
$doneByCategory = [];

foreach ($rows as $row) {
    $id = (int) $row['item_id'];
    $item = $itemsById[$id] ?? null;
    if (!$item) {
        continue;
    }
    $countSumByItem[$id] += entryCount($item, $row['value']);
    if (!isEntryDone($item, $row['value'])) {
        continue;
    }
    $date = $row['entry_date'];
    $doneByDate[$date] = ($doneByDate[$date] ?? 0) + 1;
    $doneByItem[$id]++;
    $doneByCategory[$item['category']] = ($doneByCategory[$item['category']] ?? 0) + 1;
    if ((int) $item['counts_toward_streak'] === 1) {
        $streakDoneByDate[$date] = ($streakDoneByDate[$date] ?? 0) + 1;
    }
}

$trend = [];
$orderedDates = [];
$streakComplete = [];
$period = new DatePeriod(new DateTime($start), new DateInterval('P1D'), (new DateTime($end))->modify('+1 day'));
foreach ($period as $dt) {
    $date = $dt->format('Y-m-d');
    $orderedDates[] = $date;
    $done = $doneByDate[$date] ?? 0;
    $percent = $totalItems > 0 ? round(($done / $totalItems) * 100) : 0;
    $trend[] = ['date' => $date, 'percent' => $percent];

    $streakDone = $streakDoneByDate[$date] ?? 0;
    $streakComplete[$date] = $streakTotal > 0 && $streakDone >= $streakTotal;
}
$dayCount = count($orderedDates);

[$currentStreak, $bestStreak] = $streakTotal > 0
    ? computeStreaks($orderedDates, $streakComplete, $start)
    : [0, 0];

$categoriesOut = [];
$categoryItemCounts = [];
foreach ($items as $item) {
    $categoryItemCounts[$item['category']] = ($categoryItemCounts[$item['category']] ?? 0) + 1;
}
foreach ($categoryItemCounts as $cat => $count) {
    $done = $doneByCategory[$cat] ?? 0;
    $possible = $count * $dayCount;
    $categoriesOut[] = [
        'category' => $cat,
        'percent' => $possible > 0 ? round(($done / $possible) * 100) : 0,
    ];
}
usort($categoriesOut, fn($a, $b) => $b['percent'] <=> $a['percent']);

$itemsOut = [];
foreach ($items as $item) {
    $id = (int) $item['id'];
    $itemsOut[] = [
        'id' => $id,
        'label' => $item['label'],
        'category' => $item['category'],
        'percent' => $dayCount > 0 ? round((($doneByItem[$id] ?? 0) / $dayCount) * 100) : 0,
    ];
}
usort($itemsOut, fn($a, $b) => $b['percent'] <=> $a['percent']);

$prayerQuranItems = [];
foreach ($streakItems as $item) {
    $id = (int) $item['id'];
    $prayerQuranItems[] = [
        'id' => $id,
        'label' => $item['label'],
        'percent' => $dayCount > 0 ? round((($doneByItem[$id] ?? 0) / $dayCount) * 100) : 0,
        'countTotal' => round($countSumByItem[$id] ?? 0, 2),
        'unit' => $item['unit'],
    ];
}

respond([
    'start' => $start,
    'end' => $end,
    'trend' => $trend,
    'categories' => $categoriesOut,
    'items' => $itemsOut,
    'prayerQuran' => [
        'currentStreak' => $currentStreak,
        'bestStreak' => $bestStreak,
        'items' => $prayerQuranItems,
    ],
]);
