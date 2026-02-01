const fs = require('fs-extra');
const pdf = require('pdf-parse');
const mammoth = require('mammoth');
const path = require('path');
const embeddingService = require('./EmbeddingService');

/**
 * Document Parser Service
 * Parses PDF, DOCX, and TXT files into text chunks
 */
class DocumentParser {
  /**
   * Split text into chunks with overlap (legacy method - uses intelligent chunking)
   * @deprecated Use intelligentChunkText instead for better quality
   */
  chunkText(text, chunkSize = 1000, overlap = 200) {
    // Use intelligent chunking by default
    return this.intelligentChunkText(text, chunkSize, overlap);
  }

  /**
   * Intelligent chunking: Split text on natural boundaries
   * Uses EmbeddingService's intelligent chunking for better quality
   */
  intelligentChunkText(text, chunkSize = 800, overlap = 100, metadata = {}) {
    if (!text || typeof text !== 'string') {
      return [];
    }

    // Use EmbeddingService's intelligent chunking
    const chunks = embeddingService.intelligentChunk(text, chunkSize, overlap, metadata);
    
    // Return as simple array of strings for backward compatibility
    // But also store full chunk objects if needed
    return chunks.map(c => c.text);
  }

  /**
   * Get intelligent chunks with full metadata
   */
  intelligentChunkWithMetadata(text, chunkSize = 800, overlap = 100, metadata = {}) {
    if (!text || typeof text !== 'string') {
      return [];
    }

    return embeddingService.intelligentChunk(text, chunkSize, overlap, metadata);
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

