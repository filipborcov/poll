<?php
// Shared code for the poll API: config, SQLite connection, JSON helpers.
// Files starting with "_" and config.php are blocked from the web by api/.htaccess.

declare(strict_types=1);

const POLL_SCHEMA = <<<SQL
CREATE TABLE IF NOT EXISTS votes (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  team   TEXT    NOT NULL,
  device TEXT    NOT NULL,
  name   TEXT    NOT NULL DEFAULT '',
  r      TEXT    NOT NULL,
  ts     INTEGER NOT NULL,
  UNIQUE (device, team)
);
-- A reset moves votes here instead of deleting them, so a reset can be undone by hand.
CREATE TABLE IF NOT EXISTS votes_archive (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  reset_at INTEGER NOT NULL,
  team     TEXT    NOT NULL,
  device   TEXT    NOT NULL,
  name     TEXT    NOT NULL DEFAULT '',
  r        TEXT    NOT NULL,
  ts       INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS meta (
  k TEXT PRIMARY KEY,
  v TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS admin_log (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  ts     INTEGER NOT NULL,
  action TEXT    NOT NULL,
  ip     TEXT    NOT NULL,
  ok     INTEGER NOT NULL
);
SQL;

function poll_config(): array
{
    static $cfg = null;
    if ($cfg !== null) return $cfg;
    $cfg = [
        'admin_key' => '',          // empty = admin and reset are disabled
        'admin_ips' => [],          // empty = any IP (key still required)
        'db_path'   => '',          // empty = default location, see poll_db_path()
    ];
    $file = __DIR__ . '/config.php';
    if (is_file($file)) {
        $user = require $file;
        if (is_array($user)) $cfg = array_merge($cfg, $user);
    }
    return $cfg;
}

// Default: a "poll-data" folder NEXT TO the site folder (outside the web root),
// falling back to data/ inside the site, which data/.htaccess closes to the web.
function poll_db_path(): string
{
    $cfg = poll_config();
    if ($cfg['db_path'] !== '') return $cfg['db_path'];
    $outside = dirname(__DIR__, 2) . '/poll-data';
    if ((is_dir($outside) || @mkdir($outside, 0700, true)) && is_writable($outside)) {
        return $outside . '/poll.sqlite';
    }
    // Inside the web root: data/.htaccess denies access on Apache, and the unguessable
    // name protects the file on servers that ignore .htaccess (nginx).
    $salt = substr(hash('sha256', __DIR__ . '|' . (string)$cfg['admin_key']), 0, 20);
    return dirname(__DIR__) . '/data/poll-' . $salt . '.sqlite';
}

function poll_db(?string $path = null): PDO
{
    static $pdo = null;
    if ($pdo !== null && $path === null) return $pdo;
    $file = $path ?? poll_db_path();
    $db = new PDO('sqlite:' . $file, null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_TIMEOUT => 15,
    ]);
    $db->exec('PRAGMA busy_timeout = 15000');
    $db->exec('PRAGMA journal_mode = WAL');
    $db->exec('PRAGMA synchronous = NORMAL');
    $db->exec(POLL_SCHEMA);
    if ($path === null) $pdo = $db;
    return $db;
}

function poll_meta(PDO $db, string $k, $default = null)
{
    $st = $db->prepare('SELECT v FROM meta WHERE k = ?');
    $st->execute([$k]);
    $v = $st->fetchColumn();
    return $v === false ? $default : $v;
}

function poll_set_meta(PDO $db, string $k, $v): void
{
    $db->prepare('INSERT INTO meta (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v')
       ->execute([$k, (string)$v]);
}

function now_ms(): int
{
    return (int) floor(microtime(true) * 1000);
}

function client_ip(): string
{
    // Only REMOTE_ADDR: forwarded headers can be faked by the client.
    return (string)($_SERVER['REMOTE_ADDR'] ?? '');
}

function request_admin_key(): string
{
    $h = (string)($_SERVER['HTTP_X_ADMIN_KEY'] ?? '');
    if ($h !== '') return $h;
    $body = json_body();
    return is_string($body['key'] ?? null) ? $body['key'] : '';
}

function is_admin(): bool
{
    $cfg = poll_config();
    $key = (string)$cfg['admin_key'];
    if ($key === '') return false;
    $ips = array_filter(array_map('trim', (array)$cfg['admin_ips']));
    if ($ips && !in_array(client_ip(), $ips, true)) return false;
    $given = request_admin_key();
    return $given !== '' && hash_equals($key, $given);
}

function json_body(): array
{
    static $body = null;
    if ($body !== null) return $body;
    $raw = file_get_contents('php://input') ?: '';
    $j = json_decode($raw, true);
    $body = is_array($j) ? $j : [];
    return $body;
}

function send_json(int $status, array $data): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function require_method(string $method): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== $method) {
        send_json(405, ['error' => $method . ' only']);
    }
}

function run_api(callable $fn): void
{
    try {
        $fn();
    } catch (Throwable $e) {
        error_log('poll api: ' . $e->getMessage());
        send_json(500, ['error' => 'server error', 'message' => 'Server error, please try again']);
    }
}
