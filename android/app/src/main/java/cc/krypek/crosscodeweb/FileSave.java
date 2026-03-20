package cc.krypek.crosscodeweb;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

public class FileSave {
    private final Activity activity;

    public FileSave(Activity activity) {
        this.activity = activity;
    }

    public String saveFile(byte[] data, String fileName) throws Exception {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ContentValues values = new ContentValues();
            values.put(MediaStore.Downloads.DISPLAY_NAME, fileName);
            values.put(MediaStore.Downloads.MIME_TYPE, "application/octet-stream");
            values.put(MediaStore.Downloads.IS_PENDING, 1);

            ContentResolver resolver = activity.getContentResolver();
            android.net.Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);

            if (uri == null) {
                throw new Exception("Failed to create file in MediaStore");
            }

            try (OutputStream os = resolver.openOutputStream(uri)) {
                if (os == null) {
                    throw new Exception("Failed to open output stream");
                }
                os.write(data);
            }

            values.clear();
            values.put(MediaStore.Downloads.IS_PENDING, 0);
            resolver.update(uri, values, null, null);

            return "Downloads/" + fileName;
        } else {
            File downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
            File file = new File(downloadsDir, fileName);

            try (FileOutputStream fos = new FileOutputStream(file)) {
                fos.write(data);
            }

            return file.getAbsolutePath();
        }
    }
}
