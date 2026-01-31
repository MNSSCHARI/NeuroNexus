import { useState } from 'react'
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
    <div className="main-app-container">
      {/* Fixed Header - Top Left */}
      <header className="main-app-header">
        <h1 className="main-app-title">PurpleIQ</h1>
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
            <h2 className="main-output-title">Generated Output</h2>
            <div className="main-output-content">
              {output ? (
                output.split('\n').map((line, index) => (
                  <p key={index} className="main-output-line">
                    {line || '\u00A0'}
                  </p>
                ))
              ) : (
                <div className="main-output-placeholder">
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

