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

    // Check if project has any documents (for RAG context)
    const vectors = await vectorStore.getProjectVectors(projectId);
    let context = '';
    let similarChunks = [];
    const totalChunks = vectors.length;

    if (vectors.length === 0) {
      console.log(`⚠️  No documents found for project ${projectId}. Agentic system will work without RAG context.`);
      // Continue without RAG - agentic system can still work with general knowledge
    } else {

      // Generate embedding for question
      console.log(`Generating embedding for question in project ${projectId}`);
      const questionEmbedding = await embeddingService.generateEmbedding(
        question.trim(),
        project.apiKey
      );

      // Search for relevant chunks with minimum similarity threshold
      const MIN_SIMILARITY = 0.4;
      console.log(`🔍 Searching for relevant chunks in project ${projectId} (min similarity: ${MIN_SIMILARITY})`);
      
      similarChunks = await vectorStore.searchSimilar(
        projectId,
        questionEmbedding,
        5, // Top 5 most relevant chunks
        MIN_SIMILARITY // Minimum similarity threshold
      );

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

      // Build context from relevant chunks
      if (similarChunks.length > 0) {
        context = similarChunks
          .map((chunk, index) => `[Document ${index + 1}: ${chunk.documentName}]\n${chunk.text}`)
          .join('\n\n---\n\n');
      } else {
        // If no good matches but documents exist, use best match anyway
        const allResults = await vectorStore.searchSimilarAll(projectId, questionEmbedding, 3);
        if (allResults.length > 0) {
          context = allResults
            .map((chunk, index) => `[Document ${index + 1}: ${chunk.documentName}]\n${chunk.text}`)
            .join('\n\n---\n\n');
          console.log(`⚠️  Using lower-quality matches (best score: ${allResults[0].similarity.toFixed(4)})`);
        } else {
          context = 'No relevant project documents found.';
        }
      }
    }

    // Use agentic system: classify intent and route to appropriate workflow
    console.log(`\n📝 Processing with AGENTIC MODE using ${project.aiModel.toUpperCase()} for project ${projectId}`);
    console.log(`📄 Context length: ${context.length} characters`);
    console.log(`❓ Question: ${question.trim().substring(0, 100)}${question.trim().length > 100 ? '...' : ''}`);
    
    const agenticResult = await aiService.processAgenticRequest(
      question.trim(),
      context,
      project.aiModel,
      project.apiKey,
      projectId
    );

    const answer = agenticResult.answer;
    const intent = agenticResult.intent;
    const workflow = agenticResult.workflow;
    const metadata = agenticResult.metadata || null;

    // Prepare sources
    const sources = similarChunks.map(chunk => ({
      documentName: chunk.documentName,
      chunkIndex: chunk.chunkIndex,
      similarity: chunk.similarity.toFixed(4)
    }));

    // Extract document names used
    const documentsUsed = [...new Set(similarChunks.map(chunk => chunk.documentName))];

    // Save conversation history
    aiService.saveConversation(projectId, question.trim(), answer, {
      intent: intent,
      workflow: workflow,
      sources: sources,
      documentsUsed: documentsUsed
    });

    const MIN_SIMILARITY = 0.4;
    res.json({
      answer,
      sources,
      projectId,
      question: question.trim(),
      // Agentic system metadata
      intent: intent,
      workflow: workflow,
      ...(metadata && { metadata: metadata }),
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

/**
 * GET /api/chat/:projectId/history
 * Get conversation history for a project
 */
router.get('/:projectId/history', async (req, res) => {
  try {
    const { projectId } = req.params;
    const limit = parseInt(req.query.limit) || 10;

    const history = aiService.getConversationHistory(projectId, limit);

    res.json({
      projectId,
      history,
      count: history.length
    });
  } catch (error) {
    console.error('❌ Error getting conversation history:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve conversation history'
    });
  }
});

/**
 * DELETE /api/chat/:projectId/history
 * Clear conversation history for a project
 */
router.delete('/:projectId/history', async (req, res) => {
  try {
    const { projectId } = req.params;

    const cleared = aiService.clearConversationHistory(projectId);

    if (cleared) {
      res.json({
        success: true,
        message: `Conversation history cleared for project ${projectId}`
      });
    } else {
      res.status(404).json({
        error: 'Not Found',
        message: `No conversation history found for project ${projectId}`
      });
    }
  } catch (error) {
    console.error('❌ Error clearing conversation history:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to clear conversation history'
    });
  }
});

module.exports = router;

