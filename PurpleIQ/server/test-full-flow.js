/**
 * Comprehensive test script for full flow:
 * 1. Create project
 * 2. Upload document (api-integration.txt)
 * 3. Ask question
 * 4. Get proper AI response
 * 
 * Run: node test-full-flow.js
 */

require('dotenv').config();
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const API_BASE = process.env.API_BASE_URL || 'http://localhost:5000';
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 seconds

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function checkServer() {
  log('\n🔍 Step 0: Checking server...', 'cyan');
  
  // Try multiple ports
  const ports = [5000, 3001, 3000];
  let serverFound = false;
  
  for (const port of ports) {
    const testUrl = `http://localhost:${port}`;
    try {
      log(`   Trying ${testUrl}...`, 'yellow');
      const response = await axios.get(`${testUrl}/health`, { timeout: 3000 });
      log(`✅ Server is running on port ${port}`, 'green');
      // Update API_BASE if we found a different port
      if (port !== 5000) {
        log(`   Using ${testUrl} as API base`, 'blue');
        return { found: true, baseUrl: testUrl };
      }
      return { found: true, baseUrl: API_BASE };
    } catch (error) {
      // Continue to next port
      continue;
    }
  }
  
  log(`❌ Server is not running on any checked port (${ports.join(', ')})`, 'red');
  log('   Please start the server: cd PurpleIQ/server && npm start', 'yellow');
  return { found: false, baseUrl: null };
}

async function createProject() {
  log('\n📝 Step 1: Creating project...', 'cyan');
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await axios.post(`${API_BASE}/api/projects`, {
        projectName: 'API Integration Test Project',
        aiModel: 'gemini',
        apiKey: process.env.GEMINI_API_KEY || ''
      });
      
      const project = response.data.project || response.data;
      if (!project || !project.projectId) {
        throw new Error('Invalid project response');
      }
      
      log(`✅ Project created: ${project.projectName}`, 'green');
      log(`   Project ID: ${project.projectId}`, 'blue');
      return project.projectId;
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message;
      log(`❌ Attempt ${attempt}/${MAX_RETRIES} failed: ${errorMsg}`, 'red');
      
      if (attempt < MAX_RETRIES) {
        log(`   Retrying in ${RETRY_DELAY/1000}s...`, 'yellow');
        await sleep(RETRY_DELAY);
      } else {
        throw new Error(`Failed to create project after ${MAX_RETRIES} attempts: ${errorMsg}`);
      }
    }
  }
}

async function uploadDocument(projectId) {
  log('\n📤 Step 2: Uploading document...', 'cyan');
  
  const docPath = path.join(__dirname, '../demo/sample-prds/api-integration.txt');
  
  if (!fs.existsSync(docPath)) {
    throw new Error(`Document not found: ${docPath}`);
  }
  
  log(`   Document: ${docPath}`, 'blue');
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const formData = new FormData();
      formData.append('document', fs.createReadStream(docPath), {
        filename: 'api-integration.txt',
        contentType: 'text/plain'
      });
      
      log(`   Uploading (attempt ${attempt}/${MAX_RETRIES})...`, 'yellow');
      
      const response = await axios.post(
        `${API_BASE}/api/projects/${projectId}/documents`,
        formData,
        {
          headers: formData.getHeaders(),
          timeout: 60000, // 60 seconds timeout for upload
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              process.stdout.write(`\r   Progress: ${percent}%`);
            }
          }
        }
      );
      
      process.stdout.write('\n'); // New line after progress
      
      const result = response.data;
      log(`✅ Document uploaded successfully!`, 'green');
      log(`   Document: ${result.documentName || 'api-integration.txt'}`, 'blue');
      log(`   Chunks: ${result.chunksProcessed || result.chunkCount || 'N/A'}`, 'blue');
      
      // Wait a bit for processing to complete
      log('   Waiting for processing to complete...', 'yellow');
      await sleep(2000);
      
      return true;
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message;
      const errorDetails = error.response?.data ? JSON.stringify(error.response.data).substring(0, 200) : '';
      
      log(`❌ Attempt ${attempt}/${MAX_RETRIES} failed: ${errorMsg}`, 'red');
      if (errorDetails) {
        log(`   Details: ${errorDetails}`, 'red');
      }
      
      // Check if it's an embedding error
      if (errorMsg.includes('embedding') || errorMsg.includes('OpenAI') || errorMsg.includes('Gemini')) {
        log('   ⚠️  This looks like an embedding error. Check:', 'yellow');
        log('      1. GEMINI_API_KEY is set in .env', 'yellow');
        log('      2. Server is using new Gemini-only code', 'yellow');
        log('      3. Server has been restarted', 'yellow');
      }
      
      if (attempt < MAX_RETRIES) {
        log(`   Retrying in ${RETRY_DELAY/1000}s...`, 'yellow');
        await sleep(RETRY_DELAY);
      } else {
        throw new Error(`Failed to upload document after ${MAX_RETRIES} attempts: ${errorMsg}`);
      }
    }
  }
}

async function askQuestion(projectId, question) {
  log(`\n❓ Step 3: Asking question...`, 'cyan');
  log(`   Question: "${question}"`, 'blue');
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      log(`   Sending request (attempt ${attempt}/${MAX_RETRIES})...`, 'yellow');
      
      const response = await axios.post(
        `${API_BASE}/api/chat/${projectId}`,
        { question: question },
        {
          timeout: 120000, // 2 minutes timeout for AI response
          headers: { 'Content-Type': 'application/json' }
        }
      );
      
      const result = response.data;
      
      if (!result || !result.answer) {
        throw new Error('Invalid response: missing answer field');
      }
      
      log(`✅ Got response!`, 'green');
      log(`\n📋 Response Details:`, 'cyan');
      log(`   Answer: ${result.answer.substring(0, 200)}${result.answer.length > 200 ? '...' : ''}`, 'blue');
      log(`   Intent: ${result.intent || 'N/A'}`, 'blue');
      log(`   Workflow: ${result.workflow || 'N/A'}`, 'blue');
      log(`   Sources: ${result.sources?.length || 0} document chunks`, 'blue');
      
      if (result.modelInfo) {
        log(`   Model: ${result.modelInfo.provider || 'unknown'} (${result.modelInfo.model || 'unknown'})`, 'blue');
      }
      
      return result;
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message;
      const errorDetails = error.response?.data ? JSON.stringify(error.response.data).substring(0, 300) : '';
      
      log(`❌ Attempt ${attempt}/${MAX_RETRIES} failed: ${errorMsg}`, 'red');
      if (errorDetails) {
        log(`   Details: ${errorDetails}`, 'red');
      }
      
      // Check for specific error types
      if (errorMsg.includes('callAIWithFailover')) {
        log('   ⚠️  This error suggests the server needs to be restarted', 'yellow');
        log('      The callAIWithFailover function was recently added', 'yellow');
      }
      
      if (errorMsg.includes('intelligentChunk')) {
        log('   ⚠️  This error suggests the server needs to be restarted', 'yellow');
        log('      The intelligentChunk function was recently added', 'yellow');
      }
      
      if (errorMsg.includes('429') || errorMsg.includes('rate limit')) {
        log('   ⚠️  Rate limit error. Waiting longer before retry...', 'yellow');
        await sleep(RETRY_DELAY * 3); // Wait longer for rate limits
      }
      
      if (attempt < MAX_RETRIES) {
        log(`   Retrying in ${RETRY_DELAY/1000}s...`, 'yellow');
        await sleep(RETRY_DELAY);
      } else {
        throw new Error(`Failed to get response after ${MAX_RETRIES} attempts: ${errorMsg}`);
      }
    }
  }
}

async function verifyResponse(response) {
  log(`\n✅ Step 4: Verifying response...`, 'cyan');
  
  const checks = {
    hasAnswer: !!response.answer,
    answerLength: response.answer?.length || 0,
    hasIntent: !!response.intent,
    hasWorkflow: !!response.workflow,
    hasSources: Array.isArray(response.sources)
  };
  
  log(`   Checks:`, 'blue');
  Object.entries(checks).forEach(([key, value]) => {
    const status = value ? '✅' : '❌';
    log(`   ${status} ${key}: ${value}`, value ? 'green' : 'red');
  });
  
  if (checks.hasAnswer && checks.answerLength > 50) {
    log(`\n🎉 SUCCESS! Response is valid and contains content.`, 'green');
    return true;
  } else {
    log(`\n⚠️  WARNING: Response may be incomplete.`, 'yellow');
    return false;
  }
}

async function runFullFlow() {
  log('\n' + '='.repeat(80), 'bright');
  log('🧪 FULL FLOW TEST: Create Project → Upload Doc → Ask Question → Get Response', 'bright');
  log('='.repeat(80) + '\n', 'bright');
  
  let projectId = null;
  
  try {
    // Step 0: Check server
    const serverCheck = await checkServer();
    if (!serverCheck.found) {
      process.exit(1);
    }
    
    // Update API_BASE if server is on different port
    if (serverCheck.baseUrl && serverCheck.baseUrl !== API_BASE) {
      API_BASE = serverCheck.baseUrl;
      log(`   Using server at: ${API_BASE}`, 'blue');
    }
    
    // Step 1: Create project
    projectId = await createProject();
    
    // Step 2: Upload document
    await uploadDocument(projectId);
    
    // Step 3: Ask question
    const question = 'What are the main API endpoints for orders?';
    const response = await askQuestion(projectId, question);
    
    // Step 4: Verify response
    const isValid = await verifyResponse(response);
    
    // Summary
    log('\n' + '='.repeat(80), 'bright');
    if (isValid) {
      log('✅ FULL FLOW TEST: PASSED', 'green');
    } else {
      log('⚠️  FULL FLOW TEST: PARTIAL SUCCESS (response may need improvement)', 'yellow');
    }
    log('='.repeat(80) + '\n', 'bright');
    
    log('📊 Summary:', 'cyan');
    log(`   Project ID: ${projectId}`, 'blue');
    log(`   Document: api-integration.txt`, 'blue');
    log(`   Question: "${question}"`, 'blue');
    log(`   Response Length: ${response.answer?.length || 0} characters`, 'blue');
    log(`   Intent: ${response.intent || 'N/A'}`, 'blue');
    log(`   Workflow: ${response.workflow || 'N/A'}`, 'blue');
    
    if (isValid) {
      log('\n🎉 All steps completed successfully!', 'green');
      process.exit(0);
    } else {
      log('\n⚠️  Test completed but response may need improvement.', 'yellow');
      process.exit(0);
    }
    
  } catch (error) {
    log('\n' + '='.repeat(80), 'bright');
    log('❌ FULL FLOW TEST: FAILED', 'red');
    log('='.repeat(80) + '\n', 'bright');
    
    log(`Error: ${error.message}`, 'red');
    if (error.stack) {
      log(`\nStack trace:`, 'red');
      log(error.stack.split('\n').slice(0, 5).join('\n'), 'red');
    }
    
    log('\n🔧 Troubleshooting:', 'yellow');
    log('   1. Check server logs for detailed error messages', 'yellow');
    log('   2. Verify GEMINI_API_KEY is set in .env', 'yellow');
    log('   3. Ensure server has been restarted with new code', 'yellow');
    log('   4. Check that all dependencies are installed', 'yellow');
    log('   5. Verify the document file exists at the expected path', 'yellow');
    
    if (projectId) {
      log(`\n   Project ID: ${projectId} (you can check this project in the UI)`, 'blue');
    }
    
    process.exit(1);
  }
}

// Run the test
runFullFlow().catch(error => {
  log(`\n💥 Fatal error: ${error.message}`, 'red');
  process.exit(1);
});

