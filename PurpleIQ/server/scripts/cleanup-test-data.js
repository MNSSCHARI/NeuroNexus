/**
 * Cleanup Test Data Script
 * Removes all test projects, vectors, uploads, and conversation history
 * 
 * Usage: node scripts/cleanup-test-data.js
 * Or: npm run cleanup
 */

const fs = require('fs-extra');
const path = require('path');

// Paths
const PROJECTS_FILE = path.join(__dirname, '../data/projects/projects.json');
const VECTORS_DIR = path.join(__dirname, '../server/data/vectors');
const UPLOADS_DIR = path.join(__dirname, '../uploads');
const DATA_DIR = path.join(__dirname, '../data');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Clean up projects
 */
async function cleanupProjects() {
  log('\n📁 Cleaning up projects...', 'cyan');
  
  if (!fs.existsSync(PROJECTS_FILE)) {
    log('  ✓ No projects.json found', 'green');
    return { deleted: 0, kept: 0 };
  }

  try {
    const data = await fs.readJson(PROJECTS_FILE);
    const projects = data.projects || [];
    
    // Filter test projects (Phase2 Test Project, Project 1, Project 2, etc.)
    const testProjectPatterns = [
      /^Phase2 Test Project$/i,
      /^Phase \d+ Test Project$/i,
      /^Test Project$/i,
      /^Project \d+$/i,
      /^Project [AB]$/i,
      /^E-Commerce Demo$/i,
      /^Banking App$/i,
      /^E-Commerce App$/i
    ];
    
    const productionProjects = projects.filter(p => {
      const name = p.projectName || '';
      return !testProjectPatterns.some(pattern => pattern.test(name));
    });
    
    const deletedCount = projects.length - productionProjects.length;
    
    if (deletedCount > 0) {
      await fs.writeJson(PROJECTS_FILE, {
        projects: productionProjects,
        updatedAt: new Date().toISOString()
      }, { spaces: 2 });
      
      log(`  ✓ Deleted ${deletedCount} test project(s)`, 'green');
      log(`  ✓ Kept ${productionProjects.length} production project(s)`, 'green');
    } else {
      log('  ✓ No test projects found', 'green');
    }
    
    return { deleted: deletedCount, kept: productionProjects.length };
  } catch (error) {
    log(`  ✗ Error cleaning projects: ${error.message}`, 'red');
    return { deleted: 0, kept: 0, error: error.message };
  }
}

/**
 * Clean up vector store files for deleted projects
 */
async function cleanupVectors(keptProjectIds = []) {
  log('\n🔍 Cleaning up vector store...', 'cyan');
  
  if (!fs.existsSync(VECTORS_DIR)) {
    log('  ✓ No vectors directory found', 'green');
    return { deleted: 0 };
  }

  try {
    const files = await fs.readdir(VECTORS_DIR);
    const vectorFiles = files.filter(f => f.endsWith('.json'));
    
    let deletedCount = 0;
    
    for (const file of vectorFiles) {
      const projectId = path.basename(file, '.json');
      
      // If we have a list of kept projects, only delete if not in list
      // Otherwise, delete all (assuming all are test data)
      if (keptProjectIds.length === 0 || !keptProjectIds.includes(projectId)) {
        const filePath = path.join(VECTORS_DIR, file);
        await fs.remove(filePath);
        deletedCount++;
      }
    }
    
    if (deletedCount > 0) {
      log(`  ✓ Deleted ${deletedCount} vector file(s)`, 'green');
    } else {
      log('  ✓ No vector files to delete', 'green');
    }
    
    return { deleted: deletedCount };
  } catch (error) {
    log(`  ✗ Error cleaning vectors: ${error.message}`, 'red');
    return { deleted: 0, error: error.message };
  }
}

/**
 * Clean up uploaded files
 */
async function cleanupUploads() {
  log('\n📄 Cleaning up uploaded files...', 'cyan');
  
  if (!fs.existsSync(UPLOADS_DIR)) {
    log('  ✓ No uploads directory found', 'green');
    return { deleted: 0 };
  }

  try {
    const files = await fs.readdir(UPLOADS_DIR);
    let deletedCount = 0;
    
    for (const file of files) {
      // Delete all files in uploads (they're temporary anyway)
      const filePath = path.join(UPLOADS_DIR, file);
      const stats = await fs.stat(filePath);
      
      if (stats.isFile()) {
        await fs.remove(filePath);
        deletedCount++;
      }
    }
    
    if (deletedCount > 0) {
      log(`  ✓ Deleted ${deletedCount} uploaded file(s)`, 'green');
    } else {
      log('  ✓ No uploaded files to delete', 'green');
    }
    
    return { deleted: deletedCount };
  } catch (error) {
    log(`  ✗ Error cleaning uploads: ${error.message}`, 'red');
    return { deleted: 0, error: error.message };
  }
}

/**
 * Get list of kept project IDs (for selective cleanup)
 */
async function getKeptProjectIds() {
  if (!fs.existsSync(PROJECTS_FILE)) {
    return [];
  }

  try {
    const data = await fs.readJson(PROJECTS_FILE);
    const projects = data.projects || [];
    
    const testProjectPatterns = [
      /^Phase2 Test Project$/i,
      /^Phase \d+ Test Project$/i,
      /^Test Project$/i,
      /^Project \d+$/i,
      /^Project [AB]$/i,
      /^E-Commerce Demo$/i,
      /^Banking App$/i,
      /^E-Commerce App$/i
    ];
    
    return projects
      .filter(p => {
        const name = p.projectName || '';
        return !testProjectPatterns.some(pattern => pattern.test(name));
      })
      .map(p => p.projectId);
  } catch (error) {
    return [];
  }
}

/**
 * Main cleanup function
 */
async function cleanupAll(options = {}) {
  const { 
    keepProduction = true,  // Keep production projects
    clearVectors = true,    // Clear vector store
    clearUploads = true,    // Clear uploads
    verbose = true          // Show detailed output
  } = options;

  log('\n╔════════════════════════════════════════════════════════╗', 'cyan');
  log('║          PURPLEIQ TEST DATA CLEANUP SCRIPT             ║', 'cyan');
  log('╚════════════════════════════════════════════════════════╝', 'cyan');

  const results = {
    projects: { deleted: 0, kept: 0 },
    vectors: { deleted: 0 },
    uploads: { deleted: 0 }
  };

  // Clean up projects
  if (keepProduction) {
    results.projects = await cleanupProjects();
    const keptIds = await getKeptProjectIds();
    
    // Clean up vectors for deleted projects only
    if (clearVectors) {
      results.vectors = await cleanupVectors(keptIds);
    }
  } else {
    // Delete ALL projects
    log('\n⚠️  DELETING ALL PROJECTS (including production)', 'yellow');
    if (fs.existsSync(PROJECTS_FILE)) {
      await fs.writeJson(PROJECTS_FILE, {
        projects: [],
        updatedAt: new Date().toISOString()
      }, { spaces: 2 });
      log('  ✓ Deleted all projects', 'green');
    }
    
    // Delete all vectors
    if (clearVectors) {
      results.vectors = await cleanupVectors([]);
    }
  }

  // Clean up uploads
  if (clearUploads) {
    results.uploads = await cleanupUploads();
  }

  // Summary
  log('\n╔════════════════════════════════════════════════════════╗', 'cyan');
  log('║                    CLEANUP SUMMARY                     ║', 'cyan');
  log('╚════════════════════════════════════════════════════════╝', 'cyan');
  
  log(`\n  Projects:`, 'blue');
  log(`    Deleted: ${results.projects.deleted}`, results.projects.deleted > 0 ? 'green' : 'reset');
  log(`    Kept: ${results.projects.kept}`, 'green');
  
  log(`\n  Vector Store:`, 'blue');
  log(`    Deleted: ${results.vectors.deleted} file(s)`, results.vectors.deleted > 0 ? 'green' : 'reset');
  
  log(`\n  Uploads:`, 'blue');
  log(`    Deleted: ${results.uploads.deleted} file(s)`, results.uploads.deleted > 0 ? 'green' : 'reset');
  
  const totalDeleted = results.projects.deleted + results.vectors.deleted + results.uploads.deleted;
  
  log(`\n  Total Items Deleted: ${totalDeleted}`, totalDeleted > 0 ? 'green' : 'yellow');
  log('\n✅ Cleanup complete!\n', 'green');

  return results;
}

// Run if called directly
if (require.main === module) {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const deleteAll = args.includes('--all') || args.includes('-a');
  const skipVectors = args.includes('--skip-vectors');
  const skipUploads = args.includes('--skip-uploads');

  cleanupAll({
    keepProduction: !deleteAll,
    clearVectors: !skipVectors,
    clearUploads: !skipUploads
  }).catch(error => {
    log(`\n❌ Cleanup failed: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  });
}

module.exports = { cleanupAll, cleanupProjects, cleanupVectors, cleanupUploads };

