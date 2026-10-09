<?php
// Private bridge between seyfikhani.ir/studio.html and LifeOS.
// - Melina signs in here with a site-only password (PBKDF2 hash in the config file).
// - The LifeOS token lives only in the config file OUTSIDE public_html; the browser never sees it.
// - Only an allowlist of /api/ext/* paths is forwarded.
// Works on PHP 7.0+ (cPanel hosts often default to an older PHP).
// A fatal error is reported as JSON (no file paths) instead of a bare HTTP 500.
register_shutdown_function(function () {
    $e = error_get_last();
    if (!$e || !in_array($e['type'], [E_ERROR, E_PARSE, E_COMPILE_ERROR, E_CORE_ERROR], true)) return;
    if (!headers_sent()) { http_response_code(500); header('Content-Type: application/json; charset=utf-8'); }
    $file = basename((string)$e['file']);
    echo json_encode(['error' => 'خطای PHP در ' . $file . ' (خط ' . $e['line'] . '، PHP ' . PHP_VERSION . '): ' . preg_replace('#/[^\s:]+/#', '', (string)$e['message'])], JSON_UNESCAPED_UNICODE);
});

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('X-Robots-Tag: noindex, nofollow');
header('Referrer-Policy: same-origin');

function out($status, $data) {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

$cfgFile = getenv('LIFEOS_STUDIO_CONFIG') ?: '';
if ($cfgFile === '') {
    // home folder = one level above public_html; on some hosts DOCUMENT_ROOT or HOME points there more reliably
    $home = getenv('HOME') ?: '';
    $docRoot = rtrim((string)($_SERVER['DOCUMENT_ROOT'] ?? ''), '/');
    foreach (array_unique(array_filter([dirname(__DIR__), $docRoot !== '' ? dirname($docRoot) : '', $home])) as $dir) {
        if (is_file($dir . '/lifeos-studio-config.php')) { $cfgFile = $dir . '/lifeos-studio-config.php'; break; }
    }
}
if ($cfgFile === '' || !is_file($cfgFile)) {
    // never serve secrets from the web root: if it was uploaded there, refuse and say so
    if (is_file(__DIR__ . '/lifeos-studio-config.php')) out(503, ['error' => 'فایل تنظیمات داخل public_html است؛ آن را یک پوشه بالاتر (کنار public_html) ببر.']);
    $names = array_values(array_filter(scandir(dirname(__DIR__)) ?: [], function ($n) { return stripos($n, 'lifeos') !== false; }));
    out(503, ['error' => 'فایل lifeos-studio-config.php کنار پوشهٔ public_html پیدا نشد.' . ($names ? ' فایل‌های مشابه آنجا: ' . implode('، ', $names) : '')]);
}
try { $cfg = require $cfgFile; }
catch (\Throwable $e) { out(503, ['error' => 'فایل lifeos-studio-config.php غلط تایپی دارد (خط ' . $e->getLine() . '). علامت‌های \' و , را چک کن.']); }
if (!is_array($cfg)) out(503, ['error' => 'فایل lifeos-studio-config.php خراب است (باید با return [ شروع شود).']);
// Values pasted in cPanel's editor often carry a trailing newline or invisible RTL marks;
// a stray newline inside the Authorization header makes the request hang, so strip them.
foreach (['lifeos_url', 'lifeos_token', 'login_email', 'password_hash'] as $k) {
    if (isset($cfg[$k])) $cfg[$k] = preg_replace('/[\s\x{200B}-\x{200F}\x{202A}-\x{202E}\x{2066}-\x{2069}\x{FEFF}]+/u', '', (string)$cfg[$k]);
}
foreach (['lifeos_url', 'lifeos_token', 'login_email', 'password_hash'] as $k) {
    if (empty($cfg[$k]) || strpos((string)$cfg[$k], 'CHANGE_ME') !== false) out(503, ['error' => "در lifeos-studio-config.php مقدار «{$k}» هنوز پر نشده است."]);
}
if (!preg_match('/\Alfs_[0-9a-f]{64}\z/', (string)$cfg['lifeos_token'])) out(503, ['error' => 'توکن در lifeos-studio-config.php کامل نیست (باید lfs_ و ۶۴ حرف باشد، بدون فاصله).']);
$dataDir = $cfg['data_dir'] ?? dirname(__DIR__) . '/lifeos-studio-data';
if (!is_dir($dataDir)) @mkdir($dataDir, 0700, true);

$https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
session_name('studio_sid');
if (PHP_VERSION_ID >= 70300) session_set_cookie_params(['lifetime' => 0, 'path' => '/', 'secure' => $https, 'httponly' => true, 'samesite' => 'Strict']);
else session_set_cookie_params(0, '/; samesite=Strict', '', $https, true);
ini_set('session.use_strict_mode', '1');
// Sessions live in our own folder with a long lifetime: on shared hosting the default /tmp store is cleaned
// after ~24 min (often by other sites' settings), which silently expired the CSRF token mid-session and made
// saves fail with «نشست منقضی شده».
$sessDir = $dataDir . '/sessions';
if (!is_dir($sessDir)) @mkdir($sessDir, 0700, true);
if (is_dir($sessDir) && is_writable($sessDir)) session_save_path($sessDir);
ini_set('session.gc_maxlifetime', '43200');
session_start();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = $_GET['a'] ?? '';
$IDLE = 2 * 3600;     // sign out after 2h without activity
$ABS = 12 * 3600;     // and after 12h in any case

// Cross-site writes are refused: same Origin (when sent) + per-session CSRF token.
if ($method !== 'GET') {
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    $o = parse_url($origin);
    $originHost = strtolower(($o['host'] ?? '') . (isset($o['port']) ? ':' . $o['port'] : ''));
    if ($origin !== '' && $originHost !== strtolower($_SERVER['HTTP_HOST'] ?? '')) out(403, ['error' => 'درخواست از مبدأ نامعتبر.']);
}

function signedIn($idle, $abs) {
    if (empty($_SESSION['uid'])) return false;
    $now = time();
    if ($now - ($_SESSION['last'] ?? 0) > $idle || $now - ($_SESSION['at'] ?? 0) > $abs) { $_SESSION = []; session_regenerate_id(true); return false; }
    $_SESSION['last'] = $now;
    return true;
}
function needCsrf() {
    $h = $_SERVER['HTTP_X_CSRF'] ?? '';
    if (empty($_SESSION['csrf']) || !hash_equals($_SESSION['csrf'], $h)) out(403, ['error' => 'نشست منقضی شده؛ صفحه را دوباره بارگذاری کن.']);
}
function verifyPassword($pw, $stored) {
    // format: pbkdf2_sha256$<iterations>$<salt b64>$<hash b64>   (see make-password-hash.js)
    $p = explode('$', $stored);
    if (count($p) !== 4 || $p[0] !== 'pbkdf2_sha256') return false;
    $iter = (int)$p[1]; $salt = base64_decode($p[2], true); $want = base64_decode($p[3], true);
    if ($iter < 100000 || $salt === false || $want === false) return false;
    return hash_equals($want, hash_pbkdf2('sha256', $pw, $salt, $iter, strlen($want), true));
}
// File-based limiter: 5 failed sign-ins per IP per 15 minutes, 20 overall per hour.
function limiter($dir, $ip, $record) {
    $f = $dir . '/login-attempts.json';
    $fh = fopen($f, 'c+'); if (!$fh) return null;
    flock($fh, LOCK_EX);
    $all = json_decode(stream_get_contents($fh) ?: '{}', true) ?: [];
    $now = time();
    $all = array_filter($all, function ($x) use ($now) { return $x['t'] > $now - 3600; });
    $ipHash = hash('sha256', $ip);
    $byIp = array_filter($all, function ($x) use ($now, $ipHash) { return $x['ip'] === $ipHash && $x['t'] > $now - 900; });
    $wait = null;
    if (count($byIp) >= 5) $wait = 900 - ($now - min(array_column($byIp, 't')));
    elseif (count($all) >= 20) $wait = 3600 - ($now - min(array_column($all, 't')));
    if ($record) $all[] = ['ip' => hash('sha256', $ip), 't' => $now];
    ftruncate($fh, 0); rewind($fh); fwrite($fh, json_encode(array_values($all)));
    flock($fh, LOCK_UN); fclose($fh);
    return $wait;
}

// A password Melina set herself (panel → «تغییر رمز») overrides the config hash.
// Forgot it? Delete lifeos-studio-data/password-hash.txt and the config password works again.
$pwFile = $dataDir . '/password-hash.txt';
function currentHash($cfg, $pwFile) {
    $h = is_file($pwFile) ? trim((string)@file_get_contents($pwFile)) : '';
    return $h !== '' ? $h : (string)$cfg['password_hash'];
}
function makeHash($pw) {
    $salt = random_bytes(16); $iter = 310000;
    return 'pbkdf2_sha256$' . $iter . '$' . base64_encode($salt) . '$' . base64_encode(hash_pbkdf2('sha256', $pw, $salt, $iter, 32, true));
}

if ($action === 'state') {
    $in = signedIn($IDLE, $ABS);
    if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(32));
    out(200, ['signedIn' => $in, 'csrf' => $_SESSION['csrf']]);
}

if ($action === 'login' && $method === 'POST') {
    needCsrf();
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'ip';
    if (($w = limiter($dataDir, $ip, false)) !== null) out(429, ['error' => 'تلاش زیاد. ' . max(1, (int)ceil($w / 60)) . ' دقیقه دیگر دوباره امتحان کن.']);
    $d = json_decode(file_get_contents('php://input') ?: '{}', true) ?: [];
    $email = strtolower(trim((string)($d['email'] ?? '')));
    $pw = (string)($d['password'] ?? '');
    $ok = hash_equals(strtolower((string)$cfg['login_email']), $email) & verifyPassword($pw, currentHash($cfg, $pwFile));
    if (!$ok) { limiter($dataDir, $ip, true); usleep(400000); out(401, ['error' => 'ایمیل یا رمز درست نیست.']); }
    session_regenerate_id(true);
    $_SESSION['uid'] = 'melina';
    $_SESSION['at'] = $_SESSION['last'] = time();
    $_SESSION['csrf'] = bin2hex(random_bytes(32));
    out(200, ['ok' => true, 'csrf' => $_SESSION['csrf']]);
}

if ($action === 'password' && $method === 'POST') {
    needCsrf();
    if (!signedIn($IDLE, $ABS)) out(401, ['error' => 'ابتدا وارد شو.']);
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'ip';
    if (($w = limiter($dataDir, $ip, false)) !== null) out(429, ['error' => 'تلاش زیاد. ' . max(1, (int)ceil($w / 60)) . ' دقیقه دیگر دوباره امتحان کن.']);
    $d = json_decode(file_get_contents('php://input') ?: '{}', true) ?: [];
    $cur = (string)($d['current'] ?? ''); $next = (string)($d['next'] ?? '');
    if (!verifyPassword($cur, currentHash($cfg, $pwFile))) { limiter($dataDir, $ip, true); usleep(400000); out(400, ['error' => 'رمز فعلی درست نیست.']); }
    if (strlen($next) < 10) out(400, ['error' => 'رمز تازه باید حداقل ۱۰ کاراکتر باشد.']);
    if ($next === $cur) out(400, ['error' => 'رمز تازه با رمز فعلی یکی است.']);
    if (!is_dir($dataDir) || !is_writable($dataDir)) out(500, ['error' => 'پوشهٔ lifeos-studio-data قابل نوشتن نیست؛ در cPanel دسترسی آن را 700 بگذار.']);
    $tmp = $pwFile . '.' . bin2hex(random_bytes(4));
    if (@file_put_contents($tmp, makeHash($next)) === false || !@rename($tmp, $pwFile)) { @unlink($tmp); out(500, ['error' => 'ذخیرهٔ رمز ناموفق بود.']); }
    @chmod($pwFile, 0600);
    session_regenerate_id(true);
    $_SESSION['csrf'] = bin2hex(random_bytes(32));
    out(200, ['ok' => true, 'csrf' => $_SESSION['csrf']]);
}

if ($action === 'logout' && $method === 'POST') {
    needCsrf();
    $_SESSION = [];
    session_regenerate_id(true);
    $_SESSION['csrf'] = bin2hex(random_bytes(32));
    out(200, ['ok' => true, 'csrf' => $_SESSION['csrf']]);
}

// Connectivity check from the host (signed-in only): is LifeOS blocked, or Cloudflare as a whole?
if ($action === 'diag') {
    if (!signedIn($IDLE, $ABS)) out(401, ['error' => 'ابتدا وارد شو.']);
    session_write_close();
    $base = rtrim((string)$cfg['lifeos_url'], '/');
    if (!empty($_GET['lists'])) {
        // time every list the panel loads, with the real token
        $out = [];
        foreach (['me', 'col/projects', 'col/cards', 'col/projectProcesses', 'col/projectContracts', 'col/projectFinancials', 'col/projectSupplies', 'col/courses', 'col/students', 'reminders'] as $p) {
            $ch = curl_init($base . '/api/ext/' . $p);
            curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 8, CURLOPT_CONNECTTIMEOUT => 6, CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1, CURLOPT_ENCODING => '', CURLOPT_HTTPHEADER => ['X-LifeOS-Token: ' . $cfg['lifeos_token'], 'Accept: application/json']]);
            $b = curl_exec($ch);
            $out[] = ['path' => $p, 'status' => (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE), 'bytes' => is_string($b) ? strlen($b) : 0, 'ms' => (int)(curl_getinfo($ch, CURLINFO_TOTAL_TIME) * 1000), 'error' => curl_errno($ch) ? curl_errno($ch) . ' ' . curl_error($ch) : ''];
            curl_close($ch);
        }
        out(200, ['lists' => $out]);
    }
    $targets = ['LifeOS (بدون توکن)' => rtrim((string)$cfg['lifeos_url'], '/') . '/api/ext/me', 'LifeOS (با توکن)' => rtrim((string)$cfg['lifeos_url'], '/') . '/api/ext/me', 'Cloudflare (www.cloudflare.com)' => 'https://www.cloudflare.com/cdn-cgi/trace', 'Google' => 'https://www.google.com/generate_204'];
    if (!empty($_GET['u']) && preg_match('#^https://[a-z0-9.-]+$#i', (string)$_GET['u'])) $targets['آدرس آزمایشی'] = $_GET['u'] . '/cdn-cgi/trace';
    // optional second token (e.g. a throwaway test account) to tell host-network problems from account-data problems
    $altToken = (isset($_GET['t']) && preg_match('/\Alfs_[0-9a-f]{64}\z/', (string)$_GET['t'])) ? (string)$_GET['t'] : '';
    if ($altToken !== '') $targets['LifeOS (توکن آزمایشی)'] = rtrim((string)$cfg['lifeos_url'], '/') . '/api/ext/me';
    // header probe with a fake token: if only the Authorization variant hangs, the host filters that header
    $fake = 'lfs_' . str_repeat('0', 64);
    $targets['هدر Authorization (توکن ساختگی)'] = rtrim((string)$cfg['lifeos_url'], '/') . '/api/ext/me';
    $targets['هدر X-LifeOS-Token (توکن ساختگی)'] = rtrim((string)$cfg['lifeos_url'], '/') . '/api/ext/me';
    @set_time_limit(90);
    // test token first so a hanging main token cannot hide its result behind the host's time limit
    $first = [];
    foreach (['هدر X-LifeOS-Token (توکن ساختگی)', 'هدر Authorization (توکن ساختگی)', 'LifeOS (توکن آزمایشی)'] as $k) if (isset($targets[$k])) $first[$k] = $targets[$k];
    $targets = $first + $targets;
    $res = [];
    foreach ($targets as $name => $url) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10, CURLOPT_CONNECTTIMEOUT => 6]);
        if ($name === 'LifeOS (با توکن)') curl_setopt($ch, CURLOPT_HTTPHEADER, ['X-LifeOS-Token: ' . $cfg['lifeos_token'], 'Accept: application/json']);
        if ($name === 'هدر Authorization (توکن ساختگی)') curl_setopt($ch, CURLOPT_HTTPHEADER, ['Authorization: Bearer ' . $fake, 'Accept: application/json']);
        if ($name === 'هدر X-LifeOS-Token (توکن ساختگی)') curl_setopt($ch, CURLOPT_HTTPHEADER, ['X-LifeOS-Token: ' . $fake, 'Accept: application/json']);
        if ($name === 'LifeOS (توکن آزمایشی)') curl_setopt($ch, CURLOPT_HTTPHEADER, ['X-LifeOS-Token: ' . $altToken, 'Accept: application/json']);
        $b = curl_exec($ch);
        $res[] = ['name' => $name, 'status' => (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE), 'error' => curl_errno($ch) ? curl_errno($ch) . ' ' . curl_error($ch) : '', 'ms' => (int)(curl_getinfo($ch, CURLINFO_TOTAL_TIME) * 1000), 'body' => strpos($url, '/api/ext/') !== false && is_string($b) ? (function_exists('mb_substr') ? mb_substr($b, 0, 160) : preg_replace('/[^\x20-\x7e]/', '', substr($b, 0, 160))) : ''];
        curl_close($ch);
    }
    out(200, ['results' => $res]);
}

if ($action === 'api') {
    if (!signedIn($IDLE, $ABS)) out(401, ['error' => 'ابتدا وارد شو.']);
    if ($method !== 'GET') needCsrf();
    session_write_close();   // release the session lock: the panel fires several requests in parallel
    $path = (string)($_GET['p'] ?? '');
    $ID = '[A-Za-z0-9_-]{1,64}';
    $allowed = [
        "#^/api/ext/me$#" => ['GET'],
        "#^/api/ext/report-brand$#" => ['GET', 'PATCH'],
        "#^/api/ext/col/(projects|cards|projectProcesses|projectContracts|projectFinancials|projectSupplies|courses|students)$#" => ['GET', 'POST'],
        "#^/api/ext/col/(projects|cards|projectProcesses|projectContracts|projectFinancials|projectSupplies|courses|students)/$ID$#" => ['GET', 'PATCH', 'DELETE'],
        "#^/api/ext/students/$ID/payments$#" => ['POST'],
        "#^/api/ext/students/$ID/payments/$ID$#" => ['PATCH', 'DELETE'],
        "#^/api/ext/transactions$#" => ['POST'],
        "#^/api/ext/transactions/$ID$#" => ['PATCH', 'DELETE'],
        "#^/api/ext/reminders$#" => ['GET', 'POST'],
        "#^/api/ext/reminders/$ID$#" => ['PATCH', 'DELETE'],
    ];
    // project report PDF → Telegram: the browser sends the whole file here; LifeOS gets it in ~45 KB pieces
    if ($path === '/api/ext/report-pdf' && $method === 'POST') {
        @set_time_limit(180);
        $d = json_decode(file_get_contents('php://input') ?: '{}', true) ?: [];
        if (!preg_match('#^data:application/pdf;base64,([A-Za-z0-9+/=]+)$#', (string)($d['data'] ?? ''), $m)) out(400, ['error' => 'فایل PDF معتبر نیست.']);
        $b64 = $m[1];
        if (strlen($b64) > 28000000) out(413, ['error' => 'حجم PDF بیش از ۲۰ مگابایت است.']);
        $pieces = str_split($b64, 45000); $up = bin2hex(random_bytes(8)); $total = count($pieces);
        $post = function ($p, $payload) use ($cfg) {
            for ($try = 0; $try < 3; $try++) {
                $ch = curl_init(rtrim((string)$cfg['lifeos_url'], '/') . $p);
                curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE), CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 30, CURLOPT_CONNECTTIMEOUT => 8, CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1, CURLOPT_ENCODING => '',
                    CURLOPT_HTTPHEADER => ['X-LifeOS-Token: ' . $cfg['lifeos_token'], 'Content-Type: application/json', 'Accept: application/json']]);
                $b = curl_exec($ch); $st = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE); curl_close($ch);
                if ($b !== false && $st !== 0) return [$st, $b];
            }
            out(502, ['error' => 'ارسال گزارش به LifeOS قطع شد؛ دوباره امتحان کن.']);
        };
        foreach ($pieces as $n => $piece) { list($st, $b) = $post('/api/ext/report-chunk', ['uploadId' => $up, 'n' => $n, 'total' => $total, 'data' => $piece]); if ($st !== 200) { http_response_code($st); echo $b; exit; } }
        list($st, $b) = $post('/api/ext/report-send', ['uploadId' => $up, 'total' => $total, 'filename' => (string)($d['filename'] ?? 'report.pdf'), 'caption' => (string)($d['caption'] ?? '')]);
        http_response_code($st); echo $b; exit;
    }
    $okPath = false;
    foreach ($allowed as $re => $methods) if (preg_match($re, $path) && in_array($method, $methods, true)) { $okPath = true; break; }
    if (!$okPath) out(403, ['error' => 'این درخواست مجاز نیست.']);
    $payload = null;
    if ($method !== 'GET' && $method !== 'DELETE') {
        $payload = file_get_contents('php://input') ?: '{}';
        if (strlen($payload) > 65536) out(413, ['error' => 'داده بیش از حد بزرگ است.']);
        if (!is_array(json_decode($payload, true))) out(400, ['error' => 'دادهٔ نامعتبر.']);
    }
    // Long lists are pulled in pages: this host's network cuts replies after ~64 KB.
    if ($method === 'GET' && preg_match('#^/api/ext/(col/[A-Za-z]+|reminders)$#', $path)) {
        // ~1000+ checklist rows: 25 per call took 40+ s and the host stopped the script midway (empty progress).
        // Pages of 150 (~45 KB raw, gzip on the wire); a page that comes back cut is retried at 25.
        @set_time_limit(120);
        $items = []; $per = 150; $off = 0;
        while (true) {
            $ch = curl_init(rtrim((string)$cfg['lifeos_url'], '/') . $path . '?offset=' . $off . '&limit=' . $per);
            curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 20, CURLOPT_CONNECTTIMEOUT => 8, CURLOPT_FOLLOWLOCATION => false, CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1, CURLOPT_ENCODING => '',
                CURLOPT_HTTPHEADER => ['X-LifeOS-Token: ' . $cfg['lifeos_token'], 'Accept: application/json']]);
            $b = curl_exec($ch); $st = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE); $en = curl_errno($ch); $er = curl_error($ch); curl_close($ch);
            if ($b === false || $st === 0) out(502, ['error' => 'اتصال به LifeOS برقرار نشد — کد ' . $en . ($er ? ' (' . $er . ')' : '')]);
            if ($st === 401) out(502, ['error' => 'توکن LifeOS نامعتبر یا لغو شده است؛ در تنظیمات LifeOS توکن تازه بساز.']);
            $d = json_decode($b, true);
            if ($st === 200 && !is_array($d) && $per > 25) { $per = 25; continue; }
            if ($st !== 200 || !is_array($d)) { http_response_code($st ?: 502); echo $b; exit; }
            $items = array_merge($items, $d['items'] ?? []);
            if (!isset($d['total']) || count($items) >= (int)$d['total'] || empty($d['items']) || $off > 20000) break;   // old Worker without paging returns everything at once
            $off += $per;
        }
        out(200, ['items' => $items]);
    }
    $ch = curl_init(rtrim((string)$cfg['lifeos_url'], '/') . $path);
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 20,
        CURLOPT_CONNECTTIMEOUT => 8,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_PROTOCOLS => CURLPROTO_HTTPS | (!empty($cfg['allow_http']) ? CURLPROTO_HTTP : 0),
        CURLOPT_HTTPHEADER => ['X-LifeOS-Token: ' . $cfg['lifeos_token'], 'Content-Type: application/json', 'Accept: application/json'],
        CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1, CURLOPT_ENCODING => '',
    ]);
    if ($payload !== null) curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
    $body = curl_exec($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $errNo = curl_errno($ch); $err = curl_error($ch);
    curl_close($ch);
    if ($body === false || $status === 0) {
        // the host's own network decides this; name the cause so it can be fixed (DNS, filtering, TLS, timeout)
        $why = [6 => 'هاست آدرس LifeOS را پیدا نمی‌کند (DNS)', 7 => 'هاست به سرور LifeOS وصل نمی‌شود (احتمالاً فیلتر/فایروال)', 28 => 'زمان اتصال تمام شد (احتمالاً فیلتر)', 35 => 'خطای SSL/TLS (احتمالاً فیلتر روی SNI)', 56 => 'اتصال وسط کار قطع شد (احتمالاً فیلتر)', 60 => 'گواهی SSL قابل تأیید نیست'][$errNo] ?? 'خطای شبکه';
        out(502, ['error' => 'اتصال به LifeOS برقرار نشد: ' . $why . ' — کد ' . $errNo . ($err ? ' (' . $err . ')' : '')]);
    }
    if ($status === 401) out(502, ['error' => 'توکن LifeOS نامعتبر یا لغو شده است؛ در تنظیمات LifeOS توکن تازه بساز.']);
    http_response_code($status);
    echo $body;
    exit;
}

out(404, ['error' => 'مسیر نامعتبر.']);
