const { GoogleGenerativeAI } = require('@google/generative-ai');
const vectorStore = require('./VectorStore');
const projectStorage = require('../storage/ProjectStorage');
const { createServiceLogger } = require('../utils/logger');

/**
 * Embedding Service
 * ONLY: Google Gemini (high quota, reliable)
 * 
 * OpenAI embeddings have been completely removed to prevent 429 quota errors.
 * All embeddings use Google Gemini only.
 */
class EmbeddingService {
  constructor() {
    this.geminiClients = new Map(); // Cache Gemini clients per API key
    this.MIN_SIMILARITY_THRESHOLD = 0.4; // Minimum similarity score for quality matches
    
    // Rate limit tracking for Gemini
    this.requestCounts = {
      gemini: { count: 0, resetTime: Date.now() + 60000 } // Reset every minute
    };
    
    // Rate limits (requests per minute)
    // Conservative limits to prevent 429 errors
    this.rateLimits = {
      gemini: 1500 // Gemini's actual limit is much higher, but we're conservative
    };
    
    // Initialize logger
    this.logger = createServiceLogger('EmbeddingService');
    this.logger.info('Embedding Service initialized', {
      function: 'constructor',
      provider: 'GEMINI_ONLY',
      rateLimits: this.rateLimits
    });
    
    console.log('\n🔧 EMBEDDING SERVICE CONFIGURATION:');
    console.log('   ✅ PROVIDER: Google Gemini ONLY');
    console.log('   🚫 OpenAI: REMOVED (to prevent 429 quota errors)');
    console.log('   🛡️  RATE LIMIT PROTECTION: Enabled');
    console.log(`      Gemini: ${this.rateLimits.gemini} req/min`);
    console.log('   ✅ No OpenAI dependencies - 100% Gemini\n');
  }

  /**
   * Get or create Gemini client for API key
   */
  getGeminiClient(apiKey) {
    const key = apiKey || process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error('Gemini API key required. Set GEMINI_API_KEY in environment.');
    }
    
    if (!this.geminiClients.has(key)) {
      this.geminiClients.set(key, new GoogleGenerativeAI(key));
    }
    return this.geminiClients.get(key);
  }

  // OpenAI client removed - embeddings use Gemini only

  /**
   * Check if we're approaching rate limits for a provider
   * @param {string} provider - 'gemini' or 'openai'
   * @returns {boolean} true if safe to proceed, false if approaching limit
   */
  checkRateLimit(provider) {
    const now = Date.now();
    const tracker = this.requestCounts[provider];
    
    if (!tracker) {
      return true; // Unknown provider, allow
    }
    
    // Reset counter if time window passed
    if (now > tracker.resetTime) {
      tracker.count = 0;
      tracker.resetTime = now + 60000; // Reset for next minute
    }
    
    // Check if approaching limit (90% threshold)
    const limit = this.rateLimits[provider];
    const percentage = (tracker.count / limit) * 100;
    
    if (percentage >= 90) {
      console.warn(`⚠️  Approaching ${provider.toUpperCase()} rate limit: ${tracker.count}/${limit} (${Math.round(percentage)}%)`);
      return false;
    }
    
    if (percentage >= 75) {
      console.log(`📊 ${provider.toUpperCase()} rate limit: ${tracker.count}/${limit} (${Math.round(percentage)}%)`);
    }
    
    return true;
  }

  /**
   * Increment rate limit counter for a provider
   * @param {string} provider - 'gemini' or 'openai'
   */
  incrementRateLimit(provider) {
    const tracker = this.requestCounts[provider];
    if (tracker) {
      tracker.count++;
    }
  }

  /**
   * Wait if needed to avoid rate limits
   * @param {string} provider - 'gemini' or 'openai'
   */
  async waitIfNeeded(provider) {
    if (!this.checkRateLimit(provider)) {
      const tracker = this.requestCounts[provider];
      const waitTime = tracker.resetTime - Date.now();
      
      if (waitTime > 0 && waitTime < 60000) { // Only wait if reasonable (less than 1 minute)
        const waitSeconds = Math.ceil(waitTime / 1000);
        console.log(`⏳ Rate limit reached for ${provider.toUpperCase()}, waiting ${waitSeconds}s before reset...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        
        // Reset counter after waiting
        tracker.count = 0;
        tracker.resetTime = Date.now() + 60000;
        console.log(`✅ Rate limit window reset for ${provider.toUpperCase()}`);
      }
    }
  }

  /**
   * Get current rate limit status for Gemini
   * @returns {Object} Rate limit status for Gemini
   */
  getRateLimitStatus() {
    const now = Date.now();
    
    const status = {
      gemini: {
        count: this.requestCounts.gemini.count,
        limit: this.rateLimits.gemini,
        percentage: Math.round((this.requestCounts.gemini.count / this.rateLimits.gemini) * 100),
        resetsIn: Math.max(0, Math.ceil((this.requestCounts.gemini.resetTime - now) / 1000)),
        status: this.requestCounts.gemini.count >= this.rateLimits.gemini * 0.9 ? 'warning' : 'ok'
      },
      note: 'OpenAI embeddings have been removed. Only Gemini is used.'
    };
    
    return status;
  }

  /**
   * Generate single embedding using Gemini
   * @param {string} text - Text to embed
   * @param {string} apiKey - API key (optional, uses GEMINI_API_KEY from env if not provided)
   * @param {string} requestId - Request ID for logging (optional)
   * @returns {Promise<Array<number>>} Embedding vector
   */
  async generateEmbedding(text, apiKey = null, requestId = null) {
    const embeddings = await this.generateEmbeddings([text], apiKey, requestId);
    return embeddings[0];
  }

  /**
   * Generate embeddings for multiple texts using Gemini ONLY
   * OpenAI embeddings have been completely removed to prevent 429 quota errors.
   * 
   * @param {Array<string>} texts - Array of texts to embed
   * @param {string} apiKey - API key (ignored, always uses GEMINI_API_KEY from env)
   * @param {string} requestId - Request ID for logging (optional)
   * @returns {Promise<Array<Array<number>>>} Array of embedding vectors
   */
  async generateEmbeddings(texts, apiKey = null, requestId = null) {
    if (!texts || texts.length === 0) {
      throw new Error('No texts provided for embedding generation');
    }

    console.log(`\n📊 [EMBEDDINGS] Generating ${texts.length} embeddings...`);
    console.log(`   Provider: Google Gemini ONLY`);
    console.log(`   Note: OpenAI embeddings have been removed to prevent 429 quota errors`);

    // ALWAYS use Gemini (OpenAI has been completely removed)
    const geminiKey = process.env.GEMINI_API_KEY;

    console.log(`   Gemini key available: ${!!geminiKey}`);
    if (geminiKey) {
      console.log(`   Gemini key: ${geminiKey.substring(0, 10)}...${geminiKey.substring(geminiKey.length - 4)}`);
    }
    console.log(`   Using GEMINI_API_KEY from environment`);

    // Try Gemini FIRST (PRIMARY) with rate limit protection
    if (geminiKey) {
      try {
        // Check and wait if needed to avoid rate limits
        await this.waitIfNeeded('gemini');
        
        console.log(`🔄 [PRIMARY] Trying Gemini embeddings...`);
        const embeddings = await this.generateEmbeddingsWithGemini(texts, geminiKey, requestId);
        
        // Increment rate limit counter
        this.incrementRateLimit('gemini');
        
        console.log(`✅ [SUCCESS] Gemini generated ${embeddings.length} embeddings`);
        return embeddings;
      } catch (geminiError) {
        const errorMsg = geminiError.message || String(geminiError);
        console.error(`\n❌ [GEMINI EMBEDDING ERROR]`);
        console.error(`   Error: ${errorMsg}`);
        console.error(`   Please check:`);
        console.error(`   1. GEMINI_API_KEY is set in your .env file`);
        console.error(`   2. GEMINI_API_KEY is valid and has embedding access`);
        console.error(`   3. Gemini API is accessible`);
        console.error(`   4. You have quota/credits available`);
        console.error(`   Note: OpenAI embeddings have been removed. Only Gemini is supported.\n`);
        
        throw new Error(`Failed to generate embeddings with Gemini: ${errorMsg}. Please check your GEMINI_API_KEY in .env and ensure it's valid. OpenAI embeddings are not available.`);
      }
    } else {
      // No Gemini key available - CRITICAL ERROR
      console.error(`\n❌ [CRITICAL] GEMINI_API_KEY not set in environment!`);
      console.error(`   Embeddings require GEMINI_API_KEY`);
      console.error(`   Please set GEMINI_API_KEY in your .env file`);
      console.error(`   Note: OpenAI embeddings have been removed. Only Gemini is supported.\n`);
      throw new Error('GEMINI_API_KEY is required for embeddings. Please set it in your .env file. OpenAI embeddings are not available.');
    }
  }

  /**
   * Generate embeddings using Gemini (PRIMARY)
   * @param {Array<string>} texts - Array of texts to embed
   * @param {string} apiKey - Gemini API key
   * @param {string} requestId - Request ID for logging
   * @returns {Promise<Array<Array<number>>>} Array of embedding vectors
   */
  async generateEmbeddingsWithGemini(texts, apiKey, requestId = null) {
    const startTime = Date.now();
    try {
      const genAI = this.getGeminiClient(apiKey);
      
      // Try different Gemini embedding model names
      const possibleModels = [
        'models/text-embedding-004',
        'models/embedding-001',
        'text-embedding-004',
        'embedding-001'
      ];
      
      let workingModel = null;
      let lastError = null;
      
      // Find a working model - try each one
      for (const modelName of possibleModels) {
        try {
          console.log(`   Trying model: ${modelName}...`);
          const model = genAI.getGenerativeModel({ model: modelName });
          
          // Try to embed a test string
          const testResult = await model.embedContent('test');
          
          // Check response structure - Gemini returns different structures
          let hasEmbedding = false;
          if (testResult) {
            // Check various possible response structures
            if (testResult.embedding) {
              if (testResult.embedding.values) {
                hasEmbedding = true;
              } else if (Array.isArray(testResult.embedding)) {
                hasEmbedding = true;
              } else if (typeof testResult.embedding === 'object') {
                hasEmbedding = true;
              }
            }
          }
          
          if (hasEmbedding) {
            workingModel = modelName;
            console.log(`   ✅ Found working Gemini embedding model: ${modelName}`);
            break;
          } else {
            console.log(`   ⚠️  Model ${modelName} returned invalid structure`);
          }
        } catch (modelError) {
          console.log(`   ❌ Model ${modelName} failed: ${modelError.message.substring(0, 80)}`);
          lastError = modelError;
          continue;
        }
      }
      
      if (!workingModel) {
        const errorDetails = lastError ? lastError.message : 'Unknown error';
        console.error(`\n❌ [CRITICAL] No working Gemini embedding model found!`);
        console.error(`   Tried models: ${possibleModels.join(', ')}`);
        console.error(`   Last error: ${errorDetails}`);
        console.error(`   Please check:`);
        console.error(`   1. Your GEMINI_API_KEY is valid`);
        console.error(`   2. You have access to Gemini embedding models`);
        console.error(`   3. Your API key has embedding permissions\n`);
        throw new Error(`No working Gemini embedding model found. Tried: ${possibleModels.join(', ')}. Last error: ${errorDetails}. Please verify your GEMINI_API_KEY and embedding model access.`);
      }
      
      // Generate embeddings for all texts
      const embeddings = [];
      const batchSize = 5; // Process 5 at a time to avoid rate limits
      
      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        const batchPromises = batch.map(async (text) => {
          try {
            const model = genAI.getGenerativeModel({ model: workingModel });
            const result = await model.embedContent(text);
            
            // Extract embedding values
            let embeddingValues = null;
            if (result && result.embedding) {
              if (result.embedding.values) {
                embeddingValues = result.embedding.values;
              } else if (Array.isArray(result.embedding)) {
                embeddingValues = result.embedding;
              } else if (typeof result.embedding === 'object' && 'values' in result.embedding) {
                embeddingValues = result.embedding.values;
              }
            }
            
            if (!embeddingValues || !Array.isArray(embeddingValues) || embeddingValues.length === 0) {
              throw new Error('Invalid embedding response structure from Gemini');
            }
            
            return embeddingValues;
          } catch (textError) {
            throw new Error(`Failed to embed text: ${textError.message}`);
          }
        });
        
        const batchResults = await Promise.all(batchPromises);
        embeddings.push(...batchResults);
        
        // Small delay between batches to avoid rate limits
        if (i + batchSize < texts.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      const duration = Date.now() - startTime;
      
      this.logger.performance('generateEmbeddingsWithGemini', duration, {
        function: 'generateEmbeddingsWithGemini',
        provider: 'gemini',
        model: workingModel,
        count: embeddings.length,
        dimension: embeddings[0]?.length,
        requestId
      });
      
      return embeddings;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      let errorMsg = error.message || String(error);
      
      // Sanitize error message - remove any OpenAI references
      errorMsg = errorMsg.replace(/OpenAI/g, 'Gemini');
      errorMsg = errorMsg.replace(/Failed to generate embeddings with OpenAI/g, 'Failed to generate embeddings with Gemini');
      errorMsg = errorMsg.replace(/429.*quota.*error/gi, 'API error');
      
      console.error(`\n❌ [GEMINI EMBEDDING ERROR]`);
      console.error(`   Error: ${errorMsg}`);
      console.error(`   Duration: ${duration}ms`);
      console.error(`   Note: OpenAI embeddings have been removed. Only Gemini is used.`);
      console.error(`   Please check:`);
      console.error(`   1. GEMINI_API_KEY is set in .env file`);
      console.error(`   2. GEMINI_API_KEY is valid and has embedding access`);
      console.error(`   3. Gemini API is accessible`);
      console.error(`   4. You have quota/credits available\n`);
      
      this.logger.error('Error generating embeddings with Gemini', {
        function: 'generateEmbeddingsWithGemini',
        provider: 'gemini',
        error: errorMsg,
        duration: `${duration}ms`,
        requestId,
        stack: error.stack
      });
      
      throw new Error(`Failed to generate embeddings with Gemini: ${errorMsg}. Please check your GEMINI_API_KEY in .env and ensure it's valid. OpenAI embeddings are not available.`);
    }
  }

  // OpenAI embedding function removed - embeddings use Gemini only

  /**
   * Detect which embedding provider to use (for compatibility)
   * Always returns 'gemini' - OpenAI has been removed
   */
  detectProvider(apiKey) {
    // Only Gemini is supported now
    return 'gemini';
  }

  /**
   * Calculate cosine similarity between two vectors
   * Works with Gemini embeddings (768 dimensions)
   */
  cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || !Array.isArray(vecA) || !Array.isArray(vecB)) {
      return 0;
    }
    
    // Normalize if dimensions don't match (shouldn't happen but safety check)
    if (vecA.length !== vecB.length) {
      console.warn(`⚠️ Vector dimension mismatch: ${vecA.length} vs ${vecB.length}`);
      return 0;
    }
    
    const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
    const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
    const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
    
    if (magnitudeA === 0 || magnitudeB === 0) return 0;
    
    return dotProduct / (magnitudeA * magnitudeB);
  }

  /**
   * Detailed vector search debug function
   * Logs everything: query, all chunks, similarity scores, embeddings status
   */
  async debugVectorSearch(projectId, query = 'login functionality') {
    console.log('\n' + '='.repeat(80));
    console.log(`🔍 DETAILED VECTOR SEARCH DEBUG`);
    console.log('='.repeat(80));
    console.log(`Project ID: ${projectId}`);
    console.log(`Query: "${query}"`);
    console.log('='.repeat(80) + '\n');

    try {
      // Get project
      const project = await projectStorage.getProject(projectId);
      if (!project) {
        throw new Error(`Project ${projectId} not found`);
      }

      // STEP 1: Check if vectors exist
      console.log('📦 STEP 1: Checking Vector Storage');
      console.log('─'.repeat(80));
      const allVectors = await vectorStore.getProjectVectors(projectId);
      console.log(`Total chunks in project: ${allVectors.length}`);
      
      if (allVectors.length === 0) {
        console.log('❌ No vectors found! Documents may not have been processed.');
        return {
          error: 'No vectors found',
          projectId,
          query
        };
      }

      // Check embeddings
      console.log('\n📊 Embedding Status:');
      const sampleVector = allVectors[0];
      if (sampleVector.embedding) {
        console.log(`✅ Embeddings are present`);
        console.log(`   Embedding dimension: ${sampleVector.embedding.length}`);
        console.log(`   Sample embedding (first 5 values): [${sampleVector.embedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}...]`);
      } else {
        console.log('❌ Embeddings are missing!');
        return {
          error: 'Embeddings missing',
          projectId,
          query
        };
      }

      // STEP 2: Show all chunks
      console.log('\n📄 STEP 2: All Chunks in Project');
      console.log('─'.repeat(80));
      allVectors.forEach((chunk, idx) => {
        const preview = chunk.text ? chunk.text.substring(0, 100) : '(no text)';
        console.log(`Chunk ${idx + 1}:`);
        console.log(`  Document: ${chunk.documentName || 'unknown'}`);
        console.log(`  Index: ${chunk.chunkIndex || idx}`);
        console.log(`  Text (first 100 chars): ${preview}...`);
        console.log(`  Full length: ${chunk.text?.length || 0} chars`);
        console.log(`  Has embedding: ${chunk.embedding ? '✅' : '❌'}`);
        if (chunk.embedding) {
          console.log(`  Embedding length: ${chunk.embedding.length}`);
        }
        console.log('');
      });

      // STEP 3: Generate query embedding
      console.log('🔮 STEP 3: Generating Query Embedding');
      console.log('─'.repeat(80));
      console.log(`Query: "${query}"`);
      const queryEmbedding = await this.generateEmbedding(query, project.apiKey);
      console.log(`✅ Query embedding generated`);
      console.log(`   Embedding dimension: ${queryEmbedding.length}`);
      console.log(`   Sample (first 5 values): [${queryEmbedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}...]`);

      // STEP 4: Calculate similarity for ALL chunks
      console.log('\n📊 STEP 4: Calculating Similarity for ALL Chunks');
      console.log('─'.repeat(80));
      const allSimilarities = allVectors.map((chunk, idx) => {
        const similarity = this.cosineSimilarity(queryEmbedding, chunk.embedding);
        return {
          index: idx,
          chunkIndex: chunk.chunkIndex || idx,
          documentName: chunk.documentName || 'unknown',
          similarity: similarity,
          text: chunk.text || '',
          textLength: chunk.text?.length || 0
        };
      });

      // Sort by similarity
      allSimilarities.sort((a, b) => b.similarity - a.similarity);

      // Show similarity scores for all chunks
      console.log(`\nSimilarity Scores (sorted from highest to lowest):`);
      allSimilarities.forEach((item, idx) => {
        const preview = item.text.substring(0, 100);
        console.log(`${idx + 1}. Score: ${item.similarity.toFixed(4)} | Doc: ${item.documentName} | Chunk: ${item.chunkIndex}`);
        console.log(`   Preview: ${preview}...`);
        console.log('');
      });

      // STEP 5: Test different thresholds
      console.log('🎯 STEP 5: Testing Different Similarity Thresholds');
      console.log('─'.repeat(80));
      const thresholds = [0.3, 0.4, 0.5, 0.6, 0.7];
      thresholds.forEach(threshold => {
        const matches = allSimilarities.filter(item => item.similarity >= threshold);
        console.log(`Threshold ${threshold}: ${matches.length} matches`);
      });

      // STEP 6: Top 5 results
      console.log('\n🏆 STEP 6: Top 5 Results');
      console.log('─'.repeat(80));
      const top5 = allSimilarities.slice(0, 5);
      top5.forEach((item, idx) => {
        console.log(`${idx + 1}. Similarity: ${item.similarity.toFixed(4)}`);
        console.log(`   Document: ${item.documentName}`);
        console.log(`   Chunk Index: ${item.chunkIndex}`);
        console.log(`   Text: ${item.text.substring(0, 200)}...`);
        console.log('');
      });

      return {
        projectId,
        query,
        totalChunks: allVectors.length,
        queryEmbeddingDimension: queryEmbedding.length,
        topResults: top5,
        thresholdAnalysis: thresholds.map(t => ({
          threshold: t,
          matches: allSimilarities.filter(item => item.similarity >= t).length
        }))
      };

    } catch (error) {
      console.error('❌ Debug vector search failed:', error);
      return {
        error: error.message,
        projectId,
        query
      };
    }
  }

  /**
   * Generate embeddings in parallel (optimized version)
   */
  async generateEmbeddingsInParallel(texts, apiKey, requestId = null) {
    // Use the main generateEmbeddings method which handles batching
    return await this.generateEmbeddings(texts, apiKey, requestId);
  }

  /**
   * Intelligent chunking: Split text on natural boundaries (paragraphs, sentences)
   * This improves RAG quality by preserving semantic completeness
   * 
   * @param {string} text - Text to chunk
   * @param {number} chunkSize - Target chunk size in characters (default: 800)
   * @param {number} overlap - Overlap between chunks in characters (default: 100)
   * @param {object} metadata - Metadata to attach to each chunk
   * @returns {Array<object>} Array of chunk objects with text and metadata
   */
  intelligentChunk(text, chunkSize = 800, overlap = 100, metadata = {}) {
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return [];
    }

    const chunks = [];
    const minChunkSize = 200;
    const maxChunkSize = 1000;
    
    // Adjust chunk size to be within bounds
    const targetSize = Math.max(minChunkSize, Math.min(maxChunkSize, chunkSize));
    const overlapSize = Math.min(overlap, targetSize * 0.2); // Max 20% overlap

    let currentIndex = 0;
    let chunkIndex = 0;

    while (currentIndex < text.length) {
      const remainingText = text.substring(currentIndex);
      
      // If remaining text is smaller than min chunk size, add it all
      if (remainingText.length <= minChunkSize) {
        if (remainingText.trim().length > 0) {
          chunks.push({
            text: remainingText.trim(),
            chunkIndex: chunkIndex++,
            charStart: currentIndex,
            charEnd: currentIndex + remainingText.length,
            charLength: remainingText.length,
            ...metadata
          });
        }
        break;
      }

      // Find the best split point (natural boundary)
      let splitPoint = Math.min(currentIndex + targetSize, text.length);
      
      // Try to find a natural boundary near the target size
      const searchStart = Math.max(currentIndex + minChunkSize, splitPoint - 200);
      const searchEnd = Math.min(splitPoint + 200, text.length);
      const searchText = text.substring(searchStart, searchEnd);

      // Priority 1: Paragraph break (\n\n)
      let boundary = searchText.indexOf('\n\n');
      if (boundary !== -1) {
        splitPoint = searchStart + boundary + 2;
      } else {
        // Priority 2: Sentence ending (. ! ? followed by space)
        const sentenceEnd = searchText.match(/[.!?]\s+/);
        if (sentenceEnd) {
          splitPoint = searchStart + sentenceEnd.index + sentenceEnd[0].length;
        } else {
          // Priority 3: Single newline
          const newline = searchText.indexOf('\n');
          if (newline !== -1) {
            splitPoint = searchStart + newline + 1;
          }
          // Otherwise use the target size (no natural boundary found)
        }
      }

      // Extract chunk text
      const chunkText = text.substring(currentIndex, splitPoint).trim();
      
      if (chunkText.length > 0) {
        // Detect section/heading if present
        let section = null;
        const lines = chunkText.split('\n');
        for (const line of lines.slice(0, 3)) { // Check first 3 lines
          // Check for markdown heading
          if (line.match(/^#+\s+/)) {
            section = line.replace(/^#+\s+/, '').trim();
            break;
          }
          // Check for numbered heading
          if (line.match(/^\d+\.?\s+[A-Z]/)) {
            section = line.replace(/^\d+\.?\s+/, '').trim();
            break;
          }
          // Check for ALL CAPS heading
          if (line.length < 100 && line === line.toUpperCase() && line.match(/[A-Z]/)) {
            section = line.trim();
            break;
          }
        }

        chunks.push({
          text: chunkText,
          chunkIndex: chunkIndex++,
          charStart: currentIndex,
          charEnd: splitPoint,
          charLength: chunkText.length,
          section: section,
          ...metadata
        });
      }

      // Move to next chunk with overlap
      currentIndex = Math.max(currentIndex + 1, splitPoint - overlapSize);
      
      // Prevent infinite loop
      if (currentIndex >= text.length) {
        break;
      }
    }

    this.logger.info('Intelligent chunking completed', {
      function: 'intelligentChunk',
      totalChunks: chunks.length,
      originalLength: text.length,
      avgChunkSize: chunks.length > 0 ? Math.round(chunks.reduce((sum, c) => sum + c.charLength, 0) / chunks.length) : 0
    });

    return chunks;
  }
}

// Export singleton instance
module.exports = new EmbeddingService();
