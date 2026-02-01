/**
 * Setup Script for Killer Demo Scenarios
 * 
 * This script prepares the demo environment with projects and documents
 * for the three killer demo scenarios.
 * 
 * Usage: node demo/setup-scenarios.js
 */

const fetch = require('node-fetch');
const fs = require('fs-extra');
const path = require('path');
const FormData = require('form-data');

const API_BASE = 'http://localhost:5000/api';
const DEMO_DIR = path.join(__dirname, 'sample-prds');

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Create a project
 */
async function createProject(projectName, aiModel = 'openai', apiKey = process.env.OPENAI_API_KEY) {
  try {
    log(`\n📦 Creating project: ${projectName}...`, 'cyan');
    
    const response = await fetch(`${API_BASE}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectName,
        aiModel,
        apiKey
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create project');
    }

    const data = await response.json();
    log(`✅ Project created: ${data.project.projectId}`, 'green');
    return data.project;
  } catch (error) {
    log(`❌ Error creating project: ${error.message}`, 'red');
    throw error;
  }
}

/**
 * Upload a document to a project
 */
async function uploadDocument(projectId, filePath) {
  try {
    const fileName = path.basename(filePath);
    log(`  📄 Uploading: ${fileName}...`, 'yellow');

    if (!await fs.pathExists(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const formData = new FormData();
    formData.append('document', fs.createReadStream(filePath));

    const response = await fetch(`${API_BASE}/projects/${projectId}/documents`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to upload document');
    }

    const data = await response.json();
    log(`  ✅ Uploaded: ${fileName} (${data.document?.chunkCount || 0} chunks)`, 'green');
    return data;
  } catch (error) {
    log(`  ❌ Error uploading document: ${error.message}`, 'red');
    throw error;
  }
}

/**
 * Setup Scenario 1: Memory Proof
 */
async function setupScenario1() {
  log('\n🎯 Setting up SCENARIO 1: Memory Proof', 'bright');
  
  const project = await createProject('Login Module Demo');
  
  // Upload login module PRD
  const loginPRD = path.join(DEMO_DIR, 'login-module.txt');
  await uploadDocument(project.projectId, loginPRD);
  
  log(`\n✅ Scenario 1 ready!`, 'green');
  log(`   Project ID: ${project.projectId}`, 'cyan');
  log(`   Document: login-module.txt`, 'cyan');
  log(`   Next: Ask "Generate comprehensive test cases for the login module"`, 'yellow');
  
  return project;
}

/**
 * Setup Scenario 2: Multi-Format Power
 */
async function setupScenario2() {
  log('\n🎯 Setting up SCENARIO 2: Multi-Format Power', 'bright');
  
  const project = await createProject('Payment Gateway Demo');
  
  // Upload multiple documents
  const documents = [
    'payment-gateway.txt',
    // Note: If you have DOCX and additional TXT files, add them here
    // 'payment-acceptance-criteria.docx',
    // 'payment-edge-cases.txt'
  ];
  
  for (const docName of documents) {
    const docPath = path.join(DEMO_DIR, docName);
    if (await fs.pathExists(docPath)) {
      await uploadDocument(project.projectId, docPath);
    } else {
      log(`  ⚠️  File not found: ${docName} (skipping)`, 'yellow');
    }
  }
  
  log(`\n✅ Scenario 2 ready!`, 'green');
  log(`   Project ID: ${project.projectId}`, 'cyan');
  log(`   Documents: ${documents.join(', ')}`, 'cyan');
  log(`   Next: Ask "Generate comprehensive test cases using all uploaded documents"`, 'yellow');
  
  return project;
}

/**
 * Setup Scenario 3: Quality Improvement Loop
 */
async function setupScenario3() {
  log('\n🎯 Setting up SCENARIO 3: Quality Improvement Loop', 'bright');
  
  const project = await createProject('User Registration Demo');
  
  // Upload user registration PRD
  const registrationPRD = path.join(DEMO_DIR, 'user-registration.txt');
  await uploadDocument(project.projectId, registrationPRD);
  
  log(`\n✅ Scenario 3 ready!`, 'green');
  log(`   Project ID: ${project.projectId}`, 'cyan');
  log(`   Document: user-registration.txt`, 'cyan');
  log(`   Next: Ask "Generate test cases for user registration"`, 'yellow');
  
  return project;
}

/**
 * Main setup function
 */
async function main() {
  log('\n🚀 PurpleIQ Killer Demo Scenarios Setup', 'bright');
  log('==========================================\n', 'bright');
  
  // Check if server is running
  try {
    const healthCheck = await fetch(`${API_BASE}/health`);
    if (!healthCheck.ok) {
      throw new Error('Server health check failed');
    }
    log('✅ Server is running', 'green');
  } catch (error) {
    log('❌ Server is not running!', 'red');
    log('   Please start the server first: npm start (in server directory)', 'yellow');
    process.exit(1);
  }
  
  // Check API key
  if (!process.env.OPENAI_API_KEY) {
    log('⚠️  OPENAI_API_KEY not set in environment', 'yellow');
    log('   Using default (will need to be set in project settings)', 'yellow');
  }
  
  const scenarios = [];
  
  try {
    // Setup all three scenarios
    const scenario1 = await setupScenario1();
    scenarios.push({ name: 'Memory Proof', projectId: scenario1.projectId });
    
    const scenario2 = await setupScenario2();
    scenarios.push({ name: 'Multi-Format Power', projectId: scenario2.projectId });
    
    const scenario3 = await setupScenario3();
    scenarios.push({ name: 'Quality Improvement Loop', projectId: scenario3.projectId });
    
    // Save scenario info
    const scenarioInfo = {
      timestamp: new Date().toISOString(),
      scenarios: scenarios
    };
    
    const infoPath = path.join(__dirname, 'scenario-info.json');
    await fs.writeJson(infoPath, scenarioInfo, { spaces: 2 });
    
    log('\n🎉 All scenarios setup complete!', 'green');
    log('\n📋 Scenario Summary:', 'bright');
    scenarios.forEach((s, i) => {
      log(`   ${i + 1}. ${s.name}: ${s.projectId}`, 'cyan');
    });
    log(`\n📄 Scenario info saved to: ${infoPath}`, 'yellow');
    log('\n📖 See killer-demo-scenarios.md for detailed scripts', 'yellow');
    log('📝 See SCENARIO-PROMPTS.md for copy-paste prompts', 'yellow');
    
  } catch (error) {
    log(`\n❌ Setup failed: ${error.message}`, 'red');
    process.exit(1);
  }
}

// Run setup
main().catch(error => {
  log(`\n❌ Fatal error: ${error.message}`, 'red');
  process.exit(1);
});

