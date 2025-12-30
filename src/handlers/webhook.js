/**
 * Webhook Handler
 * Handles incoming webhooks from various sources
 */

const { parseSignal } = require('../utils/signalParser');
const { forwardSignal } = require('../services/forwarder');

/**
 * Handle incoming FoxSignals webhook
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
async function handleFoxSignalsWebhook(req, res) {
  try {
    const startTime = Date.now();

    // Log the incoming request
    console.log('[Webhook] Received FoxSignals webhook');
    console.log('[Webhook] Headers:', JSON.stringify(req.headers, null, 2));
    console.log('[Webhook] Body:', JSON.stringify(req.body, null, 2));

    // Validate the request (optional secret check)
    const isValid = validateRequest(req);
    if (!isValid) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Parse the signal
    const signal = parseSignal(req.body);

    if (!signal) {
      console.log('[Webhook] Failed to parse signal');
      return res.status(400).json({
        error: 'Invalid signal format',
        received: req.body
      });
    }

    // Forward the signal
    const result = await forwardSignal(signal);

    const processingTime = Date.now() - startTime;
    console.log(`[Webhook] Processed in ${processingTime}ms`);

    if (result.success) {
      return res.json({
        success: true,
        message: 'Signal processed and forwarded',
        signal: {
          symbol: signal.symbol,
          action: signal.action,
          entry: signal.entry,
          takeProfit: signal.takeProfit,
          stopLoss: signal.stopLoss
        },
        processingTime
      });
    } else {
      return res.status(500).json({
        success: false,
        error: 'Failed to forward signal',
        details: result.error
      });
    }

  } catch (error) {
    console.error('[Webhook] Error:', error);
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Validate the incoming request
 * @param {Object} req - Express request
 * @returns {boolean} Is valid
 */
function validateRequest(req) {
  const expectedSecret = process.env.FOXSIGNALS_SECRET;

  // If no secret is configured, allow all requests
  if (!expectedSecret) {
    return true;
  }

  // Check various headers for the secret
  const providedSecret =
    req.headers['x-foxsignals-secret'] ||
    req.headers['x-webhook-secret'] ||
    req.headers['authorization']?.replace('Bearer ', '') ||
    req.query.secret;

  if (providedSecret !== expectedSecret) {
    console.log('[Webhook] Invalid secret provided');
    return false;
  }

  return true;
}

/**
 * Handle test/ping webhook
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
function handlePing(req, res) {
  res.json({
    status: 'ok',
    message: 'FoxSignals Webhook Listener is running',
    timestamp: new Date().toISOString(),
    endpoints: {
      webhook: '/webhook/foxsignals',
      text: '/webhook/foxsignals/text',
      health: '/health'
    }
  });
}

module.exports = {
  handleFoxSignalsWebhook,
  handlePing,
  validateRequest
};
