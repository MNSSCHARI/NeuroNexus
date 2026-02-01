const OpenAI = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const {
  APIKeyMissingError,
  ModelUnavailableError,
  RateLimitError,
  InvalidResponseError,
  TimeoutError,
  AllProvidersFailedError,
  NetworkError,
  classifyError
} = require('../utils/AIErrors');

/**
 * AI Service
 * Handles LLM interactions for different providers with automatic fallback
 */
class AIService {
  constructor() {
    this.clients = new Map(); // Cache clients per API key
    this.conversationHistory = new Map(); // Conversation history per project: projectId -> Array of conversation turns
  }

  /**
   * Validate API key format
   */
  validateApiKey(apiKey, provider) {
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
      throw new APIKeyMissingError(provider);
    }

    const trimmedKey = apiKey.trim();

    if (provider === 'OpenAI') {
      // OpenAI keys typically start with 'sk-'
      if (!trimmedKey.startsWith('sk-')) {
        console.warn('⚠️  OpenAI API key format may be invalid (expected to start with "sk-")');
      }
    } else if (provider === 'Gemini') {
      // Gemini keys can have various formats, just check it's not empty
      if (trimmedKey.length < 20) {
        console.warn('⚠️  Gemini API key format may be invalid (too short)');
      }
    }

    return trimmedKey;
  }

  /**
   * Create a timeout promise
   */
  createTimeout(timeoutSeconds) {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new TimeoutError('AI Service', timeoutSeconds));
      }, timeoutSeconds * 1000);
    });
  }

  /**
   * Execute with timeout wrapper
   */
  async executeWithTimeout(promise, timeoutSeconds, provider) {
    try {
      return await Promise.race([
        promise,
        this.createTimeout(timeoutSeconds)
      ]);
    } catch (error) {
      if (error instanceof TimeoutError) {
        error.provider = provider;
        throw error;
      }
      throw error;
    }
  }

  /**
   * Get OpenAI client
   */
  getOpenAIClient(apiKey) {
    const key = `openai-${apiKey}`;
    if (!this.clients.has(key)) {
      this.clients.set(key, new OpenAI({ apiKey }));
    }
    return this.clients.get(key);
  }

  /**
   * Get Gemini client
   */
  getGeminiClient(apiKey) {
    const key = `gemini-${apiKey}`;
    if (!this.clients.has(key)) {
      this.clients.set(key, new GoogleGenerativeAI(apiKey));
    }
    return this.clients.get(key);
  }

  /**
   * Generate answer using OpenAI
   */
  async generateWithOpenAI(apiKey, context, question, fallbackToGemini = null) {
    const provider = 'OpenAI';
    const model = 'gpt-4o-mini';
    const timeoutSeconds = 30;

    // Validate API key
    let validatedKey;
    try {
      validatedKey = this.validateApiKey(apiKey, provider);
    } catch (error) {
      console.error(`❌ ${provider} API key validation failed:`, error.message);
      throw error;
    }
    
    console.log(`🤖 Using ${provider} provider with model: ${model}`);
    
    try {
      const client = this.getOpenAIClient(validatedKey);
      
      const systemPrompt = `You are PurpleIQ, an AI-powered QA assistant. Answer questions based ONLY on the provided project documents and context. If the information is not in the provided context, say so clearly.`;

      const userPrompt = `Context from Project Documents:\n\n${context}\n\nQuestion: ${question}\n\nAnswer based on the context above:`;

      const startTime = Date.now();
      
      // Execute with timeout
      const completion = await this.executeWithTimeout(
        client.chat.completions.create({
          model: model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.7,
          max_tokens: 2000
        }),
        timeoutSeconds,
        provider
      );

      const duration = Date.now() - startTime;
      
      // Validate response
      if (!completion || !completion.choices || !completion.choices[0] || !completion.choices[0].message) {
        console.error(`❌ ${provider} returned invalid response structure:`, completion);
        throw new InvalidResponseError(provider, 'Missing response content', null);
      }

      const content = completion.choices[0].message.content;
      
      if (!content || typeof content !== 'string') {
        console.error(`❌ ${provider} returned invalid content type:`, typeof content);
        throw new InvalidResponseError(provider, 'Invalid content type', null);
      }
      
      console.log(`✅ ${provider} request completed in ${duration}ms`);
      if (completion.usage) {
        console.log(`📊 Tokens: ${completion.usage.total_tokens} (prompt: ${completion.usage.prompt_tokens}, completion: ${completion.usage.completion_tokens})`);
      }

      return content;

    } catch (error) {
      // Log detailed error server-side
      console.error(`❌ ${provider} request failed:`, {
        error: error.message,
        stack: error.stack,
        name: error.name,
        context: { model, questionLength: question.length, contextLength: context.length }
      });

      // Classify and convert error
      const classifiedError = classifyError(error, provider, { model, timeoutSeconds });

      // Check if we should fallback to Gemini
      if (fallbackToGemini && typeof fallbackToGemini === 'function') {
        // Only fallback for certain error types (not for API key errors)
        if (!(classifiedError instanceof APIKeyMissingError)) {
          console.log('🔄 Attempting fallback to Gemini...');
          try {
            return await fallbackToGemini();
          } catch (fallbackError) {
            // Both providers failed
            const errors = [
              { provider: 'OpenAI', error: classifiedError.message },
              { provider: 'Gemini', error: fallbackError.message }
            ];
            throw new AllProvidersFailedError(['OpenAI', 'Gemini'], errors, classifiedError);
          }
        }
      }

      // Re-throw classified error
      throw classifiedError;
    }
  }

  /**
   * Generate answer using Gemini with fallback models and retry logic
   */
  async generateWithGemini(apiKey, context, question, fallbackToOpenAI = null) {
    const provider = 'Gemini';
    const timeoutSeconds = 30;

    // Validate API key
    let validatedKey;
    try {
      validatedKey = this.validateApiKey(apiKey, provider);
    } catch (error) {
      console.error(`❌ ${provider} API key validation failed:`, error.message);
      throw error;
    }
    
    const genAI = this.getGeminiClient(validatedKey);
    
    // Gemini model fallback list (in order of preference)
    // These models are verified to be available via API as of Jan 2026
    const GEMINI_MODELS = [
      'gemini-2.5-flash',      // Primary model (latest, fast, recommended)
      'gemini-2.0-flash',      // Fallback 1 (stable)
      'gemini-2.5-pro'         // Fallback 2 (most capable, slower)
    ];

    console.log(`🤖 Using ${provider} provider, trying models: ${GEMINI_MODELS.join(', ')}`);

    const systemPrompt = `You are PurpleIQ, an AI-powered QA assistant. Answer questions based ONLY on the provided project documents and context. If the information is not in the provided context, say so clearly.`;

    const fullPrompt = `${systemPrompt}\n\nContext from Project Documents:\n\n${context}\n\nQuestion: ${question}\n\nAnswer based on the context above:`;

    const maxRetries = 3;
    const errors = [];

    // Try each model with retry logic
    for (const modelName of GEMINI_MODELS) {
      let lastError = null;

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          // Exponential backoff delay
          const delay = attempt > 0 ? Math.min(1000 * Math.pow(2, attempt - 1), 10000) : 0;
          
          if (delay > 0) {
            console.log(`⏳ Retrying ${modelName} after ${delay}ms (attempt ${attempt + 1}/${maxRetries})...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          } else if (attempt === 0) {
            console.log(`🔄 Trying ${provider} model: ${modelName}`);
          }

          const startTime = Date.now();
          const model = genAI.getGenerativeModel({ model: modelName });
          
          // Execute with timeout
          const result = await this.executeWithTimeout(
            model.generateContent(fullPrompt),
            timeoutSeconds,
            provider
          );
          
          const response = await result.response;
          const duration = Date.now() - startTime;
          
          // Validate response
          if (!response || typeof response.text !== 'function') {
            console.error(`❌ ${provider} returned invalid response structure for ${modelName}`);
            throw new InvalidResponseError(provider, `Invalid response from ${modelName}`, null);
          }
          
          const answer = response.text();
          
          if (!answer || typeof answer !== 'string') {
            console.error(`❌ ${provider} returned invalid answer type for ${modelName}:`, typeof answer);
            throw new InvalidResponseError(provider, `Invalid answer type from ${modelName}`, null);
          }
          
          console.log(`✅ ${provider} model used: ${modelName} (completed in ${duration}ms)`);
          
          // Log token usage if available
          if (result.response.usageMetadata) {
            const usage = result.response.usageMetadata;
            console.log(`📊 Tokens: ${usage.totalTokenCount} (prompt: ${usage.promptTokenCount}, completion: ${usage.candidatesTokenCount})`);
          }

          return answer;

        } catch (error) {
          lastError = error;
          const errorMsg = error.message || String(error);
          
          // Log detailed error server-side
          console.error(`❌ ${provider} model ${modelName} attempt ${attempt + 1} failed:`, {
            error: errorMsg,
            stack: error.stack,
            name: error.name,
            context: { model: modelName, questionLength: question.length, contextLength: context.length }
          });

          errors.push({ model: modelName, attempt: attempt + 1, error: errorMsg });

          // Classify error
          const classifiedError = classifyError(error, provider, { 
            model: modelName, 
            timeoutSeconds,
            triedModels: GEMINI_MODELS 
          });

          // If model not found, skip to next model
          if (classifiedError instanceof ModelUnavailableError || 
              errorMsg.includes('not found') || 
              errorMsg.includes('404')) {
            console.log(`⏭️  Skipping ${modelName} (model not available)`);
            break;
          }

          // For rate limit errors, don't retry immediately
          if (classifiedError instanceof RateLimitError) {
            console.log(`⏸️  Rate limit hit for ${modelName}, trying next model...`);
            break;
          }

          // For other errors, continue retrying
          if (attempt < maxRetries - 1) {
            console.log(`⚠️  ${modelName} attempt ${attempt + 1} failed: ${errorMsg}`);
            continue;
          }
        }
      }
    }

    // All models failed - try OpenAI fallback if available
    if (fallbackToOpenAI && typeof fallbackToOpenAI === 'function') {
      console.log('🔄 All Gemini models failed, attempting fallback to OpenAI...');
      try {
        return await fallbackToOpenAI();
      } catch (fallbackError) {
        // Both providers failed
        const providerErrors = errors.map(e => ({
          provider: 'Gemini',
          model: e.model,
          error: e.error
        }));
        providerErrors.push({
          provider: 'OpenAI',
          error: fallbackError.message
        });
        throw new AllProvidersFailedError(['Gemini', 'OpenAI'], providerErrors, null);
      }
    }

    // All models failed without fallback
    const triedModels = GEMINI_MODELS.join(', ');
    const errorSummary = errors.map(e => `${e.model} (attempt ${e.attempt}): ${e.error}`).join('; ');
    
    throw new ModelUnavailableError(
      'all Gemini models',
      provider,
      GEMINI_MODELS,
      new Error(`All models failed: ${errorSummary}`)
    );
  }

  /**
   * Generate answer based on AI model type with automatic fallback
   * @param {string} aiModel - Primary AI model to use ('openai', 'gemini', 'claude')
   * @param {string} apiKey - API key for the primary model
   * @param {string} context - Context from project documents
   * @param {string} question - User's question
   * @param {object} options - Optional configuration
   * @param {string} options.fallbackApiKey - API key for fallback provider (if different)
   * @param {boolean} options.enableFallback - Enable automatic fallback (default: true)
   */
  async generateAnswer(aiModel, apiKey, context, question, options = {}) {
    const {
      fallbackApiKey = null,
      enableFallback = true
    } = options;

    const primaryModel = aiModel.toLowerCase();
    console.log(`\n🚀 Starting AI generation with primary model: ${primaryModel.toUpperCase()}`);

    // Create fallback functions
    const fallbackToGemini = enableFallback && primaryModel === 'openai' && (fallbackApiKey || apiKey)
      ? () => this.generateWithGemini(fallbackApiKey || apiKey, context, question, null)
      : null;

    const fallbackToOpenAI = enableFallback && primaryModel === 'gemini' && (fallbackApiKey || apiKey)
      ? () => this.generateWithOpenAI(fallbackApiKey || apiKey, context, question, null)
      : null;

    try {
      switch (primaryModel) {
        case 'openai':
          return await this.generateWithOpenAI(apiKey, context, question, fallbackToGemini);
        
        case 'gemini':
          return await this.generateWithGemini(apiKey, context, question, fallbackToOpenAI);
        
        case 'claude':
          // TODO: Implement Claude when API is available
          throw new Error('Claude integration not yet implemented');
        
        default:
          throw new Error(`Unsupported AI model: ${aiModel}. Supported models: openai, gemini`);
      }
    } catch (error) {
      // Log detailed error
      console.error(`❌ Primary model (${primaryModel}) failed:`, {
        error: error.message,
        name: error.name,
        stack: error.stack
      });
      
      // If fallback is enabled and we haven't already tried it, attempt fallback
      // Only fallback for non-authentication errors
      if (enableFallback && !(error instanceof APIKeyMissingError)) {
        if (primaryModel === 'openai' && fallbackToGemini) {
          console.log('🔄 Attempting automatic fallback to Gemini...');
          try {
            return await fallbackToGemini();
          } catch (fallbackError) {
            const errors = [
              { provider: 'OpenAI', error: error.message },
              { provider: 'Gemini', error: fallbackError.message }
            ];
            throw new AllProvidersFailedError(['OpenAI', 'Gemini'], errors, error);
          }
        } else if (primaryModel === 'gemini' && fallbackToOpenAI) {
          console.log('🔄 Attempting automatic fallback to OpenAI...');
          try {
            return await fallbackToOpenAI();
          } catch (fallbackError) {
            const errors = [
              { provider: 'Gemini', error: error.message },
              { provider: 'OpenAI', error: fallbackError.message }
            ];
            throw new AllProvidersFailedError(['Gemini', 'OpenAI'], errors, error);
          }
        }
      }

      // Re-throw original error if no fallback available or if it's an auth error
      throw error;
    }
  }

  // ========== AGENTIC SYSTEM: INTENT CLASSIFICATION & WORKFLOWS ==========

  /**
   * User Intent Types
   */
  static INTENT_TYPES = {
    TEST_CASE_GENERATION: 'TEST_CASE_GENERATION',
    BUG_REPORT_FORMATTING: 'BUG_REPORT_FORMATTING',
    TEST_PLAN_CREATION: 'TEST_PLAN_CREATION',
    AUTOMATION_SUGGESTION: 'AUTOMATION_SUGGESTION',
    DOCUMENT_ANALYSIS: 'DOCUMENT_ANALYSIS',
    GENERAL_QA_QUESTION: 'GENERAL_QA_QUESTION'
  };

  /**
   * Classify user intent from message
   * Uses AI to intelligently determine what the user wants
   * @param {string} message - User's message/question
   * @param {string} aiModel - AI model to use ('openai', 'gemini')
   * @param {string} apiKey - API key for the model
   * @returns {Promise<string>} Intent type (one of INTENT_TYPES)
   */
  async classifyUserIntent(message, aiModel, apiKey) {
    const classificationPrompt = `You are an AI assistant that classifies QA-related user requests. Analyze the following message and classify it into ONE of these categories:

1. TEST_CASE_GENERATION - User wants test cases created (e.g., "create test cases", "generate test scenarios", "what tests should I write")
2. BUG_REPORT_FORMATTING - User wants help formatting a bug report (e.g., "format this bug", "help me write a bug report", "bug report template")
3. TEST_PLAN_CREATION - User wants a test plan (e.g., "create test plan", "test strategy", "testing approach")
4. AUTOMATION_SUGGESTION - User wants automation help (e.g., "how to automate", "automation ideas", "playwright suggestions")
5. DOCUMENT_ANALYSIS - User wants to understand documents/PRDs (e.g., "explain this requirement", "what does this mean", "analyze the PRD")
6. GENERAL_QA_QUESTION - Generic QA question that doesn't fit above categories

User message: "${message}"

Respond with ONLY the category name (e.g., "TEST_CASE_GENERATION"). No explanation, just the category.`;

    try {
      const primaryModel = aiModel.toLowerCase();
      let classification;

      if (primaryModel === 'gemini') {
        const genAI = this.getGeminiClient(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const result = await this.executeWithTimeout(
          model.generateContent(classificationPrompt),
          10,
          'Gemini'
        );
        const response = await result.response;
        classification = response.text().trim();
      } else if (primaryModel === 'openai') {
        const client = this.getOpenAIClient(apiKey);
        const completion = await this.executeWithTimeout(
          client.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: 'You are a QA intent classifier. Respond with only the category name.' },
              { role: 'user', content: classificationPrompt }
            ],
            temperature: 0.3,
            max_tokens: 50
          }),
          10,
          'OpenAI'
        );
        classification = completion.choices[0].message.content.trim();
      } else {
        throw new Error(`Unsupported model for classification: ${aiModel}`);
      }

      // Validate and normalize classification
      const normalized = classification.toUpperCase().replace(/[^A-Z_]/g, '');
      const validIntent = Object.values(AIService.INTENT_TYPES).find(
        intent => intent === normalized || normalized.includes(intent.split('_')[0])
      );

      if (validIntent) {
        console.log(`🎯 Classified intent: ${validIntent}`);
        return validIntent;
      }

      // Fallback: try to match keywords
      const messageLower = message.toLowerCase();
      if (messageLower.includes('test case') || messageLower.includes('test scenario') || messageLower.includes('generate test')) {
        return AIService.INTENT_TYPES.TEST_CASE_GENERATION;
      }
      if (messageLower.includes('bug report') || messageLower.includes('format bug') || messageLower.includes('bug template')) {
        return AIService.INTENT_TYPES.BUG_REPORT_FORMATTING;
      }
      if (messageLower.includes('test plan') || messageLower.includes('test strategy') || messageLower.includes('testing approach')) {
        return AIService.INTENT_TYPES.TEST_PLAN_CREATION;
      }
      if (messageLower.includes('automation') || messageLower.includes('automate') || messageLower.includes('playwright')) {
        return AIService.INTENT_TYPES.AUTOMATION_SUGGESTION;
      }
      if (messageLower.includes('explain') || messageLower.includes('analyze') || messageLower.includes('what does') || messageLower.includes('understand')) {
        return AIService.INTENT_TYPES.DOCUMENT_ANALYSIS;
      }

      // Default to general QA question
      console.log(`🎯 Classified intent: GENERAL_QA_QUESTION (fallback)`);
      return AIService.INTENT_TYPES.GENERAL_QA_QUESTION;

    } catch (error) {
      console.error('❌ Error classifying intent:', error.message);
      // Fallback to general QA question on error
      return AIService.INTENT_TYPES.GENERAL_QA_QUESTION;
    }
  }

  /**
   * Generate test cases workflow - Multi-step agent
   * Analyzes requirements, extracts context, generates and validates test cases
   * @param {string} message - User's request message
   * @param {string} projectId - Project ID (optional, for additional context)
   * @param {string} retrievedContext - Context from RAG search
   * @param {string} aiModel - AI model to use
   * @param {string} apiKey - API key
   * @returns {Promise<{testCases: Array, summary: string, coverageAnalysis: Object, qualityScore: number}>}
   */
  async generateTestCasesWorkflow(message, projectId, retrievedContext, aiModel, apiKey) {
    console.log('\n🧪 TEST CASE GENERATION WORKFLOW - Starting multi-step process...');
    
    // STEP 1: Analyze user request
    console.log('📋 Step 1: Analyzing user request...');
    const analysisPrompt = `Analyze the following user request for test case generation. Extract:
1. Module/Feature name
2. Specific requirements mentioned
3. Constraints or focus areas
4. Any specific test scenarios the user wants

User Request: "${message}"

Respond in JSON format:
{
  "moduleName": "extracted module/feature name",
  "requirements": ["requirement 1", "requirement 2"],
  "constraints": ["constraint 1", "constraint 2"],
  "focusAreas": ["area 1", "area 2"]
}`;

    let analysis;
    try {
      const analysisResult = await this.generateAnswer(aiModel, apiKey, '', analysisPrompt, {
        enableFallback: true
      });
      // Try to parse JSON from response
      const jsonMatch = analysisResult.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        // Fallback: extract manually
        analysis = {
          moduleName: this.extractModuleName(message),
          requirements: this.extractRequirements(message),
          constraints: [],
          focusAreas: []
        };
      }
    } catch (error) {
      console.warn('⚠️  Analysis parsing failed, using fallback extraction');
      analysis = {
        moduleName: this.extractModuleName(message),
        requirements: this.extractRequirements(message),
        constraints: [],
        focusAreas: []
      };
    }
    
    console.log(`   ✅ Module: ${analysis.moduleName || 'General'}`);
    console.log(`   ✅ Requirements: ${analysis.requirements?.length || 0} identified`);

    // STEP 2: Extract key information from context
    console.log('📋 Step 2: Extracting key information from context...');
    const extractionPrompt = `Extract key information from the following project documents for test case generation:

Context:
${retrievedContext || 'No context available'}

Extract:
1. User flows (step-by-step processes)
2. Business rules (validation rules, constraints)
3. Acceptance criteria (what must be satisfied)
4. Edge cases mentioned in PRD
5. Error scenarios
6. Integration points

Respond in structured format with clear sections for each category.`;

    const extractedInfo = await this.generateAnswer(aiModel, apiKey, retrievedContext || '', extractionPrompt, {
      enableFallback: true
    });
    
    console.log(`   ✅ Extracted ${extractedInfo.length} characters of key information`);

    // STEP 3: Generate comprehensive test cases
    console.log('📋 Step 3: Generating comprehensive test cases...');
    const modulePrefix = (analysis.moduleName || 'FEATURE').toUpperCase().replace(/[^A-Z0-9]/g, '_').substring(0, 10);
    
    const generationPrompt = `You are PurpleIQ, an expert QA test designer. Generate comprehensive test cases based on the following information.

ANALYSIS:
- Module/Feature: ${analysis.moduleName || 'General Feature'}
- Requirements: ${JSON.stringify(analysis.requirements || [])}
- Constraints: ${JSON.stringify(analysis.constraints || [])}

EXTRACTED INFORMATION:
${extractedInfo}

REQUIREMENTS FOR TEST CASES:
1. Generate MINIMUM 10 test cases (aim for 15-20 for comprehensive coverage)
2. Each test case MUST include:
   - Test Case ID (format: TC_${modulePrefix}_001, TC_${modulePrefix}_002, etc.)
   - Description (clear, concise)
   - Preconditions (what must be true before test)
   - Detailed steps (numbered: 1., 2., 3., etc.)
   - Expected results (what should happen)
   - Priority (High/Medium/Low)
   - Type (Positive/Negative/Edge Case)

3. Coverage requirements:
   - At least 40% Positive test cases (happy path scenarios)
   - At least 30% Negative test cases (error scenarios, invalid inputs)
   - At least 30% Edge Case test cases (boundary conditions, unusual scenarios)

4. Test cases should cover:
   - All user flows mentioned
   - All business rules
   - All acceptance criteria
   - All edge cases from PRD
   - Error handling scenarios

Respond with ONLY a JSON object in this exact format:
{
  "testCases": [
    {
      "testCaseId": "TC_${modulePrefix}_001",
      "description": "Test case description",
      "preconditions": ["precondition 1", "precondition 2"],
      "steps": ["Step 1", "Step 2", "Step 3"],
      "expectedResults": "Expected result description",
      "priority": "High",
      "type": "Positive"
    }
  ]
}

IMPORTANT: Return ONLY valid JSON, no markdown, no explanations, just the JSON object.`;

    let testCasesData;
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      try {
        const generationResult = await this.generateAnswer(aiModel, apiKey, retrievedContext || '', generationPrompt, {
          enableFallback: true
        });
        
        // Extract JSON from response
        const jsonMatch = generationResult.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          testCasesData = JSON.parse(jsonMatch[0]);
          break;
        } else {
          throw new Error('No JSON found in response');
        }
      } catch (error) {
        attempts++;
        if (attempts >= maxAttempts) {
          console.error('❌ Failed to generate valid test cases after multiple attempts');
          throw new Error('Failed to generate test cases: ' + error.message);
        }
        console.warn(`⚠️  Generation attempt ${attempts} failed, retrying...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    const testCases = testCasesData.testCases || [];
    console.log(`   ✅ Generated ${testCases.length} test cases`);

    // STEP 4: Validate test cases
    console.log('📋 Step 4: Validating test cases...');
    const validation = this.validateTestCases(testCases, analysis.moduleName || 'Feature');
    
    console.log(`   ✅ Validation: ${validation.isValid ? 'PASSED' : 'FAILED'}`);
    console.log(`      - Positive: ${validation.coverage.positive}/${validation.coverage.total} (${validation.coverage.positivePercent}%)`);
    console.log(`      - Negative: ${validation.coverage.negative}/${validation.coverage.total} (${validation.coverage.negativePercent}%)`);
    console.log(`      - Edge Cases: ${validation.coverage.edgeCases}/${validation.coverage.total} (${validation.coverage.edgeCasesPercent}%)`);

    // STEP 5: Regenerate if validation fails
    if (!validation.isValid && attempts < maxAttempts) {
      console.log('📋 Step 5: Validation failed, regenerating with improvements...');
      const improvementPrompt = `${generationPrompt}

VALIDATION ISSUES FOUND:
${validation.issues.join('\n')}

Please regenerate test cases addressing these issues. Ensure:
- Minimum 10 test cases
- At least 4 Positive test cases
- At least 3 Negative test cases  
- At least 3 Edge Case test cases
- All fields properly populated`;

      try {
        const improvedResult = await this.generateAnswer(aiModel, apiKey, retrievedContext || '', improvementPrompt, {
          enableFallback: true
        });
        const jsonMatch = improvedResult.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          testCasesData = JSON.parse(jsonMatch[0]);
          const improvedTestCases = testCasesData.testCases || [];
          if (improvedTestCases.length >= testCases.length) {
            testCases.splice(0, testCases.length, ...improvedTestCases);
            const revalidation = this.validateTestCases(testCases, analysis.moduleName || 'Feature');
            Object.assign(validation, revalidation);
            console.log('   ✅ Regeneration successful');
          }
        }
      } catch (error) {
        console.warn('⚠️  Regeneration failed, using original test cases');
      }
    }

    // STEP 6: Format as markdown table
    console.log('📋 Step 6: Formatting output...');
    const markdownTable = this.formatTestCasesAsMarkdown(testCases);

    // STEP 7: Calculate quality score
    const qualityScore = this.calculateQualityScore(testCases, validation);

    // Prepare summary
    const summary = this.generateTestCasesSummary(testCases, analysis, validation, qualityScore);

    // Coverage analysis
    const coverageAnalysis = {
      total: testCases.length,
      positive: validation.coverage.positive,
      negative: validation.coverage.negative,
      edgeCases: validation.coverage.edgeCases,
      positivePercent: validation.coverage.positivePercent,
      negativePercent: validation.coverage.negativePercent,
      edgeCasesPercent: validation.coverage.edgeCasesPercent,
      highPriority: testCases.filter(tc => tc.priority === 'High').length,
      mediumPriority: testCases.filter(tc => tc.priority === 'Medium').length,
      lowPriority: testCases.filter(tc => tc.priority === 'Low').length
    };

    console.log(`✅ Workflow complete! Quality Score: ${qualityScore}/10`);

    // Return structured object
    return {
      testCases: testCases,
      markdownTable: markdownTable,
      summary: summary,
      coverageAnalysis: coverageAnalysis,
      qualityScore: qualityScore,
      analysis: analysis
    };
  }

  /**
   * Helper: Extract module name from message
   */
  extractModuleName(message) {
    const patterns = [
      /(?:for|of|on)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
      /(?:module|feature|functionality)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
      /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:test|testing|cases)/i
    ];
    
    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match) return match[1];
    }
    
    return 'General';
  }

  /**
   * Helper: Extract requirements from message
   */
  extractRequirements(message) {
    const requirements = [];
    const reqPatterns = [
      /(?:requirement|should|must|need)\s+([^.!?]+)/gi,
      /(?:test|verify|check)\s+([^.!?]+)/gi
    ];
    
    reqPatterns.forEach(pattern => {
      const matches = message.matchAll(pattern);
      for (const match of matches) {
        if (match[1] && match[1].trim().length > 5) {
          requirements.push(match[1].trim());
        }
      }
    });
    
    return requirements.length > 0 ? requirements : ['General functionality'];
  }

  /**
   * Validate test cases
   */
  validateTestCases(testCases, moduleName) {
    const issues = [];
    const coverage = {
      total: testCases.length,
      positive: 0,
      negative: 0,
      edgeCases: 0
    };

    // Check minimum count
    if (testCases.length < 10) {
      issues.push(`Only ${testCases.length} test cases found. Minimum 10 required.`);
    }

    // Count by type
    testCases.forEach(tc => {
      if (!tc.type) {
        issues.push(`Test case ${tc.testCaseId || 'unknown'} missing type`);
        return;
      }
      
      const type = tc.type.toLowerCase();
      if (type.includes('positive') || type === 'positive') {
        coverage.positive++;
      } else if (type.includes('negative') || type === 'negative') {
        coverage.negative++;
      } else if (type.includes('edge') || type === 'edge case') {
        coverage.edgeCases++;
      }
    });

    coverage.positivePercent = coverage.total > 0 ? Math.round((coverage.positive / coverage.total) * 100) : 0;
    coverage.negativePercent = coverage.total > 0 ? Math.round((coverage.negative / coverage.total) * 100) : 0;
    coverage.edgeCasesPercent = coverage.total > 0 ? Math.round((coverage.edgeCases / coverage.total) * 100) : 0;

    // Check coverage percentages
    if (coverage.positivePercent < 30) {
      issues.push(`Only ${coverage.positivePercent}% positive test cases. Need at least 30%.`);
    }
    if (coverage.negativePercent < 20) {
      issues.push(`Only ${coverage.negativePercent}% negative test cases. Need at least 20%.`);
    }
    if (coverage.edgeCasesPercent < 20) {
      issues.push(`Only ${coverage.edgeCasesPercent}% edge case test cases. Need at least 20%.`);
    }

    // Validate each test case has all required fields
    testCases.forEach((tc, index) => {
      if (!tc.testCaseId) issues.push(`Test case ${index + 1} missing testCaseId`);
      if (!tc.description) issues.push(`Test case ${tc.testCaseId || index + 1} missing description`);
      if (!tc.preconditions || tc.preconditions.length === 0) issues.push(`Test case ${tc.testCaseId || index + 1} missing preconditions`);
      if (!tc.steps || tc.steps.length === 0) issues.push(`Test case ${tc.testCaseId || index + 1} missing steps`);
      if (!tc.expectedResults) issues.push(`Test case ${tc.testCaseId || index + 1} missing expectedResults`);
      if (!tc.priority) issues.push(`Test case ${tc.testCaseId || index + 1} missing priority`);
      if (!tc.type) issues.push(`Test case ${tc.testCaseId || index + 1} missing type`);
    });

    return {
      isValid: issues.length === 0 && testCases.length >= 10,
      issues: issues,
      coverage: coverage
    };
  }

  /**
   * Format test cases as markdown table
   */
  formatTestCasesAsMarkdown(testCases) {
    let markdown = `# Test Cases\n\n`;
    markdown += `| Test Case ID | Description | Type | Priority | Preconditions | Steps | Expected Results |\n`;
    markdown += `|--------------|-------------|------|----------|---------------|-------|------------------|\n`;

    testCases.forEach(tc => {
      const preconditions = Array.isArray(tc.preconditions) 
        ? tc.preconditions.join('; ') 
        : (tc.preconditions || 'N/A');
      const steps = Array.isArray(tc.steps) 
        ? tc.steps.join(' → ') 
        : (tc.steps || 'N/A');
      
      // Truncate long fields for table
      const desc = (tc.description || '').substring(0, 100) + (tc.description?.length > 100 ? '...' : '');
      const expected = (tc.expectedResults || '').substring(0, 100) + (tc.expectedResults?.length > 100 ? '...' : '');
      
      markdown += `| ${tc.testCaseId || 'N/A'} | ${desc} | ${tc.type || 'N/A'} | ${tc.priority || 'N/A'} | ${preconditions.substring(0, 50)} | ${steps.substring(0, 80)} | ${expected} |\n`;
    });

    return markdown;
  }

  /**
   * Calculate quality score (1-10)
   */
  calculateQualityScore(testCases, validation) {
    let score = 0;
    const maxScore = 10;

    // Count (2 points)
    if (testCases.length >= 15) score += 2;
    else if (testCases.length >= 10) score += 1.5;
    else if (testCases.length >= 5) score += 1;

    // Coverage (3 points)
    if (validation.coverage.positivePercent >= 30) score += 1;
    if (validation.coverage.negativePercent >= 20) score += 1;
    if (validation.coverage.edgeCasesPercent >= 20) score += 1;

    // Completeness (3 points)
    const completeCases = testCases.filter(tc => 
      tc.testCaseId && tc.description && tc.preconditions && tc.steps && tc.expectedResults && tc.priority && tc.type
    ).length;
    const completenessPercent = testCases.length > 0 ? (completeCases / testCases.length) * 100 : 0;
    score += (completenessPercent / 100) * 3;

    // Validation (2 points)
    if (validation.isValid) score += 2;
    else if (validation.issues.length <= 2) score += 1;

    return Math.min(Math.round(score * 10) / 10, maxScore);
  }

  /**
   * Generate test cases summary
   */
  generateTestCasesSummary(testCases, analysis, validation, qualityScore) {
    let summary = `## Test Cases Summary\n\n`;
    summary += `**Module/Feature:** ${analysis.moduleName || 'General Feature'}\n\n`;
    summary += `**Total Test Cases:** ${testCases.length}\n\n`;
    summary += `**Coverage:**\n`;
    summary += `- Positive: ${validation.coverage.positive} (${validation.coverage.positivePercent}%)\n`;
    summary += `- Negative: ${validation.coverage.negative} (${validation.coverage.negativePercent}%)\n`;
    summary += `- Edge Cases: ${validation.coverage.edgeCases} (${validation.coverage.edgeCasesPercent}%)\n\n`;
    summary += `**Quality Score:** ${qualityScore}/10\n\n`;
    
    if (!validation.isValid && validation.issues.length > 0) {
      summary += `**Validation Issues:**\n`;
      validation.issues.forEach(issue => {
        summary += `- ${issue}\n`;
      });
      summary += `\n`;
    }
    
    summary += `**Priority Distribution:**\n`;
    summary += `- High: ${testCases.filter(tc => tc.priority === 'High').length}\n`;
    summary += `- Medium: ${testCases.filter(tc => tc.priority === 'Medium').length}\n`;
    summary += `- Low: ${testCases.filter(tc => tc.priority === 'Low').length}\n`;

    return summary;
  }

  /**
   * Format bug report workflow
   * Helps structure and format bug reports professionally
   * Includes validation and retry logic
   */
  async formatBugReportWorkflow(context, userMessage, aiModel, apiKey) {
    const systemPrompt = `You are PurpleIQ, a QA expert specializing in bug report documentation. Help users format bug reports professionally.

Workflow:
1. Extract bug information from user message
2. Structure it into a professional bug report format:
   - Title/Summary (clear and concise)
   - Description
   - Steps to Reproduce (numbered, detailed steps)
   - Expected Behavior
   - Actual Behavior
   - Environment (browser, OS, device if applicable)
   - Priority/Severity
   - Attachments/Screenshots (if mentioned)
3. Reference relevant context from project documents if applicable

Make the bug report clear, actionable, and professional. NO placeholder text like [TODO] or TBD.`;

    const userPrompt = `Context from Project Documents:\n\n${context}\n\nUser Bug Report/Request: ${userMessage}\n\nFormat this into a professional bug report. If the user's message is incomplete, ask clarifying questions or provide a template.`;

    const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;

    // Use validation and retry
    const generateFunction = async (prompt) => {
      return await this.generateAnswer(aiModel, apiKey, context, prompt, {
        enableFallback: true
      });
    };

    const result = await this.validateAndRetry(
      generateFunction,
      (output) => this.validateBugReportResponse(output),
      fullPrompt,
      2 // max 2 retries
    );

    // Add validation metadata if available
    if (result.validation && !result.validation.valid) {
      console.warn(`⚠️  Bug report validation issues: ${result.validation.issues.join(', ')}`);
    }

    return result.output;
  }

  /**
   * Create test plan workflow
   * Generates comprehensive test plans and strategies
   * Includes validation and retry logic
   */
  async createTestPlanWorkflow(context, userMessage, aiModel, apiKey) {
    const systemPrompt = `You are PurpleIQ, a senior QA strategist. Create comprehensive test plans and testing strategies.

Workflow:
1. Analyze the project/feature from context
2. Create a structured test plan including:
   - Test Objectives
   - Scope (in-scope and out-of-scope)
   - Test Approach/Strategy
   - Test Types (Functional, Non-functional, Regression, etc.)
   - Test Environment Requirements
   - Test Data Requirements
   - Risk Assessment
   - Timeline/Estimation
   - Resource Requirements
   - Entry/Exit Criteria

Make it comprehensive, actionable, and suitable for stakeholder review. Use structured sections with headers (##) and bullet points or numbered lists. NO placeholder text like [TODO] or TBD.`;

    const userPrompt = `Context from Project Documents:\n\n${context}\n\nUser Request: ${userMessage}\n\nCreate a comprehensive test plan based on the project context and user requirements.`;

    const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;

    // Use validation and retry
    const generateFunction = async (prompt) => {
      return await this.generateAnswer(aiModel, apiKey, context, prompt, {
        enableFallback: true
      });
    };

    const result = await this.validateAndRetry(
      generateFunction,
      (output) => this.validateTestPlanResponse(output),
      fullPrompt,
      2 // max 2 retries
    );

    // Add validation metadata if available
    if (result.validation && !result.validation.valid) {
      console.warn(`⚠️  Test plan validation issues: ${result.validation.issues.join(', ')}`);
    }

    return result.output;
  }

  /**
   * Automation suggestion workflow
   * Provides automation strategies and implementation suggestions
   * Includes validation and retry logic
   */
  async suggestAutomationWorkflow(context, userMessage, aiModel, apiKey) {
    const systemPrompt = `You are PurpleIQ, an automation testing expert. Provide automation strategies and suggestions.

Workflow:
1. Analyze the feature/requirement from context
2. Identify automation opportunities
3. Suggest automation approach including:
   - Which tests should be automated (and why)
   - Automation framework recommendations (Playwright, Selenium, Cypress, etc.)
   - Test structure and organization
   - Sample automation code/scripts (use code blocks with \`\`\`)
   - Best practices
   - Maintenance strategy

Provide practical, actionable automation advice with code examples. Include at least 3-5 specific suggestions. NO placeholder text like [TODO] or TBD.`;

    const userPrompt = `Context from Project Documents:\n\n${context}\n\nUser Request: ${userMessage}\n\nProvide automation suggestions and strategies based on the context. Include code examples if helpful.`;

    const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;

    // Use validation and retry
    const generateFunction = async (prompt) => {
      return await this.generateAnswer(aiModel, apiKey, context, prompt, {
        enableFallback: true
      });
    };

    const result = await this.validateAndRetry(
      generateFunction,
      (output) => this.validateAutomationSuggestions(output),
      fullPrompt,
      2 // max 2 retries
    );

    // Add validation metadata if available
    if (result.validation && !result.validation.valid) {
      console.warn(`⚠️  Automation suggestions validation issues: ${result.validation.issues.join(', ')}`);
    }

    return result.output;
  }

  /**
   * Document analysis workflow
   * Analyzes and explains project documents/PRDs
   */
  async analyzeDocumentsWorkflow(context, userMessage, aiModel, apiKey) {
    const systemPrompt = `You are PurpleIQ, a QA analyst specializing in requirement analysis. Analyze and explain project documents clearly.

Workflow:
1. Understand the user's question about the documents
2. Extract relevant information from the context
3. Provide clear, structured explanations:
   - Key requirements/features
   - Functional flows
   - Dependencies
   - Edge cases
   - Potential testing considerations
   - Clarifications needed

Make complex requirements easy to understand for QA teams.`;

    const userPrompt = `Context from Project Documents:\n\n${context}\n\nUser Question: ${userMessage}\n\nAnalyze the documents and answer the user's question clearly and comprehensively.`;

    return await this.generateAnswer(aiModel, apiKey, context, userPrompt, {
      enableFallback: true
    });
  }

  /**
   * General QA question workflow
   * Handles general QA questions with context awareness
   */
  async answerGeneralQuestion(context, userMessage, aiModel, apiKey) {
    const systemPrompt = `You are PurpleIQ, an AI-powered QA assistant. Answer QA-related questions based on project documents and your expertise.

Provide helpful, accurate answers that:
- Reference project documents when relevant
- Include practical QA advice
- Are clear and actionable
- Consider best practices

If the question can't be answered from the documents, provide general QA guidance.`;

    const userPrompt = `Context from Project Documents:\n\n${context}\n\nUser Question: ${userMessage}\n\nAnswer the question based on the context and your QA expertise.`;

    return await this.generateAnswer(aiModel, apiKey, context, userPrompt, {
      enableFallback: true
    });
  }

  // ========== AI OUTPUT VALIDATION SYSTEM ==========

  /**
   * Validate test case response from AI
   * Checks raw AI output for quality and completeness
   * @param {string} aiOutput - Raw AI output (markdown/string)
   * @returns {Object} Validation result with issues, suggestions, and quality score
   */
  validateTestCaseResponse(aiOutput) {
    const issues = [];
    const suggestions = [];
    let qualityScore = 100;

    if (!aiOutput || typeof aiOutput !== 'string' || aiOutput.trim().length === 0) {
      return {
        valid: false,
        issues: ['AI output is empty or invalid'],
        suggestions: ['Ensure the AI model generates a response'],
        qualityScore: 0
      };
    }

    const output = aiOutput.trim();

    // Check 1: Format validation (markdown table)
    const hasMarkdownTable = output.includes('|') && output.includes('---');
    const hasTableHeader = /Test Case ID|Description|Steps|Expected|Priority|Type/i.test(output);
    
    if (!hasMarkdownTable) {
      issues.push('Output is not in markdown table format');
      suggestions.push('Format output as a markdown table with pipe separators (|)');
      qualityScore -= 20;
    }

    if (!hasTableHeader) {
      issues.push('Required table columns are missing');
      suggestions.push('Include headers: Test Case ID, Description, Steps, Expected Results, Priority, Type');
      qualityScore -= 15;
    }

    // Check 2: Extract test cases count
    const tableRows = output.match(/\|.*\|/g) || [];
    const dataRows = tableRows.filter(row => !row.includes('---') && !row.includes('Test Case ID')).length;
    
    if (dataRows < 10) {
      issues.push(`Only ${dataRows} test cases found. Minimum 10 required.`);
      suggestions.push(`Generate at least 10 test cases. Aim for 15-20 for comprehensive coverage.`);
      qualityScore -= (10 - dataRows) * 5;
    }

    // Check 3: Coverage types
    const positiveCount = (output.match(/positive/gi) || []).length;
    const negativeCount = (output.match(/negative/gi) || []).length;
    const edgeCaseCount = (output.match(/edge\s*case/gi) || []).length;

    if (positiveCount < 3) {
      issues.push(`Only ${positiveCount} positive test case(s) found. Need at least 3.`);
      suggestions.push('Include more positive/happy path test cases (at least 3)');
      qualityScore -= 10;
    }

    if (negativeCount < 3) {
      issues.push(`Only ${negativeCount} negative test case(s) found. Need at least 3.`);
      suggestions.push('Include more negative/error scenario test cases (at least 3)');
      qualityScore -= 10;
    }

    if (edgeCaseCount < 2) {
      issues.push(`Only ${edgeCaseCount} edge case(s) found. Need at least 2.`);
      suggestions.push('Include edge case test scenarios (boundary conditions, unusual inputs)');
      qualityScore -= 10;
    }

    // Check 4: Placeholder text
    const placeholderPatterns = [
      /\[TODO\]/gi,
      /TBD/gi,
      /to be determined/gi,
      /placeholder/gi,
      /example/gi,
      /sample/gi
    ];

    placeholderPatterns.forEach(pattern => {
      if (pattern.test(output)) {
        issues.push('Placeholder text detected (TODO, TBD, etc.)');
        suggestions.push('Replace all placeholder text with actual, specific content');
        qualityScore -= 5;
      }
    });

    // Check 5: Step detail quality
    const stepPatterns = [
      /click\s+button/gi,
      /enter\s+data/gi,
      /fill\s+form/gi,
      /submit/gi
    ];

    let vagueSteps = 0;
    stepPatterns.forEach(pattern => {
      const matches = output.match(pattern) || [];
      vagueSteps += matches.length;
    });

    if (vagueSteps > dataRows) {
      issues.push('Test steps are too vague (e.g., "Click button" without details)');
      suggestions.push('Make steps more specific: "Click the \'Login\' button in the top-right corner" instead of "Click button"');
      qualityScore -= 15;
    }

    // Check 6: Required columns presence
    const requiredColumns = ['ID', 'Description', 'Steps', 'Expected', 'Priority', 'Type'];
    const missingColumns = requiredColumns.filter(col => {
      const regex = new RegExp(col, 'i');
      return !regex.test(output);
    });

    if (missingColumns.length > 0) {
      issues.push(`Missing required columns: ${missingColumns.join(', ')}`);
      suggestions.push(`Ensure all columns are present: ${requiredColumns.join(', ')}`);
      qualityScore -= missingColumns.length * 5;
    }

    // Check 7: Test Case ID format
    const hasTestIds = /TC_\w+_\d+/i.test(output) || /\d+\./i.test(output);
    if (!hasTestIds) {
      issues.push('Test case IDs are missing or not in expected format');
      suggestions.push('Use format: TC_MODULE_001, TC_MODULE_002, etc.');
      qualityScore -= 5;
    }

    qualityScore = Math.max(0, Math.min(100, qualityScore));

    return {
      valid: issues.length === 0 && dataRows >= 10 && positiveCount >= 3 && negativeCount >= 3 && edgeCaseCount >= 2,
      issues: issues,
      suggestions: suggestions,
      qualityScore: Math.round(qualityScore),
      metrics: {
        testCaseCount: dataRows,
        positiveCount: positiveCount,
        negativeCount: negativeCount,
        edgeCaseCount: edgeCaseCount,
        hasMarkdownTable: hasMarkdownTable,
        hasAllColumns: missingColumns.length === 0
      }
    };
  }

  /**
   * Validate bug report response from AI
   * @param {string} aiOutput - Raw AI output
   * @returns {Object} Validation result
   */
  validateBugReportResponse(aiOutput) {
    const issues = [];
    const suggestions = [];
    let qualityScore = 100;

    if (!aiOutput || typeof aiOutput !== 'string' || aiOutput.trim().length === 0) {
      return {
        valid: false,
        issues: ['AI output is empty or invalid'],
        suggestions: ['Ensure the AI model generates a response'],
        qualityScore: 0
      };
    }

    const output = aiOutput.trim();

    // Required sections
    const requiredSections = [
      { name: 'Title/Summary', patterns: [/title|summary|subject/i] },
      { name: 'Description', patterns: [/description|overview/i] },
      { name: 'Steps to Reproduce', patterns: [/steps?\s+to\s+reproduce|reproduction\s+steps/i] },
      { name: 'Expected Behavior', patterns: [/expected\s+behavior|expected\s+result/i] },
      { name: 'Actual Behavior', patterns: [/actual\s+behavior|actual\s+result/i] }
    ];

    requiredSections.forEach(section => {
      const found = section.patterns.some(pattern => pattern.test(output));
      if (!found) {
        issues.push(`Missing required section: ${section.name}`);
        suggestions.push(`Include a clear "${section.name}" section`);
        qualityScore -= 15;
      }
    });

    // Check for placeholder text
    if (/\[TODO\]|TBD|placeholder/gi.test(output)) {
      issues.push('Placeholder text detected');
      suggestions.push('Replace all placeholders with actual bug details');
      qualityScore -= 10;
    }

    // Check detail level
    const stepCount = (output.match(/\d+\./g) || []).length;
    if (stepCount < 3) {
      issues.push('Steps to reproduce are too brief (less than 3 steps)');
      suggestions.push('Provide detailed, numbered steps to reproduce the bug');
      qualityScore -= 10;
    }

    // Check for environment/priority if mentioned
    const hasEnvironment = /environment|browser|os|device/i.test(output);
    const hasPriority = /priority|severity|critical|high|medium|low/i.test(output);

    if (!hasEnvironment) {
      suggestions.push('Consider adding environment details (browser, OS, device)');
      qualityScore -= 5;
    }

    if (!hasPriority) {
      suggestions.push('Consider adding priority/severity level');
      qualityScore -= 5;
    }

    qualityScore = Math.max(0, Math.min(100, qualityScore));

    return {
      valid: issues.length === 0,
      issues: issues,
      suggestions: suggestions,
      qualityScore: Math.round(qualityScore),
      metrics: {
        hasAllSections: issues.filter(i => i.includes('Missing required section')).length === 0,
        stepCount: stepCount,
        hasEnvironment: hasEnvironment,
        hasPriority: hasPriority
      }
    };
  }

  /**
   * Validate test plan response from AI
   * @param {string} aiOutput - Raw AI output
   * @returns {Object} Validation result
   */
  validateTestPlanResponse(aiOutput) {
    const issues = [];
    const suggestions = [];
    let qualityScore = 100;

    if (!aiOutput || typeof aiOutput !== 'string' || aiOutput.trim().length === 0) {
      return {
        valid: false,
        issues: ['AI output is empty or invalid'],
        suggestions: ['Ensure the AI model generates a response'],
        qualityScore: 0
      };
    }

    const output = aiOutput.trim();

    // Required sections for test plan
    const requiredSections = [
      { name: 'Test Objectives', patterns: [/test\s+objectives?|objectives?/i] },
      { name: 'Scope', patterns: [/scope|in\s+scope|out\s+of\s+scope/i] },
      { name: 'Test Approach', patterns: [/test\s+approach|strategy|methodology/i] },
      { name: 'Test Types', patterns: [/test\s+types?|functional|regression|performance/i] }
    ];

    requiredSections.forEach(section => {
      const found = section.patterns.some(pattern => pattern.test(output));
      if (!found) {
        issues.push(`Missing required section: ${section.name}`);
        suggestions.push(`Include a clear "${section.name}" section in the test plan`);
        qualityScore -= 15;
      }
    });

    // Check for placeholder text
    if (/\[TODO\]|TBD|placeholder/gi.test(output)) {
      issues.push('Placeholder text detected');
      suggestions.push('Replace all placeholders with actual test plan content');
      qualityScore -= 10;
    }

    // Check detail level
    const sectionCount = (output.match(/##?\s+/g) || []).length;
    if (sectionCount < 5) {
      issues.push('Test plan is too brief (less than 5 sections)');
      suggestions.push('Expand the test plan with more detailed sections (environment, resources, timeline, risks, etc.)');
      qualityScore -= 10;
    }

    // Check for actionable content
    const hasActionableItems = /bullet|list|•|\d+\./i.test(output);
    if (!hasActionableItems) {
      issues.push('Test plan lacks structured, actionable content');
      suggestions.push('Use bullet points or numbered lists for better readability');
      qualityScore -= 10;
    }

    qualityScore = Math.max(0, Math.min(100, qualityScore));

    return {
      valid: issues.length === 0,
      issues: issues,
      suggestions: suggestions,
      qualityScore: Math.round(qualityScore),
      metrics: {
        hasAllSections: issues.filter(i => i.includes('Missing required section')).length === 0,
        sectionCount: sectionCount,
        hasActionableItems: hasActionableItems
      }
    };
  }

  /**
   * Validate automation suggestions response from AI
   * @param {string} aiOutput - Raw AI output
   * @returns {Object} Validation result
   */
  validateAutomationSuggestions(aiOutput) {
    const issues = [];
    const suggestions = [];
    let qualityScore = 100;

    if (!aiOutput || typeof aiOutput !== 'string' || aiOutput.trim().length === 0) {
      return {
        valid: false,
        issues: ['AI output is empty or invalid'],
        suggestions: ['Ensure the AI model generates a response'],
        qualityScore: 0
      };
    }

    const output = aiOutput.trim();

    // Check for code examples
    const hasCode = /```|code|example|sample|playwright|selenium|cypress/i.test(output);
    if (!hasCode) {
      issues.push('No code examples or automation framework mentioned');
      suggestions.push('Include code examples or framework recommendations (Playwright, Selenium, etc.)');
      qualityScore -= 20;
    }

    // Check for framework recommendations
    const frameworks = ['playwright', 'selenium', 'cypress', 'puppeteer', 'webdriver', 'testcafe'];
    const mentionedFrameworks = frameworks.filter(fw => new RegExp(fw, 'i').test(output));
    
    if (mentionedFrameworks.length === 0) {
      issues.push('No automation framework recommendations provided');
      suggestions.push('Recommend specific automation frameworks (Playwright, Selenium, Cypress, etc.)');
      qualityScore -= 15;
    }

    // Check for placeholder text
    if (/\[TODO\]|TBD|placeholder/gi.test(output)) {
      issues.push('Placeholder text detected');
      suggestions.push('Replace all placeholders with actual automation suggestions');
      qualityScore -= 10;
    }

    // Check for actionable suggestions
    const hasActionableItems = /should|recommend|suggest|consider|implement/i.test(output);
    if (!hasActionableItems) {
      issues.push('Lacks actionable automation suggestions');
      suggestions.push('Provide specific, actionable automation recommendations');
      qualityScore -= 10;
    }

    // Check detail level
    const suggestionCount = (output.match(/\d+\.|•|- /g) || []).length;
    if (suggestionCount < 3) {
      issues.push('Too few automation suggestions (less than 3)');
      suggestions.push('Provide at least 3-5 specific automation suggestions');
      qualityScore -= 10;
    }

    qualityScore = Math.max(0, Math.min(100, qualityScore));

    return {
      valid: issues.length === 0,
      issues: issues,
      suggestions: suggestions,
      qualityScore: Math.round(qualityScore),
      metrics: {
        hasCode: hasCode,
        frameworksMentioned: mentionedFrameworks,
        suggestionCount: suggestionCount,
        hasActionableItems: hasActionableItems
      }
    };
  }

  /**
   * Generate improvement prompt based on validation issues
   * @param {string} originalPrompt - Original prompt sent to AI
   * @param {Object} validationResult - Validation result with issues and suggestions
   * @returns {string} Improved prompt with validation feedback
   */
  generateImprovementPrompt(originalPrompt, validationResult) {
    let improvementPrompt = `${originalPrompt}\n\n`;
    improvementPrompt += `IMPORTANT: The previous response had quality issues. Please address the following:\n\n`;
    
    if (validationResult.issues.length > 0) {
      improvementPrompt += `ISSUES FOUND:\n`;
      validationResult.issues.forEach((issue, index) => {
        improvementPrompt += `${index + 1}. ${issue}\n`;
      });
      improvementPrompt += `\n`;
    }

    if (validationResult.suggestions.length > 0) {
      improvementPrompt += `SUGGESTIONS FOR IMPROVEMENT:\n`;
      validationResult.suggestions.forEach((suggestion, index) => {
        improvementPrompt += `${index + 1}. ${suggestion}\n`;
      });
      improvementPrompt += `\n`;
    }

    improvementPrompt += `Please regenerate the response addressing all issues above. Ensure high quality and completeness.`;

    return improvementPrompt;
  }

  /**
   * Validate and retry AI generation with improvements
   * @param {Function} generateFunction - Function that generates AI output
   * @param {Function} validateFunction - Function that validates the output
   * @param {string} originalPrompt - Original prompt
   * @param {number} maxRetries - Maximum retry attempts (default: 2)
   * @returns {Promise<{output: string, validation: Object, attempts: number}>}
   */
  async validateAndRetry(generateFunction, validateFunction, originalPrompt, maxRetries = 2) {
    let bestOutput = null;
    let bestValidation = null;
    let attempts = 0;
    let currentPrompt = originalPrompt;

    while (attempts <= maxRetries) {
      attempts++;
      console.log(`\n🔄 Validation attempt ${attempts}/${maxRetries + 1}`);

      try {
        // Generate output
        const output = await generateFunction(currentPrompt);
        
        // Validate output
        const validation = validateFunction(output);
        
        console.log(`   Quality Score: ${validation.qualityScore}/100`);
        console.log(`   Issues: ${validation.issues.length}`);
        console.log(`   Valid: ${validation.valid}`);

        // Track best attempt
        if (!bestOutput || validation.qualityScore > bestValidation.qualityScore) {
          bestOutput = output;
          bestValidation = validation;
        }

        // If valid, return immediately
        if (validation.valid) {
          console.log(`✅ Validation passed on attempt ${attempts}`);
          return {
            output: output,
            validation: validation,
            attempts: attempts
          };
        }

        // If not last attempt, create improvement prompt
        if (attempts <= maxRetries) {
          console.log(`⚠️  Validation failed, creating improvement prompt...`);
          currentPrompt = this.generateImprovementPrompt(originalPrompt, validation);
          
          // Log issues for debugging
          if (validation.issues.length > 0) {
            console.log(`   Issues to fix:`);
            validation.issues.forEach(issue => console.log(`     - ${issue}`));
          }
        }

      } catch (error) {
        console.error(`❌ Error in validation attempt ${attempts}:`, error.message);
        if (attempts > maxRetries) {
          throw error;
        }
      }
    }

    // Return best attempt with warnings
    console.log(`⚠️  Validation failed after ${attempts} attempts. Returning best attempt with warnings.`);
    return {
      output: bestOutput,
      validation: bestValidation,
      attempts: attempts,
      warnings: ['Response did not pass all validation checks. Review issues and suggestions.']
    };
  }

  // ========== CONVERSATION MEMORY SYSTEM ==========

  /**
   * Save conversation turn to history
   * @param {string} projectId - Project ID
   * @param {string} userMessage - User's message
   * @param {string} aiResponse - AI's response
   * @param {Object} metadata - Additional metadata
   * @param {string} metadata.intent - Detected intent
   * @param {string} metadata.workflow - Workflow used
   * @param {Array} metadata.sources - Document sources used
   * @param {Array} metadata.documentsUsed - Document names used
   */
  saveConversation(projectId, userMessage, aiResponse, metadata = {}) {
    if (!projectId) {
      console.warn('⚠️  Cannot save conversation: projectId is required');
      return;
    }

    if (!this.conversationHistory.has(projectId)) {
      this.conversationHistory.set(projectId, []);
    }

    const history = this.conversationHistory.get(projectId);
    
    const conversationTurn = {
      timestamp: new Date().toISOString(),
      user: userMessage,
      assistant: aiResponse,
      contextUsed: metadata.sources || [],
      documentsUsed: metadata.documentsUsed || [],
      taskType: metadata.workflow || metadata.intent || 'General',
      intent: metadata.intent,
      workflow: metadata.workflow
    };

    history.push(conversationTurn);

    // Keep only last 50 conversations per project (prevent memory bloat)
    if (history.length > 50) {
      history.shift();
    }

    console.log(`💾 Saved conversation turn for project ${projectId} (${history.length} total turns)`);
  }

  /**
   * Get conversation history for a project
   * @param {string} projectId - Project ID
   * @param {number} limit - Maximum number of recent turns to return (default: 5)
   * @returns {Array} Array of conversation turns
   */
  getConversationHistory(projectId, limit = 5) {
    if (!projectId || !this.conversationHistory.has(projectId)) {
      return [];
    }

    const history = this.conversationHistory.get(projectId);
    return history.slice(-limit); // Return last N turns
  }

  /**
   * Clear conversation history for a project
   * @param {string} projectId - Project ID
   * @returns {boolean} Success status
   */
  clearConversationHistory(projectId) {
    if (!projectId) {
      return false;
    }

    if (this.conversationHistory.has(projectId)) {
      this.conversationHistory.delete(projectId);
      console.log(`🗑️  Cleared conversation history for project ${projectId}`);
      return true;
    }

    return false;
  }

  /**
   * Get all unique documents used in conversation history
   * @param {string} projectId - Project ID
   * @returns {Array} Array of unique document names
   */
  getDocumentsUsedInHistory(projectId) {
    if (!projectId || !this.conversationHistory.has(projectId)) {
      return [];
    }

    const history = this.conversationHistory.get(projectId);
    const documents = new Set();
    
    history.forEach(turn => {
      if (turn.documentsUsed && Array.isArray(turn.documentsUsed)) {
        turn.documentsUsed.forEach(doc => documents.add(doc));
      }
    });

    return Array.from(documents);
  }

  /**
   * Get previously discussed features/modules from conversation history
   * @param {string} projectId - Project ID
   * @returns {Array} Array of feature/module names mentioned
   */
  getPreviouslyDiscussedFeatures(projectId) {
    if (!projectId || !this.conversationHistory.has(projectId)) {
      return [];
    }

    const history = this.conversationHistory.get(projectId);
    const features = new Set();
    
    // Extract feature names from user messages and assistant responses
    const featurePatterns = [
      /(?:for|of|on|about)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g,
      /(?:module|feature|functionality)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi,
      /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:test|testing|cases|plan|automation)/gi
    ];

    history.forEach(turn => {
      const text = `${turn.user} ${turn.assistant}`;
      featurePatterns.forEach(pattern => {
        const matches = text.matchAll(pattern);
        for (const match of matches) {
          if (match[1] && match[1].length > 2) {
            features.add(match[1]);
          }
        }
      });
    });

    return Array.from(features).slice(0, 10); // Return top 10 features
  }

  /**
   * Build conversation context for prompts
   * @param {string} projectId - Project ID
   * @param {number} turns - Number of recent turns to include (default: 3)
   * @returns {string} Formatted conversation context string
   */
  buildConversationContext(projectId, turns = 3) {
    const history = this.getConversationHistory(projectId, turns);
    
    if (history.length === 0) {
      return '';
    }

    let context = '\n\n=== PREVIOUS CONVERSATION CONTEXT ===\n';
    context += `You have had ${history.length} previous interaction(s) with this user in this project:\n\n`;

    history.forEach((turn, index) => {
      context += `Turn ${index + 1} (${new Date(turn.timestamp).toLocaleString()}):\n`;
      context += `User: ${turn.user.substring(0, 200)}${turn.user.length > 200 ? '...' : ''}\n`;
      context += `Task: ${turn.taskType}\n`;
      
      if (turn.documentsUsed && turn.documentsUsed.length > 0) {
        context += `Documents used: ${turn.documentsUsed.join(', ')}\n`;
      }
      
      context += `\n`;
    });

    // Add previously discussed features
    const features = this.getPreviouslyDiscussedFeatures(projectId);
    if (features.length > 0) {
      context += `Previously discussed features/modules: ${features.join(', ')}\n`;
    }

    // Add documents used in history
    const documents = this.getDocumentsUsedInHistory(projectId);
    if (documents.length > 0) {
      context += `Documents you've already analyzed: ${documents.join(', ')}\n`;
    }

    context += `\nUse this context to provide more relevant, consistent responses. Reference previous discussions when relevant.\n`;
    context += `=== END CONVERSATION CONTEXT ===\n\n`;

    return context;
  }

  /**
   * Process agentic request - Main orchestrator
   * Classifies intent and routes to appropriate workflow
   * @param {string} userMessage - User's message/question
   * @param {string} context - Context from project documents (RAG)
   * @param {string} aiModel - AI model to use
   * @param {string} apiKey - API key
   * @param {string} projectId - Project ID (optional, for workflows that need it)
   * @returns {Promise<{answer: string, intent: string, workflow: string, metadata?: object}>}
   */
  async processAgenticRequest(userMessage, context, aiModel, apiKey, projectId = null) {
    console.log('\n🤖 AGENTIC MODE: Processing request...');
    console.log(`📝 User message: ${userMessage.substring(0, 100)}${userMessage.length > 100 ? '...' : ''}`);

    // Step 1: Build conversation context if projectId is available
    let conversationContext = '';
    if (projectId) {
      conversationContext = this.buildConversationContext(projectId, 3);
      if (conversationContext) {
        console.log(`💭 Including conversation history (${this.getConversationHistory(projectId, 3).length} previous turns)`);
      }
    }

    // Step 2: Classify user intent
    const intent = await this.classifyUserIntent(userMessage, aiModel, apiKey);
    console.log(`🎯 Detected intent: ${intent}`);

    // Step 3: Enhance context with conversation history
    let enhancedContext = context;
    if (conversationContext) {
      enhancedContext = `${context}\n\n${conversationContext}`;
    }

    // Step 4: Route to appropriate workflow
    let answer;
    let workflowName;
    let metadata = null;

    switch (intent) {
      case AIService.INTENT_TYPES.TEST_CASE_GENERATION:
        workflowName = 'Test Case Generation';
        console.log(`🔄 Executing workflow: ${workflowName}`);
        const testCasesResult = await this.generateTestCasesWorkflow(
          userMessage, 
          projectId || 'unknown', 
          enhancedContext, 
          aiModel, 
          apiKey
        );
        // Format the structured result as a readable answer
        answer = `${testCasesResult.summary}\n\n${testCasesResult.markdownTable}`;
        metadata = {
          testCases: testCasesResult.testCases,
          coverageAnalysis: testCasesResult.coverageAnalysis,
          qualityScore: testCasesResult.qualityScore,
          analysis: testCasesResult.analysis
        };
        break;

      case AIService.INTENT_TYPES.BUG_REPORT_FORMATTING:
        workflowName = 'Bug Report Formatting';
        console.log(`🔄 Executing workflow: ${workflowName}`);
        answer = await this.formatBugReportWorkflow(enhancedContext, userMessage, aiModel, apiKey);
        break;

      case AIService.INTENT_TYPES.TEST_PLAN_CREATION:
        workflowName = 'Test Plan Creation';
        console.log(`🔄 Executing workflow: ${workflowName}`);
        answer = await this.createTestPlanWorkflow(enhancedContext, userMessage, aiModel, apiKey);
        break;

      case AIService.INTENT_TYPES.AUTOMATION_SUGGESTION:
        workflowName = 'Automation Suggestion';
        console.log(`🔄 Executing workflow: ${workflowName}`);
        answer = await this.suggestAutomationWorkflow(enhancedContext, userMessage, aiModel, apiKey);
        break;

      case AIService.INTENT_TYPES.DOCUMENT_ANALYSIS:
        workflowName = 'Document Analysis';
        console.log(`🔄 Executing workflow: ${workflowName}`);
        answer = await this.analyzeDocumentsWorkflow(enhancedContext, userMessage, aiModel, apiKey);
        break;

      case AIService.INTENT_TYPES.GENERAL_QA_QUESTION:
      default:
        workflowName = 'General QA Answer';
        console.log(`🔄 Executing workflow: ${workflowName}`);
        answer = await this.answerGeneralQuestion(enhancedContext, userMessage, aiModel, apiKey);
        break;
    }

    console.log(`✅ Workflow completed: ${workflowName}`);

    return {
      answer,
      intent,
      workflow: workflowName,
      ...(metadata && { metadata })
    };
  }
}

module.exports = new AIService();

