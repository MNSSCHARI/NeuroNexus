/**
 * Jira Sync Script — Fetch user stories from Jira and export as .txt for PurpleIQ
 *
 * Usage:
 *   cd PurpleIQ/server
 *   node scripts/jira-sync.js
 *
 * Required in .env (or environment):
 *   JIRA_BASE_URL   e.g. https://your-domain.atlassian.net
 *   JIRA_EMAIL     your Atlassian account email
 *   JIRA_API_TOKEN from https://id.atlassian.com/manage-profile/security/api-tokens
 *
 * Optional:
 *   JIRA_JQL           default: type = Story ORDER BY key ASC
 *   JIRA_MAX_RESULTS   default: 100
 *   JIRA_OUTPUT_FILE   default: jira-user-stories.txt (in server directory)
 *   PURPLEIQ_UPLOAD    set to "true" to upload the file to PurpleIQ after export
 *   PURPLEIQ_API_URL   default: http://localhost:5000
 *   PURPLEIQ_PROJECT_ID required when PURPLEIQ_UPLOAD=true
 */

require('dotenv').config();
const path = require('path');
const fs = require('fs-extra');
const axios = require('axios');
const FormData = require('form-data');

const JIRA_BASE_URL = (process.env.JIRA_BASE_URL || '').replace(/\/$/, '');
const JIRA_EMAIL = process.env.JIRA_EMAIL || '';
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN || '';
const JIRA_JQL = process.env.JIRA_JQL || 'type = Story ORDER BY key ASC';
const JIRA_MAX_RESULTS = Math.min(parseInt(process.env.JIRA_MAX_RESULTS || '100', 10) || 100, 500);
const JIRA_OUTPUT_FILE = process.env.JIRA_OUTPUT_FILE || path.join(__dirname, '..', 'jira-user-stories.txt');
const PURPLEIQ_UPLOAD = (process.env.PURPLEIQ_UPLOAD || '').toLowerCase() === 'true';
const PURPLEIQ_API_URL = (process.env.PURPLEIQ_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const PURPLEIQ_PROJECT_ID = process.env.PURPLEIQ_PROJECT_ID || '';

/**
 * Convert Jira Atlassian Document Format (ADF) to plain text
 */
function adfToText(node) {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (node.text) return node.text;
  if (node.content && Array.isArray(node.content)) {
    return node.content.map(adfToText).join('');
  }
  return '';
}

function formatIssue(issue) {
  const key = issue.key || 'UNKNOWN';
  const summary = (issue.fields && issue.fields.summary) || '(No summary)';
  const status = (issue.fields && issue.fields.status && issue.fields.status.name) || '';
  let description = '';
  if (issue.fields && issue.fields.description) {
    description = adfToText(issue.fields.description).trim();
  }
  const lines = [
    `## User Story: ${key} — ${summary}`,
    status ? `**Status:** ${status}` : '',
    '',
    description ? `**Description**\n${description}` : '**Description**\n(No description)',
    '',
    '---',
    ''
  ];
  return lines.filter(Boolean).join('\n');
}

async function fetchJiraIssues() {
  const auth = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64');
  const url = `${JIRA_BASE_URL}/rest/api/3/search`;
  const params = {
    jql: JIRA_JQL,
    maxResults: JIRA_MAX_RESULTS,
    fields: ['summary', 'description', 'status', 'issuetype'].join(',')
  };
  const response = await axios.get(url, {
    params,
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: 'application/json'
    }
  });
  return response.data.issues || [];
}

async function uploadToPurpleIQ(filePath) {
  if (!PURPLEIQ_PROJECT_ID) {
    throw new Error('PURPLEIQ_PROJECT_ID is required when PURPLEIQ_UPLOAD=true');
  }
  const form = new FormData();
  form.append('document', fs.createReadStream(filePath), {
    filename: path.basename(filePath),
    contentType: 'text/plain'
  });
  const url = `${PURPLEIQ_API_URL}/api/projects/${PURPLEIQ_PROJECT_ID}/documents`;
  await axios.post(url, form, {
    headers: form.getHeaders(),
    maxBodyLength: Infinity,
    maxContentLength: Infinity
  });
}

async function main() {
  console.log('\n📥 Jira → PurpleIQ sync\n');

  if (!JIRA_BASE_URL || !JIRA_EMAIL || !JIRA_API_TOKEN) {
    console.error('Missing Jira config. Set in server/.env:');
    console.error('  JIRA_BASE_URL   (e.g. https://your-domain.atlassian.net)');
    console.error('  JIRA_EMAIL     (your Atlassian email)');
    console.error('  JIRA_API_TOKEN (from https://id.atlassian.com/manage-profile/security/api-tokens)');
    process.exit(1);
  }

  console.log(`JQL: ${JIRA_JQL}`);
  console.log(`Max results: ${JIRA_MAX_RESULTS}`);
  console.log('Fetching issues from Jira...');

  let issues;
  try {
    issues = await fetchJiraIssues();
  } catch (err) {
    const msg = err.response ? `${err.response.status} ${JSON.stringify(err.response.data)}` : err.message;
    console.error('Jira API error:', msg);
    process.exit(1);
  }

  if (!issues.length) {
    console.log('No issues found for the given JQL.');
    process.exit(0);
  }

  const body = [
    `# User Stories from Jira`,
    `Exported: ${new Date().toISOString()}`,
    `JQL: ${JIRA_JQL}`,
    `Count: ${issues.length}`,
    '',
    ...issues.map(formatIssue)
  ].join('\n');

  const outPath = path.isAbsolute(JIRA_OUTPUT_FILE) ? JIRA_OUTPUT_FILE : path.join(process.cwd(), JIRA_OUTPUT_FILE);
  await fs.ensureDir(path.dirname(outPath));
  await fs.writeFile(outPath, body, 'utf8');
  console.log(`\n✅ Wrote ${issues.length} user stories to: ${outPath}`);

  if (PURPLEIQ_UPLOAD) {
    try {
      await uploadToPurpleIQ(outPath);
      console.log(`✅ Uploaded to PurpleIQ project: ${PURPLEIQ_PROJECT_ID}`);
    } catch (err) {
      const msg = err.response ? `${err.response.status} ${err.response.data && JSON.stringify(err.response.data)}` : err.message;
      console.error('PurpleIQ upload failed:', msg);
      console.error('Ensure the PurpleIQ server is running and PURPLEIQ_PROJECT_ID is valid.');
      process.exit(1);
    }
  } else {
    console.log('\n💡 To upload this file to PurpleIQ, set: PURPLEIQ_UPLOAD=true and PURPLEIQ_PROJECT_ID=<your-project-id>');
  }

  console.log('');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
