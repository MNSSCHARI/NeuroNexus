import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatedSpinner, ProjectSkeleton, SuccessAnimation, ErrorState } from '../components/LoadingStates'
import './AdminPortal.css'

/**
 * Admin Portal Component
 * Manage projects, upload documents, configure AI models
 */
function AdminPortal() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingProjects, setLoadingProjects] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [selectedProject, setSelectedProject] = useState(null)
  const [demoMode, setDemoMode] = useState(false)
  const [demoModeLoading, setDemoModeLoading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(null)
  const [showSuccess, setShowSuccess] = useState(false)
  const [error, setError] = useState(null)
  
  // Form state
  const [formData, setFormData] = useState({
    projectName: '',
    aiModel: 'openai',
    apiKey: ''
  })

  // Load projects and settings on mount
  useEffect(() => {
    loadProjects()
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/settings')
      const data = await response.json()
      setDemoMode(data.demoMode || false)
    } catch (error) {
      console.error('Error loading settings:', error)
    }
  }

  const toggleDemoMode = async () => {
    setDemoModeLoading(true)
    try {
      const response = await fetch('http://localhost:5000/api/settings/demo-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !demoMode })
      })

      if (!response.ok) {
        throw new Error('Failed to toggle demo mode')
      }

      const data = await response.json()
      setDemoMode(data.demoMode)
      alert(`Demo mode ${data.demoMode ? 'enabled' : 'disabled'}`)
    } catch (error) {
      alert(`Error: ${error.message}`)
    } finally {
      setDemoModeLoading(false)
    }
  }

  const loadProjects = async () => {
    try {
      setLoadingProjects(true)
      setError(null)
      const response = await fetch('http://localhost:5000/api/projects')
      if (!response.ok) {
        throw new Error('Failed to load projects')
      }
      const data = await response.json()
      setProjects(data.projects || [])
    } catch (error) {
      console.error('Error loading projects:', error)
      setError(error.message)
    } finally {
      setLoadingProjects(false)
    }
  }

  const handleCreateProject = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

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
      
      // Show success animation
      setShowSuccess(true)
      setTimeout(() => {
        setShowSuccess(false)
      }, 2000)
    } catch (error) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = async (e, projectId) => {
    const file = e.target.files[0]
    if (!file) return

    setLoading(true)
    setError(null)
    setUploadProgress({ fileName: file.name, progress: 0, stage: 'uploading' })
    
    const formData = new FormData()
    formData.append('document', file)

    // Simulate upload progress
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        if (!prev) return prev
        if (prev.progress < 90) {
          return {
            ...prev,
            progress: prev.progress + 10,
            stage: prev.progress < 50 ? 'uploading' : 'processing'
          }
        }
        return prev
      })
    }, 300)

    try {
      console.log(`Uploading document: ${file.name} to project: ${projectId}`)
      const response = await fetch(`http://localhost:5000/api/projects/${projectId}/documents`, {
        method: 'POST',
        body: formData
      })

      clearInterval(progressInterval)
      setUploadProgress(prev => ({ ...prev, progress: 100, stage: 'complete' }))

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
      
      // Show success
      setShowSuccess(true)
      setTimeout(() => {
        setShowSuccess(false)
        setUploadProgress(null)
      }, 2000)
    } catch (error) {
      clearInterval(progressInterval)
      console.error('Upload error:', error)
      setError(error.message)
      setUploadProgress(null)
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
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px',
            padding: '8px 16px',
            backgroundColor: demoMode ? '#4CAF50' : '#f0f0f0',
            borderRadius: '4px',
            cursor: 'pointer'
          }} onClick={toggleDemoMode}>
            <span style={{ fontWeight: 'bold' }}>
              🎬 Demo Mode: {demoMode ? 'ON' : 'OFF'}
            </span>
            {demoModeLoading && <span>...</span>}
          </div>
          <button 
            className="create-project-btn"
            onClick={() => navigate('/health')}
            style={{ backgroundColor: '#2196F3', color: 'white' }}
          >
            🏥 Health Dashboard
          </button>
          <button 
            className="create-project-btn"
            onClick={() => setShowCreateForm(!showCreateForm)}
          >
            {showCreateForm ? 'Cancel' : '+ Create Project'}
          </button>
        </div>
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
              {loading ? (
                <>
                  <span className="button-spinner"></span>
                  Creating...
                </>
              ) : (
                'Create Project'
              )}
            </button>
          </form>
        </div>
      )}

      {/* Success Animation */}
      {showSuccess && (
        <div className="success-overlay">
          <SuccessAnimation 
            message="Operation completed successfully!" 
            showConfetti={true}
          />
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="error-banner">
          <ErrorState
            message={error}
            onRetry={() => {
              setError(null)
              if (uploadProgress) {
                // Retry upload if that's what failed
                const fileInput = document.querySelector('input[type="file"]')
                if (fileInput && fileInput.files[0]) {
                  handleFileUpload({ target: fileInput }, selectedProject || projects[0]?.projectId)
                }
              } else {
                loadProjects()
              }
            }}
            retryLabel="Retry"
          />
        </div>
      )}

      {/* Upload Progress */}
      {uploadProgress && (
        <div className="upload-progress-banner">
          <div className="upload-progress-header">
            <span>📤 {uploadProgress.fileName}</span>
            <span>{uploadProgress.progress}%</span>
          </div>
          <div className="upload-progress-bar">
            <div 
              className="upload-progress-fill"
              style={{ width: `${uploadProgress.progress}%` }}
            />
          </div>
          <div className="upload-progress-stage">
            {uploadProgress.stage === 'uploading' && 'Uploading file...'}
            {uploadProgress.stage === 'processing' && 'Processing and indexing...'}
            {uploadProgress.stage === 'complete' && 'Complete!'}
          </div>
        </div>
      )}

      {/* Projects List */}
      <div className="projects-list">
        <h2>Projects ({projects.length})</h2>
        {loadingProjects ? (
          <div className="projects-grid">
            {[1, 2, 3].map(i => (
              <ProjectSkeleton key={i} />
            ))}
          </div>
        ) : projects.length === 0 ? (
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
                  <label className={`upload-btn ${loading && selectedProject === project.projectId ? 'uploading' : ''}`}>
                    {loading && selectedProject === project.projectId ? (
                      <>
                        <span className="button-spinner"></span>
                        Uploading...
                      </>
                    ) : (
                      'Upload Document'
                    )}
                    <input
                      type="file"
                      accept=".pdf,.docx,.txt"
                      onChange={(e) => {
                        setSelectedProject(project.projectId)
                        handleFileUpload(e, project.projectId)
                      }}
                      style={{ display: 'none' }}
                      disabled={loading}
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

