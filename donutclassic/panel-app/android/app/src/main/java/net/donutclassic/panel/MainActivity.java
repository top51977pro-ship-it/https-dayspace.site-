package net.donutclassic.panel;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Iterator;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * DonutClassic admin panel. The UI is bundled HTML/JS served from app assets; HTTP calls go through a
 * native bridge (no CORS) and are restricted to api.exaroton.com. The API key never leaves the device
 * except in requests to exaroton.
 */
public class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String START = "https://" + HOST + "/assets/www/index.html";
    private WebView web;
    private final ExecutorService pool = Executors.newFixedThreadPool(4);

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        web.addJavascriptInterface(new Bridge(), "Native");
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                if (!HOST.equals(u.getHost()) || u.getPath() == null || !u.getPath().startsWith("/assets/")) return null;
                String path = u.getPath().substring("/assets/".length());
                try {
                    InputStream in = getAssets().open(path);
                    String mime = path.endsWith(".js") ? "text/javascript" : path.endsWith(".css") ? "text/css" : path.endsWith(".svg") ? "image/svg+xml" : "text/html";
                    return new WebResourceResponse(mime, "utf-8", in);
                } catch (IOException e) { return null; }
            }
            @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) { return !HOST.equals(r.getUrl().getHost()); }
        });
        setContentView(web);
        web.loadUrl(START);
    }

    @Override public void onBackPressed() { if (web.canGoBack()) web.goBack(); else super.onBackPressed(); }

    final class Bridge {
        /** Async HTTP: result delivered to window.__native(id, status, body). Only https://api.exaroton.com is allowed. */
        @JavascriptInterface
        public void request(final String id, final String method, final String url, final String headersJson, final String body) {
            pool.execute(() -> {
                int status; String text;
                try {
                    URL u = new URL(url);
                    if (!"https".equals(u.getProtocol()) || !"api.exaroton.com".equals(u.getHost())) throw new IOException("Blocked host: " + u.getHost());
                    HttpURLConnection c = (HttpURLConnection) u.openConnection();
                    c.setConnectTimeout(15000); c.setReadTimeout(20000);
                    c.setRequestMethod(method);
                    c.setRequestProperty("User-Agent", "DonutClassicPanel/1.0");
                    JSONObject h = new JSONObject(headersJson == null || headersJson.isEmpty() ? "{}" : headersJson);
                    for (Iterator<String> it = h.keys(); it.hasNext(); ) { String k = it.next(); c.setRequestProperty(k, h.getString(k)); }
                    if (body != null && !body.isEmpty()) {
                        c.setDoOutput(true);
                        try (OutputStream o = c.getOutputStream()) { o.write(body.getBytes(StandardCharsets.UTF_8)); }
                    }
                    status = c.getResponseCode();
                    InputStream in = status >= 400 ? c.getErrorStream() : c.getInputStream();
                    text = in == null ? "" : read(in);
                    c.disconnect();
                } catch (Exception e) { status = 0; text = String.valueOf(e.getMessage()); }
                final String js = "window.__native(" + JSONObject.quote(id) + "," + status + "," + JSONObject.quote(text) + ")";
                runOnUiThread(() -> web.evaluateJavascript(js, null));
            });
        }
    }

    private static String read(InputStream in) throws IOException {
        ByteArrayOutputStream bo = new ByteArrayOutputStream();
        byte[] buf = new byte[16384]; int n;
        while ((n = in.read(buf)) > 0) { bo.write(buf, 0, n); if (bo.size() > 20_000_000) break; }
        in.close();
        return bo.toString("UTF-8");
    }
}
