<?php
declare(strict_types=1);

// Brings the database up to date automatically on the first API request after
// a deploy, so upgrades never need a manual phpMyAdmin step. Every statement
// is safe to re-run (MariaDB IF [NOT] EXISTS), and the current version is
// kept in app_config.schema_version.
const MIGRATIONS = [
    2 => [
        'ALTER TABLE gratitude_entries ADD COLUMN IF NOT EXISTS style TEXT DEFAULT NULL AFTER text',
        'ALTER TABLE gratitude_entries MODIFY COLUMN style TEXT DEFAULT NULL',
        'CREATE TABLE IF NOT EXISTS gratitude_photos (
          id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          entry_id INT UNSIGNED NOT NULL,
          filename VARCHAR(64) NOT NULL,
          sort_order TINYINT NOT NULL DEFAULT 0,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          KEY idx_entry (entry_id),
          CONSTRAINT fk_photo_entry FOREIGN KEY (entry_id) REFERENCES gratitude_entries(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4',
        'CREATE TABLE IF NOT EXISTS mood_options (
          id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          label VARCHAR(40) NOT NULL,
          emoji VARCHAR(16) NOT NULL,
          color VARCHAR(40) NOT NULL,
          score TINYINT NOT NULL,
          sort_order INT NOT NULL DEFAULT 0,
          active TINYINT(1) NOT NULL DEFAULT 1,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4',
        'CREATE TABLE IF NOT EXISTS mood_checkins (
          id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          entry_date DATE NOT NULL,
          logged_time TIME NOT NULL,
          option_id INT UNSIGNED NOT NULL,
          score TINYINT NOT NULL,
          note VARCHAR(280) DEFAULT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          KEY idx_mood_date (entry_date),
          CONSTRAINT fk_checkin_option FOREIGN KEY (option_id) REFERENCES mood_options(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4',
        // The doodle feature was removed: strip saved drawings (text notes stay).
        "UPDATE entries SET value = JSON_REMOVE(value, '$.doodle')
          WHERE JSON_VALID(value) AND JSON_CONTAINS_PATH(value, 'one', '$.doodle')",
        'ALTER TABLE daily_notes DROP COLUMN IF EXISTS doodle',
    ],
];

function schemaVersion(PDO $pdo): int
{
    $value = $pdo->query("SELECT `value` FROM app_config WHERE `key` = 'schema_version'")->fetchColumn();
    return $value === false ? 1 : (int) $value;
}

function runMigrations(): void
{
    $pdo = db();
    $latest = max(array_keys(MIGRATIONS));
    if (schemaVersion($pdo) >= $latest) {
        return;
    }
    if (!(int) $pdo->query("SELECT GET_LOCK('planner_migrate', 15)")->fetchColumn()) {
        return; // another request is migrating right now
    }
    try {
        $current = schemaVersion($pdo);
        foreach (MIGRATIONS as $version => $statements) {
            if ($version <= $current) {
                continue;
            }
            foreach ($statements as $sql) {
                $pdo->exec($sql);
            }
            $stmt = $pdo->prepare(
                "INSERT INTO app_config (`key`, `value`) VALUES ('schema_version', ?)
                 ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)"
            );
            $stmt->execute([(string) $version]);
        }
    } finally {
        $pdo->query("SELECT RELEASE_LOCK('planner_migrate')");
    }
}
