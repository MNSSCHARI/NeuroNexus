# ✅ Pre-Demo Comprehensive Checklist

Run this checklist **24 hours before demo** to ensure everything works.

## Quick Start

```bash
# Run automated checklist
node demo/pre-demo-checklist.js
```

This will:
- ✅ Run all automated checks
- ✅ Test all features
- ✅ Generate detailed report
- ✅ Save results to `checklist-results.json`

---

## 📊 TECHNICAL CHECKS

### ✅ Health Check Endpoint
- [ ] Health check endpoint returns all green
- [ ] All services show status "up"
- [ ] Response times are reasonable (< 2 seconds)

**Test:**
```bash
curl "http://localhost:5000/api/health"
```

**Expected:**
```json
{
  "status": "healthy",
  "checks": {
    "server": { "status": "up" },
    "openai": { "status": "up" },
    "gemini": { "status": "up" },
    ...
  }
}
```

---

### ✅ API Keys Valid
- [ ] OpenAI API key is valid and working
- [ ] Gemini API key is valid and working (if using)
- [ ] API keys are not expired
- [ ] API keys have sufficient quota

**Test:**
- Check health endpoint (includes API key validation)
- Or test manually: `GET /api/health`

**Fix if fails:**
- Update API keys in `.env` file
- Verify keys in project settings
- Check API quotas/limits

---

### ✅ Vector Search Returns Good Results
- [ ] Test with 5 different queries
- [ ] All queries return relevant results
- [ ] Similarity scores are reasonable (> 0.4)
- [ ] Results include document sources

**Test:**
```bash
# Run vector search debug
curl "http://localhost:5000/api/debug/vector-search/PROJECT_ID?query=login"
```

**Expected:**
- Top similarity score > 0.4
- At least 3-5 results per query
- Results reference actual document content

**Fix if fails:**
- Check documents are uploaded and indexed
- Lower similarity threshold if needed
- Review chunking quality

---

### ✅ Test Case Generation Works
- [ ] Test 3 times with different queries
- [ ] All tests return valid test cases
- [ ] Test cases have proper structure
- [ ] Response time is reasonable (< 10 seconds)

**Test Queries:**
1. "Generate test cases for login"
2. "Create test cases for user registration"
3. "Generate test cases for payment"

**Expected:**
- Each query returns structured test cases
- Test cases include: ID, description, steps, expected results
- Response is formatted correctly

**Fix if fails:**
- Check AI service is working
- Verify API keys are valid
- Check server logs for errors

---

### ✅ Exports Work
- [ ] Excel export works (test with 3 test cases)
- [ ] PDF export works (test with bug report)
- [ ] DOCX export works (test with test plan)
- [ ] Files can be opened in respective applications
- [ ] Files contain correct data

**Test:**
```bash
# Test all exports
curl "http://localhost:5000/api/export/test"
```

**Expected:**
- All three exports succeed
- Test files created in `server/data/test-exports/`
- Files can be opened in Excel/Word/PDF viewer

**Fix if fails:**
- Check dependencies: `npm install exceljs pdfkit docx`
- Review export debug guide: `server/EXPORT_DEBUG_GUIDE.md`
- Check server logs for errors

---

### ✅ Demo Mode Works
- [ ] Demo mode can be toggled on/off
- [ ] Demo mode returns pre-generated responses
- [ ] Demo responses are consistent

**Test:**
```bash
# Enable demo mode
curl -X POST "http://localhost:5000/api/settings/demo-mode" \
  -H "Content-Type: application/json" \
  -d '{"enabled": true}'

# Test with a query
curl -X POST "http://localhost:5000/api/chat/PROJECT_ID" \
  -H "Content-Type: application/json" \
  -d '{"question": "Generate test cases for login"}'
```

**Expected:**
- Demo mode toggles successfully
- Responses are consistent (same for same query)
- Responses match demo-responses.json

**Fix if fails:**
- Check `server/data/demo-responses.json` exists
- Verify demo mode toggle endpoint works
- Check server logs

---

### ✅ Fallback Responses Loaded
- [ ] Demo responses file exists
- [ ] File contains test cases
- [ ] File contains bug reports
- [ ] File contains test plans

**Check:**
```bash
# Check file exists
ls server/data/demo-responses.json

# View content (first few lines)
head -20 server/data/demo-responses.json
```

**Expected:**
- File exists at `server/data/demo-responses.json`
- Contains `test_cases`, `bug_reports`, `test_plans` sections
- Each section has multiple entries

**Fix if fails:**
- Verify file exists
- Check file has valid JSON structure
- Ensure file is not empty

---

### ✅ Logging is Working
- [ ] Server logs are being written
- [ ] Error logs are captured
- [ ] Debug logs are visible (if enabled)

**Check:**
- Look at server console output
- Check for log files (if configured)
- Verify errors are logged

**Fix if fails:**
- Check logger configuration
- Verify log directory exists
- Check file permissions

---

### ✅ Error Handling Catches All Errors
- [ ] API errors are caught and returned properly
- [ ] Client receives error messages (not crashes)
- [ ] Error responses have proper format

**Test:**
```bash
# Test with invalid request
curl -X POST "http://localhost:5000/api/chat/INVALID_ID" \
  -H "Content-Type: application/json" \
  -d '{"question": "test"}'
```

**Expected:**
- Returns 404 or 400 error (not 500)
- Error message is clear
- Response has proper JSON structure

**Fix if fails:**
- Review error handling in routes
- Add try-catch blocks where missing
- Improve error messages

---

## 📦 DATA CHECKS

### ✅ Demo Project Created
- [ ] Demo project exists
- [ ] Project has valid ID
- [ ] Project has documents uploaded

**Test:**
```bash
curl "http://localhost:5000/api/projects"
```

**Expected:**
- At least one project exists
- Project has `projectId`, `projectName`
- Project has `documentCount > 0`

**Fix if fails:**
- Run setup script: `node demo/setup.js`
- Or create project manually via UI

---

### ✅ 5 Sample PRDs Uploaded and Indexed
- [ ] All 5 PRD files are uploaded
- [ ] Documents are processed (chunks created)
- [ ] Vectors are generated and stored

**Check:**
```bash
# Check project documents
curl "http://localhost:5000/api/projects/PROJECT_ID"

# Check vector store
ls server/data/vectors/
```

**Expected:**
- Project shows 5 documents
- Vector store file exists for project
- Vector file contains embeddings

**Fix if fails:**
- Upload missing PRDs
- Re-process documents if needed
- Check embedding service is working

---

### ✅ Expected Outputs Validated
- [ ] Expected outputs file exists
- [ ] File contains validation criteria
- [ ] Criteria match actual outputs

**Check:**
```bash
# View expected outputs
cat demo/expected-outputs.json
```

**Expected:**
- File exists at `demo/expected-outputs.json`
- Contains test case counts, coverage criteria
- Criteria are realistic and achievable

**Fix if fails:**
- Create/update expected outputs file
- Validate criteria are achievable
- Test against actual outputs

---

### ✅ Demo Responses Prepared
- [ ] Demo responses file exists
- [ ] Contains responses for all scenarios
- [ ] Responses are high quality

**Check:**
```bash
# Check demo responses
cat server/data/demo-responses.json | jq '.test_cases | keys'
```

**Expected:**
- File exists and has content
- Contains test cases for login, payment, registration
- Contains bug reports and test plans

**Fix if fails:**
- Generate/update demo responses
- Ensure responses are comprehensive
- Test responses in demo mode

---

## 🖥️ UI CHECKS

### ✅ Loading States Work
- [ ] Skeleton loaders appear while loading
- [ ] Progress indicators show progress
- [ ] Loading messages are clear
- [ ] No blank screens during loading

**Manual Test:**
1. Open project chat
2. Ask a question
3. Observe loading states
4. Verify progress indicators work

**Fix if fails:**
- Check `src/components/LoadingStates.jsx`
- Verify progress callbacks are working
- Test in different browsers

---

### ✅ Error Messages Are Clear
- [ ] Error messages are user-friendly
- [ ] Errors show retry buttons
- [ ] Help text is provided
- [ ] No technical jargon in user-facing errors

**Manual Test:**
1. Trigger an error (e.g., invalid API key)
2. Check error message clarity
3. Verify retry functionality works

**Fix if fails:**
- Review error messages in components
- Add helpful error text
- Test error scenarios

---

### ✅ Exports Download Correctly
- [ ] Excel files download and open
- [ ] PDF files download and open
- [ ] DOCX files download and open
- [ ] Filenames are correct
- [ ] Files contain correct data

**Manual Test:**
1. Generate test cases
2. Click export button
3. Verify download starts
4. Open file and verify content

**Fix if fails:**
- Check export endpoints work
- Verify response headers
- Test in different browsers

---

### ✅ No Console Errors
- [ ] No errors in browser console
- [ ] No warnings (or only acceptable ones)
- [ ] Network requests succeed

**Manual Test:**
1. Open browser DevTools (F12)
2. Go to Console tab
3. Use the application
4. Check for errors/warnings

**Fix if fails:**
- Fix JavaScript errors
- Resolve React warnings
- Check API responses

---

### ✅ Works in Chrome, Firefox, Edge
- [ ] Application works in Chrome
- [ ] Application works in Firefox
- [ ] Application works in Edge
- [ ] No browser-specific issues

**Manual Test:**
1. Test in Chrome
2. Test in Firefox
3. Test in Edge
4. Compare behavior

**Fix if fails:**
- Fix browser-specific CSS issues
- Test polyfills if needed
- Verify API compatibility

---

## 🎬 DEMO CHECKS

### ✅ Demo Script Written
- [ ] Demo script exists
- [ ] Script has step-by-step flow
- [ ] Script includes talking points
- [ ] Script has time estimates

**Check:**
```bash
ls demo/demo-script.md
```

**Expected:**
- File exists and is comprehensive
- Includes all demo steps
- Has troubleshooting section

---

### ✅ 3 Scenarios Prepared
- [ ] Scenario 1: Memory Proof
- [ ] Scenario 2: Multi-Format Power
- [ ] Scenario 3: Quality Improvement Loop
- [ ] All scenarios have scripts

**Check:**
```bash
ls demo/killer-demo-scenarios.md
ls demo/SCENARIO-PROMPTS.md
```

**Expected:**
- Killer scenarios file exists
- Scenario prompts file exists
- Both are comprehensive

---

### ✅ Talking Points Ready
- [ ] Talking points for each scenario
- [ ] Key value propositions identified
- [ ] "Wow" moments highlighted
- [ ] Backup explanations ready

**Check:**
- Review `demo/killer-demo-scenarios.md`
- Practice talking points
- Prepare for questions

---

### ✅ Backup Video Recorded
- [ ] Video of demo is recorded
- [ ] Video shows all 3 scenarios
- [ ] Video is high quality
- [ ] Video is accessible (cloud/local)

**Manual:**
- Record demo using screen recorder
- Save to accessible location
- Test video playback

---

### ✅ Reset Script Ready
- [ ] Reset script exists
- [ ] Reset script works
- [ ] Reset script cleans up properly

**Test:**
```bash
node demo/reset.js
```

**Expected:**
- Script runs without errors
- Demo project is deleted
- Files are cleaned up

---

## Running the Checklist

### Automated Checks

```bash
# Run full checklist
node demo/pre-demo-checklist.js
```

**Output:**
- ✅/❌/⚠️ for each check
- Detailed results in `checklist-results.json`
- Summary with pass/fail counts

### Manual Checks

Some checks require manual verification:
- UI checks (loading states, errors, exports)
- Browser compatibility
- Demo materials (video, talking points)

---

## Fixing Issues

### If Technical Checks Fail

1. **Health check fails:**
   - Check server is running
   - Verify all services are up
   - Review health check logs

2. **API keys fail:**
   - Update keys in `.env`
   - Verify keys in project settings
   - Check API quotas

3. **Vector search fails:**
   - Run vector search debug: `GET /api/debug/vector-search/:projectId`
   - Check documents are indexed
   - Adjust similarity threshold

4. **Test case generation fails:**
   - Check AI service logs
   - Verify API keys work
   - Test with minimal prompt

5. **Exports fail:**
   - Run export tests: `GET /api/export/test`
   - Check dependencies: `GET /api/export/dependencies`
   - Review export debug guide

### If Data Checks Fail

1. **Demo project missing:**
   - Run: `node demo/setup.js`
   - Or create manually

2. **PRDs not uploaded:**
   - Upload missing PRDs
   - Verify processing completes
   - Check vector store

3. **Expected outputs missing:**
   - Create/update file
   - Validate criteria

### If UI Checks Fail

1. **Loading states:**
   - Check `src/components/LoadingStates.jsx`
   - Verify progress callbacks

2. **Error messages:**
   - Review error components
   - Add helpful text

3. **Exports:**
   - Test export endpoints
   - Check response headers

---

## Checklist Results

After running checklist, review `checklist-results.json`:

```json
{
  "timestamp": "2026-01-29T10:30:00Z",
  "results": {
    "technical": { ... },
    "data": { ... },
    "ui": { ... },
    "demo": { ... }
  },
  "summary": {
    "total": 20,
    "passed": 18,
    "failed": 2,
    "warnings": 0
  }
}
```

---

## Timeline

### 24 Hours Before Demo
- [ ] Run full checklist
- [ ] Fix all critical issues (FAIL status)
- [ ] Address warnings if possible

### 12 Hours Before Demo
- [ ] Re-run checklist
- [ ] Verify all fixes worked
- [ ] Test demo scenarios once

### 1 Hour Before Demo
- [ ] Final checklist run
- [ ] Quick smoke test
- [ ] Prepare backup plan

### 5 Minutes Before Demo
- [ ] Run health check
- [ ] Verify server is running
- [ ] Open demo project
- [ ] Have reset script ready

---

## Success Criteria

✅ **Ready for Demo:**
- All technical checks: PASS
- All data checks: PASS
- UI checks: Manual verification complete
- Demo materials: All prepared

⚠️ **Proceed with Caution:**
- Some warnings present
- Non-critical issues exist
- Have backup plan ready

❌ **Not Ready:**
- Critical checks failed
- Core features not working
- Must fix before demo

---

## Quick Reference

```bash
# Run checklist
node demo/pre-demo-checklist.js

# Check health
curl "http://localhost:5000/api/health"

# Test exports
curl "http://localhost:5000/api/export/test"

# Test vector search
curl "http://localhost:5000/api/debug/vector-search/PROJECT_ID?query=login"

# Setup demo
node demo/setup.js

# Reset demo
node demo/reset.js
```

---

**Good luck with your demo! 🚀**

