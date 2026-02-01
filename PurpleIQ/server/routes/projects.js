const express = require('express');
const router = express.Router();
const projectStorage = require('../storage/ProjectStorage');
const documentParser = require('../services/DocumentParser');
const embeddingService = require('../services/EmbeddingService');
const vectorStore = require('../services/VectorStore');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const pdf = require('pdf-parse');
const mammoth = require('mammoth');

// Configure multer for file uploads
const uploadDir = path.join(__dirname, '../uploads');
fs.ensureDirSync(uploadDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `${req.params.projectId}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.docx', '.txt'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${ext} not allowed. Allowed types: ${allowedTypes.join(', ')}`));
    }
  }
});

/**
 * GET /api/projects
 * Get all projects (lazy loaded - only loads when requested)
 */
router.get('/', async (req, res) => {
  try {
    // Lazy load projects only when this endpoint is called
    const projects = await projectStorage.getAllProjects();
    res.json({ projects: projects.map(p => p.toJSON()) });
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects', message: error.message });
  }
});

/**
 * GET /api/projects/:projectId
 * Get project by ID
 */
router.get('/:projectId', async (req, res) => {
  try {
    const project = await projectStorage.getProject(req.params.projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json({ project: project.toJSON() });
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ error: 'Failed to fetch project', message: error.message });
  }
});

/**
 * POST /api/projects
 * Create a new project
 */
router.post('/', async (req, res) => {
  try {
    const { projectName, aiModel, apiKey } = req.body;

    if (!projectName || !apiKey) {
      return res.status(400).json({ 
        error: 'Missing required fields', 
        required: ['projectName', 'apiKey'] 
      });
    }

    // DEFAULT TO GEMINI (to avoid OpenAI 429 errors)
    // Only validate if aiModel is explicitly provided
    const selectedModel = (aiModel || 'gemini').toLowerCase();
    
    if (aiModel && !['openai', 'gemini', 'claude'].includes(selectedModel)) {
      return res.status(400).json({ 
        error: 'Invalid AI model', 
        allowed: ['openai', 'gemini', 'claude'] 
      });
    }

    console.log(`✅ Creating project with AI model: ${selectedModel.toUpperCase()} (default: gemini)`);

    const project = await projectStorage.createProject({
      projectName,
      aiModel: selectedModel,
      apiKey // In production, encrypt this
    });

    res.status(201).json({ project: project.toJSON() });
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ error: 'Failed to create project', message: error.message });
  }
});

/**
 * POST /api/projects/:projectId/documents
 * Upload and process document for a project
 */
router.post('/:projectId/documents', upload.single('document'), async (req, res) => {
  try {
    const { projectId } = req.params;
    const project = await projectStorage.getProject(projectId);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const fileName = req.file.originalname;

    // Parse document into text first
    console.log(`Parsing document: ${fileName}`);
    let rawText;
    try {
      const ext = path.extname(fileName).toLowerCase();
      if (ext === '.pdf') {
        const dataBuffer = await fs.readFile(filePath);
        const data = await pdf(dataBuffer);
        rawText = data.text;
      } else if (ext === '.docx') {
        const result = await mammoth.extractRawText({ path: filePath });
        rawText = result.value;
      } else if (ext === '.txt') {
        rawText = await fs.readFile(filePath, 'utf-8');
      } else {
        throw new Error(`Unsupported file type: ${ext}`);
      }
    } catch (parseError) {
      console.error('Document parsing error:', parseError);
      throw parseError;
    }

    if (!rawText || rawText.trim().length === 0) {
      throw new Error('No text could be extracted from the document');
    }

    // Use intelligent chunking with metadata
    console.log(`Using intelligent chunking for better retrieval quality`);
    const chunkMetadata = {
      documentName: fileName,
      projectId: projectId,
      uploadedAt: new Date().toISOString()
    };
    
    const chunksWithMetadata = documentParser.intelligentChunkWithMetadata(
      rawText,
      800,  // chunkSize
      100,  // overlap
      chunkMetadata
    );

    if (!chunksWithMetadata || chunksWithMetadata.length === 0) {
      throw new Error('No text chunks could be created from the document');
    }

    // Extract just the text for embedding generation
    const chunkTexts = chunksWithMetadata.map(c => c.text);

    // Generate embeddings for chunks
    console.log(`Generating embeddings for ${chunkTexts.length} chunks`);
    let embeddings;
    try {
      embeddings = await embeddingService.generateEmbeddings(chunkTexts, project.apiKey);
    } catch (embedError) {
      console.error('Embedding generation error:', embedError);
      // Sanitize error message - remove ALL OpenAI references
      let errorMessage = embedError.message || String(embedError);
      
      // Remove OpenAI references completely
      errorMessage = errorMessage.replace(/Failed to generate embeddings with OpenAI:?/gi, 'Failed to generate embeddings with Gemini:');
      errorMessage = errorMessage.replace(/OpenAI/g, 'Gemini');
      errorMessage = errorMessage.replace(/429.*quota.*error/gi, 'API error');
      errorMessage = errorMessage.replace(/You exceeded your current quota.*?\./gi, 'API quota/rate limit issue.');
      errorMessage = errorMessage.replace(/https:\/\/platform\.openai\.com.*/gi, '');
      
      // If error still mentions OpenAI, add a note
      if (errorMessage.toLowerCase().includes('openai')) {
        errorMessage += ' (Note: OpenAI embeddings have been removed. Only Gemini is used.)';
      }
      
      throw new Error(`Failed to generate embeddings: ${errorMessage}`);
    }

    // Validate embeddings match chunks
    if (!embeddings || embeddings.length !== chunksWithMetadata.length) {
      console.error(`Embedding mismatch: ${chunksWithMetadata.length} chunks but ${embeddings?.length || 0} embeddings`);
      throw new Error(`Embedding generation failed: expected ${chunksWithMetadata.length} embeddings, got ${embeddings?.length || 0}`);
    }

    // Prepare vector store data with full metadata
    const vectorData = chunksWithMetadata.map((chunk, index) => {
      if (!embeddings[index]) {
        throw new Error(`Missing embedding for chunk ${index}`);
      }
      return {
        text: chunk.text,
        embedding: embeddings[index],
        documentName: fileName,
        chunkIndex: chunk.chunkIndex,
        projectId: projectId,
        // Additional metadata from intelligent chunking
        charStart: chunk.charStart,
        charEnd: chunk.charEnd,
        charLength: chunk.charLength,
        section: chunk.section || null,
        sectionIndex: chunk.sectionIndex || null
      };
    });

    // Store in vector database
    await vectorStore.addEmbeddings(projectId, vectorData);

    // Save document metadata
    await projectStorage.addDocumentToProject(projectId, {
      fileName,
      filePath: req.file.filename,
      chunkCount: chunksWithMetadata.length,
      uploadedAt: new Date().toISOString()
    });

    // Get updated project to return current document count
    const updatedProject = await projectStorage.getProject(projectId);

    // Clean up uploaded file
    await fs.remove(filePath);

    res.json({
      success: true,
      message: 'Document processed successfully',
      document: {
        fileName,
        chunkCount: chunksWithMetadata.length
      },
      project: updatedProject ? updatedProject.toJSON() : null
    });
  } catch (error) {
    console.error('Error processing document:', error);
    
    // Clean up file on error
    if (req.file && req.file.path) {
      await fs.remove(req.file.path).catch(console.error);
    }

    res.status(500).json({ 
      error: 'Failed to process document', 
      message: error.message 
    });
  }
});

/**
 * DELETE /api/projects/:projectId
 * Delete a project
 */
router.delete('/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    
    // Delete vector store
    await vectorStore.deleteProject(projectId);
    
    // Delete project
    await projectStorage.deleteProject(projectId);

    res.json({ success: true, message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ error: 'Failed to delete project', message: error.message });
  }
});

/**
 * POST /api/projects/:projectId/test-search-quality
 * Test vector search quality for a project
 */
router.post('/:projectId/test-search-quality', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { testQueries } = req.body; // Optional: custom test queries

    // Verify project exists
    const project = await projectStorage.getProject(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Run quality test
    const results = await embeddingService.testVectorSearchQuality(projectId, testQueries);

    res.json({
      success: true,
      ...results
    });
  } catch (error) {
    console.error('Error testing search quality:', error);
    res.status(500).json({ 
      error: 'Failed to test search quality', 
      message: error.message 
    });
  }
});

module.exports = router;

