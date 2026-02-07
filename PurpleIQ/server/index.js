const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const OpenAI = require('openai');
const { v4: uuidv4 } = require('uuid');
const { createRequestLogger, sanitizeMetadata } = require('./utils/logger');
const aiService = require('./services/AIService');
require('dotenv').config();

// Master prompt for test case generation (loaded once at startup)
const QA_MASTER_PROMPT_PATH = path.join(__dirname, 'prompts', 'QA_TEST_CASES_MASTER_PROMPT.txt');
let QA_MASTER_PROMPT_CACHE = null;
async function getTestCasesMasterPrompt() {
  if (QA_MASTER_PROMPT_CACHE) return QA_MASTER_PROMPT_CACHE;
  QA_MASTER_PROMPT_CACHE = await fs.readFile(QA_MASTER_PROMPT_PATH, 'utf8');
  return QA_MASTER_PROMPT_CACHE;
}

/**
 * Sanitize JSON string by removing/escaping control characters
 */
function sanitizeJsonString(jsonStr) {
  // Replace control characters (except \n, \r, \t which are valid when escaped)
  return jsonStr
    // Remove or escape literal control characters (0x00-0x1F except \n, \r, \t)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    // Fix common escape sequence issues
    .replace(/\\(?!["\\/bfnrtu])/g, '\\\\'); // Escape backslashes not followed by valid escape chars
}

/**
 * Attempt to fix common JSON issues
 */
function tryFixJson(jsonStr) {
  try {
    // Try 1: Remove all control characters more aggressively
    let fixed = jsonStr.replace(/[\x00-\x1F]/g, (match) => {
      // Keep valid escaped sequences
      const code = match.charCodeAt(0);
      if (code === 0x09) return '\\t'; // tab
      if (code === 0x0A) return '\\n'; // newline
      if (code === 0x0D) return '\\r'; // carriage return
      return ''; // Remove other control chars
    });
    
    // Try 2: Fix unescaped quotes in strings (heuristic)
    // This is risky but can help with some cases
    fixed = fixed.replace(/"([^"]*)":\s*"([^"]*)"/g, (match, key, value) => {
      // Escape any unescaped quotes in the value
      const escapedValue = value.replace(/\\"/g, '"').replace(/"/g, '\\"');
      return `"${key}": "${escapedValue}"`;
    });
    
    return fixed;
  } catch (error) {
    console.error('JSON fix attempt failed:', error.message);
    return null;
  }
}

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Check if mock AI mode is enabled
const USE_MOCK_AI = process.env.USE_MOCK_AI === 'true';

// Initialize OpenAI client (only if not using mock mode)
let openai = null;
if (!USE_MOCK_AI) {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });
}

// Using OpenAI GPT-4o-mini for fast, cost-effective generation
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

/**
 * Generate content with OpenAI
 * @param {string} prompt - The prompt to send
 * @param {boolean} jsonMode - Whether to request JSON mode
 * @returns {Promise<{result: any, usedModel: string}>}
 */
async function generateWithOpenAI(prompt, jsonMode = true) {
  if (!openai) {
    throw new Error('OpenAI client not initialized');
  }

  try {
    console.log(`🔄 Using model: ${OPENAI_MODEL}`);
    
    const completion = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are PurpleIQ, an expert QA analyst that generates comprehensive test cases.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      response_format: jsonMode ? { type: 'json_object' } : undefined
    });
    
    console.log(`✅ Successfully used model: ${OPENAI_MODEL}`);
    return { 
      result: completion.choices[0].message.content,
      usedModel: OPENAI_MODEL 
    };
  } catch (error) {
    const errorMsg = error.message || String(error);
    console.error(`❌ ${OPENAI_MODEL} failed:`, errorMsg);
    
    // Provide helpful error message
    if (errorMsg.includes('429') || errorMsg.includes('quota') || errorMsg.includes('rate limit')) {
      throw new Error(`Rate limit exceeded. Please try again in a few moments.`);
    } else if (errorMsg.includes('401') || errorMsg.includes('invalid_api_key')) {
      throw new Error(`Invalid OpenAI API key. Please check your configuration.`);
    } else if (errorMsg.includes('not found') || errorMsg.includes('404')) {
      throw new Error(`Model ${OPENAI_MODEL} not available. Please check your API key and model name.`);
    } else {
      throw new Error(`AI generation failed: ${errorMsg}`);
    }
  }
}

// ========== MIDDLEWARE ==========
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request ID middleware
app.use((req, res, next) => {
  req.requestId = uuidv4();
  req.logger = createRequestLogger(req.requestId, 'express');
  next();
});

// Request logging middleware
app.use((req, res, next) => {
  const startTime = Date.now();
  
  // Log request
  req.logger.info(`Incoming request: ${req.method} ${req.path}`, {
    function: 'requestMiddleware',
    method: req.method,
    path: req.path,
    query: req.query,
    bodySize: req.body ? JSON.stringify(req.body).length : 0,
    ip: req.ip,
    userAgent: req.get('user-agent')
  });

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    req.logger.apiCall(
      req.method,
      req.path,
      res.statusCode,
      duration,
      {
        function: 'requestMiddleware',
        bodySize: req.body ? JSON.stringify(req.body).length : 0
      }
    );
  });

  next();
});

// ========== NEW ROUTES - PROJECT MANAGEMENT ==========
const projectsRouter = require('./routes/projects');
const chatRouter = require('./routes/chat');
const exportRouter = require('./routes/export');
const settingsRouter = require('./routes/settings');
const logsRouter = require('./routes/logs');

app.use('/api/projects', projectsRouter);
app.use('/api/chat', chatRouter);

// Rate limit status endpoint (for demo reliability monitoring)
app.get('/api/rate-limit-status', (req, res) => {
  try {
    const status = aiService.getRateLimitStatus();
    const failoverStats = aiService.getFailoverStats();
    res.json({
      success: true,
      ...status,
      failoverStats: {
        today: failoverStats.todayFailovers,
        total: failoverStats.totalFailovers,
        lastFailover: failoverStats.lastFailover
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting rate limit status:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve rate limit status'
    });
  }
});

// Failover statistics endpoint
app.get('/api/failover-stats', (req, res) => {
  try {
    const stats = aiService.getFailoverStats();
    res.json({
      success: true,
      ...stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting failover stats:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve failover statistics'
    });
  }
});

// Embedding rate limit status endpoint
app.get('/api/embedding-rate-limit-status', (req, res) => {
  try {
    const embeddingService = require('./services/EmbeddingService');
    const status = embeddingService.getRateLimitStatus();
    res.json({
      success: true,
      ...status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting embedding rate limit status:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve embedding rate limit status'
    });
  }
});

/**
 * GET /api/rate-limit-status
 * Global rate limit status endpoint
 */
app.get('/api/rate-limit-status', (req, res) => {
  try {
    const aiService = require('./services/AIService');
    const status = aiService.getRateLimitStatus();
    res.json({
      success: true,
      ...status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting rate limit status:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve rate limit status'
    });
  }
});
app.use('/api/export', exportRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/logs', logsRouter);

/**
 * GET /api/rate-limit-status
 * Get current rate limit status and recommendations
 */
app.get('/api/rate-limit-status', (req, res) => {
  try {
    const status = aiService.getRateLimitStatus();
    res.json({
      success: true,
      ...status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting rate limit status:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve rate limit status'
    });
  }
});

// ========== SYSTEM PROMPT ==========
const SYSTEM_PROMPT = `You are PurpleIQ, an AI-powered QA assistant designed to help manual and automation testers. 
Your expertise includes:
- Creating comprehensive test cases for functional testing
- Designing automation strategies and test scripts
- Analyzing requirements and identifying test scenarios
- Analyzing test failures and providing debugging insights
- Generating concise QA-friendly summaries

Always provide clear, actionable, and well-structured responses that QA professionals can immediately use.`;

// ========== MODE-SPECIFIC PROMPT BUILDERS ==========
const getModePrompt = (mode, inputText) => {
  const modePrompts = {
    testcases: `Generate detailed functional test cases for the following requirement or feature:

${inputText}

Provide test cases with:
- Clear test case titles
- Step-by-step test steps
- Expected results for each step
- Test data requirements
- Priority level (High/Medium/Low)
- Preconditions if applicable

Format the output in a structured, easy-to-read format.`,

    automation: `Create an automation strategy and sample Playwright test ideas for:

${inputText}

Provide:
- Automation strategy overview
- Key test scenarios to automate
- Sample Playwright test code snippets with explanations
- Page object model suggestions if applicable
- Best practices for the automation approach
- Considerations for maintainability and scalability`,

    analysis: `Analyze the following requirement or test failure:

${inputText}

Provide:
- Requirement breakdown (if analyzing requirements)
- Potential test scenarios and edge cases
- Risk areas and critical paths
- Failure analysis (if analyzing a test failure)
- Root cause insights (if applicable)
- Recommendations for testing approach`,

    summary: `Provide a concise, QA-friendly summary of:

${inputText}

The summary should:
- Be brief and to the point
- Highlight key testing considerations
- Include critical test scenarios
- Be suitable for quick reference by QA team members`
  };

  return modePrompts[mode] || modePrompts.summary;
};

// ========== MOCK AI RESPONSE GENERATORS ==========
const getMockResponse = (mode, inputText) => {
  const mockResponses = {
    testcases: `TEST CASE 1: Basic Functionality
Priority: High
Preconditions: User is on the login page

Steps:
1. Enter valid email address in the email field
2. Enter valid password in the password field
3. Click on the "Login" button

Expected Result:
- User should be successfully logged in
- User should be redirected to the dashboard page
- Welcome message should be displayed

Test Data:
- Email: testuser@example.com
- Password: Test@123

---

TEST CASE 2: Invalid Email Format
Priority: High
Preconditions: User is on the login page

Steps:
1. Enter invalid email format (e.g., "invalidemail")
2. Enter any password
3. Click on the "Login" button

Expected Result:
- Error message should be displayed: "Please enter a valid email address"
- User should remain on the login page
- Email field should be highlighted in red

---

TEST CASE 3: Empty Password Field
Priority: Medium
Preconditions: User is on the login page

Steps:
1. Enter valid email address
2. Leave password field empty
3. Click on the "Login" button

Expected Result:
- Error message should be displayed: "Password is required"
- User should remain on the login page
- Password field should be highlighted in red

---

TEST CASE 4: Incorrect Password
Priority: High
Preconditions: User is on the login page

Steps:
1. Enter valid registered email address
2. Enter incorrect password
3. Click on the "Login" button

Expected Result:
- Error message should be displayed: "Invalid email or password"
- User should remain on the login page
- Login attempt should be logged for security

---

TEST CASE 5: Successful Login with Remember Me
Priority: Medium
Preconditions: User is on the login page

Steps:
1. Enter valid email address
2. Enter valid password
3. Check the "Remember Me" checkbox
4. Click on the "Login" button

Expected Result:
- User should be successfully logged in
- User credentials should be saved (cookie/localStorage)
- On next visit, email field should be pre-filled`,

    automation: `AUTOMATION STRATEGY

Overview:
For automating the login functionality, we'll use Playwright with a Page Object Model (POM) pattern for maintainability and reusability.

Key Test Scenarios to Automate:
1. Successful login with valid credentials
2. Login failure with invalid credentials
3. Form validation (empty fields, invalid email format)
4. Password visibility toggle
5. Remember me functionality
6. Forgot password link navigation

Sample Playwright Test Code:

\`\`\`javascript
// tests/login.spec.js
const { test, expect } = require('@playwright/test');
const { LoginPage } = require('../pages/LoginPage');

test.describe('Login Functionality', () => {
  test('should login successfully with valid credentials', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.navigate();
    await loginPage.login('testuser@example.com', 'Test@123');
    
    await expect(page).toHaveURL(/.*dashboard/);
    await expect(page.locator('.welcome-message')).toBeVisible();
  });

  test('should show error for invalid email format', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.navigate();
    await loginPage.enterEmail('invalidemail');
    await loginPage.clickLogin();
    
    await expect(loginPage.getErrorMessage()).toContainText('valid email');
  });

  test('should show error for empty password', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.navigate();
    await loginPage.enterEmail('test@example.com');
    await loginPage.clickLogin();
    
    await expect(loginPage.getErrorMessage()).toContainText('required');
  });
});
\`\`\`

Page Object Model Structure:

\`\`\`javascript
// pages/LoginPage.js
class LoginPage {
  constructor(page) {
    this.page = page;
    this.emailInput = page.locator('#email');
    this.passwordInput = page.locator('#password');
    this.loginButton = page.locator('button[type="submit"]');
    this.errorMessage = page.locator('.error-message');
  }

  async navigate() {
    await this.page.goto('/login');
  }

  async enterEmail(email) {
    await this.emailInput.fill(email);
  }

  async enterPassword(password) {
    await this.passwordInput.fill(password);
  }

  async login(email, password) {
    await this.enterEmail(email);
    await this.enterPassword(password);
    await this.loginButton.click();
  }

  async clickLogin() {
    await this.loginButton.click();
  }

  getErrorMessage() {
    return this.errorMessage;
  }
}

module.exports = { LoginPage };
\`\`\`

Best Practices:
- Use data-driven testing with test data files
- Implement proper wait strategies (waitForLoadState)
- Add screenshot capture on test failures
- Use environment variables for test credentials
- Implement retry logic for flaky tests

Maintainability Considerations:
- Keep selectors in page objects, not in test files
- Use meaningful test names and descriptions
- Group related tests using test.describe blocks
- Implement proper test data management`,

    analysis: `REQUIREMENT ANALYSIS

Requirement Breakdown:
The login functionality requires secure user authentication with proper validation and error handling.

Key Components:
1. Email input field with format validation
2. Password input field with security requirements
3. Login button to submit credentials
4. Error handling and user feedback
5. Session management after successful login

Test Scenarios Identified:

Functional Scenarios:
- Valid login with correct credentials
- Invalid email format validation
- Empty field validation
- Incorrect password handling
- Case sensitivity of email/password

Edge Cases:
- Very long email addresses
- Special characters in email
- SQL injection attempts in input fields
- XSS attack attempts
- Concurrent login attempts
- Session timeout scenarios

Risk Areas:
1. Security Risks:
   - Password should not be visible in browser console
   - API should use HTTPS
   - Rate limiting for failed login attempts
   - Account lockout after multiple failures

2. User Experience Risks:
   - Clear error messages
   - Loading states during authentication
   - Accessibility compliance (keyboard navigation, screen readers)

3. Integration Risks:
   - API response time
   - Database connection failures
   - Third-party authentication service downtime

Critical Paths:
1. Happy path: Email → Password → Login → Dashboard
2. Error path: Invalid input → Error message → Stay on page
3. Security path: Multiple failures → Account lockout

Recommendations:
1. Implement comprehensive test coverage for all validation rules
2. Add security testing (OWASP Top 10)
3. Performance testing for API response times
4. Accessibility testing (WCAG compliance)
5. Cross-browser compatibility testing
6. Mobile responsive testing`,

    summary: `QA SUMMARY

Feature: Login Functionality

Testing Focus Areas:
• Email and password validation
• Successful authentication flow
• Error handling and user feedback
• Security considerations (rate limiting, account lockout)
• Session management

Critical Test Scenarios:
1. Valid login with correct credentials
2. Invalid email format handling
3. Empty field validation
4. Incorrect password scenarios
5. Security measures (brute force protection)

Priority: High
Estimated Test Cases: 8-10
Automation Potential: High
Risk Level: Medium-High (security critical feature)`
  };

  // Return mock response based on mode, with input text context
  return mockResponses[mode] || mockResponses.summary;
};

// ========== POST /api/generate ==========
app.post('/api/generate', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { inputText, mode } = req.body;

    // Validation
    if (!inputText || typeof inputText !== 'string') {
      console.error('Validation failed: inputText is required and must be a string');
      return res.status(400).json({
        error: 'Bad Request',
        message: 'inputText is required and must be a string'
      });
    }

    if (!mode || !['testcases', 'automation', 'analysis', 'summary'].includes(mode)) {
      console.error('Validation failed: mode must be one of: testcases, automation, analysis, summary');
      return res.status(400).json({
        error: 'Bad Request',
        message: 'mode must be one of: testcases, automation, analysis, summary'
      });
    }

    console.log(`Processing request - Mode: ${mode}, Input length: ${inputText.length} characters`);
    console.log(`🤖 AI Mode: ${USE_MOCK_AI ? 'MOCK' : 'REAL (OpenAI)'}`);

    let output;

    // Check if using mock AI mode
    if (USE_MOCK_AI) {
      console.log('Using MOCK AI - generating mock response...');
      
      // Simulate API delay for realistic behavior
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Generate mock response
      output = getMockResponse(mode, inputText);
      
      const duration = Date.now() - startTime;
      console.log(`Mock response generated successfully in ${duration}ms`);
      
    } else {
      // Use real OpenAI API
      if (!process.env.OPENAI_API_KEY) {
        console.error('Configuration error: OPENAI_API_KEY is not set');
        return res.status(500).json({
          error: 'Configuration Error',
          message: 'OpenAI API key is not configured'
        });
      }

      // Build the full prompt (system prompt + user prompt)
      const userPrompt = getModePrompt(mode, inputText);
      const fullPrompt = `${SYSTEM_PROMPT}\n\n${userPrompt}`;

      // Call OpenAI API
      console.log('Calling OpenAI API...');
      
      const { result, usedModel } = await generateWithOpenAI(fullPrompt, false);
      
      output = result;
      console.log(`✅ Model used: ${usedModel}`);

      const duration = Date.now() - startTime;
      console.log(`Request completed successfully in ${duration}ms`);
    }

    // Return response
    res.json({
      output: output
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    
    // Log detailed error server-side for debugging
    console.error(`❌ Error processing request after ${duration}ms:`, {
      error: error.message,
      name: error.name,
      stack: error.stack,
      mode: req.body?.mode,
      inputLength: req.body?.inputText?.length,
      timestamp: new Date().toISOString()
    });

    // Handle custom AI service errors
    const AIErrors = require('./utils/AIErrors');
    
    // Check if it's a custom error class
    if (error instanceof AIErrors.AIServiceError) {
      return res.status(error.statusCode).json(error.toJSON());
    }

    // Handle validation errors (400)
    if (error.message && (
      error.message.includes('required') || 
      error.message.includes('invalid') ||
      error.message.includes('must be')
    )) {
      return res.status(400).json({
        error: 'Bad Request',
        message: error.message
      });
    }

    // Handle OpenAI API errors (only if not using mock mode)
    if (!USE_MOCK_AI) {
      // Check for quota/rate limit errors specifically
      const errorMessage = error.message || String(error);
      const isQuotaError = errorMessage.includes('429') || 
                          errorMessage.includes('quota') || 
                          errorMessage.includes('rate limit') ||
                          errorMessage.includes('Too Many Requests');
      
      if (isQuotaError) {
        // Extract retry delay from error message if available
        const retryMatch = errorMessage.match(/retry in ([\d.]+)s/i);
        const retryAfter = retryMatch ? Math.ceil(parseFloat(retryMatch[1])) : null;
        
        return res.status(429).json({
          error: 'Rate Limit Exceeded',
          message: `OpenAI API quota exceeded. ${retryAfter ? `Please retry in ${retryAfter} seconds.` : 'Please try again later.'}`,
          suggestion: 'You can enable MOCK AI mode by setting USE_MOCK_AI=true in your .env file to continue testing without API calls.',
          retryAfter: retryAfter,
          timestamp: new Date().toISOString()
        });
      }
      
      // Classify and handle other OpenAI-specific errors
      const classifiedError = AIErrors.classifyError(error, 'OpenAI', { 
        triedModels: [OPENAI_MODEL] 
      });
      
      if (classifiedError instanceof AIErrors.AIServiceError) {
        return res.status(classifiedError.statusCode).json(classifiedError.toJSON());
      }
    }

    // Default to 500 for unexpected errors
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred. Please try again.'
    });
  }
});

// ========== POST /api/test-cases/from-story (agentic: one user story → JSON test cases) ==========
app.post('/api/test-cases/from-story', async (req, res) => {
  const startTime = Date.now();
  try {
    const { summary, issueKey, projectKey, projectDescription, description } = req.body || {};

    if (!summary || !issueKey) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'summary and issueKey are required. Optionally: projectKey, projectDescription, description.'
      });
    }

    const context = [
      `Summary: ${String(summary).trim()}`,
      `Issue key: ${String(issueKey).trim()}`,
      `Project key: ${projectKey != null && projectKey !== '' ? String(projectKey).trim() : 'N/A'}`,
      `Project description: ${projectDescription != null && projectDescription !== '' ? String(projectDescription).trim() : 'N/A'}`,
      `Description:\n${description != null && description !== '' ? String(description).trim() : 'No description provided.'}`
    ].join('\n');

    const masterPrompt = await getTestCasesMasterPrompt();
    const fullPrompt = `${masterPrompt}\n\n--- USER STORY INPUT ---\n${context}\n\n--- RESPOND WITH JSON ONLY ---`;

    if (USE_MOCK_AI) {
      await new Promise(r => setTimeout(r, 500));
      const mockTestCases = [
        {
          testCaseId: 'TC-001',
          summary: 'Verify requirement is met (mock)',
          description: 'Mock test case for development.',
          precondition: 'System is available',
          testScenario: 'Basic scenario',
          testSteps: ['Step 1', 'Step 2'],
          expectedResult: 'Expected outcome',
          canBeAutomated: 'Yes',
          priority: 'High'
        }
      ];
      return res.json({
        issueKey: String(issueKey).trim(),
        summary: String(summary).trim(),
        projectKey: projectKey != null ? String(projectKey).trim() : null,
        testCases: mockTestCases
      });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error: 'Configuration Error',
        message: 'OPENAI_API_KEY is not set'
      });
    }

    const { result } = await generateWithOpenAI(fullPrompt, true);
    const rawText = result;
    let jsonStr = rawText.trim();
    
    // Remove markdown code blocks if present
    const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) jsonStr = codeBlockMatch[1].trim();
    
    // Sanitize JSON string (remove/escape control characters)
    jsonStr = sanitizeJsonString(jsonStr);
    
    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error(`JSON parse error for ${issueKey}:`, parseError.message);
      console.error('Raw response preview:', rawText.slice(0, 500));
      
      // Try to fix common issues and retry
      const fixedJson = tryFixJson(jsonStr);
      if (fixedJson) {
        try {
          parsed = JSON.parse(fixedJson);
          console.log(`✅ Successfully recovered JSON for ${issueKey}`);
        } catch (retryError) {
          throw new Error(`Failed to parse JSON even after sanitization: ${parseError.message}`);
        }
      } else {
        throw parseError;
      }
    }

    if (!parsed.testCases || !Array.isArray(parsed.testCases)) {
      return res.status(502).json({
        error: 'Invalid AI Response',
        message: 'AI did not return testCases array.',
        rawPreview: rawText.slice(0, 200)
      });
    }

    const apiResponse = {
      issueKey: parsed.issueKey || issueKey,
      summary: parsed.summary || summary,
      projectKey: parsed.projectKey != null ? parsed.projectKey : projectKey,
      testCases: parsed.testCases
    };

    console.log(`Test cases generated for ${apiResponse.issueKey}: ${apiResponse.testCases.length} cases (${Date.now() - startTime}ms)`);
    res.json(apiResponse);
  } catch (err) {
    const duration = Date.now() - startTime;
    console.error('Test cases from-story error:', err.message);
    if (err instanceof SyntaxError) {
      return res.status(502).json({
        error: 'Invalid JSON from AI',
        message: err.message
      });
    }
    if (err.message && (err.message.includes('429') || err.message.includes('quota') || err.message.includes('rate limit'))) {
      return res.status(429).json({
        error: 'Rate Limit Exceeded',
        message: err.message
      });
    }
    res.status(500).json({
      error: 'Internal Server Error',
      message: err.message || 'Failed to generate test cases.'
    });
  }
});

// ========== HEALTH CHECK ==========
const healthCheckService = require('./services/HealthCheckService');

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'PurpleIQ API',
    aiMode: USE_MOCK_AI ? 'MOCK' : 'REAL (OpenAI)'
  });
});

// Comprehensive health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    const healthStatus = await healthCheckService.runAllChecks();
    const statusCode = healthStatus.status === 'healthy' ? 200 : 
                      healthStatus.status === 'degraded' ? 200 : 503;
    res.status(statusCode).json(healthStatus);
  } catch (error) {
    console.error('Health check error:', error);
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// ========== ROOT ENDPOINT ==========
app.get('/', (req, res) => {
  res.json({
    service: 'PurpleIQ API',
    version: '1.0.0',
    aiMode: USE_MOCK_AI ? 'MOCK' : 'REAL (Google Gemini)',
    endpoints: {
      'POST /api/generate': 'Generate QA content based on mode',
      'GET /health': 'Health check endpoint'
    }
  });
});

// ========== ERROR HANDLING ==========
app.use((err, req, res, next) => {
  // Log detailed error server-side
  console.error('❌ Unhandled error:', {
    error: err.message,
    name: err.name,
    stack: err.stack,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  });

  // Handle custom AI service errors
  const AIErrors = require('./utils/AIErrors');
  if (err instanceof AIErrors.AIServiceError) {
    return res.status(err.statusCode).json(err.toJSON());
  }

  // Default error response
  res.status(500).json({
    error: 'Internal Server Error',
    message: 'An unexpected error occurred. Please try again.'
  });
});

// ========== START SERVER ==========
app.listen(PORT, () => {
  console.log('='.repeat(80));
  console.log(`🚀 PurpleIQ API Server is running`);
  console.log(`📍 Port: ${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🤖 AI Mode: ${USE_MOCK_AI ? '🔧 MOCK AI (No API calls)' : '✨ REAL AI (OpenAI)'}`);
  if (!USE_MOCK_AI) {
    console.log(`💡 Tip: If you hit quota limits, set USE_MOCK_AI=true in .env to use mock responses`);
    console.log(`🔑 OpenAI API Key: ${process.env.OPENAI_API_KEY ? '✅ Configured' : '❌ Not configured'}`);
    console.log(`🤖 OpenAI Model: ${OPENAI_MODEL}`);
  }
  console.log('='.repeat(80));
  console.log(`\n🔧 AI CONFIGURATION:`);
  console.log(`   ✅ PRIMARY: OpenAI (${OPENAI_MODEL}) for ALL operations`);
  console.log(`   ✅ Test case generation with structured JSON output`);
  console.log(`   ✅ JSON error recovery and sanitization enabled`);
  console.log('='.repeat(80));
  console.log(`Available endpoints:`);
  console.log(`  POST http://localhost:${PORT}/api/generate (legacy)`);
  console.log(`  POST http://localhost:${PORT}/api/test-cases/from-story (agentic: user story → JSON test cases)`);
  console.log(`  GET  http://localhost:${PORT}/api/projects`);
  console.log(`  POST http://localhost:${PORT}/api/projects`);
  console.log(`  POST http://localhost:${PORT}/api/projects/:id/documents`);
  console.log(`  POST http://localhost:${PORT}/api/chat/:projectId`);
  console.log(`  GET  http://localhost:${PORT}/health`);
  console.log(`  GET  http://localhost:${PORT}/`);
  console.log('='.repeat(50));
});

module.exports = app;
