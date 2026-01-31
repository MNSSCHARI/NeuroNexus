import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import './ProjectChat.css'

/**
 * Project Chat Component
 * Chat interface for project-specific AI agent
 */
function ProjectChat() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const [project, setProject] = useState(null)
  const [question, setQuestion] = useState('')
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingProject, setLoadingProject] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (projectId) {
      loadProject()
    } else {
      setError('No project ID provided')
      setLoadingProject(false)
    }
  }, [projectId])

  const loadProject = async () => {
    try {
      setLoadingProject(true)
      setError(null)
      
      console.log('Loading project:', projectId)
      const apiUrl = `http://localhost:5000/api/projects/${projectId}`
      console.log('Fetching from:', apiUrl)
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      
      console.log('Response status:', response.status)
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('Error response:', errorData)
        throw new Error(errorData.message || errorData.error || `HTTP ${response.status}: Project not found`)
      }
      
      const data = await response.json()
      console.log('Project data received:', data)
      
      if (!data.project) {
        throw new Error('Project data not found in response')
      }
      
      setProject(data.project)
      console.log('Project loaded successfully:', data.project.projectName)
    } catch (error) {
      console.error('Error loading project:', error)
      setError(error.message || 'Failed to load project. Make sure the server is running on port 5000.')
    } finally {
      setLoadingProject(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!question.trim() || loading) return

    const userMessage = question.trim()
    setQuestion('')
    setLoading(true)

    // Add user message to chat
    const newMessages = [...messages, { role: 'user', content: userMessage }]
    setMessages(newMessages)

    try {
      const response = await fetch(`http://localhost:5000/api/chat/${projectId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: userMessage })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to get answer')
      }

      const data = await response.json()
      
      // Add AI response to chat
      setMessages([
        ...newMessages,
        {
          role: 'assistant',
          content: data.answer,
          sources: data.sources
        }
      ])
    } catch (error) {
      setMessages([
        ...newMessages,
        {
          role: 'error',
          content: `Error: ${error.message}`
        }
      ])
    } finally {
      setLoading(false)
    }
  }

  if (loadingProject) {
    return (
      <div className="project-chat-loading">
        <p>Loading project...</p>
        {error && <p className="error-text">Error: {error}</p>}
      </div>
    )
  }

  if (error && !project) {
    return (
      <div className="project-chat-loading">
        <p className="error-text">Error: {error}</p>
        <p>Redirecting to admin portal...</p>
        <button onClick={() => navigate('/admin')} className="back-btn">
          Go to Admin Portal
        </button>
      </div>
    )
  }

  return (
    <div className="project-chat">
      <div className="chat-header">
        <div>
          <h1>PurpleIQ</h1>
          <p className="project-name">{project?.projectName}</p>
        </div>
        <button 
          className="back-btn"
          onClick={() => navigate('/admin')}
        >
          ← Back to Admin
        </button>
      </div>

      <div className="chat-container">
        <div className="messages-container">
          {messages.length === 0 ? (
            <div className="empty-chat">
              <p>Ask questions about your project documents...</p>
              <p className="hint">The AI will answer based only on the documents uploaded for this project.</p>
            </div>
          ) : (
            messages.map((msg, index) => (
              <div key={index} className={`message ${msg.role}`}>
                <div className="message-content">
                  {msg.role === 'user' && <strong>You:</strong>}
                  {msg.role === 'assistant' && <strong>PurpleIQ:</strong>}
                  {msg.role === 'error' && <strong>Error:</strong>}
                  <div className="message-text">{msg.content}</div>
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="message-sources">
                      <strong>Sources:</strong>
                      <ul>
                        {msg.sources.map((source, i) => (
                          <li key={i}>
                            {source.documentName} (similarity: {source.similarity})
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          {loading && (
            <div className="message assistant">
              <div className="message-content">
                <strong>PurpleIQ:</strong>
                <div className="loading-dots">Thinking...</div>
              </div>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="chat-input-form">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask a question about your project..."
            disabled={loading}
            className="chat-input"
          />
          <button 
            type="submit" 
            disabled={loading || !question.trim()}
            className="send-btn"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  )
}

export default ProjectChat

