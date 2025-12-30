# FoxSignals Realtime Listener

Hört auf FoxSignals via Firebase und leitet Signale (Entry, TPs, SL) an deinen Bot weiter.

## Features

- **JWT Token Support** - Für Google Login User
- **Email/Password Support** - Für Email Login User
- **Alle Signale** - Entry, TP1-TP5, Stop Loss
- **Multiple Collections** - signalsAggrOpen, signalsCrypto, signalsForex, signalsStocks
- **Railway Ready** - Optimiert für Railway Deployment

## Railway Deployment

### 1. Repository deployen

1. Gehe zu [Railway](https://railway.app)
2. "New Project" → "Deploy from GitHub repo"
3. Wähle dieses Repository

### 2. Environment Variables setzen

**Für Google Login (JWT Token):**
```
FOXSIGNALS_ID_TOKEN=dein-jwt-token
FOXSIGNALS_REFRESH_TOKEN=dein-refresh-token
BOT_WEBHOOK_URL=https://dein-bot.com/webhook
```

**Für Email Login:**
```
FOXSIGNALS_EMAIL=deine@email.com
FOXSIGNALS_PASSWORD=dein-passwort
BOT_WEBHOOK_URL=https://dein-bot.com/webhook
```

### 3. Deploy!

## Wie bekomme ich den JWT Token?

### Option A: Browser DevTools
1. Öffne https://getfoxsignals.com und logge dich ein
2. Öffne DevTools (F12) → Application → Local Storage
3. Suche nach Firebase Auth Token (fängt mit `eyJ` an)

### Option B: App Traffic abfangen
1. Nutze mitmproxy oder Charles Proxy
2. Fange den Traffic der FoxSignals App ab
3. Suche nach dem `Authorization: Bearer` Header

### Option C: Firebase Auth direkt
```javascript
// In der Browser Console auf getfoxsignals.com:
firebase.auth().currentUser.getIdToken().then(console.log)
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `FOXSIGNALS_ID_TOKEN` | ✅* | JWT Token (für Google Login) |
| `FOXSIGNALS_REFRESH_TOKEN` | ❌ | Refresh Token (für Auto-Refresh) |
| `FOXSIGNALS_EMAIL` | ✅* | Email (für Email Login) |
| `FOXSIGNALS_PASSWORD` | ✅* | Passwort (für Email Login) |
| `BOT_WEBHOOK_URL` | ✅ | Webhook URL deines Bots |
| `POLL_INTERVAL` | ❌ | Polling Interval in ms (default: 10000) |

*) Entweder JWT Token ODER Email/Password

## Signal Output

```json
{
  "id": "signal-doc-id",
  "source": "foxsignals",
  "collection": "signalsAggrOpen",
  "type": "new",
  "timestamp": "2024-01-15T12:00:00.000Z",

  "symbol": "BTCUSDT",
  "direction": "long",
  "action": "LONG",

  "entry": 50000,
  "stopLoss": 49000,

  "takeProfit": [51000, 52000, 53000, 54000, 55000],
  "tp1": 51000,
  "tp2": 52000,
  "tp3": 53000,
  "tp4": 54000,
  "tp5": 55000,

  "isFree": true,
  "isPremium": false
}
```

## Logs in Railway

```
╔══════════════════════════════════════════════════╗
║ 🦊 FOXSIGNAL NEW                                 ║
╠══════════════════════════════════════════════════╣
║ Symbol:    BTCUSDT                               ║
║ Direction: long                                  ║
║ Entry:     50000                                 ║
║ Stop Loss: 49000                                 ║
╟──────────────────────────────────────────────────╢
║ TP1:       51000                                 ║
║ TP2:       52000                                 ║
║ TP3:       53000                                 ║
╚══════════════════════════════════════════════════╝

[FORWARD   ] ✅ Signal forwarded successfully (200)
```

## Token Expiration

Firebase ID Tokens laufen nach **1 Stunde** ab.

**Mit Refresh Token:** Wird automatisch alle 55 Minuten erneuert.

**Ohne Refresh Token:** Du musst den Token manuell erneuern und in Railway neu setzen.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Service Info |
| `/health` | GET | Health Check + Stats |
| `/stats` | GET | Detaillierte Statistiken |
| `/test` | POST | Test-Signal an Bot senden |

## Lizenz

MIT
