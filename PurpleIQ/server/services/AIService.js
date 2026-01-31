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
}

module.exports = new AIService();

