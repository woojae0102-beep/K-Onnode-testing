// @ts-nocheck
const fs = require('node:fs');
const path = require('node:path');

const src = path.join(process.cwd(), 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
const dest = path.join(process.cwd(), 'public', 'mediapipe', 'wasm');

if (!fs.existsSync(src)) {
  console.warn('[copy-mediapipe-wasm] @mediapipe/tasks-vision wasm not found — run npm install first');
  process.exit(0);
}

fs.mkdirSync(dest, { recursive: true });
for (const name of fs.readdirSync(src)) {
  const from = path.join(src, name);
  const to = path.join(dest, name);
  if (fs.statSync(from).isDirectory()) {
    fs.cpSync(from, to, { recursive: true, force: true });
  } else {
    fs.copyFileSync(from, to);
  }
}

console.log('[copy-mediapipe-wasm] copied to public/mediapipe/wasm');
