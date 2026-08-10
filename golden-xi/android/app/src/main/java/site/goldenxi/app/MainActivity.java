package site.goldenxi.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;

/**
 * Golden XI — Ultimate Football.
 * A single full-screen, landscape WebView that hosts the bundled HTML5 match engine
 * from app assets. No network access is required to play.
 *
 * Assets are served over the reserved virtual origin
 * {@code https://appassets.androidplatform.net/assets/…} via request interception,
 * instead of a raw {@code file://} URL. A real (https) origin is required so the
 * rigged-player GLB models can be fetched by three.js at runtime — WebView blocks
 * cross-file XHR/fetch from {@code file://} pages by default, which would otherwise
 * force the game onto its low-detail procedural fallback players.
 */
public class MainActivity extends Activity {

    private static final String ASSET_HOST = "appassets.androidplatform.net";
    private static final String ASSET_PREFIX = "/assets/";
    private static final String START_URL =
            "https://" + ASSET_HOST + ASSET_PREFIX + "www/index.html";

    private static final Map<String, String> MIME = new HashMap<>();
    static {
        MIME.put("html", "text/html");
        MIME.put("js", "text/javascript");
        MIME.put("css", "text/css");
        MIME.put("json", "application/json");
        MIME.put("glb", "model/gltf-binary");
        MIME.put("png", "image/png");
        MIME.put("jpg", "image/jpeg");
        MIME.put("jpeg", "image/jpeg");
        MIME.put("svg", "image/svg+xml");
        MIME.put("wasm", "application/wasm");
    }

    private WebView web;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        requestWindowFeature(Window.FEATURE_NO_TITLE);

        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                final Uri url = request.getUrl();
                if (ASSET_HOST.equals(url.getHost())) {
                    return serveAsset(url.getPath());
                }
                return super.shouldInterceptRequest(view, request);
            }
        });
        web.setBackgroundColor(0xFF0A1410);

        setContentView(web);
        web.loadUrl(START_URL);
    }

    /** Map a virtual "/assets/www/…" path onto a bundled asset and stream it back. */
    private WebResourceResponse serveAsset(String path) {
        if (path == null || !path.startsWith(ASSET_PREFIX)) {
            return notFound(path);
        }
        final String assetPath = path.substring(ASSET_PREFIX.length());   // e.g. www/models/…glb
        try {
            final InputStream in = getAssets().open(assetPath);
            final WebResourceResponse res = new WebResourceResponse(mimeOf(assetPath), null, in);
            final Map<String, String> headers = new HashMap<>();
            headers.put("Access-Control-Allow-Origin", "*");   // same-origin already, kept for safety
            res.setResponseHeaders(headers);
            return res;
        } catch (IOException e) {
            return notFound(assetPath);
        }
    }

    private WebResourceResponse notFound(String what) {
        final byte[] body = ("404 Not Found: " + what).getBytes();
        return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found",
                new HashMap<String, String>(), new ByteArrayInputStream(body));
    }

    private static String mimeOf(String assetPath) {
        final int dot = assetPath.lastIndexOf('.');
        final String ext = dot >= 0 ? assetPath.substring(dot + 1).toLowerCase() : "";
        final String mime = MIME.get(ext);
        return mime != null ? mime : "application/octet-stream";
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    private void hideSystemBars() {
        View decor = getWindow().getDecorView();
        decor.setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) {
            web.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
