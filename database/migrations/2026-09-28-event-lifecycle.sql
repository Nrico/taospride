-- Run once against the existing Taos Pride production database.
-- Back up the database first. Do not re-run this migration.

CREATE TABLE event_series (
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

ALTER TABLE events
  ADD COLUMN series_id INT NULL AFTER id,
  ADD COLUMN event_type VARCHAR(80) NULL AFTER title,
  ADD COLUMN start_at DATETIME NULL AFTER event_type,
  ADD COLUMN end_at DATETIME NULL AFTER start_at,
  ADD COLUMN timezone VARCHAR(64) NOT NULL DEFAULT 'America/Denver' AFTER end_at,
  ADD COLUMN publication_status ENUM('draft','published','cancelled','archived') NOT NULL DEFAULT 'draft' AFTER timezone,
  ADD COLUMN featured TINYINT(1) NOT NULL DEFAULT 0 AFTER publication_status,
  ADD INDEX idx_events_publication_start (publication_status, start_at),
  ADD INDEX idx_events_series (series_id),
  ADD CONSTRAINT fk_events_series FOREIGN KEY (series_id) REFERENCES event_series(id) ON DELETE SET NULL;

-- Preserve all existing public events. Their legacy display date/time remain
-- unchanged; these timestamps establish lifecycle and chronological ordering.
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
