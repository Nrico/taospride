-- ============================================================
-- Taos Pride 2026 — Seed Data
-- Run this after schema.sql to bootstrap the site with
-- realistic sample content.
--
-- Re-run safety: tables with auto-increment IDs (performers,
-- costs, materials, etc.) are cleared by event_id before
-- re-inserting so duplicates can't accumulate.
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

-- ── Site settings ────────────────────────────────────────────
INSERT INTO site_settings (setting_key, setting_value) VALUES
  ('phase',              'PLANNING'), -- legacy mirror of hero_preset
  ('hero_preset',        'PLANNING'),
  ('event_year',         '2026'),
  ('festival_start',     'August 8, 2026'),
  ('festival_end',       'August 15, 2026'),
  ('tagline',            'Love Is Resistant')
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);

-- ── Events ───────────────────────────────────────────────────
-- ON DUPLICATE KEY UPDATE keeps existing edits if IDs are stable
INSERT INTO events
  (id, title, status, icon_key, color, event_date, event_time,
   location, location_details, description, teaser_text,
   ticket_link, ticket_price, estimated_attendance, sort_order)
VALUES
  (1,
   'Taos Pride Film Festival',
   'TEASER',
   'Camera',
   '#9C27B0',
   NULL, NULL,
   'Taos Center for the Arts',
   '133 Paseo del Pueblo Norte, Taos, NM 87571',
   NULL,
   'Cinematic magic returns to the high desert. We''re sourcing the best local and national queer filmmakers.',
   NULL, NULL, 200, 1),

  (2,
   'Pride on the Plaza',
   'CONFIRMED',
   'Flag',
   '#E91E63',
   'August 15, 2026',
   '12:00 PM – 6:00 PM',
   'Taos Historic Plaza',
   'Downtown Taos, NM 87571',
   'Our signature outdoor celebration right in the heart of Taos. Live music, vendors, food, and community all day long on the Historic Plaza.',
   NULL,
   NULL,
   'Free',
   1500, 2),

  (3,
   'The Gayest Drag Show Ever!',
   'TBD',
   'Music',
   '#FF5722',
   NULL, NULL,
   NULL, NULL, NULL, NULL, NULL, NULL, 350, 3),

  (4,
   'Queer Art Market',
   'TBD',
   'Store',
   '#00BCD4',
   NULL, NULL,
   NULL, NULL, NULL, NULL, NULL, NULL, 250, 4)
ON DUPLICATE KEY UPDATE
  title=VALUES(title), status=VALUES(status), icon_key=VALUES(icon_key),
  color=VALUES(color), sort_order=VALUES(sort_order);

-- Clear sub-data for event 2 (Pride on the Plaza) before re-seeding
DELETE FROM event_performers   WHERE event_id = 2;
DELETE FROM event_costs        WHERE event_id = 2;
DELETE FROM event_materials    WHERE event_id = 2;
DELETE FROM event_staff_roles  WHERE event_id = 2;
DELETE FROM event_marketing    WHERE event_id = 2;

-- ── Performers for Pride on the Plaza (id=2) ─────────────────
INSERT IGNORE INTO event_performers
  (event_id, name, type, bio, contact_email, fee, confirmed, performance_time, sort_order)
VALUES
  (2, 'DJ Solstice',      'DJ',      'Santa Fe-based queer DJ spinning everything from cumbia to house.',    'djsolstice@example.com',  400.00, 1, '12:00 PM – 2:00 PM', 1),
  (2, 'Las Mariposas',    'Band',    'Albuquerque indie-folk trio with powerful LGBTQ+ storytelling.',        'mariposas@example.com',   800.00, 1, '2:30 PM – 3:30 PM',  2),
  (2, 'Mx. Fabulous',     'Drag',    'Taos royalty. Emcee, performer, and community anchor since 2019.',     'mxfab@example.com',       300.00, 1, '4:00 PM – 5:00 PM',  3),
  (2, 'TBD Headliner',    'Musician','Main stage headliner — still in negotiation.',                          NULL,                     1200.00, 0, '5:00 PM – 6:00 PM',  4);

-- ── Budget for Pride on the Plaza (id=2) ─────────────────────
INSERT IGNORE INTO event_costs
  (event_id, category, description, estimated_cost, actual_cost, vendor, approved, paid)
VALUES
  (2, 'Venue',       'Plaza permit — City of Taos',         250.00,  250.00, 'City of Taos',         1, 1),
  (2, 'Performers',  'DJ Solstice',                         400.00,  NULL,   'Direct',               1, 0),
  (2, 'Performers',  'Las Mariposas',                       800.00,  NULL,   'Direct',               1, 0),
  (2, 'Performers',  'Mx. Fabulous',                        300.00,  NULL,   'Direct',               1, 0),
  (2, 'Performers',  'TBD Headliner',                      1200.00,  NULL,   'TBD',                  0, 0),
  (2, 'Equipment',   'Stage & PA rental',                  1500.00,  NULL,   'High Desert Sound',    1, 0),
  (2, 'Insurance',   'Event liability insurance',            400.00,  400.00, 'State Farm',           1, 1),
  (2, 'Marketing',   'Print flyers (500)',                   150.00,  NULL,   'Minuteman Press Taos', 1, 0),
  (2, 'Marketing',   'Social media sponsored posts',         200.00,  NULL,   'Self',                 1, 0),
  (2, 'Permits',     'Sound permit',                          75.00,   75.00, 'City of Taos',         1, 1),
  (2, 'Other',       'Volunteer t-shirts (20)',              240.00,  NULL,   'Custom Ink',           0, 0);

-- ── Materials for Pride on the Plaza (id=2) ──────────────────
INSERT IGNORE INTO event_materials
  (event_id, item, quantity, unit, obtained, source)
VALUES
  (2, 'Pride flags (large)',        10, 'ea',     0, 'Amazon / donated'),
  (2, 'Rainbow bunting — 50ft',      4, 'rolls',  0, 'Party City Albuquerque'),
  (2, 'Folding tables',             20, 'ea',     0, 'Borrow from community center'),
  (2, 'Folding chairs',            100, 'ea',     0, 'Rental'),
  (2, 'First-aid kit',               2, 'kits',   1, 'On hand'),
  (2, 'Water station (5-gal jugs)', 10, 'jugs',   0, 'Smith''s Grocery'),
  (2, 'Generator (backup)',          1, 'unit',   0, 'Home Depot rental'),
  (2, 'Extension cords — 50ft',      6, 'ea',     1, 'On hand'),
  (2, 'Trash/recycle bins',          8, 'ea',     0, 'Borrow from city'),
  (2, 'Vendor tent weights',        40, 'ea',     0, 'Amazon');

-- ── Staff roles for Pride on the Plaza (id=2) ────────────────
INSERT IGNORE INTO event_staff_roles
  (event_id, role_name, description, slots_needed, slots_filled, is_paid, shift_time)
VALUES
  (2, 'Event Coordinator',  'Overall day-of logistics lead',             1, 1, 0, 'All day'),
  (2, 'Stage Manager',      'Manages performer schedule and sound crew', 1, 0, 0, '10 AM – 6 PM'),
  (2, 'Volunteer Check-in', 'Greets and orients volunteers on arrival',  2, 0, 0, '9 AM – 12 PM'),
  (2, 'Info Booth',         'Answers questions, hands out materials',    3, 0, 0, '12 PM – 6 PM'),
  (2, 'Setup Crew',         'Tables, flags, signage, barricades',        6, 2, 0, '8 AM – 12 PM'),
  (2, 'Teardown Crew',      'Strike everything after event ends',        5, 0, 0, '6 PM – 9 PM'),
  (2, 'First Aid',          'Certified first-aider on site',             2, 0, 0, 'All day'),
  (2, 'Photography',        'Document the event for archives',           2, 1, 0, 'All day');

-- ── Marketing materials for Pride on the Plaza (id=2) ────────
INSERT IGNORE INTO event_marketing
  (event_id, material_type, title, description, channel, publish_date, status)
VALUES
  (2, 'Flyer',        'Pride on the Plaza 2026 Flyer',       '8.5x11 color flyer for print distribution',         'Print / in-store',   '2026-06-01', 'draft'),
  (2, 'Poster',       'Main Event Poster',                   '18x24 poster for bulletin boards and venues',        'Print',              '2026-06-01', 'draft'),
  (2, 'Social_Post',  'Save the Date — Instagram',           'Square graphic for IG/FB announcement',              'Instagram/Facebook', '2026-04-01', 'approved'),
  (2, 'Press_Release','2026 Pride on the Plaza Press Release','For local papers: Taos News, El Crepúsculo',        'Press',              '2026-05-15', 'draft'),
  (2, 'Email',        'May Newsletter — Event Announcement', 'Subscriber email with full lineup announcement',     'Mailchimp',          '2026-05-01', 'draft');

-- ── Meetings ─────────────────────────────────────────────────
-- Clear and re-insert with stable IDs
DELETE FROM meeting_decisions    WHERE meeting_id IN (1,2,3,4,5,6);
DELETE FROM meeting_agenda_items WHERE meeting_id IN (1,2,3,4,5,6);
DELETE FROM meetings             WHERE id         IN (1,2,3,4,5,6);

INSERT INTO meetings
  (id, meeting_date, meeting_time, location, who_is_invited, is_past, notes)
VALUES
  (1, '2026-02-10', '6:30 PM', 'Taos Community Center, Room B', 'All committee members + interested community', 1, 'Kickoff meeting'),
  (2, '2026-03-10', '6:30 PM', 'Taos Community Center, Room B', 'All committee members',                        1, 'Event proposals'),
  (3, '2026-04-14', '6:30 PM', 'Taos Community Center, Room B', 'All committee members + volunteers',           1, 'Volunteer drive'),
  (4, '2026-05-12', '6:30 PM', 'Taos Community Center, Room B', 'All committee members',                        0, 'Lineup confirmation'),
  (5, '2026-06-09', '6:30 PM', 'Taos Community Center, Room B', 'All committee members',                        0, 'Marketing & logistics'),
  (6, '2026-07-14', '6:30 PM', 'Taos Community Center, Room B', 'All committee members + event leads',          0, 'Final run-through');

-- ── Agenda for May 12 meeting (id=4) ─────────────────────────
INSERT INTO meeting_agenda_items
  (meeting_id, item_order, title, description, presenter, time_allocated, status)
VALUES
  (4, 1, 'Welcome & quorum check',      NULL,                                    'Chair',         5,  'pending'),
  (4, 2, 'Approve March minutes',       NULL,                                    'Secretary',     5,  'pending'),
  (4, 3, 'Headliner update',            'Report on negotiations with top acts',  'Booking Lead',  15, 'pending'),
  (4, 4, 'Venue contract — Plaza',      'Final review of city permit terms',     'Venue Lead',    10, 'pending'),
  (4, 5, 'Volunteer sign-up drive',     'Current numbers vs. goal (40 total)',   'Vol. Coord.',   10, 'pending'),
  (4, 6, 'Sponsor commitments',         'Confirmed sponsors + outstanding asks', 'Sponsor Lead',  10, 'pending'),
  (4, 7, 'Budget review',               'Q1 actuals vs. projected',              'Treasurer',     15, 'pending'),
  (4, 8, 'Open discussion / Q&A',       NULL,                                    NULL,            10, 'pending');

-- ── Decisions from past meetings ─────────────────────────────
INSERT INTO meeting_decisions
  (meeting_id, decision, decided_by, affects_event_id, implementation_status)
VALUES
  (1, 'Proceed with Pride on the Plaza as the signature event for 2026.',                'Full committee — unanimous', 2, 'complete'),
  (1, 'Set festival window as August 8–15, 2026.',                                       'Full committee',            NULL, 'complete'),
  (2, 'Add a Film Festival as a second anchor event. TCA approached for venue.',         'Full committee',            1, 'in_progress'),
  (2, 'Budget cap of $8,000 for Pride on the Plaza without additional sponsorship.',     'Treasurer + committee',     2, 'in_progress'),
  (3, 'Target 40 volunteers total; open sign-ups on website by April 30.',               'Volunteer coordinator',     NULL, 'in_progress');

-- ── Sponsors ─────────────────────────────────────────────────
DELETE FROM sponsors WHERE year = 2026;

INSERT INTO sponsors
  (name, level, logo_initials, website, contact_name, contact_email, amount, payment_received, year, active)
VALUES
  ('Taos Ski Valley',        'Platinum', 'TSV', 'https://www.skitaos.com',          'Marta López',      'marta@skitaos.com',    2500.00, 1, 2026, 1),
  ('El Monte Sagrado',       'Gold',     'EMS', 'https://www.elmontesagrado.com',   'James Rivera',     'james@ems.com',        1000.00, 0, 2026, 1),
  ('Taos News',              'Silver',   'TN',  'https://www.taosnews.com',         'Editor Office',    'ads@taosnews.com',      500.00, 1, 2026, 1),
  ('High Desert Sound',      'In-Kind',  'HDS', NULL,                               'Ricky Archuleta',  'ricky@hds.com',           NULL, 0, 2026, 1),
  ('Taos Herb Company',      'Community','THC', 'https://taosherbco.com',           NULL,               NULL,                    250.00, 0, 2026, 1);

-- ── Sample applications (skip if any already exist) ──────────
INSERT INTO applications
  (type, name, email, phone, organization, notes, status)
SELECT * FROM (SELECT
  'volunteer' t, 'Ana Montoya'        n, 'ana@example.com'         e, '575-555-0101' p, NULL                  o, 'Available all weekend. Have prior event experience.'       nt, 'new'      s
UNION SELECT 'volunteer','Trevor Kim',       'tkim@example.com',     '575-555-0102', NULL,                  'First time volunteering — very excited!',                   'new'
UNION SELECT 'vendor',   'Desert Moon Crafts','info@desertmoon.com', '505-555-0201', 'Desert Moon Crafts',  '10x10 booth, selling handmade LGBTQ+ art and jewelry.',     'reviewed'
UNION SELECT 'vendor',   'Taos Hot Sauce Co.',NULL,                  NULL,           'Taos Hot Sauce Co.',  'Food vendor — tamales, green chile, beverages.',            'accepted'
UNION SELECT 'performer','Rosa Valentina',   'rosa@example.com',     '505-555-0301', NULL,                  'Drag performer, 10 years experience. Available for emcee.', 'new'
UNION SELECT 'parade',   'Taos PFLAG',       'taospflag@example.com','575-555-0401', 'Taos PFLAG',          'Walking group, ~20 people, carrying banner.',               'accepted'
) AS rows
WHERE NOT EXISTS (SELECT 1 FROM applications LIMIT 1);

-- ── Photo albums ──────────────────────────────────────────────
INSERT INTO photo_albums (year, title, photo_count) VALUES
  (2025, 'Taos Pride 2025', 142),
  (2024, 'Taos Pride 2024', 88),
  (2023, 'Taos Pride 2023', 215)
ON DUPLICATE KEY UPDATE photo_count = VALUES(photo_count);

SET FOREIGN_KEY_CHECKS = 1;
