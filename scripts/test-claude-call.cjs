// Claude API 직접 호출 디버그
const path = require('path');
const fs = require('fs');

function loadEnv() {
  const envPath = path.resolve(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, 'utf8');
  text.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const idx = trimmed.indexOf('=');
    if (idx <= 0) return;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim();
    if (process.env[key] === undefined) process.env[key] = val;
  });
}
loadEnv();

console.log('Node:', process.version);
console.log('fetch:', typeof fetch);
console.log('ANTHROPIC_API_KEY set:', !!process.env.ANTHROPIC_API_KEY, '(len:', (process.env.ANTHROPIC_API_KEY || '').length, ')');
console.log('ANTHROPIC_MODEL:', process.env.ANTHROPIC_MODEL);

(async () => {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-20241022',
        max_tokens: 60,
        messages: [{ role: 'user', content: 'Say hi in Korean as JSON: {"hi":"..."}' }],
      }),
    });
    console.log('status:', response.status);
    const text = await response.text();
    console.log('body  :', text.slice(0, 500));
  } catch (err) {
    console.error('error:', err);
  }
})();
