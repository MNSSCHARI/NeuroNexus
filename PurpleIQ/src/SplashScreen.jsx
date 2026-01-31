import './SplashScreen.css'

/**
 * SplashScreen Component
 * Displays welcome screen with Continue button
 * Auto-navigates after 30 seconds if button not clicked
 */
function SplashScreen({ onContinue }) {
  return (
    <div className="splash-container">
      <div className="splash-content">
        <h1 className="splash-title">PurpleIQ</h1>
        <p className="splash-subtitle">
          AI-powered QA Assistant for manual and automation testers
        </p>
        <button 
          className="splash-continue-button"
          onClick={onContinue}
        >
          Continue
        </button>
      </div>
    </div>
  )
}

export default SplashScreen

