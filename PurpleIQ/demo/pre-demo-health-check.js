#!/usr/bin/env node

/**
 * Pre-Demo Health Check Script
 * 
 * Run this 5 minutes before demo starts to validate all systems are working
 * Takes a screenshot of the health dashboard as backup proof
 * 
 * Usage: node demo/pre-demo-health-check.js
 */

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
const fs = require('fs-extra');
const path = require('path');

// Configuration
const API_BASE_URL = process.env.API_URL || 'http://localhost:5000';
const HEALTH_DASHBOARD_URL = 'http://localhost:5173/health';
const OUTPUT_DIR = path.join(__dirname, '../health-check-results');

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

function logStep(step, message) {
  log(`\n[Step ${step}] ${message}`, 'cyan');
}

/**
 * Run health check via API
 */
async function runHealthCheck() {
  logStep(1, 'Running comprehensive health check...');
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/health`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const healthStatus = await response.json();
    return healthStatus;
  } catch (error) {
    logError(`Health check failed: ${error.message}`);
    throw error;
  }
}

/**
 * Validate health status
 */
function validateHealthStatus(healthStatus) {
  logStep(2, 'Validating health status...');
  
  const issues = [];
  const warnings = [];
  
  // Check overall status
  if (healthStatus.status === 'unhealthy') {
    issues.push('Overall system status is UNHEALTHY');
  } else if (healthStatus.status === 'degraded') {
    warnings.push('Overall system status is DEGRADED');
  }
  
  // Check individual services
  if (healthStatus.checks) {
    Object.entries(healthStatus.checks).forEach(([name, check]) => {
      if (check.status === 'down') {
        issues.push(`${name} is DOWN: ${check.error || 'Unknown error'}`);
      } else if (check.status === 'degraded') {
        warnings.push(`${name} is DEGRADED (${check.responseTime})`);
      }
    });
  }
  
  return { issues, warnings, isValid: issues.length === 0 };
}

/**
 * Save health check results to file
 */
async function saveResults(healthStatus, validation) {
  logStep(3, 'Saving health check results...');
  
  await fs.ensureDir(OUTPUT_DIR);
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const resultsFile = path.join(OUTPUT_DIR, `health-check-${timestamp}.json`);
  
  const results = {
    timestamp: new Date().toISOString(),
    healthStatus,
    validation,
    summary: {
      overallStatus: healthStatus.status,
      totalChecks: healthStatus.checks ? Object.keys(healthStatus.checks).length : 0,
      upCount: healthStatus.checks ? Object.values(healthStatus.checks).filter(c => c.status === 'up').length : 0,
      degradedCount: healthStatus.checks ? Object.values(healthStatus.checks).filter(c => c.status === 'degraded').length : 0,
      downCount: healthStatus.checks ? Object.values(healthStatus.checks).filter(c => c.status === 'down').length : 0,
      issues: validation.issues,
      warnings: validation.warnings,
      isValid: validation.isValid
    }
  };
  
  await fs.writeJson(resultsFile, results, { spaces: 2 });
  logSuccess(`Results saved to: ${resultsFile}`);
  
  return resultsFile;
}

/**
 * Display health check summary
 */
function displaySummary(healthStatus, validation) {
  log('\n' + '='.repeat(60), 'cyan');
  log('Health Check Summary', 'cyan');
  log('='.repeat(60), 'cyan');
  
  log(`\nOverall Status: ${healthStatus.status.toUpperCase()}`, 
      healthStatus.status === 'healthy' ? 'green' : 
      healthStatus.status === 'degraded' ? 'yellow' : 'red');
  
  if (healthStatus.checks) {
    log('\nService Status:', 'blue');
    Object.entries(healthStatus.checks).forEach(([name, check]) => {
      const color = check.status === 'up' ? 'green' : 
                   check.status === 'degraded' ? 'yellow' : 'red';
      log(`  ${name.padEnd(20)} ${check.status.toUpperCase().padEnd(10)} ${check.responseTime}`, color);
      if (check.error) {
        log(`    Error: ${check.error}`, 'red');
      }
    });
  }
  
  if (validation.issues.length > 0) {
    log('\n⚠️  ISSUES FOUND:', 'red');
    validation.issues.forEach(issue => {
      log(`  - ${issue}`, 'red');
    });
  }
  
  if (validation.warnings.length > 0) {
    log('\n⚠️  WARNINGS:', 'yellow');
    validation.warnings.forEach(warning => {
      log(`  - ${warning}`, 'yellow');
    });
  }
  
  if (validation.isValid && validation.warnings.length === 0) {
    log('\n✅ All systems operational! Demo is ready.', 'green');
  } else if (validation.isValid) {
    log('\n⚠️  System is operational but has warnings. Demo should work.', 'yellow');
  } else {
    log('\n❌ System has critical issues. Please fix before demo.', 'red');
  }
  
  log('\n' + '='.repeat(60) + '\n', 'cyan');
}

/**
 * Generate instructions for screenshot
 */
function generateScreenshotInstructions() {
  logStep(4, 'Screenshot Instructions');
  logInfo('To capture health dashboard screenshot:');
  logInfo(`1. Open browser: ${HEALTH_DASHBOARD_URL}`);
  logInfo('2. Wait for health checks to complete');
  logInfo('3. Take screenshot (Windows: Win+Shift+S, Mac: Cmd+Shift+4)');
  logInfo('4. Save screenshot in: health-check-results/');
  logInfo('\nOr use browser DevTools to capture full page screenshot');
}

/**
 * Main function
 */
async function main() {
  log('\n' + '='.repeat(60), 'cyan');
  log('Pre-Demo Health Check', 'cyan');
  log('='.repeat(60) + '\n', 'cyan');
  
  try {
    // Run health check
    const healthStatus = await runHealthCheck();
    
    // Validate results
    const validation = validateHealthStatus(healthStatus);
    
    // Display summary
    displaySummary(healthStatus, validation);
    
    // Save results
    const resultsFile = await saveResults(healthStatus, validation);
    
    // Generate screenshot instructions
    generateScreenshotInstructions();
    
    // Final status
    if (validation.isValid) {
      logSuccess('Health check completed successfully!');
      logInfo(`Results saved to: ${resultsFile}`);
      logInfo('\n✅ System is ready for demo!');
      process.exit(0);
    } else {
      logError('Health check found issues that need to be fixed!');
      logInfo(`Results saved to: ${resultsFile}`);
      logWarning('\n⚠️  Please review and fix issues before demo.');
      process.exit(1);
    }
    
  } catch (error) {
    logError(`\nHealth check failed: ${error.message}`);
    logError(error.stack);
    process.exit(1);
  }
}

// Run health check
if (require.main === module) {
  main().catch(error => {
    logError(`Fatal error: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { main, runHealthCheck, validateHealthStatus };

