require('dotenv').config();
const express = require('express');
const {
  loginWithEmail,
  useIdToken,
  setRefreshToken,
  refreshIdToken,
  startPolling,
  startAllListeners,
  monitorAuthState
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
    // Option 1: Use Refresh Token to get fresh ID Token (BEST for Google OAuth)
    if (refreshToken) {
      log('AUTH', '🔄 Refresh token provided - getting fresh ID token...');
      stats.authMode = 'refresh_token';

      // Store the refresh token
      setRefreshToken(refreshToken);

      // Get a fresh ID token immediately
      try {
        await refreshIdToken();
        log('AUTH', '✅ Got fresh ID token via refresh token!');
      } catch (error) {
        log('AUTH', `❌ Failed to refresh token: ${error.message}`);
        log('AUTH', '   Make sure your refresh token is valid');
        process.exit(1);
      }

      // Set up auto-refresh every 55 minutes
      setInterval(async () => {
        try {
          await refreshIdToken();
        } catch (error) {
          log('AUTH', `❌ Auto-refresh failed: ${error.message}`);
        }
      }, 55 * 60 * 1000);

      // Start polling
      startPolling(handleSignal, POLL_INTERVAL);
    }
    // Option 2: Use provided ID Token directly (may be expired!)
    else if (idToken) {
      log('AUTH', '🔑 Using provided ID Token (no refresh token)');
      log('AUTH', '⚠️ WARNING: Token may expire after 1 hour!');
      useIdToken(idToken);
      stats.authMode = 'id_token_only';

      // Start polling
      startPolling(handleSignal, POLL_INTERVAL);
    }
    // Option 3: Email/Password login
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
      log('ERROR', '');
      log('ERROR', '  BEST: FOXSIGNALS_REFRESH_TOKEN (auto-refreshes)');
      log('ERROR', '    OR: FOXSIGNALS_ID_TOKEN (expires after 1h)');
      log('ERROR', '    OR: FOXSIGNALS_EMAIL + FOXSIGNALS_PASSWORD');
      log('ERROR', '');
      process.exit(1);
    }

    // Start HTTP server
    app.listen(PORT, () => {
      log('SERVER', `✅ HTTP server running on port ${PORT}`);
      log('SERVER', '='.repeat(50));
      log('SERVER', '🦊 FoxSignals Listener is now active!');
      log('SERVER', `   Mode: ${stats.authMode === 'email_password' ? 'Realtime (WebSocket)' : 'Polling (REST API)'}`);
      if (stats.authMode !== 'email_password') {
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
