const OpenAI = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');

/**
 * Embedding Service
 * Generates embeddings using OpenAI (can be extended for other providers)
 */
class EmbeddingService {
  constructor() {
    this.openaiClients = new Map(); // Cache clients per API key
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
   * Generate embeddings for text chunks
   */
  async generateEmbeddings(texts, apiKey) {
    try {
      const client = this.getOpenAIClient(apiKey);
      
      const response = await client.embeddings.create({
        model: 'text-embedding-3-small', // Cost-effective embedding model
        input: texts
      });

      return response.data.map(item => item.embedding);
    } catch (error) {
      console.error('Error generating embeddings:', error);
      throw new Error(`Failed to generate embeddings: ${error.message}`);
    }
  }

  /**
   * Generate embedding for a single text
   */
  async generateEmbedding(text, apiKey) {
    const embeddings = await this.generateEmbeddings([text], apiKey);
    return embeddings[0];
  }
}

module.exports = new EmbeddingService();

