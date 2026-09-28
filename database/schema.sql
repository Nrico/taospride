-- ============================================================
-- Taos Pride 2026 — MySQL Database Schema
-- GoDaddy shared hosting (MySQL 5.7+ / 8.0)
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

-- Site-wide configuration (homepage banner preset, dates, etc.)
CREATE TABLE IF NOT EXISTS site_settings (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  setting_key   VARCHAR(100) UNIQUE NOT NULL,
  setting_value MEDIUMTEXT,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO site_settings (setting_key, setting_value) VALUES
  ('phase',        'PLANNING'), -- legacy mirror of hero_preset
  ('hero_preset',  'PLANNING'),
  ('event_year',   '2026'),
  ('festival_start', ''),
  ('festival_end',   ''),
  ('tagline',      'Love Is Resistant'),
  ('show_meetings_section', '1'),
  ('sponsorship_state', 'open')
ON DUPLICATE KEY UPDATE setting_key = setting_key;

-- ============================================================
-- EVENT SERIES / FESTIVALS
-- ============================================================
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

-- ============================================================
-- EVENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS events (
  id                   INT AUTO_INCREMENT PRIMARY KEY,
  series_id            INT NULL,
  title                VARCHAR(200) NOT NULL,
  event_type           VARCHAR(80),
  start_at             DATETIME NULL,
  end_at               DATETIME NULL,
  timezone             VARCHAR(64) NOT NULL DEFAULT 'America/Denver',
  publication_status   ENUM('draft','published','cancelled','archived') NOT NULL DEFAULT 'draft',
  featured             TINYINT(1) NOT NULL DEFAULT 0,
  status               ENUM('TBD','TEASER','CONFIRMED') DEFAULT 'TBD',
  icon_key             VARCHAR(50)  DEFAULT 'Heart',
  color                VARCHAR(20)  DEFAULT '#E91E63',
  event_date           VARCHAR(100),
  event_date_sort      DATE NULL COMMENT 'Real date used for automatic chronological sorting — event_date above stays freeform for display (e.g. "TBD", "Every Saturday in June")',
  event_time           VARCHAR(100),
  location             VARCHAR(200),
  location_details     VARCHAR(500),
  description          TEXT,
  teaser_text          TEXT,
  ticket_link          VARCHAR(500),
  ticket_price         VARCHAR(100),
  -- Venue contact
  venue_contact_name   VARCHAR(200),
  venue_contact_email  VARCHAR(200),
  venue_contact_phone  VARCHAR(50),
  venue_contract_url   VARCHAR(500),
  -- Insurance
  insurance_required   TINYINT(1)   DEFAULT 0,
  insurance_carrier    VARCHAR(200),
  insurance_policy_num VARCHAR(100),
  insurance_expiry     DATE,
  insurance_amount     DECIMAL(10,2),
  insurance_notes      TEXT,
  -- Capacity / logistics
  estimated_attendance INT,
  -- Hero / flyer / extra images (stored as base64 data URLs)
  hero_image           MEDIUMTEXT,
  flyer_image          MEDIUMTEXT,
  extra_image          MEDIUMTEXT,
  extra_image_label    VARCHAR(200),
  -- Sort order in public display
  sort_order           INT          DEFAULT 0,
  created_at           TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  updated_at           TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_events_publication_start (publication_status, start_at),
  INDEX idx_events_series (series_id),
  FOREIGN KEY (series_id) REFERENCES event_series(id) ON DELETE SET NULL
);

-- ============================================================
-- EVENT PERFORMERS
-- ============================================================
CREATE TABLE IF NOT EXISTS event_performers (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  event_id         INT NOT NULL,
  name             VARCHAR(200) NOT NULL,
  type             ENUM('Musician','DJ','Drag','Dancer','Speaker','Emcee','Band','Other') DEFAULT 'Other',
  bio              TEXT,
  contact_email    VARCHAR(200),
  contact_phone    VARCHAR(50),
  fee              DECIMAL(10,2),
  confirmed        TINYINT(1)   DEFAULT 0,
  performance_time VARCHAR(100),
  set_length_mins  INT,
  tech_rider       TEXT,
  notes            TEXT,
  sort_order       INT          DEFAULT 0,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

-- ============================================================
-- EVENT STAFF / VOLUNTEER ROLES
-- ============================================================
CREATE TABLE IF NOT EXISTS event_staff_roles (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  event_id      INT NOT NULL,
  role_name     VARCHAR(200) NOT NULL,
  description   TEXT,
  slots_needed  INT          DEFAULT 1,
  slots_filled  INT          DEFAULT 0,
  is_paid       TINYINT(1)   DEFAULT 0,
  pay_rate      VARCHAR(100),
  shift_time    VARCHAR(200),
  notes         TEXT,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

-- ============================================================
-- EVENT BUDGET / LINE-ITEM COSTS
-- ============================================================
CREATE TABLE IF NOT EXISTS event_costs (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  event_id       INT NOT NULL,
  category       ENUM('Venue','Performers','Marketing','Equipment','Staffing','Insurance','Permits','Food_Beverage','Printing','Audio_Visual','Other') DEFAULT 'Other',
  description    VARCHAR(500) NOT NULL,
  estimated_cost DECIMAL(10,2),
  actual_cost    DECIMAL(10,2),
  vendor         VARCHAR(200),
  approved       TINYINT(1)   DEFAULT 0,
  paid           TINYINT(1)   DEFAULT 0,
  notes          TEXT,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

-- ============================================================
-- EVENT MATERIALS CHECKLIST
-- ============================================================
CREATE TABLE IF NOT EXISTS event_materials (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  event_id   INT NOT NULL,
  item       VARCHAR(500) NOT NULL,
  quantity   INT          DEFAULT 1,
  unit       VARCHAR(50),
  obtained   TINYINT(1)   DEFAULT 0,
  source     VARCHAR(200),
  cost       DECIMAL(10,2),
  notes      TEXT,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

-- ============================================================
-- MARKETING MATERIALS PER EVENT
-- ============================================================
CREATE TABLE IF NOT EXISTS event_marketing (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  event_id       INT NOT NULL,
  material_type  ENUM('Flyer','Poster','Social_Post','Press_Release','Banner','Ad','Email','Other') DEFAULT 'Other',
  title          VARCHAR(200),
  description    TEXT,
  file_url       VARCHAR(500),
  channel        VARCHAR(200),
  publish_date   DATE,
  status         ENUM('draft','approved','published') DEFAULT 'draft',
  notes          TEXT,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

-- ============================================================
-- PLANNING MEETINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS meetings (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  meeting_date   DATE         NOT NULL,
  meeting_time   VARCHAR(50),
  location       VARCHAR(200),
  who_is_invited TEXT,
  is_past        TINYINT(1)   DEFAULT 0,
  minutes_url    VARCHAR(500),
  notes          TEXT,
  created_at     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- MEETING AGENDA ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS meeting_agenda_items (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  meeting_id       INT          NOT NULL,
  item_order       INT          DEFAULT 0,
  title            VARCHAR(500) NOT NULL,
  description      TEXT,
  presenter        VARCHAR(200),
  time_allocated   INT,         -- minutes
  status           ENUM('pending','discussed','decided','tabled') DEFAULT 'pending',
  outcome          TEXT,
  FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
);

-- ============================================================
-- DECISIONS (outcomes logged from meetings)
-- ============================================================
CREATE TABLE IF NOT EXISTS meeting_decisions (
  id                      INT AUTO_INCREMENT PRIMARY KEY,
  meeting_id              INT          NOT NULL,
  agenda_item_id          INT,
  decision                TEXT         NOT NULL,
  decided_by              VARCHAR(500),
  affects_event_id        INT,
  implementation_status   ENUM('pending','in_progress','complete') DEFAULT 'pending',
  implementation_notes    TEXT,
  created_at              TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (meeting_id)       REFERENCES meetings(id)             ON DELETE CASCADE,
  FOREIGN KEY (agenda_item_id)   REFERENCES meeting_agenda_items(id) ON DELETE SET NULL,
  FOREIGN KEY (affects_event_id) REFERENCES events(id)               ON DELETE SET NULL
);

-- Public suggestion box. Submissions sit in one pool grouped as "new" until
-- the board reviews them against an upcoming meeting — either promoted into
-- a real meeting_agenda_items row (reviewed_meeting_id set, status
-- 'reviewed') or dismissed without becoming an agenda item (status
-- 'archived', reviewed_meeting_id still set as a record of when it was
-- triaged). Not itself an agenda item — the admin UI groups them together
-- as their own panel on whichever meeting is currently open.
CREATE TABLE IF NOT EXISTS suggestions (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  message             TEXT         NOT NULL,
  submitter_name      VARCHAR(200),
  submitter_email     VARCHAR(200),
  ip_address          VARCHAR(45),
  status              ENUM('new','reviewed','archived') DEFAULT 'new',
  reviewed_meeting_id INT          NULL,
  created_at          TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  reviewed_at         TIMESTAMP    NULL,
  FOREIGN KEY (reviewed_meeting_id) REFERENCES meetings(id) ON DELETE SET NULL
);

-- ============================================================
-- SPONSORS & PARTNERS
-- ============================================================
CREATE TABLE IF NOT EXISTS sponsors (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  name             VARCHAR(200) NOT NULL,
  level            ENUM('Platinum','Gold','Silver','Community','In-Kind') DEFAULT 'Community',
  logo_url         MEDIUMTEXT,
  logo_initials    VARCHAR(10),
  website          VARCHAR(500),
  contact_name     VARCHAR(200),
  contact_email    VARCHAR(200),
  contact_phone    VARCHAR(50),
  amount           DECIMAL(10,2),
  payment_received TINYINT(1)   DEFAULT 0,
  year             INT          DEFAULT 2026,
  active           TINYINT(1)   DEFAULT 1,
  notes            TEXT,
  created_at       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- APPLICATIONS (volunteer, vendor, performer, parade, sponsor)
-- ============================================================
CREATE TABLE IF NOT EXISTS applications (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  type           ENUM('volunteer','vendor','performer','parade','sponsor') NOT NULL,
  name           VARCHAR(200) NOT NULL,
  email          VARCHAR(200) NOT NULL,
  phone          VARCHAR(50),
  organization   VARCHAR(200),
  notes          TEXT,
  status         ENUM('new','reviewed','accepted','declined','waitlisted') DEFAULT 'new',
  assigned_to    VARCHAR(200),
  internal_notes TEXT,
  file_name      VARCHAR(500),
  file_data      MEDIUMTEXT,
  submitted_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================================
-- NEWSLETTER SUBSCRIBERS
-- ============================================================
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  email         VARCHAR(200) UNIQUE NOT NULL,
  name          VARCHAR(200),
  subscribed_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  active        TINYINT(1)   DEFAULT 1
);

-- ============================================================
-- PHOTO ALBUMS (metadata only; images stored as files)
-- ============================================================
CREATE TABLE IF NOT EXISTS photo_albums (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  year         INT          NOT NULL,
  title        VARCHAR(200),
  event_id     INT          NULL,
  cover_image  MEDIUMTEXT,
  external_url VARCHAR(500),
  photo_count  INT          DEFAULT 0,
  description  TEXT,
  visible      TINYINT(1)   DEFAULT 1,
  created_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE SET NULL
);

-- ============================================================
-- CONTRIBUTION NOTIFICATIONS
-- Gift notifications submitted via the "Let Us Know" form
-- ============================================================
CREATE TABLE IF NOT EXISTS contribution_notifications (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(200),
  email        VARCHAR(200) NOT NULL,
  amount       DECIMAL(10,2),
  method       VARCHAR(100),
  message      TEXT,
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO photo_albums (year, title, photo_count) VALUES
  (2025, 'Taos Pride 2025', 142),
  (2024, 'Taos Pride 2024', 88),
  (2023, 'Taos Pride 2023', 215)
ON DUPLICATE KEY UPDATE year = year;

-- ============================================================
-- BOARD PORTAL TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS board_members (
  id                 INT AUTO_INCREMENT PRIMARY KEY,
  first_name         VARCHAR(100) NOT NULL,
  last_name          VARCHAR(100) NOT NULL,
  preferred_name     VARCHAR(100),
  email              VARCHAR(200),
  phone              VARCHAR(50),
  bio                TEXT,
  photo              MEDIUMTEXT,
  contact_preference ENUM('email','phone','either','none') DEFAULT 'email',
  active             TINYINT(1)   DEFAULT 1,
  notes              TEXT,
  created_at         TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS board_positions (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  title       VARCHAR(100) NOT NULL,
  description TEXT,
  is_officer  TINYINT(1)   DEFAULT 0,
  sort_order  INT          DEFAULT 0
);

CREATE TABLE IF NOT EXISTS board_member_terms (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  member_id   INT  NOT NULL,
  position_id INT  NOT NULL,
  start_date  DATE,
  end_date    DATE,
  is_current  TINYINT(1)   DEFAULT 1,
  notes       TEXT,
  created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (member_id)   REFERENCES board_members(id)   ON DELETE CASCADE,
  FOREIGN KEY (position_id) REFERENCES board_positions(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS board_committees (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(200) NOT NULL,
  description TEXT,
  active      TINYINT(1)   DEFAULT 1
);

CREATE TABLE IF NOT EXISTS board_member_committees (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  member_id    INT          NOT NULL,
  committee_id INT          NOT NULL,
  role         VARCHAR(100) DEFAULT 'member',
  start_date   DATE,
  end_date     DATE,
  active       TINYINT(1)   DEFAULT 1,
  FOREIGN KEY (member_id)    REFERENCES board_members(id)    ON DELETE CASCADE,
  FOREIGN KEY (committee_id) REFERENCES board_committees(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS board_files (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  member_id     INT,
  entry_type    ENUM('file','link') DEFAULT 'file',
  original_name VARCHAR(500)  NOT NULL,
  mime_type     VARCHAR(100),
  file_size     INT,
  file_data     MEDIUMTEXT,          -- NULL for link-type entries
  link_url      VARCHAR(2000),       -- NULL for file-type entries
  description   TEXT,
  category      VARCHAR(100)  DEFAULT 'other',
  created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (member_id) REFERENCES board_members(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS board_duties (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  member_id   INT,
  title       VARCHAR(200) NOT NULL,
  description TEXT,
  status      ENUM('active','completed','delegated','cancelled') DEFAULT 'active',
  priority    ENUM('low','normal','high','urgent')               DEFAULT 'normal',
  due_date    DATE,
  created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (member_id) REFERENCES board_members(id) ON DELETE SET NULL
);

-- Default board positions
INSERT INTO board_positions (title, description, is_officer, sort_order) VALUES
  ('President',          'Leads the organization, chairs board meetings, represents Taos Pride publicly', 1, 1),
  ('Vice President',     'Supports the President and leads in their absence',                            1, 2),
  ('Secretary',          'Records meeting minutes, manages correspondence and records',                  1, 3),
  ('Treasurer',          'Manages finances, budgets, and financial reporting',                           1, 4),
  ('Director At-Large',  'General board member with full voting rights',                                0, 5),
  ('Past President',     'Former president serving in an advisory capacity',                            0, 6)
ON DUPLICATE KEY UPDATE title = title;

-- Default committees
INSERT INTO board_committees (name, description) VALUES
  ('Events Committee',       'Plans and executes Pride events and programming'),
  ('Fundraising Committee',  'Coordinates fundraising campaigns and donor relations'),
  ('Marketing Committee',    'Manages communications, social media, and marketing'),
  ('Volunteer Committee',    'Recruits, trains, and coordinates volunteers')
ON DUPLICATE KEY UPDATE name = name;

-- ============================================================
-- SECURE VAULT
-- ============================================================

CREATE TABLE IF NOT EXISTS vault_items (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  item_type     ENUM('note','link','file') NOT NULL DEFAULT 'note',
  title         VARCHAR(200) NOT NULL,
  content       TEXT,                      -- free-text body for notes; optional notes for links/files
  link_url      VARCHAR(2000),             -- populated for link-type items
  original_name VARCHAR(500),              -- populated for file-type items
  mime_type     VARCHAR(100),
  file_size     INT,
  file_data     VARCHAR(500),              -- 'fs:<filename>' pointer; NULL for non-file items
  category      VARCHAR(100) DEFAULT 'general',
  created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vault_access_log (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  accessed_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  ip_address   VARCHAR(45),
  user_agent   TEXT,
  success      TINYINT(1)   DEFAULT 1,
  action       VARCHAR(100),              -- 'unlock', 'create', 'update', 'delete', 'download'
  item_id      INT          NULL
);

-- Login attempt log — powers rate limiting/lockout on the unified admin
-- password (checked from both /api/auth/login and the /api/board/auth/login
-- compat shim, since it's the same credential) and the vault PIN reuses
-- vault_access_log above instead of this table (it already logs unlock
-- attempts). See require_not_rate_limited()/record_login_attempt() in
-- api/config.php.
CREATE TABLE IF NOT EXISTS login_attempts (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  ip_address    VARCHAR(45) NOT NULL,
  scope         VARCHAR(20) NOT NULL DEFAULT 'admin',
  success       TINYINT(1)  NOT NULL DEFAULT 0,
  attempted_at  TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ip_scope_time (ip_address, scope, attempted_at)
);

-- ============================================================
-- PHOTO GALLERY
-- Merged in from the former gallery.taospride.org project — these were
-- always meant to live in this database (see that project's own
-- database/schema.sql). Photos themselves live on disk under
-- public_html/gallery-photos/{eventId}/, not in the database.
-- ============================================================
CREATE TABLE IF NOT EXISTS gallery_years (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  year        INT NOT NULL UNIQUE,
  description TEXT,
  visible     TINYINT(1)  DEFAULT 1,
  sort_order  INT         DEFAULT 0,
  created_at  TIMESTAMP   DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS gallery_events (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  year_id        INT          NOT NULL,
  name           VARCHAR(200) NOT NULL,
  slug           VARCHAR(200) NOT NULL,
  description    TEXT,
  event_date     DATE,
  cover_photo_id INT          NULL,
  visible        TINYINT(1)   DEFAULT 1,
  sort_order     INT          DEFAULT 0,
  created_at     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_year_slug (year_id, slug),
  FOREIGN KEY (year_id) REFERENCES gallery_years(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS gallery_photos (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  event_id   INT          NOT NULL,
  filename   VARCHAR(200) NOT NULL,
  caption    VARCHAR(500),
  width      INT,
  height     INT,
  file_size  INT,
  sort_order INT          DEFAULT 0,
  created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id) REFERENCES gallery_events(id) ON DELETE CASCADE
);

-- Add cover_photo_id FK after gallery_photos exists
ALTER TABLE gallery_events
  ADD CONSTRAINT fk_gallery_events_cover
  FOREIGN KEY (cover_photo_id) REFERENCES gallery_photos(id) ON DELETE SET NULL;

SET FOREIGN_KEY_CHECKS = 1;
