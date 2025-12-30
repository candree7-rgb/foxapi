require('dotenv').config();
const express = require('express');
const webhookHandler = require('./handlers/webhook');
const { forwardSignal } = require('./services/forwarder');
const { parseSignal } = require('./utils/signalParser');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Main FoxSignals webhook endpoint
app.post('/webhook/foxsignals', async (req, res) => {
  try {
    console.log('[FoxSignals] Incoming webhook:', JSON.stringify(req.body, null, 2));

    // Parse the signal
    const signal = parseSignal(req.body);

    if (!signal) {
      console.log('[FoxSignals] Could not parse signal');
      return res.status(400).json({ error: 'Invalid signal format' });
    }

    console.log('[FoxSignals] Parsed signal:', JSON.stringify(signal, null, 2));

    // Forward to user's bot
    const forwardResult = await forwardSignal(signal);

    if (forwardResult.success) {
      console.log('[FoxSignals] Signal forwarded successfully');
      res.json({ success: true, signal, forwarded: true });
    } else {
      console.error('[FoxSignals] Forward failed:', forwardResult.error);
      res.status(500).json({ success: false, error: 'Failed to forward signal' });
    }
  } catch (error) {
    console.error('[FoxSignals] Error processing webhook:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Alternative endpoint for raw text signals (TradingView style)
app.post('/webhook/foxsignals/text', async (req, res) => {
  try {
    const rawText = typeof req.body === 'string' ? req.body : req.body.message || req.body.text || '';
    console.log('[FoxSignals] Raw text signal:', rawText);

    const signal = parseSignal({ text: rawText });

    if (!signal) {
      return res.status(400).json({ error: 'Could not parse text signal' });
    }

    const forwardResult = await forwardSignal(signal);
    res.json({ success: forwardResult.success, signal });
  } catch (error) {
    console.error('[FoxSignals] Text webhook error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Catch-all for debugging
app.all('*', (req, res) => {
  console.log('[Debug] Unhandled request:', req.method, req.path);
  console.log('[Debug] Body:', req.body);
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
app.listen(PORT, () => {
  console.log('='.repeat(50));
  console.log('FoxSignals Webhook Listener');
  console.log('='.repeat(50));
  console.log(`Server running on port ${PORT}`);
  console.log(`Webhook URL: http://localhost:${PORT}/webhook/foxsignals`);
  console.log(`Forward URL: ${process.env.BOT_WEBHOOK_URL || 'NOT SET'}`);
  console.log('='.repeat(50));
});

module.exports = app;
