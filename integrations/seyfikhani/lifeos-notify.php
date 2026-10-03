<?php
// Instant form summary → Melina's Telegram via LifeOS.
// Copy next to lifeos-studio-config.php (cPanel HOME, outside public_html) and in each form handler:
//   require_once dirname($_SERVER['DOCUMENT_ROOT']) . '/lifeos-notify.php';
//   lifeos_notify("📝 درخواست مشاوره\nنام: …\nتلفن: …");
// 1) POST /api/ext/notify — instant.
// 2) If that fails (Telegram not linked, rate limit, Telegram/LifeOS down) → a LifeOS reminder for now
//    (the Worker's 5-minute cron delivers it once Telegram works), so no form is lost.
// 3) If LifeOS is unreachable too → appended to lifeos-notify-failed.log in data_dir.
// Never throws; returns 'sent' | 'reminder' | 'logged'.

function lifeos_notify($text, $cfg = null) {
    $text = trim(str_replace(["\r\n", "\r"], "\n", (string)$text));
    if ($text === '') return 'logged';
    if ($cfg === null) $cfg = @include __DIR__ . '/lifeos-studio-config.php';
    if (!is_array($cfg) || empty($cfg['lifeos_url']) || empty($cfg['lifeos_token'])) return lifeos_notify_log($text, $cfg, 'no-config');
    $call = function ($path, $payload) use ($cfg) {
        $ch = curl_init(rtrim((string)$cfg['lifeos_url'], '/') . $path);
        curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE), CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 12, CURLOPT_CONNECTTIMEOUT => 6, CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1, CURLOPT_ENCODING => '',
            // X-LifeOS-Token: Iranian hosts drop outbound requests with an Authorization header
            CURLOPT_HTTPHEADER => ['X-LifeOS-Token: ' . $cfg['lifeos_token'], 'Content-Type: application/json', 'Accept: application/json']]);
        $b = curl_exec($ch); $st = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE); curl_close($ch);
        return $b === false ? 0 : $st;
    };
    $st = $call('/api/ext/notify', ['text' => mb_substr($text, 0, 3900)]);
    if ($st === 200) return 'sent';
    $now = new DateTime('now', new DateTimeZone('Asia/Tehran'));
    $first = mb_substr(strtok($text, "\n"), 0, 150);
    $st2 = $call('/api/ext/reminders', ['title' => '📩 فرم سایت: ' . $first, 'date' => $now->format('Y-m-d'), 'time' => $now->format('H:i'), 'notes' => mb_substr($text, 0, 2000)]);
    if ($st2 >= 200 && $st2 < 300) return 'reminder';
    return lifeos_notify_log($text, $cfg, 'notify=' . $st . ' reminder=' . $st2);
}

function lifeos_notify_log($text, $cfg, $why) {
    $dir = is_array($cfg) && !empty($cfg['data_dir']) ? $cfg['data_dir'] : __DIR__ . '/lifeos-studio-data';
    if (!is_dir($dir)) @mkdir($dir, 0700, true);
    @file_put_contents($dir . '/lifeos-notify-failed.log', date('c') . ' [' . $why . "]\n" . $text . "\n---\n", FILE_APPEND | LOCK_EX);
    return 'logged';
}
