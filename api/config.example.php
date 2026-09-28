<?php
// Copy this file to config.php and replace every placeholder.
// config.php is intentionally ignored by Git.

define('DB_HOST', 'localhost');
define('DB_NAME', 'your_database_name');
define('DB_USER', 'your_database_user');
define('DB_PASS', 'your_database_password');
define('DB_CHARSET', 'utf8mb4');

define('SESSION_KEY', 'replace_with_a_random_session_key');
define('CORS_ORIGIN', 'https://taospride.org');

// Absolute or project-relative location used by api/gallery.php.
define('GALLERY_PHOTOS_DIR', dirname(__DIR__) . '/gallery-photos');

define('LOGIN_MAX_ATTEMPTS', 8);
define('LOGIN_WINDOW_MINUTES', 15);

function db(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=' . DB_CHARSET;
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
    }
    return $pdo;
}

function json_response(mixed $data, int $status = 200): never {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

function error_response(string $message, int $status = 400): never {
    json_response(['error' => $message], $status);
}

function client_ip(): string {
    $ip = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    if (strpos($ip, ',') !== false) $ip = trim(explode(',', $ip)[0]);
    return $ip;
}

function require_not_rate_limited(string $scope): void {
    try {
        if ($scope === 'vault') {
            $st = db()->prepare(
                "SELECT COUNT(*) FROM vault_access_log
                 WHERE ip_address = ? AND action = 'unlock' AND success = 0
                   AND accessed_at > (NOW() - INTERVAL ? MINUTE)"
            );
        } else {
            $st = db()->prepare(
                'SELECT COUNT(*) FROM login_attempts
                 WHERE ip_address = ? AND scope = ? AND success = 0
                   AND attempted_at > (NOW() - INTERVAL ? MINUTE)'
            );
        }
        $scope === 'vault'
            ? $st->execute([client_ip(), LOGIN_WINDOW_MINUTES])
            : $st->execute([client_ip(), $scope, LOGIN_WINDOW_MINUTES]);
        if ((int)$st->fetchColumn() >= LOGIN_MAX_ATTEMPTS) {
            error_response('Too many failed attempts. Please wait a few minutes and try again.', 429);
        }
    } catch (Exception $e) {
        // A logging problem must not block legitimate sign-ins.
    }
}

function record_login_attempt(bool $success): void {
    try {
        db()->prepare('INSERT INTO login_attempts (ip_address, scope, success) VALUES (?,?,?)')
           ->execute([client_ip(), 'admin', $success ? 1 : 0]);
    } catch (Exception $e) {
        // A logging problem must not fail the authentication response.
    }
}

function require_auth(): void {
    if (session_status() === PHP_SESSION_NONE) session_start();
    if (empty($_SESSION[SESSION_KEY])) error_response('Unauthorized', 401);
    session_write_close();
}

function body(): array {
    $raw = file_get_contents('php://input');
    return json_decode($raw, true) ?? [];
}

function setting(string $key, string $default = ''): string {
    try {
        $st = db()->prepare('SELECT setting_value FROM site_settings WHERE setting_key = ?');
        $st->execute([$key]);
        $row = $st->fetch();
        return $row ? (string)$row['setting_value'] : $default;
    } catch (Exception) {
        return $default;
    }
}

function cast_bools(array $row, array $fields): array {
    foreach ($fields as $field) {
        if (array_key_exists($field, $row)) $row[$field] = (bool)$row[$field];
    }
    return $row;
}

function camel(array $row): array {
    $out = [];
    foreach ($row as $key => $value) {
        $camelKey = lcfirst(str_replace('_', '', ucwords($key, '_')));
        $out[$camelKey] = $value;
    }
    return $out;
}
