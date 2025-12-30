/**
 * Firebase Service
 * Connects to FoxSignals Firestore and listens for updates
 * Supports both Email/Password login AND JWT Token authentication
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, onSnapshot } = require('firebase/firestore');
const { getAuth, signInWithEmailAndPassword, signInWithCredential, GoogleAuthProvider, onAuthStateChanged } = require('firebase/auth');
const axios = require('axios');
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

// Firestore REST API base URL
const FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/projects/fox-signals/databases/(default)/documents`;

// Track seen signals to avoid duplicates
const seenSignals = new Set();

// Store for polling
let pollingInterval = null;
let currentIdToken = null;

/**
 * Login with email and password
 * @param {string} email - FoxSignals email
 * @param {string} password - FoxSignals password
 * @returns {Promise<Object>} User credential
 */
async function loginWithEmail(email, password) {
  log('AUTH', 'Logging in with Email/Password...');

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    log('AUTH', `✅ Logged in as: ${userCredential.user.email}`);
    log('AUTH', `   UID: ${userCredential.user.uid}`);

    // Get ID Token for REST API fallback
    currentIdToken = await userCredential.user.getIdToken();

    return userCredential;
  } catch (error) {
    log('AUTH', `❌ Login failed: ${error.code} - ${error.message}`);
    throw error;
  }
}

/**
 * Use JWT/ID Token directly (for Google OAuth users)
 * @param {string} idToken - Firebase ID Token
 */
function useIdToken(idToken) {
  log('AUTH', 'Using provided ID Token for authentication');
  currentIdToken = idToken;
  log('AUTH', `✅ Token set (${idToken.substring(0, 20)}...)`);
}

/**
 * Refresh token using Firebase REST API
 * @param {string} refreshToken - Refresh token
 * @returns {Promise<string>} New ID token
 */
async function refreshIdToken(refreshToken) {
  try {
    const response = await axios.post(
      `https://securetoken.googleapis.com/v1/token?key=${firebaseConfig.apiKey}`,
      {
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      }
    );

    currentIdToken = response.data.id_token;
    log('AUTH', '✅ Token refreshed');
    return currentIdToken;
  } catch (error) {
    log('AUTH', `❌ Token refresh failed: ${error.message}`);
    throw error;
  }
}

/**
 * Fetch signals from Firestore REST API
 * @param {string} collectionName - Collection to fetch
 * @returns {Promise<Array>} Array of documents
 */
async function fetchCollection(collectionName) {
  if (!currentIdToken) {
    throw new Error('No ID token available');
  }

  try {
    const url = `${FIRESTORE_BASE_URL}/${collectionName}`;
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${currentIdToken}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data.documents || [];
  } catch (error) {
    if (error.response?.status === 401 || error.response?.status === 403) {
      log('AUTH', '⚠️ Token expired or invalid');
    }
    throw error;
  }
}

/**
 * Parse Firestore document fields to normal values
 * @param {Object} fields - Firestore field format
 * @returns {Object} Parsed data
 */
function parseFirestoreFields(fields) {
  const result = {};

  for (const [key, value] of Object.entries(fields || {})) {
    if (value.stringValue !== undefined) result[key] = value.stringValue;
    else if (value.doubleValue !== undefined) result[key] = value.doubleValue;
    else if (value.integerValue !== undefined) result[key] = parseInt(value.integerValue);
    else if (value.booleanValue !== undefined) result[key] = value.booleanValue;
    else if (value.timestampValue !== undefined) result[key] = value.timestampValue;
    else if (value.nullValue !== undefined) result[key] = null;
    else if (value.arrayValue !== undefined) {
      result[key] = (value.arrayValue.values || []).map(v => parseFirestoreFields({ val: v }).val);
    }
  }

  return result;
}

/**
 * Start polling for signals using REST API
 * @param {Function} onSignal - Callback for new signals
 * @param {number} intervalMs - Polling interval in ms (default: 10000)
 */
function startPolling(onSignal, intervalMs = 10000) {
  log('POLLING', '='.repeat(50));
  log('POLLING', 'Starting FoxSignals Polling (REST API)');
  log('POLLING', `Interval: ${intervalMs / 1000} seconds`);
  log('POLLING', '='.repeat(50));

  const collections = [
    'signalsAggrOpen',
    'signalsCrypto',
    'signalsForex',
    'signalsStocks'
  ];

  async function poll() {
    for (const collectionName of collections) {
      try {
        const documents = await fetchCollection(collectionName);

        for (const doc of documents) {
          const docId = doc.name.split('/').pop();
          const signalKey = `${collectionName}:${docId}`;

          if (!seenSignals.has(signalKey)) {
            seenSignals.add(signalKey);

            const data = parseFirestoreFields(doc.fields);

            log('SIGNAL', `🚀 NEW SIGNAL in ${collectionName}:`);
            log('SIGNAL', `   ID: ${docId}`);
            logSignalDetails(data);

            const formattedSignal = formatSignal(data, docId, collectionName, 'new');
            onSignal(formattedSignal);
          }
        }
      } catch (error) {
        log('POLLING', `❌ Error fetching ${collectionName}: ${error.message}`);
      }
    }
  }

  // Initial poll
  poll();

  // Start interval
  pollingInterval = setInterval(poll, intervalMs);

  log('POLLING', `✅ Polling started for ${collections.length} collections`);
}

/**
 * Stop polling
 */
function stopPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
    log('POLLING', '⏹️ Polling stopped');
  }
}

/**
 * Listen to a Firestore collection for new signals (Realtime - requires SDK auth)
 * @param {string} collectionName - Collection to listen to
 * @param {Function} onSignal - Callback for new signals
 * @returns {Function} Unsubscribe function
 */
let unsubscribes = [];

function listenToCollection(collectionName, onSignal) {
  log('FIRESTORE', `📡 Starting realtime listener for: ${collectionName}`);

  const colRef = collection(db, collectionName);

  const unsubscribe = onSnapshot(colRef, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      const docId = change.doc.id;
      const data = change.doc.data();

      if (change.type === 'added') {
        const signalKey = `${collectionName}:${docId}`;
        if (seenSignals.has(signalKey)) {
          return;
        }
        seenSignals.add(signalKey);

        log('SIGNAL', `🚀 NEW SIGNAL in ${collectionName}:`);
        log('SIGNAL', `   ID: ${docId}`);
        logSignalDetails(data);

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
 * @param {string} collectionName - Collection name
 * @param {string} type - Signal type (new/update/closed)
 * @returns {Object} Formatted signal
 */
function formatSignal(data, docId, collectionName, type) {
  return {
    id: docId,
    source: 'foxsignals',
    collection: collectionName,
    type: type,
    timestamp: new Date().toISOString(),

    symbol: data.symbol || null,
    direction: data.direction || data.side || null,
    action: (data.direction || data.side || '').toUpperCase(),

    entry: data.entryPrice || data.entry || null,
    entryPrice: data.entryPrice || data.entry || null,
    stopLoss: data.stopLoss || data.sl || null,
    sl: data.stopLoss || data.sl || null,

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

    isFree: data.isFree || false,
    isPremium: data.isPremium || false,
    status: data.status || null,
    leverage: data.leverage || null,

    raw: data
  };
}

/**
 * Start listening to all signal collections (Realtime)
 * @param {Function} onSignal - Callback for new signals
 */
function startAllListeners(onSignal) {
  log('FIRESTORE', '='.repeat(50));
  log('FIRESTORE', 'Starting FoxSignals Realtime Listeners');
  log('FIRESTORE', '='.repeat(50));

  const collections = [
    'signalsAggrOpen',
    'signalsCrypto',
    'signalsForex',
    'signalsStocks'
  ];

  collections.forEach(col => {
    listenToCollection(col, onSignal);
  });

  log('FIRESTORE', `✅ Listening to ${collections.length} collections`);
}

/**
 * Stop all realtime listeners
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
      log('AUTH', `✅ User authenticated: ${user.email || user.uid}`);
    } else {
      log('AUTH', '⚠️ User signed out');
    }
  });
}

/**
 * Check if we have valid authentication
 */
function isAuthenticated() {
  return currentIdToken !== null || auth.currentUser !== null;
}

module.exports = {
  // Auth
  loginWithEmail,
  useIdToken,
  refreshIdToken,
  isAuthenticated,
  monitorAuthState,

  // Realtime listeners
  listenToCollection,
  startAllListeners,
  stopAllListeners,

  // REST API polling
  startPolling,
  stopPolling,
  fetchCollection,

  // Utils
  formatSignal,
  parseFirestoreFields,

  // Firebase instances
  auth,
  db
};
