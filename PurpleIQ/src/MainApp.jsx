import { useState, useEffect, useRef } from 'react'
import './MainApp.css'

/**
 * MainApp Component
 * Contains the main PurpleIQ application interface
 */
function MainApp() {
  // State for selected mode
  const [mode, setMode] = useState('testcases')
  
  // State for user input text
  const [inputText, setInputText] = useState('')
  
  // State for AI-generated output
  const [output, setOutput] = useState('')
  
  // State for loading indicator
  const [isLoading, setIsLoading] = useState(false)
  
  // State for error messages
  const [error, setError] = useState('')
  
  // State for selected output format
  const [outputFormat, setOutputFormat] = useState('')
  
  // State for typewriter effect
  const [displayedOutput, setDisplayedOutput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const typingTimeoutRef = useRef(null)
  const outputEndRef = useRef(null)

  // Auto-scroll to bottom during typing
  useEffect(() => {
    outputEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [displayedOutput])

  // Cleanup typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
    }
  }, [])

  /**
   * Handle form submission
   * Sends POST request to backend API
   */
  const handleGenerate = async (e) => {
    e.preventDefault()
    
    // Validation
    if (!inputText.trim()) {
      setError('Please enter some text to generate content')
      return
    }

    // Reset states
    setError('')
    setOutput('')
    setDisplayedOutput('')
    setIsTyping(false)
    setIsLoading(true)
    
    // Clear any existing typing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    try {
      // Map UI mode labels to API mode values
      const modeMap = {
        'testcases': 'testcases',
        'automation': 'automation',
        'analysis': 'analysis',
        'summary': 'summary'
      }

      const apiMode = modeMap[mode] || 'testcases'

      // Make API request
      const response = await fetch('http://localhost:5000/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputText: inputText.trim(),
          mode: apiMode
        })
      })

      // Check if response is ok
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`)
      }

      // Parse response
      const data = await response.json()
      const fullOutput = data.output || 'No output received'
      
      // Stop loading, start typing effect
      setIsLoading(false)
      setOutput(fullOutput)
      setIsTyping(true)
      setDisplayedOutput('')
      
      // Typewriter effect: display word by word
      const words = fullOutput.split(' ')
      let currentIndex = 0
      
      const typeWord = () => {
        if (currentIndex < words.length) {
          setDisplayedOutput(prev => {
            const newText = prev + (prev ? ' ' : '') + words[currentIndex]
            return newText
          })
          currentIndex++
          typingTimeoutRef.current = setTimeout(typeWord, 30) // 30ms per word for faster typing
        } else {
          // Typing complete
          setIsTyping(false)
        }
      }
      
      typeWord()
      
    } catch (err) {
      console.error('Error generating content:', err)
      setError(err.message || 'Failed to generate content. Please try again.')
      setOutput('')
      setDisplayedOutput('')
      setIsTyping(false)
      setIsLoading(false)
    }
  }

  return (
    <div className="main-app-container">
      {/* Fixed Header - Top Left */}
      <header className="main-app-header">
        <h1 className="main-app-title">PurpleIQ</h1>
        <a href="/admin" className="admin-link">Admin Portal</a>
      </header>

      {/* Main Content - Two Column Layout */}
      <main className="main-app-content">
        {/* Left Column - Input Form */}
        <div className="main-left-panel">
          <form onSubmit={handleGenerate} className="main-generator-form">
            {/* Input Textarea */}
            <div className="main-form-group">
              <label htmlFor="input-textarea" className="main-form-label">
                Enter your requirement or input:
              </label>
              <textarea
                id="input-textarea"
                className="main-input-textarea"
                placeholder="Enter your requirement, test scenario, or any QA-related text here..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                disabled={isLoading}
              />
            </div>

            {/* Mode Selection Dropdown */}
            <div className="main-form-group">
              <label htmlFor="mode-select" className="main-form-label">
                Select Mode:
              </label>
              <select
                id="mode-select"
                className="main-mode-select"
                value={mode}
                onChange={(e) => setMode(e.target.value)}
                disabled={isLoading}
              >
                <option value="testcases">Generate Test Cases</option>
                <option value="automation">Automation Suggestions</option>
                <option value="analysis">Requirement Analysis</option>
                <option value="summary">QA Summary</option>
              </select>
            </div>

            {/* Output Format Options - Rounded Buttons */}
            <div className="main-form-group">
              <label className="main-form-label">Export Format:</label>
              <div className="main-output-format-buttons">
                <button
                  type="button"
                  className={`main-format-button ${outputFormat === 'pdf' ? 'active' : ''}`}
                  onClick={() => setOutputFormat(outputFormat === 'pdf' ? '' : 'pdf')}
                  disabled={isLoading}
                >
                  PDF
                </button>
                <button
                  type="button"
                  className={`main-format-button ${outputFormat === 'excel' ? 'active' : ''}`}
                  onClick={() => setOutputFormat(outputFormat === 'excel' ? '' : 'excel')}
                  disabled={isLoading}
                >
                  Excel
                </button>
                <button
                  type="button"
                  className={`main-format-button ${outputFormat === 'docx' ? 'active' : ''}`}
                  onClick={() => setOutputFormat(outputFormat === 'docx' ? '' : 'docx')}
                  disabled={isLoading}
                >
                  DOCX
                </button>
                <button
                  type="button"
                  className={`main-format-button ${outputFormat === 'csv' ? 'active' : ''}`}
                  onClick={() => setOutputFormat(outputFormat === 'csv' ? '' : 'csv')}
                  disabled={isLoading}
                >
                  CSV
                </button>
              </div>
            </div>

            {/* Generate Button */}
            <button
              type="submit"
              className="main-generate-button"
              disabled={isLoading || !inputText.trim()}
            >
              {isLoading ? (
                <>
                  <span className="main-spinner"></span>
                  Generating...
                </>
              ) : (
                'Generate'
              )}
            </button>
          </form>

          {/* Error Display */}
          {error && (
            <div className="main-error-message">
              <strong>Error:</strong> {error}
            </div>
          )}
        </div>

        {/* Right Column - Output Section */}
        <div className="main-right-panel">
          <div className="main-output-section">
            <h2 className="main-output-title">
              Generated Output
              {isLoading && <span className="main-generating-badge">Generating...</span>}
              {isTyping && <span className="main-typing-badge">✨ AI Writing...</span>}
            </h2>
            <div className="main-output-content">
              {isLoading ? (
                <div className="main-loading-state">
                  <div className="main-loading-spinner"></div>
                  <p className="main-loading-text">AI is thinking and generating your content...</p>
                  <p className="main-loading-hint">This may take a few moments</p>
                </div>
              ) : displayedOutput || output ? (
                <div className="main-formatted-output">
                  {(displayedOutput || output).split('\n').map((line, index) => {
                    // Format markdown-style content
                    if (line.startsWith('###')) {
                      return <h3 key={index} className="output-h3">{line.replace(/^###\s*/, '')}</h3>
                    } else if (line.startsWith('##')) {
                      return <h2 key={index} className="output-h2">{line.replace(/^##\s*/, '')}</h2>
                    } else if (line.startsWith('#')) {
                      return <h1 key={index} className="output-h1">{line.replace(/^#\s*/, '')}</h1>
                    } else if (line.startsWith('**') && line.endsWith('**')) {
                      return <p key={index} className="output-bold">{line.replace(/\*\*/g, '')}</p>
                    } else if (line.startsWith('- ') || line.startsWith('* ')) {
                      return <li key={index} className="output-list-item">{line.replace(/^[-*]\s*/, '')}</li>
                    } else if (line.match(/^\d+\./)) {
                      return <li key={index} className="output-numbered-item">{line.replace(/^\d+\.\s*/, '')}</li>
                    } else if (line.startsWith('---')) {
                      return <hr key={index} className="output-divider" />
                    } else if (line.trim() === '') {
                      return <div key={index} className="output-spacer"></div>
                    } else {
                      // Format inline bold text **text**
                      const formattedLine = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                      return (
                        <p key={index} className="main-output-line" dangerouslySetInnerHTML={{ __html: formattedLine }} />
                      )
                    }
                  })}
                  {isTyping && <span className="typing-cursor-blink">|</span>}
                  <div ref={outputEndRef} />
                </div>
              ) : (
                <div className="main-output-placeholder">
                  <div className="placeholder-icon">✨</div>
                  <p>Your generated content will appear here...</p>
                  <p className="main-placeholder-hint">Select a mode, enter your input, and click Generate to get started.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default MainApp

