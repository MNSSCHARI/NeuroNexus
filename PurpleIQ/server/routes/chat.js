const express = require('express');
const router = express.Router();
const projectStorage = require('../storage/ProjectStorage');
const embeddingService = require('../services/EmbeddingService');
const vectorStore = require('../services/VectorStore');
const aiService = require('../services/AIService');

/**
 * POST /api/chat/:projectId
 * Chat with project-specific AI agent
 */
router.post('/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { question } = req.body;

    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      return res.status(400).json({ 
        error: 'Question is required and must be a non-empty string' 
      });
    }

    // Get project
    const project = await projectStorage.getProject(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check if project has any documents
    const vectors = await vectorStore.getProjectVectors(projectId);
    if (vectors.length === 0) {
      return res.status(400).json({ 
        error: 'No documents found for this project. Please upload documents first.' 
      });
    }

    // Generate embedding for question
    console.log(`Generating embedding for question in project ${projectId}`);
    const questionEmbedding = await embeddingService.generateEmbedding(
      question.trim(),
      project.apiKey
    );

    // Search for relevant chunks
    console.log(`Searching for relevant chunks in project ${projectId}`);
    const similarChunks = await vectorStore.searchSimilar(
      projectId,
      questionEmbedding,
      5 // Top 5 most relevant chunks
    );

    if (similarChunks.length === 0) {
      return res.json({
        answer: 'I could not find relevant information in the project documents to answer this question.',
        sources: []
      });
    }

    // Build context from relevant chunks
    const context = similarChunks
      .map((chunk, index) => `[Document ${index + 1}: ${chunk.documentName}]\n${chunk.text}`)
      .join('\n\n---\n\n');

    // Generate answer using project's AI model
    console.log(`Generating answer using ${project.aiModel} for project ${projectId}`);
    const answer = await aiService.generateAnswer(
      project.aiModel,
      project.apiKey,
      context,
      question.trim()
    );

    // Prepare sources
    const sources = similarChunks.map(chunk => ({
      documentName: chunk.documentName,
      chunkIndex: chunk.chunkIndex,
      similarity: chunk.similarity.toFixed(4)
    }));

    res.json({
      answer,
      sources,
      projectId,
      question: question.trim()
    });
  } catch (error) {
    console.error('Error in chat:', error);
    res.status(500).json({ 
      error: 'Failed to generate answer', 
      message: error.message 
    });
  }
});

module.exports = router;

