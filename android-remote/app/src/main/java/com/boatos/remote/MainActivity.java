package com.boatos.remote;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.view.inputmethod.InputMethodManager;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebChromeClient;
import android.webkit.SslErrorHandler;
import android.net.http.SslError;

public class MainActivity extends Activity {
    private WebView webView;

    private static final String PREFS_NAME = "BoatOSPrefs";
    private static final String PREF_HOST = "host";
    private static final String DEFAULT_HOST = "192.168.2.222";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Fullscreen mode
        getWindow().setFlags(
            WindowManager.LayoutParams.FLAG_FULLSCREEN,
            WindowManager.LayoutParams.FLAG_FULLSCREEN
        );

        // Hide system UI
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_FULLSCREEN |
            View.SYSTEM_UI_FLAG_HIDE_NAVIGATION |
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
        );

        // Keep screen on
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        // Create WebView
        webView = new WebView(this);
        setContentView(webView);

        // Configure WebView
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setCacheMode(WebSettings.LOAD_NO_CACHE);

        // Handle SSL errors (self-signed certificate)
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
                handler.proceed();
            }
        });

        webView.setWebChromeClient(new WebChromeClient());

        // Long press → Adresse ändern
        webView.setOnLongClickListener(v -> {
            showHostDialog(false);
            return true;
        });

        // Beim ersten Start: Dialog zeigen, sonst direkt laden
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        if (!prefs.contains(PREF_HOST)) {
            showHostDialog(true);
        } else {
            loadRemote();
        }
    }

    private void loadRemote() {
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        String host = prefs.getString(PREF_HOST, DEFAULT_HOST);
        webView.loadUrl("https://" + host + "/remote");
    }

    private void showHostDialog(boolean isFirstLaunch) {
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        String currentHost = prefs.getString(PREF_HOST, DEFAULT_HOST);

        // Layout
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        int pad = (int) (20 * getResources().getDisplayMetrics().density);
        layout.setPadding(pad, pad / 2, pad, 0);

        TextView label = new TextView(this);
        label.setText("IP-Adresse oder Hostname des Pi:");
        label.setTextSize(14);
        layout.addView(label);

        EditText input = new EditText(this);
        input.setText(currentHost);
        input.setSelectAllOnFocus(true);
        input.setSingleLine(true);
        input.setHint("z.B. 192.168.2.222");
        layout.addView(input);

        AlertDialog.Builder builder = new AlertDialog.Builder(this)
            .setTitle("BoatOS Adresse")
            .setView(layout)
            .setCancelable(!isFirstLaunch)
            .setPositiveButton("Verbinden", (dialog, which) -> {
                String host = input.getText().toString().trim();
                if (host.isEmpty()) host = DEFAULT_HOST;
                prefs.edit().putString(PREF_HOST, host).apply();
                loadRemote();
            });

        if (!isFirstLaunch) {
            builder.setNeutralButton("Abbrechen", (dialog, which) -> dialog.dismiss());
        }

        AlertDialog dialog = builder.create();
        dialog.show();

        // Keyboard automatisch zeigen
        input.requestFocus();
        dialog.getWindow().setSoftInputMode(
            WindowManager.LayoutParams.SOFT_INPUT_STATE_VISIBLE
        );
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_FULLSCREEN |
                View.SYSTEM_UI_FLAG_HIDE_NAVIGATION |
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            );
        }
    }
}
