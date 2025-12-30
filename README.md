# FoxSignals Webhook Listener

Ein Webhook-Listener, der Trading-Signale von FoxSignals empfängt und an deinen Bot weiterleitet.

## Features

- Empfängt Signale von FoxSignals
- Parst Entry, Take Profits (TP1-TP5) und Stop Loss
- Leitet Signale an deine Webhook-URL weiter
- Unterstützt JSON und Text-Formate
- Automatische Wiederholungsversuche bei Fehlern

## Installation

```bash
# Dependencies installieren
npm install

# .env Datei erstellen
cp .env.example .env

# .env bearbeiten und BOT_WEBHOOK_URL setzen
```

## Konfiguration

Bearbeite die `.env` Datei:

```env
# Dein Bot's Webhook URL (PFLICHT)
BOT_WEBHOOK_URL=https://dein-bot.com/webhook

# Optional: Secret für Authentifizierung
WEBHOOK_SECRET=dein-secret
```

## Starten

```bash
# Production
npm start

# Development (mit Auto-Reload)
npm run dev
```

## Webhook Endpoints

### POST `/webhook/foxsignals`
Hauptendpoint für FoxSignals.

**JSON Format:**
```json
{
  "symbol": "BTCUSDT",
  "action": "LONG",
  "entry": 50000,
  "tp1": 51000,
  "tp2": 52000,
  "tp3": 53000,
  "stopLoss": 49000,
  "leverage": 10
}
```

### POST `/webhook/foxsignals/text`
Für Text-basierte Signale (Telegram-Style).

**Text Format:**
```
#BTCUSDT LONG

Entry: 50000 - 50500
TP1: 51000
TP2: 52000
TP3: 53000
SL: 49000

Leverage: 10x
```

## Ausgabe an deinen Bot

Der Listener sendet folgendes Format an deine Webhook-URL:

```json
{
  "source": "foxsignals",
  "timestamp": "2024-01-15T12:00:00.000Z",
  "symbol": "BTCUSDT",
  "action": "LONG",
  "side": "buy",
  "entry": 50000,
  "entryPrice": 50000,
  "takeProfit": [51000, 52000, 53000],
  "tp1": 51000,
  "tp2": 52000,
  "tp3": 53000,
  "stopLoss": 49000,
  "sl": 49000,
  "leverage": 10
}
```

## Deployment

### Mit ngrok (zum Testen)
```bash
npm start
ngrok http 3000
# Nutze die ngrok URL als Webhook bei FoxSignals
```

### Mit PM2
```bash
npm install -g pm2
pm2 start src/index.js --name foxsignals
pm2 save
```

### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

## Testen

```bash
# Health Check
curl http://localhost:3000/health

# Test Signal senden
curl -X POST http://localhost:3000/webhook/foxsignals \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "BTCUSDT",
    "action": "LONG",
    "entry": 50000,
    "tp1": 51000,
    "tp2": 52000,
    "stopLoss": 49000
  }'
```

## Lizenz

MIT
