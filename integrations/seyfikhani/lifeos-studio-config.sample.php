<?php
// Copy to the cPanel HOME folder (one level ABOVE public_html) as:
//   lifeos-studio-config.php      e.g. /home/<cpanel-user>/lifeos-studio-config.php
// Never put the real file inside public_html and never commit it.
return [
    // LifeOS Worker base URL (no trailing slash)
    'lifeos_url'    => 'https://pdmaz.hamidreza-mazlaghani.workers.dev',
    // From LifeOS (signed in as Melina) → Settings → «اتصال سایت شخصی» → ساخت توکن. Starts with lfs_
    'lifeos_token'  => 'CHANGE_ME',
    // The only account that may sign in to studio.html
    'login_email'   => 'm.seyfikhani@gmail.com',
    // Output of:  node make-password-hash.js   (site-only password, not her LifeOS/Gmail password)
    'password_hash' => 'CHANGE_ME',
    // Login-attempt log; must be outside public_html and writable by PHP
    // 'data_dir'   => __DIR__ . '/lifeos-studio-data',
];
