<?php
// ============================================================
// Taos Pride — Photo Gallery (public + admin)
//
// Merged in from the former gallery.taospride.org project, which ran as a
// separate app/DB/domain — that split was the root cause of a real bug: the
// admin proxy that used to live here made a cross-domain HTTPS call to
// gallery.taospride.org, and a broken cert on that side silently failed
// every request. Living in this file, in this database, on this domain,
// there's no proxy left to break.
//
// Public routes (dispatched from index.php's 'years' case — mirrors
// gallery's own original public API):
//   GET /api/years
//   GET /api/years/{year}/events
//   GET /api/years/{year}/events/{slug}
//   GET /api/years/{year}/events/{slug}/photos
//
// Admin routes (dispatched from index.php's 'gallery' case — same URL
// shape the frontend already called when this file was a proxy, so
// GallerySection.tsx/galleryApi.ts needed no changes):
//   GET/POST   /api/gallery/years
//   PUT/DELETE /api/gallery/years/{id}
//   GET/POST   /api/gallery/events            (GET takes ?yearId=)
//   PUT/DELETE /api/gallery/events/{id}
//   GET/POST   /api/gallery/events/{id}/photos  (POST is multipart upload)
//   PUT        /api/gallery/events/{id}/cover
//   PUT/DELETE /api/gallery/photos/{id}
//
// Photo files live on disk under GALLERY_PHOTOS_DIR/{eventId}/, one
// directory per event, served directly by Apache as static files (see root
// .htaccess) — never through PHP.
// ============================================================

// ── Photo directory helper ───────────────────────────────────────────────
function gallery_photos_dir(int $eventId): string {
    $dir = GALLERY_PHOTOS_DIR . '/' . $eventId;
    if (!is_dir($dir)) {
        mkdir($dir, 0755, true);
    }
    return $dir;
}

function delete_event_photos_from_disk(int $eventId): void {
    $photos = db()->prepare('SELECT filename FROM gallery_photos WHERE event_id = ?');
    $photos->execute([$eventId]);
    $dir = GALLERY_PHOTOS_DIR . '/' . $eventId;
    foreach ($photos->fetchAll() as $p) {
        @unlink($dir . '/'       . $p['filename']);
        @unlink($dir . '/thumb_' . $p['filename']);
    }
    if (is_dir($dir)) @rmdir($dir);
}

// ============================================================
// PUBLIC — dispatched from index.php as handle_gallery_public($method, $parts)
// $parts[0] === 'years'
// ============================================================

function handle_gallery_public(string $method, array $parts): void {
    if ($method !== 'GET') error_response('Not found', 404);

    $year = $parts[1] ?? '';
    $sub  = $parts[2] ?? '';   // 'events'
    $slug = $parts[3] ?? '';
    $sub2 = $parts[4] ?? '';   // 'photos'

    if ($year === '') { handle_get_years(); return; }
    if (!is_numeric($year) || $sub !== 'events') error_response('Not found', 404);

    if ($slug === '')          { handle_get_events((int)$year); return; }
    if ($sub2 === '')          { handle_get_event((int)$year, $slug); return; }
    if ($sub2 === 'photos')    { handle_get_event_photos((int)$year, $slug); return; }
    error_response('Not found', 404);
}

function handle_get_years(): void {
    $rows = db()->query(
        'SELECT gy.*,
            COUNT(DISTINCT ge.id) AS event_count,
            COUNT(DISTINCT gp.id) AS photo_count,
            (SELECT CONCAT(first_photo.event_id, "/thumb_", first_photo.filename)
             FROM gallery_photos first_photo
             JOIN gallery_events first_ev ON first_photo.event_id = first_ev.id
             WHERE first_ev.year_id = gy.id AND first_ev.visible = 1
             ORDER BY first_ev.sort_order, first_ev.id, first_photo.sort_order, first_photo.id
             LIMIT 1) AS cover_path
         FROM gallery_years gy
         LEFT JOIN gallery_events ge ON ge.year_id = gy.id AND ge.visible = 1
         LEFT JOIN gallery_photos gp ON gp.event_id = ge.id
         WHERE gy.visible = 1
         GROUP BY gy.id
         ORDER BY gy.year DESC'
    )->fetchAll();

    json_response(array_map(function ($r) {
        $out = camel($r);
        $out['visible']    = (bool)$r['visible'];
        $out['eventCount'] = (int)$r['event_count'];
        $out['photoCount'] = (int)$r['photo_count'];
        $out['coverThumb'] = $r['cover_path'] ? '/gallery-photos/' . $r['cover_path'] : null;
        unset($out['coverPath']);
        return $out;
    }, $rows));
}

function handle_get_events(int $year): void {
    $st = db()->prepare(
        'SELECT ge.*,
            gy.year,
            COUNT(gp.id) AS photo_count,
            COALESCE(
                (SELECT filename FROM gallery_photos WHERE id = ge.cover_photo_id LIMIT 1),
                (SELECT filename FROM gallery_photos WHERE event_id = ge.id ORDER BY sort_order, id LIMIT 1)
            ) AS cover_filename
         FROM gallery_events ge
         JOIN gallery_years gy ON ge.year_id = gy.id
         LEFT JOIN gallery_photos gp ON gp.event_id = ge.id
         WHERE gy.year = ? AND ge.visible = 1 AND gy.visible = 1
         GROUP BY ge.id
         ORDER BY ge.sort_order, ge.event_date, ge.id'
    );
    $st->execute([$year]);

    json_response(array_map(function ($r) {
        $out = camel($r);
        $out['visible']    = (bool)$r['visible'];
        $out['photoCount'] = (int)$r['photo_count'];
        $out['coverThumb'] = $r['cover_filename']
            ? '/gallery-photos/' . $r['id'] . '/thumb_' . $r['cover_filename']
            : null;
        unset($out['coverFilename']);
        return $out;
    }, $st->fetchAll()));
}

function handle_get_event(int $year, string $slug): void {
    $st = db()->prepare(
        'SELECT ge.*, gy.year,
            COUNT(gp.id) AS photo_count,
            COALESCE(
                (SELECT filename FROM gallery_photos WHERE id = ge.cover_photo_id LIMIT 1),
                (SELECT filename FROM gallery_photos WHERE event_id = ge.id ORDER BY sort_order, id LIMIT 1)
            ) AS cover_filename
         FROM gallery_events ge
         JOIN gallery_years gy ON ge.year_id = gy.id
         LEFT JOIN gallery_photos gp ON gp.event_id = ge.id
         WHERE gy.year = ? AND ge.slug = ? AND ge.visible = 1 AND gy.visible = 1
         GROUP BY ge.id
         LIMIT 1'
    );
    $st->execute([$year, $slug]);
    $r = $st->fetch();
    if (!$r) error_response('Event not found', 404);

    $out = camel($r);
    $out['visible']    = (bool)$r['visible'];
    $out['photoCount'] = (int)$r['photo_count'];
    $out['coverThumb'] = $r['cover_filename']
        ? '/gallery-photos/' . $r['id'] . '/thumb_' . $r['cover_filename']
        : null;
    unset($out['coverFilename']);
    json_response($out);
}

function handle_get_event_photos(int $year, string $slug): void {
    $st = db()->prepare(
        'SELECT gp.*
         FROM gallery_photos gp
         JOIN gallery_events ge ON gp.event_id = ge.id
         JOIN gallery_years  gy ON ge.year_id  = gy.id
         WHERE gy.year = ? AND ge.slug = ? AND ge.visible = 1 AND gy.visible = 1
         ORDER BY gp.sort_order, gp.id'
    );
    $st->execute([$year, $slug]);
    json_response(array_map('camel', $st->fetchAll()));
}

// ============================================================
// ADMIN — dispatched from index.php as handle_gallery_admin($method, $parts)
// $parts[0] === 'gallery'; sub-path starts at $parts[1]
// ============================================================

function handle_gallery_admin(string $method, array $parts): void {
    require_auth();

    $r1 = $parts[1] ?? '';   // 'years' | 'events' | 'photos'
    $r2 = $parts[2] ?? '';   // id
    $r3 = $parts[3] ?? '';   // 'photos' | 'cover'

    // ── Years ──────────────────────────────────────────────
    if ($method === 'GET' && $r1 === 'years' && $r2 === '') { handle_admin_get_years(); return; }
    if ($method === 'POST' && $r1 === 'years' && $r2 === '') { handle_admin_post_year(); return; }
    if ($method === 'PUT' && $r1 === 'years' && is_numeric($r2)) { handle_admin_put_year((int)$r2); return; }
    if ($method === 'DELETE' && $r1 === 'years' && is_numeric($r2)) { handle_admin_delete_year((int)$r2); return; }

    // ── Events ─────────────────────────────────────────────
    if ($method === 'GET' && $r1 === 'events' && $r2 === '') { handle_admin_get_events(); return; }
    if ($method === 'POST' && $r1 === 'events' && $r2 === '') { handle_admin_post_event(); return; }
    if ($method === 'PUT' && $r1 === 'events' && is_numeric($r2) && $r3 === '') { handle_admin_put_event((int)$r2); return; }
    if ($method === 'DELETE' && $r1 === 'events' && is_numeric($r2)) { handle_admin_delete_event((int)$r2); return; }
    if ($method === 'POST' && $r1 === 'events' && is_numeric($r2) && $r3 === 'photos') { handle_admin_upload_photo((int)$r2); return; }
    if ($method === 'PUT' && $r1 === 'events' && is_numeric($r2) && $r3 === 'cover') {
        $b = body();
        db()->prepare('UPDATE gallery_events SET cover_photo_id = ? WHERE id = ?')
           ->execute([$b['photoId'] ?? null, (int)$r2]);
        json_response(['success' => true]);
        return;
    }
    if ($method === 'GET' && $r1 === 'events' && is_numeric($r2) && $r3 === 'photos') { handle_admin_get_photos((int)$r2); return; }

    // ── Photos ─────────────────────────────────────────────
    if ($method === 'PUT' && $r1 === 'photos' && is_numeric($r2)) { handle_admin_put_photo((int)$r2); return; }
    if ($method === 'DELETE' && $r1 === 'photos' && is_numeric($r2)) { handle_admin_delete_photo((int)$r2); return; }

    error_response('Not found', 404);
}

function year_row(array $r): array {
    $out = camel($r);
    $out['visible']    = (bool)$r['visible'];
    $out['eventCount'] = (int)($r['event_count'] ?? 0);
    $out['photoCount'] = (int)($r['photo_count'] ?? 0);
    return $out;
}

function handle_admin_get_years(): void {
    $rows = db()->query(
        'SELECT gy.*,
            COUNT(DISTINCT ge.id) AS event_count,
            COUNT(DISTINCT gp.id) AS photo_count
         FROM gallery_years gy
         LEFT JOIN gallery_events ge ON ge.year_id = gy.id
         LEFT JOIN gallery_photos gp ON gp.event_id = ge.id
         GROUP BY gy.id
         ORDER BY gy.year DESC'
    )->fetchAll();
    json_response(array_map('year_row', $rows));
}

function handle_admin_post_year(): void {
    $b = body();
    if (empty($b['year']) || !is_numeric($b['year'])) error_response('Year is required', 400);
    try {
        db()->prepare('INSERT INTO gallery_years (year, description, visible) VALUES (?,?,1)')
           ->execute([(int)$b['year'], $b['description'] ?? null]);
        json_response(['id' => (int)db()->lastInsertId()], 201);
    } catch (PDOException $e) {
        if (str_contains($e->getMessage(), 'Duplicate')) error_response('That year already exists', 409);
        error_response('Database error', 500);
    }
}

function handle_admin_put_year(int $id): void {
    $b = body();
    db()->prepare('UPDATE gallery_years SET year=?, description=?, visible=?, sort_order=? WHERE id=?')
       ->execute([$b['year'] ?? 0, $b['description'] ?? null, (int)($b['visible'] ?? 1), (int)($b['sortOrder'] ?? 0), $id]);
    json_response(['success' => true]);
}

function handle_admin_delete_year(int $id): void {
    $events = db()->prepare('SELECT id FROM gallery_events WHERE year_id = ?');
    $events->execute([$id]);
    foreach ($events->fetchAll() as $ev) {
        delete_event_photos_from_disk((int)$ev['id']);
    }
    db()->prepare('DELETE FROM gallery_years WHERE id=?')->execute([$id]);
    json_response(['success' => true]);
}

function gallery_event_row(array $r): array {
    $out = camel($r);
    $out['visible']    = (bool)$r['visible'];
    $out['photoCount'] = (int)($r['photo_count'] ?? 0);
    return $out;
}

function handle_admin_get_events(): void {
    $yearId = isset($_GET['yearId']) && is_numeric($_GET['yearId']) ? (int)$_GET['yearId'] : null;
    if ($yearId) {
        $st = db()->prepare(
            'SELECT ge.*, gy.year, COUNT(gp.id) AS photo_count
             FROM gallery_events ge
             JOIN gallery_years gy ON ge.year_id = gy.id
             LEFT JOIN gallery_photos gp ON gp.event_id = ge.id
             WHERE ge.year_id = ?
             GROUP BY ge.id
             ORDER BY ge.sort_order, ge.event_date, ge.id'
        );
        $st->execute([$yearId]);
    } else {
        $st = db()->query(
            'SELECT ge.*, gy.year, COUNT(gp.id) AS photo_count
             FROM gallery_events ge
             JOIN gallery_years gy ON ge.year_id = gy.id
             LEFT JOIN gallery_photos gp ON gp.event_id = ge.id
             GROUP BY ge.id
             ORDER BY gy.year DESC, ge.sort_order, ge.id'
        );
    }
    json_response(array_map('gallery_event_row', $st->fetchAll()));
}

function handle_admin_post_event(): void {
    $b = body();
    if (empty($b['name']) || empty($b['yearId'])) error_response('name and yearId are required', 400);
    $slug = preg_replace('/[^a-z0-9]+/', '-', strtolower(trim($b['slug'] ?? $b['name'])));
    $slug = trim($slug, '-');
    try {
        db()->prepare(
            'INSERT INTO gallery_events (year_id, name, slug, description, event_date, visible) VALUES (?,?,?,?,?,1)'
        )->execute([(int)$b['yearId'], $b['name'], $slug, $b['description'] ?? null, $b['eventDate'] ?? null]);
        json_response(['id' => (int)db()->lastInsertId()], 201);
    } catch (PDOException $e) {
        if (str_contains($e->getMessage(), 'Duplicate')) error_response('An event with that name already exists for this year', 409);
        error_response('Database error', 500);
    }
}

function handle_admin_put_event(int $id): void {
    $b = body();
    $slug = preg_replace('/[^a-z0-9]+/', '-', strtolower(trim($b['slug'] ?? $b['name'] ?? '')));
    $slug = trim($slug, '-');
    db()->prepare(
        'UPDATE gallery_events SET name=?, slug=?, description=?, event_date=?, visible=?, sort_order=? WHERE id=?'
    )->execute([
        $b['name'] ?? '', $slug, $b['description'] ?? null, $b['eventDate'] ?? null,
        (int)($b['visible'] ?? 1), (int)($b['sortOrder'] ?? 0), $id,
    ]);
    json_response(['success' => true]);
}

function handle_admin_delete_event(int $id): void {
    delete_event_photos_from_disk($id);
    db()->prepare('DELETE FROM gallery_events WHERE id=?')->execute([$id]);
    json_response(['success' => true]);
}

function handle_admin_get_photos(int $eventId): void {
    $st = db()->prepare(
        'SELECT ge.cover_photo_id,
                gp.id, gp.event_id, gp.filename, gp.caption,
                gp.width, gp.height, gp.file_size, gp.sort_order
         FROM gallery_photos gp
         JOIN gallery_events ge ON gp.event_id = ge.id
         WHERE gp.event_id = ?
         ORDER BY gp.sort_order, gp.id'
    );
    $st->execute([$eventId]);
    $rows = $st->fetchAll();
    $coverPhotoId = count($rows) > 0 ? $rows[0]['cover_photo_id'] : null;
    json_response([
        'photos'       => array_map('camel', $rows),
        'coverPhotoId' => $coverPhotoId ? (int)$coverPhotoId : null,
    ]);
}

function handle_admin_upload_photo(int $eventId): void {
    $ev = db()->prepare('SELECT id FROM gallery_events WHERE id = ?');
    $ev->execute([$eventId]);
    if (!$ev->fetch()) error_response('Event not found', 404);

    $uploadErrors = [
        UPLOAD_ERR_INI_SIZE   => 'File too large for server',
        UPLOAD_ERR_FORM_SIZE  => 'File too large',
        UPLOAD_ERR_PARTIAL    => 'Upload interrupted — please retry',
        UPLOAD_ERR_NO_FILE    => 'No file received',
        UPLOAD_ERR_NO_TMP_DIR => 'Server temp directory missing',
        UPLOAD_ERR_CANT_WRITE => 'Server could not write file',
    ];

    foreach (['full', 'thumb'] as $field) {
        if (empty($_FILES[$field])) error_response("Missing '{$field}' file", 400);
        $err = $_FILES[$field]['error'];
        if ($err !== UPLOAD_ERR_OK) {
            error_response($uploadErrors[$err] ?? "Upload error ({$field}): $err", 400);
        }
        if ($_FILES[$field]['size'] > 50 * 1024 * 1024) {
            error_response("File '{$field}' exceeds 50 MB", 413);
        }
    }

    $dir      = gallery_photos_dir($eventId);
    $filename = uniqid('img_', true) . '.jpg';

    if (!move_uploaded_file($_FILES['full']['tmp_name'],  $dir . '/'        . $filename)) {
        error_response('Failed to store full image', 500);
    }
    if (!move_uploaded_file($_FILES['thumb']['tmp_name'], $dir . '/thumb_'  . $filename)) {
        @unlink($dir . '/' . $filename);
        error_response('Failed to store thumbnail', 500);
    }

    $maxSortOrder = db()->prepare('SELECT COALESCE(MAX(sort_order), 0) FROM gallery_photos WHERE event_id = ?');
    $maxSortOrder->execute([$eventId]);
    $nextOrder = (int)$maxSortOrder->fetchColumn() + 1;

    db()->prepare(
        'INSERT INTO gallery_photos (event_id, filename, caption, width, height, file_size, sort_order)
         VALUES (?,?,?,?,?,?,?)'
    )->execute([
        $eventId,
        $filename,
        (isset($_POST['caption']) && $_POST['caption'] !== '') ? $_POST['caption'] : null,
        (int)($_POST['width']  ?? 0),
        (int)($_POST['height'] ?? 0),
        (int)$_FILES['full']['size'],
        $nextOrder,
    ]);

    json_response(['id' => (int)db()->lastInsertId(), 'filename' => $filename], 201);
}

function handle_admin_put_photo(int $id): void {
    $b = body();
    db()->prepare('UPDATE gallery_photos SET caption=? WHERE id=?')
       ->execute([
           isset($b['caption']) && $b['caption'] !== '' ? $b['caption'] : null,
           $id,
       ]);
    json_response(['success' => true]);
}

function handle_admin_delete_photo(int $id): void {
    $st = db()->prepare('SELECT event_id, filename FROM gallery_photos WHERE id=?');
    $st->execute([$id]);
    $photo = $st->fetch();
    if ($photo) {
        $dir = GALLERY_PHOTOS_DIR . '/' . $photo['event_id'];
        @unlink($dir . '/'        . $photo['filename']);
        @unlink($dir . '/thumb_'  . $photo['filename']);
        db()->prepare('UPDATE gallery_events SET cover_photo_id = NULL WHERE cover_photo_id = ?')
           ->execute([$id]);
        db()->prepare('DELETE FROM gallery_photos WHERE id=?')->execute([$id]);
    }
    json_response(['success' => true]);
}
