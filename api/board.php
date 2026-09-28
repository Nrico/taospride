<?php
// ============================================================
// Taos Pride — Board Portal API
// All routes under /api/board/*
// ============================================================

// Board portal now shares the main site's single unified admin session
// (SESSION_KEY, defined in config.php) instead of its own password/session —
// see require_board_auth() and handle_board_auth() below. The standalone
// BOARD_SESSION_KEY was retired as part of the admin-portal unification.

// Directory where uploaded board files are stored on disk.
// Created automatically on first upload if it doesn't exist.
define('BOARD_UPLOADS_DIR', __DIR__ . '/board_uploads');

// ─── Board auth ───────────────────────────────────────────────────────────────

function require_board_auth(): void {
    // Board access now requires only the single unified admin login —
    // reuse the same check (and same 401 shape) the rest of the site uses.
    require_auth();
}

function handle_board(string $method, array $parts): void {
    $resource = $parts[1] ?? '';
    $id       = isset($parts[2]) && is_numeric($parts[2]) ? (int)$parts[2] : null;
    $sub      = '';
    if ($id !== null && isset($parts[3]) && !is_numeric($parts[3])) {
        $sub = $parts[3];
    } elseif ($id === null && isset($parts[2]) && !is_numeric($parts[2])) {
        // e.g. /board/auth/login — id is null, parts[2] is action
    }

    switch ($resource) {

        case 'auth':
            $action = $parts[2] ?? '';
            handle_board_auth($method, $action);
            break;

        case 'members':
            if ($sub === 'terms')      { handle_board_terms($method, $id, null);      break; }
            if ($sub === 'committees') { handle_board_member_committees($method, $id, null); break; }
            handle_board_members($method, $id);
            break;

        case 'terms':
            // /board/terms/:id  — PUT / DELETE a specific term
            handle_board_terms($method, null, $id);
            break;

        case 'member_committees':
            // /board/member_committees/:id — PUT / DELETE
            handle_board_member_committees($method, null, $id);
            break;

        case 'positions':
            handle_board_positions($method, $id);
            break;

        case 'committees':
            handle_board_committees($method, $id);
            break;

        case 'duties':
            handle_board_duties($method, $id);
            break;

        case 'files':
            handle_board_files($method, $id, $sub);
            break;

        case 'vault':
            handle_vault($method, $parts);
            break;

        default:
            error_response('Board resource not found', 404);
    }
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

// Backward-compat shim for the old standalone /board/ login screen. Validates
// against the single unified admin credential and sets the same SESSION_KEY
// flag the main site uses — board.php no longer has a password of its own.
// Safe to delete once the old /board/ bundle is retired (Phase 4).
function handle_board_auth(string $method, string $action): void {
    if (session_status() === PHP_SESSION_NONE) session_start();

    if ($action === 'login' && $method === 'POST') {
        // Same 'admin' scope/counter as /api/auth/login — same credential,
        // shared rate limit, so this endpoint can't be used to bypass it.
        require_not_rate_limited('admin');
        $body  = body();
        $hash  = setting('admin_password_hash');
        $plain = setting('admin_password_plain');
        $pw    = $body['password'] ?? '';
        $ok    = ($hash !== '' && password_verify($pw, $hash))
              || ($plain !== '' && hash_equals($plain, $pw));
        record_login_attempt($ok);
        if ($ok) {
            $_SESSION[SESSION_KEY] = true;
            json_response(['success' => true]);
        } else {
            error_response('Invalid password', 401);
        }
    } elseif ($action === 'logout') {
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

// ─── Members ──────────────────────────────────────────────────────────────────

function board_member_row(array $row): array {
    $r = camel($row);
    $r['active'] = (bool)$row['active'];
    return $r;
}

function handle_board_members(string $method, ?int $id): void {
    require_board_auth();
    $db = db();

    if ($method === 'GET') {
        if ($id !== null) {
            $st = $db->prepare('SELECT * FROM board_members WHERE id = ?');
            $st->execute([$id]);
            $row = $st->fetch();
            if (!$row) { error_response('Not found', 404); }
            json_response(board_member_row($row));
        }
        $rows = $db->query('SELECT * FROM board_members ORDER BY last_name, first_name')->fetchAll();
        json_response(array_map('board_member_row', $rows));
    }

    if ($method === 'POST') {
        $b = body();
        $db->prepare('INSERT INTO board_members (first_name,last_name,preferred_name,email,phone,bio,photo,contact_preference,active,notes) VALUES (?,?,?,?,?,?,?,?,?,?)')
           ->execute([
               $b['firstName'] ?? '', $b['lastName'] ?? '',
               $b['preferredName'] ?? null, $b['email'] ?? null, $b['phone'] ?? null,
               $b['bio'] ?? null, $b['photo'] ?? null,
               $b['contactPreference'] ?? 'email',
               isset($b['active']) ? (int)$b['active'] : 1,
               $b['notes'] ?? null,
           ]);
        $newId = (int)$db->lastInsertId();
        $st = $db->prepare('SELECT * FROM board_members WHERE id = ?');
        $st->execute([$newId]);
        json_response(board_member_row($st->fetch()), 201);
    }

    if ($method === 'PUT' && $id !== null) {
        $b = body();
        $db->prepare('UPDATE board_members SET first_name=?,last_name=?,preferred_name=?,email=?,phone=?,bio=?,photo=?,contact_preference=?,active=?,notes=? WHERE id=?')
           ->execute([
               $b['firstName'] ?? '', $b['lastName'] ?? '',
               $b['preferredName'] ?? null, $b['email'] ?? null, $b['phone'] ?? null,
               $b['bio'] ?? null, $b['photo'] ?? null,
               $b['contactPreference'] ?? 'email',
               isset($b['active']) ? (int)$b['active'] : 1,
               $b['notes'] ?? null,
               $id,
           ]);
        json_response(['success' => true]);
    }

    if ($method === 'DELETE' && $id !== null) {
        $db->prepare('DELETE FROM board_members WHERE id=?')->execute([$id]);
        json_response(['success' => true]);
        return;
    }

    error_response('Not found', 404);
}

// ─── Terms ────────────────────────────────────────────────────────────────────

function handle_board_terms(string $method, ?int $memberId, ?int $termId): void {
    require_board_auth();
    $db = db();

    if ($method === 'GET' && $memberId !== null) {
        $st = $db->prepare('SELECT t.*, p.title AS position_title FROM board_member_terms t
            JOIN board_positions p ON t.position_id = p.id
            WHERE t.member_id = ? ORDER BY t.start_date DESC, t.id DESC');
        $st->execute([$memberId]);
        $rows = $st->fetchAll();
        json_response(array_map(fn($r) => array_merge(camel($r), ['isCurrent' => (bool)$r['is_current']]), $rows));
        return;
    }

    // GET all terms (for positions tab and member loading)
    if ($method === 'GET' && $memberId === null && $termId === null) {
        $rows = $db->query('SELECT t.*, p.title AS position_title,
            CONCAT(m.first_name, " ", m.last_name) AS member_name
            FROM board_member_terms t
            JOIN board_positions p ON t.position_id = p.id
            JOIN board_members m ON t.member_id = m.id
            ORDER BY t.is_current DESC, t.start_date DESC')->fetchAll();
        json_response(array_map(fn($r) => array_merge(camel($r), ['isCurrent' => (bool)$r['is_current']]), $rows));
        return;
    }

    if ($method === 'POST' && $memberId !== null) {
        $b = body();
        $db->prepare('INSERT INTO board_member_terms (member_id,position_id,start_date,end_date,is_current,notes) VALUES (?,?,?,?,?,?)')
           ->execute([
               $memberId,
               $b['positionId'] ?? 0,
               $b['startDate'] ?? null,
               $b['endDate'] ?? null,
               isset($b['isCurrent']) ? (int)$b['isCurrent'] : 1,
               $b['notes'] ?? null,
           ]);
        json_response(['id' => (int)$db->lastInsertId()], 201);
        return;
    }

    if ($method === 'PUT' && $termId !== null) {
        $b = body();
        $db->prepare('UPDATE board_member_terms SET position_id=?,start_date=?,end_date=?,is_current=?,notes=? WHERE id=?')
           ->execute([
               $b['positionId'] ?? 0,
               $b['startDate'] ?? null,
               $b['endDate'] ?? null,
               isset($b['isCurrent']) ? (int)$b['isCurrent'] : 0,
               $b['notes'] ?? null,
               $termId,
           ]);
        json_response(['success' => true]);
        return;
    }

    if ($method === 'DELETE' && $termId !== null) {
        $db->prepare('DELETE FROM board_member_terms WHERE id=?')->execute([$termId]);
        json_response(['success' => true]);
        return;
    }

    error_response('Not found', 404);
}

// ─── Positions ────────────────────────────────────────────────────────────────

function handle_board_positions(string $method, ?int $id): void {
    require_board_auth();
    $db = db();

    if ($method === 'GET') {
        $rows = $db->query('SELECT * FROM board_positions ORDER BY sort_order, id')->fetchAll();
        json_response(array_map(fn($r) => array_merge(camel($r), ['isOfficer' => (bool)$r['is_officer']]), $rows));
        return;
    }

    if ($method === 'POST') {
        $b = body();
        $db->prepare('INSERT INTO board_positions (title,description,is_officer,sort_order) VALUES (?,?,?,?)')
           ->execute([$b['title'] ?? '', $b['description'] ?? null, (int)($b['isOfficer'] ?? 0), (int)($b['sortOrder'] ?? 0)]);
        json_response(['id' => (int)$db->lastInsertId()], 201);
        return;
    }

    if ($method === 'PUT' && $id !== null) {
        $b = body();
        $db->prepare('UPDATE board_positions SET title=?,description=?,is_officer=?,sort_order=? WHERE id=?')
           ->execute([$b['title'] ?? '', $b['description'] ?? null, (int)($b['isOfficer'] ?? 0), (int)($b['sortOrder'] ?? 0), $id]);
        json_response(['success' => true]);
        return;
    }

    if ($method === 'DELETE' && $id !== null) {
        $used = $db->prepare('SELECT COUNT(*) FROM board_member_terms WHERE position_id = ?');
        $used->execute([$id]);
        if ((int)$used->fetchColumn() > 0) {
            error_response('Cannot delete a position that has term records. Remove the terms first.', 409);
        }
        $db->prepare('DELETE FROM board_positions WHERE id=?')->execute([$id]);
        json_response(['success' => true]);
        return;
    }

    error_response('Not found', 404);
}

// ─── Committees ───────────────────────────────────────────────────────────────

function handle_board_committees(string $method, ?int $id): void {
    require_board_auth();
    $db = db();

    if ($method === 'GET') {
        $rows = $db->query('SELECT * FROM board_committees ORDER BY name')->fetchAll();
        json_response(array_map(fn($r) => array_merge(camel($r), ['active' => (bool)$r['active']]), $rows));
        return;
    }

    if ($method === 'POST') {
        $b = body();
        $db->prepare('INSERT INTO board_committees (name,description,active) VALUES (?,?,1)')
           ->execute([$b['name'] ?? '', $b['description'] ?? null]);
        json_response(['id' => (int)$db->lastInsertId()], 201);
        return;
    }

    if ($method === 'PUT' && $id !== null) {
        $b = body();
        $db->prepare('UPDATE board_committees SET name=?,description=?,active=? WHERE id=?')
           ->execute([$b['name'] ?? '', $b['description'] ?? null, (int)($b['active'] ?? 1), $id]);
        json_response(['success' => true]);
        return;
    }

    if ($method === 'DELETE' && $id !== null) {
        $db->prepare('UPDATE board_committees SET active=0 WHERE id=?')->execute([$id]);
        json_response(['success' => true]);
        return;
    }

    error_response('Not found', 404);
}

// ─── Member ↔ Committee assignments ──────────────────────────────────────────

function handle_board_member_committees(string $method, ?int $memberId, ?int $assignId): void {
    require_board_auth();
    $db = db();

    // GET all active assignments (for bulk load)
    if ($method === 'GET' && $memberId === null && $assignId === null) {
        $rows = $db->query('SELECT mc.*, c.name AS committee_name,
            CONCAT(m.first_name, " ", m.last_name) AS member_name
            FROM board_member_committees mc
            JOIN board_committees c ON mc.committee_id = c.id
            JOIN board_members m ON mc.member_id = m.id
            WHERE mc.active = 1
            ORDER BY c.name, m.last_name')->fetchAll();
        json_response(array_map(fn($r) => array_merge(camel($r), ['active' => (bool)$r['active']]), $rows));
        return;
    }

    // GET for a specific member
    if ($method === 'GET' && $memberId !== null) {
        $st = $db->prepare('SELECT mc.*, c.name AS committee_name
            FROM board_member_committees mc
            JOIN board_committees c ON mc.committee_id = c.id
            WHERE mc.member_id = ? AND mc.active = 1');
        $st->execute([$memberId]);
        json_response(array_map(fn($r) => array_merge(camel($r), ['active' => (bool)$r['active']]), $st->fetchAll()));
        return;
    }

    if ($method === 'POST' && $memberId !== null) {
        $b = body();
        $db->prepare('INSERT INTO board_member_committees (member_id,committee_id,role,start_date,end_date,active) VALUES (?,?,?,?,?,1)')
           ->execute([
               $memberId,
               $b['committeeId'] ?? 0,
               $b['role'] ?? 'member',
               $b['startDate'] ?? null,
               $b['endDate'] ?? null,
           ]);
        json_response(['id' => (int)$db->lastInsertId()], 201);
        return;
    }

    if ($method === 'PUT' && $assignId !== null) {
        $b = body();
        $db->prepare('UPDATE board_member_committees SET role=?,start_date=?,end_date=?,active=? WHERE id=?')
           ->execute([$b['role'] ?? 'member', $b['startDate'] ?? null, $b['endDate'] ?? null, (int)($b['active'] ?? 1), $assignId]);
        json_response(['success' => true]);
        return;
    }

    if ($method === 'DELETE' && $assignId !== null) {
        $db->prepare('UPDATE board_member_committees SET active=0 WHERE id=?')->execute([$assignId]);
        json_response(['success' => true]);
        return;
    }

    error_response('Not found', 404);
}

// ─── Duties ───────────────────────────────────────────────────────────────────

function handle_board_duties(string $method, ?int $id): void {
    require_board_auth();
    $db = db();

    if ($method === 'GET') {
        $memberId = isset($_GET['member_id']) && is_numeric($_GET['member_id']) ? (int)$_GET['member_id'] : null;
        if ($memberId) {
            $st = $db->prepare('SELECT d.*, CONCAT(m.first_name," ",m.last_name) AS member_name
                FROM board_duties d LEFT JOIN board_members m ON d.member_id = m.id
                WHERE d.member_id = ? ORDER BY FIELD(d.priority,"urgent","high","normal","low"), d.due_date, d.id');
            $st->execute([$memberId]);
        } else {
            $st = $db->query('SELECT d.*, CONCAT(m.first_name," ",m.last_name) AS member_name
                FROM board_duties d LEFT JOIN board_members m ON d.member_id = m.id
                ORDER BY FIELD(d.priority,"urgent","high","normal","low"), d.due_date, d.id');
        }
        json_response(array_map('camel', $st->fetchAll()));
        return;
    }

    if ($method === 'POST') {
        $b = body();
        if (empty($b['title'])) { error_response('Title required', 400); }
        $db->prepare('INSERT INTO board_duties (member_id,title,description,status,priority,due_date) VALUES (?,?,?,?,?,?)')
           ->execute([
               $b['memberId'] ?? null,
               $b['title'],
               $b['description'] ?? null,
               $b['status'] ?? 'active',
               $b['priority'] ?? 'normal',
               $b['dueDate'] ?? null,
           ]);
        json_response(['id' => (int)$db->lastInsertId()], 201);
        return;
    }

    if ($method === 'PUT' && $id !== null) {
        $b = body();
        $db->prepare('UPDATE board_duties SET member_id=?,title=?,description=?,status=?,priority=?,due_date=? WHERE id=?')
           ->execute([
               $b['memberId'] ?? null,
               $b['title'] ?? '',
               $b['description'] ?? null,
               $b['status'] ?? 'active',
               $b['priority'] ?? 'normal',
               $b['dueDate'] ?? null,
               $id,
           ]);
        json_response(['success' => true]);
        return;
    }

    if ($method === 'DELETE' && $id !== null) {
        $db->prepare('DELETE FROM board_duties WHERE id=?')->execute([$id]);
        json_response(['success' => true]);
        return;
    }

    error_response('Not found', 404);
}

// ─── Files ────────────────────────────────────────────────────────────────────

function board_uploads_dir(): string {
    if (!is_dir(BOARD_UPLOADS_DIR)) {
        mkdir(BOARD_UPLOADS_DIR, 0755, true);
        // Prevent direct web access to the uploads directory
        file_put_contents(BOARD_UPLOADS_DIR . '/.htaccess', "Deny from all\n");
    }
    return BOARD_UPLOADS_DIR;
}

function handle_board_files(string $method, ?int $id, string $sub): void {
    require_board_auth();
    $db = db();

    // Stream file download — bypasses JSON response
    if ($sub === 'download' && $id !== null) {
        $row = $db->prepare('SELECT entry_type, original_name, mime_type, file_size, file_data, link_url FROM board_files WHERE id=?');
        $row->execute([$id]);
        $file = $row->fetch();
        if (!$file) { error_response('File not found', 404); }
        if ($file['entry_type'] === 'link') {
            error_response('This entry is a link, not a downloadable file', 400);
        }

        $mime = $file['mime_type'] ?: 'application/octet-stream';
        $name = $file['original_name'];
        header('Content-Type: ' . $mime);
        header('Content-Disposition: attachment; filename="' . str_replace('"', '', $name) . '"');
        header('Cache-Control: private, no-cache');

        $data = $file['file_data'];
        if ($data !== null && strncmp($data, 'fs:', 3) === 0) {
            // Filesystem storage (new uploads)
            $path = BOARD_UPLOADS_DIR . '/' . substr($data, 3);
            if (!file_exists($path)) { error_response('File missing from storage', 404); }
            header('Content-Length: ' . filesize($path));
            readfile($path);
        } else {
            // Legacy base64 data-URL storage
            $encoded = strpos($data, ',') !== false ? explode(',', $data, 2)[1] : $data;
            $binary  = base64_decode($encoded);
            header('Content-Length: ' . strlen($binary));
            echo $binary;
        }
        exit;
    }

    // List entries (metadata only — never return file_data blob)
    if ($method === 'GET' && $id === null) {
        $memberId = isset($_GET['member_id']) && is_numeric($_GET['member_id']) ? (int)$_GET['member_id'] : null;
        $cols = 'f.id, f.member_id, f.entry_type, f.original_name, f.mime_type,
                 f.file_size, f.link_url, f.description, f.category, f.created_at,
                 CONCAT(m.first_name," ",m.last_name) AS member_name';
        if ($memberId) {
            $st = $db->prepare("SELECT $cols
                FROM board_files f LEFT JOIN board_members m ON f.member_id = m.id
                WHERE f.member_id = ? ORDER BY f.created_at DESC");
            $st->execute([$memberId]);
        } else {
            $st = $db->query("SELECT $cols
                FROM board_files f LEFT JOIN board_members m ON f.member_id = m.id
                ORDER BY f.created_at DESC");
        }
        json_response(array_map('camel', $st->fetchAll()));
        return;
    }

    // Create — multipart file upload or external link
    if ($method === 'POST') {

        // Multipart file upload via $_FILES (avoids MySQL packet-size limits)
        if (!empty($_FILES['file'])) {
            $f = $_FILES['file'];
            $uploadErrors = [
                UPLOAD_ERR_INI_SIZE   => 'File exceeds server upload limit',
                UPLOAD_ERR_FORM_SIZE  => 'File too large',
                UPLOAD_ERR_PARTIAL    => 'Upload interrupted — please try again',
                UPLOAD_ERR_NO_FILE    => 'No file received',
                UPLOAD_ERR_NO_TMP_DIR => 'Server configuration error (no temp dir)',
                UPLOAD_ERR_CANT_WRITE => 'Server could not write temp file',
            ];
            if ($f['error'] !== UPLOAD_ERR_OK) {
                error_response($uploadErrors[$f['error']] ?? 'Upload error ' . $f['error'], 400);
            }
            if ($f['size'] > 20 * 1024 * 1024) {
                error_response('File exceeds 20 MB limit', 413);
            }

            // Generate a unique filename and move to permanent storage
            $ext      = strtolower(pathinfo($f['name'], PATHINFO_EXTENSION));
            $stored   = uniqid('bf_', true) . ($ext ? '.' . $ext : '');
            $destPath = board_uploads_dir() . '/' . $stored;
            if (!move_uploaded_file($f['tmp_name'], $destPath)) {
                error_response('Failed to store uploaded file', 500);
            }

            $memberId = (isset($_POST['memberId']) && $_POST['memberId'] !== '') ? (int)$_POST['memberId'] : null;
            $db->prepare('INSERT INTO board_files (member_id, entry_type, original_name, mime_type, file_size, file_data, description, category) VALUES (?,?,?,?,?,?,?,?)')
               ->execute([
                   $memberId,
                   'file',
                   $f['name'],
                   $f['type'] ?: 'application/octet-stream',
                   $f['size'],
                   'fs:' . $stored,   // filesystem pointer — never a large blob
                   $_POST['description'] ?? null,
                   $_POST['category']    ?? 'other',
               ]);
            json_response(['id' => (int)$db->lastInsertId()], 201);
            return;
        }

        // JSON body — external link
        $b    = body();
        $type = $b['entryType'] ?? 'link';
        if ($type === 'link') {
            if (empty($b['linkUrl']) || empty($b['originalName'])) {
                error_response('linkUrl and originalName are required', 400);
            }
            $url = filter_var(trim($b['linkUrl']), FILTER_VALIDATE_URL);
            if (!$url) { error_response('Invalid URL', 400); }
            $db->prepare('INSERT INTO board_files (member_id, entry_type, original_name, link_url, description, category) VALUES (?,?,?,?,?,?)')
               ->execute([
                   $b['memberId']    ?? null,
                   'link',
                   $b['originalName'],
                   $url,
                   $b['description'] ?? null,
                   $b['category']    ?? 'other',
               ]);
            json_response(['id' => (int)$db->lastInsertId()], 201);
            return;
        }

        error_response('Use multipart upload for file entries', 400);
    }

    // Update metadata
    if ($method === 'PUT' && $id !== null) {
        $b = body();
        $db->prepare('UPDATE board_files SET member_id=?, original_name=?, description=?, category=?, link_url=? WHERE id=?')
           ->execute([
               $b['memberId']     ?? null,
               $b['originalName'] ?? '',
               $b['description']  ?? null,
               $b['category']     ?? 'other',
               $b['linkUrl']      ?? null,
               $id,
           ]);
        json_response(['success' => true]);
        return;
    }

    // Delete — also remove the file from disk if filesystem-stored
    if ($method === 'DELETE' && $id !== null) {
        $row = $db->prepare('SELECT file_data FROM board_files WHERE id=?');
        $row->execute([$id]);
        $file = $row->fetch();
        if ($file && $file['file_data'] !== null && strncmp($file['file_data'], 'fs:', 3) === 0) {
            $path = BOARD_UPLOADS_DIR . '/' . substr($file['file_data'], 3);
            if (file_exists($path)) @unlink($path);
        }
        $db->prepare('DELETE FROM board_files WHERE id=?')->execute([$id]);
        json_response(['success' => true]);
        return;
    }

    error_response('Not found', 404);
}

// ============================================================
// SECURE VAULT
// ============================================================

define('VAULT_SESSION_KEY', 'tp_vault_2026');
define('VAULT_UPLOADS_DIR', __DIR__ . '/vault_uploads');

function vault_uploads_dir(): string {
    if (!is_dir(VAULT_UPLOADS_DIR)) {
        mkdir(VAULT_UPLOADS_DIR, 0755, true);
        file_put_contents(VAULT_UPLOADS_DIR . '/.htaccess', "Deny from all\n");
    }
    return VAULT_UPLOADS_DIR;
}

function require_vault_auth(): void {
    if (session_status() === PHP_SESSION_NONE) session_start();
    if (empty($_SESSION[SESSION_KEY])) {
        session_write_close();
        error_response('Admin access required', 401);
    }
    if (empty($_SESSION[VAULT_SESSION_KEY])) {
        session_write_close();
        error_response('Vault PIN required', 403);
    }
    session_write_close();
}

function log_vault(string $action, ?int $itemId, bool $success): void {
    $ip = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    if (strpos($ip, ',') !== false) $ip = trim(explode(',', $ip)[0]);
    $ua = substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 500);
    try {
        db()->prepare('INSERT INTO vault_access_log (ip_address, user_agent, success, action, item_id) VALUES (?,?,?,?,?)')
           ->execute([$ip, $ua, $success ? 1 : 0, $action, $itemId]);
    } catch (Exception $e) { /* don't fail the request on log error */ }
}

function handle_vault(string $method, array $parts): void {
    // parts[0]='board', parts[1]='vault', parts[2]=sub-resource
    $resource = $parts[2] ?? '';
    $id  = isset($parts[3]) && is_numeric($parts[3]) ? (int)$parts[3] : null;
    $sub = ($id !== null && isset($parts[4])) ? $parts[4] : '';

    // ── Unlock: verify PIN, set vault session ──────────────────
    if ($resource === 'unlock' && $method === 'POST') {
        if (session_status() === PHP_SESSION_NONE) session_start();
        if (empty($_SESSION[SESSION_KEY])) {
            session_write_close();
            error_response('Admin access required', 401);
        }
        // A 4-digit PIN is a much smaller keyspace than the admin password —
        // rate limit it specifically, reusing vault_access_log's existing
        // per-attempt records rather than a second table. (Deliberately NOT
        // calling session_write_close() here — this handler still needs to
        // write $_SESSION[VAULT_SESSION_KEY] further down, and closing the
        // session early would silently prevent that write from persisting.)
        require_not_rate_limited('vault');
        $b       = body();
        $entered = trim($b['pin'] ?? '');
        $stored  = setting('vault_pin');
        $ok      = ($stored !== '' && hash_equals($stored, $entered));

        // Log the attempt before closing session
        $ip = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? 'unknown';
        if (strpos($ip, ',') !== false) $ip = trim(explode(',', $ip)[0]);
        $ua = substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 500);
        try {
            db()->prepare('INSERT INTO vault_access_log (ip_address, user_agent, success, action) VALUES (?,?,?,?)')
               ->execute([$ip, $ua, $ok ? 1 : 0, 'unlock']);
        } catch (Exception $e) {}

        if ($ok) $_SESSION[VAULT_SESSION_KEY] = true;
        session_write_close();

        if (!$ok) error_response('Incorrect PIN', 403);
        json_response(['success' => true]);
        return;
    }

    // ── Lock: clear vault session ──────────────────────────────
    if ($resource === 'lock' && $method === 'POST') {
        if (session_status() === PHP_SESSION_NONE) session_start();
        if (empty($_SESSION[SESSION_KEY])) {
            session_write_close();
            error_response('Admin access required', 401);
        }
        unset($_SESSION[VAULT_SESSION_KEY]);
        session_write_close();
        json_response(['success' => true]);
        return;
    }

    // ── Access log ─────────────────────────────────────────────
    if ($resource === 'log' && $method === 'GET') {
        require_vault_auth();
        $st = db()->query('SELECT * FROM vault_access_log ORDER BY accessed_at DESC LIMIT 500');
        json_response(array_map(function ($row) {
            return camel(cast_bools($row, ['success']));
        }, $st->fetchAll()));
        return;
    }

    // ── Items CRUD ─────────────────────────────────────────────
    if ($resource === 'items') {
        handle_vault_items($method, $id, $sub);
        return;
    }

    error_response('Vault resource not found', 404);
}

function handle_vault_items(string $method, ?int $id, string $sub): void {

    // File download — auth check inside, then stream
    if ($sub === 'download' && $id !== null) {
        require_vault_auth();
        $row = db()->prepare('SELECT item_type, title, original_name, mime_type, file_data FROM vault_items WHERE id=?');
        $row->execute([$id]);
        $item = $row->fetch();
        if (!$item || $item['item_type'] !== 'file') error_response('File not found', 404);

        log_vault('download', $id, true);

        $mime = $item['mime_type'] ?: 'application/octet-stream';
        $name = $item['original_name'] ?: $item['title'];
        header('Content-Type: ' . $mime);
        header('Content-Disposition: attachment; filename="' . str_replace('"', '', $name) . '"');
        header('Cache-Control: private, no-cache');

        $data = $item['file_data'];
        if ($data !== null && strncmp($data, 'fs:', 3) === 0) {
            $path = VAULT_UPLOADS_DIR . '/' . substr($data, 3);
            if (!file_exists($path)) error_response('File missing from storage', 404);
            header('Content-Length: ' . filesize($path));
            readfile($path);
        } else {
            $encoded = strpos($data, ',') !== false ? explode(',', $data, 2)[1] : $data;
            $binary  = base64_decode($encoded);
            header('Content-Length: ' . strlen($binary));
            echo $binary;
        }
        exit;
    }

    require_vault_auth();
    $db = db();

    // List
    if ($method === 'GET' && $id === null) {
        $st = $db->query(
            'SELECT id, item_type, title, content, link_url, original_name,
                    mime_type, file_size, category, created_at, updated_at
             FROM vault_items ORDER BY created_at DESC'
        );
        json_response(array_map('camel', $st->fetchAll()));
        return;
    }

    // Create
    if ($method === 'POST') {
        // Multipart file upload
        if (!empty($_FILES['file'])) {
            $f = $_FILES['file'];
            $uploadErrors = [
                UPLOAD_ERR_INI_SIZE   => 'File exceeds server upload limit',
                UPLOAD_ERR_FORM_SIZE  => 'File too large',
                UPLOAD_ERR_PARTIAL    => 'Upload interrupted — please try again',
                UPLOAD_ERR_NO_FILE    => 'No file received',
                UPLOAD_ERR_NO_TMP_DIR => 'Server configuration error (no temp dir)',
                UPLOAD_ERR_CANT_WRITE => 'Server could not write temp file',
            ];
            if ($f['error'] !== UPLOAD_ERR_OK) {
                error_response($uploadErrors[$f['error']] ?? 'Upload error ' . $f['error'], 400);
            }
            if ($f['size'] > 20 * 1024 * 1024) {
                error_response('File exceeds 20 MB limit', 413);
            }
            $ext    = strtolower(pathinfo($f['name'], PATHINFO_EXTENSION));
            $stored = uniqid('vf_', true) . ($ext ? '.' . $ext : '');
            $dest   = vault_uploads_dir() . '/' . $stored;
            if (!move_uploaded_file($f['tmp_name'], $dest)) {
                error_response('Failed to store file', 500);
            }
            $db->prepare(
                'INSERT INTO vault_items (item_type, title, content, original_name, mime_type, file_size, file_data, category)
                 VALUES (?,?,?,?,?,?,?,?)'
            )->execute([
                'file',
                $_POST['title'] ?? $f['name'],
                $_POST['content'] ?? null,
                $f['name'],
                $f['type'] ?: 'application/octet-stream',
                $f['size'],
                'fs:' . $stored,
                $_POST['category'] ?? 'general',
            ]);
            $newId = (int)$db->lastInsertId();
            log_vault('create', $newId, true);
            json_response(['id' => $newId], 201);
            return;
        }

        // JSON — note or link
        $b = body();
        if (empty($b['title'])) error_response('Title is required', 400);
        $db->prepare(
            'INSERT INTO vault_items (item_type, title, content, link_url, category)
             VALUES (?,?,?,?,?)'
        )->execute([
            $b['itemType'] ?? 'note',
            $b['title'],
            $b['content']  ?? null,
            $b['linkUrl']  ?? null,
            $b['category'] ?? 'general',
        ]);
        $newId = (int)$db->lastInsertId();
        log_vault('create', $newId, true);
        json_response(['id' => $newId], 201);
        return;
    }

    // Update
    if ($method === 'PUT' && $id !== null) {
        $b = body();
        $db->prepare(
            'UPDATE vault_items SET title=?, content=?, link_url=?, category=?, updated_at=NOW() WHERE id=?'
        )->execute([
            $b['title']    ?? '',
            $b['content']  ?? null,
            $b['linkUrl']  ?? null,
            $b['category'] ?? 'general',
            $id,
        ]);
        log_vault('update', $id, true);
        json_response(['success' => true]);
        return;
    }

    // Delete — also remove file from disk
    if ($method === 'DELETE' && $id !== null) {
        $row = $db->prepare('SELECT file_data FROM vault_items WHERE id=?');
        $row->execute([$id]);
        $item = $row->fetch();
        if ($item && $item['file_data'] && strncmp($item['file_data'], 'fs:', 3) === 0) {
            $path = VAULT_UPLOADS_DIR . '/' . substr($item['file_data'], 3);
            if (file_exists($path)) @unlink($path);
        }
        $db->prepare('DELETE FROM vault_items WHERE id=?')->execute([$id]);
        log_vault('delete', $id, true);
        json_response(['success' => true]);
        return;
    }

    error_response('Not found', 404);
}
