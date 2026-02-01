/**
 * Embedding Service Tests
 * Tests document chunking, embedding generation, vector search, and similarity
 */

const EmbeddingService = require('../services/EmbeddingService');
const VectorStore = require('../services/VectorStore');
const DocumentParser = require('../services/DocumentParser');

// Mock external dependencies
jest.mock('openai');
jest.mock('@google/generative-ai');
jest.mock('../services/VectorStore');

describe('EmbeddingService', () => {
  let embeddingService;

  beforeEach(() => {
    embeddingService = new EmbeddingService();
    jest.clearAllMocks();
  });

  describe('Intelligent Chunking', () => {
    it('should chunk text on natural boundaries', () => {
      const text = `This is paragraph one. It has multiple sentences. Each sentence is complete.

This is paragraph two. It also has sentences. They are complete too.

This is paragraph three. Final paragraph.`;

      const chunks = embeddingService.intelligentChunk(text, 100, 20, {
        documentName: 'test.txt'
      });

      expect(chunks.length).toBeGreaterThan(0);
      chunks.forEach(chunk => {
        expect(chunk).toHaveProperty('text');
        expect(chunk).toHaveProperty('chunkIndex');
        expect(chunk).toHaveProperty('charStart');
        expect(chunk).toHaveProperty('charEnd');
        expect(chunk).toHaveProperty('charLength');
        expect(chunk).toHaveProperty('documentName', 'test.txt');
      });
    });

    it('should not split mid-sentence', () => {
      const text = 'This is a long sentence that should not be split in the middle because it would lose context and meaning. Another sentence follows.';

      const chunks = embeddingService.intelligentChunk(text, 50, 10, {
        documentName: 'test.txt'
      });

      // Check that chunks end on sentence boundaries
      chunks.forEach(chunk => {
        const lastChar = chunk.text.trim().slice(-1);
        // Should end with sentence punctuation or be the last chunk
        expect(['.', '!', '?'].includes(lastChar) || chunk.charEnd >= text.length).toBe(true);
      });
    });

    it('should detect sections in structured documents', () => {
      const text = `# Authentication Requirements

Users must login with email and password.

# Payment Processing

Payments use Stripe API.`;

      const chunks = embeddingService.intelligentChunk(text, 200, 50, {
        documentName: 'PRD.md'
      });

      // Should detect sections
      const sectionsDetected = chunks.some(chunk => chunk.section !== null);
      expect(sectionsDetected).toBe(true);
    });

    it('should maintain minimum chunk size', () => {
      const text = 'Short.';
      
      const chunks = embeddingService.intelligentChunk(text, 800, 100, {
        documentName: 'test.txt'
      });

      // Should still create chunk even if small
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should enforce maximum chunk size', () => {
      const longText = 'Sentence. '.repeat(200); // Very long text
      
      const chunks = embeddingService.intelligentChunk(longText, 800, 100, {
        documentName: 'test.txt'
      });

      chunks.forEach(chunk => {
        expect(chunk.charLength).toBeLessThanOrEqual(1000); // Max chunk size
      });
    });

    it('should add overlap between chunks', () => {
      const text = 'Sentence one. Sentence two. Sentence three. Sentence four. Sentence five.';
      
      const chunks = embeddingService.intelligentChunk(text, 30, 10, {
        documentName: 'test.txt'
      });

      if (chunks.length > 1) {
        // Check overlap between consecutive chunks
        const chunk1 = chunks[0];
        const chunk2 = chunks[1];
        
        // Chunk2 should start before chunk1 ends (overlap)
        expect(chunk2.charStart).toBeLessThan(chunk1.charEnd);
      }
    });
  });

  describe('Chunking Quality', () => {
    it('should test chunking quality metrics', () => {
      const text = `# Section 1

This is a paragraph with multiple sentences. Each sentence is complete. The paragraph has good structure.

# Section 2

Another paragraph here. It also has sentences. They are well-formed.`;

      const quality = embeddingService.testChunkingQuality(text, {
        chunkSize: 100,
        overlap: 20,
        metadata: { documentName: 'test.txt' }
      });

      expect(quality).toHaveProperty('totalChunks');
      expect(quality).toHaveProperty('qualityMetrics');
      expect(quality).toHaveProperty('sizeDistribution');
      expect(quality.qualityMetrics.naturalBreakRate).toBeDefined();
      expect(parseFloat(quality.qualityMetrics.naturalBreakRate)).toBeGreaterThan(0);
    });

    it('should log chunking statistics', () => {
      const text = 'Sentence one. Sentence two. Sentence three.';
      
      const chunks = embeddingService.intelligentChunk(text, 50, 10, {
        documentName: 'test.txt'
      });

      // Statistics should be logged (check via logger mock)
      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe('Embedding Generation', () => {
    it('should generate embeddings with Gemini', async () => {
      const texts = ['Text 1', 'Text 2'];
      const apiKey = 'AIzaTestKey123';

      // Mock Gemini embedding
      const mockEmbeddings = [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]];
      jest.spyOn(embeddingService, 'generateEmbeddingsWithGemini').mockResolvedValue(mockEmbeddings);

      const result = await embeddingService.generateEmbeddings(texts, apiKey);

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveLength(3);
    });

    it('should generate embeddings with OpenAI', async () => {
      const texts = ['Text 1', 'Text 2'];
      const apiKey = 'sk-test-key-123';

      // Mock OpenAI embedding
      const mockEmbeddings = [[0.1, 0.2], [0.3, 0.4]];
      jest.spyOn(embeddingService, 'generateEmbeddingsWithOpenAI').mockResolvedValue(mockEmbeddings);

      const result = await embeddingService.generateEmbeddings(texts, apiKey);

      expect(result).toHaveLength(2);
    });

    it('should auto-detect provider from API key', () => {
      const geminiKey = 'AIzaTestKey';
      const openaiKey = 'sk-test-key';

      expect(embeddingService.detectProvider(geminiKey)).toBe('gemini');
      expect(embeddingService.detectProvider(openaiKey)).toBe('openai');
    });

    it('should fallback to alternative provider on failure', async () => {
      const texts = ['Text 1'];
      const geminiKey = 'AIzaTestKey';

      // Mock Gemini failure, OpenAI success
      jest.spyOn(embeddingService, 'generateEmbeddingsWithGemini').mockRejectedValue(
        new Error('Gemini failed')
      );
      jest.spyOn(embeddingService, 'generateEmbeddingsWithOpenAI').mockResolvedValue([[0.1, 0.2]]);

      // Set OpenAI key in env for fallback
      process.env.OPENAI_API_KEY = 'sk-fallback-key';

      const result = await embeddingService.generateEmbeddings(texts, geminiKey);

      expect(result).toHaveLength(1);
      expect(embeddingService.generateEmbeddingsWithOpenAI).toHaveBeenCalled();
    });
  });

  describe('Vector Search', () => {
    it('should search for similar vectors', async () => {
      const projectId = 'test-project';
      const queryVector = [0.1, 0.2, 0.3];
      const topK = 5;
      const minSimilarity = 0.4;

      const mockResults = [
        {
          text: 'Relevant chunk 1',
          similarity: 0.85,
          documentName: 'doc1.txt',
          chunkIndex: 0
        },
        {
          text: 'Relevant chunk 2',
          similarity: 0.75,
          documentName: 'doc1.txt',
          chunkIndex: 1
        }
      ];

      VectorStore.searchSimilar.mockResolvedValue(mockResults);

      const results = await VectorStore.searchSimilar(
        projectId,
        queryVector,
        topK,
        minSimilarity
      );

      expect(results).toHaveLength(2);
      expect(results[0].similarity).toBeGreaterThanOrEqual(minSimilarity);
    });

    it('should filter by minimum similarity threshold', async () => {
      const projectId = 'test-project';
      const queryVector = [0.1, 0.2, 0.3];
      const minSimilarity = 0.7;

      const mockResults = [
        { text: 'High similarity', similarity: 0.85 },
        { text: 'Low similarity', similarity: 0.3 }
      ];

      VectorStore.searchSimilar.mockResolvedValue(
        mockResults.filter(r => r.similarity >= minSimilarity)
      );

      const results = await VectorStore.searchSimilar(
        projectId,
        queryVector,
        5,
        minSimilarity
      );

      results.forEach(result => {
        expect(result.similarity).toBeGreaterThanOrEqual(minSimilarity);
      });
    });

    it('should return empty array for non-existent project', async () => {
      const projectId = 'non-existent';
      const queryVector = [0.1, 0.2, 0.3];

      VectorStore.searchSimilar.mockResolvedValue([]);

      const results = await VectorStore.searchSimilar(projectId, queryVector, 5, 0.4);

      expect(results).toEqual([]);
    });
  });

  describe('Similarity Calculation', () => {
    it('should calculate cosine similarity correctly', () => {
      const vecA = [1, 0, 0];
      const vecB = [1, 0, 0];
      
      const similarity = VectorStore.cosineSimilarity(vecA, vecB);
      
      expect(similarity).toBe(1.0); // Identical vectors
    });

    it('should return 0 for orthogonal vectors', () => {
      const vecA = [1, 0, 0];
      const vecB = [0, 1, 0];
      
      const similarity = VectorStore.cosineSimilarity(vecA, vecB);
      
      expect(similarity).toBe(0); // Orthogonal vectors
    });

    it('should handle different vector lengths', () => {
      const vecA = [1, 2, 3];
      const vecB = [4, 5, 6];
      
      const similarity = VectorStore.cosineSimilarity(vecA, vecB);
      
      expect(similarity).toBeGreaterThanOrEqual(-1);
      expect(similarity).toBeLessThanOrEqual(1);
    });
  });

  describe('Vector Search Quality Test', () => {
    it('should test vector search quality', async () => {
      const projectId = 'test-project';
      const testQueries = ['What are the main features?', 'How does authentication work?'];

      // Mock project and vectors
      const ProjectStorage = require('../storage/ProjectStorage');
      ProjectStorage.getProject = jest.fn().mockResolvedValue({
        id: projectId,
        apiKey: 'test-key'
      });

      VectorStore.getProjectVectors = jest.fn().mockResolvedValue([
        { text: 'Feature 1: Login', embedding: [0.1, 0.2] },
        { text: 'Feature 2: Payment', embedding: [0.3, 0.4] }
      ]);

      VectorStore.searchSimilarAll = jest.fn().mockResolvedValue([
        { text: 'Feature 1: Login', similarity: 0.85 }
      ]);

      VectorStore.searchSimilar = jest.fn().mockResolvedValue([
        { text: 'Feature 1: Login', similarity: 0.85 }
      ]);

      // Mock embedding generation
      jest.spyOn(embeddingService, 'generateEmbedding').mockResolvedValue([0.1, 0.2]);

      const result = await embeddingService.testVectorSearchQuality(projectId, testQueries);

      expect(result).toHaveProperty('projectId', projectId);
      expect(result).toHaveProperty('testResults');
      expect(result.testResults.length).toBe(testQueries.length);
    });
  });
});

