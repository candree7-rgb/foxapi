/**
 * Firebase Service
 * Connects to FoxSignals Firestore and listens for real-time updates
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, onSnapshot, doc, getDoc } = require('firebase/firestore');
const { getAuth, signInWithEmailAndPassword, onAuthStateChanged } = require('firebase/auth');
const { log } = require('../utils/logger');

// Firebase Configuration (FoxSignals)
const firebaseConfig = {
  apiKey: "AIzaSyD5SL1S5c53ROLR27cGh1cliY417ZikRIE",
  authDomain: "fox-signals.firebaseapp.com",
  databaseURL: "https://fox-signals-default-rtdb.firebaseio.com",
  projectId: "fox-signals",
  storageBucket: "fox-signals.appspot.com",
  messagingSenderId: "864712600852",
  appId: "1:864712600852:android:28a2df29e82d8742b12601"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Track seen signals to avoid duplicates
const seenSignals = new Set();

// Unsubscribe functions
let unsubscribes = [];

/**
 * Login with email and password
 * @param {string} email - FoxSignals email
 * @param {string} password - FoxSignals password
 * @returns {Promise<Object>} User credential
 */
async function login(email, password) {
  log('AUTH', 'Logging in to FoxSignals...');

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    log('AUTH', `✅ Logged in as: ${userCredential.user.email}`);
    log('AUTH', `   UID: ${userCredential.user.uid}`);
    return userCredential;
  } catch (error) {
    log('AUTH', `❌ Login failed: ${error.code} - ${error.message}`);
    throw error;
  }
}

/**
 * Get current auth state
 * @returns {Promise<Object|null>} Current user or null
 */
function getCurrentUser() {
  return auth.currentUser;
}

/**
 * Listen to a Firestore collection for new signals
 * @param {string} collectionName - Collection to listen to
 * @param {Function} onSignal - Callback for new signals
 * @returns {Function} Unsubscribe function
 */
function listenToCollection(collectionName, onSignal) {
  log('FIRESTORE', `📡 Starting listener for: ${collectionName}`);

  const colRef = collection(db, collectionName);

  const unsubscribe = onSnapshot(colRef, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      const docId = change.doc.id;
      const data = change.doc.data();

      if (change.type === 'added') {
        // Check if we've already processed this signal
        const signalKey = `${collectionName}:${docId}`;
        if (seenSignals.has(signalKey)) {
          return;
        }
        seenSignals.add(signalKey);

        log('SIGNAL', `🚀 NEW SIGNAL in ${collectionName}:`);
        log('SIGNAL', `   ID: ${docId}`);
        logSignalDetails(data);

        // Call the callback with formatted signal
        const formattedSignal = formatSignal(data, docId, collectionName, 'new');
        onSignal(formattedSignal);
      }

      if (change.type === 'modified') {
        log('SIGNAL', `📝 SIGNAL UPDATE in ${collectionName}:`);
        log('SIGNAL', `   ID: ${docId}`);
        logSignalDetails(data);

        const formattedSignal = formatSignal(data, docId, collectionName, 'update');
        onSignal(formattedSignal);
      }

      if (change.type === 'removed') {
        log('SIGNAL', `🗑️ SIGNAL REMOVED from ${collectionName}: ${docId}`);

        const formattedSignal = formatSignal(data, docId, collectionName, 'closed');
        onSignal(formattedSignal);
      }
    });
  }, (error) => {
    log('FIRESTORE', `❌ Error in ${collectionName} listener: ${error.message}`);
  });

  unsubscribes.push(unsubscribe);
  return unsubscribe;
}

/**
 * Log signal details in a readable format
 * @param {Object} data - Signal data
 */
function logSignalDetails(data) {
  log('SIGNAL', `   Symbol: ${data.symbol || 'N/A'}`);
  log('SIGNAL', `   Direction: ${data.direction || data.side || 'N/A'}`);
  log('SIGNAL', `   Entry: ${data.entryPrice || data.entry || 'N/A'}`);
  log('SIGNAL', `   Stop Loss: ${data.stopLoss || data.sl || 'N/A'}`);

  // Log TPs
  const tps = [];
  for (let i = 1; i <= 5; i++) {
    const tp = data[`takeProfit${i}`] || data[`tp${i}`];
    if (tp) tps.push(`TP${i}: ${tp}`);
  }
  if (tps.length > 0) {
    log('SIGNAL', `   Targets: ${tps.join(' | ')}`);
  }

  log('SIGNAL', `   Free: ${data.isFree ? 'YES' : 'NO'} | Premium: ${data.isPremium ? 'YES' : 'NO'}`);
}

/**
 * Format signal data for forwarding
 * @param {Object} data - Raw signal data
 * @param {string} docId - Document ID
 * @param {string} collection - Collection name
 * @param {string} type - Signal type (new/update/closed)
 * @returns {Object} Formatted signal
 */
function formatSignal(data, docId, collectionName, type) {
  return {
    // Metadata
    id: docId,
    source: 'foxsignals',
    collection: collectionName,
    type: type, // 'new', 'update', 'closed'
    timestamp: new Date().toISOString(),

    // Core signal
    symbol: data.symbol || null,
    direction: data.direction || data.side || null,
    action: (data.direction || data.side || '').toUpperCase(),

    // Prices
    entry: data.entryPrice || data.entry || null,
    entryPrice: data.entryPrice || data.entry || null,
    stopLoss: data.stopLoss || data.sl || null,
    sl: data.stopLoss || data.sl || null,

    // Take profits
    takeProfit: [
      data.takeProfit1 || data.tp1,
      data.takeProfit2 || data.tp2,
      data.takeProfit3 || data.tp3,
      data.takeProfit4 || data.tp4,
      data.takeProfit5 || data.tp5
    ].filter(tp => tp !== undefined && tp !== null),
    tp1: data.takeProfit1 || data.tp1 || null,
    tp2: data.takeProfit2 || data.tp2 || null,
    tp3: data.takeProfit3 || data.tp3 || null,
    tp4: data.takeProfit4 || data.tp4 || null,
    tp5: data.takeProfit5 || data.tp5 || null,

    // Status
    isFree: data.isFree || false,
    isPremium: data.isPremium || false,
    status: data.status || null,

    // Leverage if available
    leverage: data.leverage || null,

    // Raw data for debugging
    raw: data
  };
}

/**
 * Start listening to all signal collections
 * @param {Function} onSignal - Callback for new signals
 */
function startAllListeners(onSignal) {
  log('FIRESTORE', '='.repeat(50));
  log('FIRESTORE', 'Starting FoxSignals Realtime Listeners');
  log('FIRESTORE', '='.repeat(50));

  // Main collections to monitor
  const collections = [
    'signalsAggrOpen',    // Active/Open signals
    'signalsCrypto',      // Crypto signals
    'signalsForex',       // Forex signals
    'signalsStocks'       // Stock signals
  ];

  collections.forEach(col => {
    listenToCollection(col, onSignal);
  });

  log('FIRESTORE', `✅ Listening to ${collections.length} collections`);
}

/**
 * Stop all listeners
 */
function stopAllListeners() {
  log('FIRESTORE', 'Stopping all listeners...');
  unsubscribes.forEach(unsub => unsub());
  unsubscribes = [];
  log('FIRESTORE', '✅ All listeners stopped');
}

/**
 * Monitor auth state changes
 */
function monitorAuthState() {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      log('AUTH', `✅ User authenticated: ${user.email}`);
    } else {
      log('AUTH', '⚠️ User signed out');
    }
  });
}

module.exports = {
  login,
  getCurrentUser,
  listenToCollection,
  startAllListeners,
  stopAllListeners,
  monitorAuthState,
  formatSignal,
  auth,
  db
};
