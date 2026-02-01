const express = require('express');
const router = express.Router();
const fs = require('fs-extra');
const path = require('path');

// Settings file path
const SETTINGS_FILE = path.join(__dirname, '../data/settings.json');

/**
 * Ensure settings file exists
 */
async function ensureSettingsFile() {
  const settingsDir = path.dirname(SETTINGS_FILE);
  await fs.ensureDir(settingsDir);
  
  if (!await fs.pathExists(SETTINGS_FILE)) {
    await fs.writeJson(SETTINGS_FILE, {
      demoMode: process.env.DEMO_MODE === 'true',
      updatedAt: new Date().toISOString()
    });
  }
}

/**
 * GET /api/settings
 * Get current settings
 */
router.get('/', async (req, res) => {
  try {
    await ensureSettingsFile();
    const settings = await fs.readJson(SETTINGS_FILE);
    res.json(settings);
  } catch (error) {
    console.error('Error reading settings:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to read settings'
    });
  }
});

/**
 * POST /api/settings/demo-mode
 * Toggle demo mode
 * Body: { enabled: boolean }
 */
router.post('/demo-mode', async (req, res) => {
  try {
    const { enabled } = req.body;
    
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'enabled must be a boolean'
      });
    }

    await ensureSettingsFile();
    const settings = await fs.readJson(SETTINGS_FILE);
    settings.demoMode = enabled;
    settings.updatedAt = new Date().toISOString();
    
    await fs.writeJson(SETTINGS_FILE, settings, { spaces: 2 });
    
    // Update environment variable (for current process)
    process.env.DEMO_MODE = enabled ? 'true' : 'false';
    
    // Update AIService demo mode if it exists
    try {
      const aiService = require('../services/AIService');
      if (aiService && typeof aiService.demoModeEnabled !== 'undefined') {
        aiService.demoModeEnabled = enabled;
      }
    } catch (err) {
      console.warn('Could not update AIService demo mode:', err.message);
    }
    
    console.log(`🎬 Demo mode ${enabled ? 'ENABLED' : 'DISABLED'}`);
    
    res.json({
      success: true,
      demoMode: enabled,
      message: `Demo mode ${enabled ? 'enabled' : 'disabled'}`
    });
  } catch (error) {
    console.error('Error updating demo mode:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update demo mode'
    });
  }
});

module.exports = router;

