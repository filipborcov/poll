<?php
// POST api/vote.php {team_id, r, device, name}
declare(strict_types=1);
require __DIR__ . '/_lib.php';

const POLL_TEAMS = ['speed', 'comm', 'nobug', 'amount', 'punct', 'ai'];

run_api(function () {
    require_method('POST');
    $b = json_body();
    $team = (string)($b['team_id'] ?? '');
    $r = (string)($b['r'] ?? '');
    $device = substr((string)($b['device'] ?? ''), 0, 80);
    $name = substr((string)($b['name'] ?? ''), 0, 80);
    if (!in_array($team, POLL_TEAMS, true) || $device === '') {
        send_json(400, ['error' => 'need team_id and device']);
    }
    // Board ballot: "v2:" + "index=score" pairs, index 0..99, score 0..100.
    if (strlen($r) > 2000 || !preg_match('/^v2:\d{1,2}=\d{1,3}(,\d{1,2}=\d{1,3})*$/', $r)) {
        send_json(400, ['error' => 'bad ranking']);
    }
    $db = poll_db();
    $st = $db->prepare('INSERT OR IGNORE INTO votes (team, device, name, r, ts) VALUES (?, ?, ?, ?, ?)');
    $st->execute([$team, $device, $name, $r, now_ms()]);
    if ($st->rowCount() === 0) {
        send_json(409, ['error' => 'already', 'message' => 'Already voted from this device']);
    }
    $total = (int)$db->query('SELECT COUNT(*) FROM votes')->fetchColumn();
    send_json(200, ['ok' => true, 'total' => $total]);
});
