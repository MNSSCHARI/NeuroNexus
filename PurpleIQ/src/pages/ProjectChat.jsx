import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { AnimatedSpinner, AIProgressIndicator, SuccessAnimation, ErrorState, ChatMessageSkeleton, ConfettiEffect } from '../components/LoadingStates'
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
  const [progress, setProgress] = useState({ stage: null, progress: 0 })
  const [showSuccess, setShowSuccess] = useState(false)
  const [estimatedTime, setEstimatedTime] = useState(null)
  const [typingText, setTypingText] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef(null)
  const typingTimeoutRef = useRef(null)

  useEffect(() => {
    if (projectId) {
      loadProject()
    } else {
      setError('No project ID provided')
      setLoadingProject(false)
    }
  }, [projectId])

  // Auto-scroll to bottom when new messages arrive or during typing
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading, typingText])

  // Cleanup typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
    }
  }, [])

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
    setProgress({ stage: 'initializing', progress: 5 })
    setShowSuccess(false)
    setError(null)

    // Add user message to chat
    const newMessages = [...messages, { role: 'user', content: userMessage }]
    setMessages(newMessages)

    // Estimate time based on message length and type
    const isTestCaseRequest = userMessage.toLowerCase().includes('test case') || 
                             userMessage.toLowerCase().includes('generate test')
    const estimatedSeconds = isTestCaseRequest ? 8 : 5
    setEstimatedTime(estimatedSeconds)

    // Simulate progress updates (will be replaced with real progress from backend)
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (!prev.stage) return prev
        const stages = [
          'initializing', 'loading_context', 'classifying_intent', 
          'checking_demo_mode', 'enhancing_context', 'routing_to_workflow',
          'loading_project_info', 'generating_test_cases', 'test_cases_complete'
        ]
        const currentIndex = stages.indexOf(prev.stage)
        if (currentIndex < stages.length - 1 && prev.progress < 90) {
          const nextIndex = Math.min(currentIndex + 1, stages.length - 1)
          return {
            stage: stages[nextIndex],
            progress: Math.min(prev.progress + 10, 90)
          }
        }
        return { ...prev, progress: Math.min(prev.progress + 2, 90) }
      })
    }, 500)

    try {
      const response = await fetch(`http://localhost:5000/api/chat/${projectId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: userMessage, progress: true })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to get answer')
      }

      const data = await response.json()
      
      // Clear progress interval
      clearInterval(progressInterval)
      setProgress({ stage: 'complete', progress: 100 })
      
      // Start typewriter effect
      setLoading(false)
      setIsTyping(true)
      setTypingText('')
      
      // Typewriter effect: display word by word
      const words = data.answer.split(' ')
      let currentIndex = 0
      
      const typeWord = () => {
        if (currentIndex < words.length) {
          setTypingText(prev => {
            const newText = prev + (prev ? ' ' : '') + words[currentIndex]
            return newText
          })
          currentIndex++
          typingTimeoutRef.current = setTimeout(typeWord, 50) // 50ms per word
        } else {
          // Typing complete
          setIsTyping(false)
          setTypingText('')
          
          // Show success animation
          setShowSuccess(true)
          setTimeout(() => setShowSuccess(false), 2000)
          
          // Add complete AI response to chat
          setMessages([
            ...newMessages,
            {
              role: 'assistant',
              content: data.answer,
              sources: data.sources,
              intent: data.intent,
              workflow: data.workflow,
              metadata: data.metadata
            }
          ])
        }
      }
      
      typeWord()
    } catch (error) {
      clearInterval(progressInterval)
      setProgress({ stage: null, progress: 0 })
      setError(error.message)
      setIsTyping(false)
      setTypingText('')
      setMessages([
        ...newMessages,
        {
          role: 'error',
          content: error.message,
          error: error
        }
      ])
      setLoading(false)
      setEstimatedTime(null)
    }
  }

  if (loadingProject) {
    return (
      <div className="project-chat-loading">
        <AnimatedSpinner size="large" message="Loading project..." />
        {error && <p className="error-text">Error: {error}</p>}
      </div>
    )
  }

  if (error && !project) {
    return (
      <div className="project-chat-loading">
        <ErrorState
          message={error}
          onRetry={() => {
            setError(null)
            loadProject()
          }}
          retryLabel="Retry Loading Project"
          helpText="Make sure the server is running on port 5000"
        />
        <button onClick={() => navigate('/admin')} className="back-btn" style={{ marginTop: '1rem' }}>
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
                  {msg.role === 'error' && (
                    <ErrorState
                      message={msg.content}
                      onRetry={() => {
                        // Find last user message
                        const userMessages = messages.filter(m => m.role === 'user')
                        const lastUserMessage = userMessages[userMessages.length - 1]
                        if (lastUserMessage) {
                          setQuestion(lastUserMessage.content)
                          setTimeout(() => {
                            const form = document.querySelector('.chat-input-form')
                            if (form) form.requestSubmit()
                          }, 100)
                        }
                      }}
                      retryLabel="Retry"
                      helpText="Check your connection and try again"
                    />
                  )}
                  {msg.role !== 'error' && (
                    <>
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
                      {msg.metadata && msg.metadata.testCases && (
                        <div className="message-metadata">
                          <strong>Generated {msg.metadata.testCases.length} test cases</strong>
                          {msg.metadata.coverageAnalysis && (
                            <div className="coverage-badge">
                              Positive: {msg.metadata.coverageAnalysis.positive} | 
                              Negative: {msg.metadata.coverageAnalysis.negative} | 
                              Edge Cases: {msg.metadata.coverageAnalysis.edgeCases}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))
          )}
          {loading && progress.stage && (
            <div className="message assistant">
              <div className="message-content">
                <strong>PurpleIQ:</strong>
                <AIProgressIndicator 
                  stage={progress.stage} 
                  progress={progress.progress}
                  estimatedTime={estimatedTime}
                />
              </div>
            </div>
          )}
          {loading && !progress.stage && (
            <div className="message assistant">
              <div className="message-content">
                <strong>PurpleIQ:</strong>
                <ChatMessageSkeleton />
              </div>
            </div>
          )}
          {isTyping && typingText && (
            <div className="message assistant typing-message">
              <div className="message-content">
                <strong>PurpleIQ:</strong>
                <div className="message-text typewriter-text">
                  {typingText}
                  <span className="typing-cursor">|</span>
                </div>
              </div>
            </div>
          )}
          {showSuccess && (
            <div className="success-toast">
              <SuccessAnimation 
                message="Response generated successfully!" 
                showConfetti={messages.length > 0 && messages[messages.length - 1]?.metadata?.testCases}
              />
            </div>
          )}
          <div ref={messagesEndRef} />
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
            {loading ? (
              <>
                <span className="button-spinner"></span>
                Processing...
              </>
            ) : (
              'Send'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}

export default ProjectChat

