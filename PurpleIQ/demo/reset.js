#!/usr/bin/env node

/**
 * Demo Reset Script
 * 
 * This script resets the demo environment by:
 * 1. Finding and deleting the demo project
 * 2. Cleaning up uploaded documents
 * 3. Optionally resetting vector store
 * 4. Verifying reset completion
 * 
 * Usage: node demo/reset.js
 */

const fs = require('fs-extra');
const path = require('path');

// Use built-in fetch (Node 18+) or require node-fetch
let fetch;
try {
  // Try built-in fetch first (Node 18+)
  if (typeof globalThis.fetch === 'function') {
    fetch = globalThis.fetch;
  } else {
    // Fallback to node-fetch if available
    fetch = require('node-fetch');
  }
} catch (error) {
  // If node-fetch is not available, we'll need to install it or use alternative
  console.error('Error: fetch is not available. Please install node-fetch: npm install node-fetch');
  process.exit(1);
}

// Configuration
const API_BASE_URL = process.env.API_URL || 'http://localhost:5000';
const DEMO_PROJECT_NAME = 'Demo Project - E-Commerce Platform';

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
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    return response.ok;
  } catch (error) {
    return false;
  }
}

/**
 * Find demo project
 */
async function findDemoProject() {
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
    
    return demoProject;
  } catch (error) {
    logError(`Failed to fetch projects: ${error.message}`);
    return null;
  }
}

/**
 * Delete demo project
 */
async function deleteDemoProject(projectId) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    return true;
  } catch (error) {
    logError(`Failed to delete project: ${error.message}`);
    return false;
  }
}

/**
 * Clean up uploads directory
 */
async function cleanupUploads() {
  logStep(3, 'Cleaning up uploads directory...');
  
  try {
    const uploadsDir = path.join(__dirname, '../server/uploads');
    
    if (await fs.pathExists(uploadsDir)) {
      const files = await fs.readdir(uploadsDir);
      let deletedCount = 0;
      
      for (const file of files) {
        try {
          await fs.remove(path.join(uploadsDir, file));
          deletedCount++;
        } catch (error) {
          logWarning(`Failed to delete ${file}: ${error.message}`);
        }
      }
      
      if (deletedCount > 0) {
        logSuccess(`Cleaned up ${deletedCount} file(s) from uploads directory`);
      } else {
        logInfo('Uploads directory is already clean');
      }
    } else {
      logInfo('Uploads directory does not exist');
    }
    
    return true;
  } catch (error) {
    logWarning(`Failed to cleanup uploads: ${error.message}`);
    return false;
  }
}

/**
 * Clean up vector store (optional)
 */
async function cleanupVectorStore() {
  logStep(4, 'Cleaning up vector store...');
  
  try {
    // Vector store cleanup would depend on implementation
    // For now, we'll just log that it should be done manually if needed
    logInfo('Vector store cleanup may be needed manually');
    logInfo('Vector data is typically stored in: server/server/data/vectors/');
    
    const vectorsDir = path.join(__dirname, '../server/server/data/vectors');
    if (await fs.pathExists(vectorsDir)) {
      const files = await fs.readdir(vectorsDir);
      if (files.length > 0) {
        logWarning(`Vector store contains ${files.length} file(s)`);
        logInfo('To fully reset, you may need to manually clean the vector store');
      } else {
        logSuccess('Vector store is clean');
      }
    }
    
    return true;
  } catch (error) {
    logWarning(`Vector store cleanup check failed: ${error.message}`);
    return false;
  }
}

/**
 * Verify reset completion
 */
async function verifyReset() {
  logStep(5, 'Verifying reset...');
  
  try {
    const demoProject = await findDemoProject();
    
    if (demoProject) {
      logError('Demo project still exists!');
      return false;
    } else {
      logSuccess('Demo project successfully deleted');
      return true;
    }
  } catch (error) {
    logWarning(`Verification failed: ${error.message}`);
    return false;
  }
}

/**
 * Main reset function
 */
async function main() {
  log('\n' + '='.repeat(60), 'cyan');
  log('PurpleIQ Demo Reset Script', 'cyan');
  log('='.repeat(60) + '\n', 'cyan');

  // Check server health
  logStep(1, 'Checking server health...');
  const serverHealthy = await checkServerHealth();
  if (!serverHealthy) {
    logError('Server is not running or not accessible.');
    logInfo('Please start the server: cd server && npm start');
    logWarning('Continuing with reset (some operations may fail)...\n');
  } else {
    logSuccess('Server is running');
  }

  // Find demo project
  logStep(2, 'Finding demo project...');
  const demoProject = await findDemoProject();
  
  if (!demoProject) {
    logWarning('Demo project not found. Nothing to reset.');
    logInfo('The demo environment appears to be already reset.');
  } else {
    logInfo(`Found demo project: ${demoProject.projectName} (ID: ${demoProject.id})`);
    logInfo(`  Documents: ${demoProject.documents ? demoProject.documents.length : 0}`);
    
    // Delete demo project
    logStep(3, 'Deleting demo project...');
    const deleted = await deleteDemoProject(demoProject.id);
    
    if (deleted) {
      logSuccess('Demo project deleted successfully');
    } else {
      logError('Failed to delete demo project');
    }
  }

  // Clean up uploads
  await cleanupUploads();

  // Clean up vector store
  await cleanupVectorStore();

  // Verify reset
  if (serverHealthy) {
    const verified = await verifyReset();
    if (!verified && demoProject) {
      logError('\nReset incomplete. Some cleanup may have failed.');
      process.exit(1);
    }
  }

  // Summary
  log('\n' + '='.repeat(60), 'cyan');
  log('Reset Complete!', 'green');
  log('='.repeat(60), 'cyan');
  
  logInfo('\nThe demo environment has been reset.');
  logInfo('To set up the demo again, run: node demo/setup.js\n');
}

// Run reset
if (require.main === module) {
  main().catch(error => {
    logError(`Fatal error: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { main, findDemoProject, deleteDemoProject, cleanupUploads };

