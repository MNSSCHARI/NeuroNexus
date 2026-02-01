# Demo Mode System - Hackathon Presentation Reliability

## Overview

The Demo Mode system ensures that PurpleIQ never fails during hackathon presentations, even if AI APIs are down or experiencing issues. It provides pre-generated, perfect responses for common QA scenarios.

## Features

✅ **Pre-generated Perfect Responses** - High-quality examples for all workflows  
✅ **Automatic Fallback** - Falls back to demo responses if APIs fail  
✅ **2-Second Delay** - Simulates real API calls for realistic demo experience  
✅ **Admin UI Toggle** - Easy enable/disable in Admin Portal  
✅ **Environment Variable** - Can be set via `DEMO_MODE=true` in `.env`  
✅ **Pattern Matching** - Intelligently matches user requests to demo responses  

## How It Works

### 1. Demo Mode Enabled (DEMO_MODE=true)

When demo mode is enabled:
- System checks if user request matches demo patterns
- If match found → Returns demo response immediately (with 2-second delay)
- Logs "🎬 DEMO MODE ACTIVE" to console
- Still validates responses as if they were real

### 2. Production Mode with Fallback

When demo mode is disabled but API fails:
- Tries primary AI model
- Tries fallback models
- If all fail → Checks for demo response
- Returns demo response with warning message
- Logs error details server-side

## Demo Response Patterns

### Test Case Generation
- **"login" / "authentication" / "sign in"** → Login module test cases (12 TCs)
- **"payment" / "checkout" / "transaction"** → Payment flow test cases (10 TCs)
- **"register" / "registration" / "sign up"** → User registration test cases (10 TCs)

### Bug Report Formatting
- **"login" / "button" / "mobile"** → Mobile Safari login bug report
- **"payment" / "checkout" / "silent"** → Payment processing bug report

### Test Plan Creation
- **"payment" / "e-commerce" / "transaction"** → E-commerce payment test plan

### Automation Suggestions
- **"login" / "payment" / "automation"** → Automation strategy with code examples

## Configuration

### Environment Variable

Add to `.env` file:
```bash
DEMO_MODE=true
```

### Admin UI Toggle

1. Navigate to Admin Portal (`/admin`)
2. Click the "🎬 Demo Mode: ON/OFF" toggle
3. System updates immediately (no restart needed)

### API Endpoint

```javascript
// Get current settings
GET /api/settings

// Toggle demo mode
POST /api/settings/demo-mode
Body: { enabled: true/false }
```

## Demo Responses File

Location: `server/data/demo-responses.json`

Contains:
- **test_cases**: Login, Payment, Registration modules
- **bug_reports**: 2 professional bug report examples
- **test_plans**: Comprehensive test plan example
- **automation_suggestions**: Automation strategy with code

## Usage Examples

### Test Case Generation (Demo Mode)

**Request:** "Generate test cases for login feature"

**Response:** 
- 12 comprehensive test cases
- Coverage: Positive (25%), Negative (33%), Edge Cases (42%)
- Quality Score: 9.2/10
- Includes summary and markdown table

### Bug Report (Demo Mode)

**Request:** "Format this bug: login button not working on mobile"

**Response:**
- Professional bug report structure
- All required sections
- Proper formatting
- Environment details

### API Failure Fallback

**Scenario:** API quota exceeded or network error

**Behavior:**
1. Tries primary model → Fails
2. Tries fallback models → All fail
3. Checks demo responses → Match found
4. Returns demo response with warning:
   ```
   ⚠️ **Note:** This is a demo response. The AI service encountered an error: [error message]
   ```

## Console Logging

### Demo Mode Active
```
🎬 DEMO MODE ACTIVE - Using pre-generated demo response
```

### API Failure with Fallback
```
❌ Test case generation failed: [error]
🔄 Falling back to demo response due to API failure
```

### Settings Update
```
🎬 Demo mode ENABLED
🎬 Demo mode DISABLED
```

## Benefits for Hackathon

1. **100% Reliability** - Never fails during presentation
2. **Consistent Quality** - Perfect responses every time
3. **Realistic Experience** - 2-second delay simulates real API
4. **Easy Toggle** - Switch between demo and real mode instantly
5. **Graceful Degradation** - Falls back automatically if APIs fail

## Testing Demo Mode

### Enable Demo Mode
```bash
# Set environment variable
export DEMO_MODE=true

# Or add to .env
echo "DEMO_MODE=true" >> .env
```

### Test Requests

```bash
# Test case generation
curl -X POST http://localhost:5000/api/chat/PROJECT_ID \
  -H "Content-Type: application/json" \
  -d '{"question": "Generate test cases for login feature"}'

# Bug report formatting
curl -X POST http://localhost:5000/api/chat/PROJECT_ID \
  -H "Content-Type: application/json" \
  -d '{"question": "Format bug report for login button issue"}'
```

## File Structure

```
server/
├── data/
│   ├── demo-responses.json    # Pre-generated responses
│   └── settings.json           # Runtime settings (demo mode state)
├── services/
│   └── AIService.js            # Demo mode logic
└── routes/
    └── settings.js             # Settings API endpoints
```

## Notes

- Demo responses are loaded once at startup
- Settings are persisted to `data/settings.json`
- Demo mode state is updated in real-time (no restart needed)
- All demo responses are validated using the same validation logic as real responses
- Demo responses include metadata flag `isDemo: true` for tracking

---

**Ready for Hackathon!** 🚀

The demo mode system ensures your presentation will never fail, even if:
- API keys are invalid
- API quotas are exceeded
- Network is unstable
- AI services are down

