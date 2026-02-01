import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

// Load dotenv from server to access API keys
const dotenv = require(path.join(__dirname, '../server/node_modules/dotenv'));
dotenv.config({ path: path.join(__dirname, '../server/.env') });

const FormData = require(path.join(__dirname, '../server/node_modules/form-data'));

const API_BASE = process.env.API_BASE || 'http://localhost:5000/api';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!globalThis.fetch) {
  console.error('❌ This Node version does not support fetch. Use Node 18+.');
  process.exit(1);
}

if (!GEMINI_API_KEY) {
  console.error('❌ GEMINI_API_KEY missing. Set it in server/.env');
  process.exit(1);
}

if (!OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY missing. Required for embeddings.');
  process.exit(1);
}

const RESULTS_DIR = path.join(__dirname, 'results');
const RESULTS_FILE = path.join(RESULTS_DIR, 'core-capabilities-results.json');

const results = {
  startedAt: new Date().toISOString(),
  apiBase: API_BASE,
  tests: [],
  summary: { passed: 0, failed: 0 }
};

function logResult(name, pass, details) {
  const status = pass ? 'PASS' : 'FAIL';
  console.log(`${pass ? '✅' : '❌'} ${name} - ${status}`);
  if (details) console.log(`   ${details}`);
}

function recordTest(name, pass, durationMs, response, details, modelInfo) {
  results.tests.push({
    name,
    pass,
    durationMs,
    modelInfo,
    details,
    response
  });
  if (pass) results.summary.passed += 1;
  else results.summary.failed += 1;
}

async function apiFetch(url, options = {}) {
  const res = await fetch(url, options);
  return res;
}

async function apiJson(url, options = {}) {
  const res = await apiFetch(url, options);
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  return { res, data };
}

async function ensureServer() {
  try {
    const { res } = await apiJson(`${API_BASE}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

async function createProject(name) {
  const { res, data } = await apiJson(`${API_BASE}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectName: name,
      aiModel: 'gemini',
      apiKey: GEMINI_API_KEY
    })
  });
  if (!res.ok) throw new Error(`Create project failed: ${data.message || res.status}`);
  return data.project.projectId;
}

async function uploadDoc(projectId, filePath) {
  const form = new FormData();
  form.append('document', fs.createReadStream(filePath));

  const res = await apiFetch(`${API_BASE}/projects/${projectId}/documents`, {
    method: 'POST',
    body: form,
    headers: form.getHeaders()
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upload failed: ${res.status} ${text}`);
  }
  return true;
}

function verifyModelUsed(responseJson) {
  const provider = responseJson?.modelInfo?.provider || '';
  return provider.toLowerCase().includes('gemini');
}

function hasRateLimitInfo(responseJson) {
  return !!responseJson?.rateLimitInfo?.recommended;
}

function extractTestCases(metadata, answer) {
  if (metadata?.testCases && Array.isArray(metadata.testCases)) {
    return metadata.testCases;
  }
  // Fallback: parse from answer text
  const lines = (answer || '').split('\n');
  const cases = lines.filter(l => l.match(/^TC-\\d+|^TEST CASE|^\\d+\\./i));
  return cases;
}

function hasRequiredFields(tc) {
  const keys = Object.keys(tc || {}).map(k => k.toLowerCase());
  const hasId = keys.includes('id') || keys.includes('testcaseid') || keys.includes('tcid');
  const hasDesc = keys.includes('description') || keys.includes('desc');
  const hasSteps = keys.includes('steps') || keys.includes('step');
  const hasExpected = keys.includes('expected') || keys.includes('expectedresult');
  const hasPriority = keys.includes('priority');
  const hasType = keys.includes('type') || keys.includes('category');
  return hasId && hasDesc && hasSteps && hasExpected && hasPriority && hasType;
}

function countTypes(testCases) {
  let positive = 0, negative = 0, edge = 0;
  for (const tc of testCases) {
    const type = (tc.type || tc.category || '').toLowerCase();
    if (type.includes('positive')) positive++;
    if (type.includes('negative')) negative++;
    if (type.includes('edge')) edge++;
  }
  return { positive, negative, edge };
}

function countBulletItems(text) {
  const lines = (text || '').split('\n').map(l => l.trim());
  return lines.filter(l => l.startsWith('- ') || l.match(/^\\d+\\./)).length;
}

async function runTests() {
  const serverOk = await ensureServer();
  if (!serverOk) {
    console.error('❌ Server is not running or /api/health failed.');
    process.exit(1);
  }

  const loginProjectId = await createProject('Core Capabilities - Login');
  const loginPrdPath = path.join(__dirname, '../demo/sample-prds/login-module.txt');
  await uploadDoc(loginProjectId, loginPrdPath);

  // 1. Generate Test Cases
  {
    const start = Date.now();
    const { res, data } = await apiJson(`${API_BASE}/chat/${loginProjectId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'Generate test cases for login functionality' })
    });
    const duration = Date.now() - start;
    const testCases = extractTestCases(data?.metadata, data?.answer);
    const hasFields = Array.isArray(testCases) && testCases.length > 0
      ? testCases.every(tc => typeof tc === 'object' && hasRequiredFields(tc))
      : false;
    const typeCounts = Array.isArray(testCases) ? countTypes(testCases) : { positive: 0, negative: 0, edge: 0 };

    const pass = res.ok &&
      Array.isArray(testCases) &&
      testCases.length >= 10 &&
      hasFields &&
      typeCounts.positive > 0 &&
      typeCounts.negative > 0 &&
      typeCounts.edge > 0 &&
      verifyModelUsed(data) &&
      hasRateLimitInfo(data);

    const details = `testCases=${testCases.length}, positive=${typeCounts.positive}, negative=${typeCounts.negative}, edge=${typeCounts.edge}, model=${data?.modelInfo?.provider || 'unknown'} (${data?.modelInfo?.model || 'unknown'}), rateLimit=${data?.rateLimitInfo?.recommended || 'unknown'}`;
    logResult('Generate Test Cases', pass, details);
    recordTest('Generate Test Cases', pass, duration, data, details, data?.modelInfo);
  }

  // 2. Create Bug Reports
  {
    const start = Date.now();
    const { res, data } = await apiJson(`${API_BASE}/chat/${loginProjectId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'Identify potential bugs in the login flow' })
    });
    const duration = Date.now() - start;
    const answer = data?.answer || '';
    const hasBugFields = /title|summary/i.test(answer) &&
      /severity/i.test(answer) &&
      /priority/i.test(answer) &&
      /steps/i.test(answer);

    // Export to PDF
    const exportRes = await apiFetch(`${API_BASE}/export/pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bugReport: answer })
    });
    const exportBuffer = await exportRes.arrayBuffer();
    const exportOk = exportRes.ok && exportBuffer.byteLength > 100;

    const pass = res.ok && hasBugFields && exportOk && verifyModelUsed(data) && hasRateLimitInfo(data);
    const details = `bugFields=${hasBugFields}, pdfExport=${exportOk}, model=${data?.modelInfo?.provider || 'unknown'} (${data?.modelInfo?.model || 'unknown'}), rateLimit=${data?.rateLimitInfo?.recommended || 'unknown'}`;
    logResult('Create Bug Reports', pass, details);
    recordTest('Create Bug Reports', pass, duration, data, details, data?.modelInfo);
  }

  // 3. Develop Test Plans
  {
    const start = Date.now();
    const { res, data } = await apiJson(`${API_BASE}/chat/${loginProjectId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'Create a test plan for login module' })
    });
    const duration = Date.now() - start;
    const answer = data?.answer || '';
    const hasPlanFields = /strategy/i.test(answer) &&
      /scope/i.test(answer) &&
      /resource/i.test(answer) &&
      /timeline/i.test(answer);

    // Export to DOCX
    const exportRes = await apiFetch(`${API_BASE}/export/docx`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ testPlan: answer, projectName: 'LoginModule' })
    });
    const exportBuffer = await exportRes.arrayBuffer();
    const exportOk = exportRes.ok && exportBuffer.byteLength > 100;

    const pass = res.ok && hasPlanFields && exportOk && verifyModelUsed(data) && hasRateLimitInfo(data);
    const details = `planFields=${hasPlanFields}, docxExport=${exportOk}, model=${data?.modelInfo?.provider || 'unknown'} (${data?.modelInfo?.model || 'unknown'}), rateLimit=${data?.rateLimitInfo?.recommended || 'unknown'}`;
    logResult('Develop Test Plans', pass, details);
    recordTest('Develop Test Plans', pass, duration, data, details, data?.modelInfo);
  }

  // 4. Answer Questions with RAG
  {
    const start = Date.now();
    const { res, data } = await apiJson(`${API_BASE}/chat/${loginProjectId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'What are the acceptance criteria for login?' })
    });
    const duration = Date.now() - start;
    const answer = data?.answer || '';
    const hasRagSources = Array.isArray(data?.sources) && data.sources.length > 0;
    const pass = res.ok && /acceptance criteria|acceptance/i.test(answer) && hasRagSources && verifyModelUsed(data) && hasRateLimitInfo(data);
    const details = `ragSources=${data?.sources?.length || 0}, model=${data?.modelInfo?.provider || 'unknown'} (${data?.modelInfo?.model || 'unknown'}), rateLimit=${data?.rateLimitInfo?.recommended || 'unknown'}`;
    logResult('Answer Questions (RAG)', pass, details);
    recordTest('Answer Questions (RAG)', pass, duration, data, details, data?.modelInfo);
  }

  // 5. Analyze Requirements
  {
    const start = Date.now();
    const { res, data } = await apiJson(`${API_BASE}/chat/${loginProjectId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'What edge cases are missing from this PRD?' })
    });
    const duration = Date.now() - start;
    const answer = data?.answer || '';
    const bulletCount = countBulletItems(answer);
    const pass = res.ok && bulletCount >= 3 && verifyModelUsed(data) && hasRateLimitInfo(data);
    const details = `missingScenarios=${bulletCount}, model=${data?.modelInfo?.provider || 'unknown'} (${data?.modelInfo?.model || 'unknown'}), rateLimit=${data?.rateLimitInfo?.recommended || 'unknown'}`;
    logResult('Analyze Requirements', pass, details);
    recordTest('Analyze Requirements', pass, duration, data, details, data?.modelInfo);
  }

  // 6. Multi-Document Analysis
  {
    const multiProjectId = await createProject('Core Capabilities - MultiDoc');
    const loginPrd = path.join(__dirname, '../demo/sample-prds/login-module.txt');
    const regPrd = path.join(__dirname, '../demo/sample-prds/user-registration.txt');
    await uploadDoc(multiProjectId, loginPrd);
    await uploadDoc(multiProjectId, regPrd);

    const start = Date.now();
    const { res, data } = await apiJson(`${API_BASE}/chat/${multiProjectId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'What integration points exist between these modules?' })
    });
    const duration = Date.now() - start;
    const docs = (data?.sources || []).map(s => s.documentName);
    const hasLogin = docs.some(d => d?.toLowerCase().includes('login'));
    const hasRegistration = docs.some(d => d?.toLowerCase().includes('registration'));
    const pass = res.ok && hasLogin && hasRegistration && verifyModelUsed(data) && hasRateLimitInfo(data);
    const details = `docsUsed=${[...new Set(docs)].join(', ')}, model=${data?.modelInfo?.provider || 'unknown'} (${data?.modelInfo?.model || 'unknown'}), rateLimit=${data?.rateLimitInfo?.recommended || 'unknown'}`;
    logResult('Multi-Document Analysis', pass, details);
    recordTest('Multi-Document Analysis', pass, duration, data, details, data?.modelInfo);
  }

  // 7. Quality Improvement
  {
    const start = Date.now();
    const { res, data } = await apiJson(`${API_BASE}/chat/${loginProjectId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'What test cases am I missing?' })
    });
    const duration = Date.now() - start;
    const answer = data?.answer || '';
    const bulletCount = countBulletItems(answer);
    const pass = res.ok && bulletCount >= 3 && verifyModelUsed(data) && hasRateLimitInfo(data);
    const details = `additionalScenarios=${bulletCount}, model=${data?.modelInfo?.provider || 'unknown'} (${data?.modelInfo?.model || 'unknown'}), rateLimit=${data?.rateLimitInfo?.recommended || 'unknown'}`;
    logResult('Quality Improvement', pass, details);
    recordTest('Quality Improvement', pass, duration, data, details, data?.modelInfo);
  }

  // Save results
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  results.endedAt = new Date().toISOString();
  fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));

  console.log('\n===== SUMMARY =====');
  console.log(`Passed: ${results.summary.passed}`);
  console.log(`Failed: ${results.summary.failed}`);
  console.log(`Results saved to: ${RESULTS_FILE}`);

  if (results.summary.failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('❌ Test run failed:', err.message);
  process.exit(1);
});

