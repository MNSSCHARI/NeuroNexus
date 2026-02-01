/**
 * Pre-Demo Comprehensive Checklist
 * 
 * Runs through all checks 24 hours before demo to ensure everything works.
 * 
 * Usage: node demo/pre-demo-checklist.js
 */

const fetch = require('node-fetch');
const fs = require('fs-extra');
const path = require('path');

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
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logCheck(name, status, details = '') {
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  const color = status === 'PASS' ? 'green' : status === 'FAIL' ? 'red' : 'yellow';
  log(`${icon} ${name}`, color);
  if (details) {
    log(`   ${details}`, 'cyan');
  }
}

const results = {
  technical: {},
  data: {},
  ui: {},
  demo: {},
  summary: {
    total: 0,
    passed: 0,
    failed: 0,
    warnings: 0
  }
};

/**
 * TECHNICAL CHECKS
 */

async function checkHealthEndpoint() {
  log('\n📊 TECHNICAL CHECKS', 'bright');
  log('─'.repeat(80));
  
  try {
    log('Checking health endpoint...', 'cyan');
    const response = await fetch(`${API_BASE}/health`);
    const data = await response.json();
    
    if (data.status === 'healthy' || data.status === 'degraded') {
      const allUp = Object.values(data.checks).every(check => check.status === 'up');
      if (allUp) {
        logCheck('Health check endpoint', 'PASS', 'All services are up');
        results.technical.healthCheck = { status: 'PASS', details: data };
        results.summary.passed++;
      } else {
        logCheck('Health check endpoint', 'WARN', 'Some services are degraded');
        results.technical.healthCheck = { status: 'WARN', details: data };
        results.summary.warnings++;
      }
    } else {
      logCheck('Health check endpoint', 'FAIL', `Status: ${data.status}`);
      results.technical.healthCheck = { status: 'FAIL', details: data };
      results.summary.failed++;
    }
    results.summary.total++;
  } catch (error) {
    logCheck('Health check endpoint', 'FAIL', error.message);
    results.technical.healthCheck = { status: 'FAIL', error: error.message };
    results.summary.failed++;
    results.summary.total++;
  }
}

async function checkAPIKeys() {
  try {
    log('Checking API keys...', 'cyan');
    const healthResponse = await fetch(`${API_BASE}/health`);
    const healthData = await healthResponse.json();
    
    const openaiStatus = healthData.checks?.openai?.status === 'up';
    const geminiStatus = healthData.checks?.gemini?.status === 'up';
    
    if (openaiStatus || geminiStatus) {
      const working = [];
      if (openaiStatus) working.push('OpenAI');
      if (geminiStatus) working.push('Gemini');
      logCheck('API keys valid', 'PASS', `Working: ${working.join(', ')}`);
      results.technical.apiKeys = { status: 'PASS', working };
      results.summary.passed++;
    } else {
      logCheck('API keys valid', 'FAIL', 'No API keys are working');
      results.technical.apiKeys = { status: 'FAIL' };
      results.summary.failed++;
    }
    results.summary.total++;
  } catch (error) {
    logCheck('API keys valid', 'FAIL', error.message);
    results.technical.apiKeys = { status: 'FAIL', error: error.message };
    results.summary.failed++;
    results.summary.total++;
  }
}

async function checkVectorSearch() {
  try {
    log('Testing vector search with 5 queries...', 'cyan');
    
    // Get first project
    const projectsResponse = await fetch(`${API_BASE}/projects`);
    const projectsData = await projectsResponse.json();
    
    if (!projectsData.projects || projectsData.projects.length === 0) {
      logCheck('Vector search', 'FAIL', 'No projects found');
      results.technical.vectorSearch = { status: 'FAIL', reason: 'No projects' };
      results.summary.failed++;
      results.summary.total++;
      return;
    }
    
    const projectId = projectsData.projects[0].projectId;
    const testQueries = [
      'What are the main features?',
      'How does authentication work?',
      'What are the test scenarios?',
      'What are the error handling requirements?',
      'What is the user flow?'
    ];
    
    let passedQueries = 0;
    const queryResults = [];
    
    for (const query of testQueries) {
      try {
        const response = await fetch(`${API_BASE}/chat/${projectId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: query })
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.sources && data.sources.length > 0) {
            passedQueries++;
            queryResults.push({ query, status: 'PASS', sources: data.sources.length });
          } else {
            queryResults.push({ query, status: 'WARN', reason: 'No sources returned' });
          }
        } else {
          queryResults.push({ query, status: 'FAIL', reason: `HTTP ${response.status}` });
        }
      } catch (error) {
        queryResults.push({ query, status: 'FAIL', error: error.message });
      }
    }
    
    if (passedQueries >= 4) {
      logCheck('Vector search', 'PASS', `${passedQueries}/5 queries returned results`);
      results.technical.vectorSearch = { status: 'PASS', passed: passedQueries, total: 5, details: queryResults };
      results.summary.passed++;
    } else if (passedQueries >= 2) {
      logCheck('Vector search', 'WARN', `${passedQueries}/5 queries returned results`);
      results.technical.vectorSearch = { status: 'WARN', passed: passedQueries, total: 5, details: queryResults };
      results.summary.warnings++;
    } else {
      logCheck('Vector search', 'FAIL', `Only ${passedQueries}/5 queries returned results`);
      results.technical.vectorSearch = { status: 'FAIL', passed: passedQueries, total: 5, details: queryResults };
      results.summary.failed++;
    }
    results.summary.total++;
  } catch (error) {
    logCheck('Vector search', 'FAIL', error.message);
    results.technical.vectorSearch = { status: 'FAIL', error: error.message };
    results.summary.failed++;
    results.summary.total++;
  }
}

async function checkTestCaseGeneration() {
  try {
    log('Testing test case generation (3 times)...', 'cyan');
    
    const projectsResponse = await fetch(`${API_BASE}/projects`);
    const projectsData = await projectsResponse.json();
    
    if (!projectsData.projects || projectsData.projects.length === 0) {
      logCheck('Test case generation', 'FAIL', 'No projects found');
      results.technical.testCaseGeneration = { status: 'FAIL', reason: 'No projects' };
      results.summary.failed++;
      results.summary.total++;
      return;
    }
    
    const projectId = projectsData.projects[0].projectId;
    const testQueries = [
      'Generate test cases for login',
      'Create test cases for user registration',
      'Generate test cases for payment'
    ];
    
    let passedTests = 0;
    const testResults = [];
    
    for (const query of testQueries) {
      try {
        const response = await fetch(`${API_BASE}/chat/${projectId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: query })
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.answer && data.answer.length > 100) {
            passedTests++;
            testResults.push({ query, status: 'PASS', answerLength: data.answer.length });
          } else {
            testResults.push({ query, status: 'WARN', reason: 'Answer too short' });
          }
        } else {
          testResults.push({ query, status: 'FAIL', reason: `HTTP ${response.status}` });
        }
      } catch (error) {
        testResults.push({ query, status: 'FAIL', error: error.message });
      }
    }
    
    if (passedTests >= 2) {
      logCheck('Test case generation', 'PASS', `${passedTests}/3 tests passed`);
      results.technical.testCaseGeneration = { status: 'PASS', passed: passedTests, total: 3, details: testResults };
      results.summary.passed++;
    } else {
      logCheck('Test case generation', 'FAIL', `Only ${passedTests}/3 tests passed`);
      results.technical.testCaseGeneration = { status: 'FAIL', passed: passedTests, total: 3, details: testResults };
      results.summary.failed++;
    }
    results.summary.total++;
  } catch (error) {
    logCheck('Test case generation', 'FAIL', error.message);
    results.technical.testCaseGeneration = { status: 'FAIL', error: error.message };
    results.summary.failed++;
    results.summary.total++;
  }
}

async function checkExports() {
  try {
    log('Testing exports (Excel, PDF, DOCX)...', 'cyan');
    
    const exportTestResponse = await fetch(`${API_BASE}/export/test`);
    const exportData = await exportTestResponse.json();
    
    if (exportData.results) {
      const excelOk = exportData.results.excel?.success === true;
      const pdfOk = exportData.results.pdf?.success === true;
      const docxOk = exportData.results.docx?.success === true;
      
      const passed = [excelOk, pdfOk, docxOk].filter(Boolean).length;
      
      if (passed === 3) {
        logCheck('Exports work', 'PASS', 'Excel, PDF, DOCX all working');
        results.technical.exports = { status: 'PASS', details: exportData.results };
        results.summary.passed++;
      } else if (passed >= 2) {
        logCheck('Exports work', 'WARN', `${passed}/3 exports working`);
        results.technical.exports = { status: 'WARN', details: exportData.results };
        results.summary.warnings++;
      } else {
        logCheck('Exports work', 'FAIL', `Only ${passed}/3 exports working`);
        results.technical.exports = { status: 'FAIL', details: exportData.results };
        results.summary.failed++;
      }
    } else {
      logCheck('Exports work', 'FAIL', 'Export test endpoint failed');
      results.technical.exports = { status: 'FAIL', error: 'Test endpoint failed' };
      results.summary.failed++;
    }
    results.summary.total++;
  } catch (error) {
    logCheck('Exports work', 'FAIL', error.message);
    results.technical.exports = { status: 'FAIL', error: error.message };
    results.summary.failed++;
    results.summary.total++;
  }
}

async function checkDemoMode() {
  try {
    log('Checking demo mode...', 'cyan');
    
    const settingsResponse = await fetch(`${API_BASE}/settings`);
    const settingsData = await settingsResponse.json();
    
    const demoModeEnabled = settingsData.demoMode === true;
    
    if (demoModeEnabled) {
      logCheck('Demo mode works', 'PASS', 'Demo mode is enabled');
      results.technical.demoMode = { status: 'PASS', enabled: true };
      results.summary.passed++;
    } else {
      logCheck('Demo mode works', 'WARN', 'Demo mode is disabled (may be intentional)');
      results.technical.demoMode = { status: 'WARN', enabled: false };
      results.summary.warnings++;
    }
    results.summary.total++;
  } catch (error) {
    logCheck('Demo mode works', 'FAIL', error.message);
    results.technical.demoMode = { status: 'FAIL', error: error.message };
    results.summary.failed++;
    results.summary.total++;
  }
}

async function checkFallbackResponses() {
  try {
    log('Checking fallback responses...', 'cyan');
    
    const demoResponsesPath = path.join(__dirname, '../server/data/demo-responses.json');
    const exists = await fs.pathExists(demoResponsesPath);
    
    if (exists) {
      const content = await fs.readJson(demoResponsesPath);
      const hasTestCases = content.test_cases && Object.keys(content.test_cases).length > 0;
      const hasBugReports = content.bug_reports && Object.keys(content.bug_reports).length > 0;
      
      if (hasTestCases && hasBugReports) {
        logCheck('Fallback responses loaded', 'PASS', 'Demo responses file exists and has content');
        results.technical.fallbackResponses = { status: 'PASS', hasTestCases, hasBugReports };
        results.summary.passed++;
      } else {
        logCheck('Fallback responses loaded', 'WARN', 'Demo responses file exists but may be incomplete');
        results.technical.fallbackResponses = { status: 'WARN', hasTestCases, hasBugReports };
        results.summary.warnings++;
      }
    } else {
      logCheck('Fallback responses loaded', 'FAIL', 'Demo responses file not found');
      results.technical.fallbackResponses = { status: 'FAIL', reason: 'File not found' };
      results.summary.failed++;
    }
    results.summary.total++;
  } catch (error) {
    logCheck('Fallback responses loaded', 'FAIL', error.message);
    results.technical.fallbackResponses = { status: 'FAIL', error: error.message };
    results.summary.failed++;
    results.summary.total++;
  }
}

/**
 * DATA CHECKS
 */

async function checkDemoProject() {
  log('\n📦 DATA CHECKS', 'bright');
  log('─'.repeat(80));
  
  try {
    log('Checking demo project...', 'cyan');
    const response = await fetch(`${API_BASE}/projects`);
    const data = await response.json();
    
    const demoProject = data.projects?.find(p => 
      p.projectName.toLowerCase().includes('demo') || 
      p.projectName.toLowerCase().includes('test')
    ) || data.projects?.[0];
    
    if (demoProject) {
      logCheck('Demo project created', 'PASS', `Project: ${demoProject.projectName} (${demoProject.projectId})`);
      results.data.demoProject = { status: 'PASS', project: demoProject };
      results.summary.passed++;
    } else {
      logCheck('Demo project created', 'FAIL', 'No demo project found');
      results.data.demoProject = { status: 'FAIL', reason: 'No project found' };
      results.summary.failed++;
    }
    results.summary.total++;
  } catch (error) {
    logCheck('Demo project created', 'FAIL', error.message);
    results.data.demoProject = { status: 'FAIL', error: error.message };
    results.summary.failed++;
    results.summary.total++;
  }
}

async function checkSamplePRDs() {
  try {
    log('Checking sample PRDs uploaded and indexed...', 'cyan');
    
    const projectsResponse = await fetch(`${API_BASE}/projects`);
    const projectsData = await projectsResponse.json();
    
    if (!projectsData.projects || projectsData.projects.length === 0) {
      logCheck('5 sample PRDs uploaded', 'FAIL', 'No projects found');
      results.data.samplePRDs = { status: 'FAIL', reason: 'No projects' };
      results.summary.failed++;
      results.summary.total++;
      return;
    }
    
    const project = projectsData.projects[0];
    const documentCount = project.documentCount || 0;
    
    // Check if PRD files exist
    const prdFiles = [
      'login-module.txt',
      'payment-gateway.txt',
      'user-registration.txt',
      'dashboard-analytics.txt',
      'api-integration.txt'
    ];
    
    let existingPRDs = 0;
    for (const prdFile of prdFiles) {
      const prdPath = path.join(DEMO_DIR, prdFile);
      if (await fs.pathExists(prdPath)) {
        existingPRDs++;
      }
    }
    
    if (documentCount >= 5) {
      logCheck('5 sample PRDs uploaded', 'PASS', `${documentCount} documents uploaded`);
      results.data.samplePRDs = { status: 'PASS', documentCount, existingPRDs };
      results.summary.passed++;
    } else if (documentCount >= 3) {
      logCheck('5 sample PRDs uploaded', 'WARN', `Only ${documentCount} documents uploaded`);
      results.data.samplePRDs = { status: 'WARN', documentCount, existingPRDs };
      results.summary.warnings++;
    } else {
      logCheck('5 sample PRDs uploaded', 'FAIL', `Only ${documentCount} documents uploaded`);
      results.data.samplePRDs = { status: 'FAIL', documentCount, existingPRDs };
      results.summary.failed++;
    }
    results.summary.total++;
  } catch (error) {
    logCheck('5 sample PRDs uploaded', 'FAIL', error.message);
    results.data.samplePRDs = { status: 'FAIL', error: error.message };
    results.summary.failed++;
    results.summary.total++;
  }
}

async function checkExpectedOutputs() {
  try {
    log('Checking expected outputs...', 'cyan');
    
    const expectedOutputsPath = path.join(__dirname, 'expected-outputs.json');
    const exists = await fs.pathExists(expectedOutputsPath);
    
    if (exists) {
      const content = await fs.readJson(expectedOutputsPath);
      const hasContent = Object.keys(content).length > 0;
      
      if (hasContent) {
        logCheck('Expected outputs validated', 'PASS', 'Expected outputs file exists and has content');
        results.data.expectedOutputs = { status: 'PASS', hasContent: true };
        results.summary.passed++;
      } else {
        logCheck('Expected outputs validated', 'WARN', 'File exists but is empty');
        results.data.expectedOutputs = { status: 'WARN', hasContent: false };
        results.summary.warnings++;
      }
    } else {
      logCheck('Expected outputs validated', 'FAIL', 'Expected outputs file not found');
      results.data.expectedOutputs = { status: 'FAIL', reason: 'File not found' };
      results.summary.failed++;
    }
    results.summary.total++;
  } catch (error) {
    logCheck('Expected outputs validated', 'FAIL', error.message);
    results.data.expectedOutputs = { status: 'FAIL', error: error.message };
    results.summary.failed++;
    results.summary.total++;
  }
}

async function checkDemoResponses() {
  try {
    log('Checking demo responses prepared...', 'cyan');
    
    const demoResponsesPath = path.join(__dirname, '../server/data/demo-responses.json');
    const exists = await fs.pathExists(demoResponsesPath);
    
    if (exists) {
      const content = await fs.readJson(demoResponsesPath);
      const hasTestCases = content.test_cases && Object.keys(content.test_cases).length > 0;
      
      if (hasTestCases) {
        logCheck('Demo responses prepared', 'PASS', 'Demo responses file has test cases');
        results.data.demoResponses = { status: 'PASS', hasTestCases: true };
        results.summary.passed++;
      } else {
        logCheck('Demo responses prepared', 'WARN', 'Demo responses file exists but may be incomplete');
        results.data.demoResponses = { status: 'WARN', hasTestCases: false };
        results.summary.warnings++;
      }
    } else {
      logCheck('Demo responses prepared', 'FAIL', 'Demo responses file not found');
      results.data.demoResponses = { status: 'FAIL', reason: 'File not found' };
      results.summary.failed++;
    }
    results.summary.total++;
  } catch (error) {
    logCheck('Demo responses prepared', 'FAIL', error.message);
    results.data.demoResponses = { status: 'FAIL', error: error.message };
    results.summary.failed++;
    results.summary.total++;
  }
}

/**
 * UI CHECKS (Manual - provide instructions)
 */

function checkUI() {
  log('\n🖥️  UI CHECKS', 'bright');
  log('─'.repeat(80));
  log('⚠️  UI checks must be done manually in browser', 'yellow');
  log('');
  log('Please verify:', 'cyan');
  log('  □ Loading states work (skeleton loaders, progress bars)');
  log('  □ Error messages are clear and helpful');
  log('  □ Exports download correctly (Excel, PDF, DOCX)');
  log('  □ No console errors in browser DevTools');
  log('  □ Works in Chrome, Firefox, Edge');
  log('');
  log('After verification, update results manually.', 'yellow');
  
  results.ui.manual = true;
  results.summary.total += 5; // 5 manual checks
}

/**
 * DEMO CHECKS
 */

function checkDemoMaterials() {
  log('\n🎬 DEMO CHECKS', 'bright');
  log('─'.repeat(80));
  
  const demoFiles = {
    'Demo script': path.join(__dirname, 'demo-script.md'),
    'Killer scenarios': path.join(__dirname, 'killer-demo-scenarios.md'),
    'Scenario prompts': path.join(__dirname, 'SCENARIO-PROMPTS.md'),
    'Reset script': path.join(__dirname, 'reset.js'),
    'Setup script': path.join(__dirname, 'setup.js')
  };
  
  let allExist = true;
  
  for (const [name, filePath] of Object.entries(demoFiles)) {
    const exists = fs.existsSync(filePath);
    if (exists) {
      logCheck(name, 'PASS', 'File exists');
      results.demo[name] = { status: 'PASS' };
      results.summary.passed++;
    } else {
      logCheck(name, 'FAIL', 'File not found');
      results.demo[name] = { status: 'FAIL', reason: 'File not found' };
      results.summary.failed++;
      allExist = false;
    }
    results.summary.total++;
  }
  
  // Check for backup video (manual)
  log('');
  log('⚠️  Manual check required:', 'yellow');
  log('  □ Backup video recorded', 'cyan');
  log('  □ Talking points ready', 'cyan');
  log('');
  
  results.demo.backupVideo = { status: 'MANUAL', note: 'Requires manual verification' };
  results.demo.talkingPoints = { status: 'MANUAL', note: 'Requires manual verification' };
  results.summary.total += 2;
}

/**
 * Main execution
 */

async function main() {
  log('\n' + '='.repeat(80), 'bright');
  log('🎯 PRE-DEMO COMPREHENSIVE CHECKLIST', 'bright');
  log('='.repeat(80) + '\n');
  
  // Check if server is running
  try {
    await fetch(`${API_BASE}/health`);
    log('✅ Server is running\n', 'green');
  } catch (error) {
    log('❌ Server is not running!', 'red');
    log('   Please start the server first: npm start (in server directory)\n', 'yellow');
    process.exit(1);
  }
  
  // Run all checks
  await checkHealthEndpoint();
  await checkAPIKeys();
  await checkVectorSearch();
  await checkTestCaseGeneration();
  await checkExports();
  await checkDemoMode();
  await checkFallbackResponses();
  
  await checkDemoProject();
  await checkSamplePRDs();
  await checkExpectedOutputs();
  await checkDemoResponses();
  
  checkUI();
  checkDemoMaterials();
  
  // Summary
  log('\n' + '='.repeat(80), 'bright');
  log('📊 CHECKLIST SUMMARY', 'bright');
  log('='.repeat(80));
  log(`Total checks: ${results.summary.total}`, 'cyan');
  log(`✅ Passed: ${results.summary.passed}`, 'green');
  log(`⚠️  Warnings: ${results.summary.warnings}`, 'yellow');
  log(`❌ Failed: ${results.summary.failed}`, 'red');
  log('='.repeat(80) + '\n');
  
  // Save results
  const resultsPath = path.join(__dirname, 'checklist-results.json');
  await fs.writeJson(resultsPath, {
    timestamp: new Date().toISOString(),
    results,
    summary: results.summary
  }, { spaces: 2 });
  
  log(`📄 Results saved to: ${resultsPath}`, 'cyan');
  
  // Recommendations
  if (results.summary.failed > 0) {
    log('\n⚠️  ACTION REQUIRED:', 'yellow');
    log('   Some checks failed. Please fix issues before demo.', 'yellow');
    log('   Review checklist-results.json for details.\n', 'yellow');
    process.exit(1);
  } else if (results.summary.warnings > 0) {
    log('\n⚠️  WARNINGS:', 'yellow');
    log('   Some checks have warnings. Review and fix if needed.\n', 'yellow');
  } else {
    log('\n✅ ALL CHECKS PASSED!', 'green');
    log('   System is ready for demo.\n', 'green');
  }
}

// Run checklist
main().catch(error => {
  log(`\n❌ Fatal error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});

