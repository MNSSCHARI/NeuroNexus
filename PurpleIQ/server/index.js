const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Check if mock AI mode is enabled
const USE_MOCK_AI = process.env.USE_MOCK_AI === 'true';

// Initialize Google Gemini client (only if not using mock mode)
let genAI = null;
let model = null;
if (!USE_MOCK_AI) {
  genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  // Use gemini-3-flash-preview (most commonly available model)
  // If this doesn't work, check available models in Google AI Studio
  model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });
}

// ========== MIDDLEWARE ==========
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// ========== NEW ROUTES - PROJECT MANAGEMENT ==========
const projectsRouter = require('./routes/projects');
const chatRouter = require('./routes/chat');

app.use('/api/projects', projectsRouter);
app.use('/api/chat', chatRouter);

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
    console.log(`🤖 AI Mode: ${USE_MOCK_AI ? 'MOCK' : 'REAL (Google Gemini)'}`);

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
      // Use real Google Gemini API
      if (!process.env.GEMINI_API_KEY) {
        console.error('Configuration error: GEMINI_API_KEY is not set');
        return res.status(500).json({
          error: 'Configuration Error',
          message: 'Gemini API key is not configured'
        });
      }

      // Build the full prompt (system prompt + user prompt)
      const userPrompt = getModePrompt(mode, inputText);
      const fullPrompt = `${SYSTEM_PROMPT}\n\n${userPrompt}`;

      // Call Google Gemini API
      console.log('Calling Google Gemini API...');
      
      // Try to generate content with fallback to alternative models if needed
      let result;
      let usedModel = 'gemini-3-flash-preview';
      
      try {
        result = await model.generateContent(fullPrompt);
      } catch (modelError) {
        // If model not found, try alternative models
        if (modelError.message && modelError.message.includes('not found')) {
          console.log('gemini-3-flash-preview not available, trying alternative models...');
          
          const alternativeModels = ['gemini-1.5-pro', 'gemini-1.5-flash'];
          let success = false;
          
          for (const altModelName of alternativeModels) {
            try {
              console.log(`Trying ${altModelName}...`);
              const altModel = genAI.getGenerativeModel({ model: altModelName });
              result = await altModel.generateContent(fullPrompt);
              usedModel = altModelName;
              console.log(`✅ Successfully used ${altModelName}`);
              success = true;
              break;
            } catch (err) {
              console.log(`❌ ${altModelName} failed: ${err.message}`);
              continue;
            }
          }
          
          if (!success) {
            throw new Error(`No available Gemini models found. Tried: gemini-3-flash-preview, ${alternativeModels.join(', ')}. Please check your API key and available models in Google AI Studio.`);
          }
        } else {
          throw modelError;
        }
      }
      
      const response = await result.response;
      output = response.text();
      console.log(`Model used: ${usedModel}`);

      const duration = Date.now() - startTime;
      console.log(`Request completed successfully in ${duration}ms`);
      
      // Log token usage if available
      if (result.response.usageMetadata) {
        const usage = result.response.usageMetadata;
        console.log(`Tokens used: ${usage.totalTokenCount} (prompt: ${usage.promptTokenCount}, completion: ${usage.candidatesTokenCount})`);
      }
    }

    // Return response
    res.json({
      output: output
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`Error processing request after ${duration}ms:`, error);

    // Handle Google Gemini API errors (only if not using mock mode)
    if (!USE_MOCK_AI) {
      // Check for model not found errors
      if (error.message && error.message.includes('not found')) {
        console.error('Google Gemini Model Error:', {
          message: error.message,
          suggestion: 'The specified model is not available. Please check available models in Google AI Studio.'
        });

        return res.status(500).json({
          error: 'Model Not Found',
          message: 'The requested Gemini model is not available. Please check your API key permissions and available models.',
          details: error.message
        });
      }
      
      // Check for other common Gemini API error patterns
      if (error.message && (error.message.includes('API_KEY') || error.message.includes('quota') || error.message.includes('permission'))) {
        console.error('Google Gemini API Error:', {
          message: error.message
        });

        return res.status(500).json({
          error: 'Google Gemini API Error',
          message: error.message
        });
      }
    }

    // Handle other errors
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'An unexpected error occurred'
    });
  }
});

// ========== HEALTH CHECK ==========
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'PurpleIQ API',
    aiMode: USE_MOCK_AI ? 'MOCK' : 'REAL (Google Gemini)'
  });
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
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: 'An unexpected error occurred'
  });
});

// ========== START SERVER ==========
app.listen(PORT, () => {
  console.log('='.repeat(50));
  console.log(`🚀 PurpleIQ API Server is running`);
  console.log(`📍 Port: ${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🤖 AI Mode: ${USE_MOCK_AI ? '🔧 MOCK AI (No API calls)' : '✨ REAL AI (Google Gemini)'}`);
  if (!USE_MOCK_AI) {
    console.log(`🔑 Gemini API Key: ${process.env.GEMINI_API_KEY ? '✅ Configured' : '❌ Not configured'}`);
  }
  console.log('='.repeat(50));
  console.log(`Available endpoints:`);
  console.log(`  POST http://localhost:${PORT}/api/generate (legacy)`);
  console.log(`  GET  http://localhost:${PORT}/api/projects`);
  console.log(`  POST http://localhost:${PORT}/api/projects`);
  console.log(`  POST http://localhost:${PORT}/api/projects/:id/documents`);
  console.log(`  POST http://localhost:${PORT}/api/chat/:projectId`);
  console.log(`  GET  http://localhost:${PORT}/health`);
  console.log(`  GET  http://localhost:${PORT}/`);
  console.log('='.repeat(50));
});

module.exports = app;
