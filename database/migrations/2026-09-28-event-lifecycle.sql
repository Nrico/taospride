-- Taos Pride event lifecycle upgrade.
-- Back up the database first. This migration is restart-safe: it checks every
-- table, column, index, constraint, and its backfill marker before changing it.

CREATE TABLE IF NOT EXISTS event_series (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  title               VARCHAR(200) NOT NULL,
  slug                VARCHAR(200) NOT NULL UNIQUE,
  series_type         ENUM('festival','community','other') DEFAULT 'festival',
  start_at            DATETIME NULL,
  end_at              DATETIME NULL,
  timezone            VARCHAR(64) NOT NULL DEFAULT 'America/Denver',
  description         TEXT,
  publication_status  ENUM('draft','published','archived') NOT NULL DEFAULT 'draft',
  featured            TINYINT(1) NOT NULL DEFAULT 0,
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

DROP PROCEDURE IF EXISTS migrate_taos_pride_event_lifecycle;
DELIMITER //
CREATE PROCEDURE migrate_taos_pride_event_lifecycle()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'events' AND column_name = 'series_id'
  ) THEN
    ALTER TABLE events ADD COLUMN series_id INT NULL AFTER id;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'events' AND column_name = 'event_type'
  ) THEN
    ALTER TABLE events ADD COLUMN event_type VARCHAR(80) NULL AFTER title;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'events' AND column_name = 'start_at'
  ) THEN
    ALTER TABLE events ADD COLUMN start_at DATETIME NULL AFTER event_type;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'events' AND column_name = 'end_at'
  ) THEN
    ALTER TABLE events ADD COLUMN end_at DATETIME NULL AFTER start_at;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'events' AND column_name = 'timezone'
  ) THEN
    ALTER TABLE events ADD COLUMN timezone VARCHAR(64) NOT NULL DEFAULT 'America/Denver' AFTER end_at;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'events' AND column_name = 'publication_status'
  ) THEN
    ALTER TABLE events ADD COLUMN publication_status
      ENUM('draft','published','cancelled','archived') NOT NULL DEFAULT 'draft' AFTER timezone;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'events' AND column_name = 'featured'
  ) THEN
    ALTER TABLE events ADD COLUMN featured TINYINT(1) NOT NULL DEFAULT 0 AFTER publication_status;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'events' AND index_name = 'idx_events_publication_start'
  ) THEN
    ALTER TABLE events ADD INDEX idx_events_publication_start (publication_status, start_at);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'events' AND index_name = 'idx_events_series'
  ) THEN
    ALTER TABLE events ADD INDEX idx_events_series (series_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.key_column_usage
    WHERE table_schema = DATABASE()
      AND table_name = 'events'
      AND column_name = 'series_id'
      AND referenced_table_name = 'event_series'
      AND referenced_column_name = 'id'
  ) THEN
    ALTER TABLE events ADD CONSTRAINT fk_events_series
      FOREIGN KEY (series_id) REFERENCES event_series(id) ON DELETE SET NULL;
  END IF;

  -- Run the legacy-event backfill once only. This marker prevents a retry from
  -- accidentally publishing drafts created after the first successful run.
  IF NOT EXISTS (
    SELECT 1 FROM site_settings
    WHERE setting_key = 'migration_2026_09_28_event_lifecycle'
  ) THEN
    UPDATE events
    SET publication_status = 'published',
        start_at = CASE
          WHEN event_date_sort IS NOT NULL THEN CONCAT(event_date_sort, ' 00:00:00')
          ELSE NULL
        END,
        end_at = CASE
          WHEN event_date_sort IS NOT NULL THEN CONCAT(event_date_sort, ' 23:59:59')
          ELSE NULL
        END;

    INSERT INTO site_settings (setting_key, setting_value)
    VALUES ('migration_2026_09_28_event_lifecycle', 'complete')
    ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);
  END IF;
END//
DELIMITER ;

CALL migrate_taos_pride_event_lifecycle();
DROP PROCEDURE migrate_taos_pride_event_lifecycle;
