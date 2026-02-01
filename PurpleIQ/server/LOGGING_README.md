# Comprehensive Logging System

## Overview

PurpleIQ now includes a comprehensive structured logging system using Winston, making debugging during hackathons 10x easier. All logs are structured, searchable, and include performance metrics.

## Features

✅ **Structured Logging** - JSON format with timestamps, request IDs, service names  
✅ **Multiple Log Levels** - error, warn, info, debug  
✅ **File Rotation** - Daily rotated logs, automatic cleanup (14 days)  
✅ **Performance Tracking** - Latency, token usage, cache hit rates  
✅ **Request Tracing** - Unique request ID per request for end-to-end tracing  
✅ **Service-Specific Logs** - Separate loggers for each service  
✅ **Admin API** - View logs via `/api/logs` endpoint  

## Log Files

All logs are stored in `server/logs/`:

- **combined.log** - All log levels
- **error.log** - Errors only
- **application-YYYY-MM-DD.log** - Daily rotated logs (14 days retention)
- **exceptions.log** - Unhandled exceptions
- **rejections.log** - Unhandled promise rejections

## Log Format

### Structured JSON Format

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

### Console Format (Development)

```
14:30:45.123 [info] [AIService] generateWithGemini() [abc12345]: AI Call: Gemini gemini-2.5-flash
```

## What Gets Logged

### 1. API Requests

Every HTTP request is logged with:
- Method, path, query params
- Request body size
- Response status code
- Duration
- Request ID

**Example:**
```json
{
  "level": "info",
  "service": "express",
  "function": "requestMiddleware",
  "requestId": "abc12345",
  "message": "API: POST /api/chat/project-123",
  "method": "POST",
  "path": "/api/chat/project-123",
  "statusCode": 200,
  "duration": "3456ms",
  "bodySize": 245
}
```

### 2. AI Model Calls

Every AI API call is logged with:
- Provider (Gemini, OpenAI)
- Model name
- Prompt length
- Response length
- Duration
- Token usage (if available)

**Example:**
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

### 3. Vector Searches

Every vector search is logged with:
- Query (first 100 chars)
- Results count
- Top similarity score
- Duration
- Total vectors searched

**Example:**
```json
{
  "level": "info",
  "service": "VectorStore",
  "function": "searchSimilar",
  "requestId": "abc12345",
  "message": "Vector Search: 5 results",
  "query": "What are the login requirements?",
  "resultsCount": 5,
  "topScore": "0.8234",
  "duration": "45ms",
  "projectId": "project-123",
  "totalVectors": 150
}
```

### 4. Embedding Generation

Every embedding generation is logged with:
- Provider
- Model
- Count of embeddings
- Dimension
- Duration

**Example:**
```json
{
  "level": "info",
  "service": "EmbeddingService",
  "function": "generateEmbeddingsWithGemini",
  "requestId": "abc12345",
  "message": "Performance: generateEmbeddingsWithGemini",
  "provider": "gemini",
  "model": "text-embedding-004",
  "count": 10,
  "dimension": 768,
  "duration": "1234ms"
}
```

### 5. Errors

All errors are logged with:
- Full stack trace
- Error message
- Context (function, service, requestId)
- Relevant metadata

**Example:**
```json
{
  "level": "error",
  "service": "AIService",
  "function": "generateWithGemini",
  "requestId": "abc12345",
  "message": "Invalid response structure from gemini-2.5-flash",
  "provider": "Gemini",
  "model": "gemini-2.5-flash",
  "error": "Response missing text() method",
  "stack": "Error: ..."
}
```

### 6. User Actions

User actions are logged:
- Document uploads
- Chat messages
- Exports
- Project creation

## API Endpoints

### Get Logs

```bash
GET /api/logs?level=error&service=AIService&limit=50&file=error.log
```

**Query Parameters:**
- `level` - Filter by log level (error, warn, info, debug)
- `service` - Filter by service name
- `limit` - Number of log entries (default: 100, max: 1000)
- `file` - Log file name (combined.log, error.log, application.log)

**Response:**
```json
{
  "success": true,
  "count": 50,
  "filters": {
    "level": "error",
    "service": "AIService",
    "limit": 50,
    "file": "error.log"
  },
  "logs": [
    {
      "timestamp": "2026-01-15 14:30:45.123",
      "level": "error",
      "service": "AIService",
      "message": "Invalid response structure",
      "function": "generateWithGemini",
      "requestId": "abc12345",
      "metadata": {...}
    }
  ]
}
```

### Get Log Metrics

```bash
GET /api/logs/metrics
```

**Response:**
```json
{
  "success": true,
  "metrics": {
    "totalLogs": 1500,
    "byLevel": {
      "error": 25,
      "warn": 50,
      "info": 1200,
      "debug": 225
    },
    "byService": {
      "AIService": 800,
      "EmbeddingService": 300,
      "VectorStore": 200,
      "express": 200
    },
    "recentErrors": 5,
    "fileSizes": {
      "combined.log": {
        "size": 5242880,
        "sizeMB": "5.00",
        "modified": "2026-01-15T14:30:45.123Z"
      }
    }
  }
}
```

### Get Performance Metrics

```bash
GET /api/logs/performance
```

**Response:**
```json
{
  "success": true,
  "summary": {
    "aiCalls": 150,
    "apiCalls": 500,
    "vectorSearches": 200,
    "avgAICallDuration": "2345.67ms",
    "avgAPICallDuration": "123.45ms"
  },
  "recent": {
    "aiCalls": [...],
    "apiCalls": [...],
    "vectorSearches": [...]
  }
}
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

## Request ID Tracing

Every request gets a unique request ID that flows through all log entries:

1. Request comes in → Request ID generated
2. Request ID passed to all services
3. All logs include request ID
4. Easy to trace a request end-to-end

**Example:**
```
Request ID: abc12345
├─ [express] POST /api/chat/project-123
├─ [EmbeddingService] Generating embedding
├─ [VectorStore] Vector search: 5 results
├─ [AIService] AI Call: Gemini gemini-2.5-flash
└─ [express] Response 200 (3456ms)
```

## Performance Metrics

The system tracks:

- **AI Call Latency** - Average time per AI call
- **Token Usage** - Total tokens used
- **API Response Times** - Average response time per endpoint
- **Vector Search Performance** - Search duration, result quality
- **Cache Hit/Miss Rates** - Embedding and client caching

## Configuration

### Log Level

Set via environment variable:
```bash
LOG_LEVEL=debug  # error, warn, info, debug
```

### Log Retention

- Daily logs: 14 days (configurable in logger.js)
- Combined log: 10 files × 10MB each
- Error log: 5 files × 10MB each

## Security

- **Sensitive Data Redaction** - API keys, passwords automatically redacted
- **Admin Only** - Logs endpoint should be protected (add auth middleware)
- **File Access** - Only allows reading specific log files

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

---

**Logging System Ready!** 📊

The comprehensive logging system makes debugging during hackathons 10x easier with structured logs, request tracing, and performance metrics.

