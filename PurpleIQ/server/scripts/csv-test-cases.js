/**
 * CSV → Test Cases (bulk)
 *
 * Reads a Jira CSV export, extracts required columns (Summary, Issue key, Project key,
 * Project description, Description), and for each row calls PurpleIQ
 * POST /api/test-cases/from-story to generate JSON test cases. Writes one JSON file per story.
 *
 * Usage:
 *   cd PurpleIQ/server
 *   npm run csv-test-cases
 *
 * Environment (or .env):
 *   CSV_PATH           Path to Jira CSV file (default: ../../Jira (1).csv from server/)
 *   OUTPUT_DIR         Directory for JSON output (default: ./output/test-cases)
 *   PURPLEIQ_API_URL   API base URL (default: http://localhost:5000)
 *   DELAY_MS           Delay between API calls in ms (default: 1500, avoid rate limit)
 *   LIMIT             Max rows to process (default: no limit)
 */

require('dotenv').config();
const path = require('path');
const fs = require('fs-extra');
const { parse } = require('csv-parse/sync');
const axios = require('axios');

// Default: repo root (Agentic_Build) when script is in PurpleIQ/server/scripts
const CSV_PATH = process.env.CSV_PATH || path.join(__dirname, '..', '..', '..', 'Jira (1).csv');
const OUTPUT_DIR = process.env.OUTPUT_DIR || path.join(process.cwd(), 'output', 'test-cases');
const PURPLEIQ_API_URL = (process.env.PURPLEIQ_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const DELAY_MS = parseInt(process.env.DELAY_MS || '1500', 10) || 1500;
const LIMIT = process.env.LIMIT ? parseInt(process.env.LIMIT, 10) : null;

const REQUIRED_COLUMNS = ['Summary', 'Issue key', 'Project key', 'Project description', 'Description'];

function safeFilename(issueKey) {
  return String(issueKey).replace(/[/\\?*:"<>|]/g, '-').trim() || 'unknown';
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log('\n📋 CSV → Test Cases (PurpleIQ agentic)\n');
  console.log('CSV path:', CSV_PATH);
  console.log('Output dir:', OUTPUT_DIR);
  console.log('API URL:', PURPLEIQ_API_URL);
  console.log('Delay between calls:', DELAY_MS, 'ms');
  if (LIMIT) console.log('Limit:', LIMIT, 'rows');
  console.log('');

  const csvAbs = path.isAbsolute(CSV_PATH) ? CSV_PATH : path.join(process.cwd(), CSV_PATH);
  if (!(await fs.pathExists(csvAbs))) {
    console.error('CSV file not found:', csvAbs);
    process.exit(1);
  }

  const raw = await fs.readFile(csvAbs, 'utf8');
  let rows;
  try {
    rows = parse(raw, {
      columns: true,
      relax_column_count: true,
      skip_empty_lines: true,
      trim: true,
      bom: true
    });
  } catch (e) {
    console.error('CSV parse error:', e.message);
    process.exit(1);
  }

  const missing = REQUIRED_COLUMNS.filter((col) => !(rows[0] && rows[0].hasOwnProperty(col)));
  if (missing.length && rows.length) {
    console.warn('Warning: CSV may use different column names. Expected:', REQUIRED_COLUMNS.join(', '));
    console.warn('Missing in first row:', missing.join(', '));
  }

  const toProcess = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const summary = row['Summary'] != null ? String(row['Summary']).trim() : '';
    const issueKey = row['Issue key'] != null ? String(row['Issue key']).trim() : '';
    const description = row['Description'] != null ? String(row['Description']).trim() : '';
    if (!summary || !issueKey) continue;
    if (!description) continue;
    toProcess.push({
      summary,
      issueKey,
      projectKey: row['Project key'] != null ? String(row['Project key']).trim() : '',
      projectDescription: row['Project description'] != null ? String(row['Project description']).trim() : '',
      description
    });
    if (LIMIT && toProcess.length >= LIMIT) break;
  }

  console.log('Total rows in CSV:', rows.length);
  console.log('Rows to process (has Summary, Issue key, Description):', toProcess.length);
  if (toProcess.length === 0) {
    console.log('Nothing to do.');
    process.exit(0);
  }

  await fs.ensureDir(OUTPUT_DIR);

  let ok = 0;
  let fail = 0;
  const url = `${PURPLEIQ_API_URL}/api/test-cases/from-story`;

  for (let i = 0; i < toProcess.length; i++) {
    const row = toProcess[i];
    const num = i + 1;
    process.stdout.write(`[${num}/${toProcess.length}] ${row.issueKey} ... `);
    try {
      const res = await axios.post(url, row, {
        timeout: 120000,
        headers: { 'Content-Type': 'application/json' }
      });
      const data = res.data;
      const outFile = path.join(OUTPUT_DIR, `${safeFilename(row.issueKey)}.json`);
      await fs.writeFile(outFile, JSON.stringify(data, null, 2), 'utf8');
      console.log(`OK (${(data.testCases || []).length} test cases) -> ${outFile}`);
      ok++;
    } catch (err) {
      const msg = err.response ? `${err.response.status} ${JSON.stringify(err.response.data)}` : err.message;
      console.log('FAIL:', msg);
      fail++;
    }
    if (i < toProcess.length - 1) await sleep(DELAY_MS);
  }

  console.log('\nDone. OK:', ok, 'Failed:', fail);
  if (fail) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
