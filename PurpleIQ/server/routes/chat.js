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

    // Search for relevant chunks with minimum similarity threshold
    const MIN_SIMILARITY = 0.4;
    console.log(`🔍 Searching for relevant chunks in project ${projectId} (min similarity: ${MIN_SIMILARITY})`);
    
    const similarChunks = await vectorStore.searchSimilar(
      projectId,
      questionEmbedding,
      5, // Top 5 most relevant chunks
      MIN_SIMILARITY // Minimum similarity threshold
    );

    // Get all vectors for logging
    const allVectors = await vectorStore.getProjectVectors(projectId);
    const totalChunks = allVectors.length;

    // Log search quality metrics
    console.log(`📊 Search Results:`);
    console.log(`   Total chunks in project: ${totalChunks}`);
    console.log(`   Chunks found above threshold (${MIN_SIMILARITY}): ${similarChunks.length}`);
    
    if (similarChunks.length > 0) {
      console.log(`   Top matches:`);
      similarChunks.forEach((chunk, idx) => {
        console.log(`     ${idx + 1}. Score: ${chunk.similarity.toFixed(4)} | Doc: ${chunk.documentName} | Chunk: ${chunk.chunkIndex}`);
      });
    } else {
      // Get top result even if below threshold for debugging
      const allResults = await vectorStore.searchSimilarAll(projectId, questionEmbedding, 1);
      if (allResults.length > 0) {
        console.log(`   ⚠️  Best match (below threshold): ${allResults[0].similarity.toFixed(4)}`);
        console.log(`   💡 This suggests the question may not be well-covered in the documents.`);
      }
    }

    // If no good matches found, return helpful message
    if (similarChunks.length === 0) {
      const allResults = await vectorStore.searchSimilarAll(projectId, questionEmbedding, 1);
      const bestScore = allResults.length > 0 ? allResults[0].similarity : 0;
      
      let message = 'I could not find relevant information in the project documents to answer this question.';
      
      if (bestScore > 0 && bestScore < MIN_SIMILARITY) {
        message += ` The closest match had a similarity score of ${bestScore.toFixed(2)}, which is below the quality threshold.`;
        message += ' Please try rephrasing your question or ensure relevant documents are uploaded.';
      } else if (totalChunks === 0) {
        message = 'No documents have been uploaded to this project yet. Please upload relevant documents first.';
      } else {
        message += ' Please try rephrasing your question or upload more relevant documents.';
      }

      return res.json({
        answer: message,
        sources: [],
        searchQuality: {
          totalChunks,
          matchesFound: 0,
          bestScore: bestScore > 0 ? bestScore.toFixed(4) : null,
          threshold: MIN_SIMILARITY
        }
      });
    }

    // Build context from relevant chunks
    const context = similarChunks
      .map((chunk, index) => `[Document ${index + 1}: ${chunk.documentName}]\n${chunk.text}`)
      .join('\n\n---\n\n');

    // Generate answer using project's AI model with automatic fallback
    console.log(`\n📝 Generating answer using ${project.aiModel.toUpperCase()} for project ${projectId}`);
    console.log(`📄 Context length: ${context.length} characters`);
    console.log(`❓ Question: ${question.trim().substring(0, 100)}${question.trim().length > 100 ? '...' : ''}`);
    
    const answer = await aiService.generateAnswer(
      project.aiModel,
      project.apiKey,
      context,
      question.trim(),
      {
        enableFallback: true, // Enable automatic fallback between providers
        // Note: Fallback will only work if project has both API keys configured
        // For now, projects have one key per model, so fallback requires future enhancement
      }
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
      question: question.trim(),
      searchQuality: {
        totalChunks,
        matchesFound: similarChunks.length,
        minScore: similarChunks.length > 0 ? Math.min(...similarChunks.map(c => c.similarity)).toFixed(4) : null,
        maxScore: similarChunks.length > 0 ? Math.max(...similarChunks.map(c => c.similarity)).toFixed(4) : null,
        threshold: MIN_SIMILARITY
      }
    });
  } catch (error) {
    // Log detailed error server-side for debugging
    console.error('❌ Error in chat endpoint:', {
      error: error.message,
      name: error.name,
      stack: error.stack,
      projectId: req.params.projectId,
      timestamp: new Date().toISOString()
    });

    // Handle custom AI service errors
    const AIErrors = require('../utils/AIErrors');
    
    // Check if it's a custom error class
    if (error instanceof AIErrors.AIServiceError) {
      return res.status(error.statusCode).json(error.toJSON());
    }

    // Handle validation errors (400)
    if (error.message && (
      error.message.includes('required') || 
      error.message.includes('invalid') ||
      error.message.includes('must be')
    )) {
      return res.status(400).json({
        error: 'Bad Request',
        message: error.message
      });
    }

    // Default to 500 for unexpected errors
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: 'An unexpected error occurred while generating the answer. Please try again.'
    });
  }
});

module.exports = router;

