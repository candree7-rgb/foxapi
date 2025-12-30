/**
 * Signal Forwarder Service
 * Forwards parsed signals to the user's bot webhook
 */

const axios = require('axios');

const BOT_WEBHOOK_URL = process.env.BOT_WEBHOOK_URL;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const RETRY_ATTEMPTS = parseInt(process.env.RETRY_ATTEMPTS || '3');
const RETRY_DELAY = parseInt(process.env.RETRY_DELAY || '1000');

/**
 * Forward a signal to the user's bot
 * @param {Object} signal - Parsed signal object
 * @returns {Object} Result with success status
 */
async function forwardSignal(signal) {
  if (!BOT_WEBHOOK_URL) {
    console.error('[Forwarder] BOT_WEBHOOK_URL not configured!');
    return { success: false, error: 'Webhook URL not configured' };
  }

  // Format the signal for the bot
  const payload = formatPayload(signal);

  console.log('[Forwarder] Forwarding to:', BOT_WEBHOOK_URL);
  console.log('[Forwarder] Payload:', JSON.stringify(payload, null, 2));

  // Try to send with retries
  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
    try {
      const headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'FoxSignals-Webhook-Listener/1.0'
      };

      // Add secret if configured
      if (WEBHOOK_SECRET) {
        headers['X-Webhook-Secret'] = WEBHOOK_SECRET;
        headers['Authorization'] = `Bearer ${WEBHOOK_SECRET}`;
      }

      const response = await axios.post(BOT_WEBHOOK_URL, payload, {
        headers,
        timeout: 10000
      });

      console.log(`[Forwarder] Success (attempt ${attempt}):`, response.status);

      return {
        success: true,
        statusCode: response.status,
        response: response.data
      };

    } catch (error) {
      console.error(`[Forwarder] Attempt ${attempt} failed:`, error.message);

      if (attempt < RETRY_ATTEMPTS) {
        console.log(`[Forwarder] Retrying in ${RETRY_DELAY}ms...`);
        await sleep(RETRY_DELAY);
      } else {
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
 * Format the signal payload for the bot
 * @param {Object} signal - Parsed signal
 * @returns {Object} Formatted payload
 */
function formatPayload(signal) {
  // Standard format that most bots can understand
  const payload = {
    // Metadata
    source: 'foxsignals',
    timestamp: signal.timestamp,

    // Core signal data
    symbol: signal.symbol,
    action: signal.action,
    side: signal.action === 'LONG' ? 'buy' : signal.action === 'SHORT' ? 'sell' : signal.action.toLowerCase(),

    // Prices
    entry: signal.entry,
    entryPrice: typeof signal.entry === 'object' ? signal.entry.min : signal.entry,

    // Take profits
    takeProfit: signal.takeProfit,
    tp1: signal.takeProfit[0] || null,
    tp2: signal.takeProfit[1] || null,
    tp3: signal.takeProfit[2] || null,
    tp4: signal.takeProfit[3] || null,
    tp5: signal.takeProfit[4] || null,

    // Stop loss
    stopLoss: signal.stopLoss,
    sl: signal.stopLoss,

    // Optional
    leverage: signal.leverage,
    risk: signal.risk,
    notes: signal.notes,

    // Raw data for debugging
    raw: signal.raw
  };

  // Clean up null values if desired
  // Object.keys(payload).forEach(key => payload[key] === null && delete payload[key]);

  return payload;
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
    timestamp: new Date().toISOString(),
    source: 'foxsignals',
    symbol: 'BTCUSDT',
    action: 'LONG',
    entry: 50000,
    takeProfit: [51000, 52000, 53000],
    stopLoss: 49000,
    notes: 'Test signal - please ignore'
  };

  console.log('[Forwarder] Sending test signal...');
  return forwardSignal(testSignal);
}

module.exports = {
  forwardSignal,
  formatPayload,
  testWebhook
};
