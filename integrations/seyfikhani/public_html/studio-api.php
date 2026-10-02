<?php
// Private bridge between seyfikhani.ir/studio.html and LifeOS.
// - Melina signs in here with a site-only password (PBKDF2 hash in the config file).
// - The LifeOS token lives only in the config file OUTSIDE public_html; the browser never sees it.
// - Only an allowlist of /api/ext/* paths is forwarded.
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('X-Robots-Tag: noindex, nofollow');
header('Referrer-Policy: same-origin');

function out(int $status, array $data): void {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

$cfgFile = getenv('LIFEOS_STUDIO_CONFIG') ?: dirname(__DIR__) . '/lifeos-studio-config.php';
if (!is_file($cfgFile)) out(503, ['error' => 'تنظیمات سرور هنوز کامل نشده است.']);
$cfg = require $cfgFile;
foreach (['lifeos_url', 'lifeos_token', 'login_email', 'password_hash'] as $k) {
    if (empty($cfg[$k]) || str_contains((string)$cfg[$k], 'CHANGE_ME')) out(503, ['error' => 'تنظیمات سرور هنوز کامل نشده است.']);
}
$dataDir = $cfg['data_dir'] ?? dirname(__DIR__) . '/lifeos-studio-data';
if (!is_dir($dataDir)) @mkdir($dataDir, 0700, true);

$https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
session_name('studio_sid');
session_set_cookie_params(['lifetime' => 0, 'path' => '/', 'secure' => $https, 'httponly' => true, 'samesite' => 'Strict']);
ini_set('session.use_strict_mode', '1');
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

function signedIn(int $idle, int $abs): bool {
    if (empty($_SESSION['uid'])) return false;
    $now = time();
    if ($now - ($_SESSION['last'] ?? 0) > $idle || $now - ($_SESSION['at'] ?? 0) > $abs) { $_SESSION = []; session_regenerate_id(true); return false; }
    $_SESSION['last'] = $now;
    return true;
}
function needCsrf(): void {
    $h = $_SERVER['HTTP_X_CSRF'] ?? '';
    if (empty($_SESSION['csrf']) || !hash_equals($_SESSION['csrf'], $h)) out(403, ['error' => 'نشست منقضی شده؛ صفحه را دوباره بارگذاری کن.']);
}
function verifyPassword(string $pw, string $stored): bool {
    // format: pbkdf2_sha256$<iterations>$<salt b64>$<hash b64>   (see make-password-hash.js)
    $p = explode('$', $stored);
    if (count($p) !== 4 || $p[0] !== 'pbkdf2_sha256') return false;
    $iter = (int)$p[1]; $salt = base64_decode($p[2], true); $want = base64_decode($p[3], true);
    if ($iter < 100000 || $salt === false || $want === false) return false;
    return hash_equals($want, hash_pbkdf2('sha256', $pw, $salt, $iter, strlen($want), true));
}
// File-based limiter: 5 failed sign-ins per IP per 15 minutes, 20 overall per hour.
function limiter(string $dir, string $ip, bool $record): ?int {
    $f = $dir . '/login-attempts.json';
    $fh = fopen($f, 'c+'); if (!$fh) return null;
    flock($fh, LOCK_EX);
    $all = json_decode(stream_get_contents($fh) ?: '{}', true) ?: [];
    $now = time();
    $all = array_filter($all, fn($x) => $x['t'] > $now - 3600);
    $byIp = array_filter($all, fn($x) => $x['ip'] === hash('sha256', $ip) && $x['t'] > $now - 900);
    $wait = null;
    if (count($byIp) >= 5) $wait = 900 - ($now - min(array_column($byIp, 't')));
    elseif (count($all) >= 20) $wait = 3600 - ($now - min(array_column($all, 't')));
    if ($record) $all[] = ['ip' => hash('sha256', $ip), 't' => $now];
    ftruncate($fh, 0); rewind($fh); fwrite($fh, json_encode(array_values($all)));
    flock($fh, LOCK_UN); fclose($fh);
    return $wait;
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
    $ok = hash_equals(strtolower((string)$cfg['login_email']), $email) & verifyPassword($pw, (string)$cfg['password_hash']);
    if (!$ok) { limiter($dataDir, $ip, true); usleep(400000); out(401, ['error' => 'ایمیل یا رمز درست نیست.']); }
    session_regenerate_id(true);
    $_SESSION['uid'] = 'melina';
    $_SESSION['at'] = $_SESSION['last'] = time();
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

if ($action === 'api') {
    if (!signedIn($IDLE, $ABS)) out(401, ['error' => 'ابتدا وارد شو.']);
    if ($method !== 'GET') needCsrf();
    $path = (string)($_GET['p'] ?? '');
    $ID = '[A-Za-z0-9_-]{1,64}';
    $allowed = [
        "#^/api/ext/me$#" => ['GET'],
        "#^/api/ext/col/(projects|cards|projectProcesses|courses|students)$#" => ['GET', 'POST'],
        "#^/api/ext/col/(projects|cards|projectProcesses|courses|students)/$ID$#" => ['GET', 'PATCH', 'DELETE'],
        "#^/api/ext/students/$ID/payments$#" => ['POST'],
        "#^/api/ext/students/$ID/payments/$ID$#" => ['PATCH', 'DELETE'],
        "#^/api/ext/reminders$#" => ['GET', 'POST'],
        "#^/api/ext/reminders/$ID$#" => ['PATCH', 'DELETE'],
    ];
    $okPath = false;
    foreach ($allowed as $re => $methods) if (preg_match($re, $path) && in_array($method, $methods, true)) { $okPath = true; break; }
    if (!$okPath) out(403, ['error' => 'این درخواست مجاز نیست.']);
    $payload = null;
    if ($method !== 'GET' && $method !== 'DELETE') {
        $payload = file_get_contents('php://input') ?: '{}';
        if (strlen($payload) > 65536) out(413, ['error' => 'داده بیش از حد بزرگ است.']);
        if (!is_array(json_decode($payload, true))) out(400, ['error' => 'دادهٔ نامعتبر.']);
    }
    $ch = curl_init(rtrim((string)$cfg['lifeos_url'], '/') . $path);
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 20,
        CURLOPT_CONNECTTIMEOUT => 8,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_PROTOCOLS => CURLPROTO_HTTPS | (!empty($cfg['allow_http']) ? CURLPROTO_HTTP : 0),
        CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $cfg['lifeos_token'], 'Content-Type: application/json', 'Accept: application/json'],
    ]);
    if ($payload !== null) curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
    $body = curl_exec($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    if ($body === false || $status === 0) out(502, ['error' => 'اتصال به LifeOS برقرار نشد.']);
    if ($status === 401) out(502, ['error' => 'توکن LifeOS نامعتبر یا لغو شده است؛ در تنظیمات LifeOS توکن تازه بساز.']);
    http_response_code($status);
    echo $body;
    exit;
}

out(404, ['error' => 'مسیر نامعتبر.']);
