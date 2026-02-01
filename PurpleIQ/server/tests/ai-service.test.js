/**
 * AI Service Tests
 * Tests task classification, workflows, validation, and fallback behavior
 */

const AIService = require('../services/AIService');
const { 
  APIKeyMissingError,
  ModelUnavailableError,
  RateLimitError,
  InvalidResponseError
} = require('../utils/AIErrors');

// Mock external dependencies
jest.mock('openai');
jest.mock('@google/generative-ai');
jest.mock('fs-extra');

describe('AIService', () => {
  let aiService;

  beforeEach(() => {
    aiService = new AIService();
    jest.clearAllMocks();
  });

  describe('Intent Classification', () => {
    it('should classify test case generation intent', async () => {
      const message = 'Generate test cases for login functionality';
      
      // Mock the classification
      jest.spyOn(aiService, 'classifyUserIntent').mockResolvedValue(
        AIService.INTENT_TYPES.TEST_CASE_GENERATION
      );

      const intent = await aiService.classifyUserIntent(message, 'gemini', 'test-key');
      
      expect(intent).toBe(AIService.INTENT_TYPES.TEST_CASE_GENERATION);
    });

    it('should classify bug report formatting intent', async () => {
      const message = 'Format this bug report: The login button is broken';
      
      jest.spyOn(aiService, 'classifyUserIntent').mockResolvedValue(
        AIService.INTENT_TYPES.BUG_REPORT_FORMATTING
      );

      const intent = await aiService.classifyUserIntent(message, 'gemini', 'test-key');
      
      expect(intent).toBe(AIService.INTENT_TYPES.BUG_REPORT_FORMATTING);
    });

    it('should classify general QA question', async () => {
      const message = 'What is the best testing approach?';
      
      jest.spyOn(aiService, 'classifyUserIntent').mockResolvedValue(
        AIService.INTENT_TYPES.GENERAL_QA_QUESTION
      );

      const intent = await aiService.classifyUserIntent(message, 'gemini', 'test-key');
      
      expect(intent).toBe(AIService.INTENT_TYPES.GENERAL_QA_QUESTION);
    });
  });

  describe('Test Case Generation Workflow', () => {
    it('should generate test cases with valid input', async () => {
      const message = 'Generate test cases for user registration';
      const projectId = 'test-project';
      const retrievedContext = 'User registration requires email, password, and name validation.';
      
      const mockTestCases = [
        {
          id: 'TC001',
          description: 'Test valid registration',
          steps: '1. Enter valid email\n2. Enter password\n3. Submit',
          expected: 'User registered successfully',
          priority: 'High',
          type: 'Positive'
        }
      ];

      // Mock the workflow
      jest.spyOn(aiService, 'generateTestCasesWorkflow').mockResolvedValue({
        testCases: mockTestCases,
        markdownTable: '| TC001 | ... |',
        summary: 'Generated 1 test case',
        coverageAnalysis: { positive: 1, negative: 0, edge: 0 },
        qualityScore: 8.5
      });

      const result = await aiService.generateTestCasesWorkflow(
        message,
        projectId,
        retrievedContext,
        'gemini',
        'test-key',
        {},
        []
      );

      expect(result).toHaveProperty('testCases');
      expect(result.testCases).toHaveLength(1);
      expect(result.testCases[0].id).toBe('TC001');
    });

    it('should handle validation failures and retry', async () => {
      const message = 'Generate test cases';
      const projectId = 'test-project';
      const retrievedContext = 'Context';

      // Mock validation failure then success
      let callCount = 0;
      jest.spyOn(aiService, 'generateTestCasesWorkflow').mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          // First call: validation fails
          return {
            testCases: [], // Invalid: no test cases
            qualityScore: 5.0
          };
        } else {
          // Second call: validation passes
          return {
            testCases: [{ id: 'TC001', description: 'Test' }],
            qualityScore: 8.0
          };
        }
      });

      const result = await aiService.generateTestCasesWorkflow(
        message,
        projectId,
        retrievedContext,
        'gemini',
        'test-key',
        {},
        []
      );

      // Should eventually return valid result
      expect(result.testCases.length).toBeGreaterThan(0);
    });
  });

  describe('Validation Functions', () => {
    it('should validate test case response format', () => {
      const validResponse = {
        testCases: [
          {
            id: 'TC001',
            description: 'Test description',
            steps: 'Step 1, Step 2',
            expected: 'Expected result',
            priority: 'High',
            type: 'Positive'
          }
        ]
      };

      const result = aiService.validateTestCaseResponse(JSON.stringify(validResponse));
      
      expect(result.valid).toBe(true);
      expect(result.qualityScore).toBeGreaterThan(7);
    });

    it('should reject test cases with missing fields', () => {
      const invalidResponse = {
        testCases: [
          {
            id: 'TC001',
            // Missing required fields
          }
        ]
      };

      const result = aiService.validateTestCaseResponse(JSON.stringify(invalidResponse));
      
      expect(result.valid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
    });

    it('should require minimum number of test cases', () => {
      const invalidResponse = {
        testCases: [
          { id: 'TC001', description: 'Test' }
          // Only 1 test case, need at least 10
        ]
      };

      const result = aiService.validateTestCaseResponse(JSON.stringify(invalidResponse));
      
      expect(result.valid).toBe(false);
      expect(result.issues.some(issue => issue.includes('minimum'))).toBe(true);
    });
  });

  describe('Fallback Behavior', () => {
    it('should fallback to OpenAI when Gemini fails', async () => {
      const message = 'Test message';
      const context = 'Context';
      const geminiKey = 'gemini-key';
      const openaiKey = 'openai-key';

      // Mock Gemini failure
      jest.spyOn(aiService, 'generateWithGemini').mockRejectedValue(
        new ModelUnavailableError('Gemini', 'Model unavailable')
      );

      // Mock OpenAI success
      jest.spyOn(aiService, 'generateWithOpenAI').mockResolvedValue('OpenAI response');

      const result = await aiService.generateAnswer(
        'gemini',
        geminiKey,
        context,
        message,
        { enableFallback: true, fallbackToOpenAI: () => aiService.generateWithOpenAI('openai', openaiKey, context, message) }
      );

      expect(result).toBe('OpenAI response');
      expect(aiService.generateWithOpenAI).toHaveBeenCalled();
    });

    it('should use demo mode when all providers fail', async () => {
      const message = 'generate test cases for login';
      
      // Enable demo mode
      aiService.setDemoMode(true);
      aiService.loadDemoResponses();

      // Mock all providers failing
      jest.spyOn(aiService, 'generateWithGemini').mockRejectedValue(new Error('Failed'));
      jest.spyOn(aiService, 'generateWithOpenAI').mockRejectedValue(new Error('Failed'));

      const result = await aiService.processAgenticRequest(
        message,
        'context',
        'gemini',
        'test-key',
        'test-project'
      );

      // Should return demo response
      expect(result).toBeDefined();
    });
  });

  describe('Self-Evaluation', () => {
    it('should evaluate generated output quality', async () => {
      const generatedOutput = JSON.stringify({
        testCases: [
          { id: 'TC001', description: 'Test', steps: 'Steps', expected: 'Expected', priority: 'High', type: 'Positive' }
        ]
      });

      // Mock self-evaluation
      jest.spyOn(aiService, 'selfEvaluate').mockResolvedValue({
        score: 8.5,
        notes: 'Good coverage',
        strengths: ['Clear steps', 'Good descriptions'],
        weaknesses: ['Could add more edge cases'],
        suggestions: ['Add negative test cases']
      });

      const result = await aiService.selfEvaluate(
        generatedOutput,
        AIService.INTENT_TYPES.TEST_CASE_GENERATION,
        'gemini',
        'test-key',
        {},
        []
      );

      expect(result.score).toBeGreaterThanOrEqual(1);
      expect(result.score).toBeLessThanOrEqual(10);
      expect(result).toHaveProperty('notes');
    });

    it('should trigger regeneration if score is low', async () => {
      const generatedOutput = JSON.stringify({ testCases: [] });

      // Mock low score
      jest.spyOn(aiService, 'selfEvaluate').mockResolvedValue({
        score: 5.0,
        notes: 'Poor quality',
        suggestions: ['Add more test cases', 'Improve descriptions']
      });

      // Mock regeneration
      jest.spyOn(aiService, 'generateAnswer').mockResolvedValue(
        JSON.stringify({ testCases: [{ id: 'TC001', description: 'Improved test' }] })
      );

      const result = await aiService.selfEvaluate(
        generatedOutput,
        AIService.INTENT_TYPES.TEST_CASE_GENERATION,
        'gemini',
        'test-key',
        {},
        []
      );

      expect(result.score).toBeLessThan(7);
      expect(result.suggestions.length).toBeGreaterThan(0);
    });
  });

  describe('Conversation Memory', () => {
    it('should save conversation history', () => {
      const projectId = 'test-project';
      const userMessage = 'Generate test cases';
      const aiResponse = 'Here are the test cases...';
      const metadata = { intent: 'TEST_CASE_GENERATION' };

      aiService.saveConversation(projectId, userMessage, aiResponse, metadata);

      const history = aiService.getConversationHistory(projectId);
      
      expect(history).toHaveLength(1);
      expect(history[0].user).toBe(userMessage);
      expect(history[0].assistant).toBe(aiResponse);
    });

    it('should limit conversation history', () => {
      const projectId = 'test-project';

      // Add more than limit
      for (let i = 0; i < 10; i++) {
        aiService.saveConversation(projectId, `Message ${i}`, `Response ${i}`, {});
      }

      const history = aiService.getConversationHistory(projectId, 5);
      
      expect(history.length).toBeLessThanOrEqual(5);
    });

    it('should clear conversation history', () => {
      const projectId = 'test-project';

      aiService.saveConversation(projectId, 'Message', 'Response', {});
      aiService.clearConversationHistory(projectId);

      const history = aiService.getConversationHistory(projectId);
      
      expect(history).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle API key missing error', async () => {
      await expect(
        aiService.generateAnswer('gemini', '', 'context', 'message')
      ).rejects.toThrow();
    });

    it('should handle timeout errors', async () => {
      jest.spyOn(aiService, 'generateWithGemini').mockRejectedValue(
        new Error('Request timeout')
      );

      await expect(
        aiService.generateAnswer('gemini', 'test-key', 'context', 'message')
      ).rejects.toThrow();
    });

    it('should handle rate limit errors', async () => {
      jest.spyOn(aiService, 'generateWithGemini').mockRejectedValue(
        new RateLimitError('Gemini', 'Rate limit exceeded')
      );

      await expect(
        aiService.generateAnswer('gemini', 'test-key', 'context', 'message')
      ).rejects.toThrow(RateLimitError);
    });
  });
});

