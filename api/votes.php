<?php
// GET api/votes.php?device=...  -> this device's votes (everyone)
// GET with X-Admin-Key           -> all votes (admin only)
declare(strict_types=1);
require __DIR__ . '/_lib.php';

run_api(function () {
    require_method('GET');
    $db = poll_db();
    $admin = is_admin();
    $device = substr((string)($_GET['device'] ?? ''), 0, 80);
    if ($admin) {
        $rows = $db->query('SELECT id, team, device, name, r, ts FROM votes ORDER BY id')->fetchAll();
    } elseif ($device !== '') {
        $st = $db->prepare('SELECT id, team, device, name, r, ts FROM votes WHERE device = ? ORDER BY id');
        $st->execute([$device]);
        $rows = $st->fetchAll();
    } else {
        $rows = [];
    }
    $count = (int)$db->query('SELECT COUNT(*) FROM votes')->fetchColumn();
    send_json(200, [
        'votes' => array_map(fn($v) => [
            '_id' => (int)$v['id'],
            'team_id' => $v['team'],
            'r' => $v['r'],
            'device' => $v['device'],
            'name' => $v['name'],
            'ts' => (int)$v['ts'],
        ], $rows),
        'count' => $count,
        'reset_at' => (int)poll_meta($db, 'reset_at', 0),
        'admin' => $admin,
    ]);
});
