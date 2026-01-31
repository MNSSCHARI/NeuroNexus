const fs = require('fs-extra');
const pdf = require('pdf-parse');
const mammoth = require('mammoth');
const path = require('path');

/**
 * Document Parser Service
 * Parses PDF, DOCX, and TXT files into text chunks
 */
class DocumentParser {
  /**
   * Split text into chunks with overlap
   */
  chunkText(text, chunkSize = 1000, overlap = 200) {
    if (!text || typeof text !== 'string') {
      return [];
    }

    // Limit text length to prevent array size issues (max 10MB of text)
    const MAX_TEXT_LENGTH = 10 * 1024 * 1024; // 10MB
    if (text.length > MAX_TEXT_LENGTH) {
      console.warn(`Text is very large (${text.length} chars), truncating to ${MAX_TEXT_LENGTH} chars`);
      text = text.substring(0, MAX_TEXT_LENGTH);
    }

    const chunks = [];
    let start = 0;
    const textLength = text.length;
    let iterations = 0;
    const MAX_ITERATIONS = 100000; // Safety limit to prevent infinite loops

    // Ensure overlap is less than chunkSize to prevent infinite loops
    const safeOverlap = Math.min(overlap, Math.floor(chunkSize * 0.5));

    while (start < textLength && iterations < MAX_ITERATIONS) {
      iterations++;
      const end = Math.min(start + chunkSize, textLength);
      const chunk = text.substring(start, end).trim();
      
      if (chunk.length > 0) {
        chunks.push(chunk);
      }

      // Calculate next start position
      const nextStart = end - safeOverlap;
      
      // Safety check: ensure we're making progress
      if (nextStart <= start) {
        // If we're not making progress, advance by at least chunkSize/2
        start = start + Math.floor(chunkSize / 2);
      } else {
        start = nextStart;
      }

      // Final safety check
      if (start >= textLength) {
        break;
      }
    }

    if (iterations >= MAX_ITERATIONS) {
      console.error('Chunking reached max iterations, may have incomplete chunks');
    }

    console.log(`Created ${chunks.length} chunks from ${textLength} characters`);
    return chunks;
  }

  /**
   * Parse PDF file
   */
  async parsePDF(filePath) {
    try {
      const dataBuffer = await fs.readFile(filePath);
      
      // Validate PDF buffer
      if (!dataBuffer || dataBuffer.length === 0) {
        throw new Error('PDF file is empty or invalid');
      }

      // Check if it's actually a PDF by checking the header
      const header = dataBuffer.toString('ascii', 0, 4);
      if (header !== '%PDF') {
        throw new Error('File does not appear to be a valid PDF');
      }

      // Parse PDF without options first (let pdf-parse handle defaults)
      let data;
      try {
        data = await pdf(dataBuffer);
      } catch (parseError) {
        // If parsing fails, try with minimal options
        console.warn('Initial PDF parse failed, trying with options:', parseError.message);
        try {
          data = await pdf(dataBuffer, { max: 10 }); // Limit to first 10 pages
        } catch (retryError) {
          throw new Error(`PDF parsing failed: ${retryError.message}. The PDF may be corrupted or in an unsupported format.`);
        }
      }
      
      // Check if text was extracted
      if (!data || !data.text || data.text.trim().length === 0) {
        throw new Error('PDF contains no extractable text. The PDF might be image-based, encrypted, or contain only images.');
      }

      const chunks = this.chunkText(data.text);
      
      if (chunks.length === 0) {
        throw new Error('No text chunks could be extracted from the PDF');
      }

      console.log(`Successfully parsed PDF: ${chunks.length} chunks created`);
      return chunks;
    } catch (error) {
      console.error('Error parsing PDF:', error);
      // Provide more helpful error messages
      if (error.message && (error.message.includes('Invalid array length') || error.message.includes('array length'))) {
        throw new Error('PDF file format is not supported or corrupted. Please try: 1) Converting the PDF to a different format, 2) Using a DOCX or TXT file instead, or 3) Ensuring the PDF is not password-protected.');
      }
      throw new Error(`Failed to parse PDF: ${error.message}`);
    }
  }

  /**
   * Parse DOCX file
   */
  async parseDOCX(filePath) {
    try {
      const result = await mammoth.extractRawText({ path: filePath });
      return this.chunkText(result.value);
    } catch (error) {
      console.error('Error parsing DOCX:', error);
      throw new Error(`Failed to parse DOCX: ${error.message}`);
    }
  }

  /**
   * Parse TXT file
   */
  async parseTXT(filePath) {
    try {
      const text = await fs.readFile(filePath, 'utf-8');
      return this.chunkText(text);
    } catch (error) {
      console.error('Error parsing TXT:', error);
      throw new Error(`Failed to parse TXT: ${error.message}`);
    }
  }

  /**
   * Parse file based on extension
   */
  async parseFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();

    switch (ext) {
      case '.pdf':
        return await this.parsePDF(filePath);
      case '.docx':
        return await this.parseDOCX(filePath);
      case '.txt':
        return await this.parseTXT(filePath);
      default:
        throw new Error(`Unsupported file type: ${ext}`);
    }
  }
}

module.exports = new DocumentParser();

