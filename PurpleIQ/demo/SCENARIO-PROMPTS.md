# 🎯 Quick Reference: Demo Scenario Prompts

Copy-paste these exact prompts during your demo for consistent, impressive results.

---

## 📋 SCENARIO 1: Memory Proof

### Prompt 1 (Initial Test Cases)
```
Generate comprehensive test cases for the login module
```

### Prompt 2 (API Tests - Memory Test)
```
Now generate API test cases for the same login flows. Include request/response formats, status codes, and authentication headers.
```

### Alternative Prompt 2 (If first doesn't reference login flows)
```
Generate API test cases that correspond to the UI test cases we generated earlier for the login module. Include REST endpoints, request bodies, response formats, status codes, and authentication token handling.
```

---

## 📋 SCENARIO 2: Multi-Format Power

### Setup
1. Upload: `payment-gateway.txt` (or PDF)
2. Upload: `payment-acceptance-criteria.docx`
3. Upload: `payment-edge-cases.txt`

### Main Prompt
```
Generate comprehensive test cases for the payment gateway using all the uploaded documents. Make sure to cover requirements from the PRD, acceptance criteria from the Word doc, and edge cases from the text file.
```

### Alternative (If sources aren't clear)
```
Generate test cases for the payment gateway. Use information from ALL three uploaded documents: the PDF PRD, the DOCX acceptance criteria, and the TXT edge cases. Reference which document each test case comes from.
```

---

## 📋 SCENARIO 3: Quality Improvement Loop

### Prompt 1 (Initial Test Cases)
```
Generate test cases for user registration
```

### Prompt 2 (Self-Evaluation)
```
Review the test cases you just generated. Are there any missing edge cases, security scenarios, or boundary conditions? If yes, generate 5 additional test cases to fill the gaps.
```

### Alternative Prompt 2 (If too generic)
```
Be critical - review the test cases you just generated. Identify specific gaps in:
1. Security scenarios (SQL injection, XSS, CSRF)
2. Edge cases (boundary conditions, invalid inputs)
3. Performance scenarios (rate limiting, concurrent requests)
4. Error handling (network failures, timeout scenarios)

List the gaps first, then generate exactly 5 additional test cases that address these gaps.
```

---

## 🎯 Backup Prompts (If Things Go Wrong)

### If response is too generic:
```
Be more specific and detailed. Include preconditions, test steps, expected results, and test data for each test case.
```

### If sources aren't showing:
```
Show me which documents you used to generate this response, and highlight the specific sections from each document.
```

### If conversation history isn't working:
```
Reference the previous conversation where we discussed [topic]. Use that context to [action].
```

### If self-evaluation doesn't find gaps:
```
Be more thorough in your review. Think about:
- Security vulnerabilities
- Performance edge cases
- Boundary conditions
- Error scenarios
- Integration points

What's missing?
```

---

## 📝 Pro Tips

1. **Copy-paste these prompts** - Don't type them live (saves time, avoids typos)
2. **Have them ready in a text file** - Quick access during demo
3. **Practice saying them naturally** - Don't sound like you're reading
4. **Be ready to adapt** - If a prompt doesn't work, use the alternative

---

**Good luck! 🚀**

