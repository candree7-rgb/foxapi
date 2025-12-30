#!/usr/bin/env python3
"""
FoxSignals APK Patcher
Patcht die FoxSignals APK um Signale an einen Webhook zu senden.

Voraussetzungen:
- Python 3
- Java (für apktool)
- apktool installiert (https://ibotpeaches.github.io/Apktool/)
- apksigner oder jarsigner

Verwendung:
    python patch_foxsignals.py foxsignals.apk https://dein-webhook.com/signal
"""

import os
import sys
import subprocess
import shutil
import re
from pathlib import Path

# Smali code to inject - sends signal data to webhook
WEBHOOK_SMALI = '''
.method private sendToWebhook(Ljava/util/Map;)V
    .locals 8
    .param p1, "data"

    # Get webhook URL
    const-string v0, "{WEBHOOK_URL}"

    # Create JSON object
    new-instance v1, Lorg/json/JSONObject;
    invoke-direct {{v1}}, Lorg/json/JSONObject;-><init>()V

    # Add source
    const-string v2, "source"
    const-string v3, "foxsignals"
    invoke-virtual {{v1, v2, v3}}, Lorg/json/JSONObject;->put(Ljava/lang/String;Ljava/lang/Object;)Lorg/json/JSONObject;

    # Add timestamp
    const-string v2, "timestamp"
    invoke-static {{}}, Ljava/lang/System;->currentTimeMillis()J
    move-result-wide v4
    invoke-virtual {{v1, v2, v4, v5}}, Lorg/json/JSONObject;->put(Ljava/lang/String;J)Lorg/json/JSONObject;

    # Put all data from map
    invoke-interface {{p1}}, Ljava/util/Map;->entrySet()Ljava/util/Set;
    move-result-object v2
    invoke-interface {{v2}}, Ljava/util/Set;->iterator()Ljava/util/Iterator;
    move-result-object v2

    :loop_start
    invoke-interface {{v2}}, Ljava/util/Iterator;->hasNext()Z
    move-result v3
    if-eqz v3, :loop_end

    invoke-interface {{v2}}, Ljava/util/Iterator;->next()Ljava/lang/Object;
    move-result-object v3
    check-cast v3, Ljava/util/Map$Entry;

    invoke-interface {{v3}}, Ljava/util/Map$Entry;->getKey()Ljava/lang/Object;
    move-result-object v4
    check-cast v4, Ljava/lang/String;

    invoke-interface {{v3}}, Ljava/util/Map$Entry;->getValue()Ljava/lang/Object;
    move-result-object v5

    :try_start
    invoke-virtual {{v1, v4, v5}}, Lorg/json/JSONObject;->put(Ljava/lang/String;Ljava/lang/Object;)Lorg/json/JSONObject;
    :try_end
    .catch Ljava/lang/Exception; {{:try_start .. :try_end}} :catch

    :catch
    goto :loop_start

    :loop_end

    # Send HTTP request in new thread
    new-instance v2, Ljava/lang/Thread;
    new-instance v3, LWebhookSender;
    invoke-virtual {{v1}}, Lorg/json/JSONObject;->toString()Ljava/lang/String;
    move-result-object v4
    invoke-direct {{v3, v0, v4}}, LWebhookSender;-><init>(Ljava/lang/String;Ljava/lang/String;)V
    invoke-direct {{v2, v3}}, Ljava/lang/Thread;-><init>(Ljava/lang/Runnable;)V
    invoke-virtual {{v2}}, Ljava/lang/Thread;->start()V

    return-void
.end method
'''

WEBHOOK_SENDER_SMALI = '''
.class public LWebhookSender;
.super Ljava/lang/Object;
.implements Ljava/lang/Runnable;

.field private url:Ljava/lang/String;
.field private payload:Ljava/lang/String;

.method public constructor <init>(Ljava/lang/String;Ljava/lang/String;)V
    .locals 0
    .param p1, "url"
    .param p2, "payload"

    invoke-direct {p0}, Ljava/lang/Object;-><init>()V
    iput-object p1, p0, LWebhookSender;->url:Ljava/lang/String;
    iput-object p2, p0, LWebhookSender;->payload:Ljava/lang/String;
    return-void
.end method

.method public run()V
    .locals 6

    :try_start
    # Create URL object
    new-instance v0, Ljava/net/URL;
    iget-object v1, p0, LWebhookSender;->url:Ljava/lang/String;
    invoke-direct {v0, v1}, Ljava/net/URL;-><init>(Ljava/lang/String;)V

    # Open connection
    invoke-virtual {v0}, Ljava/net/URL;->openConnection()Ljava/net/URLConnection;
    move-result-object v0
    check-cast v0, Ljava/net/HttpURLConnection;

    # Set request method
    const-string v1, "POST"
    invoke-virtual {v0, v1}, Ljava/net/HttpURLConnection;->setRequestMethod(Ljava/lang/String;)V

    # Set headers
    const-string v1, "Content-Type"
    const-string v2, "application/json"
    invoke-virtual {v0, v1, v2}, Ljava/net/HttpURLConnection;->setRequestProperty(Ljava/lang/String;Ljava/lang/String;)V

    # Enable output
    const/4 v1, 0x1
    invoke-virtual {v0, v1}, Ljava/net/HttpURLConnection;->setDoOutput(Z)V

    # Set timeouts
    const/16 v1, 0x2710
    invoke-virtual {v0, v1}, Ljava/net/HttpURLConnection;->setConnectTimeout(I)V
    invoke-virtual {v0, v1}, Ljava/net/HttpURLConnection;->setReadTimeout(I)V

    # Write payload
    invoke-virtual {v0}, Ljava/net/HttpURLConnection;->getOutputStream()Ljava/io/OutputStream;
    move-result-object v1

    iget-object v2, p0, LWebhookSender;->payload:Ljava/lang/String;
    const-string v3, "utf-8"
    invoke-virtual {v2, v3}, Ljava/lang/String;->getBytes(Ljava/lang/String;)[B
    move-result-object v2

    array-length v3, v2
    const/4 v4, 0x0
    invoke-virtual {v1, v2, v4, v3}, Ljava/io/OutputStream;->write([BII)V
    invoke-virtual {v1}, Ljava/io/OutputStream;->close()V

    # Get response
    invoke-virtual {v0}, Ljava/net/HttpURLConnection;->getResponseCode()I
    move-result v1

    # Disconnect
    invoke-virtual {v0}, Ljava/net/HttpURLConnection;->disconnect()V
    :try_end
    .catch Ljava/lang/Exception; {:try_start .. :try_end} :catch

    :catch
    return-void
.end method
'''


def run_command(cmd, cwd=None):
    """Run a command and return output"""
    print(f"  Running: {' '.join(cmd)}")
    result = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"  Error: {result.stderr}")
        return None
    return result.stdout


def check_requirements():
    """Check if required tools are installed"""
    print("Checking requirements...")

    # Check apktool
    result = subprocess.run(["apktool", "--version"], capture_output=True)
    if result.returncode != 0:
        print("ERROR: apktool not found!")
        print("Install from: https://ibotpeaches.github.io/Apktool/")
        return False
    print(f"  apktool: OK")

    # Check Java
    result = subprocess.run(["java", "-version"], capture_output=True)
    if result.returncode != 0:
        print("ERROR: Java not found!")
        return False
    print(f"  java: OK")

    return True


def decompile_apk(apk_path, output_dir):
    """Decompile APK using apktool"""
    print(f"\nDecompiling {apk_path}...")

    if output_dir.exists():
        shutil.rmtree(output_dir)

    result = run_command(["apktool", "d", str(apk_path), "-o", str(output_dir)])
    if result is None:
        return False

    print("  Decompiled successfully!")
    return True


def find_signal_classes(decompiled_dir):
    """Find classes that handle signals"""
    print("\nSearching for signal-related classes...")

    signal_files = []
    smali_dirs = list(decompiled_dir.glob("smali*/"))

    for smali_dir in smali_dirs:
        for smali_file in smali_dir.rglob("*.smali"):
            content = smali_file.read_text(errors='ignore')

            # Look for signal-related classes
            if any(keyword in content.lower() for keyword in
                   ['entryprice', 'stoploss', 'takeprofit', 'signalaggr']):
                signal_files.append(smali_file)
                print(f"  Found: {smali_file.relative_to(decompiled_dir)}")

    return signal_files


def find_firestore_hook_point(decompiled_dir):
    """Find where to hook Firestore calls"""
    print("\nSearching for Firestore hook points...")

    hook_points = []
    smali_dirs = list(decompiled_dir.glob("smali*/"))

    for smali_dir in smali_dirs:
        for smali_file in smali_dir.rglob("*.smali"):
            content = smali_file.read_text(errors='ignore')

            # Look for DocumentSnapshot.getData() calls
            if 'DocumentSnapshot;->getData()' in content:
                hook_points.append(smali_file)
                print(f"  Found hook point: {smali_file.relative_to(decompiled_dir)}")

    return hook_points


def inject_webhook_sender(decompiled_dir, webhook_url):
    """Inject the webhook sender class"""
    print("\nInjecting webhook sender...")

    smali_dir = decompiled_dir / "smali"
    sender_file = smali_dir / "WebhookSender.smali"

    sender_code = WEBHOOK_SENDER_SMALI
    sender_file.write_text(sender_code)
    print(f"  Created: {sender_file.relative_to(decompiled_dir)}")

    return True


def inject_hook_code(decompiled_dir, webhook_url, hook_points):
    """Inject hook code into signal-related methods"""
    print("\nInjecting hook code...")

    injected = 0

    for hook_file in hook_points:
        content = hook_file.read_text(errors='ignore')

        # Find getData() invocations and add our hook after them
        pattern = r'(invoke-virtual \{[^}]+\}, Lcom/google/firebase/firestore/DocumentSnapshot;->getData\(\)Ljava/util/Map;)'

        def add_hook(match):
            original = match.group(1)
            hook_code = f'''
{original}

    # FoxHook: Send data to webhook
    move-result-object v0
    if-eqz v0, :foxhook_skip

    const-string v1, "{webhook_url}"
    invoke-static {{v0, v1}}, LWebhookHelper;->sendSignal(Ljava/util/Map;Ljava/lang/String;)V

    :foxhook_skip
'''
            return hook_code

        new_content, count = re.subn(pattern, add_hook, content)

        if count > 0:
            hook_file.write_text(new_content)
            print(f"  Injected {count} hook(s) in: {hook_file.name}")
            injected += count

    return injected


def inject_helper_class(decompiled_dir, webhook_url):
    """Inject a simple helper class for webhook calls"""
    print("\nInjecting WebhookHelper class...")

    smali_dir = decompiled_dir / "smali"
    helper_file = smali_dir / "WebhookHelper.smali"

    helper_code = f'''
.class public LWebhookHelper;
.super Ljava/lang/Object;

.method public static sendSignal(Ljava/util/Map;Ljava/lang/String;)V
    .locals 5
    .param p0, "data"
    .param p1, "url"

    if-eqz p0, :return

    # Check if it looks like a signal
    const-string v0, "symbol"
    invoke-interface {{p0, v0}}, Ljava/util/Map;->containsKey(Ljava/lang/Object;)Z
    move-result v0
    if-eqz v0, :check_entry

    goto :is_signal

    :check_entry
    const-string v0, "entryPrice"
    invoke-interface {{p0, v0}}, Ljava/util/Map;->containsKey(Ljava/lang/Object;)Z
    move-result v0
    if-eqz v0, :return

    :is_signal
    # Log that we found a signal
    const-string v0, "FoxHook"
    const-string v1, "Signal detected! Sending to webhook..."
    invoke-static {{v0, v1}}, Landroid/util/Log;->d(Ljava/lang/String;Ljava/lang/String;)I

    # Create JSON
    :try_start
    new-instance v0, Lorg/json/JSONObject;
    invoke-direct {{v0}}, Lorg/json/JSONObject;-><init>()V

    # Add source
    const-string v1, "source"
    const-string v2, "foxsignals_hooked"
    invoke-virtual {{v0, v1, v2}}, Lorg/json/JSONObject;->put(Ljava/lang/String;Ljava/lang/Object;)Lorg/json/JSONObject;

    # Add timestamp
    const-string v1, "timestamp"
    invoke-static {{}}, Ljava/lang/System;->currentTimeMillis()J
    move-result-wide v2
    invoke-virtual {{v0, v1, v2, v3}}, Lorg/json/JSONObject;->put(Ljava/lang/String;J)Lorg/json/JSONObject;

    # Add all map entries
    invoke-interface {{p0}}, Ljava/util/Map;->entrySet()Ljava/util/Set;
    move-result-object v1
    invoke-interface {{v1}}, Ljava/util/Set;->iterator()Ljava/util/Iterator;
    move-result-object v1

    :loop
    invoke-interface {{v1}}, Ljava/util/Iterator;->hasNext()Z
    move-result v2
    if-eqz v2, :send

    invoke-interface {{v1}}, Ljava/util/Iterator;->next()Ljava/lang/Object;
    move-result-object v2
    check-cast v2, Ljava/util/Map$Entry;

    invoke-interface {{v2}}, Ljava/util/Map$Entry;->getKey()Ljava/lang/Object;
    move-result-object v3

    invoke-interface {{v2}}, Ljava/util/Map$Entry;->getValue()Ljava/lang/Object;
    move-result-object v4

    invoke-virtual {{v0, v3, v4}}, Lorg/json/JSONObject;->put(Ljava/lang/String;Ljava/lang/Object;)Lorg/json/JSONObject;

    goto :loop

    :send
    # Send in background thread
    new-instance v1, LWebhookSender;
    invoke-virtual {{v0}}, Lorg/json/JSONObject;->toString()Ljava/lang/String;
    move-result-object v0
    invoke-direct {{v1, p1, v0}}, LWebhookSender;-><init>(Ljava/lang/String;Ljava/lang/String;)V

    new-instance v2, Ljava/lang/Thread;
    invoke-direct {{v2, v1}}, Ljava/lang/Thread;-><init>(Ljava/lang/Runnable;)V
    invoke-virtual {{v2}}, Ljava/lang/Thread;->start()V

    :try_end
    .catch Ljava/lang/Exception; {{:try_start .. :try_end}} :catch

    :catch
    :return
    return-void
.end method
'''

    helper_file.write_text(helper_code)
    print(f"  Created: WebhookHelper.smali")

    return True


def add_internet_permission(decompiled_dir):
    """Add INTERNET permission to AndroidManifest.xml"""
    print("\nAdding INTERNET permission...")

    manifest_file = decompiled_dir / "AndroidManifest.xml"
    content = manifest_file.read_text()

    if 'android.permission.INTERNET' not in content:
        content = content.replace(
            '<manifest',
            '<manifest xmlns:android="http://schemas.android.com/apk/res/android"',
            1
        )
        content = content.replace(
            '</manifest>',
            '    <uses-permission android:name="android.permission.INTERNET"/>\n</manifest>'
        )
        manifest_file.write_text(content)
        print("  Added INTERNET permission")
    else:
        print("  INTERNET permission already exists")

    return True


def rebuild_apk(decompiled_dir, output_apk):
    """Rebuild the APK"""
    print(f"\nRebuilding APK...")

    result = run_command(["apktool", "b", str(decompiled_dir), "-o", str(output_apk)])
    if result is None:
        return False

    print(f"  Built: {output_apk}")
    return True


def sign_apk(apk_path):
    """Sign the APK"""
    print("\nSigning APK...")

    # Create a simple keystore if it doesn't exist
    keystore = Path("foxhook.keystore")

    if not keystore.exists():
        print("  Creating keystore...")
        run_command([
            "keytool", "-genkey", "-v",
            "-keystore", str(keystore),
            "-alias", "foxhook",
            "-keyalg", "RSA",
            "-keysize", "2048",
            "-validity", "10000",
            "-storepass", "foxhook123",
            "-keypass", "foxhook123",
            "-dname", "CN=FoxHook, OU=FoxHook, O=FoxHook, L=Unknown, ST=Unknown, C=XX"
        ])

    # Sign with apksigner or jarsigner
    signed_apk = apk_path.with_stem(apk_path.stem + "_signed")

    # Try apksigner first
    result = subprocess.run(["apksigner", "version"], capture_output=True)
    if result.returncode == 0:
        run_command([
            "apksigner", "sign",
            "--ks", str(keystore),
            "--ks-pass", "pass:foxhook123",
            "--out", str(signed_apk),
            str(apk_path)
        ])
    else:
        # Fall back to jarsigner
        shutil.copy(apk_path, signed_apk)
        run_command([
            "jarsigner",
            "-keystore", str(keystore),
            "-storepass", "foxhook123",
            str(signed_apk),
            "foxhook"
        ])

    print(f"  Signed: {signed_apk}")
    return signed_apk


def main():
    if len(sys.argv) < 3:
        print("Usage: python patch_foxsignals.py <foxsignals.apk> <webhook_url>")
        print("")
        print("Example:")
        print("  python patch_foxsignals.py foxsignals.apk https://myserver.com/webhook")
        sys.exit(1)

    apk_path = Path(sys.argv[1])
    webhook_url = sys.argv[2]

    if not apk_path.exists():
        print(f"ERROR: APK not found: {apk_path}")
        sys.exit(1)

    print("=" * 60)
    print("FoxSignals APK Patcher")
    print("=" * 60)
    print(f"APK: {apk_path}")
    print(f"Webhook: {webhook_url}")
    print("=" * 60)

    # Check requirements
    if not check_requirements():
        sys.exit(1)

    # Setup paths
    decompiled_dir = Path("foxsignals_decompiled")
    output_apk = Path("foxsignals_patched.apk")

    # Decompile
    if not decompile_apk(apk_path, decompiled_dir):
        print("ERROR: Failed to decompile APK")
        sys.exit(1)

    # Find hook points
    hook_points = find_firestore_hook_point(decompiled_dir)
    signal_classes = find_signal_classes(decompiled_dir)

    if not hook_points and not signal_classes:
        print("\nWARNING: Could not find obvious hook points.")
        print("The APK might be obfuscated. Manual analysis may be required.")

    # Inject our code
    inject_webhook_sender(decompiled_dir, webhook_url)
    inject_helper_class(decompiled_dir, webhook_url)

    if hook_points:
        inject_hook_code(decompiled_dir, webhook_url, hook_points)

    # Add permissions
    add_internet_permission(decompiled_dir)

    # Rebuild
    if not rebuild_apk(decompiled_dir, output_apk):
        print("ERROR: Failed to rebuild APK")
        sys.exit(1)

    # Sign
    signed_apk = sign_apk(output_apk)

    # Cleanup
    print("\nCleaning up...")
    # shutil.rmtree(decompiled_dir)  # Uncomment to auto-cleanup

    print("\n" + "=" * 60)
    print("DONE!")
    print("=" * 60)
    print(f"\nPatched APK: {signed_apk}")
    print("\nNext steps:")
    print("1. Uninstall the original FoxSignals app")
    print("2. Install the patched APK on your device")
    print("3. Allow 'Install from unknown sources' if prompted")
    print("4. Login to FoxSignals")
    print("5. Signals will be sent to your webhook!")


if __name__ == "__main__":
    main()
