<?php
// POST api/reset.php with X-Admin-Key -> moves all votes to votes_archive and starts a new round.
declare(strict_types=1);
require __DIR__ . '/_lib.php';

run_api(function () {
    require_method('POST');
    $db = poll_db();
    $ok = is_admin();
    $db->prepare('INSERT INTO admin_log (ts, action, ip, ok) VALUES (?, ?, ?, ?)')
       ->execute([now_ms(), 'reset', client_ip(), $ok ? 1 : 0]);
    if (!$ok) {
        usleep(500000); // slow down key guessing
        send_json(403, ['error' => 'forbidden']);
    }
    $at = now_ms();
    $db->exec('BEGIN IMMEDIATE');
    try {
        $db->prepare('INSERT INTO votes_archive (reset_at, team, device, name, r, ts)
                      SELECT ?, team, device, name, r, ts FROM votes')->execute([$at]);
        $moved = $db->exec('DELETE FROM votes');
        poll_set_meta($db, 'reset_at', $at);
        $db->exec('COMMIT');
    } catch (Throwable $e) {
        $db->exec('ROLLBACK');
        throw $e;
    }
    send_json(200, ['ok' => true, 'archived' => $moved]);
});
