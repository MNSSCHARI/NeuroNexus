# 🎯 Killer Demo Scenarios for PurpleIQ

Three powerful scenarios designed to make judges say **"Wow, I've never seen that before!"**

---

## 📋 SCENARIO 1: "Memory Proof" - Contextual Memory Across Requests

### 🎬 **The Hook**
*"Most AI tools forget everything after each request. Watch PurpleIQ remember context and build on previous conversations."*

### 📝 **Setup (Before Demo)**
1. Create a project called **"Login Module Demo"**
2. Upload: `demo/sample-prds/login-module.txt`
3. Wait for processing to complete

### 🎯 **Demo Flow**

#### **Step 1: Initial Test Case Generation** (2 minutes)
**Action:**
```
Ask: "Generate comprehensive test cases for the login module"
```

**Expected Output:**
- 15-20 test cases covering:
  - Positive scenarios (valid credentials)
  - Negative scenarios (invalid credentials, empty fields)
  - Edge cases (SQL injection attempts, special characters)
  - Security scenarios (password visibility, session management)

**What to Highlight:**
- ✅ "Notice how PurpleIQ analyzed the entire PRD and generated comprehensive test cases"
- ✅ "Look at the coverage - positive, negative, edge cases, and security scenarios"
- ✅ "Each test case includes preconditions, steps, and expected results"

**Talking Points:**
- "PurpleIQ just analyzed our login module PRD and generated 18 test cases covering all scenarios"
- "Notice the quality - each test case has clear steps, preconditions, and expected results"
- "But here's where it gets interesting - watch what happens next..."

---

#### **Step 2: Memory Test - API Tests Without Re-uploading** (2 minutes)
**Action:**
```
Ask: "Now generate API test cases for the same login flows. Include request/response formats, status codes, and authentication headers."
```

**Expected Output:**
- 10-15 API test cases that:
  - Reference the login flows from Step 1
  - Include REST endpoints (POST /api/login, GET /api/logout, etc.)
  - Specify request bodies, headers, status codes
  - Include authentication token handling
  - Reference the same user flows (email/password, OAuth, etc.)

**What to Highlight:**
- ✅ **"Notice - we didn't re-upload anything!"**
- ✅ "PurpleIQ remembered the login module details from the previous conversation"
- ✅ "It's generating API tests that reference the same flows we discussed"
- ✅ "Look at how it's connecting the UI flows to API endpoints"

**Talking Points:**
- "Here's the magic - we didn't re-upload the PRD. PurpleIQ remembered everything from our previous conversation."
- "Watch how it's generating API tests that directly reference the login flows we just created."
- "This is contextual memory - PurpleIQ maintains conversation context across multiple requests."

---

#### **Step 3: Show Conversation History** (1 minute)
**Action:**
1. Open browser DevTools (F12)
2. Navigate to: `http://localhost:5000/api/chat/{projectId}/history`
3. Or add a UI button to show history (if implemented)

**Expected Output:**
```json
{
  "projectId": "...",
  "history": [
    {
      "timestamp": "2026-01-29T10:30:00Z",
      "user": "Generate comprehensive test cases for the login module",
      "assistant": "[Full response with test cases]",
      "taskType": "Test Case Generation",
      "documentsUsed": ["login-module.txt"]
    },
    {
      "timestamp": "2026-01-29T10:32:00Z",
      "user": "Now generate API test cases for the same login flows...",
      "assistant": "[Full response with API test cases]",
      "taskType": "Test Case Generation",
      "documentsUsed": ["login-module.txt"]
    }
  ],
  "count": 2
}
```

**What to Highlight:**
- ✅ "See the conversation history - both requests are stored"
- ✅ "Notice how the second request references the first"
- ✅ "This proves PurpleIQ maintains context across the entire conversation"

**Talking Points:**
- "Let me show you the conversation history. See how PurpleIQ tracked both requests?"
- "The second request didn't need the PRD again - it remembered everything from the first conversation."
- "This is what we call 'Memory Proof' - PurpleIQ doesn't just answer questions, it remembers and builds on previous conversations."

---

### 🎯 **Key Value Propositions to Emphasize**

1. **Contextual Memory**
   - "Unlike ChatGPT or other tools, PurpleIQ remembers your project context across requests"
   - "You don't need to re-upload documents or repeat context in every message"

2. **Intelligent Workflow Routing**
   - "Notice how PurpleIQ automatically detected both requests were test case generation"
   - "It routed to the same workflow but adapted the output format (UI tests → API tests)"

3. **Document Awareness**
   - "PurpleIQ knows which documents were used in each conversation"
   - "It can reference specific parts of your PRD without you having to quote them"

---

### ⚠️ **Troubleshooting**

**If API tests don't reference login flows:**
- Say: "Let me refine the prompt" and ask: "Generate API test cases that correspond to the UI test cases we generated earlier for the login module"

**If conversation history isn't showing:**
- Use the API endpoint directly: `GET /api/chat/{projectId}/history`
- Or check server logs for conversation saves

**If response is generic:**
- Ensure demo mode is OFF for this scenario (we want real AI responses)
- Check that the PRD was processed correctly (check vector store)

---

### 📊 **Success Metrics**

- ✅ Generated 15+ test cases in first request
- ✅ Generated 10+ API test cases in second request
- ✅ API tests reference login flows from first request
- ✅ Conversation history shows both requests
- ✅ No re-upload needed between requests

---

## 📋 SCENARIO 2: "Multi-Format Power" - Intelligent Document Fusion

### 🎬 **The Hook**
*"Real projects have requirements scattered across PDFs, Word docs, and text files. Watch PurpleIQ intelligently combine them all."*

### 📝 **Setup (Before Demo)**
1. Create a project called **"Payment Gateway Demo"**
2. Upload three documents in sequence:
   - `demo/sample-prds/payment-gateway.txt` (Main PRD)
   - Create a DOCX file with acceptance criteria (or use existing)
   - Create a TXT file with additional edge cases (or use existing)

**Note:** Currently, PurpleIQ supports PDF, DOCX, and TXT. For screenshots, we can mention this as a future enhancement, or convert the screenshot to a text description in a TXT file.

### 🎯 **Demo Flow**

#### **Step 1: Upload Multiple Formats** (1 minute)
**Action:**
1. Upload `payment-gateway.txt` (PDF format if available)
2. Upload `payment-acceptance-criteria.docx` (DOCX format)
3. Upload `payment-edge-cases.txt` (TXT format)

**What to Highlight:**
- ✅ "Watch PurpleIQ process three different file formats"
- ✅ "PDF for requirements, DOCX for acceptance criteria, TXT for edge cases"
- ✅ "All being indexed and made searchable"

**Talking Points:**
- "In real projects, requirements are scattered across different formats"
- "Here we have a PDF PRD, a Word doc with acceptance criteria, and a text file with edge cases"
- "PurpleIQ processes all of them and creates a unified knowledge base"

---

#### **Step 2: Intelligent Multi-Source Query** (3 minutes)
**Action:**
```
Ask: "Generate comprehensive test cases for the payment gateway using all the uploaded documents. Make sure to cover requirements from the PRD, acceptance criteria from the Word doc, and edge cases from the text file."
```

**Expected Output:**
- 20-25 test cases that:
  - Reference requirements from the PDF PRD
  - Include acceptance criteria from the DOCX file
  - Cover edge cases from the TXT file
  - Show sources for each test case (which document it came from)

**What to Highlight:**
- ✅ "Look at the sources - PurpleIQ is pulling from all three documents"
- ✅ "Each test case references which document it came from"
- ✅ "Notice how it's combining information intelligently - not just concatenating"
- ✅ "The test cases are comprehensive because PurpleIQ used ALL the sources"

**Talking Points:**
- "Watch PurpleIQ search across all three documents simultaneously"
- "It's not just reading them separately - it's intelligently combining information"
- "See how each test case references its source? That's transparency"
- "This is what we call 'Intelligent Document Fusion' - PurpleIQ creates a unified understanding from multiple sources"

---

#### **Step 3: Show Source Attribution** (1 minute)
**Action:**
Point to the "Sources" section in the response

**Expected Output:**
```
Sources:
- payment-gateway.txt (similarity: 0.9234)
- payment-acceptance-criteria.docx (similarity: 0.8765)
- payment-edge-cases.txt (similarity: 0.8123)
```

**What to Highlight:**
- ✅ "PurpleIQ shows you exactly which documents it used"
- ✅ "Similarity scores tell you how relevant each document was"
- ✅ "This is full transparency - you know where the information came from"

**Talking Points:**
- "PurpleIQ doesn't just combine documents - it shows you exactly what it used"
- "The similarity scores tell you how relevant each document was to your query"
- "This is crucial for audit trails and understanding AI decisions"

---

### 🎯 **Key Value Propositions to Emphasize**

1. **Multi-Format Support**
   - "PurpleIQ handles PDF, DOCX, and TXT seamlessly"
   - "No need to convert files - upload them as-is"

2. **Intelligent Fusion**
   - "PurpleIQ doesn't just concatenate documents - it understands relationships"
   - "It can connect requirements from one doc with acceptance criteria from another"

3. **Source Attribution**
   - "Every response shows which documents were used"
   - "Similarity scores provide transparency and auditability"

4. **Unified Knowledge Base**
   - "All documents become part of a unified, searchable knowledge base"
   - "Query once, search across all documents"

---

### ⚠️ **Troubleshooting**

**If only one document is used:**
- Refine the query: "Use information from ALL three uploaded documents: the PDF PRD, the DOCX acceptance criteria, and the TXT edge cases"

**If sources aren't showing:**
- Check that documents were processed (check project document count)
- Verify vector store has chunks from all documents

**If test cases are generic:**
- Be more specific: "Generate test cases that specifically reference the payment gateway requirements from the PDF, the acceptance criteria from the DOCX, and the edge cases from the TXT file"

---

### 📊 **Success Metrics**

- ✅ All three documents processed and indexed
- ✅ Test cases reference all three documents
- ✅ Sources section shows all three documents
- ✅ Test cases are comprehensive (20+ test cases)
- ✅ Each test case can be traced to a source document

---

## 📋 SCENARIO 3: "Quality Improvement Loop" - Self-Evaluation & Enhancement

### 🎬 **The Hook**
*"What if the AI could evaluate its own work and improve it? Watch PurpleIQ self-assess and enhance test cases in real-time."*

### 📝 **Setup (Before Demo)**
1. Create a project called **"User Registration Demo"**
2. Upload: `demo/sample-prds/user-registration.txt`
3. Wait for processing

### 🎯 **Demo Flow**

#### **Step 1: Generate Initial Test Cases** (2 minutes)
**Action:**
```
Ask: "Generate test cases for user registration"
```

**Expected Output:**
- 12-15 test cases covering:
  - Basic registration flow
  - Email validation
  - Password requirements
  - Some edge cases

**What to Highlight:**
- ✅ "PurpleIQ generated 15 test cases for user registration"
- ✅ "Good coverage of basic scenarios"
- ✅ "But let's see if we can improve it..."

**Talking Points:**
- "PurpleIQ just generated 15 test cases - that's a solid start"
- "But here's where it gets interesting - what if we ask PurpleIQ to evaluate its own work?"

---

#### **Step 2: Self-Evaluation Request** (2 minutes)
**Action:**
```
Ask: "Review the test cases you just generated. Are there any missing edge cases, security scenarios, or boundary conditions? If yes, generate 5 additional test cases to fill the gaps."
```

**Expected Output:**
- Self-evaluation response that:
  - Acknowledges what was covered well
  - Identifies gaps (e.g., "Missing: rate limiting, concurrent registration, email domain validation, password complexity edge cases, session timeout")
  - Generates 5 additional test cases covering:
    - Rate limiting (too many registration attempts)
    - Concurrent registration (same email from multiple sessions)
    - Email domain validation (invalid domains, disposable emails)
    - Password complexity edge cases (special characters, unicode)
    - Session timeout during registration

**What to Highlight:**
- ✅ "PurpleIQ is evaluating its own work!"
- ✅ "It identified 5 gaps that weren't covered"
- ✅ "Now it's generating additional test cases to fill those gaps"
- ✅ "This is self-improvement in action"

**Talking Points:**
- "Watch this - PurpleIQ is reviewing its own test cases"
- "It identified gaps: rate limiting, concurrent registration, email domain validation..."
- "Now it's generating 5 additional test cases to fill those gaps"
- "This is what we call the 'Quality Improvement Loop' - PurpleIQ can self-evaluate and enhance its own work"

---

#### **Step 3: Before/After Comparison** (1 minute)
**Action:**
1. Show the initial test cases (Step 1)
2. Show the additional test cases (Step 2)
3. Highlight the improvement

**Expected Output:**
```
BEFORE (Initial):
- 15 test cases
- Basic coverage: registration flow, email validation, password requirements

AFTER (Enhanced):
- 20 test cases total (15 + 5 new)
- Enhanced coverage: + rate limiting, + concurrent registration, + email domain validation, + password complexity edge cases, + session timeout
```

**What to Highlight:**
- ✅ "Before: 15 test cases with basic coverage"
- ✅ "After: 20 test cases with enhanced coverage"
- ✅ "PurpleIQ identified and filled 5 critical gaps"
- ✅ "This is continuous improvement - the AI gets better with feedback"

**Talking Points:**
- "Let's compare: Before, we had 15 test cases. After self-evaluation, we have 20."
- "PurpleIQ didn't just add random test cases - it identified specific gaps and filled them"
- "This is the Quality Improvement Loop - PurpleIQ can iterate and improve its own work"
- "Imagine doing this for every test suite - continuous quality improvement"

---

### 🎯 **Key Value Propositions to Emphasize**

1. **Self-Evaluation Capability**
   - "PurpleIQ can review its own work and identify gaps"
   - "It's not just generating - it's thinking critically about quality"

2. **Continuous Improvement**
   - "The Quality Improvement Loop means PurpleIQ gets better with each iteration"
   - "You can ask it to evaluate and enhance its own outputs"

3. **Gap Analysis**
   - "PurpleIQ identifies specific gaps: security, edge cases, boundary conditions"
   - "It doesn't just add more - it adds what's missing"

4. **Quality Assurance**
   - "This is like having a QA reviewer built into the AI"
   - "PurpleIQ ensures comprehensive coverage by self-evaluating"

---

### ⚠️ **Troubleshooting**

**If self-evaluation is generic:**
- Be more specific: "Review the test cases and identify specific gaps in edge cases, security scenarios, or boundary conditions. List the gaps first, then generate test cases to fill them."

**If no gaps are identified:**
- Say: "Let me ask it to be more critical" and ask: "Be more thorough - are there any security vulnerabilities, performance edge cases, or boundary conditions that weren't covered?"

**If additional test cases aren't generated:**
- Explicitly request: "Generate exactly 5 additional test cases that cover the gaps you identified"

---

### 📊 **Success Metrics**

- ✅ Initial test cases generated (12-15 test cases)
- ✅ Self-evaluation identifies specific gaps (3-5 gaps)
- ✅ Additional test cases generated (5 new test cases)
- ✅ Total test cases increased (15 → 20)
- ✅ New test cases address identified gaps

---

## 🎬 **Demo Presentation Tips**

### **Opening (30 seconds)**
- "I'm going to show you three scenarios that demonstrate PurpleIQ's unique capabilities"
- "These aren't just features - they're game-changers for QA teams"

### **Between Scenarios (10 seconds each)**
- "That was Scenario 1 - Memory Proof. Now let's see Scenario 2 - Multi-Format Power"
- "And finally, Scenario 3 - the Quality Improvement Loop"

### **Closing (30 seconds)**
- "These three scenarios show what makes PurpleIQ different:"
  - "Contextual memory across conversations"
  - "Intelligent fusion of multiple document formats"
  - "Self-evaluation and continuous improvement"
- "This isn't just another AI tool - it's an intelligent QA assistant that learns and improves"

---

## 📋 **Quick Reference: Exact Prompts**

### **Scenario 1: Memory Proof**
1. `"Generate comprehensive test cases for the login module"`
2. `"Now generate API test cases for the same login flows. Include request/response formats, status codes, and authentication headers."`

### **Scenario 2: Multi-Format Power**
1. Upload: PDF, DOCX, TXT (3 documents)
2. `"Generate comprehensive test cases for the payment gateway using all the uploaded documents. Make sure to cover requirements from the PRD, acceptance criteria from the Word doc, and edge cases from the text file."`

### **Scenario 3: Quality Improvement Loop**
1. `"Generate test cases for user registration"`
2. `"Review the test cases you just generated. Are there any missing edge cases, security scenarios, or boundary conditions? If yes, generate 5 additional test cases to fill the gaps."`

---

## 🎯 **Judges' "Wow" Moments**

1. **Memory Proof**: "Wait, it remembered the login flows without re-uploading? That's incredible!"
2. **Multi-Format Power**: "It's combining information from three different documents intelligently!"
3. **Quality Improvement Loop**: "The AI is evaluating and improving its own work? That's next-level!"

---

## ⚡ **Pro Tips**

1. **Practice the timing** - Each scenario should be 3-4 minutes
2. **Have backup prompts ready** - If a response isn't perfect, have refined prompts ready
3. **Show the sources** - Always point to the "Sources" section to show transparency
4. **Emphasize the "wow"** - Don't just show features, explain why they're game-changers
5. **Be confident** - These scenarios are designed to impress - own it!

---

**Total Demo Time: 10-12 minutes (3-4 minutes per scenario)**

Good luck! 🚀

