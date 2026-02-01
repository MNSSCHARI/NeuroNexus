# Test Suite Documentation

## Overview

Comprehensive test suite for PurpleIQ using Jest. Tests cover API endpoints, AI services, embedding functionality, and end-to-end integration.

## Running Tests

### All Tests
```bash
npm test
```

### Watch Mode (for development)
```bash
npm run test:watch
```

### Coverage Report
```bash
npm run test:coverage
```

### Individual Test Suites
```bash
npm run test:api          # API endpoint tests
npm run test:ai           # AI service tests
npm run test:embedding    # Embedding service tests
npm run test:integration  # Integration tests
```

## Test Structure

### 1. API Tests (`tests/api.test.js`)

Tests all API endpoints:
- Project CRUD operations
- Document upload and processing
- Chat endpoint
- Export endpoints (Excel, PDF, DOCX)
- Error handling
- Authentication and validation

**Key Features:**
- Uses Supertest for HTTP testing
- Mocks external services
- Tests error scenarios
- Validates response formats

### 2. AI Service Tests (`tests/ai-service.test.js`)

Tests AI service functionality:
- Intent classification
- Test case generation workflow
- Bug report formatting
- Test plan creation
- Output validation
- Fallback behavior
- Self-evaluation
- Conversation memory

**Key Features:**
- Mocks external AI APIs
- Tests validation logic
- Tests retry mechanisms
- Tests error handling

### 3. Embedding Tests (`tests/embedding.test.js`)

Tests embedding and chunking:
- Intelligent chunking
- Natural boundary detection
- Section detection
- Embedding generation
- Vector search
- Similarity calculations
- Quality metrics

**Key Features:**
- Tests chunking algorithms
- Validates metadata
- Tests provider fallback
- Tests search quality

### 4. Integration Tests (`tests/integration.test.js`)

End-to-end tests:
- Complete user journeys
- Document upload → Chat → Export
- Multiple document handling
- RAG integration
- Error scenarios

**Key Features:**
- Real file operations
- Full workflow testing
- Validates complete flows
- Tests edge cases

## Test Data

Test data is stored in `tests/test-data/`:
- `sample.txt` - Sample document for testing
- Additional test files created as needed

## Mocking

### External Services
- OpenAI API - Mocked
- Gemini API - Mocked
- File system operations - Mocked where needed

### Services
- AIService - Mocked for API tests
- EmbeddingService - Mocked for API tests
- VectorStore - Mocked for API tests
- ProjectStorage - Mocked for API tests
- ExportService - Mocked for API tests

## Configuration

Jest configuration in `jest.config.js`:
- Test environment: Node.js
- Timeout: 30 seconds
- Coverage directory: `coverage/`
- Test match pattern: `**/tests/**/*.test.js`

## Writing New Tests

### Example Test Structure

```javascript
describe('Feature Name', () => {
  beforeEach(() => {
    // Setup
  });

  afterEach(() => {
    // Cleanup
  });

  it('should do something', async () => {
    // Arrange
    const input = 'test';
    
    // Act
    const result = await functionUnderTest(input);
    
    // Assert
    expect(result).toBeDefined();
  });
});
```

### Best Practices

1. **Isolation**: Each test should be independent
2. **Cleanup**: Always clean up test data
3. **Mocking**: Mock external dependencies
4. **Assertions**: Use descriptive assertions
5. **Naming**: Use clear test names

## Coverage Goals

Target coverage:
- Statements: > 80%
- Branches: > 75%
- Functions: > 80%
- Lines: > 80%

## Running Tests Before Demo

```bash
# Run all tests
npm test

# Check coverage
npm run test:coverage

# Run specific suite if needed
npm run test:api
```

## Troubleshooting

### Tests Failing
1. Check that server is not running on port 5000
2. Verify environment variables are set
3. Check that test data files exist
4. Review error messages for specific issues

### Mock Issues
1. Ensure mocks are properly set up
2. Check mock return values
3. Verify mock is called correctly

### Timeout Issues
1. Increase timeout in jest.config.js
2. Check for slow operations
3. Optimize test code

## Continuous Integration

Tests can be run in CI/CD pipelines:
```bash
npm test -- --ci --coverage --maxWorkers=2
```

---

**Test Suite Ready!** ✅

Run `npm test` before your demo to ensure everything works!

