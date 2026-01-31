const fs = require('fs-extra');
const path = require('path');
const Project = require('../models/Project');

/**
 * Project Storage Service
 * Manages project data persistence
 */
class ProjectStorage {
  constructor() {
    this.storagePath = path.join(__dirname, '../data/projects');
    this.projectsFile = path.join(this.storagePath, 'projects.json');
    this.ensureStorageDirectory();
  }

  ensureStorageDirectory() {
    if (!fs.existsSync(this.storagePath)) {
      fs.mkdirSync(this.storagePath, { recursive: true });
    }
  }

  /**
   * Load all projects and convert to Project instances
   */
  async loadProjects() {
    if (!fs.existsSync(this.projectsFile)) {
      return [];
    }
    const data = await fs.readJson(this.projectsFile);
    const projectsData = data.projects || [];
    
    // Convert plain objects to Project instances
    return projectsData.map(p => {
      // If it's already a Project instance (has toJSON method), return as is
      if (p && typeof p.toJSON === 'function') {
        return p;
      }
      // Otherwise, create a new Project instance
      return new Project(p);
    });
  }

  /**
   * Save projects (convert to plain objects for JSON storage)
   */
  async saveProjects(projects) {
    // Convert Project instances to plain objects for JSON storage
    const projectsData = projects.map(p => {
      if (p instanceof Project) {
        // Extract all properties for storage
        return {
          projectId: p.projectId,
          projectName: p.projectName,
          aiModel: p.aiModel,
          apiKey: p.apiKey,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
          documents: p.documents || []
        };
      }
      return p; // Already a plain object
    });

    await fs.writeJson(this.projectsFile, {
      projects: projectsData,
      updatedAt: new Date().toISOString()
    }, { spaces: 2 });
  }

  /**
   * Create a new project
   */
  async createProject(projectData) {
    const projects = await this.loadProjects();
    const project = new Project(projectData);
    projects.push(project);
    await this.saveProjects(projects);
    return project;
  }

  /**
   * Get project by ID
   */
  async getProject(projectId) {
    const projects = await this.loadProjects();
    const project = projects.find(p => p.projectId === projectId);
    
    // Ensure it's a Project instance
    if (project && typeof project.toJSON !== 'function') {
      return new Project(project);
    }
    
    return project;
  }

  /**
   * Get all projects
   */
  async getAllProjects() {
    return await this.loadProjects();
  }

  /**
   * Update project
   */
  async updateProject(projectId, updates) {
    const projects = await this.loadProjects();
    const index = projects.findIndex(p => p.projectId === projectId);
    
    if (index === -1) {
      throw new Error('Project not found');
    }

    // Get existing project data
    const existingProject = projects[index];
    const projectData = existingProject instanceof Project 
      ? {
          projectId: existingProject.projectId,
          projectName: existingProject.projectName,
          aiModel: existingProject.aiModel,
          apiKey: existingProject.apiKey,
          createdAt: existingProject.createdAt,
          updatedAt: existingProject.updatedAt,
          documents: existingProject.documents || []
        }
      : existingProject;

    // Merge updates and create new Project instance
    const updatedData = {
      ...projectData,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    projects[index] = new Project(updatedData);

    await this.saveProjects(projects);
    return projects[index];
  }

  /**
   * Add document to project
   */
  async addDocumentToProject(projectId, documentMetadata) {
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    if (!project.documents) {
      project.documents = [];
    }

    project.documents.push({
      ...documentMetadata,
      uploadedAt: new Date().toISOString()
    });

    await this.updateProject(projectId, { documents: project.documents });
    return project;
  }

  /**
   * Delete project
   */
  async deleteProject(projectId) {
    const projects = await this.loadProjects();
    const filtered = projects.filter(p => p.projectId !== projectId);
    await this.saveProjects(filtered);
  }
}

module.exports = new ProjectStorage();

