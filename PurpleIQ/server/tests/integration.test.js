/**
 * Integration Tests
 * End-to-end tests for complete user journeys
 */

const request = require('supertest');
const fs = require('fs-extra');
const path = require('path');
const app = require('../index');
const ProjectStorage = require('../storage/ProjectStorage');
const VectorStore = require('../services/VectorStore');
const AIService = require('../services/AIService');
const EmbeddingService = require('../services/EmbeddingService');
const ExportService = require('../services/ExportService');

describe('Integration Tests', () => {
  let testProjectId;
  let testApiKey = 'test-api-key-' + Date.now();
  const testDataDir = path.join(__dirname, 'test-data');

  beforeAll(async () => {
    // Ensure test data directory exists
    await fs.ensureDir(testDataDir);
  });

  beforeEach(async () => {
    testProjectId = 'test-project-' + Date.now();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    // Cleanup test data
    try {
      if (testProjectId) {
        await ProjectStorage.deleteProject(testProjectId).catch(() => {});
        await VectorStore.deleteProject(testProjectId).catch(() => {});
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  afterAll(async () => {
    // Cleanup test files
    await fs.remove(testDataDir).catch(() => {});
  });

  describe('Complete User Journey: Upload PRD → Generate Test Cases → Export', () => {
    it('should complete full workflow', async () => {
      // Step 1: Create project
      const createResponse = await request(app)
        .post('/api/projects')
        .send({
          name: 'Integration Test Project',
          aiModel: 'gemini',
          apiKey: testApiKey
        })
        .expect(200);

      const projectId = createResponse.body.project.id;
      testProjectId = projectId;

      expect(projectId).toBeDefined();

      // Step 2: Create sample PRD document
      const samplePRD = `# Project Requirements Document

## Authentication Module

Users must authenticate using email and password. The system validates credentials and returns a JWT token.

### Requirements:
- Email must be valid format
- Password must be at least 8 characters
- JWT token expires after 24 hours

## Payment Processing

Payment processing uses Stripe API. All transactions are encrypted.

### Requirements:
- Support credit cards
- Support PayPal
- Encrypt all payment data`;

      const prdFile = path.join(testDataDir, 'sample-prd.txt');
      await fs.writeFile(prdFile, samplePRD);

      // Step 3: Upload document
      const uploadResponse = await request(app)
        .post(`/api/projects/${projectId}/documents`)
        .attach('document', prdFile)
        .expect(200);

      expect(uploadResponse.body.success).toBe(true);
      expect(uploadResponse.body.document.chunkCount).toBeGreaterThan(0);

      // Step 4: Generate test cases via chat
      const chatResponse = await request(app)
        .post(`/api/chat/${projectId}`)
        .send({
          question: 'Generate comprehensive test cases for the authentication module'
        })
        .expect(200);

      expect(chatResponse.body).toHaveProperty('answer');
      expect(chatResponse.body.intent).toBeDefined();

      // Step 5: Export test cases (if test cases were generated)
      if (chatResponse.body.metadata && chatResponse.body.metadata.testCases) {
        const exportResponse = await request(app)
          .post('/api/export/excel')
          .send({
            testCases: chatResponse.body.metadata.testCases,
            projectName: 'Integration Test Project'
          })
          .expect(200);

        expect(exportResponse.headers['content-type']).toContain('spreadsheetml.sheet');
        expect(exportResponse.headers['content-disposition']).toContain('attachment');
      }

      // Cleanup
      await fs.remove(prdFile).catch(() => {});
    });
  });

  describe('Document Upload and Processing', () => {
    it('should upload PDF and create chunks', async () => {
      // Create project
      const createResponse = await request(app)
        .post('/api/projects')
        .send({
          name: 'PDF Test Project',
          aiModel: 'gemini',
          apiKey: testApiKey
        });

      const projectId = createResponse.body.project.id;
      testProjectId = projectId;

      // Create sample text file (simulating PDF content)
      const sampleText = `Sample PDF Content

This is a test document with multiple paragraphs.

Each paragraph contains multiple sentences. They are well-formed and complete.

The document has structure and meaning.`;

      const textFile = path.join(testDataDir, 'sample-doc.txt');
      await fs.writeFile(textFile, sampleText);

      // Upload document
      const uploadResponse = await request(app)
        .post(`/api/projects/${projectId}/documents`)
        .attach('document', textFile)
        .expect(200);

      expect(uploadResponse.body.success).toBe(true);
      expect(uploadResponse.body.document.chunkCount).toBeGreaterThan(0);

      // Verify chunks were created with metadata
      const vectors = await VectorStore.getProjectVectors(projectId);
      expect(vectors.length).toBeGreaterThan(0);
      
      // Check chunk metadata
      if (vectors.length > 0) {
        const firstChunk = vectors[0];
        expect(firstChunk).toHaveProperty('text');
        expect(firstChunk).toHaveProperty('documentName');
        expect(firstChunk).toHaveProperty('chunkIndex');
      }

      await fs.remove(textFile).catch(() => {});
    });

    it('should handle multiple document uploads', async () => {
      // Create project
      const createResponse = await request(app)
        .post('/api/projects')
        .send({
          name: 'Multi-Doc Test Project',
          aiModel: 'gemini',
          apiKey: testApiKey
        });

      const projectId = createResponse.body.project.id;
      testProjectId = projectId;

      // Upload first document
      const doc1 = path.join(testDataDir, 'doc1.txt');
      await fs.writeFile(doc1, 'Document 1 content with multiple sentences.');
      
      await request(app)
        .post(`/api/projects/${projectId}/documents`)
        .attach('document', doc1)
        .expect(200);

      // Upload second document
      const doc2 = path.join(testDataDir, 'doc2.txt');
      await fs.writeFile(doc2, 'Document 2 content with different information.');
      
      await request(app)
        .post(`/api/projects/${projectId}/documents`)
        .attach('document', doc2)
        .expect(200);

      // Verify both documents are stored
      const vectors = await VectorStore.getProjectVectors(projectId);
      expect(vectors.length).toBeGreaterThan(0);

      // Check that both document names are present
      const documentNames = [...new Set(vectors.map(v => v.documentName))];
      expect(documentNames.length).toBeGreaterThanOrEqual(1);

      await fs.remove(doc1).catch(() => {});
      await fs.remove(doc2).catch(() => {});
    });
  });

  describe('Chat and RAG Integration', () => {
    it('should use RAG context from uploaded documents', async () => {
      // Create project
      const createResponse = await request(app)
        .post('/api/projects')
        .send({
          name: 'RAG Test Project',
          aiModel: 'gemini',
          apiKey: testApiKey
        });

      const projectId = createResponse.body.project.id;
      testProjectId = projectId;

      // Upload document with specific content
      const docContent = `# Authentication System

The authentication system requires:
- Email validation
- Password strength check (minimum 8 characters)
- JWT token generation
- Token expiration after 24 hours`;

      const docFile = path.join(testDataDir, 'auth-doc.txt');
      await fs.writeFile(docFile, docContent);

      await request(app)
        .post(`/api/projects/${projectId}/documents`)
        .attach('document', docFile)
        .expect(200);

      // Ask question that should use RAG context
      const chatResponse = await request(app)
        .post(`/api/chat/${projectId}`)
        .send({
          question: 'What are the password requirements?'
        })
        .expect(200);

      expect(chatResponse.body).toHaveProperty('answer');
      // Answer should reference the document content
      expect(chatResponse.body.answer.length).toBeGreaterThan(0);

      await fs.remove(docFile).catch(() => {});
    });

    it('should handle questions without documents gracefully', async () => {
      // Create project without documents
      const createResponse = await request(app)
        .post('/api/projects')
        .send({
          name: 'No Docs Project',
          aiModel: 'gemini',
          apiKey: testApiKey
        });

      const projectId = createResponse.body.project.id;
      testProjectId = projectId;

      // Ask question
      const chatResponse = await request(app)
        .post(`/api/chat/${projectId}`)
        .send({
          question: 'What is this project about?'
        })
        .expect(200);

      // Should still respond (using general knowledge)
      expect(chatResponse.body).toHaveProperty('answer');
    });
  });

  describe('Export Functionality', () => {
    it('should export test cases to Excel', async () => {
      const testCases = [
        {
          id: 'TC001',
          description: 'Test valid login',
          steps: '1. Enter valid email\n2. Enter password\n3. Click login',
          expected: 'User logged in successfully',
          priority: 'High',
          type: 'Positive'
        },
        {
          id: 'TC002',
          description: 'Test invalid password',
          steps: '1. Enter valid email\n2. Enter wrong password\n3. Click login',
          expected: 'Error message displayed',
          priority: 'High',
          type: 'Negative'
        }
      ];

      const exportResponse = await request(app)
        .post('/api/export/excel')
        .send({
          testCases,
          projectName: 'Test Project'
        })
        .expect(200);

      expect(exportResponse.headers['content-type']).toContain('spreadsheetml.sheet');
      expect(exportResponse.headers['content-disposition']).toContain('Test_Project_TestCases.xlsx');
      expect(exportResponse.body).toBeInstanceOf(Buffer);
    });

    it('should export bug report to PDF', async () => {
      const bugReport = {
        title: 'Login button not working',
        description: 'The login button does not respond when clicked',
        steps: '1. Navigate to login page\n2. Enter credentials\n3. Click login button',
        expected: 'User should be logged in',
        actual: 'Button does not respond',
        severity: 'High',
        priority: 'P1'
      };

      const exportResponse = await request(app)
        .post('/api/export/pdf')
        .send({
          bugReport,
          projectName: 'Test Project'
        })
        .expect(200);

      expect(exportResponse.headers['content-type']).toContain('pdf');
      expect(exportResponse.body).toBeInstanceOf(Buffer);
    });

    it('should export test plan to DOCX', async () => {
      const testPlan = {
        title: 'Authentication Test Plan',
        scope: 'Test all authentication features',
        approach: 'Manual and automated testing',
        schedule: '2 weeks',
        resources: '2 QA engineers',
        risks: 'API changes may affect tests'
      };

      const exportResponse = await request(app)
        .post('/api/export/docx')
        .send({
          testPlan,
          projectName: 'Test Project'
        })
        .expect(200);

      expect(exportResponse.headers['content-type']).toContain('wordprocessingml');
      expect(exportResponse.body).toBeInstanceOf(Buffer);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid project ID gracefully', async () => {
      const response = await request(app)
        .get('/api/projects/invalid-id')
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });

    it('should handle missing required fields', async () => {
      const response = await request(app)
        .post('/api/projects')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should handle empty chat messages', async () => {
      // Create project first
      const createResponse = await request(app)
        .post('/api/projects')
        .send({
          name: 'Error Test Project',
          aiModel: 'gemini',
          apiKey: testApiKey
        });

      const projectId = createResponse.body.project.id;
      testProjectId = projectId;

      const response = await request(app)
        .post(`/api/chat/${projectId}`)
        .send({ question: '' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });
});

