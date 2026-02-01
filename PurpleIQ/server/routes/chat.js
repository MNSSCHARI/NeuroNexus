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
      const questionEmbedding = await embeddingService.generateEmbedding(
        question.trim(),
        project.apiKey,
        req.requestId
      );

      // Search for relevant chunks with minimum similarity threshold
      const MIN_SIMILARITY = 0.4;
      
      similarChunks = await vectorStore.searchSimilar(
        projectId,
        questionEmbedding,
        5, // Top 5 most relevant chunks
        MIN_SIMILARITY, // Minimum similarity threshold
        req.requestId
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
        const allResults = await vectorStore.searchSimilarAll(projectId, questionEmbedding, 1, req.requestId);
        if (allResults.length > 0) {
          req.logger.warn('Best match below threshold', {
            function: 'chat',
            projectId,
            topScore: allResults[0].similarity.toFixed(4),
            threshold: MIN_SIMILARITY
          });
        }
      }

      // Build context from relevant chunks
      if (similarChunks.length > 0) {
        context = similarChunks
          .map((chunk, index) => `[Document ${index + 1}: ${chunk.documentName}]\n${chunk.text}`)
          .join('\n\n---\n\n');
      } else {
        // If no good matches but documents exist, use best match anyway
        const allResults = await vectorStore.searchSimilarAll(projectId, questionEmbedding, 3, req.requestId);
        if (allResults.length > 0) {
          context = allResults
            .map((chunk, index) => `[Document ${index + 1}: ${chunk.documentName}]\n${chunk.text}`)
            .join('\n\n---\n\n');
          req.logger.warn('Using lower-quality matches', {
            function: 'chat',
            projectId,
            bestScore: allResults[0].similarity.toFixed(4),
            threshold: MIN_SIMILARITY
          });
        } else {
          context = 'No relevant project documents found.';
        }
      }
    }

    // Use agentic system: classify intent and route to appropriate workflow
    console.log(`\n📝 Processing with AGENTIC MODE using ${project.aiModel.toUpperCase()} for project ${projectId}`);
    console.log(`📄 Context length: ${context.length} characters`);
    console.log(`❓ Question: ${question.trim().substring(0, 100)}${question.trim().length > 100 ? '...' : ''}`);
    
    // Progress callback for loading indicators (if supported by client)
    const progressCallback = req.query.progress === 'true' ? (progress) => {
      // Could send Server-Sent Events (SSE) here for real-time progress
      // For now, we'll just log it
      if (progress.stage && progress.progress !== undefined) {
        console.log(`📊 Progress: ${progress.stage} - ${progress.progress}%`);
      }
    } : null;
    
    const agenticResult = await aiService.processAgenticRequest(
      question.trim(),
      context,
      project.aiModel,
      project.apiKey,
      projectId,
      progressCallback
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
      // Model and rate limit metadata
      ...(agenticResult.modelInfo && { modelInfo: agenticResult.modelInfo }),
      ...(agenticResult.rateLimitInfo && { rateLimitInfo: agenticResult.rateLimitInfo }),
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
    const errorDetails = {
      error: error.message,
      name: error.name,
      stack: error.stack,
      projectId: req.params.projectId,
      timestamp: new Date().toISOString()
    };
    console.error('❌ Error in chat endpoint:', errorDetails);

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

    // Handle API key errors
    if (error.message && (
      error.message.includes('API key') ||
      error.message.includes('GEMINI_API_KEY') ||
      error.message.includes('OPENAI_API_KEY')
    )) {
      return res.status(401).json({
        error: 'API Key Error',
        message: error.message
      });
    }

    // Handle rate limit errors
    if (error.message && (
      error.message.includes('429') ||
      error.message.includes('rate limit') ||
      error.message.includes('quota')
    )) {
      return res.status(429).json({
        error: 'Rate Limit Exceeded',
        message: error.message || 'API rate limit exceeded. Please try again in a moment.'
      });
    }

    // For development, return more details
    const isDevelopment = process.env.NODE_ENV !== 'production';
    const errorMessage = isDevelopment 
      ? `${error.message || 'An unexpected error occurred'} (${error.name || 'Error'})`
      : 'An unexpected error occurred while generating the answer. Please try again.';

    // Default to 500 for unexpected errors
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: errorMessage,
      ...(isDevelopment && { details: error.stack?.split('\n').slice(0, 5) })
    });
  }
});

/**
 * GET /api/chat/metrics
 * Get AI self-evaluation metrics
 */
router.get('/metrics', async (req, res) => {
  try {
    const metrics = aiService.getEvaluationMetrics();
    res.json({
      success: true,
      metrics: metrics
    });
  } catch (error) {
    console.error('Error fetching evaluation metrics:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch evaluation metrics'
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
 * GET /api/debug
 * Get debug information about recent AI requests
 */
router.get('/debug', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5;
    const debugLog = aiService.getDebugLog(limit);
    
    // Calculate context quality metrics
    const contextQualityMetrics = debugLog.map(entry => {
      if (!entry.contextLength) return null;
      
      const contextTokens = entry.promptTokens - entry.questionTokens;
      const qualityScore = calculateContextQuality(entry);
      
      return {
        timestamp: entry.timestamp,
        contextLength: entry.contextLength,
        contextTokens: contextTokens,
        questionLength: entry.questionLength,
        qualityScore: qualityScore,
        promptTokens: entry.promptTokens,
        responseTokens: entry.responseTokens
      };
    }).filter(m => m !== null);
    
    res.json({
      debugLog: debugLog.map(entry => ({
        timestamp: entry.timestamp,
        type: entry.type,
        model: entry.model,
        provider: entry.provider,
        prompt: entry.prompt?.substring(0, 500) + (entry.prompt?.length > 500 ? '...' : ''),
        promptTokens: entry.promptTokens,
        response: entry.response?.substring(0, 500) + (entry.response?.length > 500 ? '...' : ''),
        responseTokens: entry.responseTokens,
        duration: entry.duration,
        contextLength: entry.contextLength,
        questionLength: entry.questionLength,
        actualTokens: entry.actualTokens
      })),
      contextQualityMetrics: contextQualityMetrics,
      summary: {
        totalEntries: aiService.debugLog.length,
        averagePromptTokens: debugLog.length > 0 
          ? Math.round(debugLog.reduce((sum, e) => sum + (e.promptTokens || 0), 0) / debugLog.length)
          : 0,
        averageResponseTokens: debugLog.length > 0
          ? Math.round(debugLog.reduce((sum, e) => sum + (e.responseTokens || 0), 0) / debugLog.length)
          : 0,
        averageDuration: debugLog.length > 0
          ? Math.round(debugLog.reduce((sum, e) => sum + (e.duration || 0), 0) / debugLog.length)
          : 0
      }
    });
  } catch (error) {
    console.error('❌ Error getting debug info:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve debug information'
    });
  }
});

/**
 * Calculate context quality score
 */
function calculateContextQuality(entry) {
  if (!entry.contextLength || !entry.questionLength) return 0;
  
  let score = 0;
  
  // Context length score (0-40 points)
  // Optimal: 1000-3000 chars (20 points)
  // Too short: < 500 chars (10 points)
  // Too long: > 5000 chars (10 points, risk of truncation)
  if (entry.contextLength >= 1000 && entry.contextLength <= 3000) {
    score += 40;
  } else if (entry.contextLength >= 500 && entry.contextLength < 1000) {
    score += 30;
  } else if (entry.contextLength > 3000 && entry.contextLength <= 5000) {
    score += 30;
  } else if (entry.contextLength < 500) {
    score += 10;
  } else {
    score += 10; // Too long
  }
  
  // Token efficiency (0-30 points)
  // Optimal ratio: 2:1 to 5:1 (context:question)
  const ratio = entry.contextLength / entry.questionLength;
  if (ratio >= 2 && ratio <= 5) {
    score += 30;
  } else if (ratio >= 1 && ratio < 2) {
    score += 20;
  } else if (ratio > 5 && ratio <= 10) {
    score += 20;
  } else {
    score += 10;
  }
  
  // Response quality (0-30 points)
  // Based on response length and tokens
  if (entry.responseTokens >= 100 && entry.responseTokens <= 2000) {
    score += 30;
  } else if (entry.responseTokens >= 50 && entry.responseTokens < 100) {
    score += 20;
  } else if (entry.responseTokens > 2000) {
    score += 20; // Very long response
  } else {
    score += 10; // Too short
  }
  
  return Math.min(100, score);
}

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

/**
 * GET /api/debug/vector-search/:projectId
 * Detailed vector search debugging
 */
router.get('/debug/vector-search/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { query } = req.query;
    
    const embeddingService = require('../services/EmbeddingService');
    
    // Run detailed debug
    const debugResult = await embeddingService.debugVectorSearch(
      projectId, 
      query || 'login functionality'
    );
    
    res.json(debugResult);
  } catch (error) {
    console.error('❌ Error in vector search debug:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

/**
 * GET /api/rate-limit-status
 * Get current rate limit status and recommendations
 */
router.get('/rate-limit-status', async (req, res) => {
  try {
    const status = aiService.getRateLimitStatus();
    res.json({
      success: true,
      ...status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting rate limit status:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve rate limit status'
    });
  }
});

module.exports = router;

