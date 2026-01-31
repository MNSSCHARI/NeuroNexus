# Phase 1 Checklist Test Suite

This test suite verifies all Phase 1 requirements are met.

## Prerequisites

1. **Server must be running**: Start the server with `npm start` or `npm run dev`
2. **Environment variables**: Ensure `.env` file has necessary API keys (optional for some tests)
3. **Dependencies**: Install test dependencies with `npm install`

## Running Tests

```bash
# From server directory
npm run test:phase1

# Or directly
node tests/phase1-checklist.test.js
```

## Test Coverage

### Test 1: Gemini Connection
- ✅ **1A**: Gemini connection works
- ✅ **1B**: Legacy endpoint responds
- ✅ **1C**: Fallback models work

### Test 2: Multi-Provider Support
- ✅ **2A**: OpenAI connection works (requires manual testing with project)
- ✅ **2B**: Multi-provider support works
- ✅ **2C**: Provider fallback works (requires manual testing)

### Test 3: Error Handling
- ✅ **3A**: Missing API key handled
- ✅ **3B**: Invalid requests rejected
- ✅ **3C**: Timeouts handled
- ✅ **3D**: Errors logged properly

### Test 4: Document Upload & Search
- ✅ **4A**: Document upload works
- ✅ **4B**: Search returns relevant results
- ✅ **4C**: Chunks are good quality
- ✅ **4D**: Threshold is optimized

## Test Results

The test suite will:
- ✅ Show passed tests in green
- ❌ Show failed tests in red
- ⏭️ Show skipped tests in yellow (when API keys not configured)
- 📊 Display summary with pass rate

## Manual Testing

Some tests require manual verification:

1. **Test 2A & 2C**: Create a project with OpenAI API key and test chat endpoint
2. **Test 3D**: Check server console logs for detailed error logging
3. **Test 4C**: Review quality scores - should be >= 60% for good quality

## Troubleshooting

- **Connection errors**: Ensure server is running on `http://localhost:5000`
- **API key errors**: Some tests will skip if API keys aren't configured (this is expected)
- **Timeout errors**: Increase timeout values if your system is slow
- **Test project cleanup**: Test project is automatically deleted after tests

## Expected Output

```
============================================================
🚀 PHASE 1 COMPLETE CHECKLIST TEST SUITE
============================================================

📋 TEST 1A: Gemini Connection Works
✅ Test 1A: Gemini connection works

📋 TEST 1B: Legacy Endpoint Responds
✅ Test 1B: Legacy endpoint responds

...

============================================================
📊 TEST SUMMARY
============================================================
✅ Passed: 12
❌ Failed: 0
⏭️  Skipped: 2
📈 Total: 14

🎯 Pass Rate: 100.0%

🎉 All tests passed! Phase 1 is complete!
============================================================
```

