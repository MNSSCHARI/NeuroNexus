/**
 * API Endpoint Tests
 * Tests all API endpoints with mocked responses
 */

const request = require('supertest');
const express = require('express');
const fs = require('fs-extra');
const path = require('path');

// Mock services before importing app
jest.mock('../services/AIService');
jest.mock('../services/EmbeddingService');
jest.mock('../services/VectorStore');
jest.mock('../storage/ProjectStorage');
jest.mock('../services/ExportService');

const app = require('../index');
const AIService = require('../services/AIService');
const EmbeddingService = require('../services/EmbeddingService');
const VectorStore = require('../services/VectorStore');
const ProjectStorage = require('../storage/ProjectStorage');
const ExportService = require('../services/ExportService');

describe('API Endpoints', () => {
  let testProjectId;
  let testApiKey = 'test-api-key-123';

  beforeEach(() => {
    jest.clearAllMocks();
    testProjectId = 'test-project-' + Date.now();
  });

  afterEach(async () => {
    // Cleanup test data
    try {
      if (testProjectId) {
        await ProjectStorage.deleteProject(testProjectId).catch(() => {});
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('GET /api/projects', () => {
    it('should return list of projects', async () => {
      const mockProjects = [
        { id: 'project-1', name: 'Test Project 1' },
        { id: 'project-2', name: 'Test Project 2' }
      ];

      ProjectStorage.getAllProjects.mockResolvedValue(mockProjects);

      const response = await request(app)
        .get('/api/projects')
        .expect(200);

      expect(response.body).toHaveProperty('projects');
      expect(response.body.projects).toHaveLength(2);
    });

    it('should handle empty project list', async () => {
      ProjectStorage.getAllProjects.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/projects')
        .expect(200);

      expect(response.body.projects).toEqual([]);
    });
  });

  describe('POST /api/projects', () => {
    it('should create a new project', async () => {
      const newProject = {
        name: 'New Test Project',
        aiModel: 'gemini',
        apiKey: testApiKey
      };

      const createdProject = {
        id: testProjectId,
        ...newProject,
        documents: [],
        createdAt: new Date().toISOString()
      };

      ProjectStorage.createProject.mockResolvedValue(createdProject);

      const response = await request(app)
        .post('/api/projects')
        .send(newProject)
        .expect(200);

      expect(response.body).toHaveProperty('project');
      expect(response.body.project.name).toBe(newProject.name);
      expect(ProjectStorage.createProject).toHaveBeenCalledWith(
        expect.objectContaining({
          name: newProject.name,
          aiModel: newProject.aiModel
        })
      );
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/projects')
        .send({ name: '' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/projects/:projectId', () => {
    it('should return project details', async () => {
      const mockProject = {
        id: testProjectId,
        name: 'Test Project',
        documents: []
      };

      ProjectStorage.getProject.mockResolvedValue(mockProject);

      const response = await request(app)
        .get(`/api/projects/${testProjectId}`)
        .expect(200);

      expect(response.body.project.id).toBe(testProjectId);
    });

    it('should return 404 for non-existent project', async () => {
      ProjectStorage.getProject.mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/projects/non-existent`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/projects/:projectId/documents', () => {
    it('should upload and process a document', async () => {
      // Create a test file
      const testFile = path.join(__dirname, 'test-data', 'sample.txt');
      await fs.ensureDir(path.dirname(testFile));
      await fs.writeFile(testFile, 'Sample document content for testing.');

      const mockProject = {
        id: testProjectId,
        name: 'Test Project',
        apiKey: testApiKey
      };

      ProjectStorage.getProject.mockResolvedValue(mockProject);
      
      // Mock document parsing
      const mockChunks = ['chunk1', 'chunk2'];
      const mockEmbeddings = [[0.1, 0.2], [0.3, 0.4]];
      
      // Mock services
      const DocumentParser = require('../services/DocumentParser');
      jest.spyOn(DocumentParser, 'intelligentChunkWithMetadata').mockResolvedValue(
        mockChunks.map((text, idx) => ({
          text,
          chunkIndex: idx,
          charStart: idx * 100,
          charEnd: (idx + 1) * 100,
          charLength: text.length
        }))
      );

      EmbeddingService.generateEmbeddings.mockResolvedValue(mockEmbeddings);
      VectorStore.addEmbeddings.mockResolvedValue(2);

      const response = await request(app)
        .post(`/api/projects/${testProjectId}/documents`)
        .attach('document', testFile)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.document).toHaveProperty('chunkCount', 2);

      // Cleanup
      await fs.remove(testFile).catch(() => {});
    });

    it('should reject invalid file types', async () => {
      const testFile = path.join(__dirname, 'test-data', 'invalid.exe');
      await fs.ensureDir(path.dirname(testFile));
      await fs.writeFile(testFile, 'invalid content');

      const mockProject = {
        id: testProjectId,
        name: 'Test Project'
      };

      ProjectStorage.getProject.mockResolvedValue(mockProject);

      const response = await request(app)
        .post(`/api/projects/${testProjectId}/documents`)
        .attach('document', testFile)
        .expect(400);

      expect(response.body).toHaveProperty('error');

      await fs.remove(testFile).catch(() => {});
    });
  });

  describe('POST /api/chat/:projectId', () => {
    it('should process chat message', async () => {
      const mockProject = {
        id: testProjectId,
        name: 'Test Project',
        aiModel: 'gemini',
        apiKey: testApiKey
      };

      const mockResponse = {
        answer: 'This is a test response',
        intent: 'GENERAL_QA_QUESTION',
        metadata: {}
      };

      ProjectStorage.getProject.mockResolvedValue(mockProject);
      VectorStore.getProjectVectors.mockResolvedValue([]);
      AIService.processAgenticRequest.mockResolvedValue(mockResponse);

      const response = await request(app)
        .post(`/api/chat/${testProjectId}`)
        .send({ question: 'What is this project about?' })
        .expect(200);

      expect(response.body).toHaveProperty('answer');
      expect(response.body.answer).toBe(mockResponse.answer);
    });

    it('should handle missing question', async () => {
      const response = await request(app)
        .post(`/api/chat/${testProjectId}`)
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/export/excel', () => {
    it('should export test cases to Excel', async () => {
      const testCases = [
        {
          id: 'TC001',
          description: 'Test case 1',
          steps: 'Step 1, Step 2',
          expected: 'Expected result',
          priority: 'High'
        }
      ];

      const mockBuffer = Buffer.from('mock excel data');
      ExportService.exportTestCasesToExcel.mockResolvedValue(mockBuffer);

      const response = await request(app)
        .post('/api/export/excel')
        .send({ testCases, projectName: 'Test Project' })
        .expect(200);

      expect(response.headers['content-type']).toContain('spreadsheetml.sheet');
      expect(response.headers['content-disposition']).toContain('attachment');
    });

    it('should validate test cases array', async () => {
      const response = await request(app)
        .post('/api/export/excel')
        .send({ testCases: 'invalid' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/export/pdf', () => {
    it('should export bug report to PDF', async () => {
      const bugReport = {
        title: 'Test Bug',
        description: 'Bug description',
        steps: 'Steps to reproduce'
      };

      const mockBuffer = Buffer.from('mock pdf data');
      ExportService.exportBugReportToPDF.mockResolvedValue(mockBuffer);

      const response = await request(app)
        .post('/api/export/pdf')
        .send({ bugReport, projectName: 'Test Project' })
        .expect(200);

      expect(response.headers['content-type']).toContain('pdf');
    });
  });

  describe('POST /api/export/docx', () => {
    it('should export test plan to DOCX', async () => {
      const testPlan = {
        title: 'Test Plan',
        scope: 'Test scope',
        approach: 'Test approach'
      };

      const mockBuffer = Buffer.from('mock docx data');
      ExportService.exportTestPlanToDocx.mockResolvedValue(mockBuffer);

      const response = await request(app)
        .post('/api/export/docx')
        .send({ testPlan, projectName: 'Test Project' })
        .expect(200);

      expect(response.headers['content-type']).toContain('wordprocessingml');
    });
  });

  describe('GET /api/logs', () => {
    it('should return logs', async () => {
      const response = await request(app)
        .get('/api/logs')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('logs');
    });

    it('should filter logs by level', async () => {
      const response = await request(app)
        .get('/api/logs?level=error&limit=10')
        .expect(200);

      expect(response.body.filters.level).toBe('error');
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/api/unknown-route')
        .expect(404);
    });

    it('should handle server errors gracefully', async () => {
      ProjectStorage.getAllProjects.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/projects')
        .expect(500);

      expect(response.body).toHaveProperty('error');
    });
  });
});

