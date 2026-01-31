import { useState } from 'react'
import './App.css'

/**
 * PurpleIQ - AI QA Assistant
 * Main App component for generating QA content using AI
 */
function App() {
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
    setIsLoading(true)

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
      
      // Set output
      setOutput(data.output || 'No output received')
      
    } catch (err) {
      console.error('Error generating content:', err)
      setError(err.message || 'Failed to generate content. Please try again.')
      setOutput('')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="app-container">
      {/* Header Section */}
      <header className="app-header">
        <h1 className="app-title">PurpleIQ</h1>
        <p className="app-description">
          AI-powered QA Assistant for manual and automation testers
        </p>
      </header>

      {/* Main Content */}
      <main className="app-main">
        <form onSubmit={handleGenerate} className="generator-form">
          {/* Mode Selection Dropdown */}
          <div className="form-group">
            <label htmlFor="mode-select" className="form-label">
              Select Mode:
            </label>
            <select
              id="mode-select"
              className="mode-select"
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

          {/* Input Textarea */}
          <div className="form-group">
            <label htmlFor="input-textarea" className="form-label">
              Enter your requirement or input:
            </label>
            <textarea
              id="input-textarea"
              className="input-textarea"
              placeholder="Enter your requirement, test scenario, or any QA-related text here..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              rows={12}
              disabled={isLoading}
            />
          </div>

          {/* Generate Button */}
          <button
            type="submit"
            className="generate-button"
            disabled={isLoading || !inputText.trim()}
          >
            {isLoading ? (
              <>
                <span className="spinner"></span>
                Generating...
              </>
            ) : (
              'Generate'
            )}
          </button>
        </form>

        {/* Error Display */}
        {error && (
          <div className="error-message">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Output Section */}
        {output && (
          <div className="output-section">
            <h2 className="output-title">Generated Output:</h2>
            <div className="output-content">
              {output.split('\n').map((line, index) => (
                <p key={index} className="output-line">
                  {line || '\u00A0'}
                </p>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default App
