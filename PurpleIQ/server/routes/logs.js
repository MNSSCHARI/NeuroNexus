const express = require('express');
const router = express.Router();
const fs = require('fs-extra');
const path = require('path');
const { logger } = require('../utils/logger');

const logsDir = path.join(__dirname, '../logs');

/**
 * GET /api/logs
 * Get recent logs (admin only)
 * Query params:
 *   - level: error, warn, info, debug (optional)
 *   - service: service name filter (optional)
 *   - limit: number of lines (default: 100, max: 1000)
 *   - file: log file name (default: combined.log)
 */
router.get('/', async (req, res) => {
  try {
    const { level, service, limit = 100, file = 'combined.log' } = req.query;
    const maxLimit = Math.min(parseInt(limit) || 100, 1000);
    
    // Security: Only allow reading log files
    const allowedFiles = ['combined.log', 'error.log', 'application.log'];
    const logFile = allowedFiles.includes(file) ? file : 'combined.log';
    const logFilePath = path.join(logsDir, logFile);
    
    if (!await fs.pathExists(logFilePath)) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Log file not found'
      });
    }
    
    // Read log file
    const logContent = await fs.readFile(logFilePath, 'utf-8');
    const lines = logContent.split('\n').filter(line => line.trim());
    
    // Parse and filter logs
    let parsedLogs = [];
    for (const line of lines.slice(-maxLimit)) {
      try {
        const logEntry = JSON.parse(line);
        
        // Apply filters
        if (level && logEntry.level !== level) continue;
        if (service && logEntry.service !== service) continue;
        
        parsedLogs.push({
          timestamp: logEntry.timestamp,
          level: logEntry.level,
          service: logEntry.service || 'unknown',
          message: logEntry.message,
          function: logEntry.function,
          requestId: logEntry.requestId,
          metadata: logEntry
        });
      } catch (e) {
        // Skip invalid JSON lines
        continue;
      }
    }
    
    // Reverse to show most recent first
    parsedLogs.reverse();
    
    res.json({
      success: true,
      count: parsedLogs.length,
      filters: { level, service, limit: maxLimit, file: logFile },
      logs: parsedLogs
    });
  } catch (error) {
    logger.error('Error reading logs', {
      function: 'getLogs',
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to read logs'
    });
  }
});

/**
 * GET /api/logs/metrics
 * Get logging metrics and statistics
 */
router.get('/metrics', async (req, res) => {
  try {
    const logFiles = ['combined.log', 'error.log'];
    const metrics = {
      totalLogs: 0,
      byLevel: {},
      byService: {},
      recentErrors: 0,
      fileSizes: {}
    };
    
    for (const file of logFiles) {
      const filePath = path.join(logsDir, file);
      if (await fs.pathExists(filePath)) {
        const stats = await fs.stat(filePath);
        metrics.fileSizes[file] = {
          size: stats.size,
          sizeMB: (stats.size / 1024 / 1024).toFixed(2),
          modified: stats.mtime
        };
        
        // Read and analyze file
        const content = await fs.readFile(filePath, 'utf-8');
        const lines = content.split('\n').filter(line => line.trim());
        
        for (const line of lines.slice(-1000)) { // Analyze last 1000 lines
          try {
            const logEntry = JSON.parse(line);
            metrics.totalLogs++;
            
            // Count by level
            metrics.byLevel[logEntry.level] = (metrics.byLevel[logEntry.level] || 0) + 1;
            
            // Count by service
            const svc = logEntry.service || 'unknown';
            metrics.byService[svc] = (metrics.byService[svc] || 0) + 1;
            
            // Count recent errors
            if (logEntry.level === 'error') {
              metrics.recentErrors++;
            }
          } catch (e) {
            continue;
          }
        }
      }
    }
    
    res.json({
      success: true,
      metrics
    });
  } catch (error) {
    logger.error('Error getting log metrics', {
      function: 'getLogMetrics',
      error: error.message
    });
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get log metrics'
    });
  }
});

/**
 * GET /api/logs/performance
 * Get performance metrics from logs
 */
router.get('/performance', async (req, res) => {
  try {
    const filePath = path.join(logsDir, 'combined.log');
    if (!await fs.pathExists(filePath)) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Log file not found'
      });
    }
    
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    
    const performanceData = {
      aiCalls: [],
      apiCalls: [],
      vectorSearches: []
    };
    
    // Analyze last 500 lines for performance data
    for (const line of lines.slice(-500)) {
      try {
        const logEntry = JSON.parse(line);
        
        if (logEntry.message && logEntry.message.includes('AI Call:')) {
          performanceData.aiCalls.push({
            timestamp: logEntry.timestamp,
            provider: logEntry.provider,
            model: logEntry.model,
            duration: logEntry.duration,
            tokens: logEntry.tokens
          });
        } else if (logEntry.message && logEntry.message.includes('API:')) {
          performanceData.apiCalls.push({
            timestamp: logEntry.timestamp,
            method: logEntry.method,
            path: logEntry.path,
            statusCode: logEntry.statusCode,
            duration: logEntry.duration
          });
        } else if (logEntry.message && logEntry.message.includes('Vector Search:')) {
          performanceData.vectorSearches.push({
            timestamp: logEntry.timestamp,
            resultsCount: logEntry.resultsCount,
            topScore: logEntry.topScore,
            duration: logEntry.duration
          });
        }
      } catch (e) {
        continue;
      }
    }
    
    // Calculate averages
    const avgAICallDuration = performanceData.aiCalls.length > 0
      ? performanceData.aiCalls.reduce((sum, call) => {
          const duration = parseInt(call.duration) || 0;
          return sum + duration;
        }, 0) / performanceData.aiCalls.length
      : 0;
    
    const avgAPICallDuration = performanceData.apiCalls.length > 0
      ? performanceData.apiCalls.reduce((sum, call) => {
          const duration = parseInt(call.duration) || 0;
          return sum + duration;
        }, 0) / performanceData.apiCalls.length
      : 0;
    
    res.json({
      success: true,
      summary: {
        aiCalls: performanceData.aiCalls.length,
        apiCalls: performanceData.apiCalls.length,
        vectorSearches: performanceData.vectorSearches.length,
        avgAICallDuration: `${avgAICallDuration.toFixed(2)}ms`,
        avgAPICallDuration: `${avgAPICallDuration.toFixed(2)}ms`
      },
      recent: {
        aiCalls: performanceData.aiCalls.slice(-10),
        apiCalls: performanceData.apiCalls.slice(-10),
        vectorSearches: performanceData.vectorSearches.slice(-10)
      }
    });
  } catch (error) {
    logger.error('Error getting performance metrics', {
      function: 'getPerformanceMetrics',
      error: error.message
    });
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get performance metrics'
    });
  }
});

module.exports = router;

