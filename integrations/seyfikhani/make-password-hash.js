#!/usr/bin/env node
// Creates the password_hash for lifeos-studio-config.php (PBKDF2-SHA256, verified by studio-api.php).
// Usage:  node make-password-hash.js        → asks for the password (not echoed)
const crypto = require('crypto');
const readline = require('readline');

function hash(pw) {
  const salt = crypto.randomBytes(16), iter = 310000;
  const dk = crypto.pbkdf2Sync(pw, salt, iter, 32, 'sha256');
  return `pbkdf2_sha256$${iter}$${salt.toString('base64')}$${dk.toString('base64')}`;
}

if (process.argv[2] === '--stdin') {
  let s = ''; process.stdin.on('data', d => { s += d; }).on('end', () => console.log(hash(s.replace(/\r?\n$/, ''))));
} else {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  rl._writeToOutput = s => { if (/رمز|password/i.test(s)) rl.output.write(s); };
  rl.question('رمز ورود سایت (حداقل ۱۰ کاراکتر) / password: ', pw => {
    rl.close(); process.stdout.write('\n');
    if (pw.length < 10) { console.error('رمز کوتاه است (حداقل ۱۰ کاراکتر).'); process.exit(1); }
    console.log(hash(pw));
  });
}
