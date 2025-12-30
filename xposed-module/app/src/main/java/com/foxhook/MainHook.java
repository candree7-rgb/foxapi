package com.foxhook;

import de.robv.android.xposed.IXposedHookLoadPackage;
import de.robv.android.xposed.XC_MethodHook;
import de.robv.android.xposed.XposedBridge;
import de.robv.android.xposed.XposedHelpers;
import de.robv.android.xposed.callbacks.XC_LoadPackage;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Map;
import java.util.HashMap;
import org.json.JSONObject;

public class MainHook implements IXposedHookLoadPackage {

    // WICHTIG: Hier deine Webhook URL eintragen!
    private static final String WEBHOOK_URL = "https://YOUR-WEBHOOK-URL.com/signal";

    private static final String TARGET_PACKAGE = "live.beedo.foxsignals";

    @Override
    public void handleLoadPackage(XC_LoadPackage.LoadPackageParam lpparam) throws Throwable {
        if (!lpparam.packageName.equals(TARGET_PACKAGE)) {
            return;
        }

        XposedBridge.log("[FoxHook] Loaded in FoxSignals app!");

        // Hook Firebase Firestore DocumentSnapshot
        hookFirestoreDocumentSnapshot(lpparam);

        // Hook Firebase Firestore QuerySnapshot
        hookFirestoreQuerySnapshot(lpparam);

        // Hook the Signal model class directly
        hookSignalModel(lpparam);
    }

    private void hookFirestoreDocumentSnapshot(XC_LoadPackage.LoadPackageParam lpparam) {
        try {
            Class<?> documentSnapshotClass = XposedHelpers.findClass(
                "com.google.firebase.firestore.DocumentSnapshot",
                lpparam.classLoader
            );

            // Hook getData() method
            XposedHelpers.findAndHookMethod(documentSnapshotClass, "getData", new XC_MethodHook() {
                @Override
                protected void afterHookedMethod(MethodHookParam param) throws Throwable {
                    Object result = param.getResult();
                    if (result != null && result instanceof Map) {
                        Map<String, Object> data = (Map<String, Object>) result;

                        // Check if this looks like a signal
                        if (isSignalData(data)) {
                            XposedBridge.log("[FoxHook] Signal detected!");
                            processSignal(data);
                        }
                    }
                }
            });

            XposedBridge.log("[FoxHook] DocumentSnapshot.getData() hooked!");

        } catch (Exception e) {
            XposedBridge.log("[FoxHook] Error hooking DocumentSnapshot: " + e.getMessage());
        }
    }

    private void hookFirestoreQuerySnapshot(XC_LoadPackage.LoadPackageParam lpparam) {
        try {
            Class<?> queryDocumentSnapshotClass = XposedHelpers.findClass(
                "com.google.firebase.firestore.QueryDocumentSnapshot",
                lpparam.classLoader
            );

            XposedHelpers.findAndHookMethod(queryDocumentSnapshotClass, "getData", new XC_MethodHook() {
                @Override
                protected void afterHookedMethod(MethodHookParam param) throws Throwable {
                    Object result = param.getResult();
                    if (result != null && result instanceof Map) {
                        Map<String, Object> data = (Map<String, Object>) result;

                        if (isSignalData(data)) {
                            XposedBridge.log("[FoxHook] Signal from QuerySnapshot!");
                            processSignal(data);
                        }
                    }
                }
            });

            XposedBridge.log("[FoxHook] QueryDocumentSnapshot hooked!");

        } catch (Exception e) {
            XposedBridge.log("[FoxHook] Error hooking QueryDocumentSnapshot: " + e.getMessage());
        }
    }

    private void hookSignalModel(XC_LoadPackage.LoadPackageParam lpparam) {
        // Try to hook common signal model class names
        String[] possibleClasses = {
            "live.beedo.foxsignals.models.Signal",
            "live.beedo.foxsignals.model.Signal",
            "live.beedo.foxsignals.data.Signal",
            "live.beedo.foxsignals.domain.Signal",
            "signalbyt.models.Signal",
            "signalbyt.model.Signal"
        };

        for (String className : possibleClasses) {
            try {
                Class<?> signalClass = XposedHelpers.findClass(className, lpparam.classLoader);

                // Hook constructor
                XposedHelpers.findAndHookConstructor(signalClass, new XC_MethodHook() {
                    @Override
                    protected void afterHookedMethod(MethodHookParam param) throws Throwable {
                        XposedBridge.log("[FoxHook] Signal object created!");
                        extractSignalFromObject(param.thisObject);
                    }
                });

                XposedBridge.log("[FoxHook] Hooked signal class: " + className);
                break;

            } catch (Exception e) {
                // Class not found, try next
            }
        }
    }

    private boolean isSignalData(Map<String, Object> data) {
        // Check if the data contains signal-related fields
        return data.containsKey("symbol") ||
               data.containsKey("entryPrice") ||
               data.containsKey("stopLoss") ||
               data.containsKey("takeProfit1") ||
               data.containsKey("direction");
    }

    private void processSignal(Map<String, Object> data) {
        try {
            JSONObject signal = new JSONObject();
            signal.put("source", "foxsignals");
            signal.put("timestamp", System.currentTimeMillis());

            // Extract signal fields
            signal.put("symbol", getStringValue(data, "symbol"));
            signal.put("direction", getStringValue(data, "direction"));
            signal.put("entry", getDoubleValue(data, "entryPrice"));
            signal.put("stopLoss", getDoubleValue(data, "stopLoss"));
            signal.put("tp1", getDoubleValue(data, "takeProfit1"));
            signal.put("tp2", getDoubleValue(data, "takeProfit2"));
            signal.put("tp3", getDoubleValue(data, "takeProfit3"));
            signal.put("tp4", getDoubleValue(data, "takeProfit4"));
            signal.put("tp5", getDoubleValue(data, "takeProfit5"));
            signal.put("isFree", getBooleanValue(data, "isFree"));
            signal.put("isPremium", getBooleanValue(data, "isPremium"));
            signal.put("leverage", getDoubleValue(data, "leverage"));

            // Log the signal
            XposedBridge.log("[FoxHook] Signal: " + signal.toString());

            // Send to webhook
            sendToWebhook(signal.toString());

        } catch (Exception e) {
            XposedBridge.log("[FoxHook] Error processing signal: " + e.getMessage());
        }
    }

    private void extractSignalFromObject(Object signalObj) {
        try {
            Class<?> clazz = signalObj.getClass();
            JSONObject signal = new JSONObject();
            signal.put("source", "foxsignals");
            signal.put("timestamp", System.currentTimeMillis());

            // Try to get fields via reflection
            String[] fieldNames = {"symbol", "direction", "entryPrice", "stopLoss",
                                   "takeProfit1", "takeProfit2", "takeProfit3",
                                   "takeProfit4", "takeProfit5", "isFree", "isPremium", "leverage"};

            for (String fieldName : fieldNames) {
                try {
                    Object value = XposedHelpers.getObjectField(signalObj, fieldName);
                    if (value != null) {
                        signal.put(fieldName, value);
                    }
                } catch (Exception e) {
                    // Field doesn't exist
                }
            }

            if (signal.length() > 2) { // More than just source and timestamp
                XposedBridge.log("[FoxHook] Signal from object: " + signal.toString());
                sendToWebhook(signal.toString());
            }

        } catch (Exception e) {
            XposedBridge.log("[FoxHook] Error extracting signal: " + e.getMessage());
        }
    }

    private String getStringValue(Map<String, Object> data, String key) {
        Object value = data.get(key);
        return value != null ? value.toString() : null;
    }

    private Double getDoubleValue(Map<String, Object> data, String key) {
        Object value = data.get(key);
        if (value == null) return null;
        if (value instanceof Number) return ((Number) value).doubleValue();
        try {
            return Double.parseDouble(value.toString());
        } catch (Exception e) {
            return null;
        }
    }

    private Boolean getBooleanValue(Map<String, Object> data, String key) {
        Object value = data.get(key);
        if (value == null) return null;
        if (value instanceof Boolean) return (Boolean) value;
        return Boolean.parseBoolean(value.toString());
    }

    private void sendToWebhook(final String jsonPayload) {
        // Send in background thread
        new Thread(() -> {
            try {
                URL url = new URL(WEBHOOK_URL);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setDoOutput(true);
                conn.setConnectTimeout(10000);
                conn.setReadTimeout(10000);

                try (OutputStream os = conn.getOutputStream()) {
                    byte[] input = jsonPayload.getBytes("utf-8");
                    os.write(input, 0, input.length);
                }

                int responseCode = conn.getResponseCode();
                XposedBridge.log("[FoxHook] Webhook response: " + responseCode);

                conn.disconnect();

            } catch (Exception e) {
                XposedBridge.log("[FoxHook] Webhook error: " + e.getMessage());
            }
        }).start();
    }
}
