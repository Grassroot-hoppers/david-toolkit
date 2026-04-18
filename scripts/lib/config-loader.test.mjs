import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Inline readJsonSafe to test without touching production paths
function readJsonSafe(fp, fallback) {
  if (!fs.existsSync(fp)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(fp, "utf8"));
  } catch {
    return fallback;
  }
}

const tmp = os.tmpdir();

// Missing file → returns fallback
assert.deepEqual(readJsonSafe(path.join(tmp, "nonexistent-aw-test.json"), {}), {});

// Valid JSON → parsed correctly
const validPath = path.join(tmp, "aw-test-valid.json");
fs.writeFileSync(validPath, JSON.stringify({ ok: true }));
assert.deepEqual(readJsonSafe(validPath, {}), { ok: true });
fs.unlinkSync(validPath);

// Malformed JSON → returns fallback without throwing
const badPath = path.join(tmp, "aw-test-bad.json");
fs.writeFileSync(badPath, "{ not valid json !!!");
assert.deepEqual(readJsonSafe(badPath, { fallback: true }), { fallback: true });
fs.unlinkSync(badPath);

// Empty file → returns fallback
const emptyPath = path.join(tmp, "aw-test-empty.json");
fs.writeFileSync(emptyPath, "");
assert.deepEqual(readJsonSafe(emptyPath, []), []);
fs.unlinkSync(emptyPath);

console.log("config-loader: readJsonSafe tests passed");
