require('dotenv').config();
const express = require('express');
const { login, startAllListeners, monitorAuthState } = require('./services/firebase');
const { forwardSignal, testWebhook } = require('./services/forwarder');
const { log, logSignalBox, logStartupBanner } = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Stats tracking
let stats = {
  startTime: new Date(),
  signalsReceived: 0,
  signalsForwarded: 0,
  signalsFailed: 0,
  lastSignal: null
};

/**
 * Handle incoming signal from Firebase
 * @param {Object} signal - Parsed signal from Firestore
 */
async function handleSignal(signal) {
  stats.signalsReceived++;
  stats.lastSignal = signal;

  // Log the signal in a nice format
  logSignalBox(signal);

  // Forward to user's bot
  const result = await forwardSignal(signal);

  if (result.success) {
    stats.signalsForwarded++;
  } else {
    stats.signalsFailed++;
  }
}

// Health check endpoint (Railway needs this)
app.get('/health', (req, res) => {
  const uptime = Math.floor((Date.now() - stats.startTime.getTime()) / 1000);
  res.json({
    status: 'ok',
    uptime: `${uptime}s`,
    signals: {
      received: stats.signalsReceived,
      forwarded: stats.signalsForwarded,
      failed: stats.signalsFailed
    },
    lastSignal: stats.lastSignal ? {
      symbol: stats.lastSignal.symbol,
      action: stats.lastSignal.action,
      time: stats.lastSignal.timestamp
    } : null
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'FoxSignals Listener',
    version: '2.0.0',
    status: 'running',
    endpoints: {
      health: '/health',
      stats: '/stats',
      test: '/test'
    }
  });
});

// Stats endpoint
app.get('/stats', (req, res) => {
  const uptime = Math.floor((Date.now() - stats.startTime.getTime()) / 1000);
  const hours = Math.floor(uptime / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = uptime % 60;

  res.json({
    uptime: `${hours}h ${minutes}m ${seconds}s`,
    startTime: stats.startTime.toISOString(),
    signals: {
      total: stats.signalsReceived,
      forwarded: stats.signalsForwarded,
      failed: stats.signalsFailed,
      successRate: stats.signalsReceived > 0
        ? `${((stats.signalsForwarded / stats.signalsReceived) * 100).toFixed(1)}%`
        : 'N/A'
    },
    lastSignal: stats.lastSignal
  });
});

// Test webhook endpoint
app.post('/test', async (req, res) => {
  log('API', '🧪 Test webhook requested');
  const result = await testWebhook();
  res.json(result);
});

/**
 * Main startup function
 */
async function main() {
  // Show startup banner
  logStartupBanner({
    port: PORT,
    webhookUrl: process.env.BOT_WEBHOOK_URL
  });

  // Check required environment variables
  const email = process.env.FOXSIGNALS_EMAIL;
  const password = process.env.FOXSIGNALS_PASSWORD;

  if (!email || !password) {
    log('ERROR', '❌ FOXSIGNALS_EMAIL and FOXSIGNALS_PASSWORD are required!');
    log('ERROR', '   Set these environment variables in Railway');
    process.exit(1);
  }

  if (!process.env.BOT_WEBHOOK_URL) {
    log('WARN', '⚠️ BOT_WEBHOOK_URL not set - signals will be logged but not forwarded');
  }

  try {
    // Login to Firebase with FoxSignals credentials
    await login(email, password);

    // Monitor auth state
    monitorAuthState();

    // Start listening to all signal collections
    startAllListeners(handleSignal);

    // Start HTTP server
    app.listen(PORT, () => {
      log('SERVER', `✅ HTTP server running on port ${PORT}`);
      log('SERVER', '='.repeat(50));
      log('SERVER', '🦊 FoxSignals Listener is now active!');
      log('SERVER', '   Waiting for signals...');
      log('SERVER', '='.repeat(50));
    });

  } catch (error) {
    log('ERROR', `❌ Startup failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  log('SERVER', '⏹️ Received SIGTERM, shutting down...');
  process.exit(0);
});

process.on('SIGINT', () => {
  log('SERVER', '⏹️ Received SIGINT, shutting down...');
  process.exit(0);
});

// Start the application
main();
