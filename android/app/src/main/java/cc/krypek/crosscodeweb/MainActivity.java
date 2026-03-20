package cc.krypek.crosscodeweb;

import com.getcapacitor.BridgeActivity;

import android.os.Bundle;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends BridgeActivity {
    private ExecutorService executor = Executors.newCachedThreadPool();

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Rumble rumble = new Rumble(this);
        FileFetch fileFetch = new FileFetch(this);
        Fullscreen fullscreen = new Fullscreen(this);

        WebView webView = getBridge().getWebView();
        if (webView != null) {
            webView.addJavascriptInterface(new Object() {
                @JavascriptInterface
                public void reportRumble(double strength, double effectDuration) {
                    runOnUiThread(() -> rumble.reportRumble(strength, effectDuration));
                }

                @JavascriptInterface
                public void setFullscreen() {
                    runOnUiThread(() -> fullscreen.enterImmersiveMode());
                }

                @JavascriptInterface
                public void fetchBinary(String url, String callbackId) {
                    executor.execute(() -> {
                        final String prefix = "window._crosscodeWebCallbacks.fetchBinary.";
                        try {
                            byte[] data = fileFetch.fetchBinary(url);
                            String base64 = Base64.encodeToString(data, Base64.NO_WRAP);
                            String js = prefix + "success('" + callbackId + "', '" + base64
                                    + "');";
                            runOnUiThread(() -> webView.evaluateJavascript(js, null));
                        } catch (Exception e) {
                            String errorMsg = e.getMessage().replace("'", "\\'");
                            String js = prefix + "error('" + callbackId + "', '" + errorMsg + "');";
                            runOnUiThread(() -> webView.evaluateJavascript(js, null));
                        }
                    });
                }
            }, "CrosscodeWebAndroidNative");
        }
    }
}
