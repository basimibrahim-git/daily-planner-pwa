-- Daily Planner PWA — database schema (fresh install)
-- Import this via phpMyAdmin (or `mysql -u user -p dbname < schema.sql`) on Hostinger.
--
-- Already have this app deployed with real data? Do NOT re-run this file —
-- use sql/migrate.sql instead, which upgrades an existing database in place
-- without touching your existing rows.

CREATE TABLE IF NOT EXISTS app_config (
  `key` VARCHAR(50) NOT NULL PRIMARY KEY,
  `value` TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS items (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  category VARCHAR(80) NOT NULL,
  label VARCHAR(150) NOT NULL,
  icon VARCHAR(40) NOT NULL DEFAULT 'star',
  type ENUM('standard','text') NOT NULL DEFAULT 'standard',
  has_checkbox TINYINT(1) NOT NULL DEFAULT 1,
  has_counter TINYINT(1) NOT NULL DEFAULT 1,
  target_value VARCHAR(50) DEFAULT NULL,
  unit VARCHAR(20) DEFAULT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  active TINYINT(1) NOT NULL DEFAULT 1,
  counts_toward_streak TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS entries (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  entry_date DATE NOT NULL,
  item_id INT UNSIGNED NOT NULL,
  value LONGTEXT DEFAULT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_date_item (entry_date, item_id),
  KEY idx_entry_date (entry_date),
  CONSTRAINT fk_entries_item FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS daily_notes (
  entry_date DATE NOT NULL PRIMARY KEY,
  note TEXT DEFAULT NULL,
  doodle LONGTEXT DEFAULT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS gratitude_entries (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  text TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS duas (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  category VARCHAR(200) NOT NULL,
  arabic TEXT NOT NULL,
  transliteration TEXT,
  translation TEXT NOT NULL,
  repeat_count INT NOT NULL DEFAULT 1,
  source VARCHAR(150) NOT NULL DEFAULT 'Hisnul Muslim (Fortress of the Muslim)',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS dua_favorites (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  dua_id INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_dua (dua_id),
  CONSTRAINT fk_favorite_dua FOREIGN KEY (dua_id) REFERENCES duas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- After importing this schema, also run the one-time dua import — see
-- "Importing the dua library" in README.md.
