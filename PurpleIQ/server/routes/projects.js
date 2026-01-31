const express = require('express');
const router = express.Router();
const projectStorage = require('../storage/ProjectStorage');
const documentParser = require('../services/DocumentParser');
const embeddingService = require('../services/EmbeddingService');
const vectorStore = require('../services/VectorStore');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');

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
 * Get all projects
 */
router.get('/', async (req, res) => {
  try {
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

    if (!projectName || !aiModel || !apiKey) {
      return res.status(400).json({ 
        error: 'Missing required fields', 
        required: ['projectName', 'aiModel', 'apiKey'] 
      });
    }

    if (!['openai', 'gemini', 'claude'].includes(aiModel.toLowerCase())) {
      return res.status(400).json({ 
        error: 'Invalid AI model', 
        allowed: ['openai', 'gemini', 'claude'] 
      });
    }

    const project = await projectStorage.createProject({
      projectName,
      aiModel: aiModel.toLowerCase(),
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

    // Parse document into chunks
    console.log(`Parsing document: ${fileName}`);
    let chunks;
    try {
      chunks = await documentParser.parseFile(filePath);
    } catch (parseError) {
      console.error('Document parsing error:', parseError);
      throw parseError;
    }

    if (!chunks || chunks.length === 0) {
      throw new Error('No text could be extracted from the document');
    }

    // Generate embeddings for chunks
    console.log(`Generating embeddings for ${chunks.length} chunks`);
    let embeddings;
    try {
      embeddings = await embeddingService.generateEmbeddings(chunks, project.apiKey);
    } catch (embedError) {
      console.error('Embedding generation error:', embedError);
      throw new Error(`Failed to generate embeddings: ${embedError.message}`);
    }

    // Validate embeddings match chunks
    if (!embeddings || embeddings.length !== chunks.length) {
      console.error(`Embedding mismatch: ${chunks.length} chunks but ${embeddings?.length || 0} embeddings`);
      throw new Error(`Embedding generation failed: expected ${chunks.length} embeddings, got ${embeddings?.length || 0}`);
    }

    // Prepare vector store data
    const vectorData = chunks.map((chunk, index) => {
      if (!embeddings[index]) {
        throw new Error(`Missing embedding for chunk ${index}`);
      }
      return {
        text: chunk,
        embedding: embeddings[index],
        documentName: fileName,
        chunkIndex: index,
        projectId
      };
    });

    // Store in vector database
    await vectorStore.addEmbeddings(projectId, vectorData);

    // Save document metadata
    await projectStorage.addDocumentToProject(projectId, {
      fileName,
      filePath: req.file.filename,
      chunkCount: chunks.length,
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
        chunkCount: chunks.length
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

