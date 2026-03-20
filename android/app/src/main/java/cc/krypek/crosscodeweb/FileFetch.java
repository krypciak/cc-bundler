package cc.krypek.crosscodeweb;

import android.content.Context;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.util.Log;

import java.io.ByteArrayOutputStream;
import java.lang.Math;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;

public class FileFetch {

    private Vibrator vibrator;

    public FileFetch(Context context) {
        this.vibrator = (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
    }

    public byte[] fetchBinary(String urlString) throws Exception {
        URL url = URI.create(urlString).toURL();
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setRequestMethod("GET");
        connection.setConnectTimeout(10000);
        connection.setReadTimeout(10000);

        try {
            int responseCode = connection.getResponseCode();
            if (responseCode != HttpURLConnection.HTTP_OK) {
                throw new Exception("HTTP error code: " + responseCode);
            }

            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            try (java.io.InputStream inputStream = connection.getInputStream()) {
                byte[] buffer = new byte[4096];
                int bytesRead;
                while ((bytesRead = inputStream.read(buffer)) != -1) {
                    baos.write(buffer, 0, bytesRead);
                }
            }
            return baos.toByteArray();
        } finally {
            connection.disconnect();
        }
    }
}
