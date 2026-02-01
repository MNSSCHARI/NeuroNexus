/**
 * MAX MODE: Fix and Test Full Flow
 * This script will:
 * 1. Check all dependencies
 * 2. Verify server is running
 * 3. Create project
 * 4. Upload document
 * 5. Ask question
 * 6. Get response
 * 7. Fix any issues found
 * 
 * Run: node fix-and-test-flow.js
 */

require('dotenv').config();
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

// Configuration
let API_BASE = 'http://localhost:5000';
const MAX_RETRIES = 5;
const RETRY_DELAY = 3000;

// Test document
const DOC_PATH = path.join(__dirname, '../demo/sample-prds/api-integration.txt');
const TEST_QUESTION = 'What are the main API endpoints for orders?';

// Colors
const c = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function log(msg, color = 'reset') {
  console.log(`${c[color]}${msg}${c.reset}`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function findServer() {
  log('\n🔍 Finding server...', 'cyan');
  const ports = [5000, 3001, 3000, 8080];
  
  for (const port of ports) {
    try {
      const url = `http://localhost:${port}`;
      await axios.get(`${url}/health`, { timeout: 2000 });
      API_BASE = url;
      log(`✅ Server found on port ${port}`, 'green');
      return true;
    } catch (e) {
      continue;
    }
  }
  
  log('❌ Server not found. Please start: cd PurpleIQ/server && npm start', 'red');
  return false;
}

async function checkEnv() {
  log('\n🔑 Checking environment...', 'cyan');
  const geminiKey = process.env.GEMINI_API_KEY;
  
  if (!geminiKey) {
    log('❌ GEMINI_API_KEY not set in .env', 'red');
    return false;
  }
  
  log(`✅ GEMINI_API_KEY is set (${geminiKey.substring(0, 10)}...)`, 'green');
  return true;
}

async function checkDocument() {
  log('\n📄 Checking document...', 'cyan');
  
  if (!fs.existsSync(DOC_PATH)) {
    log(`❌ Document not found: ${DOC_PATH}`, 'red');
    return false;
  }
  
  const stats = fs.statSync(DOC_PATH);
  log(`✅ Document found: ${path.basename(DOC_PATH)} (${stats.size} bytes)`, 'green');
  return true;
}

async function createProjectWithRetry() {
  log('\n📝 Creating project...', 'cyan');
  
  for (let i = 1; i <= MAX_RETRIES; i++) {
    try {
      const res = await axios.post(`${API_BASE}/api/projects`, {
        projectName: `Test Project ${Date.now()}`,
        aiModel: 'gemini',
        apiKey: process.env.GEMINI_API_KEY
      }, { timeout: 10000 });
      
      const project = res.data.project || res.data;
      if (project?.projectId) {
        log(`✅ Project created: ${project.projectId}`, 'green');
        return project.projectId;
      }
      throw new Error('Invalid project response');
    } catch (error) {
      const msg = error.response?.data?.message || error.message;
      log(`❌ Attempt ${i}/${MAX_RETRIES}: ${msg}`, 'red');
      if (i < MAX_RETRIES) {
        await sleep(RETRY_DELAY);
      } else {
        throw error;
      }
    }
  }
}

async function uploadDocumentWithRetry(projectId) {
  log('\n📤 Uploading document...', 'cyan');
  
  for (let i = 1; i <= MAX_RETRIES; i++) {
    try {
      const formData = new FormData();
      formData.append('document', fs.createReadStream(DOC_PATH), {
        filename: 'api-integration.txt',
        contentType: 'text/plain'
      });
      
      log(`   Attempt ${i}/${MAX_RETRIES}...`, 'yellow');
      
      const res = await axios.post(
        `${API_BASE}/api/projects/${projectId}/documents`,
        formData,
        {
          headers: formData.getHeaders(),
          timeout: 120000,
          maxContentLength: Infinity,
          maxBodyLength: Infinity
        }
      );
      
      log(`✅ Document uploaded!`, 'green');
      log(`   Chunks: ${res.data.chunksProcessed || res.data.chunkCount || 'N/A'}`, 'blue');
      
      // Wait for processing
      await sleep(3000);
      return true;
    } catch (error) {
      const msg = error.response?.data?.message || error.message;
      log(`❌ Attempt ${i}/${MAX_RETRIES}: ${msg.substring(0, 150)}`, 'red');
      
      if (msg.includes('embedding') || msg.includes('OpenAI') || msg.includes('Gemini')) {
        log('   ⚠️  Embedding error detected. Check server logs.', 'yellow');
      }
      
      if (i < MAX_RETRIES) {
        await sleep(RETRY_DELAY * 2); // Longer wait for uploads
      } else {
        throw error;
      }
    }
  }
}

async function askQuestionWithRetry(projectId, question) {
  log(`\n❓ Asking question...`, 'cyan');
  log(`   "${question}"`, 'blue');
  
  for (let i = 1; i <= MAX_RETRIES; i++) {
    try {
      log(`   Attempt ${i}/${MAX_RETRIES}...`, 'yellow');
      
      const res = await axios.post(
        `${API_BASE}/api/chat/${projectId}`,
        { question },
        {
          timeout: 180000, // 3 minutes
          headers: { 'Content-Type': 'application/json' }
        }
      );
      
      if (!res.data?.answer) {
        throw new Error('Response missing answer field');
      }
      
      log(`✅ Got response!`, 'green');
      log(`\n📋 Response:`, 'cyan');
      log(`   ${res.data.answer.substring(0, 300)}${res.data.answer.length > 300 ? '...' : ''}`, 'blue');
      log(`   Intent: ${res.data.intent || 'N/A'}`, 'blue');
      log(`   Workflow: ${res.data.workflow || 'N/A'}`, 'blue');
      
      return res.data;
    } catch (error) {
      const msg = error.response?.data?.message || error.message;
      log(`❌ Attempt ${i}/${MAX_RETRIES}: ${msg.substring(0, 200)}`, 'red');
      
      if (msg.includes('callAIWithFailover') || msg.includes('intelligentChunk')) {
        log('   ⚠️  Server needs restart to load new functions!', 'yellow');
      }
      
      if (i < MAX_RETRIES) {
        await sleep(RETRY_DELAY);
      } else {
        throw error;
      }
    }
  }
}

async function runMaxMode() {
  log('\n' + '='.repeat(80), 'bright');
  log('🚀 MAX MODE: Full Flow Test & Fix', 'bright');
  log('='.repeat(80) + '\n', 'bright');
  
  try {
    // Pre-flight checks
    if (!(await checkEnv())) process.exit(1);
    if (!(await checkDocument())) process.exit(1);
    if (!(await findServer())) process.exit(1);
    
    // Step 1: Create project
    const projectId = await createProjectWithRetry();
    
    // Step 2: Upload document
    await uploadDocumentWithRetry(projectId);
    
    // Step 3: Ask question
    const response = await askQuestionWithRetry(projectId, TEST_QUESTION);
    
    // Success!
    log('\n' + '='.repeat(80), 'bright');
    log('✅ MAX MODE: ALL STEPS PASSED!', 'green');
    log('='.repeat(80) + '\n', 'bright');
    
    log('📊 Final Results:', 'cyan');
    log(`   Project ID: ${projectId}`, 'blue');
    log(`   Document: api-integration.txt`, 'blue');
    log(`   Question: "${TEST_QUESTION}"`, 'blue');
    log(`   Answer Length: ${response.answer.length} chars`, 'blue');
    log(`   Intent: ${response.intent}`, 'blue');
    log(`   Workflow: ${response.workflow}`, 'blue');
    log(`   Sources: ${response.sources?.length || 0} chunks`, 'blue');
    
    process.exit(0);
  } catch (error) {
    log('\n' + '='.repeat(80), 'bright');
    log('❌ MAX MODE: FAILED', 'red');
    log('='.repeat(80) + '\n', 'bright');
    
    log(`Error: ${error.message}`, 'red');
    
    log('\n🔧 Fix Checklist:', 'yellow');
    log('   □ Server is running (npm start)', 'yellow');
    log('   □ GEMINI_API_KEY is set in .env', 'yellow');
    log('   □ Server has been restarted after code changes', 'yellow');
    log('   □ Document file exists at expected path', 'yellow');
    log('   □ Check server console for detailed error logs', 'yellow');
    
    process.exit(1);
  }
}

runMaxMode();

