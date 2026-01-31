import { useState, useEffect } from 'react'
import SplashScreen from './SplashScreen'
import MainApp from './MainApp'
import './App.css'

/**
 * PurpleIQ - AI QA Assistant
 * Main App component that handles page routing between Splash and Main App
 */
function App() {
  // State to track if splash screen should be shown
  const [showSplash, setShowSplash] = useState(true)

  // Handler for Continue button click
  const handleContinue = () => {
    setShowSplash(false)
  }

  // Effect to handle auto-navigation after 30 seconds
  useEffect(() => {
    // Auto-navigate to main app after 30 seconds if button not clicked
    const timer = setTimeout(() => {
      setShowSplash(false)
    }, 30000) // 30 seconds

    // Cleanup timer on unmount or when splash is hidden
    return () => clearTimeout(timer)
  }, [])

  // Render splash screen or main app based on state
  return (
    <>
      {showSplash && <SplashScreen onContinue={handleContinue} />}
      {!showSplash && <MainApp />}
    </>
  )
}

export default App
