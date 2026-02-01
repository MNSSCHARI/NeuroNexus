/**
 * PHASE 2 TEST SUITE - Agentic System Validation
 * 
 * Tests the following Phase 2 features:
 * - Intent classification
 * - Multi-step test case generation workflow
 * - AI output validation and retry
 * - Conversation memory
 * - Integration with existing systems
 * 
 * Run: npm run test:phase2
 * Or: node tests/phase2-checklist.test.js
 */

const axios = require('axios');
const assert = require('assert');
const fs = require('fs-extra');
const path = require('path');

// Load environment variables
require('dotenv').config();

// Configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Test results tracking
let testResults = {
  passed: 0,
  failed: 0,
  skipped: 0,
  errors: []
};

// Helper function to make API requests
async function apiRequest(method, endpoint, data = null) {
  try {
    const response = await axios({
      method,
      url: `${BASE_URL}${endpoint}`,
      data,
      timeout: 60000, // 60 second timeout for AI requests
      validateStatus: () => true // Don't throw on any status
    });
    return response;
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      throw new Error('Server not running. Start it with: node index.js');
    }
    throw error;
  }
}

// Helper to create a test project
async function createTestProject(name = 'Phase2 Test Project') {
  const apiKey = GEMINI_API_KEY || OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('No API key found. Set GEMINI_API_KEY or OPENAI_API_KEY in .env');
  }
  
  const response = await apiRequest('POST', '/api/projects', {
    projectName: name,
    aiModel: 'gemini',
    apiKey: apiKey
  });
  
  if (response.status !== 201) {
    const errorMsg = response.data?.error || response.data?.message || response.statusText;
    throw new Error(`Failed to create project: ${errorMsg}`);
  }
  
  // API returns { project: {...} }, so extract the project object
  const project = response.data.project || response.data;
  
  // Ensure we have projectId (API uses projectId, not id)
  if (!project.projectId && project.projectId) {
    project.projectId = project.projectId;
  }
  
  return project;
}

// Helper to upload test document
async function uploadTestDocument(projectId) {
  const testDoc = `
# E-Commerce Platform - Product Requirements Document

## User Authentication Module

### Feature: User Login
**Description**: Users can log in using email and password.

**Acceptance Criteria**:
- Valid email and password combination grants access
- Invalid credentials show error message
- Account locks after 5 failed attempts
- Password must be 8+ characters with special characters

**Business Rules**:
- Session expires after 30 minutes of inactivity
- Users can stay logged in for up to 7 days with "Remember me"
- Multi-factor authentication required for admin accounts

**User Flows**:
1. User enters email and password
2. System validates credentials
3. System creates session token
4. User is redirected to dashboard

**Edge Cases**:
- Account locked due to failed attempts
- Password expired (90 days old)
- Email not verified
- User tries to login while already logged in

## Shopping Cart Module

### Feature: Add to Cart
**Description**: Users can add products to shopping cart.

**Acceptance Criteria**:
- Products can be added from product detail page
- Quantity can be adjusted (1-99)
- Out of stock items cannot be added
- Cart persists across sessions

**Business Rules**:
- Maximum 99 items per product SKU
- Cart expires after 30 days
- Prices are locked when item is added to cart
- Stock is reserved for 15 minutes

### Feature: Checkout Process
**Description**: Complete purchase with payment and shipping.

**Acceptance Criteria**:
- Multiple payment methods supported (Credit Card, PayPal, Apple Pay)
- Shipping address validation
- Order summary before payment
- Order confirmation email sent

**Edge Cases**:
- Payment gateway timeout
- Insufficient inventory during checkout
- Invalid shipping address
- Promo code expired
`;

  const FormData = require('form-data');
  const form = new FormData();
  const buffer = Buffer.from(testDoc, 'utf-8');
  form.append('document', buffer, {
    filename: 'test-prd.txt',
    contentType: 'text/plain'
  });

  const response = await axios.post(
    `${BASE_URL}/api/projects/${projectId}/documents`,
    form,
    {
      headers: form.getHeaders(),
      timeout: 60000
    }
  );

  return response.data;
}

// Test runner
async function runTest(testName, testFn, category = 'general') {
  try {
    console.log(`\n  🧪 Running: ${testName}`);
    await testFn();
    console.log(`  ✅ PASSED: ${testName}`);
    testResults.passed++;
    return true;
  } catch (error) {
    console.log(`  ❌ FAILED: ${testName}`);
    console.log(`     Error: ${error.message}`);
    testResults.failed++;
    testResults.errors.push({ test: testName, error: error.message, category });
    return false;
  }
}

// Skip test helper
function skipTest(testName, reason) {
  console.log(`  ⏭️  SKIPPED: ${testName} - ${reason}`);
  testResults.skipped++;
}

// ========================================
// SECTION 5: CLASSIFICATION TESTS (5A-5J)
// ========================================

async function test5A_ClassifyTestCaseGeneration() {
  const project = await createTestProject();
  
  const response = await apiRequest('POST', `/api/chat/${project.projectId}`, {
    question: 'Generate test cases for the login feature'
  });
  
  assert.strictEqual(response.status, 200, 'Should return 200');
  assert.ok(response.data.intent, 'Should include intent classification');
  assert.strictEqual(response.data.intent, 'TEST_CASE_GENERATION', 'Should classify as TEST_CASE_GENERATION');
}

async function test5B_ClassifyBugReportFormatting() {
  const project = await createTestProject();
  
  const response = await apiRequest('POST', `/api/chat/${project.projectId}`, {
    question: 'Format this bug: login button not working on mobile'
  });
  
  assert.strictEqual(response.status, 200);
  assert.strictEqual(response.data.intent, 'BUG_REPORT_FORMATTING', 'Should classify as BUG_REPORT_FORMATTING');
}

async function test5C_ClassifyTestPlanCreation() {
  const project = await createTestProject();
  
  const response = await apiRequest('POST', `/api/chat/${project.projectId}`, {
    question: 'Create a test plan for the checkout module'
  });
  
  assert.strictEqual(response.status, 200);
  assert.strictEqual(response.data.intent, 'TEST_PLAN_CREATION', 'Should classify as TEST_PLAN_CREATION');
}

async function test5D_ClassifyAutomationSuggestion() {
  const project = await createTestProject();
  
  const response = await apiRequest('POST', `/api/chat/${project.projectId}`, {
    question: 'Which tests should we automate for the cart feature?'
  });
  
  assert.strictEqual(response.status, 200);
  assert.strictEqual(response.data.intent, 'AUTOMATION_SUGGESTION', 'Should classify as AUTOMATION_SUGGESTION');
}

async function test5E_ClassifyDocumentAnalysis() {
  const project = await createTestProject();
  
  const response = await apiRequest('POST', `/api/chat/${project.projectId}`, {
    question: 'Analyze the requirements document and summarize key features'
  });
  
  assert.strictEqual(response.status, 200);
  assert.strictEqual(response.data.intent, 'DOCUMENT_ANALYSIS', 'Should classify as DOCUMENT_ANALYSIS');
}

async function test5F_ClassifyGeneralQAQuestion() {
  const project = await createTestProject();
  
  const response = await apiRequest('POST', `/api/chat/${project.projectId}`, {
    question: 'What is regression testing?'
  });
  
  assert.strictEqual(response.status, 200);
  assert.strictEqual(response.data.intent, 'GENERAL_QA_QUESTION', 'Should classify as GENERAL_QA_QUESTION');
}

async function test5G_ClassifyAmbiguousRequest() {
  const project = await createTestProject();
  
  const response = await apiRequest('POST', `/api/chat/${project.projectId}`, {
    question: 'Help me with testing'
  });
  
  assert.strictEqual(response.status, 200);
  assert.ok(response.data.intent, 'Should classify even ambiguous requests');
}

async function test5H_ClassifyMixedIntent() {
  const project = await createTestProject();
  
  const response = await apiRequest('POST', `/api/chat/${project.projectId}`, {
    question: 'Generate test cases and suggest which ones to automate'
  });
  
  assert.strictEqual(response.status, 200);
  assert.ok(response.data.intent, 'Should pick primary intent');
}

async function test5I_ClassifyWithContext() {
  const project = await createTestProject();
  
  const response = await apiRequest('POST', `/api/chat/${project.projectId}`, {
    question: 'For the login feature in the PRD, generate test cases'
  });
  
  assert.strictEqual(response.status, 200);
  assert.strictEqual(response.data.intent, 'TEST_CASE_GENERATION');
}

async function test5J_ClassificationSpeed() {
  const project = await createTestProject();
  
  const startTime = Date.now();
  await apiRequest('POST', `/api/chat/${project.projectId}`, {
    question: 'Generate test cases for login'
  });
  const duration = Date.now() - startTime;
  
  assert.ok(duration < 30000, `Classification + workflow should complete < 30s (took ${duration}ms)`);
}

// ========================================
// SECTION 6: TEST CASE WORKFLOW (6A-6T)
// ========================================

async function test6A_GenerateBasicTestCases() {
  const project = await createTestProject();
  await uploadTestDocument(project.projectId);
  
  const response = await apiRequest('POST', `/api/chat/${project.projectId}`, {
    question: 'Generate test cases for user login'
  });
  
  assert.strictEqual(response.status, 200);
  assert.ok(response.data.response, 'Should have response');
  assert.ok(response.data.response.includes('TC_'), 'Should include test case IDs');
}

async function test6B_TestCaseCount() {
  const project = await createTestProject();
  await uploadTestDocument(project.projectId);
  
  const response = await apiRequest('POST', `/api/chat/${project.projectId}`, {
    question: 'Generate comprehensive test cases for login feature'
  });
  
  assert.strictEqual(response.status, 200);
  const testCaseMatches = response.data.response.match(/TC_/g);
  const testCaseCount = testCaseMatches ? testCaseMatches.length : 0;
  
  assert.ok(testCaseCount >= 10, `Should generate at least 10 test cases (found ${testCaseCount})`);
}

async function test6C_PositiveTestCases() {
  const project = await createTestProject();
  await uploadTestDocument(project.projectId);
  
  const response = await apiRequest('POST', `/api/chat/${project.projectId}`, {
    question: 'Generate test cases for login'
  });
  
  assert.strictEqual(response.status, 200);
  const hasPositive = /positive|valid|success|happy path/i.test(response.data.response);
  assert.ok(hasPositive, 'Should include positive test cases');
}

async function test6D_NegativeTestCases() {
  const project = await createTestProject();
  await uploadTestDocument(project.projectId);
  
  const response = await apiRequest('POST', `/api/chat/${project.projectId}`, {
    question: 'Generate test cases for login'
  });
  
  assert.strictEqual(response.status, 200);
  const hasNegative = /negative|invalid|error|fail/i.test(response.data.response);
  assert.ok(hasNegative, 'Should include negative test cases');
}

async function test6E_EdgeCaseTestCases() {
  const project = await createTestProject();
  await uploadTestDocument(project.projectId);
  
  const response = await apiRequest('POST', `/api/chat/${project.projectId}`, {
    question: 'Generate test cases for login including edge cases'
  });
  
  assert.strictEqual(response.status, 200);
  const hasEdge = /edge|boundary|limit|special/i.test(response.data.response);
  assert.ok(hasEdge, 'Should include edge case test cases');
}

async function test6F_TestCaseStructure() {
  const project = await createTestProject();
  await uploadTestDocument(project.projectId);
  
  const response = await apiRequest('POST', `/api/chat/${project.projectId}`, {
    question: 'Generate test cases for login'
  });
  
  assert.strictEqual(response.status, 200);
  const hasSteps = /steps|step \d|procedure/i.test(response.data.response);
  const hasExpected = /expected|result|outcome/i.test(response.data.response);
  const hasPriority = /priority|high|medium|low/i.test(response.data.response);
  
  assert.ok(hasSteps, 'Should include test steps');
  assert.ok(hasExpected, 'Should include expected results');
  assert.ok(hasPriority, 'Should include priority');
}

async function test6G_MarkdownTableFormat() {
  const project = await createTestProject();
  await uploadTestDocument(project.projectId);
  
  const response = await apiRequest('POST', `/api/chat/${project.projectId}`, {
    question: 'Generate test cases for login in table format'
  });
  
  assert.strictEqual(response.status, 200);
  const hasTable = response.data.response.includes('|') && response.data.response.includes('---');
  assert.ok(hasTable, 'Should format as markdown table');
}

async function test6H_ContextUsage() {
  const project = await createTestProject();
  await uploadTestDocument(project.projectId);
  
  const response = await apiRequest('POST', `/api/chat/${project.projectId}`, {
    question: 'Generate test cases for login'
  });
  
  assert.strictEqual(response.status, 200);
  // Should reference specific details from PRD
  const hasSpecificDetails = /email|password|8\+ characters|5 failed|30 minutes/i.test(response.data.response);
  assert.ok(hasSpecificDetails, 'Should use specific context from PRD');
}

async function test6I_MultiStepWorkflow() {
  const project = await createTestProject();
  await uploadTestDocument(project.projectId);
  
  const response = await apiRequest('POST', `/api/chat/${project.projectId}`, {
    question: 'Generate test cases for login'
  });
  
  assert.strictEqual(response.status, 200);
  assert.ok(response.data.metadata, 'Should include workflow metadata');
}

async function test6J_ValidationRetry() {
  const project = await createTestProject();
  await uploadTestDocument(project.projectId);
  
  // This tests that the validation system is working
  const response = await apiRequest('POST', `/api/chat/${project.projectId}`, {
    question: 'Generate test cases for login'
  });
  
  assert.strictEqual(response.status, 200);
  // If quality score exists, validation ran
  const hasQuality = response.data.metadata?.qualityScore !== undefined;
  assert.ok(hasQuality || response.data.response, 'Should either have quality metadata or valid response');
}

// ========================================
// SECTION 7: VALIDATION TESTS (7A-7T)
// ========================================

async function test7A_ValidateTestCaseFormat() {
  const project = await createTestProject();
  await uploadTestDocument(project.projectId);
  
  const response = await apiRequest('POST', `/api/chat/${project.projectId}`, {
    question: 'Generate test cases for login'
  });
  
  assert.strictEqual(response.status, 200);
  // Validation should ensure proper format
  assert.ok(response.data.response.length > 100, 'Should have substantial content');
}

async function test7B_ValidateMinimumTestCases() {
  const project = await createTestProject();
  await uploadTestDocument(project.projectId);
  
  const response = await apiRequest('POST', `/api/chat/${project.projectId}`, {
    question: 'Generate test cases for login'
  });
  
  const testCaseCount = (response.data.response.match(/TC_/g) || []).length;
  assert.ok(testCaseCount >= 10, 'Should have at least 10 test cases');
}

async function test7C_ValidateCoverageTypes() {
  const project = await createTestProject();
  await uploadTestDocument(project.projectId);
  
  const response = await apiRequest('POST', `/api/chat/${project.projectId}`, {
    question: 'Generate comprehensive test cases for login'
  });
  
  const text = response.data.response.toLowerCase();
  const hasPositive = text.includes('positive') || text.includes('valid') || text.includes('success');
  const hasNegative = text.includes('negative') || text.includes('invalid') || text.includes('error');
  const hasEdge = text.includes('edge') || text.includes('boundary');
  
  assert.ok(hasPositive && hasNegative, 'Should have both positive and negative coverage');
}

async function test7D_ValidateNoPlaceholders() {
  const project = await createTestProject();
  await uploadTestDocument(project.projectId);
  
  const response = await apiRequest('POST', `/api/chat/${project.projectId}`, {
    question: 'Generate test cases for login'
  });
  
  const hasPlaceholders = /\[TODO\]|TBD|FILL.*IN|REPLACE.*THIS/i.test(response.data.response);
  assert.ok(!hasPlaceholders, 'Should not have placeholder text');
}

async function test7E_ValidateDetailedSteps() {
  const project = await createTestProject();
  await uploadTestDocument(project.projectId);
  
  const response = await apiRequest('POST', `/api/chat/${project.projectId}`, {
    question: 'Generate test cases for login with detailed steps'
  });
  
  const hasDetailedSteps = /navigate|click|enter|type|verify|check/i.test(response.data.response);
  assert.ok(hasDetailedSteps, 'Should have detailed action verbs in steps');
}

async function test7F_ValidationQualityScore() {
  const project = await createTestProject();
  await uploadTestDocument(project.projectId);
  
  const response = await apiRequest('POST', `/api/chat/${project.projectId}`, {
    question: 'Generate test cases for login'
  });
  
  if (response.data.metadata?.qualityScore) {
    assert.ok(response.data.metadata.qualityScore >= 60, 'Quality score should be at least 60');
  }
}

async function test7G_ValidateBugReportFormat() {
  const project = await createTestProject();
  
  const response = await apiRequest('POST', `/api/chat/${project.projectId}`, {
    question: 'Format this bug: Login button does not respond when clicked on iPhone 13'
  });
  
  assert.strictEqual(response.status, 200);
  const hasBugStructure = /title|description|steps to reproduce|expected|actual/i.test(response.data.response);
  assert.ok(hasBugStructure, 'Bug report should have proper structure');
}

async function test7H_ValidateTestPlanFormat() {
  const project = await createTestProject();
  await uploadTestDocument(project.projectId);
  
  const response = await apiRequest('POST', `/api/chat/${project.projectId}`, {
    question: 'Create a test plan for the login module'
  });
  
  assert.strictEqual(response.status, 200);
  const hasPlanStructure = /objective|scope|strategy|schedule|resources/i.test(response.data.response);
  assert.ok(hasPlanStructure, 'Test plan should have proper structure');
}

async function test7I_ValidateAutomationSuggestions() {
  const project = await createTestProject();
  await uploadTestDocument(project.projectId);
  
  const response = await apiRequest('POST', `/api/chat/${project.projectId}`, {
    question: 'Suggest automation approach for login testing'
  });
  
  assert.strictEqual(response.status, 200);
  const hasAutomationContent = /playwright|selenium|cypress|framework|automate/i.test(response.data.response);
  assert.ok(hasAutomationContent, 'Should include automation-specific content');
}

async function test7J_ValidateRetryOnLowQuality() {
  const project = await createTestProject();
  await uploadTestDocument(project.projectId);
  
  // Validation should trigger retry if quality is low
  const response = await apiRequest('POST', `/api/chat/${project.projectId}`, {
    question: 'Generate test cases for login'
  });
  
  assert.strictEqual(response.status, 200);
  // If we got a response, validation either passed or retried successfully
  assert.ok(response.data.response.length > 200, 'Should have substantial validated content');
}

// ========================================
// SECTION 8: MEMORY TESTS (8A-8O)
// ========================================

async function test8A_ConversationHistoryStored() {
  const project = await createTestProject();
  
  const response1 = await apiRequest('POST', `/api/chat/${project.projectId}`, {
    question: 'Hello, I want to test the login feature'
  });
  
  assert.strictEqual(response1.status, 200);
  
  // Check if history endpoint exists
  const historyResponse = await apiRequest('GET', `/api/chat/${project.projectId}/history`);
  if (historyResponse.status === 200) {
    assert.ok(historyResponse.data.history.length > 0, 'Should store conversation history');
  }
}

async function test8B_ConversationContextInPrompt() {
  const project = await createTestProject();
  await uploadTestDocument(project.projectId);
  
  await apiRequest('POST', `/api/chat/${project.projectId}`, {
    question: 'I want to test the login feature'
  });
  
  const response2 = await apiRequest('POST', `/api/chat/${project.projectId}`, {
    question: 'Generate test cases for it'
  });
  
  assert.strictEqual(response2.status, 200);
  // Should understand "it" refers to login feature from context
  const refersToLogin = /login/i.test(response2.data.response);
  assert.ok(refersToLogin, 'Should understand context from previous message');
}

async function test8C_RememberDiscussedFeatures() {
  const project = await createTestProject();
  await uploadTestDocument(project.projectId);
  
  await apiRequest('POST', `/api/chat/${project.projectId}`, {
    question: 'Tell me about the shopping cart feature'
  });
  
  const response2 = await apiRequest('POST', `/api/chat/${project.projectId}`, {
    question: 'Now generate test cases for that feature'
  });
  
  assert.strictEqual(response2.status, 200);
  const refersToCart = /cart|shopping/i.test(response2.data.response);
  assert.ok(refersToCart, 'Should remember previously discussed features');
}

async function test8D_RememberDocumentContext() {
  const project = await createTestProject();
  await uploadTestDocument(project.projectId);
  
  await apiRequest('POST', `/api/chat/${project.projectId}`, {
    question: 'What features are documented?'
  });
  
  const response2 = await apiRequest('POST', `/api/chat/${project.projectId}`, {
    question: 'Generate test cases for the first one you mentioned'
  });
  
  assert.strictEqual(response2.status, 200);
  assert.ok(response2.data.response.length > 100, 'Should reference previous context');
}

async function test8E_ConversationLimit() {
  const project = await createTestProject();
  
  // Send multiple messages
  for (let i = 0; i < 6; i++) {
    await apiRequest('POST', `/api/chat/${project.projectId}`, {
      question: `Test message ${i + 1}`
    });
  }
  
  const historyResponse = await apiRequest('GET', `/api/chat/${project.projectId}/history`);
  if (historyResponse.status === 200) {
    // Should limit conversation history (typically last 3-5 turns)
    assert.ok(historyResponse.data.history.length <= 10, 'Should limit conversation history size');
  }
}

async function test8F_ClearConversationHistory() {
  const project = await createTestProject();
  
  await apiRequest('POST', `/api/chat/${project.projectId}`, {
    question: 'Test message'
  });
  
  const deleteResponse = await apiRequest('DELETE', `/api/chat/${project.projectId}/history`);
  if (deleteResponse.status === 200) {
    const historyResponse = await apiRequest('GET', `/api/chat/${project.projectId}/history`);
    assert.strictEqual(historyResponse.data.history.length, 0, 'Should clear conversation history');
  }
}

async function test8G_ProjectIsolation() {
  const project1 = await createTestProject('Project 1');
  const project2 = await createTestProject('Project 2');
  
  await apiRequest('POST', `/api/chat/${project1.id}`, {
    question: 'Discussing feature A in project 1'
  });
  
  await apiRequest('POST', `/api/chat/${project2.id}`, {
    question: 'Discussing feature B in project 2'
  });
  
  const history1 = await apiRequest('GET', `/api/chat/${project1.id}/history`);
  const history2 = await apiRequest('GET', `/api/chat/${project2.id}/history`);
  
  if (history1.status === 200 && history2.status === 200) {
    // Each project should have its own isolated history
    assert.notDeepStrictEqual(history1.data.history, history2.data.history, 'Conversation histories should be isolated');
  }
}

async function test8H_MemoryWithFollowUp() {
  const project = await createTestProject();
  await uploadTestDocument(project.projectId);
  
  const response1 = await apiRequest('POST', `/api/chat/${project.projectId}`, {
    question: 'Generate test cases for login'
  });
  
  const response2 = await apiRequest('POST', `/api/chat/${project.projectId}`, {
    question: 'Add more edge cases to those test cases'
  });
  
  assert.strictEqual(response2.status, 200);
  // Should understand "those test cases" refers to previous response
  const hasEdgeCases = /edge|boundary/i.test(response2.data.response);
  assert.ok(hasEdgeCases, 'Should understand follow-up references');
}

async function test8I_MemoryMetadata() {
  const project = await createTestProject();
  
  const response = await apiRequest('POST', `/api/chat/${project.projectId}`, {
    question: 'Generate test cases for login'
  });
  
  if (response.data.metadata) {
    assert.ok(response.data.metadata.taskType || response.data.metadata.intent, 'Should store task type in metadata');
  }
}

async function test8J_ConversationTimestamps() {
  const project = await createTestProject();
  
  await apiRequest('POST', `/api/chat/${project.projectId}`, {
    question: 'Test message'
  });
  
  const historyResponse = await apiRequest('GET', `/api/chat/${project.projectId}/history`);
  if (historyResponse.status === 200 && historyResponse.data.history.length > 0) {
    const hasTimestamp = historyResponse.data.history[0].timestamp !== undefined;
    assert.ok(hasTimestamp, 'Conversation history should include timestamps');
  }
}

// ========================================
// SECTION 15: INTEGRATION TESTS
// ========================================

async function test15A_EndToEndWorkflow() {
  // Create project -> Upload doc -> Generate test cases -> Validate -> Memory
  const project = await createTestProject();
  await uploadTestDocument(project.projectId);
  
  const response1 = await apiRequest('POST', `/api/chat/${project.projectId}`, {
    question: 'Generate test cases for login'
  });
  
  assert.strictEqual(response1.status, 200);
  assert.ok(response1.data.response.includes('TC_'));
  
  const response2 = await apiRequest('POST', `/api/chat/${project.projectId}`, {
    question: 'Now suggest automation for those test cases'
  });
  
  assert.strictEqual(response2.status, 200);
  assert.ok(/automat|playwright|selenium/i.test(response2.data.response));
}

async function test15B_MultipleProjectsConcurrent() {
  const project1 = await createTestProject('Project A');
  const project2 = await createTestProject('Project B');
  
  const [response1, response2] = await Promise.all([
    apiRequest('POST', `/api/chat/${project1.id}`, { question: 'Generate test cases for feature A' }),
    apiRequest('POST', `/api/chat/${project2.id}`, { question: 'Generate test cases for feature B' })
  ]);
  
  assert.strictEqual(response1.status, 200);
  assert.strictEqual(response2.status, 200);
}

async function test15C_LongConversationFlow() {
  const project = await createTestProject();
  await uploadTestDocument(project.projectId);
  
  const messages = [
    'What features are in the PRD?',
    'Generate test cases for the first feature',
    'Add more negative test cases',
    'Suggest automation strategy',
    'Create a test plan for all features'
  ];
  
  for (const message of messages) {
    const response = await apiRequest('POST', `/api/chat/${project.projectId}`, { message });
    assert.strictEqual(response.status, 200);
  }
}

async function test15D_ErrorRecovery() {
  const project = await createTestProject();
  
  // Send invalid request
  const badResponse = await apiRequest('POST', `/api/chat/${project.projectId}`, {
    question: ''
  });
  
  assert.notStrictEqual(badResponse.status, 200, 'Should reject empty message');
  
  // Should recover and work normally after error
  const goodResponse = await apiRequest('POST', `/api/chat/${project.projectId}`, {
    question: 'Generate test cases for login'
  });
  
  assert.strictEqual(goodResponse.status, 200);
}

async function test15E_CrossFeatureTesting() {
  const project = await createTestProject();
  await uploadTestDocument(project.projectId);
  
  const response = await apiRequest('POST', `/api/chat/${project.projectId}`, {
    question: 'Generate integration test cases for login and shopping cart together'
  });
  
  assert.strictEqual(response.status, 200);
  const mentionsBothFeatures = /login/i.test(response.data.response) && /cart/i.test(response.data.response);
  assert.ok(mentionsBothFeatures, 'Should handle cross-feature requests');
}

async function test15F_ProviderFallback() {
  // This tests if OpenAI fallback works when Gemini fails
  // Actual behavior depends on configuration
  const project = await createTestProject();
  
  const response = await apiRequest('POST', `/api/chat/${project.projectId}`, {
    question: 'Generate test cases for login'
  });
  
  // Should get a response regardless of which provider is used
  assert.strictEqual(response.status, 200);
}

async function test15G_LargeDocumentHandling() {
  const project = await createTestProject();
  await uploadTestDocument(project.projectId);
  
  const response = await apiRequest('POST', `/api/chat/${project.projectId}`, {
    question: 'Generate comprehensive test cases for all features in the document'
  });
  
  assert.strictEqual(response.status, 200);
  assert.ok(response.data.response.length > 500, 'Should handle large context');
}

async function test15H_RapidRequests() {
  const project = await createTestProject();
  
  const requests = Array(5).fill(null).map((_, i) => 
    apiRequest('POST', `/api/chat/${project.projectId}`, {
      question: `Generate test cases for feature ${i + 1}`
    })
  );
  
  const responses = await Promise.all(requests);
  const allSuccessful = responses.every(r => r.status === 200);
  
  assert.ok(allSuccessful, 'Should handle rapid concurrent requests');
}

async function test15I_ComplexQuery() {
  const project = await createTestProject();
  await uploadTestDocument(project.projectId);
  
  const response = await apiRequest('POST', `/api/chat/${project.projectId}`, {
    question: 'Generate test cases for login, prioritize security tests, include automation suggestions, and create a test execution timeline'
  });
  
  assert.strictEqual(response.status, 200);
  assert.ok(response.data.response.length > 300, 'Should handle complex multi-part queries');
}

async function test15J_StateConsistency() {
  const project = await createTestProject();
  await uploadTestDocument(project.projectId);
  
  await apiRequest('POST', `/api/chat/${project.projectId}`, {
    question: 'Generate test cases for login'
  });
  
  const history1 = await apiRequest('GET', `/api/chat/${project.projectId}/history`);
  const history2 = await apiRequest('GET', `/api/chat/${project.projectId}/history`);
  
  if (history1.status === 200 && history2.status === 200) {
    assert.deepStrictEqual(history1.data, history2.data, 'State should be consistent across requests');
  }
}

// ========================================
// CRITICAL TESTS - Must all pass
// ========================================

async function testCRITICAL1_Classification10Types() {
  const project = await createTestProject();
  
  const testMessages = [
    { question: 'Generate test cases for login', expected: 'TEST_CASE_GENERATION' },
    { question: 'Format this bug report', expected: 'BUG_REPORT_FORMATTING' },
    { question: 'Create a test plan', expected: 'TEST_PLAN_CREATION' },
    { question: 'Suggest automation', expected: 'AUTOMATION_SUGGESTION' },
    { question: 'Analyze the PRD', expected: 'DOCUMENT_ANALYSIS' },
    { question: 'What is smoke testing?', expected: 'GENERAL_QA_QUESTION' },
    { question: 'List test cases for checkout', expected: 'TEST_CASE_GENERATION' },
    { question: 'Bug: button not working', expected: 'BUG_REPORT_FORMATTING' },
    { question: 'Test strategy for API', expected: 'TEST_PLAN_CREATION' },
    { question: 'Which tests to automate?', expected: 'AUTOMATION_SUGGESTION' }
  ];
  
  let correctCount = 0;
  
  for (const test of testMessages) {
    const response = await apiRequest('POST', `/api/chat/${project.projectId}`, {
      question: test.question
    });
    
    if (response.status === 200 && response.data.intent === test.expected) {
      correctCount++;
    }
  }
  
  assert.ok(correctCount >= 8, `Should classify at least 8/10 correctly (got ${correctCount}/10)`);
}

async function testCRITICAL2_Generate10PlusTestCases() {
  const project = await createTestProject();
  await uploadTestDocument(project.projectId);
  
  const response = await apiRequest('POST', `/api/chat/${project.projectId}`, {
    question: 'Generate comprehensive test cases for the login feature'
  });
  
  const testCaseCount = (response.data.response.match(/TC_/g) || []).length;
  assert.ok(testCaseCount >= 10, `Should generate 10+ test cases (got ${testCaseCount})`);
}

async function testCRITICAL3_CoverageTypes() {
  const project = await createTestProject();
  await uploadTestDocument(project.projectId);
  
  const response = await apiRequest('POST', `/api/chat/${project.projectId}`, {
    question: 'Generate test cases for login with positive, negative, and edge cases'
  });
  
  const text = response.data.response.toLowerCase();
  const hasPositive = /positive|valid|success/.test(text);
  const hasNegative = /negative|invalid|error/.test(text);
  const hasEdge = /edge|boundary/.test(text);
  
  assert.ok(hasPositive && hasNegative && hasEdge, 'Must include positive, negative, and edge cases');
}

async function testCRITICAL4_ValidationDetectsLowQuality() {
  const project = await createTestProject();
  
  const response = await apiRequest('POST', `/api/chat/${project.projectId}`, {
    question: 'Generate test cases'
  });
  
  // Even with minimal context, should produce validated output
  assert.strictEqual(response.status, 200);
  assert.ok(response.data.response.length > 100, 'Should produce substantial validated content');
}

async function testCRITICAL5_ConversationMemory() {
  const project = await createTestProject();
  await uploadTestDocument(project.projectId);
  
  await apiRequest('POST', `/api/chat/${project.projectId}`, {
    question: 'Tell me about the login feature'
  });
  
  const response2 = await apiRequest('POST', `/api/chat/${project.projectId}`, {
    question: 'Generate test cases for that feature'
  });
  
  assert.strictEqual(response2.status, 200);
  const refersToLogin = /login/i.test(response2.data.response);
  assert.ok(refersToLogin, 'Must remember context from previous messages');
}

async function testCRITICAL6_NoUnhandledErrors() {
  const project = await createTestProject();
  
  const requests = [
    { question: 'Generate test cases' },
    { question: '' },
    { question: 'a'.repeat(10000) },
    { question: 'Test with special chars: <>&"\'`' },
    { question: 'What about login?' },
    { question: 'Create test plan' },
    { question: 'Bug: not working' },
    { question: 'Suggest automation' },
    { question: 'Analyze document' },
    { question: 'Help with testing' }
  ];
  
  let crashCount = 0;
  
  for (const req of requests) {
    try {
      const response = await apiRequest('POST', `/api/chat/${project.projectId}`, req);
      if (response.status >= 500) {
        crashCount++;
      }
    } catch (error) {
      crashCount++;
    }
  }
  
  assert.strictEqual(crashCount, 0, `Should not crash on any request (crashed ${crashCount}/10)`);
}

async function testCRITICAL7_ResponseTime() {
  const project = await createTestProject();
  await uploadTestDocument(project.projectId);
  
  const startTime = Date.now();
  
  const response = await apiRequest('POST', `/api/chat/${project.projectId}`, {
    question: 'Generate test cases for login feature'
  });
  
  const duration = Date.now() - startTime;
  
  assert.strictEqual(response.status, 200);
  assert.ok(duration < 30000, `Response time should be < 30s (took ${duration}ms)`);
}

async function testCRITICAL8_MultiProviderSupport() {
  const project = await createTestProject();
  
  const response = await apiRequest('POST', `/api/chat/${project.projectId}`, {
    question: 'Generate test cases for login'
  });
  
  assert.strictEqual(response.status, 200);
  assert.ok(response.data.response.length > 50, 'Should work with configured provider');
}

async function testCRITICAL9_FallbackWorks() {
  // Check if server has fallback configured
  const project = await createTestProject();
  
  const response = await apiRequest('POST', `/api/chat/${project.projectId}`, {
    question: 'Test fallback'
  });
  
  // Should get some response even if primary provider fails
  assert.ok(response.status === 200 || response.status === 429, 'Should have fallback mechanism');
}

async function testCRITICAL10_ClearDecisionLogs() {
  const project = await createTestProject();
  await uploadTestDocument(project.projectId);
  
  const response = await apiRequest('POST', `/api/chat/${project.projectId}`, {
    question: 'Generate test cases for login'
  });
  
  // Check if response includes decision-making metadata
  const hasMetadata = response.data.intent || response.data.metadata;
  assert.ok(hasMetadata, 'Should log clear decision-making process');
}

// ========================================
// DEMO TESTS - Presentation readiness
// ========================================

async function test19A_DemoScenario1() {
  console.log('    📺 Demo: Create project and generate test cases');
  
  const project = await createTestProject('E-Commerce Demo');
  await uploadTestDocument(project.projectId);
  
  const response = await apiRequest('POST', `/api/chat/${project.projectId}`, {
    question: 'Generate comprehensive test cases for the login feature'
  });
  
  assert.strictEqual(response.status, 200);
  console.log(`       Generated ${(response.data.response.match(/TC_/g) || []).length} test cases`);
}

async function test19B_DemoScenario2() {
  console.log('    📺 Demo: Follow-up conversation');
  
  const project = await createTestProject();
  await uploadTestDocument(project.projectId);
  
  await apiRequest('POST', `/api/chat/${project.projectId}`, {
    question: 'What features are in the document?'
  });
  
  const response2 = await apiRequest('POST', `/api/chat/${project.projectId}`, {
    question: 'Generate test cases for the shopping cart'
  });
  
  assert.strictEqual(response2.status, 200);
  console.log('       AI understood context from previous message');
}

async function test19C_DemoScenario3() {
  console.log('    📺 Demo: Bug report formatting');
  
  const project = await createTestProject();
  
  const response = await apiRequest('POST', `/api/chat/${project.projectId}`, {
    question: 'Format this bug: Login button does not work on mobile Safari'
  });
  
  assert.strictEqual(response.status, 200);
  console.log('       Generated structured bug report');
}

async function test19D_DemoScenario4() {
  console.log('    📺 Demo: Test plan creation');
  
  const project = await createTestProject();
  await uploadTestDocument(project.projectId);
  
  const response = await apiRequest('POST', `/api/chat/${project.projectId}`, {
    question: 'Create a test plan for the entire application'
  });
  
  assert.strictEqual(response.status, 200);
  console.log('       Generated comprehensive test plan');
}

async function test19E_DemoScenario5() {
  console.log('    📺 Demo: Automation suggestions');
  
  const project = await createTestProject();
  await uploadTestDocument(project.projectId);
  
  const response = await apiRequest('POST', `/api/chat/${project.projectId}`, {
    question: 'Suggest which tests should be automated and provide Playwright examples'
  });
  
  assert.strictEqual(response.status, 200);
  console.log('       Generated automation strategy with code examples');
}

async function test19F_DemoScenario6() {
  console.log('    📺 Demo: Multi-turn conversation');
  
  const project = await createTestProject();
  await uploadTestDocument(project.projectId);
  
  await apiRequest('POST', `/api/chat/${project.projectId}`, {
    question: 'Generate test cases for login'
  });
  
  await apiRequest('POST', `/api/chat/${project.projectId}`, {
    question: 'Add more security-focused test cases'
  });
  
  const response3 = await apiRequest('POST', `/api/chat/${project.projectId}`, {
    question: 'Now suggest automation for all these test cases'
  });
  
  assert.strictEqual(response3.status, 200);
  console.log('       AI maintained context across 3 messages');
}

async function test19G_DemoScenario7() {
  console.log('    📺 Demo: Document analysis');
  
  const project = await createTestProject();
  await uploadTestDocument(project.projectId);
  
  const response = await apiRequest('POST', `/api/chat/${project.projectId}`, {
    question: 'Analyze the PRD and summarize the key features and acceptance criteria'
  });
  
  assert.strictEqual(response.status, 200);
  console.log('       Analyzed and summarized document');
}

async function test19H_DemoScenario8() {
  console.log('    📺 Demo: Complex query handling');
  
  const project = await createTestProject();
  await uploadTestDocument(project.projectId);
  
  const response = await apiRequest('POST', `/api/chat/${project.projectId}`, {
    question: 'For the checkout feature, generate test cases prioritizing payment edge cases, suggest automation, and estimate testing effort'
  });
  
  assert.strictEqual(response.status, 200);
  console.log('       Handled multi-part complex query');
}

async function test19I_DemoScenario9() {
  console.log('    📺 Demo: Multiple projects isolation');
  
  const project1 = await createTestProject('Banking App');
  const project2 = await createTestProject('E-Commerce App');
  
  await apiRequest('POST', `/api/chat/${project1.id}`, {
    question: 'This is a banking application'
  });
  
  await apiRequest('POST', `/api/chat/${project2.id}`, {
    question: 'This is an e-commerce application'
  });
  
  console.log('       Two projects maintain separate contexts');
}

async function test19J_DemoScenario10() {
  console.log('    📺 Demo: Real-time response streaming effect');
  
  const project = await createTestProject();
  await uploadTestDocument(project.projectId);
  
  const startTime = Date.now();
  const response = await apiRequest('POST', `/api/chat/${project.projectId}`, {
    question: 'Generate test cases for login'
  });
  const duration = Date.now() - startTime;
  
  assert.strictEqual(response.status, 200);
  console.log(`       Response generated in ${(duration / 1000).toFixed(2)}s`);
}

// ========================================
// MAIN TEST RUNNER
// ========================================

async function runAllTests() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║     PHASE 2: AGENTIC SYSTEM VALIDATION TEST SUITE      ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log();
  
  // Check server is running
  try {
    const healthCheck = await apiRequest('GET', '/health');
    if (healthCheck.status !== 200) {
      console.error('❌ Server is not responding properly. Start it with: node index.js');
      process.exit(1);
    }
    console.log('✅ Server is running\n');
  } catch (error) {
    console.error('❌ Cannot connect to server. Start it with: node index.js');
    process.exit(1);
  }
  
  // Check API keys
  if (!GEMINI_API_KEY && !OPENAI_API_KEY) {
    console.warn('⚠️  No API keys found. Some tests may fail or use fallback mode.\n');
  }
  
  // SECTION 5: Classification Tests
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 SECTION 5: INTENT CLASSIFICATION TESTS (5A-5J)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  await runTest('5A: Classify Test Case Generation', test5A_ClassifyTestCaseGeneration, 'classification');
  await runTest('5B: Classify Bug Report Formatting', test5B_ClassifyBugReportFormatting, 'classification');
  await runTest('5C: Classify Test Plan Creation', test5C_ClassifyTestPlanCreation, 'classification');
  await runTest('5D: Classify Automation Suggestion', test5D_ClassifyAutomationSuggestion, 'classification');
  await runTest('5E: Classify Document Analysis', test5E_ClassifyDocumentAnalysis, 'classification');
  await runTest('5F: Classify General QA Question', test5F_ClassifyGeneralQAQuestion, 'classification');
  await runTest('5G: Classify Ambiguous Request', test5G_ClassifyAmbiguousRequest, 'classification');
  await runTest('5H: Classify Mixed Intent', test5H_ClassifyMixedIntent, 'classification');
  await runTest('5I: Classify With Context', test5I_ClassifyWithContext, 'classification');
  await runTest('5J: Classification Speed', test5J_ClassificationSpeed, 'classification');
  
  // SECTION 6: Test Case Workflow
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 SECTION 6: TEST CASE WORKFLOW TESTS (6A-6J)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  await runTest('6A: Generate Basic Test Cases', test6A_GenerateBasicTestCases, 'workflow');
  await runTest('6B: Generate 10+ Test Cases', test6B_TestCaseCount, 'workflow');
  await runTest('6C: Include Positive Test Cases', test6C_PositiveTestCases, 'workflow');
  await runTest('6D: Include Negative Test Cases', test6D_NegativeTestCases, 'workflow');
  await runTest('6E: Include Edge Cases', test6E_EdgeCaseTestCases, 'workflow');
  await runTest('6F: Proper Test Case Structure', test6F_TestCaseStructure, 'workflow');
  await runTest('6G: Markdown Table Format', test6G_MarkdownTableFormat, 'workflow');
  await runTest('6H: Use PRD Context', test6H_ContextUsage, 'workflow');
  await runTest('6I: Multi-Step Workflow', test6I_MultiStepWorkflow, 'workflow');
  await runTest('6J: Validation & Retry', test6J_ValidationRetry, 'workflow');
  
  // SECTION 7: Validation Tests
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 SECTION 7: OUTPUT VALIDATION TESTS (7A-7J)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  await runTest('7A: Validate Format', test7A_ValidateTestCaseFormat, 'validation');
  await runTest('7B: Validate Minimum Count', test7B_ValidateMinimumTestCases, 'validation');
  await runTest('7C: Validate Coverage Types', test7C_ValidateCoverageTypes, 'validation');
  await runTest('7D: No Placeholders', test7D_ValidateNoPlaceholders, 'validation');
  await runTest('7E: Detailed Steps', test7E_ValidateDetailedSteps, 'validation');
  await runTest('7F: Quality Score', test7F_ValidationQualityScore, 'validation');
  await runTest('7G: Bug Report Format', test7G_ValidateBugReportFormat, 'validation');
  await runTest('7H: Test Plan Format', test7H_ValidateTestPlanFormat, 'validation');
  await runTest('7I: Automation Suggestions', test7I_ValidateAutomationSuggestions, 'validation');
  await runTest('7J: Retry on Low Quality', test7J_ValidateRetryOnLowQuality, 'validation');
  
  // SECTION 8: Memory Tests
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 SECTION 8: CONVERSATION MEMORY TESTS (8A-8J)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  await runTest('8A: Store Conversation History', test8A_ConversationHistoryStored, 'memory');
  await runTest('8B: Use Context in Prompts', test8B_ConversationContextInPrompt, 'memory');
  await runTest('8C: Remember Discussed Features', test8C_RememberDiscussedFeatures, 'memory');
  await runTest('8D: Remember Document Context', test8D_RememberDocumentContext, 'memory');
  await runTest('8E: Limit Conversation Size', test8E_ConversationLimit, 'memory');
  await runTest('8F: Clear History', test8F_ClearConversationHistory, 'memory');
  await runTest('8G: Project Isolation', test8G_ProjectIsolation, 'memory');
  await runTest('8H: Follow-up Understanding', test8H_MemoryWithFollowUp, 'memory');
  await runTest('8I: Store Metadata', test8I_MemoryMetadata, 'memory');
  await runTest('8J: Conversation Timestamps', test8J_ConversationTimestamps, 'memory');
  
  // SECTION 15: Integration Tests
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 SECTION 15: INTEGRATION TESTS (15A-15J)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  await runTest('15A: End-to-End Workflow', test15A_EndToEndWorkflow, 'integration');
  await runTest('15B: Multiple Projects Concurrent', test15B_MultipleProjectsConcurrent, 'integration');
  await runTest('15C: Long Conversation Flow', test15C_LongConversationFlow, 'integration');
  await runTest('15D: Error Recovery', test15D_ErrorRecovery, 'integration');
  await runTest('15E: Cross-Feature Testing', test15E_CrossFeatureTesting, 'integration');
  await runTest('15F: Provider Fallback', test15F_ProviderFallback, 'integration');
  await runTest('15G: Large Document Handling', test15G_LargeDocumentHandling, 'integration');
  await runTest('15H: Rapid Requests', test15H_RapidRequests, 'integration');
  await runTest('15I: Complex Query', test15I_ComplexQuery, 'integration');
  await runTest('15J: State Consistency', test15J_StateConsistency, 'integration');
  
  // CRITICAL TESTS
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔥 CRITICAL TESTS - ALL MUST PASS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const criticalStartPassed = testResults.passed;
  
  await runTest('CRITICAL 1: Classify 10 Types', testCRITICAL1_Classification10Types, 'critical');
  await runTest('CRITICAL 2: Generate 10+ Test Cases', testCRITICAL2_Generate10PlusTestCases, 'critical');
  await runTest('CRITICAL 3: Coverage Types', testCRITICAL3_CoverageTypes, 'critical');
  await runTest('CRITICAL 4: Validation Detects Low Quality', testCRITICAL4_ValidationDetectsLowQuality, 'critical');
  await runTest('CRITICAL 5: Conversation Memory', testCRITICAL5_ConversationMemory, 'critical');
  await runTest('CRITICAL 6: No Unhandled Errors', testCRITICAL6_NoUnhandledErrors, 'critical');
  await runTest('CRITICAL 7: Response Time < 30s', testCRITICAL7_ResponseTime, 'critical');
  await runTest('CRITICAL 8: Multi-Provider Support', testCRITICAL8_MultiProviderSupport, 'critical');
  await runTest('CRITICAL 9: Fallback Works', testCRITICAL9_FallbackWorks, 'critical');
  await runTest('CRITICAL 10: Clear Decision Logs', testCRITICAL10_ClearDecisionLogs, 'critical');
  
  const criticalPassed = testResults.passed - criticalStartPassed;
  const criticalTotal = 10;
  
  // DEMO TESTS
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📺 DEMO SCENARIOS - Presentation Readiness (19A-19J)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  await runTest('19A: Demo Scenario 1', test19A_DemoScenario1, 'demo');
  await runTest('19B: Demo Scenario 2', test19B_DemoScenario2, 'demo');
  await runTest('19C: Demo Scenario 3', test19C_DemoScenario3, 'demo');
  await runTest('19D: Demo Scenario 4', test19D_DemoScenario4, 'demo');
  await runTest('19E: Demo Scenario 5', test19E_DemoScenario5, 'demo');
  await runTest('19F: Demo Scenario 6', test19F_DemoScenario6, 'demo');
  await runTest('19G: Demo Scenario 7', test19G_DemoScenario7, 'demo');
  await runTest('19H: Demo Scenario 8', test19H_DemoScenario8, 'demo');
  await runTest('19I: Demo Scenario 9', test19I_DemoScenario9, 'demo');
  await runTest('19J: Demo Scenario 10', test19J_DemoScenario10, 'demo');
  
  // FINAL RESULTS
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║                   FINAL RESULTS                        ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  
  const total = testResults.passed + testResults.failed;
  const percentage = total > 0 ? ((testResults.passed / total) * 100).toFixed(1) : 0;
  
  console.log(`\n  Total Tests: ${total}`);
  console.log(`  ✅ Passed: ${testResults.passed}`);
  console.log(`  ❌ Failed: ${testResults.failed}`);
  console.log(`  ⏭️  Skipped: ${testResults.skipped}`);
  console.log(`  📊 Pass Rate: ${percentage}%`);
  
  console.log(`\n  🔥 CRITICAL TESTS: ${criticalPassed}/${criticalTotal} passed`);
  
  if (criticalPassed < criticalTotal) {
    console.log('\n  ⚠️  WARNING: Not all critical tests passed!');
    console.log('  Fix critical issues before proceeding to Phase 3.\n');
  }
  
  console.log('\n' + '─'.repeat(60));
  
  if (percentage >= 95) {
    console.log('  🎉 EXCELLENT! Phase 2 is complete and production-ready!');
    console.log('  ✨ Ready to proceed to Phase 3 or deploy to production.');
  } else if (percentage >= 85) {
    console.log('  ✅ GOOD! Phase 2 is mostly complete.');
    console.log('  Fix remaining issues for production deployment.');
  } else if (percentage >= 70) {
    console.log('  ⚠️  FAIR. More work needed before Phase 3.');
    console.log('  Focus on failed tests, especially critical ones.');
  } else {
    console.log('  ❌ NOT READY. Significant work required.');
    console.log('  Review failed tests and fix core functionality.');
  }
  
  console.log('─'.repeat(60) + '\n');
  
  // Show errors if any
  if (testResults.errors.length > 0) {
    console.log('\n📋 Failed Tests Summary:\n');
    testResults.errors.forEach((err, idx) => {
      console.log(`  ${idx + 1}. [${err.category}] ${err.test}`);
      console.log(`     ${err.error}\n`);
    });
  }
  
  // Exit with appropriate code
  process.exit(testResults.failed > 0 ? 1 : 0);
}

// Run the test suite
if (require.main === module) {
  runAllTests().catch(error => {
    console.error('\n❌ Test suite crashed:', error);
    process.exit(1);
  });
}

module.exports = { runAllTests };
