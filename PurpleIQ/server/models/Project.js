/**
 * Project Model
 * Represents a project with its configuration and metadata
 */
class Project {
  constructor(data) {
    this.projectId = data.projectId || require('uuid').v4();
    this.projectName = data.projectName;
    this.aiModel = data.aiModel; // 'openai', 'gemini', 'claude'
    this.apiKey = data.apiKey; // Encrypted/stored securely
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
    this.documents = data.documents || []; // Array of document metadata
  }

  toJSON() {
    return {
      projectId: this.projectId,
      projectName: this.projectName,
      aiModel: this.aiModel,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      documentCount: (this.documents && Array.isArray(this.documents)) ? this.documents.length : 0
      // apiKey is never included in JSON response
    };
  }
}

module.exports = Project;

