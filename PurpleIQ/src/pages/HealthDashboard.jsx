import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import './HealthDashboard.css'

/**
 * Health Dashboard Component
 * Displays comprehensive system health status
 */
function HealthDashboard() {
  const navigate = useNavigate()
  const [healthStatus, setHealthStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [lastChecked, setLastChecked] = useState(null)

  useEffect(() => {
    checkHealth()
    
    // Auto-refresh every 30 seconds if enabled
    let interval = null
    if (autoRefresh) {
      interval = setInterval(() => {
        checkHealth()
      }, 30000)
    }
    
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [autoRefresh])

  const checkHealth = async () => {
    setLoading(true)
    try {
      const response = await fetch('http://localhost:5000/api/health')
      const data = await response.json()
      setHealthStatus(data)
      setLastChecked(new Date())
    } catch (error) {
      console.error('Health check error:', error)
      setHealthStatus({
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      })
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'up':
      case 'healthy':
        return '#4CAF50' // Green
      case 'degraded':
        return '#FF9800' // Orange
      case 'down':
      case 'unhealthy':
        return '#F44336' // Red
      default:
        return '#9E9E9E' // Gray
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'up':
      case 'healthy':
        return '✓'
      case 'degraded':
        return '⚠'
      case 'down':
      case 'unhealthy':
        return '✗'
      default:
        return '?'
    }
  }

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Never'
    return new Date(timestamp).toLocaleString()
  }

  return (
    <div className="health-dashboard">
      <div className="health-header">
        <div>
          <h1>System Health Dashboard</h1>
          <p className="subtitle">Comprehensive health monitoring for all system components</p>
        </div>
        <div className="header-actions">
          <button 
            className={`refresh-btn ${loading ? 'loading' : ''}`}
            onClick={checkHealth}
            disabled={loading}
          >
            {loading ? 'Checking...' : '🔄 Refresh'}
          </button>
          <button
            className={`auto-refresh-btn ${autoRefresh ? 'active' : ''}`}
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? '⏸️ Auto-Refresh ON' : '▶️ Auto-Refresh OFF'}
          </button>
          <button 
            className="back-btn"
            onClick={() => navigate('/admin')}
          >
            ← Back to Admin
          </button>
        </div>
      </div>

      {loading && !healthStatus && (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Running health checks...</p>
        </div>
      )}

      {healthStatus && (
        <>
          {/* Overall Status */}
          <div className="overall-status" style={{ 
            backgroundColor: getStatusColor(healthStatus.status),
            color: 'white'
          }}>
            <div className="status-content">
              <div className="status-icon">{getStatusIcon(healthStatus.status)}</div>
              <div>
                <h2>System Status: {healthStatus.status.toUpperCase()}</h2>
                <p>Last checked: {formatTimestamp(healthStatus.timestamp || lastChecked)}</p>
                {healthStatus.totalCheckTime && (
                  <p>Total check time: {healthStatus.totalCheckTime}</p>
                )}
              </div>
            </div>
          </div>

          {/* Individual Checks */}
          <div className="checks-grid">
            {healthStatus.checks && Object.entries(healthStatus.checks).map(([name, check]) => (
              <div key={name} className="check-card">
                <div className="check-header">
                  <h3>{name.charAt(0).toUpperCase() + name.slice(1)}</h3>
                  <span 
                    className="status-badge"
                    style={{ backgroundColor: getStatusColor(check.status) }}
                  >
                    {getStatusIcon(check.status)} {check.status.toUpperCase()}
                  </span>
                </div>
                <div className="check-details">
                  <div className="detail-row">
                    <span className="detail-label">Response Time:</span>
                    <span className="detail-value">{check.responseTime || 'N/A'}</span>
                  </div>
                  {check.error && (
                    <div className="detail-row error">
                      <span className="detail-label">Error:</span>
                      <span className="detail-value">{check.error}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Error Summary */}
          {healthStatus.error && (
            <div className="error-summary">
              <h3>System Error</h3>
              <p>{healthStatus.error}</p>
            </div>
          )}

          {/* Health Summary */}
          <div className="health-summary">
            <h3>Health Summary</h3>
            <div className="summary-stats">
              <div className="stat">
                <span className="stat-value">
                  {healthStatus.checks ? Object.values(healthStatus.checks).filter(c => c.status === 'up').length : 0}
                </span>
                <span className="stat-label">Services Up</span>
              </div>
              <div className="stat">
                <span className="stat-value">
                  {healthStatus.checks ? Object.values(healthStatus.checks).filter(c => c.status === 'degraded').length : 0}
                </span>
                <span className="stat-label">Degraded</span>
              </div>
              <div className="stat">
                <span className="stat-value">
                  {healthStatus.checks ? Object.values(healthStatus.checks).filter(c => c.status === 'down').length : 0}
                </span>
                <span className="stat-label">Down</span>
              </div>
              <div className="stat">
                <span className="stat-value">
                  {healthStatus.checks ? Object.keys(healthStatus.checks).length : 0}
                </span>
                <span className="stat-label">Total Checks</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default HealthDashboard

