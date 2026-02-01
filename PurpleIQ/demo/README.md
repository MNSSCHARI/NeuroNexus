# PurpleIQ Demo Materials

This folder contains all materials needed for the PurpleIQ demo presentation.

## Contents

- **`sample-prds/`** - 5 comprehensive PRD examples
- **`expected-outputs.json`** - Pre-validated expected outputs for each PRD
- **`demo-script.md`** - Step-by-step demo script with talking points
- **`setup.js`** - Script to prepare demo environment
- **`reset.js`** - Script to reset demo environment

## 🎯 Killer Demo Scenarios

**For hackathons and competitions**, use the three killer demo scenarios:

1. **Memory Proof** - Shows contextual memory across requests
2. **Multi-Format Power** - Intelligent fusion of multiple document formats
3. **Quality Improvement Loop** - Self-evaluation and enhancement

**Setup:**
```bash
node demo/setup-scenarios.js
```

This creates three projects ready for the killer scenarios. See [`killer-demo-scenarios.md`](./killer-demo-scenarios.md) for detailed scripts.

---

## ✅ Pre-Demo Checklist

**IMPORTANT:** Run comprehensive checklist 24 hours before demo:

```bash
node demo/pre-demo-checklist.js
```

This checks:
- ✅ All technical features (health, APIs, vector search, exports)
- ✅ All data (demo project, PRDs, expected outputs)
- ✅ UI functionality (manual verification required)
- ✅ Demo materials (scripts, scenarios, reset)

See [`PRE_DEMO_CHECKLIST.md`](./PRE_DEMO_CHECKLIST.md) for detailed checklist.

---

## Quick Start

### 1. Prerequisites

- Node.js 18+ (for built-in fetch) or install `node-fetch`: `npm install node-fetch`
- Server running on `http://localhost:5000`
- Frontend running (usually on `http://localhost:5173`)
- API key configured (Gemini, OpenAI, or Claude)

### 2. Setup Demo Environment

```bash
# From the project root directory
node demo/setup.js
```

This will:
- Create a demo project
- Upload all 5 sample PRDs
- Process and index the documents
- Run health checks
- Verify everything is working

### 3. Pre-Demo Health Check (5 minutes before demo)

**⚠️ CRITICAL:** Run comprehensive health check before demo:

```bash
node demo/pre-demo-health-check.js
```

This validates:
- ✅ Server running
- ✅ Database/storage accessible
- ✅ OpenAI API key valid & working
- ✅ Gemini API key valid & working
- ✅ Embedding service working
- ✅ Vector search functional
- ✅ File upload working
- ✅ Export services working

**Take Screenshot:**
1. Open health dashboard: `http://localhost:5173/health`
2. Wait for checks to complete
3. Take full-page screenshot
4. Save in `health-check-results/` folder

### 4. Run Demo

Follow the step-by-step guide in `demo-script.md` for a 10-12 minute demo presentation.

### 5. Reset Demo Environment

After the demo, reset the environment:

```bash
node demo/reset.js
```

## Sample PRDs

1. **login-module.txt** - Authentication and login functionality
2. **payment-gateway.txt** - Payment processing integration
3. **user-registration.txt** - User account creation and verification
4. **dashboard-analytics.txt** - Analytics and data visualization
5. **api-integration.txt** - RESTful API for third-party integrations

## Expected Outputs

The `expected-outputs.json` file contains validation criteria and expected outputs for each PRD. Use this to:
- Validate generated test cases
- Check test plan completeness
- Verify bug report structure
- Ensure quality standards are met

## Demo Script

The `demo-script.md` file contains:
- Step-by-step demo flow (10-12 minutes)
- Talking points for each step
- Expected results
- Troubleshooting guide
- Backup plans
- Common questions and answers

## Troubleshooting

### Setup Script Fails

1. **Server not running**: Start server with `cd server && npm start`
2. **API key missing**: Set `GEMINI_API_KEY` or `DEMO_API_KEY` in environment
3. **PRD files not found**: Ensure `demo/sample-prds/` folder exists with all 5 files
4. **Fetch not available**: Install `node-fetch` or use Node.js 18+

### Reset Script Fails

1. **Server not running**: Start server first, then run reset
2. **Project not found**: This is okay - means demo is already reset
3. **Permission errors**: Check file permissions on uploads and data directories

## Environment Variables

You can customize the demo setup with these environment variables:

- `API_URL` - API base URL (default: `http://localhost:5000`)
- `DEMO_AI_MODEL` - AI model to use (default: `gemini`)
- `DEMO_API_KEY` - API key for AI service (defaults to `GEMINI_API_KEY`)

Example:
```bash
API_URL=http://localhost:5000 DEMO_AI_MODEL=openai DEMO_API_KEY=sk-... node demo/setup.js
```

## Notes

- The PRD files are in `.txt` format. For a more realistic demo, you can convert them to PDF format.
- The setup script creates a project named "Demo Project - E-Commerce Platform"
- All uploaded documents are processed and indexed for RAG retrieval
- The demo environment can be reset and recreated multiple times

## Support

For issues or questions:
1. Check the troubleshooting section in `demo-script.md`
2. Review server logs for errors
3. Verify all prerequisites are met
4. Run health checks manually if needed

