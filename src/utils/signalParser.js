/**
 * FoxSignals Signal Parser
 * Parses trading signals and extracts Entry, Take Profits, and Stop Loss
 */

/**
 * Parse a signal from various formats
 * @param {Object} data - Raw signal data
 * @returns {Object|null} Parsed signal or null if invalid
 */
function parseSignal(data) {
  // If data has a text field, parse it as text
  if (data.text || data.message) {
    return parseTextSignal(data.text || data.message);
  }

  // If data already has structured fields, normalize them
  if (data.symbol || data.pair || data.coin) {
    return parseStructuredSignal(data);
  }

  // Try to parse as text if it's a string
  if (typeof data === 'string') {
    return parseTextSignal(data);
  }

  // Check for common FoxSignals format
  if (data.action || data.type || data.signal) {
    return parseStructuredSignal(data);
  }

  return null;
}

/**
 * Parse structured JSON signal
 * @param {Object} data - Structured signal data
 * @returns {Object} Normalized signal
 */
function parseStructuredSignal(data) {
  const signal = {
    timestamp: new Date().toISOString(),
    source: 'foxsignals',
    raw: data,

    // Symbol/Pair
    symbol: normalizeSymbol(data.symbol || data.pair || data.coin || data.ticker || ''),

    // Action type
    action: normalizeAction(data.action || data.type || data.signal || data.side || ''),

    // Entry price(s)
    entry: parsePrice(data.entry || data.entryPrice || data.entry_price || data.price),

    // Take profit levels
    takeProfit: parseTakeProfits(data),

    // Stop loss
    stopLoss: parsePrice(data.stopLoss || data.stop_loss || data.sl || data.stoploss),

    // Optional fields
    leverage: data.leverage || data.lev || null,
    risk: data.risk || data.riskPercent || null,
    notes: data.notes || data.comment || data.message || null
  };

  // Validate minimum required fields
  if (!signal.symbol || !signal.action) {
    console.log('[Parser] Missing required fields (symbol or action)');
    return null;
  }

  return signal;
}

/**
 * Parse text-based signal (Telegram/Discord style)
 * @param {string} text - Raw text signal
 * @returns {Object|null} Parsed signal or null
 */
function parseTextSignal(text) {
  if (!text || typeof text !== 'string') return null;

  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  const fullText = text.toUpperCase();

  const signal = {
    timestamp: new Date().toISOString(),
    source: 'foxsignals',
    raw: text,
    symbol: null,
    action: null,
    entry: null,
    takeProfit: [],
    stopLoss: null,
    leverage: null,
    risk: null,
    notes: null
  };

  // Detect action (LONG/SHORT/BUY/SELL)
  if (fullText.includes('LONG') || fullText.includes('BUY')) {
    signal.action = 'LONG';
  } else if (fullText.includes('SHORT') || fullText.includes('SELL')) {
    signal.action = 'SHORT';
  }

  // Parse each line
  for (const line of lines) {
    const upperLine = line.toUpperCase();

    // Symbol detection (common patterns)
    const symbolMatch = line.match(/([A-Z]{2,10})(USDT|USD|BUSD|PERP)?/i);
    if (symbolMatch && !signal.symbol) {
      // Check if it looks like a trading pair
      if (upperLine.includes('USDT') || upperLine.includes('PERP') ||
          upperLine.includes('USD') || upperLine.match(/^#?[A-Z]{2,6}$/)) {
        signal.symbol = normalizeSymbol(symbolMatch[0]);
      }
    }

    // Entry price
    if (upperLine.includes('ENTRY') || upperLine.includes('EINTRITT') || upperLine.includes('ENTER')) {
      const prices = extractPrices(line);
      if (prices.length > 0) {
        signal.entry = prices.length === 1 ? prices[0] : { min: Math.min(...prices), max: Math.max(...prices) };
      }
    }

    // Take profit levels
    if (upperLine.includes('TP') || upperLine.includes('TAKE') || upperLine.includes('TARGET') || upperLine.includes('ZIEL')) {
      const prices = extractPrices(line);
      const tpMatch = upperLine.match(/TP\s*(\d)/);
      if (tpMatch && prices.length > 0) {
        const tpLevel = parseInt(tpMatch[1]);
        signal.takeProfit[tpLevel - 1] = prices[0];
      } else if (prices.length > 0) {
        signal.takeProfit.push(...prices);
      }
    }

    // Stop loss
    if (upperLine.includes('SL') || upperLine.includes('STOP') || upperLine.includes('STOPLOSS')) {
      const prices = extractPrices(line);
      if (prices.length > 0) {
        signal.stopLoss = prices[0];
      }
    }

    // Leverage
    const leverageMatch = line.match(/(\d+)[xX]\s*(leverage)?/i) || line.match(/leverage[:\s]*(\d+)/i);
    if (leverageMatch) {
      signal.leverage = parseInt(leverageMatch[1]);
    }
  }

  // Validate
  if (!signal.symbol && !signal.action) {
    return null;
  }

  // Clean up takeProfit array
  signal.takeProfit = signal.takeProfit.filter(tp => tp !== undefined && tp !== null);

  return signal;
}

/**
 * Extract price values from a string
 * @param {string} text - Text containing prices
 * @returns {number[]} Array of prices
 */
function extractPrices(text) {
  const prices = [];
  // Match numbers with optional decimals (e.g., 1.2345, 42000, 0.00001234)
  const matches = text.match(/\d+\.?\d*/g);
  if (matches) {
    for (const match of matches) {
      const num = parseFloat(match);
      if (!isNaN(num) && num > 0) {
        prices.push(num);
      }
    }
  }
  return prices;
}

/**
 * Parse take profit levels from structured data
 * @param {Object} data - Signal data
 * @returns {number[]} Array of take profit prices
 */
function parseTakeProfits(data) {
  const tps = [];

  // Check for tp array
  if (Array.isArray(data.takeProfit || data.tp || data.takeProfits || data.targets)) {
    return (data.takeProfit || data.tp || data.takeProfits || data.targets).map(parsePrice).filter(p => p !== null);
  }

  // Check for individual TP fields (tp1, tp2, tp3, etc.)
  for (let i = 1; i <= 10; i++) {
    const tp = data[`tp${i}`] || data[`TP${i}`] || data[`takeProfit${i}`] || data[`target${i}`];
    if (tp !== undefined && tp !== null) {
      const price = parsePrice(tp);
      if (price !== null) {
        tps.push(price);
      }
    }
  }

  // Check for single tp field
  if (tps.length === 0 && (data.tp || data.takeProfit || data.target)) {
    const price = parsePrice(data.tp || data.takeProfit || data.target);
    if (price !== null) {
      tps.push(price);
    }
  }

  return tps;
}

/**
 * Parse a price value
 * @param {any} value - Price value (string or number)
 * @returns {number|null} Parsed price or null
 */
function parsePrice(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const num = parseFloat(value.replace(/[^0-9.]/g, ''));
    return isNaN(num) ? null : num;
  }
  return null;
}

/**
 * Normalize symbol to standard format
 * @param {string} symbol - Raw symbol
 * @returns {string} Normalized symbol
 */
function normalizeSymbol(symbol) {
  if (!symbol) return '';
  return symbol
    .toUpperCase()
    .replace(/[#$]/g, '')
    .replace(/\s/g, '')
    .replace(/PERP$/i, '')
    .trim();
}

/**
 * Normalize action to LONG/SHORT
 * @param {string} action - Raw action
 * @returns {string} Normalized action
 */
function normalizeAction(action) {
  if (!action) return '';
  const upper = action.toUpperCase().trim();
  if (['LONG', 'BUY', 'KAUFEN', 'OPEN_LONG'].includes(upper)) return 'LONG';
  if (['SHORT', 'SELL', 'VERKAUFEN', 'OPEN_SHORT'].includes(upper)) return 'SHORT';
  if (['CLOSE', 'EXIT', 'SCHLIESSEN'].includes(upper)) return 'CLOSE';
  return upper;
}

module.exports = {
  parseSignal,
  parseTextSignal,
  parseStructuredSignal,
  extractPrices,
  parsePrice,
  normalizeSymbol,
  normalizeAction
};
