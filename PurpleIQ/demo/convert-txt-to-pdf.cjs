/**
 * Convert TXT PRD files to PDF
 * 
 * Usage: node demo/convert-txt-to-pdf.cjs [filename]
 * Example: node demo/convert-txt-to-pdf.cjs api-integration.txt
 */

const path = require('path');

// Load dependencies from server's node_modules
const serverPath = path.resolve(__dirname, '../server');
const serverNodeModules = path.join(serverPath, 'node_modules');

// Use direct paths to require modules
const fs = require(path.join(serverNodeModules, 'fs-extra'));
const PDFDocument = require(path.join(serverNodeModules, 'pdfkit'));

const DEMO_DIR = path.join(__dirname, 'sample-prds');
const OUTPUT_DIR = path.join(__dirname, 'sample-prds');

async function convertTxtToPdf(txtFileName) {
  const txtPath = path.join(DEMO_DIR, txtFileName);
  const pdfFileName = txtFileName.replace(/\.txt$/, '.pdf');
  const pdfPath = path.join(OUTPUT_DIR, pdfFileName);

  console.log(`Converting ${txtFileName} to PDF...`);

  // Check if file exists
  if (!await fs.pathExists(txtPath)) {
    throw new Error(`File not found: ${txtPath}`);
  }

  // Read text file
  const text = await fs.readFile(txtPath, 'utf-8');

  // Create PDF
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 50, right: 50 }
    });

    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => {
      const buffer = Buffer.concat(chunks);
      fs.writeFile(pdfPath, buffer)
        .then(() => {
          console.log(`✅ PDF created: ${pdfPath}`);
          resolve(pdfPath);
        })
        .catch(reject);
    });
    doc.on('error', reject);

    // Parse and format text
    const lines = text.split('\n');
    let inCodeBlock = false;
    let codeBlockContent = [];

    doc.fontSize(16)
       .font('Helvetica-Bold')
       .text('Product Requirements Document', { align: 'center' });
    
    doc.moveDown(2);

    lines.forEach((line, index) => {
      // Skip empty lines at start
      if (index === 0 && !line.trim()) return;

      // Detect code blocks
      if (line.trim().startsWith('```')) {
        if (inCodeBlock) {
          // End code block
          doc.fontSize(9)
             .font('Courier')
             .text(codeBlockContent.join('\n'), {
               align: 'left',
               indent: 20
             });
          codeBlockContent = [];
          inCodeBlock = false;
          doc.moveDown();
        } else {
          // Start code block
          inCodeBlock = true;
        }
        return;
      }

      if (inCodeBlock) {
        codeBlockContent.push(line);
        return;
      }

      // Handle headings
      if (line.match(/^#+\s+(.+)$/)) {
        const match = line.match(/^#+\s+(.+)$/);
        const headingText = match[1];
        const level = (line.match(/^#+/)[0]).length;

        if (level === 1) {
          doc.fontSize(18)
             .font('Helvetica-Bold')
             .text(headingText, { align: 'left' });
          doc.moveDown();
        } else if (level === 2) {
          doc.fontSize(16)
             .font('Helvetica-Bold')
             .text(headingText, { align: 'left' });
          doc.moveDown(0.5);
        } else if (level === 3) {
          doc.fontSize(14)
             .font('Helvetica-Bold')
             .text(headingText, { align: 'left' });
          doc.moveDown(0.5);
        } else {
          doc.fontSize(12)
             .font('Helvetica-Bold')
             .text(headingText, { align: 'left' });
          doc.moveDown(0.5);
        }
      } else if (line.trim().startsWith('**') && line.trim().endsWith('**')) {
        // Bold text
        const boldText = line.replace(/\*\*/g, '').trim();
        doc.fontSize(11)
           .font('Helvetica-Bold')
           .text(boldText, { align: 'left' });
        doc.moveDown(0.3);
      } else if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        // Bullet points
        const bulletText = line.replace(/^[-*]\s+/, '');
        doc.fontSize(11)
           .font('Helvetica')
           .text(`• ${bulletText}`, { align: 'left', indent: 20 });
        doc.moveDown(0.3);
      } else if (line.trim().match(/^\d+\.\s+/)) {
        // Numbered list
        doc.fontSize(11)
           .font('Helvetica')
           .text(line.trim(), { align: 'left', indent: 20 });
        doc.moveDown(0.3);
      } else if (line.trim().match(/^FR-\d+|^NFR-\d+/)) {
        // Requirements (bold)
        doc.fontSize(11)
           .font('Helvetica-Bold')
           .text(line.trim(), { align: 'left' });
        doc.moveDown(0.3);
      } else if (line.trim()) {
        // Regular text
        doc.fontSize(11)
           .font('Helvetica')
           .text(line.trim(), { align: 'left' });
        doc.moveDown(0.5);
      } else {
        // Empty line
        doc.moveDown(0.3);
      }

      // Add new page if needed
      if (doc.y > doc.page.height - 100) {
        doc.addPage();
      }
    });

    // Footer
    doc.fontSize(8)
       .font('Helvetica')
       .text(
         `Generated by PurpleIQ on ${new Date().toLocaleString()}`,
         doc.page.width / 2,
         doc.page.height - 30,
         { align: 'center' }
       );

    doc.end();
  });
}

async function main() {
  const fileName = process.argv[2] || 'api-integration.txt';
  
  try {
    await fs.ensureDir(OUTPUT_DIR);
    const pdfPath = await convertTxtToPdf(fileName);
    console.log(`\n✅ Success! PDF saved to: ${pdfPath}`);
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    process.exit(1);
  }
}

main();

