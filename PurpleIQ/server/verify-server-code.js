/**
 * Script to verify the server is running the NEW Gemini-only code
 * This checks the /api/embedding-rate-limit-status endpoint
 */

require('dotenv').config();
const axios = require('axios');

const API_BASE = process.env.API_BASE_URL || 'http://localhost:5000';

async function verifyServerCode() {
  console.log('\n🔍 Verifying Server Code Version...\n');
  console.log(`   Checking server at: ${API_BASE}\n`);
  
  try {
    // Check embedding rate limit status - new code has this endpoint
    const statusResponse = await axios.get(`${API_BASE}/api/embedding-rate-limit-status`, {
      timeout: 5000
    });
    
    const status = statusResponse.data;
    console.log('✅ Server is running NEW code!');
    console.log(`   Embedding provider: ${status.gemini ? 'Gemini' : 'Unknown'}`);
    if (status.note) {
      console.log(`   Note: ${status.note}`);
    }
    console.log('\n🎉 Your server is using the Gemini-only embedding code!\n');
    
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.error('❌ ERROR: Server is not running!');
      console.error(`   Could not connect to ${API_BASE}\n`);
    } else if (error.response?.status === 404) {
      console.error('⚠️  WARNING: Server is running OLD code!');
      console.error('   The /api/embedding-rate-limit-status endpoint does not exist.');
      console.error('   This means the server is using cached old code.');
      console.error('\n   SOLUTION:');
      console.error('   1. Stop the server (Ctrl+C)');
      console.error('   2. Clear Node.js module cache (optional):');
      console.error('      - Close all Node.js processes');
      console.error('      - Or restart your computer');
      console.error('   3. Start the server again: cd PurpleIQ/server && npm start');
      console.error('   4. Run this verification again\n');
    } else {
      console.error(`❌ ERROR: ${error.message}`);
      if (error.response) {
        console.error(`   Status: ${error.response.status}`);
        console.error(`   Data: ${JSON.stringify(error.response.data).substring(0, 200)}`);
      }
      console.error('');
    }
    process.exit(1);
  }
}

verifyServerCode().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

