const express = require('express');
const router = express.Router();
const exportService = require('../services/ExportService');

/**
 * POST /api/export/excel
 * Export test cases to Excel
 * Body: { testCases: Array, projectName: string }
 */
router.post('/excel', async (req, res) => {
  try {
    const { testCases, projectName } = req.body;

    if (!testCases || !Array.isArray(testCases) || testCases.length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'testCases array is required and must not be empty'
      });
    }

    const buffer = await exportService.exportTestCasesToExcel(
      testCases,
      projectName || 'Project'
    );

    const filename = `TestCases_${projectName || 'Project'}_${Date.now()}.xlsx`
      .replace(/[^a-zA-Z0-9._-]/g, '_');

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);

    res.send(buffer);
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to export test cases to Excel',
      details: error.message
    });
  }
});

/**
 * POST /api/export/pdf
 * Export bug report to PDF
 * Body: { bugReport: Object|string, screenshots?: Array<string> } (screenshots as base64 strings)
 */
router.post('/pdf', async (req, res) => {
  try {
    const { bugReport, screenshots } = req.body;

    if (!bugReport) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'bugReport is required'
      });
    }

    // Convert base64 screenshots to buffers if provided
    let screenshotBuffers = [];
    if (screenshots && Array.isArray(screenshots)) {
      screenshotBuffers = screenshots.map(screenshot => {
        if (Buffer.isBuffer(screenshot)) {
          return screenshot;
        } else if (typeof screenshot === 'string') {
          // Assume base64 string
          return Buffer.from(screenshot, 'base64');
        }
        return null;
      }).filter(Buffer.isBuffer);
    }

    const buffer = await exportService.exportBugReportToPDF(bugReport, screenshotBuffers);

    const filename = `BugReport_${Date.now()}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);

    res.send(buffer);
  } catch (error) {
    console.error('Error exporting to PDF:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to export bug report to PDF',
      details: error.message
    });
  }
});

/**
 * POST /api/export/docx
 * Export test plan to DOCX
 * Body: { testPlan: Object|string, projectName: string }
 */
router.post('/docx', async (req, res) => {
  try {
    const { testPlan, projectName } = req.body;

    if (!testPlan) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'testPlan is required'
      });
    }

    const buffer = await exportService.exportTestPlanToDocx(
      testPlan,
      projectName || 'Project'
    );

    const filename = `TestPlan_${projectName || 'Project'}_${Date.now()}.docx`
      .replace(/[^a-zA-Z0-9._-]/g, '_');

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);

    res.send(buffer);
  } catch (error) {
    console.error('Error exporting to DOCX:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to export test plan to DOCX',
      details: error.message
    });
  }
});

module.exports = router;

