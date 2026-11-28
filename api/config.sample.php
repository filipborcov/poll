<?php
// Copy this file to api/config.php ON THE HOSTING and fill it in.
// api/config.php is in .gitignore and closed to the web: never commit it.
return [
    // Long random admin key. The admin page is: https://your-site/#/admin?key=THIS_KEY
    'admin_key' => '',
    // Optional: admin works only from these IPs. Empty array = from anywhere (key still needed).
    'admin_ips' => [],
    // Optional: full path to the SQLite file. Empty = poll-data/poll.sqlite next to the site folder
    // (outside the web root), or data/poll.sqlite if that folder can't be created.
    'db_path'   => '',
];
