/**
 * Prompt Templates for PurpleIQ
 * Best-practice prompt engineering with role, context, task, output format, quality requirements, and examples
 */

/**
 * Base prompt structure components
 */
const PROMPT_COMPONENTS = {
  ROLE: (role = 'PurpleIQ, an expert QA engineer') => `You are ${role}, specializing in quality assurance and testing.`,
  
  CONTEXT: (projectInfo, documents, conversationHistory) => {
    let context = '';
    
    if (projectInfo) {
      context += `\n## Project Information\n`;
      context += `- **Project Name:** ${projectInfo.projectName || 'N/A'}\n`;
      context += `- **Domain/Industry:** ${projectInfo.domain || 'General'}\n`;
      context += `- **Technology Stack:** ${projectInfo.techStack || 'Not specified'}\n`;
      context += `- **Team Standards:** ${projectInfo.teamStandards || 'Standard QA practices'}\n`;
    }
    
    if (documents && documents.trim().length > 0) {
      context += `\n## Relevant Project Documents\n${documents}\n`;
    }
    
    if (conversationHistory && conversationHistory.length > 0) {
      context += `\n## Previous Conversation Context\n`;
      conversationHistory.slice(-3).forEach((turn, idx) => {
        context += `**Turn ${idx + 1}:**\n`;
        context += `- User: ${turn.user}\n`;
        context += `- Assistant: ${turn.assistant.substring(0, 200)}...\n\n`;
      });
    }
    
    return context;
  },
  
  CONSTRAINTS: (constraints) => {
    if (!constraints || constraints.length === 0) return '';
    return `\n## Constraints\n${constraints.map(c => `- ${c}`).join('\n')}\n`;
  }
};

/**
 * TEST CASE GENERATION TEMPLATE
 * Comprehensive template with few-shot examples
 */
const TEST_CASE_GENERATION_TEMPLATE = {
  build: (params) => {
    const {
      projectInfo = {},
      retrievedContext = '',
      conversationHistory = [],
      moduleName = 'Feature',
      requirements = [],
      constraints = [],
      userRequest = ''
    } = params;

    const role = PROMPT_COMPONENTS.ROLE('PurpleIQ, an expert QA test designer');
    const context = PROMPT_COMPONENTS.CONTEXT(projectInfo, retrievedContext, conversationHistory);
    const constraintsSection = PROMPT_COMPONENTS.CONSTRAINTS(constraints);

    const modulePrefix = moduleName.toUpperCase().replace(/[^A-Z0-9]/g, '_').substring(0, 10);

    return `${role}

${context}

## Task Description

Generate comprehensive test cases for the following module/feature based on the project documents and requirements.

**Module/Feature:** ${moduleName}
**User Request:** ${userRequest}
**Requirements:** ${requirements.length > 0 ? requirements.map(r => `- ${r}`).join('\n') : 'General functionality testing'}

${constraintsSection}

## Output Format Requirements

You MUST return a valid JSON object in this EXACT structure:

\`\`\`json
{
  "testCases": [
    {
      "testCaseId": "TC_${modulePrefix}_001",
      "description": "Clear, concise description of what is being tested",
      "preconditions": ["Precondition 1", "Precondition 2"],
      "steps": ["Step 1: Detailed action", "Step 2: Detailed action", "Step 3: Detailed action"],
      "expectedResults": "Clear description of expected outcome",
      "priority": "High|Medium|Low",
      "type": "Positive|Negative|Edge Case"
    }
  ]
}
\`\`\`

**CRITICAL:** Return ONLY valid JSON. No markdown, no explanations, no code blocks, just the raw JSON object.

## Quality Requirements

### Minimum Requirements:
- **Count:** Minimum 10 test cases (aim for 15-20 for comprehensive coverage)
- **Coverage Distribution:**
  - At least 40% Positive test cases (happy path scenarios)
  - At least 30% Negative test cases (error scenarios, invalid inputs)
  - At least 30% Edge Case test cases (boundary conditions, unusual scenarios)

### Field Requirements:
- **testCaseId:** Format: TC_${modulePrefix}_XXX (e.g., TC_LOGIN_001)
- **description:** 50-150 characters, specific and actionable
- **preconditions:** Array of 1-3 specific preconditions (not generic like "System is running")
- **steps:** Array of 3-8 detailed, numbered steps with specific actions
- **expectedResults:** 30-100 characters, specific and measurable
- **priority:** High (critical paths), Medium (important features), Low (nice-to-have)
- **type:** Positive (normal flow), Negative (error handling), Edge Case (boundaries)

### Content Quality:
- NO placeholder text (no [TODO], TBD, "example", "sample")
- Steps must be specific: "Click the 'Login' button in the top-right corner" NOT "Click button"
- Expected results must be measurable: "User is redirected to dashboard" NOT "It works"
- Preconditions must be specific: "User is logged in with valid credentials" NOT "User exists"

## Examples

### Example 1: Login Feature Test Case

\`\`\`json
{
  "testCases": [
    {
      "testCaseId": "TC_LOGIN_001",
      "description": "Verify successful login with valid credentials",
      "preconditions": ["User account exists with email test@example.com", "User is on login page"],
      "steps": [
        "Step 1: Enter email 'test@example.com' in the email input field",
        "Step 2: Enter password 'SecurePass123!' in the password field",
        "Step 3: Click the 'Sign In' button",
        "Step 4: Wait for page navigation"
      ],
      "expectedResults": "User is redirected to dashboard page, welcome message displays user name",
      "priority": "High",
      "type": "Positive"
    },
    {
      "testCaseId": "TC_LOGIN_002",
      "description": "Verify login fails with invalid password",
      "preconditions": ["User account exists with email test@example.com", "User is on login page"],
      "steps": [
        "Step 1: Enter email 'test@example.com' in the email input field",
        "Step 2: Enter incorrect password 'WrongPass123' in the password field",
        "Step 3: Click the 'Sign In' button",
        "Step 4: Observe error message"
      ],
      "expectedResults": "Error message 'Invalid credentials' displays below password field, user remains on login page",
      "priority": "High",
      "type": "Negative"
    },
    {
      "testCaseId": "TC_LOGIN_003",
      "description": "Verify login with maximum length email address",
      "preconditions": ["User account exists with 254-character email", "User is on login page"],
      "steps": [
        "Step 1: Enter 254-character email address in the email input field",
        "Step 2: Enter valid password in the password field",
        "Step 3: Click the 'Sign In' button",
        "Step 4: Wait for authentication"
      ],
      "expectedResults": "User successfully logs in and is redirected to dashboard",
      "priority": "Medium",
      "type": "Edge Case"
    }
  ]
}
\`\`\`

### Example 2: Payment Feature Test Case

\`\`\`json
{
  "testCases": [
    {
      "testCaseId": "TC_PAYMENT_001",
      "description": "Verify successful payment processing with valid credit card",
      "preconditions": ["User is logged in", "Shopping cart contains items worth $50", "User is on checkout page"],
      "steps": [
        "Step 1: Click 'Proceed to Payment' button",
        "Step 2: Enter credit card number '4111111111111111'",
        "Step 3: Enter expiry date '12/25'",
        "Step 4: Enter CVV '123'",
        "Step 5: Enter cardholder name 'John Doe'",
        "Step 6: Click 'Pay Now' button",
        "Step 7: Wait for payment processing"
      ],
      "expectedResults": "Payment is processed successfully, order confirmation page displays with order ID, confirmation email is sent",
      "priority": "High",
      "type": "Positive"
    }
  ]
}
\`\`\`

## Instructions

1. Analyze the project documents and extract all relevant information
2. Identify user flows, business rules, acceptance criteria, and edge cases
3. Generate test cases covering all identified scenarios
4. Ensure proper distribution across Positive, Negative, and Edge Case types
5. Make all test cases specific, actionable, and measurable
6. Return ONLY the JSON object, no additional text

Now generate the test cases based on the provided context and requirements.`;
  }
};

/**
 * BUG REPORT TEMPLATE
 */
const BUG_REPORT_TEMPLATE = {
  build: (params) => {
    const {
      projectInfo = {},
      retrievedContext = '',
      conversationHistory = [],
      userMessage = ''
    } = params;

    const role = PROMPT_COMPONENTS.ROLE('PurpleIQ, a QA expert specializing in bug report documentation');
    const context = PROMPT_COMPONENTS.CONTEXT(projectInfo, retrievedContext, conversationHistory);

    return `${role}

${context}

## Task Description

Format the user's bug report into a professional, structured bug report document suitable for development teams and issue tracking systems.

**User Bug Report/Request:** ${userMessage}

## Output Format Requirements

Structure the bug report with the following sections (use markdown headers):

### Title/Summary
- Clear, concise one-line summary (max 80 characters)
- Should uniquely identify the bug

### Description
- Detailed explanation of the bug
- What the bug is and why it matters
- Impact on users/functionality

### Steps to Reproduce
- Numbered list of exact steps (minimum 3 steps)
- Each step should be specific and actionable
- Include exact values, button names, field names

### Expected Behavior
- What should happen when following the steps
- Reference to requirements/PRD if applicable

### Actual Behavior
- What actually happens
- Include error messages, screenshots references, console errors

### Environment
- Browser (name and version)
- Operating System
- Device (if applicable)
- Application version/build

### Priority/Severity
- Critical/High/Medium/Low with justification

### Attachments/Screenshots
- List any screenshots, logs, or files attached

## Quality Requirements

### Minimum Requirements:
- **Length:** Minimum 200 words total
- **Steps:** Minimum 3 detailed, numbered steps
- **Sections:** All required sections must be present
- **Detail Level:** High - no vague descriptions

### Content Quality:
- NO placeholder text ([TODO], TBD, "example")
- Steps must be specific: "Click 'Submit' button in the form footer" NOT "Click submit"
- Expected/Actual must be clear and contrasting
- Environment must include specific versions

## Example

### Title/Summary
Login button does not respond when clicked on mobile Safari iOS 15.0

### Description
The login button on the authentication page becomes unresponsive when accessed via Safari browser on iOS 15.0 devices. Users cannot proceed with login, blocking access to the application. This affects approximately 30% of mobile users based on analytics.

### Steps to Reproduce
1. Open Safari browser on iPhone with iOS 15.0
2. Navigate to https://app.example.com/login
3. Enter valid email address in the email field
4. Enter valid password in the password field
5. Tap the "Sign In" button
6. Observe button behavior

### Expected Behavior
Button should respond to tap, show loading state, and redirect user to dashboard upon successful authentication.

### Actual Behavior
Button does not respond to tap. No visual feedback (no loading state, no error message). Button appears clickable but is non-functional. Console shows no JavaScript errors.

### Environment
- Browser: Safari 15.0
- Operating System: iOS 15.0
- Device: iPhone 12 Pro
- Application Version: 2.1.3

### Priority/Severity
High - Blocks critical user flow (authentication) for mobile users

### Attachments/Screenshots
- screenshot_login_button.png (shows button in unresponsive state)
- console_logs.txt (no errors logged)

## Instructions

1. Extract all bug information from the user's message
2. If information is missing, infer reasonable defaults or ask clarifying questions
3. Structure the bug report using the format above
4. Ensure all sections are complete and detailed
5. Reference project documents if they provide relevant context
6. Make the report actionable for developers

Now format the bug report based on the user's input.`;
  }
};

/**
 * TEST PLAN TEMPLATE
 */
const TEST_PLAN_TEMPLATE = {
  build: (params) => {
    const {
      projectInfo = {},
      retrievedContext = '',
      conversationHistory = [],
      userMessage = ''
    } = params;

    const role = PROMPT_COMPONENTS.ROLE('PurpleIQ, a senior QA strategist');
    const context = PROMPT_COMPONENTS.CONTEXT(projectInfo, retrievedContext, conversationHistory);

    return `${role}

${context}

## Task Description

Create a comprehensive test plan and testing strategy document for the project/feature based on the provided context and user requirements.

**User Request:** ${userMessage}

## Output Format Requirements

Structure the test plan with the following sections (use markdown headers ##):

### Test Objectives
- Clear goals of the testing effort
- What will be validated
- Success criteria

### Scope
- **In-Scope:** Features/modules to be tested
- **Out-of-Scope:** Features/modules explicitly excluded

### Test Approach/Strategy
- Overall testing methodology
- Testing levels (Unit, Integration, System, Acceptance)
- Testing types to be performed

### Test Types
- Functional Testing (list specific areas)
- Non-Functional Testing (Performance, Security, Usability, etc.)
- Regression Testing strategy
- Exploratory Testing approach

### Test Environment Requirements
- Hardware requirements
- Software requirements
- Test data requirements
- Access/permissions needed

### Test Data Requirements
- Types of test data needed
- Data setup procedures
- Data privacy/security considerations

### Risk Assessment
- High-risk areas
- Mitigation strategies
- Dependencies and blockers

### Timeline/Estimation
- Phases and milestones
- Time estimates per phase
- Resource allocation

### Resource Requirements
- Team size and roles
- Skills required
- Tools and licenses needed

### Entry/Exit Criteria
- **Entry Criteria:** Conditions that must be met before testing starts
- **Exit Criteria:** Conditions that must be met to complete testing

## Quality Requirements

### Minimum Requirements:
- **Length:** Minimum 500 words
- **Sections:** All required sections must be present
- **Detail Level:** Comprehensive - suitable for stakeholder review

### Content Quality:
- NO placeholder text ([TODO], TBD, "example")
- Be specific: "Test on Chrome 120, Firefox 121, Safari 17" NOT "Test on browsers"
- Include actionable items, not just high-level descriptions
- Reference project documents and requirements

## Example

### Test Objectives
Validate that the new payment gateway integration functions correctly, securely processes transactions, and maintains backward compatibility with existing payment methods. Success criteria: 100% of payment flows pass, zero security vulnerabilities, all edge cases handled.

### Scope
**In-Scope:**
- Credit card payment processing
- Debit card payment processing
- Payment gateway API integration
- Transaction logging and error handling
- Refund processing

**Out-of-Scope:**
- Cryptocurrency payments (future phase)
- International payment methods (Phase 2)
- Payment analytics dashboard (separate feature)

### Test Approach/Strategy
We will employ a risk-based testing approach, prioritizing critical payment flows. Testing will be performed at multiple levels: API integration testing, end-to-end user flow testing, and security penetration testing. Automation will cover regression scenarios, while manual testing will focus on exploratory and edge case scenarios.

## Instructions

1. Analyze the project documents to understand features and requirements
2. Identify all testable components and their relationships
3. Create a comprehensive test plan covering all aspects
4. Ensure the plan is actionable and suitable for stakeholder review
5. Reference specific requirements from project documents
6. Include realistic timelines and resource estimates

Now create the comprehensive test plan.`;
  }
};

/**
 * AUTOMATION SUGGESTION TEMPLATE
 */
const AUTOMATION_SUGGESTION_TEMPLATE = {
  build: (params) => {
    const {
      projectInfo = {},
      retrievedContext = '',
      conversationHistory = [],
      userMessage = ''
    } = params;

    const role = PROMPT_COMPONENTS.ROLE('PurpleIQ, an automation testing expert');
    const context = PROMPT_COMPONENTS.CONTEXT(projectInfo, retrievedContext, conversationHistory);

    const techStack = projectInfo.techStack || 'Web application';
    const suggestedFramework = techStack.includes('React') || techStack.includes('Vue') || techStack.includes('Angular')
      ? 'Playwright or Cypress'
      : techStack.includes('Mobile')
      ? 'Appium'
      : 'Playwright or Selenium';

    return `${role}

${context}

## Task Description

Analyze the feature/requirement and provide practical automation strategies, framework recommendations, and implementation suggestions with code examples.

**User Request:** ${userMessage}
**Technology Stack:** ${techStack}

## Output Format Requirements

Structure the automation suggestions with the following sections (use markdown headers ##):

### Automation Opportunities
- List 3-5 specific test scenarios that should be automated
- Explain why each is a good candidate for automation
- ROI justification (time saved, frequency of execution)

### Framework Recommendations
- Recommended framework(s) with justification
- Alternative frameworks and when to use them
- Framework comparison (pros/cons)

### Test Structure and Organization
- Recommended folder structure
- Test naming conventions
- Page Object Model (POM) or similar pattern recommendations

### Sample Automation Code
- At least 2-3 code examples using the recommended framework
- Include setup/configuration examples
- Show best practices (wait strategies, assertions, error handling)

### Best Practices
- Automation best practices specific to this project
- Maintenance strategies
- CI/CD integration recommendations

### Maintenance Strategy
- How to keep automation tests maintainable
- Review and update procedures
- Handling flaky tests

## Quality Requirements

### Minimum Requirements:
- **Suggestions:** Minimum 3-5 specific automation opportunities
- **Code Examples:** Minimum 2-3 working code snippets
- **Length:** Minimum 400 words
- **Detail Level:** Practical and actionable

### Content Quality:
- NO placeholder text ([TODO], TBD, "example")
- Code examples must be complete and runnable (with setup)
- Recommendations must be justified with reasoning
- Consider project's technology stack

## Example

### Automation Opportunities

1. **Login Flow Automation** (High Priority)
   - **Why:** Executed in every test run, critical path, stable flow
   - **ROI:** Saves 5 minutes per test run × 20 runs/day = 100 minutes/day
   - **Frequency:** Executed before every feature test

2. **Payment Processing End-to-End** (High Priority)
   - **Why:** Complex flow with multiple steps, regression risk high
   - **ROI:** Manual testing takes 15 minutes, automation takes 2 minutes
   - **Frequency:** Executed in every release cycle

### Framework Recommendations

**Recommended: Playwright**
- **Pros:** Fast execution, excellent debugging, built-in wait strategies, cross-browser support, TypeScript support
- **Cons:** Newer framework, smaller community than Selenium
- **Why:** Best fit for modern web applications, excellent API for async operations

**Alternative: Cypress**
- **Pros:** Great developer experience, time-travel debugging, real-time reload
- **Cons:** Limited cross-browser support, single-domain limitation
- **When to use:** If team prefers JavaScript and doesn't need cross-browser testing

### Sample Automation Code

\`\`\`typescript
// tests/login.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Login Flow', () => {
  test('should login successfully with valid credentials', async ({ page }) => {
    // Navigate to login page
    await page.goto('https://app.example.com/login');
    
    // Fill login form
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'SecurePass123!');
    
    // Click login button
    await page.click('button[type="submit"]');
    
    // Wait for navigation and verify success
    await page.waitForURL('**/dashboard');
    await expect(page.locator('h1')).toContainText('Dashboard');
  });
});
\`\`\`

## Instructions

1. Analyze the feature/requirement from the context
2. Identify specific automation opportunities with ROI justification
3. Recommend appropriate frameworks based on technology stack
4. Provide complete, runnable code examples
5. Include best practices and maintenance strategies
6. Make recommendations practical and actionable

Now provide automation suggestions based on the context.`;
  }
};

module.exports = {
  TEST_CASE_GENERATION_TEMPLATE,
  BUG_REPORT_TEMPLATE,
  TEST_PLAN_TEMPLATE,
  AUTOMATION_SUGGESTION_TEMPLATE,
  PROMPT_COMPONENTS
};

