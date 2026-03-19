package cc.krypek.crosscodeweb;

import com.getcapacitor.BridgeActivity;

import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.widget.Toast;
import android.content.Context;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.util.Log;

import java.lang.Math;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Rumble rumble = new Rumble(this);

        WebView webView = getBridge().getWebView();
        if (webView != null) {
            webView.addJavascriptInterface(new Object() {
                @JavascriptInterface
                public void reportRumble(double strength, double effectDuration) {
                    runOnUiThread(() -> rumble.reportRumble(strength, effectDuration));
                }
            }, "CrosscodeWebAndroidNative");
        }
    }
}

class Rumble {
    private final Vibrator vibrator;

    public static final double MAX_RUMBLE_STRENGTH = 15.0;
    public static final int MAX_VIB_AMPLITUDE = 255;
    public static final int MAX_VIB_DURATION_MILLIS = 40;
    public static final double NORMAL_EFFECT_DURATION = 0.2;

    public Rumble(BridgeActivity activity) {
        this.vibrator = (Vibrator) activity.getSystemService(Context.VIBRATOR_SERVICE);
    }

    public void reportRumble(double strength, double effectDuration) {
        try {
            if (strength > 15) {
                Log.e("CrossCode", "Received a rumble strength that is larger than rumbles should get!");
                return;
            }

            if (effectDuration > 0.2) {
                // Effect is too slow - less of a screen shake and more of a screen-wobbling
                return;
            }

            int vibrationAmplitude = (int) Math.min(
                    Math.ceil(MAX_VIB_AMPLITUDE * (strength / MAX_RUMBLE_STRENGTH) * NORMAL_EFFECT_DURATION
                            / effectDuration),
                    255.0);
            long vibrationDuration = (long) Math.ceil(MAX_VIB_DURATION_MILLIS * (strength / MAX_RUMBLE_STRENGTH));

            if (vibrationAmplitude == 0 || vibrationDuration == 0L) {
                Log.w("CrossCode", "Rumble strength is too small!");
                return;
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator.vibrate(VibrationEffect.createOneShot(vibrationDuration, vibrationAmplitude));
            } else {
                vibrator.vibrate(vibrationDuration);
            }
        } catch (Exception ex) {
            Thread.getDefaultUncaughtExceptionHandler().uncaughtException(Thread.currentThread(), ex);
            throw ex;
        }
    }
}
