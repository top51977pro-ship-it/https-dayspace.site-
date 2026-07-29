# Keep the JavaScript-facing WebView plumbing intact if minify is ever enabled.
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
