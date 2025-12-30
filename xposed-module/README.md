# FoxHook - FoxSignals Xposed Module

Dieses Modul fängt alle FoxSignals Trading-Signale ab und leitet sie an deinen Webhook weiter.

## Features

- Fängt alle Signale ab (Entry, TP1-TP5, Stop Loss)
- Sendet automatisch an deine Webhook URL
- Funktioniert mit LSPatch (kein Root nötig!)

## Installation mit LSPatch (ohne Root)

### Schritt 1: FoxHook Modul bauen

**Option A: Mit Android Studio**
1. Öffne dieses Projekt in Android Studio
2. Ändere `WEBHOOK_URL` in `MainHook.java` zu deiner URL
3. Build → Build APK
4. Die APK findest du unter `app/build/outputs/apk/release/`

**Option B: Vorkompilierte APK verwenden**
(Falls du keine hast, musst du Option A nutzen)

### Schritt 2: LSPatch installieren

1. Lade LSPatch herunter: https://github.com/LSPosed/LSPatch/releases
2. Installiere die `manager.apk` auf deinem Android Gerät
3. Öffne LSPatch Manager

### Schritt 3: FoxSignals APK besorgen

1. Installiere "APK Extractor" aus dem Play Store
2. Extrahiere die FoxSignals APK
3. Oder lade von APKMirror/APKPure herunter

### Schritt 4: FoxSignals mit LSPatch patchen

1. Öffne LSPatch Manager
2. Tippe auf "+" um eine neue App zu patchen
3. Wähle "Lokaler Modus" (empfohlen)
4. Wähle die FoxSignals APK aus
5. Bei "Module einbetten" wähle die FoxHook APK
6. Tippe auf "Patch starten"
7. Warte bis der Patch fertig ist

### Schritt 5: Gepatchte App installieren

1. Deinstalliere die Original FoxSignals App
2. Installiere die gepatchte APK (aus LSPatch)
3. Erlaube "Unbekannte Quellen" falls nötig
4. Starte die App und logge dich ein

### Schritt 6: Testen

1. Öffne FoxSignals
2. Schau in die Logs (LSPatch Manager → Logs)
3. Du solltest "[FoxHook] Signal detected!" sehen
4. Die Signale werden an deine Webhook URL gesendet

## Webhook URL ändern

Bevor du das Modul baust, ändere diese Zeile in `MainHook.java`:

```java
private static final String WEBHOOK_URL = "https://YOUR-WEBHOOK-URL.com/signal";
```

Ersetze mit deiner Railway URL:
```java
private static final String WEBHOOK_URL = "https://bot-sysfox.up.railway.app/webhook";
```

## Was wird gesendet?

```json
{
  "source": "foxsignals",
  "timestamp": 1704067200000,
  "symbol": "BTCUSDT",
  "direction": "long",
  "entry": 50000,
  "stopLoss": 49000,
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

## Troubleshooting

### "Module not loaded"
- Stelle sicher, dass FoxHook in LSPatch als Modul hinzugefügt wurde
- Starte die gepatchte App neu

### "Webhook error"
- Überprüfe deine Webhook URL
- Stelle sicher, dass das Handy Internet hat
- Prüfe ob dein Server läuft

### Signale werden nicht erkannt
- Die App-Struktur könnte sich geändert haben
- Schau in die Logs für Hinweise
- Kontaktiere mich für Updates

## Alternative: Direktes APK-Patching

Falls LSPatch nicht funktioniert, kann die APK auch direkt gepatcht werden:

1. APK mit `apktool d foxsignals.apk` decompilieren
2. Smali-Code in die Signal-Klassen einfügen
3. APK mit `apktool b foxsignals` neu bauen
4. Mit `apksigner` signieren

## Lizenz

MIT - Nur für persönlichen Gebrauch!
