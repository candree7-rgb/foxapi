/**
 * Logger Utility
 * Provides consistent, readable logging for Railway deploy logs
 */

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

const currentLevel = LOG_LEVELS[process.env.LOG_LEVEL || 'INFO'];

/**
 * Format timestamp for logs
 * @returns {string} Formatted timestamp
 */
function getTimestamp() {
  return new Date().toISOString();
}

/**
 * Log a message with category
 * @param {string} category - Log category (e.g., 'AUTH', 'SIGNAL', 'FORWARD')
 * @param {string} message - Log message
 * @param {string} level - Log level
 */
function log(category, message, level = 'INFO') {
  if (LOG_LEVELS[level] >= currentLevel) {
    const prefix = `[${getTimestamp()}] [${category.padEnd(10)}]`;
    console.log(`${prefix} ${message}`);
  }
}

/**
 * Log debug message
 */
function debug(category, message) {
  log(category, message, 'DEBUG');
}

/**
 * Log info message
 */
function info(category, message) {
  log(category, message, 'INFO');
}

/**
 * Log warning message
 */
function warn(category, message) {
  log(category, `⚠️ ${message}`, 'WARN');
}

/**
 * Log error message
 */
function error(category, message, err = null) {
  log(category, `❌ ${message}`, 'ERROR');
  if (err) {
    console.error(err);
  }
}

/**
 * Log a signal in a formatted box
 * @param {Object} signal - Signal object
 */
function logSignalBox(signal) {
  const border = '═'.repeat(50);
  console.log(`\n╔${border}╗`);
  console.log(`║ 🦊 FOXSIGNAL ${signal.type.toUpperCase().padEnd(36)} ║`);
  console.log(`╠${border}╣`);
  console.log(`║ Symbol:    ${(signal.symbol || 'N/A').padEnd(37)} ║`);
  console.log(`║ Direction: ${(signal.direction || signal.action || 'N/A').padEnd(37)} ║`);
  console.log(`║ Entry:     ${String(signal.entry || 'N/A').padEnd(37)} ║`);
  console.log(`║ Stop Loss: ${String(signal.stopLoss || 'N/A').padEnd(37)} ║`);

  if (signal.takeProfit && signal.takeProfit.length > 0) {
    console.log(`╟${'─'.repeat(50)}╢`);
    signal.takeProfit.forEach((tp, i) => {
      console.log(`║ TP${i + 1}:       ${String(tp).padEnd(37)} ║`);
    });
  }

  console.log(`╟${'─'.repeat(50)}╢`);
  console.log(`║ Free: ${signal.isFree ? 'YES' : 'NO'}  |  Premium: ${signal.isPremium ? 'YES' : 'NO'}`.padEnd(51) + '║');
  console.log(`║ Time: ${signal.timestamp}`.padEnd(51) + '║');
  console.log(`╚${border}╝\n`);
}

/**
 * Log startup banner
 * @param {Object} config - Configuration summary
 */
function logStartupBanner(config) {
  const border = '═'.repeat(58);
  console.log(`\n╔${border}╗`);
  console.log(`║${'🦊 FOXSIGNALS REALTIME LISTENER'.padStart(42).padEnd(58)}║`);
  console.log(`╠${border}╣`);
  console.log(`║ Version:      2.0.0`.padEnd(59) + '║');
  console.log(`║ Node:         ${process.version}`.padEnd(59) + '║');
  console.log(`║ Environment:  ${process.env.NODE_ENV || 'development'}`.padEnd(59) + '║');
  console.log(`╟${'─'.repeat(58)}╢`);
  console.log(`║ Health Check: http://localhost:${config.port}/health`.padEnd(59) + '║');
  console.log(`║ Forward URL:  ${(config.webhookUrl || 'NOT SET').substring(0, 40)}`.padEnd(59) + '║');
  console.log(`╟${'─'.repeat(58)}╢`);
  console.log(`║ Listening to: signalsAggrOpen, signalsCrypto`.padEnd(59) + '║');
  console.log(`║               signalsForex, signalsStocks`.padEnd(59) + '║');
  console.log(`╚${border}╝\n`);
}

/**
 * Log forward result
 * @param {boolean} success - Whether forward was successful
 * @param {string} url - Forward URL
 * @param {number} statusCode - HTTP status code
 */
function logForwardResult(success, url, statusCode) {
  if (success) {
    log('FORWARD', `✅ Signal forwarded successfully (${statusCode})`);
  } else {
    log('FORWARD', `❌ Failed to forward signal (${statusCode || 'timeout'})`);
  }
}

module.exports = {
  log,
  debug,
  info,
  warn,
  error,
  logSignalBox,
  logStartupBanner,
  logForwardResult
};
