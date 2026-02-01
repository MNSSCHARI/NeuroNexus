/**
 * Test script to verify Gemini embeddings are working
 * Run this to test: node test-embeddings.js
 */

require('dotenv').config();
const embeddingService = require('./services/EmbeddingService');

async function testEmbeddings() {
  console.log('\n🧪 Testing Gemini Embeddings...\n');
  
  // Check if GEMINI_API_KEY is set
  if (!process.env.GEMINI_API_KEY) {
    console.error('❌ ERROR: GEMINI_API_KEY is not set in .env file!');
    console.error('   Please set GEMINI_API_KEY in your .env file');
    process.exit(1);
  }
  
  console.log('✅ GEMINI_API_KEY is set');
  console.log(`   Key: ${process.env.GEMINI_API_KEY.substring(0, 10)}...${process.env.GEMINI_API_KEY.substring(process.env.GEMINI_API_KEY.length - 4)}\n`);
  
  // Test embedding generation
  const testTexts = [
    'This is a test document for login functionality',
    'User authentication and authorization',
    'Password reset and recovery flow'
  ];
  
  console.log(`📊 Testing with ${testTexts.length} sample texts...\n`);
  
  try {
    const startTime = Date.now();
    const embeddings = await embeddingService.generateEmbeddings(testTexts);
    const duration = Date.now() - startTime;
    
    console.log(`\n✅ SUCCESS! Generated ${embeddings.length} embeddings in ${duration}ms`);
    console.log(`   Embedding dimensions: ${embeddings[0]?.length || 'N/A'}`);
    console.log(`   Sample embedding (first 5 values): [${embeddings[0]?.slice(0, 5).map(v => v.toFixed(4)).join(', ')}...]`);
    
    console.log('\n🎉 Gemini embeddings are working correctly!');
    console.log('   You can now upload documents to your projects.\n');
    
  } catch (error) {
    console.error('\n❌ ERROR: Failed to generate embeddings');
    console.error(`   Error: ${error.message}`);
    console.error('\n   Please check:');
    console.error('   1. GEMINI_API_KEY is valid');
    console.error('   2. You have internet connection');
    console.error('   3. Gemini API is accessible');
    console.error('   4. You have quota/credits available\n');
    process.exit(1);
  }
}

// Run the test
testEmbeddings().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

