<?php
declare(strict_types=1);

function isValidDate(string $date): bool
{
    $d = DateTime::createFromFormat('Y-m-d', $date);
    return $d && $d->format('Y-m-d') === $date;
}

// 'standard' items store their entry value as JSON: {"checked":0|1,"count":number}.
// 'text' items store their entry value as a plain string.
function decodeStandardValue(?string $raw): array
{
    if ($raw === null || $raw === '') {
        return ['checked' => 0, 'count' => 0.0];
    }
    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        return ['checked' => 0, 'count' => 0.0];
    }
    return [
        'checked' => !empty($decoded['checked']) ? 1 : 0,
        'count' => isset($decoded['count']) && is_numeric($decoded['count']) ? (float) $decoded['count'] : 0.0,
    ];
}

// $item needs: type, has_checkbox, has_counter, target_value.
// When an item shows both controls, its checkbox is authoritative for
// "done" (matches the app's rule that the counter never gates the checkbox).
// When only the counter is shown, reaching the target (or any count if no
// target is set) is what counts as done instead.
function isEntryDone(array $item, ?string $value): bool
{
    if ($item['type'] === 'text') {
        return $value !== null && trim($value) !== '';
    }
    $decoded = decodeStandardValue($value);
    if (!empty($item['has_checkbox'])) {
        return $decoded['checked'] === 1;
    }
    if (!empty($item['has_counter'])) {
        $target = $item['target_value'] ?? null;
        if ($target !== null && is_numeric($target)) {
            return $decoded['count'] >= (float) $target;
        }
        return $decoded['count'] > 0;
    }
    return false;
}

function entryCount(array $item, ?string $value): float
{
    if ($item['type'] !== 'standard') {
        return 0.0;
    }
    return decodeStandardValue($value)['count'];
}

// Given an ordered list of date strings and a map of date => bool ("fully complete"
// that day), returns the current streak (consecutive complete days ending today,
// where an incomplete "today" simply isn't counted yet rather than breaking the
// streak) and the best streak found anywhere in the range.
function computeStreaks(array $orderedDates, array $completeByDate, string $rangeStart): array
{
    $today = (new DateTime('today'))->format('Y-m-d');

    $currentStreak = 0;
    $cursor = new DateTime($today);
    while (true) {
        $key = $cursor->format('Y-m-d');
        $complete = $completeByDate[$key] ?? false;
        if ($key === $today && !$complete) {
            $cursor->modify('-1 day');
            continue;
        }
        if (!$complete) {
            break;
        }
        $currentStreak++;
        $cursor->modify('-1 day');
        if ($cursor->format('Y-m-d') < $rangeStart) {
            break;
        }
    }

    $bestStreak = 0;
    $running = 0;
    foreach ($orderedDates as $date) {
        if ($completeByDate[$date] ?? false) {
            $running++;
            $bestStreak = max($bestStreak, $running);
        } else {
            $running = 0;
        }
    }

    return [$currentStreak, $bestStreak];
}
