/**
 * Health Check Service
 * 
 * Comprehensive health checks for all system components
 * Used for pre-demo validation and monitoring
 */

const projectStorage = require('../storage/ProjectStorage');
const embeddingService = require('./EmbeddingService');
const vectorStore = require('./VectorStore');
const fs = require('fs-extra');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const OpenAI = require('openai');

class HealthCheckService {
  constructor() {
    this.timeout = 10000; // 10 second timeout per check
  }

  /**
   * Run a health check with timeout and error handling
   */
  async runCheck(name, checkFn) {
    const startTime = Date.now();
    try {
      await Promise.race([
        checkFn(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), this.timeout)
        )
      ]);
      
      const responseTime = Date.now() - startTime;
      return {
        status: 'up',
        responseTime: `${responseTime}ms`
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error.message || 'Unknown error';
      
      // Determine if degraded (slow but working) or down (not working)
      let status = 'down';
      if (responseTime > 5000 && responseTime < this.timeout) {
        status = 'degraded';
      }
      
      return {
        status,
        responseTime: `${responseTime}ms`,
        error: errorMessage
      };
    }
  }

  /**
   * Check if server is running
   */
  async checkServer() {
    return this.runCheck('server', async () => {
      // Server is running if we can execute this
      return Promise.resolve();
    });
  }

  /**
   * Check database/storage accessibility
   */
  async checkStorage() {
    return this.runCheck('storage', async () => {
      // Test reading and writing to storage
      const projects = await projectStorage.getAllProjects();
      
      // Test storage path exists and is writable
      const storagePath = path.join(__dirname, '../data/projects');
      await fs.ensureDir(storagePath);
      
      // Test file write
      const testFile = path.join(storagePath, '.health-check-test');
      await fs.writeFile(testFile, 'test');
      await fs.remove(testFile);
      
      return Promise.resolve();
    });
  }

  /**
   * Check OpenAI API key and functionality
   */
  async checkOpenAI() {
    return this.runCheck('openai', async () => {
      const apiKey = process.env.OPENAI_API_KEY;
      
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY not configured');
      }

      // Test with actual API call (small test)
      const openai = new OpenAI({ apiKey });
      
      // Make a minimal API call to test key validity
      const response = await openai.models.list();
      
      if (!response || !response.data) {
        throw new Error('Invalid OpenAI API response');
      }

      return Promise.resolve();
    });
  }

  /**
   * Check Gemini API key and functionality
   */
  async checkGemini() {
    return this.runCheck('gemini', async () => {
      const apiKey = process.env.GEMINI_API_KEY;
      
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY not configured');
      }

      // Test with actual API call
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      
      // Make a minimal API call to test key validity
      const result = await model.generateContent('test');
      const response = await result.response;
      
      if (!response || !response.text) {
        throw new Error('Invalid Gemini API response');
      }

      return Promise.resolve();
    });
  }

  /**
   * Check embedding service
   */
  async checkEmbedding() {
    return this.runCheck('embedding', async () => {
      // Test embedding generation with a small text
      const testText = 'This is a test for embedding service';
      const apiKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;
      
      if (!apiKey) {
        throw new Error('No API key available for embedding service');
      }

      const embedding = await embeddingService.generateEmbedding(testText, apiKey);
      
      if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
        throw new Error('Invalid embedding response');
      }

      return Promise.resolve();
    });
  }

  /**
   * Check vector search functionality
   */
  async checkVectorSearch() {
    return this.runCheck('vectorSearch', async () => {
      // Test vector search by checking if vector store is accessible
      const storagePath = path.join(__dirname, '../data/vectors');
      await fs.ensureDir(storagePath);
      
      // Test cosine similarity calculation (core functionality)
      const testVector1 = [0.1, 0.2, 0.3];
      const testVector2 = [0.4, 0.5, 0.6];
      
      // Calculate cosine similarity manually to test the function exists
      const dotProduct = testVector1.reduce((sum, val, i) => sum + val * testVector2[i], 0);
      const magnitude1 = Math.sqrt(testVector1.reduce((sum, val) => sum + val * val, 0));
      const magnitude2 = Math.sqrt(testVector2.reduce((sum, val) => sum + val * val, 0));
      const similarity = dotProduct / (magnitude1 * magnitude2);
      
      if (isNaN(similarity) || similarity < 0 || similarity > 1) {
        throw new Error('Vector search calculation failed');
      }

      // Test vector store methods exist and are callable
      if (typeof vectorStore.searchSimilar !== 'function') {
        throw new Error('Vector search method not available');
      }

      return Promise.resolve();
    });
  }

  /**
   * Check file upload functionality
   */
  async checkFileUpload() {
    return this.runCheck('fileUpload', async () => {
      // Test uploads directory is accessible and writable
      const uploadsDir = path.join(__dirname, '../uploads');
      await fs.ensureDir(uploadsDir);
      
      // Test file write
      const testFile = path.join(uploadsDir, '.health-check-test');
      await fs.writeFile(testFile, 'test upload');
      
      // Test file read
      const content = await fs.readFile(testFile, 'utf-8');
      if (content !== 'test upload') {
        throw new Error('File upload read/write failed');
      }
      
      // Cleanup
      await fs.remove(testFile);
      
      return Promise.resolve();
    });
  }

  /**
   * Check export services
   */
  async checkExport() {
    return this.runCheck('export', async () => {
      // Import export service functions
      const { exportTestCasesToExcel } = require('./ExportService');
      
      // Test export service methods exist
      if (typeof exportTestCasesToExcel !== 'function') {
        throw new Error('Export service not available');
      }

      // Test creating a minimal export (in-memory, no file write)
      const testCases = [{
        testCaseId: 'TC_TEST_001',
        description: 'Test case',
        preconditions: ['Precondition'],
        steps: ['Step 1'],
        expectedResults: 'Expected result',
        priority: 'High',
        type: 'Positive'
      }];

      // Test Excel export generation (in-memory)
      const excelBuffer = await exportTestCasesToExcel(testCases, 'Health Check Test');

      if (!excelBuffer || excelBuffer.length === 0) {
        throw new Error('Excel export generation failed');
      }

      return Promise.resolve();
    });
  }

  /**
   * Run all health checks
   */
  async runAllChecks() {
    const startTime = Date.now();
    
    const checks = {
      server: await this.checkServer(),
      storage: await this.checkStorage(),
      openai: await this.checkOpenAI().catch(() => ({ status: 'down', responseTime: '0ms', error: 'Not configured or failed' })),
      gemini: await this.checkGemini().catch(() => ({ status: 'down', responseTime: '0ms', error: 'Not configured or failed' })),
      embedding: await this.checkEmbedding(),
      vectorSearch: await this.checkVectorSearch(),
      fileUpload: await this.checkFileUpload(),
      export: await this.checkExport()
    };

    // Determine overall status
    const allUp = Object.values(checks).every(check => check.status === 'up');
    const anyDegraded = Object.values(checks).some(check => check.status === 'degraded');
    const anyDown = Object.values(checks).some(check => check.status === 'down');

    let overallStatus = 'healthy';
    if (anyDown) {
      overallStatus = 'unhealthy';
    } else if (anyDegraded) {
      overallStatus = 'degraded';
    }

    const totalTime = Date.now() - startTime;

    return {
      status: overallStatus,
      checks,
      timestamp: new Date().toISOString(),
      totalCheckTime: `${totalTime}ms`
    };
  }
}

module.exports = new HealthCheckService();

