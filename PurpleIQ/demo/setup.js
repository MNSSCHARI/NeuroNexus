#!/usr/bin/env node

/**
 * Demo Setup Script
 * 
 * This script prepares the demo environment by:
 * 1. Creating a demo project
 * 2. Uploading all sample PRDs
 * 3. Pre-processing and indexing them
 * 4. Running health checks
 * 5. Verifying all features work
 * 
 * Usage: node demo/setup.js
 */

const fs = require('fs-extra');
const path = require('path');
const FormData = require('form-data');

// Use built-in fetch (Node 18+) or require node-fetch
let fetch;
try {
  // Try built-in fetch first (Node 18+)
  if (typeof globalThis.fetch === 'function') {
    fetch = globalThis.fetch;
  } else {
    // Fallback to node-fetch if available
    const nodeFetch = require('node-fetch');
    fetch = nodeFetch.default || nodeFetch;
  }
} catch (error) {
  // If node-fetch is not available, we'll need to install it or use alternative
  console.error('Error: fetch is not available. Please install node-fetch: npm install node-fetch');
  process.exit(1);
}

// Configuration
const API_BASE_URL = process.env.API_URL || 'http://localhost:5000';
const DEMO_PROJECT_NAME = 'Demo Project - E-Commerce Platform';
const DEMO_AI_MODEL = process.env.DEMO_AI_MODEL || 'gemini';
const DEMO_API_KEY = process.env.DEMO_API_KEY || process.env.GEMINI_API_KEY || 'demo-key';

// PRD files to upload
const PRD_FILES = [
  'login-module.txt',
  'payment-gateway.txt',
  'user-registration.txt',
  'dashboard-analytics.txt',
  'api-integration.txt'
];

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, message) {
  log(`\n[Step ${step}] ${message}`, 'cyan');
}

function logSuccess(message) {
  log(`✓ ${message}`, 'green');
}

function logError(message) {
  log(`✗ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠ ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ ${message}`, 'blue');
}

/**
 * Check if server is running
 */
async function checkServerHealth() {
  logStep(1, 'Checking server health...');
  
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    if (response.ok) {
      const data = await response.json();
      logSuccess(`Server is running (AI Mode: ${data.aiMode || 'Unknown'})`);
      return true;
    } else {
      logError(`Server health check failed: ${response.status}`);
      return false;
    }
  } catch (error) {
    logError(`Cannot connect to server: ${error.message}`);
    logWarning('Make sure the server is running: npm start (in server directory)');
    return false;
  }
}

/**
 * Create demo project
 */
async function createDemoProject() {
  logStep(2, 'Creating demo project...');
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        projectName: DEMO_PROJECT_NAME,
        aiModel: DEMO_AI_MODEL,
        apiKey: DEMO_API_KEY
      })
    });

    if (!response.ok) {
      const error = await response.json();
      // If project already exists, try to find it
      if (error.message && error.message.includes('already exists')) {
        logWarning('Demo project already exists, checking for existing project...');
        return await findExistingProject();
      }
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    logSuccess(`Demo project created: ${data.project.projectName} (ID: ${data.project.id})`);
    return data.project.id;
  } catch (error) {
    logError(`Failed to create project: ${error.message}`);
    throw error;
  }
}

/**
 * Find existing demo project
 */
async function findExistingProject() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/projects`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    const demoProject = data.projects.find(p => 
      p.projectName === DEMO_PROJECT_NAME || 
      p.projectName.includes('Demo')
    );
    
    if (demoProject) {
      logSuccess(`Found existing demo project: ${demoProject.projectName} (ID: ${demoProject.id})`);
      return demoProject.id;
    }
    
    return null;
  } catch (error) {
    logError(`Failed to find existing project: ${error.message}`);
    return null;
  }
}

/**
 * Upload PRD file to project
 */
async function uploadPRD(projectId, prdFileName) {
  const prdPath = path.join(__dirname, 'sample-prds', prdFileName);
  
  if (!await fs.pathExists(prdPath)) {
    logError(`PRD file not found: ${prdFileName}`);
    return false;
  }

  try {
    const formData = new FormData();
    formData.append('document', fs.createReadStream(prdPath), prdFileName);

    const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/documents`, {
      method: 'POST',
      body: formData,
      headers: formData.getHeaders()
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    logSuccess(`Uploaded ${prdFileName} (${data.document.chunkCount} chunks)`);
    return true;
  } catch (error) {
    logError(`Failed to upload ${prdFileName}: ${error.message}`);
    return false;
  }
}

/**
 * Upload all PRD files
 */
async function uploadAllPRDs(projectId) {
  logStep(3, 'Uploading sample PRDs...');
  
  const results = [];
  for (const prdFile of PRD_FILES) {
    const success = await uploadPRD(projectId, prdFile);
    results.push({ file: prdFile, success });
    
    // Small delay between uploads to avoid overwhelming the server
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;

  logInfo(`Uploaded ${successCount}/${PRD_FILES.length} PRDs successfully`);
  
  if (failCount > 0) {
    logWarning(`Failed to upload ${failCount} PRD(s):`);
    results.filter(r => !r.success).forEach(r => {
      logWarning(`  - ${r.file}`);
    });
  }

  return successCount === PRD_FILES.length;
}

/**
 * Verify project setup
 */
async function verifyProject(projectId) {
  logStep(4, 'Verifying project setup...');
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const project = data.project;
    
    logSuccess(`Project verified: ${project.projectName}`);
    logInfo(`  - AI Model: ${project.aiModel}`);
    logInfo(`  - Documents: ${project.documents ? project.documents.length : 0}`);
    logInfo(`  - Created: ${project.createdAt || 'Unknown'}`);
    
    if (project.documents && project.documents.length > 0) {
      logInfo('\n  Uploaded documents:');
      project.documents.forEach((doc, index) => {
        logInfo(`    ${index + 1}. ${doc.fileName} (${doc.chunkCount || 'N/A'} chunks)`);
      });
    }
    
    return true;
  } catch (error) {
    logError(`Failed to verify project: ${error.message}`);
    return false;
  }
}

/**
 * Test chat functionality
 */
async function testChat(projectId) {
  logStep(5, 'Testing chat functionality...');
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/chat/${projectId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        question: 'What is this project about?'
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    logSuccess('Chat functionality working');
    logInfo(`  Response received (${data.answer ? data.answer.length : 0} characters)`);
    logInfo(`  Intent: ${data.intent || 'N/A'}`);
    logInfo(`  Workflow: ${data.workflow || 'N/A'}`);
    
    return true;
  } catch (error) {
    logWarning(`Chat test failed: ${error.message}`);
    logWarning('This may be due to API key configuration. Chat will still work if API key is set correctly.');
    return false;
  }
}

/**
 * Run health checks
 */
async function runHealthChecks(projectId) {
  logStep(6, 'Running health checks...');
  
  const checks = [
    { name: 'Server Health', fn: checkServerHealth },
    { name: 'Project Verification', fn: () => verifyProject(projectId) },
    { name: 'Chat Functionality', fn: () => testChat(projectId) }
  ];

  const results = [];
  for (const check of checks) {
    try {
      const result = await check.fn();
      results.push({ name: check.name, success: result });
    } catch (error) {
      results.push({ name: check.name, success: false, error: error.message });
    }
  }

  logInfo('\nHealth Check Results:');
  results.forEach(result => {
    if (result.success) {
      logSuccess(`  ✓ ${result.name}`);
    } else {
      logError(`  ✗ ${result.name}${result.error ? `: ${result.error}` : ''}`);
    }
  });

  const allPassed = results.every(r => r.success);
  return allPassed;
}

/**
 * Main setup function
 */
async function main() {
  log('\n' + '='.repeat(60), 'cyan');
  log('PurpleIQ Demo Setup Script', 'cyan');
  log('='.repeat(60) + '\n', 'cyan');

  try {
    // Step 1: Check server health
    const serverHealthy = await checkServerHealth();
    if (!serverHealthy) {
      logError('\nSetup failed: Server is not running or not accessible.');
      logInfo('Please start the server: cd server && npm start');
      process.exit(1);
    }

    // Step 2: Create or find demo project
    let projectId = await createDemoProject();
    if (!projectId) {
      projectId = await findExistingProject();
      if (!projectId) {
        logError('\nSetup failed: Could not create or find demo project.');
        process.exit(1);
      }
    }

    // Step 3: Upload PRDs
    const uploadSuccess = await uploadAllPRDs(projectId);
    if (!uploadSuccess) {
      logWarning('\nSome PRDs failed to upload, but continuing with setup...');
    }

    // Step 4: Verify project
    await verifyProject(projectId);

    // Step 5: Run health checks
    const healthChecksPassed = await runHealthChecks(projectId);

    // Summary
    log('\n' + '='.repeat(60), 'cyan');
    log('Setup Complete!', 'green');
    log('='.repeat(60), 'cyan');
    logInfo(`\nDemo Project ID: ${projectId}`);
    logInfo(`Project Name: ${DEMO_PROJECT_NAME}`);
    logInfo(`AI Model: ${DEMO_AI_MODEL}`);
    logInfo(`PRDs Uploaded: ${PRD_FILES.length}`);
    
    if (!healthChecksPassed) {
      logWarning('\nSome health checks failed. Please review the errors above.');
      logWarning('The demo may still work, but some features might not function correctly.');
    } else {
      logSuccess('\nAll health checks passed! Demo is ready.');
    }

    logInfo('\nNext steps:');
    logInfo('1. Open the application in your browser');
    logInfo('2. Navigate to the demo project');
    logInfo('3. Start generating test cases, test plans, and bug reports!');
    logInfo('\nTo reset the demo environment, run: node demo/reset.js\n');

  } catch (error) {
    logError(`\nSetup failed with error: ${error.message}`);
    logError(error.stack);
    process.exit(1);
  }
}

// Run setup
if (require.main === module) {
  main().catch(error => {
    logError(`Fatal error: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { main, checkServerHealth, createDemoProject, uploadAllPRDs };

