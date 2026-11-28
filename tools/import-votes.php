<?php
// One-time import of the old rentry votes into SQLite. Run from the command line:
//   php tools/import-votes.php votes-export.txt [path/to/poll.sqlite]
// Input: either the rentry JSON ({"votes":[...]}) or lines "team|device|ts|name|r"
// (an optional first line "#reset_at=<ms>" keeps the round start time).
// Votes that already exist (same device + team) are skipped, so it is safe to re-run.
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require __DIR__ . '/../api/_lib.php';

[$self, $src, $dbPath] = $argv + [null, null, null];
if (!$src || !is_file($src)) {
    fwrite(STDERR, "usage: php tools/import-votes.php <export file> [db path]\n");
    exit(1);
}
$text = file_get_contents($src);
$rows = [];
$meta = [];
$json = json_decode($text, true);
if (is_array($json) && isset($json['votes'])) {
    foreach ($json['votes'] as $v) {
        $rows[] = [$v['t'] ?? $v['team_id'], $v['d'] ?? $v['device'], (int)$v['ts'], (string)($v['n'] ?? $v['name'] ?? ''), $v['r']];
    }
    $meta = $json['meta'] ?? [];
} else {
    foreach (preg_split('/\R/', trim($text)) as $line) {
        if (preg_match('/^#reset_at=(\d+)$/', $line, $m)) { $meta['reset_at'] = (int)$m[1]; continue; }
        $p = explode('|', $line, 5);
        if (count($p) !== 5) { fwrite(STDERR, "bad line: $line\n"); exit(1); }
        $rows[] = [$p[0], $p[1], (int)$p[2], $p[3], $p[4]];
    }
}

$db = poll_db($dbPath ?: poll_db_path());
$db->exec('BEGIN IMMEDIATE');
$st = $db->prepare('INSERT OR IGNORE INTO votes (team, device, name, r, ts) VALUES (?, ?, ?, ?, ?)');
$added = 0;
foreach ($rows as [$team, $device, $ts, $name, $r]) {
    $st->execute([$team, $device, $name, $r, $ts]);
    $added += $st->rowCount();
}
if (!empty($meta['reset_at']) && poll_meta($db, 'reset_at') === null) {
    poll_set_meta($db, 'reset_at', (int)$meta['reset_at']);
}
$db->exec('COMMIT');
$total = (int)$db->query('SELECT COUNT(*) FROM votes')->fetchColumn();
echo "read " . count($rows) . ", added $added, total in db $total\n";
