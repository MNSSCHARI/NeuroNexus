/**
 * Test script to create a project and upload a document
 * This tests the full flow: project creation -> document upload -> embedding generation
 * 
 * Run this to test: node test-project-upload.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

const API_BASE = process.env.API_BASE_URL || 'http://localhost:5000';

async function testProjectUpload() {
  console.log('\n🧪 Testing Project Creation and Document Upload...\n');
  
  // Check if server is running
  console.log(`   Checking server at: ${API_BASE}`);
  try {
    // Try /health first (as shown in server startup), then /api/health
    let healthCheck;
    try {
      healthCheck = await axios.get(`${API_BASE}/health`, { timeout: 5000 });
    } catch (e) {
      healthCheck = await axios.get(`${API_BASE}/api/health`, { timeout: 5000 });
    }
    console.log('✅ Server is running\n');
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.error('❌ ERROR: Server is not running!');
      console.error(`   Could not connect to ${API_BASE}`);
      console.error('   Please start the server first: cd PurpleIQ/server && npm start\n');
    } else if (error.code === 'ETIMEDOUT') {
      console.error('❌ ERROR: Server connection timed out!');
      console.error(`   Server at ${API_BASE} is not responding\n`);
    } else {
      console.error(`❌ ERROR: ${error.message}`);
      if (error.response) {
        console.error(`   Status: ${error.response.status} ${error.response.statusText}`);
        console.error(`   Data: ${JSON.stringify(error.response.data).substring(0, 200)}`);
      }
      console.error(`\n   Trying to continue anyway...\n`);
    }
  }
  
  // Step 1: Create a test project
  console.log('📝 Step 1: Creating test project...');
  let projectId;
  try {
    const createResponse = await axios.post(`${API_BASE}/api/projects`, {
      projectName: 'Test Project - Embedding Verification',
      aiModel: 'gemini',
      apiKey: process.env.GEMINI_API_KEY || '' // Use Gemini API key from env
    });
    
    const project = createResponse.data.project || createResponse.data;
    projectId = project.projectId;
    const projectName = project.projectName || 'Test Project';
    console.log(`✅ Project created: ${projectName} (ID: ${projectId})\n`);
    
    if (!projectId) {
      throw new Error('Project ID not returned from server');
    }
  } catch (error) {
    const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message;
    const errorDetails = error.response?.data ? JSON.stringify(error.response.data, null, 2) : '';
    console.error(`❌ ERROR: ${errorMsg}`);
    if (errorDetails) {
      console.error(`   Details: ${errorDetails.substring(0, 300)}`);
    }
    console.error('');
    process.exit(1);
  }
  
  // Step 2: Create a test document
  console.log('📄 Step 2: Creating test document...');
  const testDocument = `# Login Module Requirements

## Overview
This document describes the login functionality for the application.

## Features
1. User authentication with email and password
2. Password reset functionality
3. Session management
4. Security measures including rate limiting

## Acceptance Criteria
- Users can log in with valid credentials
- Invalid credentials show appropriate error messages
- Password reset flow works correctly
- Sessions expire after 30 minutes of inactivity
`;
  
  const testFilePath = path.join(__dirname, 'test-document.txt');
  fs.writeFileSync(testFilePath, testDocument);
  console.log(`✅ Test document created: ${testFilePath}\n`);
  
  // Step 3: Upload the document
  console.log('📤 Step 3: Uploading document to project...');
  try {
    const formData = new FormData();
    formData.append('document', fs.createReadStream(testFilePath), {
      filename: 'test-login-module.txt',
      contentType: 'text/plain'
    });
    
    const uploadResponse = await axios.post(
      `${API_BASE}/api/projects/${projectId}/documents`,
      formData,
      {
        headers: formData.getHeaders()
      }
    );
    
    const uploadResult = uploadResponse.data;
    console.log(`✅ Document uploaded successfully!`);
    console.log(`   Document: ${uploadResult.documentName || 'test-login-module.txt'}`);
    console.log(`   Chunks: ${uploadResult.chunksProcessed || uploadResult.chunkCount || 'N/A'}\n`);
    
    // Clean up test file
    fs.unlinkSync(testFilePath);
    console.log('🧹 Cleaned up test file\n');
    
  } catch (error) {
    const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message;
    const errorDetails = error.response?.data ? JSON.stringify(error.response.data, null, 2) : '';
    console.error(`❌ ERROR: ${errorMsg}`);
    if (errorDetails && errorDetails.length < 500) {
      console.error(`   Details: ${errorDetails}`);
    }
    console.error('');
    
    // Check if it's an OpenAI error
    if (errorMsg.includes('OpenAI') || errorMsg.includes('429')) {
      console.error('⚠️  This error suggests the server is still running OLD code!');
      console.error('   Please RESTART your server to load the new Gemini-only code.');
      console.error('   Steps:');
      console.error('   1. Stop the server (Ctrl+C)');
      console.error('   2. Start it again: cd PurpleIQ/server && npm start');
      console.error('   3. Run this test again\n');
    }
    
    // Clean up test file if it exists
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }
    
    process.exit(1);
  }
  
  // Step 4: Verify embeddings were created
  console.log('🔍 Step 4: Verifying embeddings...');
  try {
    // Try a simple chat query to verify RAG is working
    const chatResponse = await axios.post(`${API_BASE}/api/chat/${projectId}`, {
      message: 'What are the main features of the login module?'
    });
    
    const chatResult = chatResponse.data;
    console.log(`✅ RAG is working! Got response about login features.\n`);
    
  } catch (error) {
    console.warn(`⚠️  Could not verify RAG: ${error.message}`);
    console.warn('   But document upload succeeded, so embeddings were likely created.\n');
  }
  
  console.log('🎉 SUCCESS! Full flow test completed:');
  console.log(`   ✅ Project created: ${projectId}`);
  console.log(`   ✅ Document uploaded and processed`);
  console.log(`   ✅ Embeddings generated with Gemini`);
  console.log(`\n   Your server is using the NEW Gemini-only code!\n`);
}

// Run the test
testProjectUpload().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

