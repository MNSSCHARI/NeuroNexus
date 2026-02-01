const fs = require('fs-extra');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const API_BASE = process.env.API_BASE_URL || 'http://localhost:5000/api';
const RESULTS_DIR = path.join(__dirname, 'results', 'core-capabilities');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const SAMPLE_DIR = path.join(__dirname, '../../demo/sample-prds');
const LOGIN_PRD = path.join(SAMPLE_DIR, 'login-module.txt');
const REGISTRATION_PRD = path.join(SAMPLE_DIR, 'user-registration.txt');

const REQUIREMENTS = {
  testCaseFields: ['testCaseId', 'description', 'steps', 'expectedResults', 'priority', 'type'],
  bugReportFields: ['title', 'severity', 'priority', 'steps'],
  testPlanFields: ['strategy', 'scope', 'resources', 'timeline']
};

async function ensureDir() {
  await fs.ensureDir(RESULTS_DIR);
}

function logResult(name, passed, details = '') {
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} - ${name}${details ? `: ${details}` : ''}`);
}

async function saveResponse(name, data) {
  const filePath = path.join(RESULTS_DIR, `${name}.json`);
  await fs.writeJson(filePath, data, { spaces: 2 });
  return filePath;
}

async function fetchJson(url, options = {}) {
  const start = Date.now();
  const res = await fetch(url, options);
  const duration = Date.now() - start;
  const data = await res.json().catch(() => ({}));
  return { res, data, duration };
}

async function uploadDocument(projectId, filePath) {
  const buffer = await fs.readFile(filePath);
  const form = new FormData();
  const filename = path.basename(filePath);
  form.append('document', new Blob([buffer]), filename);

  const res = await fetch(`${API_BASE}/projects/${projectId}/documents`, {
    method: 'POST',
    body: form
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Upload failed (${filename}): ${res.status} ${err}`);
  }
  return res.json();
}

function extractTestCases(metadata) {
  if (metadata && Array.isArray(metadata.testCases)) {
    return metadata.testCases;
  }
  return [];
}

function validateTestCases(testCases) {
  if (testCases.length < 10) return { ok: false, reason: `Only ${testCases.length} test cases` };

  const missingFields = testCases.filter(tc =>
    !REQUIREMENTS.testCaseFields.every(field => tc[field])
  );

  if (missingFields.length > 0) {
    return { ok: false, reason: `${missingFields.length} test cases missing fields` };
  }

  const types = new Set(testCases.map(tc => (tc.type || '').toLowerCase()));
  const hasPositive = types.has('positive');
  const hasNegative = types.has('negative');
  const hasEdge = types.has('edge case') || types.has('edge');

  if (!hasPositive || !hasNegative || !hasEdge) {
    return { ok: false, reason: 'Missing positive/negative/edge cases' };
  }

  return { ok: true };
}

function containsAllFields(text, fields) {
  const lower = text.toLowerCase();
  return fields.every(f => lower.includes(f));
}

function countBulletOrNumberedLines(text) {
  const lines = text.split('\n').map(l => l.trim());
  return lines.filter(l => l.match(/^[-*]\s+/) || l.match(/^\d+\./)).length;
}

async function exportPdf(bugReport, projectName) {
  const res = await fetch(`${API_BASE}/export/pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bugReport, projectName })
  });
  const buffer = Buffer.from(await res.arrayBuffer());
  return { res, buffer };
}

async function exportDocx(testPlan, projectName) {
  const res = await fetch(`${API_BASE}/export/docx`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ testPlan, projectName })
  });
  const buffer = Buffer.from(await res.arrayBuffer());
  return { res, buffer };
}

async function main() {
  await ensureDir();
  const summary = [];

  if (!GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY is required to run this test.');
    process.exit(1);
  }

  // Health check (allow unhealthy status as long as server responds)
  const health = await fetchJson(`${API_BASE}/health`);
  if (!health.res) {
    console.error('❌ Server health check failed. Is the server running?');
    process.exit(1);
  }
  if (!health.res.ok) {
    console.warn(`⚠️ Health check returned non-OK status: ${health.data?.status || health.res.status}`);
  }
  const embeddingStatus = health.data?.checks?.embedding?.status;
  const embeddingError = health.data?.checks?.embedding?.error;
  if (embeddingStatus === 'down') {
    console.warn(`⚠️ Embedding service is DOWN: ${embeddingError || 'unknown error'}`);
  }

  // Disable demo mode for real AI testing
  await fetchJson(`${API_BASE}/settings/demo-mode`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled: false })
  });

  // Create project
  const projectName = `CoreCapabilitiesTest_${Date.now()}`;
  const projectRes = await fetchJson(`${API_BASE}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectName, aiModel: 'gemini', apiKey: GEMINI_API_KEY })
  });

  if (!projectRes.res.ok) {
    console.error('❌ Failed to create project:', projectRes.data);
    process.exit(1);
  }

  const projectId = projectRes.data.project.projectId;
  console.log(`✅ Created project: ${projectId}`);

  // Upload login PRD
  try {
    await uploadDocument(projectId, LOGIN_PRD);
    console.log('✅ Uploaded login PRD');
  } catch (error) {
    const reason = error.message || 'Unknown upload error';
    console.error(`❌ Upload failed. Cannot proceed with capability tests: ${reason}`);

    const summaryData = {
      timestamp: new Date().toISOString(),
      projectId,
      total: 7,
      passed: 0,
      failed: 7,
      results: [
        { capability: 'Generate Test Cases', passed: false, reason },
        { capability: 'Create Bug Reports', passed: false, reason },
        { capability: 'Develop Test Plans', passed: false, reason },
        { capability: 'Answer Questions', passed: false, reason },
        { capability: 'Analyze Requirements', passed: false, reason },
        { capability: 'Multi-Document Analysis', passed: false, reason },
        { capability: 'Quality Improvement', passed: false, reason }
      ]
    };

    await saveResponse('summary', summaryData);
    process.exit(1);
  }

  // ========== 1. Generate Test Cases ==========
  {
    const question = 'Generate test cases for login functionality';
    const { res, data, duration } = await fetchJson(`${API_BASE}/chat/${projectId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question })
    });

    const testCases = extractTestCases(data.metadata);
    const validation = validateTestCases(testCases);
    const modelOk = data.modelInfo?.provider?.toLowerCase() === 'gemini';

    const passed = res.ok && validation.ok && modelOk;
    summary.push({ capability: 'Generate Test Cases', passed, duration });
    logResult('Generate Test Cases', passed, validation.reason || `model=${data.modelInfo?.provider || 'unknown'}`);

    await saveResponse('capability-1-test-cases', { question, duration, response: data });
  }

  // ========== 2. Create Bug Reports ==========
  {
    const question = 'Identify potential bugs in the login flow';
    const { res, data, duration } = await fetchJson(`${API_BASE}/chat/${projectId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question })
    });

    const text = data.answer || '';
    const hasFields = containsAllFields(text, REQUIREMENTS.bugReportFields);
    const modelOk = data.modelInfo?.provider?.toLowerCase() === 'gemini';

    // Export to PDF
    let exportOk = false;
    try {
      const pdf = await exportPdf(text, projectName);
      exportOk = pdf.res.ok && pdf.buffer.length > 1000 && (pdf.res.headers.get('content-type') || '').includes('pdf');
    } catch (e) {
      exportOk = false;
    }

    const passed = res.ok && hasFields && exportOk && modelOk;
    summary.push({ capability: 'Create Bug Reports', passed, duration });
    logResult('Create Bug Reports', passed, `export=${exportOk}, model=${data.modelInfo?.provider || 'unknown'}`);

    await saveResponse('capability-2-bug-reports', { question, duration, response: data, exportOk });
  }

  // ========== 3. Develop Test Plans ==========
  {
    const question = 'Create a test plan for login module';
    const { res, data, duration } = await fetchJson(`${API_BASE}/chat/${projectId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question })
    });

    const text = data.answer || '';
    const hasFields = containsAllFields(text, REQUIREMENTS.testPlanFields);
    const modelOk = data.modelInfo?.provider?.toLowerCase() === 'gemini';

    // Export to DOCX
    let exportOk = false;
    try {
      const docx = await exportDocx(text, projectName);
      exportOk = docx.res.ok && docx.buffer.length > 1000 &&
        (docx.res.headers.get('content-type') || '').includes('wordprocessingml');
    } catch (e) {
      exportOk = false;
    }

    const passed = res.ok && hasFields && exportOk && modelOk;
    summary.push({ capability: 'Develop Test Plans', passed, duration });
    logResult('Develop Test Plans', passed, `export=${exportOk}, model=${data.modelInfo?.provider || 'unknown'}`);

    await saveResponse('capability-3-test-plans', { question, duration, response: data, exportOk });
  }

  // ========== 4. Answer Questions ==========
  {
    const question = 'What are the acceptance criteria for login?';
    const { res, data, duration } = await fetchJson(`${API_BASE}/chat/${projectId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question })
    });

    const text = data.answer || '';
    const usesRAG = Array.isArray(data.sources) && data.sources.length > 0;
    const mentionsLogin = text.toLowerCase().includes('login');
    const modelOk = data.modelInfo?.provider?.toLowerCase() === 'gemini';

    const passed = res.ok && usesRAG && mentionsLogin && modelOk;
    summary.push({ capability: 'Answer Questions', passed, duration });
    logResult('Answer Questions', passed, `RAG=${usesRAG}, model=${data.modelInfo?.provider || 'unknown'}`);

    await saveResponse('capability-4-answer-questions', { question, duration, response: data });
  }

  // ========== 5. Analyze Requirements ==========
  {
    const question = 'What edge cases are missing from this PRD?';
    const { res, data, duration } = await fetchJson(`${API_BASE}/chat/${projectId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question })
    });

    const text = data.answer || '';
    const missingCount = countBulletOrNumberedLines(text);
    const modelOk = data.modelInfo?.provider?.toLowerCase() === 'gemini';

    const passed = res.ok && missingCount >= 3 && modelOk;
    summary.push({ capability: 'Analyze Requirements', passed, duration });
    logResult('Analyze Requirements', passed, `missing=${missingCount}, model=${data.modelInfo?.provider || 'unknown'}`);

    await saveResponse('capability-5-analyze-requirements', { question, duration, response: data, missingCount });
  }

  // ========== 6. Multi-Document Analysis ==========
  {
    await uploadDocument(projectId, REGISTRATION_PRD);
    console.log('✅ Uploaded registration PRD');

    const question = 'What integration points exist between these modules?';
    const { res, data, duration } = await fetchJson(`${API_BASE}/chat/${projectId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question })
    });

    const text = data.answer || '';
    const mentionsLogin = text.toLowerCase().includes('login');
    const mentionsRegistration = text.toLowerCase().includes('registration') || text.toLowerCase().includes('register');

    const sources = Array.isArray(data.sources) ? data.sources.map(s => s.documentName) : [];
    const hasLoginSource = sources.some(s => s.toLowerCase().includes('login'));
    const hasRegSource = sources.some(s => s.toLowerCase().includes('registration'));
    const modelOk = data.modelInfo?.provider?.toLowerCase() === 'gemini';

    const passed = res.ok && mentionsLogin && mentionsRegistration && hasLoginSource && hasRegSource && modelOk;
    summary.push({ capability: 'Multi-Document Analysis', passed, duration });
    logResult('Multi-Document Analysis', passed, `sources=${sources.length}, model=${data.modelInfo?.provider || 'unknown'}`);

    await saveResponse('capability-6-multi-doc', { question, duration, response: data });
  }

  // ========== 7. Quality Improvement ==========
  {
    const question = 'What test cases am I missing?';
    const { res, data, duration } = await fetchJson(`${API_BASE}/chat/${projectId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question })
    });

    const text = data.answer || '';
    const suggestionCount = countBulletOrNumberedLines(text);
    const modelOk = data.modelInfo?.provider?.toLowerCase() === 'gemini';

    const passed = res.ok && suggestionCount >= 3 && modelOk;
    summary.push({ capability: 'Quality Improvement', passed, duration });
    logResult('Quality Improvement', passed, `suggestions=${suggestionCount}, model=${data.modelInfo?.provider || 'unknown'}`);

    await saveResponse('capability-7-quality-improvement', { question, duration, response: data, suggestionCount });
  }

  // Summary
  const passedCount = summary.filter(s => s.passed).length;
  const failedCount = summary.length - passedCount;
  const summaryData = {
    timestamp: new Date().toISOString(),
    projectId,
    total: summary.length,
    passed: passedCount,
    failed: failedCount,
    results: summary
  };

  await saveResponse('summary', summaryData);

  console.log('\n========== SUMMARY ==========');
  console.log(`Total: ${summary.length}, Passed: ${passedCount}, Failed: ${failedCount}`);

  if (failedCount > 0) {
    console.log('❌ Some capabilities failed. Review results in tests/results/core-capabilities');
    process.exit(1);
  }

  console.log('✅ All capabilities passed.');
}

main().catch(err => {
  console.error('❌ Test script failed:', err);
  process.exit(1);
});

