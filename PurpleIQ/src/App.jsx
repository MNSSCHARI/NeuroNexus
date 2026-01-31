import { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import SplashScreen from './SplashScreen'
import MainApp from './MainApp'
import AdminPortal from './pages/AdminPortal'
import ProjectChat from './pages/ProjectChat'
import './App.css'

/**
 * PurpleIQ - AI QA Assistant
 * Main App component with routing
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

  // Show splash screen first
  if (showSplash) {
    return <SplashScreen onContinue={handleContinue} />
  }

  // Main routing after splash
  return (
    <Routes>
      <Route path="/" element={<MainApp />} />
      <Route path="/admin" element={<AdminPortal />} />
      <Route path="/project/:projectId" element={<ProjectChat />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
