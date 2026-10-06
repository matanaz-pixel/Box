package com.box.app;

import android.app.Activity;
import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.graphics.Color;

public class MainActivity extends Activity {
    private WebView web;

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(247,246,241));
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        web.setWebViewClient(new WebViewClient());
        web.loadUrl("file:///android_asset/www/index.html");
        setContentView(web);
    }
    @Override public void onBackPressed() {
        // Let the web app handle Back (e.g. return to the home view) before exiting.
        // boxBack() מוגדר ב-app.js ומחזיר true אם ה-web טיפל בכפתור (חזרה למסך הבית, סגירת חלון וכו').
        web.evaluateJavascript("(typeof boxBack==='function')?boxBack():false",
            v -> { if (!"true".equals(v)) super.onBackPressed(); });
    }
}
