/**
 * Export Service
 * Handles professional exports: Excel, PDF, DOCX
 */

const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType } = require('docx');
const fs = require('fs-extra');
const path = require('path');

// Debug logging helper
function debugLog(step, message, data = {}) {
  const timestamp = new Date().toISOString();
  console.log(`[EXPORT DEBUG ${timestamp}] ${step}: ${message}`);
  if (Object.keys(data).length > 0) {
    console.log(`  Data:`, JSON.stringify(data, null, 2));
  }
}

// Check if dependencies are installed
function checkDependencies() {
  const dependencies = {
    exceljs: false,
    pdfkit: false,
    docx: false
  };
  
  try {
    require.resolve('exceljs');
    dependencies.exceljs = true;
    debugLog('DEPENDENCY_CHECK', 'ExcelJS is installed');
  } catch (e) {
    debugLog('DEPENDENCY_CHECK', 'ExcelJS is NOT installed', { error: e.message });
  }
  
  try {
    require.resolve('pdfkit');
    dependencies.pdfkit = true;
    debugLog('DEPENDENCY_CHECK', 'PDFKit is installed');
  } catch (e) {
    debugLog('DEPENDENCY_CHECK', 'PDFKit is NOT installed', { error: e.message });
  }
  
  try {
    require.resolve('docx');
    dependencies.docx = true;
    debugLog('DEPENDENCY_CHECK', 'docx is installed');
  } catch (e) {
    debugLog('DEPENDENCY_CHECK', 'docx is NOT installed', { error: e.message });
  }
  
  return dependencies;
}

/**
 * Export test cases to Excel with professional styling
 * @param {Array} testCases - Array of test case objects
 * @param {string} projectName - Project name for the file
 * @returns {Promise<Buffer>} Excel file buffer
 */
async function exportTestCasesToExcel(testCases, projectName = 'Project') {
  debugLog('EXCEL_EXPORT', 'Starting Excel export', {
    testCasesCount: testCases?.length || 0,
    projectName
  });
  
  try {
    // Check dependencies
    const deps = checkDependencies();
    if (!deps.exceljs) {
      throw new Error('ExcelJS dependency is not installed. Run: npm install exceljs');
    }
    
    debugLog('EXCEL_EXPORT', 'Dependencies OK, creating workbook');
    const workbook = new ExcelJS.Workbook();
  
  // Create main test cases sheet
  const worksheet = workbook.addWorksheet('Test Cases');
  
  // Define header row
  const headers = [
    'Test ID',
    'Module',
    'Description',
    'Preconditions',
    'Steps',
    'Expected Result',
    'Priority',
    'Type'
  ];
  
  // Add header row with styling
  const headerRow = worksheet.addRow(headers);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4472C4' } // Blue header
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height = 25;
  
  // Add test case data
  testCases.forEach((testCase, index) => {
    const row = worksheet.addRow([
      testCase.testCaseId || `TC_${index + 1}`,
      testCase.module || 'General',
      testCase.description || '',
      Array.isArray(testCase.preconditions) 
        ? testCase.preconditions.join('; ') 
        : (testCase.preconditions || ''),
      Array.isArray(testCase.steps) 
        ? testCase.steps.join('\n') 
        : (testCase.steps || ''),
      testCase.expectedResults || '',
      testCase.priority || 'Medium',
      testCase.type || 'Positive'
    ]);
    
    // Alternate row colors for readability
    if (index % 2 === 0) {
      row.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF2F2F2' } // Light gray
      };
    }
    
    // Wrap text for description, steps, and expected results
    row.getCell(3).alignment = { wrapText: true, vertical: 'top' }; // Description
    row.getCell(4).alignment = { wrapText: true, vertical: 'top' }; // Preconditions
    row.getCell(5).alignment = { wrapText: true, vertical: 'top' }; // Steps
    row.getCell(6).alignment = { wrapText: true, vertical: 'top' }; // Expected Result
  });
  
  // Auto-width columns
  worksheet.columns.forEach((column, index) => {
    if (index === 0) column.width = 15; // Test ID
    else if (index === 1) column.width = 20; // Module
    else if (index === 2) column.width = 40; // Description
    else if (index === 3) column.width = 30; // Preconditions
    else if (index === 4) column.width = 50; // Steps
    else if (index === 5) column.width = 40; // Expected Result
    else if (index === 6) column.width = 12; // Priority
    else if (index === 7) column.width = 15; // Type
  });
  
  // Add auto-filter on header row
  worksheet.autoFilter = {
    from: 'A1',
    to: { row: 1, column: headers.length }
  };
  
  // Freeze header row
  worksheet.views = [
    { state: 'frozen', ySplit: 1 }
  ];
  
  // Create summary sheet
  const summarySheet = workbook.addWorksheet('Summary');
  
  // Add summary statistics
  const totalCount = testCases.length;
  const priorityCounts = {
    High: testCases.filter(tc => tc.priority === 'High').length,
    Medium: testCases.filter(tc => tc.priority === 'Medium').length,
    Low: testCases.filter(tc => tc.priority === 'Low').length
  };
  const typeCounts = {
    Positive: testCases.filter(tc => tc.type === 'Positive' || tc.type?.toLowerCase().includes('positive')).length,
    Negative: testCases.filter(tc => tc.type === 'Negative' || tc.type?.toLowerCase().includes('negative')).length,
    'Edge Case': testCases.filter(tc => tc.type === 'Edge Case' || tc.type?.toLowerCase().includes('edge')).length
  };
  
  // Summary header
  summarySheet.addRow(['Test Cases Summary']);
  summarySheet.getCell('A1').font = { bold: true, size: 16 };
  summarySheet.addRow([]);
  
  // Project info
  summarySheet.addRow(['Project Name', projectName]);
  summarySheet.addRow(['Export Date', new Date().toLocaleDateString()]);
  summarySheet.addRow(['Total Test Cases', totalCount]);
  summarySheet.addRow([]);
  
  // Priority breakdown
  summarySheet.addRow(['Priority Breakdown']);
  summarySheet.getCell('A6').font = { bold: true };
  summarySheet.addRow(['High', priorityCounts.High]);
  summarySheet.addRow(['Medium', priorityCounts.Medium]);
  summarySheet.addRow(['Low', priorityCounts.Low]);
  summarySheet.addRow([]);
  
  // Type breakdown
  summarySheet.addRow(['Type Breakdown']);
  summarySheet.getCell('A11').font = { bold: true };
  summarySheet.addRow(['Positive', typeCounts.Positive]);
  summarySheet.addRow(['Negative', typeCounts.Negative]);
  summarySheet.addRow(['Edge Case', typeCounts['Edge Case']]);
  
  // Add formulas for percentages
  summarySheet.getCell('C7').formula = `=B7/$B$5*100`;
  summarySheet.getCell('C7').numFmt = '0.0%';
  summarySheet.getCell('C8').formula = `=B8/$B$5*100`;
  summarySheet.getCell('C8').numFmt = '0.0%';
  summarySheet.getCell('C9').formula = `=B9/$B$5*100`;
  summarySheet.getCell('C9').numFmt = '0.0%';
  
  // Auto-width summary columns
  summarySheet.columns.forEach(column => {
    column.width = 25;
  });
  
    // Generate buffer
    debugLog('EXCEL_EXPORT', 'Generating Excel buffer');
    const buffer = await workbook.xlsx.writeBuffer();
    const excelBuffer = Buffer.from(buffer);
    
    debugLog('EXCEL_EXPORT', 'Excel export successful', {
      bufferSize: excelBuffer.length,
      bufferType: excelBuffer.constructor.name
    });
    
    return excelBuffer;
  } catch (error) {
    debugLog('EXCEL_EXPORT', 'Excel export FAILED', {
      error: error.message,
      stack: error.stack,
      testCasesCount: testCases?.length || 0
    });
    throw new Error(`Excel export failed: ${error.message}`);
  }
}

/**
 * Export bug report to PDF
 * @param {Object|string} bugReport - Bug report object or markdown string
 * @param {Array} screenshots - Array of screenshot buffers (optional)
 * @returns {Promise<Buffer>} PDF file buffer
 */
async function exportBugReportToPDF(bugReport, screenshots = []) {
  debugLog('PDF_EXPORT', 'Starting PDF export', {
    bugReportType: typeof bugReport,
    screenshotsCount: screenshots?.length || 0
  });
  
  try {
    // Check dependencies
    const deps = checkDependencies();
    if (!deps.pdfkit) {
      throw new Error('PDFKit dependency is not installed. Run: npm install pdfkit');
    }
    
    debugLog('PDF_EXPORT', 'Dependencies OK, creating PDF document');
    
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 50, right: 50 }
    });
    
      const chunks = [];
      
      doc.on('data', chunk => {
        chunks.push(chunk);
        debugLog('PDF_EXPORT', 'PDF chunk generated', { chunkSize: chunk.length });
      });
      
      doc.on('end', () => {
        const buffer = Buffer.concat(chunks);
        debugLog('PDF_EXPORT', 'PDF export successful', {
          bufferSize: buffer.length,
          totalChunks: chunks.length
        });
        resolve(buffer);
      });
      
      doc.on('error', (error) => {
        debugLog('PDF_EXPORT', 'PDF generation error', {
          error: error.message,
          stack: error.stack
        });
        reject(error);
      });
    
    // Parse bug report (handle both object and string)
    let title = '';
    let description = '';
    let steps = [];
    let expected = '';
    let actual = '';
    let environment = '';
    let priority = '';
    
    if (typeof bugReport === 'string') {
      // Parse markdown/string format
      const lines = bugReport.split('\n');
      let currentSection = '';
      
      lines.forEach(line => {
        if (line.match(/^#+\s*(Title|Summary)/i)) {
          currentSection = 'title';
        } else if (line.match(/^#+\s*Description/i)) {
          currentSection = 'description';
        } else if (line.match(/^#+\s*Steps?\s+to\s+Reproduce/i)) {
          currentSection = 'steps';
        } else if (line.match(/^#+\s*Expected/i)) {
          currentSection = 'expected';
        } else if (line.match(/^#+\s*Actual/i)) {
          currentSection = 'actual';
        } else if (line.match(/^#+\s*Environment/i)) {
          currentSection = 'environment';
        } else if (line.match(/^#+\s*Priority/i)) {
          currentSection = 'priority';
        } else if (line.trim() && !line.startsWith('#')) {
          if (currentSection === 'title') title += line.trim() + ' ';
          else if (currentSection === 'description') description += line.trim() + ' ';
          else if (currentSection === 'steps') {
            const stepMatch = line.match(/^\d+\.\s*(.+)/);
            if (stepMatch) steps.push(stepMatch[1]);
          } else if (currentSection === 'expected') expected += line.trim() + ' ';
          else if (currentSection === 'actual') actual += line.trim() + ' ';
          else if (currentSection === 'environment') environment += line.trim() + ' ';
          else if (currentSection === 'priority') priority += line.trim() + ' ';
        }
      });
    } else {
      // Object format
      title = bugReport.title || bugReport.summary || 'Bug Report';
      description = bugReport.description || '';
      steps = Array.isArray(bugReport.steps) ? bugReport.steps : [];
      expected = bugReport.expectedBehavior || bugReport.expected || '';
      actual = bugReport.actualBehavior || bugReport.actual || '';
      environment = bugReport.environment || '';
      priority = bugReport.priority || bugReport.severity || '';
    }
    
    // Header
    doc.fontSize(20)
       .font('Helvetica-Bold')
       .text(title || 'Bug Report', { align: 'center' });
    
    doc.moveDown(2);
    
    // Description
    if (description) {
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .text('Description');
      doc.fontSize(11)
         .font('Helvetica')
         .text(description.trim(), { align: 'left' });
      doc.moveDown();
    }
    
    // Steps to Reproduce
    if (steps.length > 0) {
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .text('Steps to Reproduce');
      steps.forEach((step, index) => {
        doc.fontSize(11)
           .font('Helvetica')
           .text(`${index + 1}. ${step}`, { align: 'left' });
      });
      doc.moveDown();
    }
    
    // Expected Behavior
    if (expected) {
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .text('Expected Behavior');
      doc.fontSize(11)
         .font('Helvetica')
         .text(expected.trim(), { align: 'left' });
      doc.moveDown();
    }
    
    // Actual Behavior
    if (actual) {
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .text('Actual Behavior');
      doc.fontSize(11)
         .font('Helvetica')
         .text(actual.trim(), { align: 'left' });
      doc.moveDown();
    }
    
    // Environment
    if (environment) {
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .text('Environment');
      doc.fontSize(11)
         .font('Helvetica')
         .text(environment.trim(), { align: 'left' });
      doc.moveDown();
    }
    
    // Priority/Severity
    if (priority) {
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .text('Priority/Severity');
      doc.fontSize(11)
         .font('Helvetica')
         .text(priority.trim(), { align: 'left' });
      doc.moveDown();
    }
    
    // Add screenshots if provided
    if (screenshots && screenshots.length > 0) {
      doc.addPage();
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .text('Screenshots');
      doc.moveDown();
      
      screenshots.forEach((screenshot, index) => {
        try {
          doc.image(screenshot, {
            fit: [500, 400],
            align: 'center'
          });
          doc.moveDown();
          doc.fontSize(10)
             .font('Helvetica')
             .text(`Screenshot ${index + 1}`, { align: 'center' });
          doc.moveDown(2);
        } catch (error) {
          console.warn(`Could not add screenshot ${index + 1}:`, error.message);
        }
      });
    }
    
    // Footer
    doc.fontSize(8)
       .font('Helvetica')
       .text(
         `Generated by PurpleIQ on ${new Date().toLocaleString()}`,
         { align: 'center' }
       );
    
      debugLog('PDF_EXPORT', 'Finalizing PDF document');
      doc.end();
    });
  } catch (error) {
    debugLog('PDF_EXPORT', 'PDF export FAILED', {
      error: error.message,
      stack: error.stack
    });
    throw new Error(`PDF export failed: ${error.message}`);
  }
}

/**
 * Export test plan to DOCX
 * @param {Object|string} testPlan - Test plan object or markdown string
 * @param {string} projectName - Project name
 * @returns {Promise<Buffer>} DOCX file buffer
 */
async function exportTestPlanToDocx(testPlan, projectName = 'Project') {
  debugLog('DOCX_EXPORT', 'Starting DOCX export', {
    testPlanType: typeof testPlan,
    projectName
  });
  
  try {
    // Check dependencies
    const deps = checkDependencies();
    if (!deps.docx) {
      throw new Error('docx dependency is not installed. Run: npm install docx');
    }
    
    debugLog('DOCX_EXPORT', 'Dependencies OK, parsing test plan');
    
    // Parse test plan (handle both object and string)
    let sections = {};
  
  if (typeof testPlan === 'string') {
    // Parse markdown/string format
    const lines = testPlan.split('\n');
    let currentSection = '';
    let currentContent = [];
    
    lines.forEach(line => {
      if (line.match(/^#+\s*(Test\s+Objectives?|Objectives?)/i)) {
        if (currentSection) sections[currentSection] = currentContent.join('\n');
        currentSection = 'objectives';
        currentContent = [];
      } else if (line.match(/^#+\s*Scope/i)) {
        if (currentSection) sections[currentSection] = currentContent.join('\n');
        currentSection = 'scope';
        currentContent = [];
      } else if (line.match(/^#+\s*(Test\s+Approach|Approach|Strategy)/i)) {
        if (currentSection) sections[currentSection] = currentContent.join('\n');
        currentSection = 'approach';
        currentContent = [];
      } else if (line.match(/^#+\s*(Test\s+Types?|Types?)/i)) {
        if (currentSection) sections[currentSection] = currentContent.join('\n');
        currentSection = 'types';
        currentContent = [];
      } else if (line.match(/^#+\s*(Environment|Test\s+Environment)/i)) {
        if (currentSection) sections[currentSection] = currentContent.join('\n');
        currentSection = 'environment';
        currentContent = [];
      } else if (line.match(/^#+\s*(Test\s+Data|Data)/i)) {
        if (currentSection) sections[currentSection] = currentContent.join('\n');
        currentSection = 'data';
        currentContent = [];
      } else if (line.match(/^#+\s*(Risk|Risk\s+Assessment)/i)) {
        if (currentSection) sections[currentSection] = currentContent.join('\n');
        currentSection = 'risks';
        currentContent = [];
      } else if (line.match(/^#+\s*(Timeline|Schedule|Estimation)/i)) {
        if (currentSection) sections[currentSection] = currentContent.join('\n');
        currentSection = 'timeline';
        currentContent = [];
      } else if (line.match(/^#+\s*(Resources?|Resource\s+Requirements?)/i)) {
        if (currentSection) sections[currentSection] = currentContent.join('\n');
        currentSection = 'resources';
        currentContent = [];
      } else if (line.match(/^#+\s*(Entry|Exit|Criteria)/i)) {
        if (currentSection) sections[currentSection] = currentContent.join('\n');
        currentSection = 'criteria';
        currentContent = [];
      } else if (line.trim() && !line.startsWith('#')) {
        currentContent.push(line.trim());
      }
    });
    
    if (currentSection) {
      sections[currentSection] = currentContent.join('\n');
    }
  } else {
    // Object format
    sections = {
      objectives: testPlan.objectives || testPlan.testObjectives || '',
      scope: testPlan.scope || '',
      approach: testPlan.approach || testPlan.testApproach || testPlan.strategy || '',
      types: testPlan.types || testPlan.testTypes || '',
      environment: testPlan.environment || testPlan.testEnvironment || '',
      data: testPlan.data || testPlan.testData || '',
      risks: testPlan.risks || testPlan.riskAssessment || '',
      timeline: testPlan.timeline || testPlan.schedule || testPlan.estimation || '',
      resources: testPlan.resources || testPlan.resourceRequirements || '',
      criteria: testPlan.criteria || testPlan.entryExitCriteria || ''
    };
  }
  
  // Build document sections
  const children = [
    // Title
    new Paragraph({
      text: `Test Plan: ${projectName}`,
      heading: HeadingLevel.TITLE,
      spacing: { after: 400 }
    }),
    
    // Table of Contents placeholder
    new Paragraph({
      text: 'Table of Contents',
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 200 }
    }),
    new Paragraph({
      text: '1. Test Objectives\n2. Scope\n3. Test Approach\n4. Test Types\n5. Test Environment\n6. Test Data\n7. Risk Assessment\n8. Timeline\n9. Resources\n10. Entry/Exit Criteria',
      spacing: { after: 400 }
    })
  ];
  
  // Add sections
  const sectionTitles = {
    objectives: 'Test Objectives',
    scope: 'Scope',
    approach: 'Test Approach/Strategy',
    types: 'Test Types',
    environment: 'Test Environment Requirements',
    data: 'Test Data Requirements',
    risks: 'Risk Assessment',
    timeline: 'Timeline/Estimation',
    resources: 'Resource Requirements',
    criteria: 'Entry/Exit Criteria'
  };
  
  Object.keys(sectionTitles).forEach(key => {
    if (sections[key] && sections[key].trim()) {
      children.push(
        new Paragraph({
          text: sectionTitles[key],
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 }
        })
      );
      
      // Split content into paragraphs
      sections[key].split('\n\n').forEach(para => {
        if (para.trim()) {
          children.push(
            new Paragraph({
              text: para.trim(),
              spacing: { after: 200 }
            })
          );
        }
      });
    }
  });
  
  // Create document
  const doc = new Document({
    sections: [{
      properties: {},
      children: children
    }]
  });
  
    debugLog('DOCX_EXPORT', 'Creating DOCX document', {
      sectionsCount: Object.keys(sections).length
    });
    
    // Generate buffer
    debugLog('DOCX_EXPORT', 'Generating DOCX buffer');
    const buffer = await Packer.toBuffer(doc);
    
    debugLog('DOCX_EXPORT', 'DOCX export successful', {
      bufferSize: buffer.length,
      bufferType: buffer.constructor.name
    });
    
    return buffer;
  } catch (error) {
    debugLog('DOCX_EXPORT', 'DOCX export FAILED', {
      error: error.message,
      stack: error.stack
    });
    throw new Error(`DOCX export failed: ${error.message}`);
  }
}

/**
 * Test export functions with minimal test data
 */
async function testExcelExport() {
  debugLog('TEST', 'Testing Excel export with minimal data');
  
  const testData = [
    {
      testCaseId: 'TC_TEST_001',
      module: 'Test Module',
      description: 'Test description',
      preconditions: ['Precondition 1'],
      steps: ['Step 1', 'Step 2'],
      expectedResults: 'Expected result',
      priority: 'High',
      type: 'Positive'
    },
    {
      testCaseId: 'TC_TEST_002',
      module: 'Test Module',
      description: 'Another test',
      preconditions: ['Precondition 2'],
      steps: ['Step 1'],
      expectedResults: 'Another result',
      priority: 'Medium',
      type: 'Negative'
    },
    {
      testCaseId: 'TC_TEST_003',
      module: 'Test Module',
      description: 'Third test',
      preconditions: [],
      steps: ['Step 1', 'Step 2', 'Step 3'],
      expectedResults: 'Third result',
      priority: 'Low',
      type: 'Edge Case'
    }
  ];
  
  try {
    const buffer = await exportTestCasesToExcel(testData, 'TestProject');
    
    // Try to save to file for verification
    const testDir = path.join(__dirname, '../data/test-exports');
    await fs.ensureDir(testDir);
    const testFile = path.join(testDir, `test-excel-${Date.now()}.xlsx`);
    await fs.writeFile(testFile, buffer);
    
    debugLog('TEST', 'Excel test file created', { filePath: testFile, size: buffer.length });
    
    return {
      success: true,
      bufferSize: buffer.length,
      testFile,
      message: 'Excel export test passed'
    };
  } catch (error) {
    debugLog('TEST', 'Excel export test FAILED', { error: error.message });
    return {
      success: false,
      error: error.message,
      stack: error.stack
    };
  }
}

async function testPDFExport() {
  debugLog('TEST', 'Testing PDF export with minimal data');
  
  const testData = {
    title: 'Test Bug Report',
    description: 'This is a test bug report description.',
    steps: [
      'Step 1: Open the application',
      'Step 2: Click the button',
      'Step 3: Observe the issue'
    ],
    expectedBehavior: 'Button should work correctly',
    actualBehavior: 'Button does not respond',
    environment: 'Chrome 120, Windows 11',
    priority: 'High'
  };
  
  try {
    const buffer = await exportBugReportToPDF(testData);
    
    // Try to save to file for verification
    const testDir = path.join(__dirname, '../data/test-exports');
    await fs.ensureDir(testDir);
    const testFile = path.join(testDir, `test-pdf-${Date.now()}.pdf`);
    await fs.writeFile(testFile, buffer);
    
    debugLog('TEST', 'PDF test file created', { filePath: testFile, size: buffer.length });
    
    return {
      success: true,
      bufferSize: buffer.length,
      testFile,
      message: 'PDF export test passed'
    };
  } catch (error) {
    debugLog('TEST', 'PDF export test FAILED', { error: error.message });
    return {
      success: false,
      error: error.message,
      stack: error.stack
    };
  }
}

async function testDocxExport() {
  debugLog('TEST', 'Testing DOCX export with minimal data');
  
  const testData = {
    objectives: 'Test objectives for the test plan',
    scope: 'Test scope description',
    approach: 'Test approach strategy',
    types: 'Unit testing, Integration testing',
    environment: 'Test environment requirements',
    data: 'Test data requirements',
    risks: 'Risk assessment details',
    timeline: 'Timeline and estimation',
    resources: 'Resource requirements',
    criteria: 'Entry and exit criteria'
  };
  
  try {
    const buffer = await exportTestPlanToDocx(testData, 'TestProject');
    
    // Try to save to file for verification
    const testDir = path.join(__dirname, '../data/test-exports');
    await fs.ensureDir(testDir);
    const testFile = path.join(testDir, `test-docx-${Date.now()}.docx`);
    await fs.writeFile(testFile, buffer);
    
    debugLog('TEST', 'DOCX test file created', { filePath: testFile, size: buffer.length });
    
    return {
      success: true,
      bufferSize: buffer.length,
      testFile,
      message: 'DOCX export test passed'
    };
  } catch (error) {
    debugLog('TEST', 'DOCX export test FAILED', { error: error.message });
    return {
      success: false,
      error: error.message,
      stack: error.stack
    };
  }
}

/**
 * Run all export tests
 */
async function testAllExports() {
  debugLog('TEST_ALL', 'Running all export tests');
  
  const results = {
    dependencies: checkDependencies(),
    excel: null,
    pdf: null,
    docx: null
  };
  
  // Test Excel
  try {
    results.excel = await testExcelExport();
  } catch (error) {
    results.excel = { success: false, error: error.message };
  }
  
  // Test PDF
  try {
    results.pdf = await testPDFExport();
  } catch (error) {
    results.pdf = { success: false, error: error.message };
  }
  
  // Test DOCX
  try {
    results.docx = await testDocxExport();
  } catch (error) {
    results.docx = { success: false, error: error.message };
  }
  
  debugLog('TEST_ALL', 'All tests completed', results);
  
  return results;
}

module.exports = {
  exportTestCasesToExcel,
  exportBugReportToPDF,
  exportTestPlanToDocx,
  testExcelExport,
  testPDFExport,
  testDocxExport,
  testAllExports,
  checkDependencies
};

