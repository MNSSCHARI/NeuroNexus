const fs = require('fs-extra');
const path = require('path');
const { createServiceLogger } = require('../utils/logger');

/**
 * Simple file-based vector store
 * Each project has its own vector store file
 */
class VectorStore {
  constructor() {
    // Use absolute path to ensure data directory is created correctly
    this.storagePath = path.join(process.cwd(), 'server', 'data', 'vectors');
    this.ensureStorageDirectory();
    // Initialize logger
    this.logger = createServiceLogger('VectorStore');
  }

  ensureStorageDirectory() {
    if (!fs.existsSync(this.storagePath)) {
      fs.mkdirSync(this.storagePath, { recursive: true });
    }
  }

  /**
   * Get project vector store file path
   */
  getProjectStorePath(projectId) {
    return path.join(this.storagePath, `${projectId}.json`);
  }

  /**
   * Cosine similarity between two vectors
   */
  cosineSimilarity(vecA, vecB) {
    if (vecA.length !== vecB.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Add embeddings to project vector store
   */
  async addEmbeddings(projectId, embeddings) {
    const storePath = this.getProjectStorePath(projectId);
    let projectVectors = [];

    // Load existing vectors if file exists
    if (fs.existsSync(storePath)) {
      const data = await fs.readJson(storePath);
      projectVectors = data.vectors || [];
    }

    // Add new embeddings
    projectVectors.push(...embeddings);

    // Save to file
    await fs.writeJson(storePath, {
      projectId,
      vectors: projectVectors,
      updatedAt: new Date().toISOString()
    }, { spaces: 2 });

    return projectVectors.length;
  }

  /**
   * Search for similar vectors in project store
   * @param {string} projectId - Project ID
   * @param {Array} queryVector - Query embedding vector
   * @param {number} topK - Number of top results to return (default: 5)
   * @param {number} minSimilarity - Minimum similarity threshold (default: 0.4)
   * @returns {Array} Array of similar vectors with similarity scores
   */
  async searchSimilar(projectId, queryVector, topK = 5, minSimilarity = 0.4, requestId = null) {
    const startTime = Date.now();
    const storePath = this.getProjectStorePath(projectId);

    if (!fs.existsSync(storePath)) {
      this.logger.debug('Vector store file not found', {
        function: 'searchSimilar',
        projectId,
        requestId
      });
      return [];
    }

    const data = await fs.readJson(storePath);
    const vectors = data.vectors || [];

    if (vectors.length === 0) {
      this.logger.debug('No vectors in store', {
        function: 'searchSimilar',
        projectId,
        requestId
      });
      return [];
    }

    // Calculate similarity scores
    const results = vectors.map((item, index) => {
      const similarity = this.cosineSimilarity(queryVector, item.embedding);
      return {
        ...item,
        similarity,
        index
      };
    });

    // Sort by similarity (descending)
    results.sort((a, b) => b.similarity - a.similarity);

    // Filter by minimum similarity threshold
    const filteredResults = results.filter(item => item.similarity >= minSimilarity);
    const finalResults = filteredResults.slice(0, topK);
    const duration = Date.now() - startTime;
    const topScore = finalResults.length > 0 ? finalResults[0].similarity : null;

    // Log vector search
    this.logger.vectorSearch(
      `Query for project ${projectId}`,
      finalResults.length,
      topScore,
      duration,
      {
        function: 'searchSimilar',
        projectId,
        topK,
        minSimilarity,
        totalVectors: vectors.length,
        filteredCount: filteredResults.length,
        requestId
      }
    );

    return finalResults;
  }

  /**
   * Search for similar vectors without threshold (for testing/debugging)
   * Returns all results sorted by similarity
   */
  async searchSimilarAll(projectId, queryVector, topK = 10, requestId = null) {
    const startTime = Date.now();
    const storePath = this.getProjectStorePath(projectId);

    if (!fs.existsSync(storePath)) {
      return [];
    }

    const data = await fs.readJson(storePath);
    const vectors = data.vectors || [];

    // Calculate similarity scores
    const results = vectors.map((item, index) => {
      const similarity = this.cosineSimilarity(queryVector, item.embedding);
      return {
        ...item,
        similarity,
        index
      };
    });

    // Sort by similarity (descending) and return top K
    results.sort((a, b) => b.similarity - a.similarity);
    const finalResults = results.slice(0, topK);
    const duration = Date.now() - startTime;
    const topScore = finalResults.length > 0 ? finalResults[0].similarity : null;

    // Log vector search
    this.logger.vectorSearch(
      `Query for project ${projectId} (all results)`,
      finalResults.length,
      topScore,
      duration,
      {
        function: 'searchSimilarAll',
        projectId,
        topK,
        totalVectors: vectors.length,
        requestId
      }
    );

    return finalResults;
  }

  /**
   * Get all vectors for a project
   */
  async getProjectVectors(projectId) {
    const storePath = this.getProjectStorePath(projectId);

    if (!fs.existsSync(storePath)) {
      return [];
    }

    const data = await fs.readJson(storePath);
    return data.vectors || [];
  }

  /**
   * Delete project vector store
   */
  async deleteProject(projectId) {
    const storePath = this.getProjectStorePath(projectId);
    if (fs.existsSync(storePath)) {
      await fs.remove(storePath);
    }
  }
}

module.exports = new VectorStore();

