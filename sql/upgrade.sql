-- Upgrades an existing Daily Planner database (MariaDB, e.g. Hostinger) to the
-- current schema. Safe to run more than once. Run it in phpMyAdmin after
-- uploading the new files.
--
-- Adds: gratitude note styles + photos, Mood tracking.
-- Removes: saved doodles (the doodle feature is gone). This part is permanent.

ALTER TABLE gratitude_entries ADD COLUMN IF NOT EXISTS style VARCHAR(255) DEFAULT NULL AFTER text;

CREATE TABLE IF NOT EXISTS gratitude_photos (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  entry_id INT UNSIGNED NOT NULL,
  filename VARCHAR(64) NOT NULL,
  sort_order TINYINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_entry (entry_id),
  CONSTRAINT fk_photo_entry FOREIGN KEY (entry_id) REFERENCES gratitude_entries(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS mood_options (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  label VARCHAR(40) NOT NULL,
  emoji VARCHAR(16) NOT NULL,
  color VARCHAR(40) NOT NULL,
  score TINYINT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS mood_checkins (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  entry_date DATE NOT NULL,
  logged_time TIME NOT NULL,
  option_id INT UNSIGNED NOT NULL,
  score TINYINT NOT NULL,
  note VARCHAR(280) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_mood_date (entry_date),
  CONSTRAINT fk_checkin_option FOREIGN KEY (option_id) REFERENCES mood_options(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Doodle cleanup: strip the drawing from checklist entries (text notes, ticks
-- and counts are kept), then drop the daily-notes doodle column.
UPDATE entries
   SET value = JSON_REMOVE(value, '$.doodle')
 WHERE JSON_VALID(value) AND JSON_CONTAINS_PATH(value, 'one', '$.doodle');

ALTER TABLE daily_notes DROP COLUMN IF EXISTS doodle;
