const OpenAI = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const vectorStore = require('./VectorStore');
const projectStorage = require('../storage/ProjectStorage');
const { createServiceLogger } = require('../utils/logger');

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
    
    // Initialize logger
    this.logger = createServiceLogger('EmbeddingService');
    this.logger.info('Embedding Service initialized', {
      function: 'constructor',
      preferredProvider: this.preferredProvider.toUpperCase()
    });
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
  async generateEmbeddingsWithGemini(texts, apiKey, requestId = null) {
    const startTime = Date.now();
    try {
      const genAI = this.getGeminiClient(apiKey);
      const modelName = 'text-embedding-004'; // Gemini's latest embedding model (768 dimensions)
      
      this.logger.info(`Generating ${texts.length} embeddings with Gemini`, {
        function: 'generateEmbeddingsWithGemini',
        provider: 'gemini',
        model: modelName,
        count: texts.length,
        requestId
      });
      
      const embeddings = [];
      
      // Process texts one by one (Gemini embedding API processes single texts)
      for (const text of texts) {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.embedContent(text);
        embeddings.push(result.embedding.values);
      }
      
      const duration = Date.now() - startTime;
      
      this.logger.performance('generateEmbeddingsWithGemini', duration, {
        function: 'generateEmbeddingsWithGemini',
        provider: 'gemini',
        model: modelName,
        count: embeddings.length,
        dimension: embeddings[0]?.length,
        requestId
      });
      
      return embeddings;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error('Error generating embeddings with Gemini', {
        function: 'generateEmbeddingsWithGemini',
        provider: 'gemini',
        error: error.message,
        duration: `${duration}ms`,
        requestId
      });
      throw new Error(`Failed to generate embeddings with Gemini: ${error.message}`);
    }
  }

  /**
   * Generate embeddings using OpenAI
   */
  async generateEmbeddingsWithOpenAI(texts, apiKey, requestId = null) {
    const startTime = Date.now();
    try {
      const client = this.getOpenAIClient(apiKey);
      const model = 'text-embedding-3-small'; // Cost-effective embedding model
      
      this.logger.info(`Generating ${texts.length} embeddings with OpenAI`, {
        function: 'generateEmbeddingsWithOpenAI',
        provider: 'openai',
        model: model,
        count: texts.length,
        requestId
      });
      
      const response = await client.embeddings.create({
        model: model,
        input: texts
      });

      const embeddings = response.data.map(item => item.embedding);
      const duration = Date.now() - startTime;
      
      this.logger.performance('generateEmbeddingsWithOpenAI', duration, {
        function: 'generateEmbeddingsWithOpenAI',
        provider: 'openai',
        model: model,
        count: embeddings.length,
        dimension: embeddings[0]?.length,
        requestId
      });
      
      return embeddings;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error('Error generating embeddings with OpenAI', {
        function: 'generateEmbeddingsWithOpenAI',
        provider: 'openai',
        error: error.message,
        duration: `${duration}ms`,
        requestId
      });
      throw new Error(`Failed to generate embeddings with OpenAI: ${error.message}`);
    }
  }

  /**
   * Generate embeddings for text chunks (auto-detects provider)
   */
  async generateEmbeddings(texts, apiKey, requestId = null) {
    // Auto-detect provider or use default
    const provider = apiKey ? this.detectProvider(apiKey) : this.preferredProvider;
    
    // Use Gemini if available (environment key)
    const effectiveApiKey = apiKey || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;
    const effectiveProvider = this.detectProvider(effectiveApiKey);
    
    this.logger.info(`Using ${effectiveProvider.toUpperCase()} for embeddings`, {
      function: 'generateEmbeddings',
      provider: effectiveProvider,
      count: texts.length,
      requestId
    });
    
    try {
      if (effectiveProvider === 'gemini') {
        return await this.generateEmbeddingsWithGemini(texts, effectiveApiKey, requestId);
      } else {
        return await this.generateEmbeddingsWithOpenAI(texts, effectiveApiKey, requestId);
      }
    } catch (error) {
      // If primary provider fails, try fallback
      this.logger.warn(`${effectiveProvider} failed, trying fallback`, {
        function: 'generateEmbeddings',
        provider: effectiveProvider,
        error: error.message,
        requestId
      });
      
      if (effectiveProvider === 'gemini' && process.env.OPENAI_API_KEY) {
        this.logger.info('Falling back to OpenAI', {
          function: 'generateEmbeddings',
          requestId
        });
        return await this.generateEmbeddingsWithOpenAI(texts, process.env.OPENAI_API_KEY, requestId);
      } else if (effectiveProvider === 'openai' && process.env.GEMINI_API_KEY) {
        this.logger.info('Falling back to Gemini', {
          function: 'generateEmbeddings',
          requestId
        });
        return await this.generateEmbeddingsWithGemini(texts, process.env.GEMINI_API_KEY, requestId);
      }
      
      // No fallback available
      throw error;
    }
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

  /**
   * Intelligent chunking: Split text on natural boundaries
   * @param {string} text - Text to chunk
   * @param {number} chunkSize - Target chunk size in characters (default: 800)
   * @param {number} overlap - Overlap between chunks in characters (default: 100)
   * @param {Object} metadata - Metadata to attach to chunks (documentName, etc.)
   * @returns {Array} Array of chunk objects with metadata
   */
  intelligentChunk(text, chunkSize = 800, overlap = 100, metadata = {}) {
    if (!text || typeof text !== 'string') {
      return [];
    }

    const MIN_CHUNK_SIZE = 200;
    const MAX_CHUNK_SIZE = 1000;
    
    // Ensure chunkSize is within bounds
    chunkSize = Math.max(MIN_CHUNK_SIZE, Math.min(MAX_CHUNK_SIZE, chunkSize));
    overlap = Math.min(overlap, Math.floor(chunkSize * 0.3)); // Max 30% overlap

    // Limit text length to prevent issues
    const MAX_TEXT_LENGTH = 10 * 1024 * 1024; // 10MB
    if (text.length > MAX_TEXT_LENGTH) {
      this.logger.warn('Text is very large, truncating', {
        function: 'intelligentChunk',
        originalLength: text.length,
        maxLength: MAX_TEXT_LENGTH
      });
      text = text.substring(0, MAX_TEXT_LENGTH);
    }

    const chunks = [];
    let currentPosition = 0;
    const textLength = text.length;
    let chunkIndex = 0;

    // Detect document structure: headings, sections
    const sections = this.detectSections(text);
    
    while (currentPosition < textLength) {
      // Determine chunk boundaries
      let chunkEnd = Math.min(currentPosition + chunkSize, textLength);
      
      // If we're not at the end, try to find a natural boundary
      if (chunkEnd < textLength) {
        // Try to find paragraph break first (double newline)
        const paragraphBreak = text.lastIndexOf('\n\n', chunkEnd);
        if (paragraphBreak > currentPosition + MIN_CHUNK_SIZE) {
          chunkEnd = paragraphBreak + 2; // Include the double newline
        } else {
          // Try to find sentence boundary (., !, ? followed by space)
          const sentencePattern = /[.!?]\s+/g;
          let match;
          let lastSentenceEnd = -1;
          
          // Find all sentence endings before chunkEnd
          while ((match = sentencePattern.exec(text.substring(currentPosition, chunkEnd))) !== null) {
            lastSentenceEnd = currentPosition + match.index + match[0].length;
          }
          
          // If we found a sentence end and it's not too close to start, use it
          if (lastSentenceEnd > currentPosition + MIN_CHUNK_SIZE) {
            chunkEnd = lastSentenceEnd;
          } else {
            // Fallback: find single newline
            const newlineBreak = text.lastIndexOf('\n', chunkEnd);
            if (newlineBreak > currentPosition + MIN_CHUNK_SIZE) {
              chunkEnd = newlineBreak + 1;
            }
          }
        }
      }

      // Extract chunk text
      const chunkText = text.substring(currentPosition, chunkEnd).trim();
      
      if (chunkText.length >= MIN_CHUNK_SIZE || chunkEnd >= textLength) {
        // Find which section this chunk belongs to
        const section = this.findSectionForPosition(currentPosition, sections);
        
        // Create chunk with metadata
        const chunk = {
          text: chunkText,
          chunkIndex: chunkIndex++,
          charStart: currentPosition,
          charEnd: chunkEnd,
          charLength: chunkText.length,
          section: section ? section.title : null,
          sectionIndex: section ? section.index : null,
          documentName: metadata.documentName || 'unknown',
          ...metadata
        };

        chunks.push(chunk);

        // Move to next position with overlap
        if (chunkEnd >= textLength) {
          break; // Reached end of text
        }
        
        // Calculate overlap start (go back by overlap amount, but not before current position)
        const overlapStart = Math.max(currentPosition, chunkEnd - overlap);
        
        // Find natural boundary for overlap start (don't start mid-sentence)
        const overlapBoundary = this.findNaturalBoundary(text, overlapStart, currentPosition);
        currentPosition = overlapBoundary;
      } else {
        // Chunk too small, advance by minimum amount
        currentPosition += MIN_CHUNK_SIZE;
      }

      // Safety check to prevent infinite loops
      if (chunkIndex > 100000) {
        this.logger.error('Chunking reached max iterations', {
          function: 'intelligentChunk',
          textLength,
          chunksCreated: chunks.length
        });
        break;
      }
    }

    // Log chunking statistics
    this.logChunkingStats(chunks, textLength);

    return chunks;
  }

  /**
   * Detect sections/headings in text (for structured documents like PRDs)
   * @param {string} text - Text to analyze
   * @returns {Array} Array of section objects {title, start, end, index}
   */
  detectSections(text) {
    const sections = [];
    
    // Patterns for common heading formats
    const headingPatterns = [
      /^(#{1,6})\s+(.+)$/gm,                    // Markdown headings (# Title)
      /^(\d+\.?\s+[A-Z][^\n]+)$/gm,             // Numbered headings (1. Title)
      /^([A-Z][A-Z\s]{2,50})$/gm,               // ALL CAPS headings
      /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*:)$/gm,  // Title Case: headings
    ];

    // Also detect common PRD section patterns
    const prdPatterns = [
      /^(?:Section|Chapter|Part)\s+\d+[.:]\s*(.+)$/gmi,
      /^(\d+\.\d+\.?\s+[A-Z][^\n]+)$/gm,        // Hierarchical numbering (1.1 Title)
    ];

    const allPatterns = [...headingPatterns, ...prdPatterns];
    const foundHeadings = new Set();

    for (const pattern of allPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const title = match[match.length - 1].trim(); // Last capture group is usually the title
        const position = match.index;
        
        // Avoid duplicates
        if (!foundHeadings.has(position)) {
          foundHeadings.add(position);
          
          // Find end of section (next heading or end of text)
          let sectionEnd = text.length;
          for (const nextPattern of allPatterns) {
            const nextMatch = nextPattern.exec(text.substring(position + 1));
            if (nextMatch) {
              sectionEnd = Math.min(sectionEnd, position + 1 + nextMatch.index);
              nextPattern.lastIndex = 0; // Reset for next iteration
            }
          }

          sections.push({
            title: title,
            start: position,
            end: sectionEnd,
            index: sections.length
          });
        }
      }
    }

    // Sort by position
    sections.sort((a, b) => a.start - b.start);

    return sections;
  }

  /**
   * Find which section a position belongs to
   * @param {number} position - Character position
   * @param {Array} sections - Array of section objects
   * @returns {Object|null} Section object or null
   */
  findSectionForPosition(position, sections) {
    for (let i = sections.length - 1; i >= 0; i--) {
      if (position >= sections[i].start) {
        return sections[i];
      }
    }
    return null;
  }

  /**
   * Find natural boundary (sentence or paragraph end) near a position
   * @param {string} text - Full text
   * @param {number} targetPosition - Target position
   * @param {number} minPosition - Minimum allowed position
   * @returns {number} Best boundary position
   */
  findNaturalBoundary(text, targetPosition, minPosition) {
    // Look backwards from targetPosition for a natural break
    const searchWindow = 200; // Search within 200 chars
    const searchStart = Math.max(minPosition, targetPosition - searchWindow);
    const searchText = text.substring(searchStart, targetPosition);

    // Try paragraph break first
    const paraBreak = searchText.lastIndexOf('\n\n');
    if (paraBreak >= 0) {
      return searchStart + paraBreak + 2;
    }

    // Try sentence break
    const sentencePattern = /[.!?]\s+/g;
    let match;
    let lastMatch = -1;
    while ((match = sentencePattern.exec(searchText)) !== null) {
      lastMatch = searchStart + match.index + match[0].length;
    }
    if (lastMatch >= minPosition) {
      return lastMatch;
    }

    // Try single newline
    const newlineBreak = searchText.lastIndexOf('\n');
    if (newlineBreak >= 0) {
      return searchStart + newlineBreak + 1;
    }

    // Fallback to target position
    return Math.max(minPosition, targetPosition);
  }

  /**
   * Log chunking statistics for quality assessment
   * @param {Array} chunks - Array of chunk objects
   * @param {number} originalLength - Original text length
   */
  logChunkingStats(chunks, originalLength) {
    if (chunks.length === 0) {
      return;
    }

    const sizes = chunks.map(c => c.charLength);
    const avgSize = sizes.reduce((a, b) => a + b, 0) / sizes.length;
    const minSize = Math.min(...sizes);
    const maxSize = Math.max(...sizes);
    
    // Size distribution
    const small = sizes.filter(s => s < 400).length;
    const medium = sizes.filter(s => s >= 400 && s < 800).length;
    const large = sizes.filter(s => s >= 800).length;

    // Sections detected
    const withSections = chunks.filter(c => c.section).length;

    this.logger.info('Intelligent chunking completed', {
      function: 'intelligentChunk',
      totalChunks: chunks.length,
      originalLength,
      avgChunkSize: Math.round(avgSize),
      minChunkSize: minSize,
      maxChunkSize: maxSize,
      sizeDistribution: {
        small: `${small} (${((small/chunks.length)*100).toFixed(1)}%)`,
        medium: `${medium} (${((medium/chunks.length)*100).toFixed(1)}%)`,
        large: `${large} (${((large/chunks.length)*100).toFixed(1)}%)`
      },
      chunksWithSections: `${withSections} (${((withSections/chunks.length)*100).toFixed(1)}%)`
    });

    // Log sample chunks for review (first 3)
    const samples = chunks.slice(0, 3).map(c => ({
      index: c.chunkIndex,
      size: c.charLength,
      section: c.section || 'none',
      preview: c.text.substring(0, 100) + '...'
    }));

    this.logger.debug('Sample chunks', {
      function: 'intelligentChunk',
      samples
    });
  }

  /**
   * Test chunking quality
   * @param {string} text - Sample text to test
   * @param {Object} options - Chunking options
   * @returns {Object} Quality metrics and sample chunks
   */
  testChunkingQuality(text, options = {}) {
    const chunkSize = options.chunkSize || 800;
    const overlap = options.overlap || 100;
    const metadata = options.metadata || { documentName: 'test' };

    const chunks = this.intelligentChunk(text, chunkSize, overlap, metadata);

    // Quality metrics
    const sizes = chunks.map(c => c.charLength);
    const avgSize = sizes.reduce((a, b) => a + b, 0) / sizes.length;
    const variance = sizes.reduce((sum, size) => sum + Math.pow(size - avgSize, 2), 0) / sizes.length;
    const stdDev = Math.sqrt(variance);

    // Check for information loss (total characters should be preserved with overlap)
    const totalChunkChars = chunks.reduce((sum, c) => sum + c.charLength, 0);
    const originalLength = text.length;
    const coverage = (totalChunkChars / originalLength) * 100;

    // Check chunk boundaries (should end on natural breaks)
    const naturalBreaks = chunks.filter(c => {
      const chunkEnd = c.text[c.text.length - 1];
      return /[.!?\n]/.test(chunkEnd);
    }).length;
    const naturalBreakRate = (naturalBreaks / chunks.length) * 100;

    return {
      totalChunks: chunks.length,
      originalLength,
      totalChunkChars,
      coverage: `${coverage.toFixed(1)}%`,
      qualityMetrics: {
        avgChunkSize: Math.round(avgSize),
        minChunkSize: Math.min(...sizes),
        maxChunkSize: Math.max(...sizes),
        stdDev: Math.round(stdDev),
        naturalBreakRate: `${naturalBreakRate.toFixed(1)}%`,
        chunksWithSections: chunks.filter(c => c.section).length
      },
      sizeDistribution: {
        small: sizes.filter(s => s < 400).length,
        medium: sizes.filter(s => s >= 400 && s < 800).length,
        large: sizes.filter(s => s >= 800).length
      },
      sampleChunks: chunks.slice(0, 5).map(c => ({
        index: c.chunkIndex,
        size: c.charLength,
        section: c.section,
        charRange: `${c.charStart}-${c.charEnd}`,
        preview: c.text.substring(0, 150) + '...'
      }))
    };
  }
}

module.exports = new EmbeddingService();

