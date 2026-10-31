package com.memorylibrary.study;

import android.app.Activity;
import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.Build;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
import android.webkit.MimeTypeMap;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;

/** Bundled local UI with scoped public metadata requests and native reminders. */
public final class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final int PICK_IMAGES = 10, EXPORT_JSON = 11;
    private WebView web;
    private ValueCallback<Uri[]> imageCallback;
    private String pendingExport;
    private boolean pendingTestNotification;
    private boolean notificationPermissionInFlight;
    private static final int NOTIFICATION_PERMISSION = 12;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        ReviewReminder.createChannel(this);
        ReviewReminder.schedule(this);
        getWindow().setStatusBarColor(Color.rgb(242, 239, 224));
        getWindow().setNavigationBarColor(Color.rgb(242, 239, 224));
        getWindow().getDecorView().setSystemUiVisibility(
            android.view.View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR |
            android.view.View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(242, 239, 224));
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        web.addJavascriptInterface(new ExportBridge(), "MemoryExport");
        web.addJavascriptInterface(new ReminderBridge(), "MemoryReminder");
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if ("https".equals(uri.getScheme()) && "memory-library-sync.ksq635279589.chatgpt.site".equals(uri.getHost()) &&
                    uri.getPath() != null && uri.getPath().startsWith("/api/v1/") &&
                    java.util.Arrays.asList("GET", "POST", "PUT", "OPTIONS").contains(request.getMethod())) return null;
                if ("https".equals(uri.getScheme()) && "raw.githubusercontent.com".equals(uri.getHost()) &&
                    "GET".equals(request.getMethod()) && uri.getPath() != null && uri.getPath().startsWith("/TapXWorld/ChinaTextbook/")) return null;
                // Only the public book metadata API needs network access.
                if ("https".equals(uri.getScheme()) && "openlibrary.org".equals(uri.getHost()) &&
                    "GET".equals(request.getMethod()) && uri.getPath() != null &&
                    (uri.getPath().equals("/search.json") || uri.getPath().matches("/works/OL[0-9]+W/editions\\.json"))) return null;
                if (!isLocal(uri) || !"GET".equals(request.getMethod())) return notFound();
                String path = uri.getPath();
                if (path == null || path.contains("..") || path.contains("\\")) return notFound();
                if (request.isForMainFrame() && (path.equals("/") || path.equals("/login") || path.equals("/library") || path.equals("/create") ||
                    path.equals("/mindmap-style") || path.startsWith("/subjects/"))) path = "/index.html";
                String extension = MimeTypeMap.getFileExtensionFromUrl(path);
                String mime = MimeTypeMap.getSingleton().getMimeTypeFromExtension(extension);
                if ("js".equals(extension) || "mjs".equals(extension)) mime = "application/javascript";
                if ("wasm".equals(extension)) mime = "application/wasm";
                if (mime == null) mime = "application/octet-stream";
                try {
                    return new WebResourceResponse(mime, "UTF-8", 200, "OK",
                        Collections.singletonMap("Cache-Control", "no-cache"), getAssets().open("web" + path));
                } catch (IOException error) { return notFound(); }
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !isLocal(request.getUrl());
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                                       FileChooserParams params) {
                if (imageCallback != null) imageCallback.onReceiveValue(null);
                imageCallback = callback;
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("image/*");
                intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE);
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                try { startActivityForResult(intent, PICK_IMAGES); }
                catch (android.content.ActivityNotFoundException error) {
                    imageCallback.onReceiveValue(null); imageCallback = null;
                    toast("当前环境没有图片选择器，请检查卓易通的文件访问设置。");
                }
                return true;
            }
        });
        setContentView(web);
        web.loadUrl("https://" + HOST + "/");
    }

    private static boolean isLocal(Uri uri) {
        return "https".equals(uri.getScheme()) && HOST.equals(uri.getHost()) && uri.getPort() == -1;
    }

    private static WebResourceResponse notFound() {
        return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found",
            Collections.emptyMap(), new ByteArrayInputStream(new byte[0]));
    }

    private void toast(String text) { Toast.makeText(this, text, Toast.LENGTH_LONG).show(); }

    private void reminderChanged() {
        if (web != null && web.getUrl() != null && isLocal(Uri.parse(web.getUrl())))
            web.evaluateJavascript("window.dispatchEvent(new Event('memory-reminder-change'))", null);
    }

    private void testNotification() {
        boolean sent = ReviewReminder.post(this, true);
        ReviewReminder.prefs(this).edit().putString("testMessage", sent ? "已请求发送测试通知，请查看手机通知栏。" : "通知未开启，请允许通知或打开系统通知设置。").apply();
        reminderChanged();
    }

    private boolean requestNotificationPermission() {
        if (notificationPermissionInFlight) return true;
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            notificationPermissionInFlight = true;
            requestPermissions(new String[] { Manifest.permission.POST_NOTIFICATIONS }, NOTIFICATION_PERMISSION);
            return true;
        }
        return false;
    }

    public final class ReminderBridge {
        @JavascriptInterface public String getStatus() { return ReviewReminder.status(MainActivity.this); }
        @JavascriptInterface public void configure(boolean enabled, int hour, int minute) {
            runOnUiThread(() -> {
                ReviewReminder.configure(MainActivity.this, enabled, hour, minute);
                if (enabled) requestNotificationPermission();
                reminderChanged();
            });
        }
        @JavascriptInterface public void syncCards(String json) {
            try { ReviewReminder.sync(MainActivity.this, json); }
            catch (org.json.JSONException error) { runOnUiThread(() -> toast("提醒数据未更新，请保留卡片并重开应用重试。")); }
        }
        @JavascriptInterface public void testNotification() {
            runOnUiThread(() -> {
                pendingTestNotification = true;
                if (!requestNotificationPermission()) { pendingTestNotification = false; MainActivity.this.testNotification(); }
            });
        }
        @JavascriptInterface public void openSettings() {
            runOnUiThread(() -> {
                try { startActivity(new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName())); }
                catch (android.content.ActivityNotFoundException error) { toast("请在卓易通或系统设置中允许通知。"); }
            });
        }
    }

    @Override public void onRequestPermissionsResult(int request, String[] permissions, int[] grants) {
        super.onRequestPermissionsResult(request, permissions, grants);
        if (request == NOTIFICATION_PERMISSION) {
            notificationPermissionInFlight = false;
            if (pendingTestNotification) { pendingTestNotification = false; testNotification(); }
            ReviewReminder.schedule(this);
            reminderChanged();
        }
    }

    @Override protected void onResume() {
        super.onResume();
        reminderChanged();
    }

    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        if (ReviewReminder.OPEN_TODAY.equals(intent.getAction()) && web != null) web.loadUrl("https://" + HOST + "/");
    }

    private final class ExportBridge {
        @JavascriptInterface public void save(String text) {
            if (text == null || text.length() > 10 * 1024 * 1024) return;
            runOnUiThread(() -> {
                if (pendingExport != null) { toast("请先完成上一次导出。"); return; }
                pendingExport = text;
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("application/json");
                intent.putExtra(Intent.EXTRA_TITLE, "mind-map.json");
                try { startActivityForResult(intent, EXPORT_JSON); }
                catch (android.content.ActivityNotFoundException error) {
                    pendingExport = null; toast("当前环境没有文件保存器。");
                }
            });
        }
    }

    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request == PICK_IMAGES && imageCallback != null) {
            ArrayList<Uri> images = new ArrayList<>();
            if (result == RESULT_OK && data != null) {
                if (data.getClipData() != null) {
                    for (int i = 0; i < data.getClipData().getItemCount(); i++)
                        images.add(data.getClipData().getItemAt(i).getUri());
                } else if (data.getData() != null) images.add(data.getData());
            }
            imageCallback.onReceiveValue(images.isEmpty() ? null : images.toArray(new Uri[0]));
            imageCallback = null;
        }
        if (request == EXPORT_JSON) {
            String text = pendingExport; pendingExport = null;
            if (result == RESULT_OK && data != null && data.getData() != null && text != null) {
                try (OutputStream out = getContentResolver().openOutputStream(data.getData())) {
                    if (out == null) throw new IOException("Cannot open output");
                    out.write(text.getBytes(StandardCharsets.UTF_8)); toast("已导出");
                } catch (IOException error) { toast("导出没有成功，请重新选择保存位置。"); }
            }
        }
    }

    @Override public void onBackPressed() {
        web.evaluateJavascript("(function(){var d=document.querySelector('dialog[open]');" +
            "if(d){d.close();return true;}return false;})()", closed -> {
                if (!"true".equals(closed)) {
                    if (web.canGoBack()) web.goBack(); else finish();
                }
            });
    }

    @Override protected void onDestroy() {
        if (imageCallback != null) imageCallback.onReceiveValue(null);
        web.removeJavascriptInterface("MemoryExport");
        web.removeJavascriptInterface("MemoryReminder");
        web.destroy();
        super.onDestroy();
    }
}
