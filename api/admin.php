<?php
// GET api/admin.php with X-Admin-Key -> {ok: true} if the key (and IP, when configured) match.
declare(strict_types=1);
require __DIR__ . '/_lib.php';

run_api(function () {
    send_json(200, ['ok' => is_admin()]);
});
