# Comprehensive Logging Implementation Summary

## ✅ Implementation Complete

### 1. Logger Utility (`utils/logger.js`)

**Features:**
- ✅ Winston-based structured logging
- ✅ Multiple log levels (error, warn, info, debug)
- ✅ File rotation (daily logs, 14-day retention)
- ✅ Console output in development
- ✅ Service-specific loggers
- ✅ Request-scoped loggers with request ID
- ✅ Sensitive data sanitization

**Log Files:**
- `logs/combined.log` - All logs
- `logs/error.log` - Errors only
- `logs/application-YYYY-MM-DD.log` - Daily rotated
- `logs/exceptions.log` - Unhandled exceptions
- `logs/rejections.log` - Unhandled promise rejections

### 2. Request ID Middleware (`index.js`)

**Features:**
- ✅ Unique UUID per request
- ✅ Request logger attached to `req.logger`
- ✅ Request/response logging with duration
- ✅ Body size tracking
- ✅ Status code logging

### 3. AIService Logging

**Logged Operations:**
- ✅ AI model calls (provider, model, prompt length, response length, duration, tokens)
- ✅ API key validation failures
- ✅ Response validation errors
- ✅ Fallback attempts
- ✅ Self-evaluation operations

**Example Log:**
```json
{
  "level": "info",
  "service": "AIService",
  "function": "generateWithGemini",
  "requestId": "abc12345",
  "message": "AI Call: Gemini gemini-2.5-flash",
  "provider": "Gemini",
  "model": "gemini-2.5-flash",
  "promptLength": 1250,
  "responseLength": 850,
  "duration": "2345ms",
  "tokens": {
    "total": 2100,
    "prompt": 1250,
    "completion": 850
  }
}
```

### 4. EmbeddingService Logging

**Logged Operations:**
- ✅ Embedding generation (provider, model, count, dimension, duration)
- ✅ Provider selection
- ✅ Fallback attempts
- ✅ Errors with full context

**Example Log:**
```json
{
  "level": "info",
  "service": "EmbeddingService",
  "function": "generateEmbeddingsWithGemini",
  "message": "Performance: generateEmbeddingsWithGemini",
  "provider": "gemini",
  "model": "text-embedding-004",
  "count": 10,
  "dimension": 768,
  "duration": "1234ms"
}
```

### 5. VectorStore Logging

**Logged Operations:**
- ✅ Vector searches (query, results count, top score, duration)
- ✅ Search parameters (topK, minSimilarity)
- ✅ Total vectors searched

**Example Log:**
```json
{
  "level": "info",
  "service": "VectorStore",
  "function": "searchSimilar",
  "message": "Vector Search: 5 results",
  "query": "What are the login requirements?",
  "resultsCount": 5,
  "topScore": "0.8234",
  "duration": "45ms",
  "projectId": "project-123",
  "totalVectors": 150
}
```

### 6. API Endpoints (`routes/logs.js`)

**Endpoints:**
- ✅ `GET /api/logs` - Get filtered logs
- ✅ `GET /api/logs/metrics` - Get log statistics
- ✅ `GET /api/logs/performance` - Get performance metrics

**Query Parameters:**
- `level` - Filter by log level
- `service` - Filter by service name
- `limit` - Number of entries (max 1000)
- `file` - Log file name

## Log Format

### Structured JSON (File)
```json
{
  "timestamp": "2026-01-15 14:30:45.123",
  "level": "info",
  "service": "AIService",
  "function": "generateWithGemini",
  "requestId": "abc12345",
  "message": "AI Call: Gemini gemini-2.5-flash",
  "provider": "Gemini",
  "model": "gemini-2.5-flash",
  "duration": "2345ms"
}
```

### Console Format (Development)
```
14:30:45.123 [info] [AIService] generateWithGemini() [abc12345]: AI Call: Gemini gemini-2.5-flash
```

## What Gets Logged

### ✅ API Requests
- Method, path, query params
- Request body size
- Response status code
- Duration
- Request ID

### ✅ AI Model Calls
- Provider (Gemini, OpenAI)
- Model name
- Prompt length
- Response length
- Duration
- Token usage

### ✅ Vector Searches
- Query (first 100 chars)
- Results count
- Top similarity score
- Duration
- Total vectors searched

### ✅ Embedding Generation
- Provider
- Model
- Count of embeddings
- Dimension
- Duration

### ✅ Errors
- Full stack trace
- Error message
- Context (function, service, requestId)
- Relevant metadata

### ✅ User Actions
- Document uploads
- Chat messages
- Exports
- Project creation

## Performance Metrics Tracked

- **AI Call Latency** - Average time per AI call
- **Token Usage** - Total tokens used
- **API Response Times** - Average response time per endpoint
- **Vector Search Performance** - Search duration, result quality
- **Cache Hit/Miss Rates** - Embedding and client caching

## Request ID Tracing

Every request gets a unique request ID that flows through all log entries:

```
Request ID: abc12345
├─ [express] POST /api/chat/project-123
├─ [EmbeddingService] Generating embedding
├─ [VectorStore] Vector search: 5 results
├─ [AIService] AI Call: Gemini gemini-2.5-flash
└─ [express] Response 200 (3456ms)
```

## Usage Examples

### View Recent Errors
```bash
curl "http://localhost:5000/api/logs?level=error&limit=20"
```

### View AIService Logs
```bash
curl "http://localhost:5000/api/logs?service=AIService&limit=50"
```

### View Performance Metrics
```bash
curl "http://localhost:5000/api/logs/performance"
```

### View Log Statistics
```bash
curl "http://localhost:5000/api/logs/metrics"
```

## Configuration

### Log Level
Set via environment variable:
```bash
LOG_LEVEL=debug  # error, warn, info, debug
```

### Log Retention
- Daily logs: 14 days
- Combined log: 10 files × 10MB each
- Error log: 5 files × 10MB each

## Security

- ✅ **Sensitive Data Redaction** - API keys, passwords automatically redacted
- ✅ **File Access Control** - Only allows reading specific log files
- ⚠️ **Admin Protection** - Add auth middleware to `/api/logs` endpoint

## Benefits for Hackathon

1. **Quick Debugging** - Find issues instantly with structured logs
2. **Performance Monitoring** - Identify slow operations
3. **Request Tracing** - Follow a request from start to finish
4. **Error Analysis** - See patterns in errors
5. **Metrics Dashboard** - Use `/api/logs/metrics` for real-time stats

## Example Debugging Scenario

**Problem:** User reports slow test case generation

**Debugging Steps:**
1. Check `/api/logs/performance` → See AI call duration
2. Filter logs by request ID → Trace the specific request
3. Check for errors → See if any retries occurred
4. Check vector search → See if RAG is slow
5. Identify bottleneck → Fix the issue

**All in seconds!** ⚡

## Files Created/Modified

**Created:**
- `server/utils/logger.js` - Logger utility
- `server/routes/logs.js` - Logs API endpoints
- `server/LOGGING_README.md` - Documentation
- `server/LOGGING_IMPLEMENTATION_SUMMARY.md` - This file

**Modified:**
- `server/index.js` - Request ID middleware, request logging
- `server/services/AIService.js` - Added logging to AI calls
- `server/services/EmbeddingService.js` - Added logging to embedding operations
- `server/services/VectorStore.js` - Added logging to vector searches
- `server/routes/chat.js` - Added request logger, updated logging

## Next Steps (Optional Enhancements)

1. **Add Auth Middleware** - Protect `/api/logs` endpoint
2. **Log Aggregation** - Aggregate logs from multiple instances
3. **Real-time Log Streaming** - WebSocket for live log viewing
4. **Log Analytics Dashboard** - Visual dashboard for metrics
5. **Alert System** - Alert on error thresholds

---

**Logging System Ready!** 📊

The comprehensive logging system makes debugging during hackathons 10x easier with structured logs, request tracing, and performance metrics.

