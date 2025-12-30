# FoxSignals APK Patcher

Patcht die FoxSignals APK direkt um alle Signale an deinen Webhook zu senden.

**Kein Root erforderlich!**

## Voraussetzungen

### Windows
```powershell
# Java installieren (falls nicht vorhanden)
winget install Oracle.JDK.21

# apktool herunterladen
# https://ibotpeaches.github.io/Apktool/
# Speichere als apktool.bat und apktool.jar in C:\Windows oder füge zum PATH hinzu
```

### Linux/Mac
```bash
# Debian/Ubuntu
sudo apt install apktool openjdk-17-jdk

# Mac
brew install apktool
```

## Verwendung

### Schritt 1: FoxSignals APK besorgen

**Option A: Von deinem Handy exportieren**
1. Installiere "APK Extractor" aus dem Play Store
2. Öffne APK Extractor
3. Finde "FoxSignals" und tippe auf "Share/Export"
4. Speichere die APK auf deinem PC

**Option B: Von APKMirror**
1. Gehe zu https://www.apkmirror.com
2. Suche nach "FoxSignals"
3. Lade die neueste Version herunter

### Schritt 2: APK patchen

```bash
# In dieses Verzeichnis wechseln
cd apk-patcher

# APK patchen
python patch_foxsignals.py foxsignals.apk https://dein-webhook.com/signal
```

Ersetze `https://dein-webhook.com/signal` mit deiner echten Webhook URL!

Beispiel:
```bash
python patch_foxsignals.py foxsignals.apk https://bot-sysfox.up.railway.app/webhook
```

### Schritt 3: Gepatchte APK installieren

1. Die gepatchte APK heißt `foxsignals_patched_signed.apk`
2. Übertrage sie auf dein Android Gerät
3. **Deinstalliere** die originale FoxSignals App
4. Installiere die gepatchte APK
5. Bei "Installation von unbekannten Quellen" → Erlauben
6. Logge dich in FoxSignals ein

### Schritt 4: Testen

1. Öffne FoxSignals
2. Warte auf ein neues Signal
3. Das Signal wird automatisch an deine Webhook URL gesendet!

Du kannst in den Android Logs (mit `adb logcat | grep FoxHook`) sehen:
```
D/FoxHook: Signal detected! Sending to webhook...
```

## Was wird gesendet?

```json
{
  "source": "foxsignals_hooked",
  "timestamp": 1704067200000,
  "symbol": "BTCUSDT",
  "direction": "long",
  "entryPrice": 50000,
  "stopLoss": 49000,
  "takeProfit1": 51000,
  "takeProfit2": 52000,
  "takeProfit3": 53000,
  "takeProfit4": 54000,
  "takeProfit5": 55000,
  "isFree": true,
  "isPremium": false
}
```

## Troubleshooting

### "apktool not found"
- Stelle sicher, dass apktool im PATH ist
- Oder gib den vollen Pfad an: `C:\apktool\apktool.bat`

### "Failed to decompile"
- Die APK könnte beschädigt sein
- Lade sie erneut herunter

### "App stürzt ab"
- Die App-Struktur hat sich geändert
- Kontaktiere mich für ein Update

### "Signale kommen nicht an"
- Prüfe deine Webhook URL
- Stelle sicher, dass dein Server läuft
- Prüfe die Android Logs: `adb logcat | grep FoxHook`

## Alternative: LSPatch Methode

Falls das direkte Patchen nicht funktioniert, nutze das Xposed-Modul im `xposed-module` Ordner mit LSPatch.

## Updates

Wenn FoxSignals ein Update bekommt, musst du:
1. Die neue APK herunterladen
2. Das Patch-Script erneut ausführen
3. Die neue gepatchte Version installieren

## Haftungsausschluss

Nur für persönliche Nutzung! Die Modifikation von Apps kann gegen deren Nutzungsbedingungen verstoßen.
