require('dotenv').config();
const express = require('express');
const {
  loginWithEmail,
  useIdToken,
  refreshIdToken,
  startPolling,
  startAllListeners,
  monitorAuthState,
  isAuthenticated
} = require('./services/firebase');
const { forwardSignal, testWebhook } = require('./services/forwarder');
const { log, logSignalBox, logStartupBanner } = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3000;

// Polling interval (default 10 seconds)
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL || '10000');

// Middleware
app.use(express.json());

// Stats tracking
let stats = {
  startTime: new Date(),
  signalsReceived: 0,
  signalsForwarded: 0,
  signalsFailed: 0,
  lastSignal: null,
  authMode: null
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

// Health check endpoint
app.get('/health', (req, res) => {
  const uptime = Math.floor((Date.now() - stats.startTime.getTime()) / 1000);
  res.json({
    status: 'ok',
    uptime: `${uptime}s`,
    authMode: stats.authMode,
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
    authMode: stats.authMode,
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
    authMode: stats.authMode,
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

  // Check authentication options
  const idToken = process.env.FOXSIGNALS_ID_TOKEN;
  const refreshToken = process.env.FOXSIGNALS_REFRESH_TOKEN;
  const email = process.env.FOXSIGNALS_EMAIL;
  const password = process.env.FOXSIGNALS_PASSWORD;

  if (!process.env.BOT_WEBHOOK_URL) {
    log('WARN', '⚠️ BOT_WEBHOOK_URL not set - signals will be logged but not forwarded');
  }

  try {
    // Option 1: JWT/ID Token (for Google OAuth users)
    if (idToken) {
      log('AUTH', '🔑 Using JWT/ID Token authentication');
      useIdToken(idToken);
      stats.authMode = 'jwt_token';

      // If refresh token is available, set up auto-refresh
      if (refreshToken) {
        log('AUTH', '🔄 Refresh token available - will auto-refresh');
        // Refresh every 55 minutes (tokens expire after 1 hour)
        setInterval(async () => {
          try {
            await refreshIdToken(refreshToken);
          } catch (error) {
            log('AUTH', `❌ Auto-refresh failed: ${error.message}`);
          }
        }, 55 * 60 * 1000);
      }

      // Start polling (REST API mode)
      startPolling(handleSignal, POLL_INTERVAL);
    }
    // Option 2: Email/Password login
    else if (email && password) {
      log('AUTH', '📧 Using Email/Password authentication');
      await loginWithEmail(email, password);
      stats.authMode = 'email_password';

      // Monitor auth state
      monitorAuthState();

      // Start realtime listeners
      startAllListeners(handleSignal);
    }
    // No auth provided
    else {
      log('ERROR', '❌ No authentication provided!');
      log('ERROR', '');
      log('ERROR', 'Set one of these in Railway:');
      log('ERROR', '  Option 1 (Google Login): FOXSIGNALS_ID_TOKEN');
      log('ERROR', '  Option 2 (Email Login):  FOXSIGNALS_EMAIL + FOXSIGNALS_PASSWORD');
      log('ERROR', '');
      process.exit(1);
    }

    // Start HTTP server
    app.listen(PORT, () => {
      log('SERVER', `✅ HTTP server running on port ${PORT}`);
      log('SERVER', '='.repeat(50));
      log('SERVER', '🦊 FoxSignals Listener is now active!');
      log('SERVER', `   Mode: ${stats.authMode === 'jwt_token' ? 'Polling (REST API)' : 'Realtime (WebSocket)'}`);
      if (stats.authMode === 'jwt_token') {
        log('SERVER', `   Interval: ${POLL_INTERVAL / 1000} seconds`);
      }
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
