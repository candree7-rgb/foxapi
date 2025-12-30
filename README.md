# FoxSignals Realtime Listener

Hört in Echtzeit auf FoxSignals via Firebase und leitet die Signale an deinen Bot weiter.

## Features

- **Realtime Listening** - Direkte Firebase/Firestore Verbindung
- **Alle Signale** - Entry, TP1-TP5, Stop Loss
- **Multiple Collections** - signalsAggrOpen, signalsCrypto, signalsForex, signalsStocks
- **Auto-Forward** - Automatische Weiterleitung an deine Webhook-URL
- **Railway Ready** - Optimiert für Railway Deployment

## Railway Deployment

### 1. Repository deployen

1. Gehe zu [Railway](https://railway.app)
2. "New Project" → "Deploy from GitHub repo"
3. Wähle dieses Repository

### 2. Environment Variables setzen

In Railway → Variables:

```
FOXSIGNALS_EMAIL=deine-foxsignals@email.com
FOXSIGNALS_PASSWORD=dein-passwort
BOT_WEBHOOK_URL=https://dein-bot.com/webhook
```

### 3. Deploy!

Railway baut und startet automatisch.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `FOXSIGNALS_EMAIL` | ✅ | Dein FoxSignals Email |
| `FOXSIGNALS_PASSWORD` | ✅ | Dein FoxSignals Passwort |
| `BOT_WEBHOOK_URL` | ✅ | Webhook URL deines Bots |
| `WEBHOOK_SECRET` | ❌ | Secret für Bot-Auth |
| `PORT` | ❌ | Port (default: 3000) |

## Was an deinen Bot gesendet wird

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
  "entryPrice": 50000,
  "stopLoss": 49000,
  "sl": 49000,

  "takeProfit": [51000, 52000, 53000, 54000, 55000],
  "tp1": 51000,
  "tp2": 52000,
  "tp3": 53000,
  "tp4": 54000,
  "tp5": 55000,

  "isFree": true,
  "isPremium": false,
  "leverage": 10
}
```

## Signal Types

- `new` - Neues Signal
- `update` - Signal wurde aktualisiert
- `closed` - Signal wurde geschlossen/entfernt

## Logs in Railway

Die Logs zeigen alle eingehenden Signale:

```
╔══════════════════════════════════════════════════╗
║ 🦊 FOXSIGNAL NEW                                  ║
╠══════════════════════════════════════════════════╣
║ Symbol:    BTCUSDT                               ║
║ Direction: long                                   ║
║ Entry:     50000                                 ║
║ Stop Loss: 49000                                 ║
╟──────────────────────────────────────────────────╢
║ TP1:       51000                                 ║
║ TP2:       52000                                 ║
║ TP3:       53000                                 ║
╟──────────────────────────────────────────────────╢
║ Free: YES  |  Premium: NO                        ║
║ Time: 2024-01-15T12:00:00.000Z                   ║
╚══════════════════════════════════════════════════╝
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Service Info |
| `/health` | GET | Health Check + Stats |
| `/stats` | GET | Detaillierte Statistiken |
| `/test` | POST | Test-Signal an Bot senden |

## Local Development

```bash
# Dependencies installieren
npm install

# .env erstellen
cp .env.example .env

# .env bearbeiten mit deinen Credentials

# Starten
npm run dev
```

## Troubleshooting

### "Login failed"
- Überprüfe Email/Passwort
- Stelle sicher, dass du einen aktiven FoxSignals Account hast

### "Signal not forwarded"
- Überprüfe BOT_WEBHOOK_URL
- Stelle sicher, dass dein Bot erreichbar ist

### "Permission denied"
- Dein FoxSignals Account benötigt ggf. ein Premium Abo für alle Signale

## Lizenz

MIT
