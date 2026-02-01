const express = require('express');
const router = express.Router();
const exportService = require('../services/ExportService');

/**
 * POST /api/export/excel
 * Export test cases to Excel
 * Body: { testCases: Array, projectName: string }
 */
router.post('/excel', async (req, res) => {
  const startTime = Date.now();
  console.log('\n[EXPORT ROUTE] Excel export request received');
  console.log(`  Test cases count: ${req.body.testCases?.length || 0}`);
  console.log(`  Project name: ${req.body.projectName || 'Project'}`);
  
  try {
    const { testCases, projectName } = req.body;

    if (!testCases || !Array.isArray(testCases) || testCases.length === 0) {
      console.error('[EXPORT ROUTE] Validation failed: testCases array is empty or missing');
      return res.status(400).json({
        error: 'Bad Request',
        message: 'testCases array is required and must not be empty'
      });
    }

    console.log('[EXPORT ROUTE] Calling exportService.exportTestCasesToExcel');
    const buffer = await exportService.exportTestCasesToExcel(
      testCases,
      projectName || 'Project'
    );

    console.log('[EXPORT ROUTE] Excel buffer generated', {
      bufferSize: buffer.length,
      bufferType: buffer.constructor.name,
      isBuffer: Buffer.isBuffer(buffer)
    });

    const filename = `TestCases_${projectName || 'Project'}_${Date.now()}.xlsx`
      .replace(/[^a-zA-Z0-9._-]/g, '_');

    console.log('[EXPORT ROUTE] Setting response headers', {
      filename,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      contentLength: buffer.length
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);

    console.log('[EXPORT ROUTE] Sending buffer to client');
    res.send(buffer);
    
    const duration = Date.now() - startTime;
    console.log(`[EXPORT ROUTE] Excel export completed successfully in ${duration}ms`);
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[EXPORT ROUTE] Excel export FAILED after ${duration}ms:`, {
      error: error.message,
      stack: error.stack,
      testCasesCount: req.body.testCases?.length || 0
    });
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to export test cases to Excel',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * POST /api/export/pdf
 * Export bug report to PDF
 * Body: { bugReport: Object|string, screenshots?: Array<string> } (screenshots as base64 strings)
 */
router.post('/pdf', async (req, res) => {
  const startTime = Date.now();
  console.log('\n[EXPORT ROUTE] PDF export request received');
  console.log(`  Bug report type: ${typeof req.body.bugReport}`);
  console.log(`  Screenshots count: ${req.body.screenshots?.length || 0}`);
  
  try {
    const { bugReport, screenshots } = req.body;

    if (!bugReport) {
      console.error('[EXPORT ROUTE] Validation failed: bugReport is missing');
      return res.status(400).json({
        error: 'Bad Request',
        message: 'bugReport is required'
      });
    }

    // Convert base64 screenshots to buffers if provided
    let screenshotBuffers = [];
    if (screenshots && Array.isArray(screenshots)) {
      console.log('[EXPORT ROUTE] Processing screenshots', { count: screenshots.length });
      screenshotBuffers = screenshots.map((screenshot, idx) => {
        try {
          if (Buffer.isBuffer(screenshot)) {
            console.log(`[EXPORT ROUTE] Screenshot ${idx + 1}: Already a buffer`);
            return screenshot;
          } else if (typeof screenshot === 'string') {
            console.log(`[EXPORT ROUTE] Screenshot ${idx + 1}: Converting from base64`);
            return Buffer.from(screenshot, 'base64');
          }
          console.warn(`[EXPORT ROUTE] Screenshot ${idx + 1}: Unknown type, skipping`);
          return null;
        } catch (err) {
          console.error(`[EXPORT ROUTE] Error processing screenshot ${idx + 1}:`, err.message);
          return null;
        }
      }).filter(Buffer.isBuffer);
      console.log(`[EXPORT ROUTE] Processed ${screenshotBuffers.length} valid screenshots`);
    }

    console.log('[EXPORT ROUTE] Calling exportService.exportBugReportToPDF');
    const buffer = await exportService.exportBugReportToPDF(bugReport, screenshotBuffers);

    console.log('[EXPORT ROUTE] PDF buffer generated', {
      bufferSize: buffer.length,
      bufferType: buffer.constructor.name,
      isBuffer: Buffer.isBuffer(buffer)
    });

    const filename = `BugReport_${Date.now()}.pdf`;

    console.log('[EXPORT ROUTE] Setting response headers', {
      filename,
      contentType: 'application/pdf',
      contentLength: buffer.length
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);

    console.log('[EXPORT ROUTE] Sending buffer to client');
    res.send(buffer);
    
    const duration = Date.now() - startTime;
    console.log(`[EXPORT ROUTE] PDF export completed successfully in ${duration}ms`);
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[EXPORT ROUTE] PDF export FAILED after ${duration}ms:`, {
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to export bug report to PDF',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * POST /api/export/docx
 * Export test plan to DOCX
 * Body: { testPlan: Object|string, projectName: string }
 */
router.post('/docx', async (req, res) => {
  const startTime = Date.now();
  console.log('\n[EXPORT ROUTE] DOCX export request received');
  console.log(`  Test plan type: ${typeof req.body.testPlan}`);
  console.log(`  Project name: ${req.body.projectName || 'Project'}`);
  
  try {
    const { testPlan, projectName } = req.body;

    if (!testPlan) {
      console.error('[EXPORT ROUTE] Validation failed: testPlan is missing');
      return res.status(400).json({
        error: 'Bad Request',
        message: 'testPlan is required'
      });
    }

    console.log('[EXPORT ROUTE] Calling exportService.exportTestPlanToDocx');
    const buffer = await exportService.exportTestPlanToDocx(
      testPlan,
      projectName || 'Project'
    );

    console.log('[EXPORT ROUTE] DOCX buffer generated', {
      bufferSize: buffer.length,
      bufferType: buffer.constructor.name,
      isBuffer: Buffer.isBuffer(buffer)
    });

    const filename = `TestPlan_${projectName || 'Project'}_${Date.now()}.docx`
      .replace(/[^a-zA-Z0-9._-]/g, '_');

    console.log('[EXPORT ROUTE] Setting response headers', {
      filename,
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      contentLength: buffer.length
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);

    console.log('[EXPORT ROUTE] Sending buffer to client');
    res.send(buffer);
    
    const duration = Date.now() - startTime;
    console.log(`[EXPORT ROUTE] DOCX export completed successfully in ${duration}ms`);
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[EXPORT ROUTE] DOCX export FAILED after ${duration}ms:`, {
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to export test plan to DOCX',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * GET /api/export/test
 * Test all export functions with minimal data
 */
router.get('/test', async (req, res) => {
  try {
    console.log('\n[EXPORT TEST] Running all export tests');
    const results = await exportService.testAllExports();
    
    res.json({
      success: true,
      results,
      message: 'Export tests completed. Check results for details.'
    });
  } catch (error) {
    console.error('[EXPORT TEST] Test execution failed:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to run export tests',
      details: error.message
    });
  }
});

/**
 * GET /api/export/test/excel
 * Test Excel export only
 */
router.get('/test/excel', async (req, res) => {
  try {
    console.log('\n[EXPORT TEST] Testing Excel export');
    const result = await exportService.testExcelExport();
    res.json(result);
  } catch (error) {
    console.error('[EXPORT TEST] Excel test failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

/**
 * GET /api/export/test/pdf
 * Test PDF export only
 */
router.get('/test/pdf', async (req, res) => {
  try {
    console.log('\n[EXPORT TEST] Testing PDF export');
    const result = await exportService.testPDFExport();
    res.json(result);
  } catch (error) {
    console.error('[EXPORT TEST] PDF test failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

/**
 * GET /api/export/test/docx
 * Test DOCX export only
 */
router.get('/test/docx', async (req, res) => {
  try {
    console.log('\n[EXPORT TEST] Testing DOCX export');
    const result = await exportService.testDocxExport();
    res.json(result);
  } catch (error) {
    console.error('[EXPORT TEST] DOCX test failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

/**
 * GET /api/export/dependencies
 * Check if all export dependencies are installed
 */
router.get('/dependencies', async (req, res) => {
  try {
    const dependencies = exportService.checkDependencies();
    const allInstalled = Object.values(dependencies).every(v => v === true);
    
    res.json({
      dependencies,
      allInstalled,
      message: allInstalled 
        ? 'All dependencies are installed' 
        : 'Some dependencies are missing. Check which ones and install them.'
    });
  } catch (error) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

module.exports = router;

