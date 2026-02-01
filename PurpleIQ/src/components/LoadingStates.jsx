import './LoadingStates.css'

/**
 * Animated Spinner Component
 */
export function AnimatedSpinner({ size = 'medium', message = 'Loading...' }) {
  return (
    <div className={`spinner-container spinner-${size}`}>
      <div className="spinner"></div>
      {message && <p className="spinner-message">{message}</p>}
    </div>
  )
}

/**
 * Skeleton Loader Component
 */
export function SkeletonLoader({ lines = 3, width = '100%' }) {
  return (
    <div className="skeleton-container" style={{ width }}>
      {Array.from({ length: lines }).map((_, i) => (
        <div 
          key={i} 
          className="skeleton-line"
          style={{ 
            width: i === lines - 1 ? '80%' : '100%',
            animationDelay: `${i * 0.1}s`
          }}
        />
      ))}
    </div>
  )
}

/**
 * Multi-Step Progress Indicator for AI Generation
 */
export function AIProgressIndicator({ stage, progress, estimatedTime }) {
  const stages = {
    initializing: { icon: '⚙️', message: 'Initializing...', color: '#667eea' },
    loading_context: { icon: '📚', message: 'Loading project context...', color: '#667eea' },
    classifying_intent: { icon: '🎯', message: 'Analyzing your request...', color: '#9c27b0' },
    checking_demo_mode: { icon: '🎬', message: 'Checking demo mode...', color: '#9c27b0' },
    enhancing_context: { icon: '✨', message: 'Enhancing context...', color: '#9c27b0' },
    routing_to_workflow: { icon: '🔄', message: 'Routing to workflow...', color: '#9c27b0' },
    loading_project_info: { icon: '📋', message: 'Loading project information...', color: '#2196F3' },
    generating_test_cases: { icon: '🔍', message: 'Analyzing documents...', color: '#2196F3' },
    formatting_bug_report: { icon: '📝', message: 'Formatting bug report...', color: '#2196F3' },
    creating_test_plan: { icon: '📊', message: 'Creating test plan...', color: '#2196F3' },
    suggesting_automation: { icon: '🤖', message: 'Generating automation suggestions...', color: '#2196F3' },
    answering_question: { icon: '💭', message: 'Generating answer...', color: '#2196F3' },
    test_cases_complete: { icon: '✨', message: 'Generating test cases...', color: '#4CAF50' },
    bug_report_complete: { icon: '✅', message: 'Validating quality...', color: '#4CAF50' },
    test_plan_complete: { icon: '✅', message: 'Finalizing test plan...', color: '#4CAF50' },
    automation_complete: { icon: '✅', message: 'Finalizing suggestions...', color: '#4CAF50' },
    answer_complete: { icon: '✅', message: 'Finalizing answer...', color: '#4CAF50' },
    cache_hit: { icon: '⚡', message: 'Retrieving from cache...', color: '#4CAF50' },
    deduplication: { icon: '⏳', message: 'Request already processing...', color: '#FF9800' },
    complete: { icon: '✅', message: 'Complete!', color: '#4CAF50' }
  }

  const currentStage = stages[stage] || { icon: '⏳', message: 'Processing...', color: '#667eea' }

  return (
    <div className="ai-progress-indicator">
      <div className="progress-header">
        <span className="progress-icon">{currentStage.icon}</span>
        <span className="progress-message">{currentStage.message}</span>
      </div>
      <div className="progress-bar-container">
        <div 
          className="progress-bar-fill"
          style={{ 
            width: `${progress}%`,
            backgroundColor: currentStage.color
          }}
        />
      </div>
      <div className="progress-footer">
        <span className="progress-percentage">{progress}%</span>
        {estimatedTime && (
          <span className="progress-time">~{estimatedTime}s remaining</span>
        )}
      </div>
    </div>
  )
}

/**
 * Success Animation Component
 */
export function SuccessAnimation({ message = 'Success!', showConfetti = false, onComplete }) {
  return (
    <div className="success-animation-container">
      <div className="success-checkmark">
        <svg className="checkmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
          <circle className="checkmark-circle" cx="26" cy="26" r="25" fill="none"/>
          <path className="checkmark-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
        </svg>
      </div>
      {message && <p className="success-message">{message}</p>}
      {showConfetti && <ConfettiEffect />}
    </div>
  )
}

/**
 * Confetti Effect Component
 */
export function ConfettiEffect() {
  return (
    <div className="confetti-container">
      {Array.from({ length: 50 }).map((_, i) => (
        <div
          key={i}
          className="confetti"
          style={{
            left: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 2}s`,
            backgroundColor: ['#667eea', '#764ba2', '#4CAF50', '#FF9800', '#F44336'][Math.floor(Math.random() * 5)]
          }}
        />
      ))}
    </div>
  )
}

/**
 * Error State Component with Retry
 */
export function ErrorState({ 
  message, 
  details, 
  onRetry, 
  retryLabel = 'Retry',
  helpText 
}) {
  return (
    <div className="error-state">
      <div className="error-icon">⚠️</div>
      <h3 className="error-title">Something went wrong</h3>
      <p className="error-message">{message}</p>
      {details && <p className="error-details">{details}</p>}
      {onRetry && (
        <button className="retry-button" onClick={onRetry}>
          {retryLabel}
        </button>
      )}
      {helpText && (
        <p className="error-help">{helpText}</p>
      )}
    </div>
  )
}

/**
 * Project Skeleton Loader
 */
export function ProjectSkeleton() {
  return (
    <div className="project-skeleton">
      <div className="skeleton-header">
        <div className="skeleton-line skeleton-title"></div>
        <div className="skeleton-line skeleton-button"></div>
      </div>
      <div className="skeleton-content">
        <div className="skeleton-line"></div>
        <div className="skeleton-line skeleton-short"></div>
        <div className="skeleton-line"></div>
      </div>
      <div className="skeleton-actions">
        <div className="skeleton-line skeleton-button"></div>
        <div className="skeleton-line skeleton-button"></div>
      </div>
    </div>
  )
}

/**
 * Chat Message Skeleton
 */
export function ChatMessageSkeleton() {
  return (
    <div className="chat-message-skeleton">
      <div className="skeleton-avatar"></div>
      <div className="skeleton-content-wrapper">
        <div className="skeleton-line skeleton-name"></div>
        <div className="skeleton-line"></div>
        <div className="skeleton-line skeleton-short"></div>
      </div>
    </div>
  )
}

