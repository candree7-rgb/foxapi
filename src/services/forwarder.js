/**
 * Signal Forwarder Service
 * Forwards parsed signals to the user's bot webhook
 */

const axios = require('axios');
const { log, logForwardResult } = require('../utils/logger');

const RETRY_ATTEMPTS = parseInt(process.env.RETRY_ATTEMPTS || '3');
const RETRY_DELAY = parseInt(process.env.RETRY_DELAY || '1000');

/**
 * Forward a signal to the user's bot
 * @param {Object} signal - Parsed signal object
 * @returns {Object} Result with success status
 */
async function forwardSignal(signal) {
  const webhookUrl = process.env.BOT_WEBHOOK_URL;
  const webhookSecret = process.env.WEBHOOK_SECRET;

  if (!webhookUrl) {
    log('FORWARD', '⚠️ BOT_WEBHOOK_URL not configured - signal not forwarded');
    return { success: false, error: 'Webhook URL not configured' };
  }

  log('FORWARD', `📤 Forwarding signal to: ${webhookUrl}`);
  log('FORWARD', `   Symbol: ${signal.symbol} | Action: ${signal.action}`);

  // Try to send with retries
  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
    try {
      const headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'FoxSignals-Listener/2.0'
      };

      // Add secret if configured
      if (webhookSecret) {
        headers['X-Webhook-Secret'] = webhookSecret;
        headers['Authorization'] = `Bearer ${webhookSecret}`;
      }

      const response = await axios.post(webhookUrl, signal, {
        headers,
        timeout: 10000
      });

      logForwardResult(true, webhookUrl, response.status);

      return {
        success: true,
        statusCode: response.status,
        response: response.data
      };

    } catch (error) {
      log('FORWARD', `❌ Attempt ${attempt}/${RETRY_ATTEMPTS} failed: ${error.message}`);

      if (attempt < RETRY_ATTEMPTS) {
        log('FORWARD', `   Retrying in ${RETRY_DELAY}ms...`);
        await sleep(RETRY_DELAY);
      } else {
        logForwardResult(false, webhookUrl, error.response?.status);
        return {
          success: false,
          error: error.message,
          statusCode: error.response?.status
        };
      }
    }
  }

  return { success: false, error: 'Max retries exceeded' };
}

/**
 * Sleep helper
 * @param {number} ms - Milliseconds to sleep
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Test the webhook connection
 * @returns {Object} Test result
 */
async function testWebhook() {
  const testSignal = {
    id: 'test-signal',
    source: 'foxsignals',
    collection: 'test',
    type: 'test',
    timestamp: new Date().toISOString(),
    symbol: 'BTCUSDT',
    direction: 'long',
    action: 'LONG',
    entry: 50000,
    entryPrice: 50000,
    stopLoss: 49000,
    sl: 49000,
    takeProfit: [51000, 52000, 53000],
    tp1: 51000,
    tp2: 52000,
    tp3: 53000,
    tp4: null,
    tp5: null,
    isFree: true,
    isPremium: false,
    leverage: null
  };

  log('FORWARD', '🧪 Sending test signal...');
  return forwardSignal(testSignal);
}

module.exports = {
  forwardSignal,
  testWebhook
};
