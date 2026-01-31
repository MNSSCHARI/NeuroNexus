import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import './AdminPortal.css'

/**
 * Admin Portal Component
 * Manage projects, upload documents, configure AI models
 */
function AdminPortal() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [selectedProject, setSelectedProject] = useState(null)
  
  // Form state
  const [formData, setFormData] = useState({
    projectName: '',
    aiModel: 'openai',
    apiKey: ''
  })

  // Load projects on mount
  useEffect(() => {
    loadProjects()
  }, [])

  const loadProjects = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/projects')
      const data = await response.json()
      setProjects(data.projects || [])
    } catch (error) {
      console.error('Error loading projects:', error)
    }
  }

  const handleCreateProject = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch('http://localhost:5000/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to create project')
      }

      const data = await response.json()
      setProjects([...projects, data.project])
      setShowCreateForm(false)
      setFormData({ projectName: '', aiModel: 'openai', apiKey: '' })
      alert('Project created successfully!')
    } catch (error) {
      alert(`Error: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = async (e, projectId) => {
    const file = e.target.files[0]
    if (!file) return

    setLoading(true)
    const formData = new FormData()
    formData.append('document', file)

    try {
      console.log(`Uploading document: ${file.name} to project: ${projectId}`)
      const response = await fetch(`http://localhost:5000/api/projects/${projectId}/documents`, {
        method: 'POST',
        body: formData
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Failed to upload document')
      }

      console.log('Document uploaded successfully:', data)
      
      // Update the project in the list with new document count
      if (data.project) {
        setProjects(projects.map(p => 
          p.projectId === projectId ? data.project : p
        ))
      } else {
        // Fallback: reload all projects
        loadProjects()
      }
      
      alert(`Document "${file.name}" uploaded and processed successfully! ${data.document?.chunkCount || 0} chunks created.`)
    } catch (error) {
      console.error('Upload error:', error)
      alert(`Error: ${error.message || 'Failed to upload document. Please check the console for details.'}`)
    } finally {
      setLoading(false)
      e.target.value = '' // Reset file input
    }
  }

  const handleDeleteProject = async (projectId) => {
    if (!confirm('Are you sure you want to delete this project? This will delete all associated documents and vectors.')) {
      return
    }

    try {
      const response = await fetch(`http://localhost:5000/api/projects/${projectId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to delete project')
      }

      setProjects(projects.filter(p => p.projectId !== projectId))
      alert('Project deleted successfully!')
    } catch (error) {
      alert(`Error: ${error.message}`)
    }
  }

  return (
    <div className="admin-portal">
      <div className="admin-header">
        <h1>PurpleIQ Admin Portal</h1>
        <button 
          className="create-project-btn"
          onClick={() => setShowCreateForm(!showCreateForm)}
        >
          {showCreateForm ? 'Cancel' : '+ Create Project'}
        </button>
      </div>

      {/* Create Project Form */}
      {showCreateForm && (
        <div className="create-project-form">
          <h2>Create New Project</h2>
          <form onSubmit={handleCreateProject}>
            <div className="form-group">
              <label>Project Name *</label>
              <input
                type="text"
                value={formData.projectName}
                onChange={(e) => setFormData({ ...formData, projectName: e.target.value })}
                required
                placeholder="Enter project name"
              />
            </div>

            <div className="form-group">
              <label>AI Model *</label>
              <select
                value={formData.aiModel}
                onChange={(e) => setFormData({ ...formData, aiModel: e.target.value })}
                required
              >
                <option value="openai">OpenAI</option>
                <option value="gemini">Google Gemini</option>
                <option value="claude">Claude (Coming Soon)</option>
              </select>
            </div>

            <div className="form-group">
              <label>API Key *</label>
              <input
                type="password"
                value={formData.apiKey}
                onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                required
                placeholder="Enter API key for selected model"
              />
            </div>

            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? 'Creating...' : 'Create Project'}
            </button>
          </form>
        </div>
      )}

      {/* Projects List */}
      <div className="projects-list">
        <h2>Projects ({projects.length})</h2>
        {projects.length === 0 ? (
          <div className="empty-state">
            <p>No projects yet. Create your first project to get started!</p>
          </div>
        ) : (
          <div className="projects-grid">
            {projects.map(project => (
              <div key={project.projectId} className="project-card">
                <div className="project-header">
                  <h3>{project.projectName}</h3>
                  <button
                    className="delete-btn"
                    onClick={() => handleDeleteProject(project.projectId)}
                  >
                    Delete
                  </button>
                </div>
                <div className="project-info">
                  <p><strong>AI Model:</strong> {project.aiModel.toUpperCase()}</p>
                  <p><strong>Documents:</strong> {project.documentCount || 0}</p>
                  <p><strong>Created:</strong> {new Date(project.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="project-actions">
                  <label className="upload-btn">
                    Upload Document
                    <input
                      type="file"
                      accept=".pdf,.docx,.txt"
                      onChange={(e) => handleFileUpload(e, project.projectId)}
                      style={{ display: 'none' }}
                    />
                  </label>
                  <button
                    className="chat-btn"
                    onClick={() => navigate(`/project/${project.projectId}`)}
                  >
                    Open Chat
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default AdminPortal

