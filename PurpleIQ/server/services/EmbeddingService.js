const OpenAI = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const vectorStore = require('./VectorStore');
const projectStorage = require('../storage/ProjectStorage');

/**
 * Embedding Service
 * Generates embeddings using OpenAI or Gemini (multi-provider support)
 */
class EmbeddingService {
  constructor() {
    this.openaiClients = new Map(); // Cache OpenAI clients per API key
    this.geminiClients = new Map(); // Cache Gemini clients per API key
    this.MIN_SIMILARITY_THRESHOLD = 0.4; // Minimum similarity score for quality matches
    
    // Use Gemini by default if available, fallback to OpenAI
    this.preferredProvider = process.env.GEMINI_API_KEY ? 'gemini' : 'openai';
    console.log(`📊 Embedding Service initialized with preferred provider: ${this.preferredProvider.toUpperCase()}`);
  }

  /**
   * Get or create OpenAI client for API key
   */
  getOpenAIClient(apiKey) {
    if (!this.openaiClients.has(apiKey)) {
      this.openaiClients.set(apiKey, new OpenAI({ apiKey }));
    }
    return this.openaiClients.get(apiKey);
  }

  /**
   * Get or create Gemini client for API key
   */
  getGeminiClient(apiKey) {
    if (!this.geminiClients.has(apiKey)) {
      this.geminiClients.set(apiKey, new GoogleGenerativeAI(apiKey));
    }
    return this.geminiClients.get(apiKey);
  }

  /**
   * Detect which embedding provider to use
   */
  detectProvider(apiKey) {
    // If it's a Gemini key format, use Gemini
    if (apiKey && apiKey.startsWith('AIza')) {
      return 'gemini';
    }
    // If it's an OpenAI key format, use OpenAI
    if (apiKey && apiKey.startsWith('sk-')) {
      return 'openai';
    }
    // Fallback to environment-based default
    return this.preferredProvider;
  }

  /**
   * Generate embeddings using Gemini
   */
  async generateEmbeddingsWithGemini(texts, apiKey) {
    try {
      const genAI = this.getGeminiClient(apiKey);
      const modelName = 'text-embedding-004'; // Gemini's latest embedding model (768 dimensions)
      
      console.log(`🤖 Generating ${texts.length} embeddings with Gemini (${modelName})`);
      
      const embeddings = [];
      
      // Process texts one by one (Gemini embedding API processes single texts)
      for (const text of texts) {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.embedContent(text);
        embeddings.push(result.embedding.values);
      }
      
      console.log(`✅ Generated ${embeddings.length} embeddings (dimension: ${embeddings[0].length})`);
      return embeddings;
      
    } catch (error) {
      console.error('❌ Error generating embeddings with Gemini:', error.message);
      throw new Error(`Failed to generate embeddings with Gemini: ${error.message}`);
    }
  }

  /**
   * Generate embeddings using OpenAI
   */
  async generateEmbeddingsWithOpenAI(texts, apiKey) {
    try {
      const client = this.getOpenAIClient(apiKey);
      const model = 'text-embedding-3-small'; // Cost-effective embedding model
      
      console.log(`🤖 Generating ${texts.length} embeddings with OpenAI (${model})`);
      
      const response = await client.embeddings.create({
        model: model,
        input: texts
      });

      const embeddings = response.data.map(item => item.embedding);
      console.log(`✅ Generated ${embeddings.length} embeddings (dimension: ${embeddings[0].length})`);
      
      return embeddings;
      
    } catch (error) {
      console.error('❌ Error generating embeddings with OpenAI:', error.message);
      throw new Error(`Failed to generate embeddings with OpenAI: ${error.message}`);
    }
  }

  /**
   * Generate embeddings for text chunks (auto-detects provider)
   */
  async generateEmbeddings(texts, apiKey) {
    // Auto-detect provider or use default
    const provider = apiKey ? this.detectProvider(apiKey) : this.preferredProvider;
    
    // Use Gemini if available (environment key)
    const effectiveApiKey = apiKey || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;
    const effectiveProvider = this.detectProvider(effectiveApiKey);
    
    console.log(`🔄 Using ${effectiveProvider.toUpperCase()} for embeddings`);
    
    try {
      if (effectiveProvider === 'gemini') {
        return await this.generateEmbeddingsWithGemini(texts, effectiveApiKey);
      } else {
        return await this.generateEmbeddingsWithOpenAI(texts, effectiveApiKey);
      }
    } catch (error) {
      // If primary provider fails, try fallback
      console.log(`⚠️  ${effectiveProvider} failed, trying fallback...`);
      
      if (effectiveProvider === 'gemini' && process.env.OPENAI_API_KEY) {
        console.log('🔄 Falling back to OpenAI');
        return await this.generateEmbeddingsWithOpenAI(texts, process.env.OPENAI_API_KEY);
      } else if (effectiveProvider === 'openai' && process.env.GEMINI_API_KEY) {
        console.log('🔄 Falling back to Gemini');
        return await this.generateEmbeddingsWithGemini(texts, process.env.GEMINI_API_KEY);
      }
      
      // No fallback available
      throw error;
    }
  }

  /**
   * Generate embedding for a single text
   */
  async generateEmbedding(text, apiKey) {
    const embeddings = await this.generateEmbeddings([text], apiKey);
    return embeddings[0];
  }

  /**
   * Test vector search quality for a project
   * @param {string} projectId - Project ID to test
   * @param {Array} testQueries - Array of test query strings (optional, uses defaults if not provided)
   * @returns {Object} Quality metrics and test results
   */
  async testVectorSearchQuality(projectId, testQueries = null) {
    console.log('\n' + '='.repeat(60));
    console.log(`🔍 Testing Vector Search Quality for Project: ${projectId}`);
    console.log('='.repeat(60));

    try {
      // Get project
      const project = await projectStorage.getProject(projectId);
      if (!project) {
        throw new Error(`Project ${projectId} not found`);
      }

      // Get total chunks in project
      const allVectors = await vectorStore.getProjectVectors(projectId);
      const totalChunks = allVectors.length;

      if (totalChunks === 0) {
        console.log('⚠️  No documents found in project. Please upload documents first.');
        return {
          projectId,
          totalChunks: 0,
          testResults: [],
          summary: {
            testsRun: 0,
            goodMatches: 0,
            poorMatches: 0,
            noMatches: 0
          }
        };
      }

      console.log(`📊 Total chunks in project: ${totalChunks}`);

      // Default test queries if none provided
      const queries = testQueries || [
        'What are the main features?',
        'How does authentication work?',
        'What are the test scenarios?',
        'What are the error handling requirements?',
        'What is the user flow?'
      ];

      const testResults = [];
      let goodMatchesCount = 0;
      let poorMatchesCount = 0;
      let noMatchesCount = 0;

      // Test each query
      for (let i = 0; i < queries.length; i++) {
        const query = queries[i];
        console.log(`\n${'─'.repeat(60)}`);
        console.log(`📝 Test Query ${i + 1}/${queries.length}: "${query}"`);
        console.log('─'.repeat(60));

        try {
          // Generate embedding for query
          const queryEmbedding = await this.generateEmbedding(query, project.apiKey);

          // Search without threshold first to see all results
          const allResults = await vectorStore.searchSimilarAll(projectId, queryEmbedding, 10);
          
          // Search with threshold
          const filteredResults = await vectorStore.searchSimilar(
            projectId,
            queryEmbedding,
            5,
            this.MIN_SIMILARITY_THRESHOLD
          );

          // Log top 5 results (even if below threshold)
          console.log(`\n📈 Top 5 Results (similarity scores):`);
          const top5 = allResults.slice(0, 5);
          top5.forEach((result, idx) => {
            const isGood = result.similarity >= this.MIN_SIMILARITY_THRESHOLD;
            const status = isGood ? '✅' : '⚠️';
            const threshold = result.similarity >= this.MIN_SIMILARITY_THRESHOLD ? '' : ' (BELOW THRESHOLD)';
            console.log(
              `  ${status} ${idx + 1}. Score: ${result.similarity.toFixed(4)}${threshold} | ` +
              `Doc: ${result.documentName} | Chunk: ${result.chunkIndex}`
            );
            console.log(`     Preview: ${result.text.substring(0, 100)}...`);
          });

          // Quality assessment
          const goodMatches = filteredResults.length;
          const poorMatches = top5.filter(r => r.similarity < this.MIN_SIMILARITY_THRESHOLD).length;
          const hasGoodMatches = goodMatches > 0;

          if (hasGoodMatches) {
            goodMatchesCount++;
            console.log(`\n✅ Good matches found: ${goodMatches} (above threshold ${this.MIN_SIMILARITY_THRESHOLD})`);
          } else {
            noMatchesCount++;
            console.log(`\n❌ No good matches found (all results below threshold ${this.MIN_SIMILARITY_THRESHOLD})`);
            if (top5.length > 0) {
              poorMatchesCount++;
              console.log(`⚠️  Best match score: ${top5[0].similarity.toFixed(4)} (too low)`);
            }
          }

          // Store test result
          testResults.push({
            query,
            totalResults: allResults.length,
            goodMatches,
            poorMatches,
            topScore: top5.length > 0 ? top5[0].similarity : 0,
            hasGoodMatches,
            topResults: top5.map(r => ({
              documentName: r.documentName,
              chunkIndex: r.chunkIndex,
              similarity: r.similarity,
              textPreview: r.text.substring(0, 150)
            }))
          });

        } catch (error) {
          console.error(`❌ Error testing query "${query}":`, error.message);
          testResults.push({
            query,
            error: error.message,
            hasGoodMatches: false
          });
          noMatchesCount++;
        }
      }

      // Summary
      console.log(`\n${'='.repeat(60)}`);
      console.log('📊 TEST SUMMARY');
      console.log('='.repeat(60));
      console.log(`Total chunks in project: ${totalChunks}`);
      console.log(`Tests run: ${queries.length}`);
      console.log(`✅ Queries with good matches: ${goodMatchesCount}`);
      console.log(`⚠️  Queries with poor matches: ${poorMatchesCount}`);
      console.log(`❌ Queries with no matches: ${noMatchesCount}`);
      console.log(`Similarity threshold: ${this.MIN_SIMILARITY_THRESHOLD}`);
      
      const qualityScore = (goodMatchesCount / queries.length) * 100;
      console.log(`\n🎯 Overall Quality Score: ${qualityScore.toFixed(1)}%`);
      
      if (qualityScore >= 80) {
        console.log('✅ Excellent search quality!');
      } else if (qualityScore >= 60) {
        console.log('⚠️  Good search quality, but could be improved.');
      } else if (qualityScore >= 40) {
        console.log('⚠️  Moderate search quality. Consider improving document content or chunking strategy.');
      } else {
        console.log('❌ Poor search quality. Review document content, chunking, or embedding model.');
      }

      console.log('='.repeat(60) + '\n');

      return {
        projectId,
        totalChunks,
        minSimilarityThreshold: this.MIN_SIMILARITY_THRESHOLD,
        testResults,
        summary: {
          testsRun: queries.length,
          goodMatches: goodMatchesCount,
          poorMatches: poorMatchesCount,
          noMatches: noMatchesCount,
          qualityScore: qualityScore.toFixed(1) + '%'
        }
      };

    } catch (error) {
      console.error('❌ Error in vector search quality test:', error);
      throw error;
    }
  }

  /**
   * Get minimum similarity threshold
   */
  getMinSimilarityThreshold() {
    return this.MIN_SIMILARITY_THRESHOLD;
  }
}

module.exports = new EmbeddingService();

