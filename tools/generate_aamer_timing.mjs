// Generate the aamer.db timing database for the "Ahmed Mohamed Amer" reciter
// (mp3quran read id 203) using the mp3quran ayat_timing API.
// Usage: node tools/generate_aamer_timing.mjs
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const READ_ID = 203;
const EXPECTED_AYAHS = 6236;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DB_PATH = join(ROOT, 'databases', 'audio', 'aamer.db');

const API = (surah) =>
  `https://www.mp3quran.net/api/v3/ayat_timing?surah=${surah}&read=${READ_ID}`;

mkdirSync(dirname(DB_PATH), { recursive: true });

if (existsSync(DB_PATH)) {
  // keep the file, recreate contents below
}

const db = new DatabaseSync(DB_PATH);
db.exec(`
  CREATE TABLE IF NOT EXISTS timings (sura INTEGER, ayah INTEGER, time INTEGER);
  CREATE TABLE IF NOT EXISTS properties (property TEXT, value TEXT);
  CREATE INDEX IF NOT EXISTS idx_timings_sura_ayah ON timings(sura, ayah);
`);
db.exec('DELETE FROM timings; DELETE FROM properties;');
db.exec("INSERT INTO properties (property, value) VALUES ('version', '1'), ('schema_version', '1');");

const insertTiming = db.prepare(
  'INSERT INTO timings (sura, ayah, time) VALUES (?, ?, ?)'
);

let totalAyahs = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

for (let sura = 1; sura <= 114; sura++) {
  const res = await fetch(API(sura));
  if (!res.ok) {
    throw new Error(`surah ${sura}: HTTP ${res.status} ${res.statusText}`);
  }
  const payload = await res.json();
  const timings = Array.isArray(payload) ? payload : (payload.timings ?? []);
  const rows = timings
    .map((t) => ({
      ayah: Number(t.ayah),
      start: Number(t.start_time),
      end: Number(t.end_time),
    }))
    .filter((r) => Number.isFinite(r.ayah) && Number.isFinite(r.start) && r.ayah > 0);

  if (rows.length === 0) {
    throw new Error(`surah ${sura}: no valid timings returned`);
  }

  let previous = -1;
  for (const row of rows) {
    if (row.start < previous) {
      throw new Error(`surah ${sura} ayah ${row.ayah}: timing not ascending (${row.start} < ${previous})`);
    }
    previous = row.start;
    insertTiming.run(sura, row.ayah, row.start);
    totalAyahs++;
  }

  insertTiming.run(sura, 0, 0);
  const suraEnd = rows[rows.length - 1].end;
  insertTiming.run(sura, 999, suraEnd);
  console.log(`surah ${sura}: ${rows.length} ayahs, end=${suraEnd}ms`);
  await sleep(150);
}

db.close();

if (totalAyahs !== EXPECTED_AYAHS) {
  throw new Error(`expected ${EXPECTED_AYAHS} ayahs but got ${totalAyahs}`);
}

console.log(`\nDONE: ${DB_PATH} written with ${totalAyahs} ayahs (+ 114 starts + 114 ends)`);
