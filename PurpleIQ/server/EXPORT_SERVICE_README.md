# Export Service Documentation

## Overview

The Export Service provides professional export functionality for:
- **Excel**: Test cases with professional styling
- **PDF**: Bug reports with formatting
- **DOCX**: Test plans with structured documents

## API Endpoints

### 1. Export Test Cases to Excel

**Endpoint:** `POST /api/export/excel`

**Request Body:**
```json
{
  "testCases": [
    {
      "testCaseId": "TC_LOGIN_001",
      "module": "Authentication",
      "description": "Verify successful login with valid credentials",
      "preconditions": ["User account exists", "User is on login page"],
      "steps": [
        "Step 1: Enter email 'test@example.com'",
        "Step 2: Enter password 'SecurePass123!'",
        "Step 3: Click 'Sign In' button"
      ],
      "expectedResults": "User is redirected to dashboard",
      "priority": "High",
      "type": "Positive"
    }
  ],
  "projectName": "E-Commerce Platform"
}
```

**Response:**
- Content-Type: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- File download with filename: `TestCases_ProjectName_timestamp.xlsx`

**Features:**
- ✅ Professional blue header (#4472C4) with white text
- ✅ Bold headers
- ✅ Auto-width columns
- ✅ Auto-filter on header row
- ✅ Frozen header row
- ✅ Alternate row colors for readability
- ✅ Text wrapping for long content
- ✅ Summary sheet with statistics and formulas

---

### 2. Export Bug Report to PDF

**Endpoint:** `POST /api/export/pdf`

**Request Body:**
```json
{
  "bugReport": {
    "title": "Login button does not respond on mobile Safari",
    "description": "The login button becomes unresponsive when accessed via Safari on iOS 15.0",
    "steps": [
      "Open Safari browser on iPhone with iOS 15.0",
      "Navigate to https://app.example.com/login",
      "Enter valid email and password",
      "Tap the 'Sign In' button"
    ],
    "expectedBehavior": "Button should respond to tap and redirect to dashboard",
    "actualBehavior": "Button does not respond, no visual feedback",
    "environment": "Safari 15.0, iOS 15.0, iPhone 12 Pro",
    "priority": "High"
  },
  "screenshots": ["base64_encoded_image_1", "base64_encoded_image_2"]
}
```

**Or as markdown string:**
```json
{
  "bugReport": "# Title/Summary\nLogin button does not respond...\n\n## Description\n...\n\n## Steps to Reproduce\n1. Open Safari...\n2. Navigate to...\n\n## Expected Behavior\n...\n\n## Actual Behavior\n..."
}
```

**Response:**
- Content-Type: `application/pdf`
- File download with filename: `BugReport_timestamp.pdf`

**Features:**
- ✅ Professional PDF formatting
- ✅ Structured sections (Title, Description, Steps, Expected, Actual, Environment, Priority)
- ✅ Screenshot support (base64 encoded images)
- ✅ Proper page breaks
- ✅ Footer with generation timestamp

---

### 3. Export Test Plan to DOCX

**Endpoint:** `POST /api/export/docx`

**Request Body:**
```json
{
  "testPlan": {
    "objectives": "Validate payment gateway integration...",
    "scope": "In-Scope: Credit card payments, Debit card payments...",
    "approach": "Risk-based testing approach...",
    "types": "Functional Testing, Non-Functional Testing...",
    "environment": "Test environment with staging database...",
    "data": "Test credit cards, user accounts...",
    "risks": "High-risk areas: Payment processing, Security...",
    "timeline": "Phase 1: 2 weeks, Phase 2: 1 week...",
    "resources": "2 QA engineers, 1 automation engineer...",
    "criteria": "Entry: Code deployed to staging, Exit: All critical tests pass"
  },
  "projectName": "E-Commerce Platform"
}
```

**Or as markdown string:**
```json
{
  "testPlan": "# Test Plan\n\n## Test Objectives\n...\n\n## Scope\n...\n\n## Test Approach\n...",
  "projectName": "E-Commerce Platform"
}
```

**Response:**
- Content-Type: `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- File download with filename: `TestPlan_ProjectName_timestamp.docx`

**Features:**
- ✅ Professional document structure
- ✅ Table of contents
- ✅ All required sections (Scope, Approach, Schedule, Resources, Risks)
- ✅ Proper heading hierarchy
- ✅ Clean formatting

---

## Usage Examples

### JavaScript/TypeScript (Frontend)

```javascript
// Export test cases to Excel
async function exportTestCases() {
  const testCases = [
    {
      testCaseId: "TC_LOGIN_001",
      module: "Authentication",
      description: "Verify successful login",
      preconditions: ["User account exists"],
      steps: ["Step 1: Enter email", "Step 2: Enter password", "Step 3: Click login"],
      expectedResults: "User redirected to dashboard",
      priority: "High",
      type: "Positive"
    }
  ];

  const response = await fetch('http://localhost:5000/api/export/excel', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      testCases: testCases,
      projectName: "My Project"
    })
  });

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `TestCases_${Date.now()}.xlsx`;
  a.click();
}

// Export bug report to PDF
async function exportBugReport() {
  const bugReport = {
    title: "Login button not working",
    description: "The login button does not respond when clicked",
    steps: [
      "Navigate to login page",
      "Enter credentials",
      "Click login button"
    ],
    expectedBehavior: "User should be logged in",
    actualBehavior: "Nothing happens",
    environment: "Chrome 120, Windows 11",
    priority: "High"
  };

  const response = await fetch('http://localhost:5000/api/export/pdf', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      bugReport: bugReport
    })
  });

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `BugReport_${Date.now()}.pdf`;
  a.click();
}

// Export test plan to DOCX
async function exportTestPlan() {
  const testPlan = {
    objectives: "Validate all payment flows",
    scope: "In-Scope: Payment processing, Out-of-Scope: Analytics",
    approach: "Risk-based testing",
    types: "Functional, Integration, Security",
    environment: "Staging environment",
    data: "Test credit cards",
    risks: "Payment gateway downtime",
    timeline: "2 weeks",
    resources: "2 QA engineers",
    criteria: "All critical tests pass"
  };

  const response = await fetch('http://localhost:5000/api/export/docx', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      testPlan: testPlan,
      projectName: "My Project"
    })
  });

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `TestPlan_${Date.now()}.docx`;
  a.click();
}
```

### cURL Examples

```bash
# Export test cases to Excel
curl -X POST http://localhost:5000/api/export/excel \
  -H "Content-Type: application/json" \
  -d '{
    "testCases": [
      {
        "testCaseId": "TC_001",
        "description": "Test case description",
        "steps": ["Step 1", "Step 2"],
        "expectedResults": "Expected result",
        "priority": "High",
        "type": "Positive"
      }
    ],
    "projectName": "My Project"
  }' \
  --output testcases.xlsx

# Export bug report to PDF
curl -X POST http://localhost:5000/api/export/pdf \
  -H "Content-Type: application/json" \
  -d '{
    "bugReport": {
      "title": "Bug title",
      "description": "Bug description",
      "steps": ["Step 1", "Step 2"],
      "expectedBehavior": "Expected",
      "actualBehavior": "Actual",
      "priority": "High"
    }
  }' \
  --output bugreport.pdf

# Export test plan to DOCX
curl -X POST http://localhost:5000/api/export/docx \
  -H "Content-Type: application/json" \
  -d '{
    "testPlan": {
      "objectives": "Test objectives",
      "scope": "Test scope"
    },
    "projectName": "My Project"
  }' \
  --output testplan.docx
```

---

## Error Handling

All endpoints return standard error responses:

```json
{
  "error": "Bad Request",
  "message": "testCases array is required and must not be empty"
}
```

**Status Codes:**
- `200`: Success (file download)
- `400`: Bad Request (missing/invalid parameters)
- `500`: Internal Server Error (export generation failed)

---

## Dependencies

- **exceljs**: Excel file generation
- **pdfkit**: PDF file generation
- **docx**: DOCX file generation

All dependencies are installed via `npm install`.

---

## File Structure

```
server/
├── services/
│   └── ExportService.js    # Export service implementation
├── routes/
│   └── export.js           # Export API endpoints
└── index.js                # Server setup (exports routes registered)
```

---

## Notes

- Excel files include a summary sheet with statistics and formulas
- PDF files support screenshots (base64 encoded)
- DOCX files include a table of contents
- All exports are generated server-side and returned as buffers
- Filenames are sanitized to remove special characters
- File sizes are limited by Express body parser (default 50MB)

