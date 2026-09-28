<?php
// ============================================================
// Taos Pride 2026 — PHP REST API
// Handles all /api/* requests on GoDaddy shared hosting
// ============================================================

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/board.php';
require_once __DIR__ . '/gallery.php';

// Increase limits for base64 image uploads and gallery photo uploads.
ini_set('post_max_size', '64M');
ini_set('upload_max_filesize', '64M');

// --- CORS & headers ---
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: ' . CORS_ORIGIN);
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Credentials: true');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// --- Parse route ---
$uri    = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$uri    = preg_replace('#^/api/?#', '', $uri);
$parts  = array_values(array_filter(explode('/', $uri)));
$method = $_SERVER['REQUEST_METHOD'];

$resource  = $parts[0] ?? '';
$id        = isset($parts[1]) && is_numeric($parts[1]) ? (int)$parts[1] : null;
$sub       = $id !== null ? ($parts[2] ?? '') : '';
$subId     = isset($parts[3]) && is_numeric($parts[3]) ? (int)$parts[3] : null;

// ============================================================
// ROUTER
// ============================================================
try {
    switch ($resource) {

        // --- Auth ---
        case 'auth':
            handle_auth($method, $parts[1] ?? '');
            break;

        // --- Site settings / phase ---
        case 'settings':
            handle_settings($method);
            break;

        // --- Festival / event series ---
        case 'event-series':
            handle_event_series($method, $id);
            break;

        // --- Events ---
        case 'events':
            if (($parts[1] ?? '') === 'reorder') { handle_events_reorder($method); break; }
            if ($sub === 'performers')  { handle_performers($method, $id, $subId); break; }
            if ($sub === 'costs')       { handle_costs($method, $id, $subId);      break; }
            if ($sub === 'materials')   { handle_materials($method, $id, $subId);  break; }
            if ($sub === 'staff')       { handle_staff($method, $id, $subId);      break; }
            if ($sub === 'marketing')   { handle_marketing($method, $id, $subId);  break; }
            handle_events($method, $id);
            break;

        // --- Meetings ---
        case 'meetings':
            if ($sub === 'agenda')    { handle_agenda($method, $id, $subId);    break; }
            if ($sub === 'decisions') { handle_decisions($method, $id, $subId); break; }
            handle_meetings($method, $id);
            break;

        // --- Photo Albums ---
        case 'photos':
            handle_photos($method, $id);
            break;

        // --- Sponsors ---
        case 'sponsors':
            handle_sponsors($method, $id);
            break;

        // --- Applications (public submit + admin list) ---
        case 'apply':
            handle_apply($method, $parts[1] ?? '');
            break;
        case 'applications':
            handle_applications($method, $id);
            break;

        // --- Newsletter ---
        case 'newsletter':
            handle_newsletter($method, $id);
            break;

        // --- Suggestion box ---
        case 'suggestions':
            if ($sub === 'promote') { handle_suggestion_promote($method, $id); break; }
            handle_suggestions($method, $id);
            break;

        // --- Contribution notifications ---
        case 'contribute':
            handle_contribute($method);
            break;
        case 'contributions':
            handle_contributions($method);
            break;

        // --- Board Portal ---
        case 'board':
            handle_board($method, $parts);
            break;

        // --- Photo gallery admin ---
        case 'gallery':
            handle_gallery_admin($method, $parts);
            break;

        // --- Photo gallery public reads (/api/years, /api/years/{y}/events, ...) ---
        case 'years':
            handle_gallery_public($method, $parts);
            break;

        // --- Dashboard stats ---
        case 'dashboard':
            handle_dashboard();
            break;

        // --- Health check ---
        case 'health':
            json_response(['status' => 'ok', 'timestamp' => date('c')]);
            break;

        // Legacy compat: old frontend used /api/data/:type
        case 'data':
            handle_legacy_data($method, $parts[1] ?? '');
            break;

        default:
            error_response('Not found', 404);
    }
} catch (PDOException $e) {
    error_response('Database error: ' . $e->getMessage(), 500);
}

// ============================================================
// AUTH
// ============================================================
function handle_auth(string $method, string $action): void {
    if (session_status() === PHP_SESSION_NONE) session_start();
    if ($action === 'login' && $method === 'POST') {
        require_not_rate_limited('admin');
        $body = body();
        $hash = setting('admin_password_hash');
        $pw = $body['password'] ?? '';
        // Admin credentials must only be stored as password_hash() values.
        // Never fall back to a plaintext site_settings row: settings are
        // primarily public content, and a legacy plaintext row is unsafe even
        // if a future response-filtering regression occurs.
        $ok = ($hash !== '' && password_verify($pw, $hash));
        record_login_attempt($ok);
        if ($ok) {
            $_SESSION[SESSION_KEY] = true;
            json_response(['success' => true]);
        } else {
            error_response('Invalid access code', 401);
        }
    } elseif ($action === 'logout') {
        // Targeted unset instead of session_destroy() — clears the admin
        // session AND the vault unlock (vault must never outlive its parent
        // login), without wiping unrelated session data some other part of
        // this shared PHP session might be holding.
        unset($_SESSION[SESSION_KEY], $_SESSION[VAULT_SESSION_KEY]);
        session_write_close();
        json_response(['success' => true]);
    } elseif ($action === 'check') {
        $authed = !empty($_SESSION[SESSION_KEY]);
        session_write_close();
        json_response(['authenticated' => $authed]);
    } else {
        error_response('Not found', 404);
    }
}

// ============================================================
// SETTINGS
// ============================================================
function is_public_setting_key(string $key): bool {
    static $exact = [
        'phase',
        'event_year',
        'festival_start',
        'festival_end',
        'tagline',
        'show_meetings_section',
        'sponsorship_open',
    ];

    if (in_array($key, $exact, true)) return true;

    return (bool) preg_match(
        '/^hero_(planning|active|live)_(image|line1|line2|sub|ctaLabel|ctaHref)$/',
        $key
    ) || (bool) preg_match(
        '/^participate_(volunteer|vendor|performer|parade)$/',
        $key
    );
}

function handle_settings(string $method): void {
    if ($method === 'GET') {
        // site_settings also contains server-only authentication values. Keep
        // this endpoint fail-closed: only explicitly public presentation keys
        // may ever leave the server.
        $rows = db()->query('SELECT setting_key, setting_value FROM site_settings')->fetchAll();
        $out = [];
        foreach ($rows as $r) {
            if (is_public_setting_key($r['setting_key'])) {
                $out[$r['setting_key']] = $r['setting_value'];
            }
        }
        json_response($out);
    }
    if ($method === 'POST') {
        require_auth();
        $body = body();
        $st   = db()->prepare('INSERT INTO site_settings (setting_key, setting_value) VALUES (?,?) ON DUPLICATE KEY UPDATE setting_value=?');
        foreach ($body as $k => $v) {
            // This route edits public site presentation only. Credentials,
            // vault configuration, tokens, and future private settings must
            // use dedicated protected workflows.
            if (!is_public_setting_key((string) $k)) continue;
            $st->execute([$k, $v, $v]);
        }
        json_response(['success' => true]);
    }
}

// ============================================================
// EVENTS
// ============================================================
function sql_datetime(mixed $value): ?string {
    if ($value === null || $value === '') return null;
    return substr(str_replace('T', ' ', (string) $value), 0, 19);
}

function slugify(string $value): string {
    $slug = strtolower(trim((string) preg_replace('/[^a-z0-9]+/i', '-', $value), '-'));
    return $slug !== '' ? $slug : 'series';
}

function unique_series_slug(PDO $db, string $title, ?int $excludeId = null): string {
    $base = slugify($title);
    $slug = $base;
    $i = 2;
    while (true) {
        $sql = 'SELECT id FROM event_series WHERE slug = ?' . ($excludeId !== null ? ' AND id <> ?' : '');
        $st = $db->prepare($sql);
        $st->execute($excludeId !== null ? [$slug, $excludeId] : [$slug]);
        if (!$st->fetch()) return $slug;
        $slug = $base . '-' . $i++;
    }
}

function series_row(array $row): array {
    $r = camel($row);
    $r['id'] = (int) $row['id'];
    $r['featured'] = (bool) ($row['featured'] ?? false);
    return $r;
}

function handle_event_series(string $method, ?int $id): void {
    $db = db();

    if ($method === 'GET') {
        $admin = ($_GET['admin'] ?? '') === '1';
        if ($admin) require_auth();

        if ($id !== null) {
            $sql = 'SELECT * FROM event_series WHERE id = ?';
            if (!$admin) $sql .= " AND publication_status = 'published'";
            $st = $db->prepare($sql);
            $st->execute([$id]);
            $row = $st->fetch();
            if (!$row) error_response('Event series not found', 404);
            json_response(series_row($row));
        }

        $where = $admin ? '' : "WHERE publication_status = 'published'";
        $rows = $db->query("SELECT * FROM event_series {$where} ORDER BY featured DESC, start_at DESC, id DESC")->fetchAll();
        json_response(array_map('series_row', $rows));
    }

    if ($method === 'POST') {
        require_auth();
        $b = body();
        $title = trim((string) ($b['title'] ?? ''));
        if ($title === '') error_response('Series title is required', 422);
        $slug = unique_series_slug($db, $title);
        $st = $db->prepare('INSERT INTO event_series
            (title,slug,series_type,start_at,end_at,timezone,description,publication_status,featured)
            VALUES (?,?,?,?,?,?,?,?,?)');
        $st->execute([
            $title, $slug, $b['seriesType'] ?? 'festival', sql_datetime($b['startAt'] ?? null),
            sql_datetime($b['endAt'] ?? null), $b['timezone'] ?? 'America/Denver',
            $b['description'] ?? null, $b['publicationStatus'] ?? 'draft', (int) ($b['featured'] ?? 0),
        ]);
        $newId = (int) $db->lastInsertId();
        $row = $db->query('SELECT * FROM event_series WHERE id = ' . $newId)->fetch();
        json_response(series_row($row), 201);
    }

    if ($method === 'PUT' && $id !== null) {
        require_auth();
        $b = body();
        $title = trim((string) ($b['title'] ?? ''));
        if ($title === '') error_response('Series title is required', 422);
        $slug = unique_series_slug($db, $title, $id);
        $st = $db->prepare('UPDATE event_series SET
            title=?,slug=?,series_type=?,start_at=?,end_at=?,timezone=?,description=?,publication_status=?,featured=?
            WHERE id=?');
        $st->execute([
            $title, $slug, $b['seriesType'] ?? 'festival', sql_datetime($b['startAt'] ?? null),
            sql_datetime($b['endAt'] ?? null), $b['timezone'] ?? 'America/Denver',
            $b['description'] ?? null, $b['publicationStatus'] ?? 'draft', (int) ($b['featured'] ?? 0), $id,
        ]);
        $st2 = $db->prepare('SELECT * FROM event_series WHERE id = ?');
        $st2->execute([$id]);
        $row = $st2->fetch();
        if (!$row) error_response('Event series not found', 404);
        json_response(series_row($row));
    }

    if ($method === 'DELETE' && $id !== null) {
        require_auth();
        $db->prepare('DELETE FROM event_series WHERE id = ?')->execute([$id]);
        json_response(['success' => true]);
    }

    error_response('Method not allowed', 405);
}

function event_row(array $row): array {
    $r = camel($row);
    $r['insuranceRequired'] = (bool)($row['insurance_required'] ?? false);
    $r['featured']          = (bool)($row['featured'] ?? false);
    $r['seriesId']          = isset($row['series_id']) ? (int) $row['series_id'] : null;
    $r['sortOrder']         = (int)($row['sort_order'] ?? 0);
    return $r;
}

function handle_events(string $method, ?int $id): void {
    $db = db();
    $select = 'SELECT e.*, s.title AS series_title, s.slug AS series_slug
               FROM events e LEFT JOIN event_series s ON s.id = e.series_id';

    if ($method === 'GET') {
        $admin = ($_GET['admin'] ?? '') === '1';
        if ($admin) require_auth();
        if ($id !== null) {
            $sql = $select . ' WHERE e.id = ?';
            if (!$admin) $sql .= " AND e.publication_status = 'published' AND (e.series_id IS NULL OR s.publication_status = 'published')";
            $st = $db->prepare($sql);
            $st->execute([$id]);
            $row = $st->fetch();
            if (!$row) { error_response('Event not found', 404); }
            json_response(event_row($row));
        }
        $where = $admin ? '' : "WHERE e.publication_status = 'published' AND (e.series_id IS NULL OR s.publication_status = 'published')";
        $rows = $db->query($select . " {$where} ORDER BY e.start_at IS NULL, e.start_at ASC, e.sort_order ASC, e.id ASC")->fetchAll();
        json_response(array_map('event_row', $rows));
    }

    if ($method === 'POST') {
        require_auth();
        $b = body();
        $st = $db->prepare('INSERT INTO events
            (series_id,title,event_type,start_at,end_at,timezone,publication_status,featured,
             status,icon_key,color,event_date,event_date_sort,event_time,location,location_details,description,teaser_text,ticket_link,ticket_price,
             venue_contact_name,venue_contact_email,venue_contact_phone,venue_contract_url,
             insurance_required,insurance_carrier,insurance_policy_num,insurance_expiry,insurance_amount,insurance_notes,
             estimated_attendance,hero_image,flyer_image,extra_image,extra_image_label,sort_order)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
        $st->execute([
            $b['seriesId'] ?? null, $b['title'] ?? 'New Event', $b['eventType'] ?? null,
            sql_datetime($b['startAt'] ?? null), sql_datetime($b['endAt'] ?? null), $b['timezone'] ?? 'America/Denver',
            $b['publicationStatus'] ?? 'draft', (int) ($b['featured'] ?? 0),
            $b['status'] ?? 'TBD', $b['iconKey'] ?? 'Heart', $b['color'] ?? '#E91E63',
            $b['eventDate'] ?? null, $b['eventDateSort'] ?? null, $b['eventTime'] ?? null, $b['location'] ?? null, $b['locationDetails'] ?? null,
            $b['description'] ?? null, $b['teaserText'] ?? null, $b['ticketLink'] ?? null, $b['ticketPrice'] ?? null,
            $b['venueContactName'] ?? null, $b['venueContactEmail'] ?? null, $b['venueContactPhone'] ?? null, $b['venueContractUrl'] ?? null,
            (int)($b['insuranceRequired'] ?? 0), $b['insuranceCarrier'] ?? null, $b['insurancePolicyNum'] ?? null,
            $b['insuranceExpiry'] ?? null, $b['insuranceAmount'] ?? null, $b['insuranceNotes'] ?? null,
            $b['estimatedAttendance'] ?? null,
            $b['heroImage'] ?? null, $b['flyerImage'] ?? null, $b['extraImage'] ?? null, $b['extraImageLabel'] ?? null,
            $b['sortOrder'] ?? 0
        ]);
        $newId = (int)$db->lastInsertId();
        $st2 = $db->prepare($select . ' WHERE e.id = ?');
        $st2->execute([$newId]);
        json_response(event_row($st2->fetch()), 201);
    }

    if ($method === 'PUT' && $id !== null) {
        require_auth();
        $b = body();
        $st = $db->prepare('UPDATE events SET
            series_id=?,title=?,event_type=?,start_at=?,end_at=?,timezone=?,publication_status=?,featured=?,
            status=?,icon_key=?,color=?,event_date=?,event_date_sort=?,event_time=?,location=?,location_details=?,
            description=?,teaser_text=?,ticket_link=?,ticket_price=?,
            venue_contact_name=?,venue_contact_email=?,venue_contact_phone=?,venue_contract_url=?,
            insurance_required=?,insurance_carrier=?,insurance_policy_num=?,insurance_expiry=?,insurance_amount=?,insurance_notes=?,
            estimated_attendance=?,hero_image=?,flyer_image=?,extra_image=?,extra_image_label=?,sort_order=?
            WHERE id=?');
        $st->execute([
            $b['seriesId'] ?? null, $b['title'] ?? '', $b['eventType'] ?? null,
            sql_datetime($b['startAt'] ?? null), sql_datetime($b['endAt'] ?? null), $b['timezone'] ?? 'America/Denver',
            $b['publicationStatus'] ?? 'draft', (int) ($b['featured'] ?? 0),
            $b['status'] ?? 'TBD', $b['iconKey'] ?? 'Heart', $b['color'] ?? '#E91E63',
            $b['eventDate'] ?? null, $b['eventDateSort'] ?? null, $b['eventTime'] ?? null, $b['location'] ?? null, $b['locationDetails'] ?? null,
            $b['description'] ?? null, $b['teaserText'] ?? null, $b['ticketLink'] ?? null, $b['ticketPrice'] ?? null,
            $b['venueContactName'] ?? null, $b['venueContactEmail'] ?? null, $b['venueContactPhone'] ?? null, $b['venueContractUrl'] ?? null,
            (int)($b['insuranceRequired'] ?? 0), $b['insuranceCarrier'] ?? null, $b['insurancePolicyNum'] ?? null,
            $b['insuranceExpiry'] ?? null, $b['insuranceAmount'] ?? null, $b['insuranceNotes'] ?? null,
            $b['estimatedAttendance'] ?? null,
            $b['heroImage'] ?? null, $b['flyerImage'] ?? null, $b['extraImage'] ?? null, $b['extraImageLabel'] ?? null,
            $b['sortOrder'] ?? 0,
            $id
        ]);
        $st2 = $db->prepare($select . ' WHERE e.id = ?');
        $st2->execute([$id]);
        json_response(event_row($st2->fetch()));
    }

    if ($method === 'DELETE' && $id !== null) {
        require_auth();
        $db->prepare('DELETE FROM events WHERE id = ?')->execute([$id]);
        json_response(['success' => true]);
    }
}

// ============================================================
// EVENTS — REORDER
// Bulk-assigns sort_order from a client-supplied array of event ids, in
// the order they should appear. Used both for manual drag/nudge reordering
// and for "sort by date" (the client computes the target order from
// event_date_sort and posts the resulting id list here) — one endpoint,
// two UI actions.
// ============================================================
function handle_events_reorder(string $method): void {
    if (!in_array($method, ['POST', 'PUT'], true)) { error_response('Method not allowed', 405); }
    require_auth();
    $b   = body();
    $ids = $b['ids'] ?? null;
    if (!is_array($ids) || empty($ids)) { error_response('ids array required', 400); }

    $db = db();
    $db->beginTransaction();
    try {
        $st = $db->prepare('UPDATE events SET sort_order = ? WHERE id = ?');
        foreach (array_values($ids) as $i => $id) {
            $st->execute([$i, (int)$id]);
        }
        $db->commit();
    } catch (Exception $e) {
        $db->rollBack();
        error_response('Failed to reorder events', 500);
    }
    json_response(['success' => true]);
}

// ============================================================
// PERFORMERS
// ============================================================
function handle_performers(string $method, ?int $eventId, ?int $perfId): void {
    $db = db();
    if ($method === 'GET') {
        $st = $db->prepare('SELECT * FROM event_performers WHERE event_id = ? ORDER BY sort_order, id');
        $st->execute([$eventId]);
        $rows = $st->fetchAll();
        json_response(array_map(fn($r) => cast_bools(camel($r), ['confirmed']), $rows));
    }
    if ($method === 'POST') {
        require_auth();
        $b = body();
        $st = $db->prepare('INSERT INTO event_performers (event_id,name,type,bio,contact_email,contact_phone,fee,confirmed,performance_time,set_length_mins,tech_rider,notes,sort_order)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)');
        $st->execute([$eventId, $b['name']??'', $b['type']??'Other', $b['bio']??null, $b['contactEmail']??null, $b['contactPhone']??null,
            $b['fee']??null, (int)($b['confirmed']??0), $b['performanceTime']??null, $b['setLengthMins']??null, $b['techRider']??null, $b['notes']??null, $b['sortOrder']??0]);
        json_response(['id' => (int)$db->lastInsertId()], 201);
    }
    if ($method === 'PUT' && $perfId !== null) {
        require_auth();
        $b = body();
        $db->prepare('UPDATE event_performers SET name=?,type=?,bio=?,contact_email=?,contact_phone=?,fee=?,confirmed=?,performance_time=?,set_length_mins=?,tech_rider=?,notes=?,sort_order=? WHERE id=? AND event_id=?')
           ->execute([$b['name']??'', $b['type']??'Other', $b['bio']??null, $b['contactEmail']??null, $b['contactPhone']??null,
               $b['fee']??null, (int)($b['confirmed']??0), $b['performanceTime']??null, $b['setLengthMins']??null, $b['techRider']??null, $b['notes']??null, $b['sortOrder']??0, $perfId, $eventId]);
        json_response(['success' => true]);
    }
    if ($method === 'DELETE' && $perfId !== null) {
        require_auth();
        $db->prepare('DELETE FROM event_performers WHERE id=? AND event_id=?')->execute([$perfId, $eventId]);
        json_response(['success' => true]);
    }
}

// ============================================================
// COSTS / BUDGET
// ============================================================
function handle_costs(string $method, ?int $eventId, ?int $costId): void {
    $db = db();
    if ($method === 'GET') {
        $st = $db->prepare('SELECT * FROM event_costs WHERE event_id = ? ORDER BY category, id');
        $st->execute([$eventId]);
        json_response(array_map(fn($r) => cast_bools(camel($r), ['approved','paid']), $st->fetchAll()));
    }
    if ($method === 'POST') {
        require_auth();
        $b = body();
        $db->prepare('INSERT INTO event_costs (event_id,category,description,estimated_cost,actual_cost,vendor,approved,paid,notes) VALUES (?,?,?,?,?,?,?,?,?)')
           ->execute([$eventId, $b['category']??'Other', $b['description']??'', $b['estimatedCost']??null, $b['actualCost']??null,
               $b['vendor']??null, (int)($b['approved']??0), (int)($b['paid']??0), $b['notes']??null]);
        json_response(['id' => (int)$db->lastInsertId()], 201);
    }
    if ($method === 'PUT' && $costId !== null) {
        require_auth();
        $b = body();
        $db->prepare('UPDATE event_costs SET category=?,description=?,estimated_cost=?,actual_cost=?,vendor=?,approved=?,paid=?,notes=? WHERE id=? AND event_id=?')
           ->execute([$b['category']??'Other', $b['description']??'', $b['estimatedCost']??null, $b['actualCost']??null,
               $b['vendor']??null, (int)($b['approved']??0), (int)($b['paid']??0), $b['notes']??null, $costId, $eventId]);
        json_response(['success' => true]);
    }
    if ($method === 'DELETE' && $costId !== null) {
        require_auth();
        $db->prepare('DELETE FROM event_costs WHERE id=? AND event_id=?')->execute([$costId, $eventId]);
        json_response(['success' => true]);
    }
}

// ============================================================
// MATERIALS
// ============================================================
function handle_materials(string $method, ?int $eventId, ?int $matId): void {
    $db = db();
    if ($method === 'GET') {
        $st = $db->prepare('SELECT * FROM event_materials WHERE event_id = ? ORDER BY id');
        $st->execute([$eventId]);
        json_response(array_map(fn($r) => cast_bools(camel($r), ['obtained']), $st->fetchAll()));
    }
    if ($method === 'POST') {
        require_auth();
        $b = body();
        $db->prepare('INSERT INTO event_materials (event_id,item,quantity,unit,obtained,source,cost,notes) VALUES (?,?,?,?,?,?,?,?)')
           ->execute([$eventId, $b['item']??'', $b['quantity']??1, $b['unit']??null, (int)($b['obtained']??0), $b['source']??null, $b['cost']??null, $b['notes']??null]);
        json_response(['id' => (int)$db->lastInsertId()], 201);
    }
    if ($method === 'PUT' && $matId !== null) {
        require_auth();
        $b = body();
        $db->prepare('UPDATE event_materials SET item=?,quantity=?,unit=?,obtained=?,source=?,cost=?,notes=? WHERE id=? AND event_id=?')
           ->execute([$b['item']??'', $b['quantity']??1, $b['unit']??null, (int)($b['obtained']??0), $b['source']??null, $b['cost']??null, $b['notes']??null, $matId, $eventId]);
        json_response(['success' => true]);
    }
    if ($method === 'DELETE' && $matId !== null) {
        require_auth();
        $db->prepare('DELETE FROM event_materials WHERE id=? AND event_id=?')->execute([$matId, $eventId]);
        json_response(['success' => true]);
    }
}

// ============================================================
// STAFF ROLES
// ============================================================
function handle_staff(string $method, ?int $eventId, ?int $staffId): void {
    $db = db();
    if ($method === 'GET') {
        $st = $db->prepare('SELECT * FROM event_staff_roles WHERE event_id = ? ORDER BY id');
        $st->execute([$eventId]);
        json_response(array_map(fn($r) => cast_bools(camel($r), ['isPaid']), $st->fetchAll()));
    }
    if ($method === 'POST') {
        require_auth();
        $b = body();
        $db->prepare('INSERT INTO event_staff_roles (event_id,role_name,description,slots_needed,slots_filled,is_paid,pay_rate,shift_time,notes) VALUES (?,?,?,?,?,?,?,?,?)')
           ->execute([$eventId, $b['roleName']??'', $b['description']??null, $b['slotsNeeded']??1, $b['slotsFilled']??0, (int)($b['isPaid']??0), $b['payRate']??null, $b['shiftTime']??null, $b['notes']??null]);
        json_response(['id' => (int)$db->lastInsertId()], 201);
    }
    if ($method === 'PUT' && $staffId !== null) {
        require_auth();
        $b = body();
        $db->prepare('UPDATE event_staff_roles SET role_name=?,description=?,slots_needed=?,slots_filled=?,is_paid=?,pay_rate=?,shift_time=?,notes=? WHERE id=? AND event_id=?')
           ->execute([$b['roleName']??'', $b['description']??null, $b['slotsNeeded']??1, $b['slotsFilled']??0, (int)($b['isPaid']??0), $b['payRate']??null, $b['shiftTime']??null, $b['notes']??null, $staffId, $eventId]);
        json_response(['success' => true]);
    }
    if ($method === 'DELETE' && $staffId !== null) {
        require_auth();
        $db->prepare('DELETE FROM event_staff_roles WHERE id=? AND event_id=?')->execute([$staffId, $eventId]);
        json_response(['success' => true]);
    }
}

// ============================================================
// MARKETING MATERIALS
// ============================================================
function handle_marketing(string $method, ?int $eventId, ?int $mktId): void {
    $db = db();
    if ($method === 'GET') {
        $st = $db->prepare('SELECT * FROM event_marketing WHERE event_id = ? ORDER BY publish_date, id');
        $st->execute([$eventId]);
        json_response(array_map('camel', $st->fetchAll()));
    }
    if ($method === 'POST') {
        require_auth();
        $b = body();
        $db->prepare('INSERT INTO event_marketing (event_id,material_type,title,description,file_url,channel,publish_date,status,notes) VALUES (?,?,?,?,?,?,?,?,?)')
           ->execute([$eventId, $b['materialType']??'Other', $b['title']??'', $b['description']??null, $b['fileUrl']??null, $b['channel']??null, $b['publishDate']??null, $b['status']??'draft', $b['notes']??null]);
        json_response(['id' => (int)$db->lastInsertId()], 201);
    }
    if ($method === 'PUT' && $mktId !== null) {
        require_auth();
        $b = body();
        $db->prepare('UPDATE event_marketing SET material_type=?,title=?,description=?,file_url=?,channel=?,publish_date=?,status=?,notes=? WHERE id=? AND event_id=?')
           ->execute([$b['materialType']??'Other', $b['title']??'', $b['description']??null, $b['fileUrl']??null, $b['channel']??null, $b['publishDate']??null, $b['status']??'draft', $b['notes']??null, $mktId, $eventId]);
        json_response(['success' => true]);
    }
    if ($method === 'DELETE' && $mktId !== null) {
        require_auth();
        $db->prepare('DELETE FROM event_marketing WHERE id=? AND event_id=?')->execute([$mktId, $eventId]);
        json_response(['success' => true]);
    }
}

// ============================================================
// MEETINGS
// ============================================================
function meeting_row(array $row): array {
    $r = camel($row);
    $r['isPast']     = (bool)$row['is_past'];
    $r['date']       = $row['meeting_date'];      // keep compat with frontend
    $r['time']       = $row['meeting_time'];
    $r['whoIsInvited'] = $row['who_is_invited'];
    $r['agendaUrl']  = $row['minutes_url'] ?? null;
    return $r;
}

function handle_meetings(string $method, ?int $id): void {
    $db = db();
    if ($method === 'GET') {
        if ($id !== null) {
            $st = $db->prepare('SELECT * FROM meetings WHERE id = ?');
            $st->execute([$id]);
            $row = $st->fetch();
            if (!$row) { error_response('Not found', 404); }
            json_response(meeting_row($row));
        }
        $rows = $db->query('SELECT * FROM meetings ORDER BY meeting_date ASC')->fetchAll();
        json_response(array_map('meeting_row', $rows));
    }
    if ($method === 'POST') {
        require_auth();
        $b = body();
        $db->prepare('INSERT INTO meetings (meeting_date,meeting_time,location,who_is_invited,is_past,minutes_url,notes) VALUES (?,?,?,?,?,?,?)')
           ->execute([$b['date']??date('Y-m-d'), $b['time']??'', $b['location']??'', $b['whoIsInvited']??'Everyone', (int)($b['isPast']??0), $b['agendaUrl']??null, $b['notes']??null]);
        json_response(['id' => (int)$db->lastInsertId()], 201);
    }
    if ($method === 'PUT' && $id !== null) {
        require_auth();
        $b = body();
        $db->prepare('UPDATE meetings SET meeting_date=?,meeting_time=?,location=?,who_is_invited=?,is_past=?,minutes_url=?,notes=? WHERE id=?')
           ->execute([$b['date']??date('Y-m-d'), $b['time']??'', $b['location']??'', $b['whoIsInvited']??'', (int)($b['isPast']??0), $b['agendaUrl']??null, $b['notes']??null, $id]);
        json_response(['success' => true]);
    }
    if ($method === 'DELETE' && $id !== null) {
        require_auth();
        $db->prepare('DELETE FROM meetings WHERE id=?')->execute([$id]);
        json_response(['success' => true]);
    }
}

// ============================================================
// MEETING AGENDA ITEMS
// ============================================================
function handle_agenda(string $method, ?int $meetingId, ?int $agendaId): void {
    $db = db();
    if ($method === 'GET') {
        $st = $db->prepare('SELECT * FROM meeting_agenda_items WHERE meeting_id = ? ORDER BY item_order, id');
        $st->execute([$meetingId]);
        json_response(array_map('camel', $st->fetchAll()));
    }
    if ($method === 'POST') {
        require_auth();
        $b = body();
        $db->prepare('INSERT INTO meeting_agenda_items (meeting_id,item_order,title,description,presenter,time_allocated,status,outcome) VALUES (?,?,?,?,?,?,?,?)')
           ->execute([$meetingId, $b['itemOrder']??0, $b['title']??'', $b['description']??null, $b['presenter']??null, $b['timeAllocated']??null, $b['status']??'pending', $b['outcome']??null]);
        json_response(['id' => (int)$db->lastInsertId()], 201);
    }
    if ($method === 'PUT' && $agendaId !== null) {
        require_auth();
        $b = body();
        $db->prepare('UPDATE meeting_agenda_items SET item_order=?,title=?,description=?,presenter=?,time_allocated=?,status=?,outcome=? WHERE id=? AND meeting_id=?')
           ->execute([$b['itemOrder']??0, $b['title']??'', $b['description']??null, $b['presenter']??null, $b['timeAllocated']??null, $b['status']??'pending', $b['outcome']??null, $agendaId, $meetingId]);
        json_response(['success' => true]);
    }
    if ($method === 'DELETE' && $agendaId !== null) {
        require_auth();
        $db->prepare('DELETE FROM meeting_agenda_items WHERE id=? AND meeting_id=?')->execute([$agendaId, $meetingId]);
        json_response(['success' => true]);
    }
}

// ============================================================
// MEETING DECISIONS
// ============================================================
function handle_decisions(string $method, ?int $meetingId, ?int $decisionId): void {
    $db = db();
    if ($method === 'GET') {
        $st = $db->prepare('SELECT d.*, e.title as event_title FROM meeting_decisions d
            LEFT JOIN events e ON d.affects_event_id = e.id
            WHERE d.meeting_id = ? ORDER BY d.id');
        $st->execute([$meetingId]);
        json_response(array_map('camel', $st->fetchAll()));
    }
    if ($method === 'POST') {
        require_auth();
        $b = body();
        $db->prepare('INSERT INTO meeting_decisions (meeting_id,agenda_item_id,decision,decided_by,affects_event_id,implementation_status) VALUES (?,?,?,?,?,?)')
           ->execute([$meetingId, $b['agendaItemId']??null, $b['decision']??'', $b['decidedBy']??null, $b['affectsEventId']??null, $b['implementationStatus']??'pending']);
        json_response(['id' => (int)$db->lastInsertId()], 201);
    }
    if ($method === 'PUT' && $decisionId !== null) {
        require_auth();
        $b = body();
        $db->prepare('UPDATE meeting_decisions SET decision=?,decided_by=?,affects_event_id=?,implementation_status=?,implementation_notes=? WHERE id=? AND meeting_id=?')
           ->execute([$b['decision']??'', $b['decidedBy']??null, $b['affectsEventId']??null, $b['implementationStatus']??'pending', $b['implementationNotes']??null, $decisionId, $meetingId]);
        json_response(['success' => true]);
    }
    if ($method === 'DELETE' && $decisionId !== null) {
        require_auth();
        $db->prepare('DELETE FROM meeting_decisions WHERE id=? AND meeting_id=?')->execute([$decisionId, $meetingId]);
        json_response(['success' => true]);
    }
}

// ============================================================
// PHOTO ALBUMS
// ============================================================
function handle_photos(string $method, ?int $id): void {
    $db = db();
    if ($method === 'GET') {
        $rows = $db->query('SELECT * FROM photo_albums ORDER BY year DESC, title ASC')->fetchAll();
        json_response(array_map(fn($r) => cast_bools(camel($r), ['visible']), $rows));
    }
    if ($method === 'POST') {
        require_auth();
        $b = body();
        $db->prepare('INSERT INTO photo_albums (title,year,event_id,cover_image,external_url,photo_count,description,visible) VALUES (?,?,?,?,?,?,?,?)')
           ->execute([$b['title']??'', $b['year']??date('Y'), $b['eventId']??null, $b['coverImage']??null, $b['externalUrl']??null, (int)($b['photoCount']??0), $b['description']??null, (int)($b['visible']??1)]);
        json_response(['id' => (int)$db->lastInsertId()], 201);
    }
    if (($method === 'PUT' || $method === 'DELETE') && $id) {
        require_auth();
        if ($method === 'DELETE') {
            $db->prepare('DELETE FROM photo_albums WHERE id=?')->execute([$id]);
            json_response(['success' => true]);
        }
        $b = body();
        $db->prepare('UPDATE photo_albums SET title=?,year=?,event_id=?,cover_image=?,external_url=?,photo_count=?,description=?,visible=? WHERE id=?')
           ->execute([$b['title']??'', $b['year']??date('Y'), $b['eventId']??null, $b['coverImage']??null, $b['externalUrl']??null, (int)($b['photoCount']??0), $b['description']??null, (int)($b['visible']??1), $id]);
        json_response(['success' => true]);
    }
}

// ============================================================
// SPONSORS
// ============================================================
function handle_sponsors(string $method, ?int $id): void {
    $db = db();
    if ($method === 'GET') {
        $rows = $db->query('SELECT * FROM sponsors WHERE active=1 ORDER BY FIELD(level,"Platinum","Gold","Silver","Community","In-Kind"), name')->fetchAll();
        json_response(array_map(fn($r) => cast_bools(camel($r), ['active','paymentReceived']), $rows));
    }
    if ($method === 'POST') {
        require_auth();
        $b = body();
        $db->prepare('INSERT INTO sponsors (name,level,logo_url,logo_initials,website,contact_name,contact_email,contact_phone,amount,payment_received,year,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
           ->execute([$b['name']??'', $b['level']??'Community', $b['logoUrl']??null, $b['logoInitials']??null, $b['website']??null, $b['contactName']??null, $b['contactEmail']??null, $b['contactPhone']??null, $b['amount']??null, (int)($b['paymentReceived']??0), $b['year']??2026, $b['notes']??null]);
        json_response(['id' => (int)$db->lastInsertId()], 201);
    }
    if ($method === 'PUT' && $id !== null) {
        require_auth();
        $b = body();
        $db->prepare('UPDATE sponsors SET name=?,level=?,logo_url=?,logo_initials=?,website=?,contact_name=?,contact_email=?,contact_phone=?,amount=?,payment_received=?,notes=? WHERE id=?')
           ->execute([$b['name']??'', $b['level']??'Community', $b['logoUrl']??null, $b['logoInitials']??null, $b['website']??null, $b['contactName']??null, $b['contactEmail']??null, $b['contactPhone']??null, $b['amount']??null, (int)($b['paymentReceived']??0), $b['notes']??null, $id]);
        json_response(['success' => true]);
    }
    if ($method === 'DELETE' && $id !== null) {
        require_auth();
        $db->prepare('UPDATE sponsors SET active=0 WHERE id=?')->execute([$id]);
        json_response(['success' => true]);
    }
}

// ============================================================
// APPLICATIONS (public submission)
// ============================================================
function handle_apply(string $method, string $type): void {
    if ($method !== 'POST') { error_response('Method not allowed', 405); }
    $allowed = ['volunteer','vendor','performer','parade','sponsor'];
    if (!in_array($type, $allowed)) { error_response('Invalid type', 400); }
    $b = body();
    if (empty($b['name']) || empty($b['email'])) { error_response('Name and email required', 400); }
    db()->prepare('INSERT INTO applications (type,name,email,phone,organization,notes,file_name,file_data) VALUES (?,?,?,?,?,?,?,?)')
       ->execute([$type, $b['name'], $b['email'], $b['phone']??null, $b['organization']??null, $b['notes']??null, $b['fileName']??null, $b['fileData']??null]);
    json_response(['success' => true]);
}

// ============================================================
// APPLICATIONS (admin management)
// ============================================================
function handle_applications(string $method, ?int $id): void {
    $db = db();
    if ($method === 'GET') {
        require_auth();
        $type   = $_GET['type'] ?? null;
        $status = $_GET['status'] ?? null;
        $sql    = 'SELECT * FROM applications WHERE 1=1';
        $params = [];
        if ($type)   { $sql .= ' AND type=?';   $params[] = $type; }
        if ($status) { $sql .= ' AND status=?'; $params[] = $status; }
        $sql .= ' ORDER BY submitted_at DESC';
        $st = $db->prepare($sql);
        $st->execute($params);
        json_response(array_map('camel', $st->fetchAll()));
    }
    if ($method === 'PUT' && $id !== null) {
        require_auth();
        $b = body();
        $db->prepare('UPDATE applications SET status=?,assigned_to=?,internal_notes=? WHERE id=?')
           ->execute([$b['status']??'new', $b['assignedTo']??null, $b['internalNotes']??null, $id]);
        json_response(['success' => true]);
    }
    if ($method === 'DELETE' && $id !== null) {
        require_auth();
        $db->prepare('DELETE FROM applications WHERE id=?')->execute([$id]);
        json_response(['success' => true]);
    }
}

// ============================================================
// NEWSLETTER
// ============================================================
function handle_newsletter(string $method, ?int $id): void {
    if ($method === 'GET') {
        require_auth();
        $rows = db()->query('SELECT id, email, name, subscribed_at FROM newsletter_subscribers WHERE active=1 ORDER BY subscribed_at DESC')->fetchAll();
        json_response($rows);
        return;
    }
    if ($method === 'DELETE') {
        require_auth();
        if (!$id) { error_response('id required', 400); }
        db()->prepare('UPDATE newsletter_subscribers SET active=0 WHERE id=?')->execute([$id]);
        json_response(['success' => true]);
        return;
    }
    if ($method !== 'POST') { error_response('Method not allowed', 405); }
    $b = body();
    if (empty($b['email'])) { error_response('Email required', 400); }
    db()->prepare('INSERT IGNORE INTO newsletter_subscribers (email,name) VALUES (?,?)')
       ->execute([$b['email'], $b['name']??null]);
    json_response(['success' => true]);
}

// ============================================================
// SUGGESTION BOX
// ============================================================
function handle_suggestions(string $method, ?int $id): void {
    $db = db();

    if ($method === 'GET') {
        require_auth();
        $status = $_GET['status'] ?? null;
        $sql = 'SELECT * FROM suggestions WHERE 1=1';
        $params = [];
        if ($status) { $sql .= ' AND status=?'; $params[] = $status; }
        $sql .= ' ORDER BY created_at DESC';
        $st = $db->prepare($sql);
        $st->execute($params);
        json_response(array_map('camel', $st->fetchAll()));
        return;
    }

    if ($method === 'POST') {
        $b = body();

        // Honeypot — a field real visitors never see or fill (hidden off-
        // screen in the form). A bot's autofill populates it; reply exactly
        // like a real success so it doesn't learn to look elsewhere, but
        // skip the insert.
        if (trim($b['website'] ?? '') !== '') {
            json_response(['success' => true], 201);
            return;
        }

        $message = trim($b['message'] ?? '');
        if ($message === '') { error_response('A message is required', 400); }
        if (strlen($message) > 4000) { $message = substr($message, 0, 4000); }

        // Per-IP rate limit — a real visitor submits this once in a blue
        // moon; caps runaway/scripted spam without needing a CAPTCHA.
        $ip = client_ip();
        $countSt = $db->prepare(
            'SELECT COUNT(*) FROM suggestions WHERE ip_address = ? AND created_at > (NOW() - INTERVAL 60 MINUTE)'
        );
        $countSt->execute([$ip]);
        if ((int)$countSt->fetchColumn() >= 5) {
            error_response("You've submitted several suggestions recently — please wait a bit before sending more.", 429);
        }

        $db->prepare('INSERT INTO suggestions (message, submitter_name, submitter_email, ip_address) VALUES (?,?,?,?)')
           ->execute([
               $message,
               trim($b['submitterName'] ?? '') ?: null,
               trim($b['submitterEmail'] ?? '') ?: null,
               $ip,
           ]);
        json_response(['success' => true], 201);
        return;
    }

    if ($method === 'PUT' && $id !== null) {
        require_auth();
        $b = body();
        $status = $b['status'] ?? null;
        if (!in_array($status, ['new', 'reviewed', 'archived'], true)) {
            error_response('Invalid status', 400);
        }
        $meetingId = isset($b['reviewedMeetingId']) && is_numeric($b['reviewedMeetingId']) ? (int)$b['reviewedMeetingId'] : null;
        $db->prepare('UPDATE suggestions SET status=?, reviewed_meeting_id=?, reviewed_at=NOW() WHERE id=?')
           ->execute([$status, $meetingId, $id]);
        json_response(['success' => true]);
        return;
    }

    if ($method === 'DELETE' && $id !== null) {
        require_auth();
        $db->prepare('DELETE FROM suggestions WHERE id=?')->execute([$id]);
        json_response(['success' => true]);
        return;
    }

    error_response('Not found', 404);
}

// Promotes a suggestion straight into a real, numbered agenda item on the
// given meeting — one action instead of the board copying the text by hand.
// Marks the suggestion reviewed either way (promoted or dismissed).
function handle_suggestion_promote(string $method, ?int $id): void {
    if ($method !== 'POST' || $id === null) { error_response('Not found', 404); }
    require_auth();
    $db = db();
    $b = body();
    $meetingId = $b['meetingId'] ?? null;
    if (!$meetingId || !is_numeric($meetingId)) { error_response('meetingId is required', 400); }

    $st = $db->prepare('SELECT * FROM suggestions WHERE id=?');
    $st->execute([$id]);
    $suggestion = $st->fetch();
    if (!$suggestion) { error_response('Suggestion not found', 404); }

    $countSt = $db->prepare('SELECT COUNT(*) FROM meeting_agenda_items WHERE meeting_id=?');
    $countSt->execute([$meetingId]);
    $order = (int)$countSt->fetchColumn();

    $title = mb_strlen($suggestion['message']) > 80 ? mb_substr($suggestion['message'], 0, 77) . '…' : $suggestion['message'];
    $presenter = trim($suggestion['submitter_name'] ?? '') ?: 'Community suggestion';

    $db->prepare('INSERT INTO meeting_agenda_items (meeting_id,item_order,title,description,presenter,status) VALUES (?,?,?,?,?,?)')
       ->execute([$meetingId, $order, $title, $suggestion['message'], $presenter, 'pending']);
    $agendaItemId = (int)$db->lastInsertId();

    $db->prepare('UPDATE suggestions SET status=?, reviewed_meeting_id=?, reviewed_at=NOW() WHERE id=?')
       ->execute(['reviewed', $meetingId, $id]);

    json_response(['agendaItemId' => $agendaItemId], 201);
}

// ============================================================
// CONTRIBUTION NOTIFICATIONS
// ============================================================
function handle_contribute(string $method): void {
    if ($method !== 'POST') { error_response('Method not allowed', 405); }
    $b = body();
    if (empty($b['email'])) { error_response('Email required', 400); }
    db()->prepare(
        'INSERT INTO contribution_notifications (name,email,amount,method,message) VALUES (?,?,?,?,?)'
    )->execute([
        $b['name']    ?? null,
        $b['email'],
        isset($b['amount']) ? (float)$b['amount'] : null,
        $b['method']  ?? null,
        $b['message'] ?? null,
    ]);
    json_response(['success' => true]);
}

// Admin GET for contribution notifications
function handle_contributions(string $method): void {
    require_auth();
    if ($method !== 'GET') { error_response('Method not allowed', 405); }
    $rows = db()->query(
        'SELECT id, name, email, amount, method, message, submitted_at AS submittedAt FROM contribution_notifications ORDER BY submitted_at DESC'
    )->fetchAll();
    json_response($rows);
}

// ============================================================
// DASHBOARD STATS
// ============================================================
function handle_dashboard(): void {
    require_auth();
    $db = db();
    $stats = [
        'eventsTotal'     => (int)$db->query('SELECT COUNT(*) FROM events')->fetchColumn(),
        'eventsConfirmed' => (int)$db->query("SELECT COUNT(*) FROM events WHERE status='CONFIRMED'")->fetchColumn(),
        'meetingsUpcoming'=> (int)$db->query("SELECT COUNT(*) FROM meetings WHERE is_past=0")->fetchColumn(),
        'meetingsPast'    => (int)$db->query("SELECT COUNT(*) FROM meetings WHERE is_past=1")->fetchColumn(),
        'applicationsNew' => (int)$db->query("SELECT COUNT(*) FROM applications WHERE status='new'")->fetchColumn(),
        'applicationsTotal'=> (int)$db->query("SELECT COUNT(*) FROM applications")->fetchColumn(),
        'decisionsTotal'  => (int)$db->query("SELECT COUNT(*) FROM meeting_decisions")->fetchColumn(),
        'sponsorsTotal'   => (int)$db->query("SELECT COUNT(*) FROM sponsors WHERE active=1")->fetchColumn(),
        'budgetEstimated' => (float)$db->query("SELECT COALESCE(SUM(estimated_cost),0) FROM event_costs")->fetchColumn(),
        'budgetActual'    => (float)$db->query("SELECT COALESCE(SUM(actual_cost),0) FROM event_costs")->fetchColumn(),
        'byApplicationType' => [],
        'recentDecisions'   => [],
    ];
    $typeRows = $db->query("SELECT type, COUNT(*) as cnt FROM applications GROUP BY type")->fetchAll();
    foreach ($typeRows as $r) {
        $stats['byApplicationType'][$r['type']] = (int)$r['cnt'];
    }
    $decRows = $db->query("SELECT d.*, m.meeting_date FROM meeting_decisions d JOIN meetings m ON d.meeting_id=m.id ORDER BY d.created_at DESC LIMIT 5")->fetchAll();
    $stats['recentDecisions'] = array_map('camel', $decRows);
    json_response($stats);
}

// ============================================================
// LEGACY: /api/data/:type (compat with old frontend calls)
// ============================================================
function handle_legacy_data(string $method, string $type): void {
    switch ($type) {
        case 'events':   handle_events($method, null);   break;
        case 'meetings': handle_meetings($method, null); break;
        case 'sponsors': handle_sponsors($method, null); break;
        default: error_response('Unknown data type', 404);
    }
}
