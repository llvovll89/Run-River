package com.runriver.app;

import android.app.Activity;
import android.content.Intent;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.*;
import com.getcapacitor.annotation.*;
import java.io.*;
import java.net.*;
import org.json.JSONArray;
import org.json.JSONObject;

@CapacitorPlugin(name = "NativeMaps")
public final class NativeMapsPlugin extends Plugin {
    @PluginMethod public void pick(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT).setType("*/*").addCategory(Intent.CATEGORY_OPENABLE);
        startActivityForResult(call, intent, "picked");
    }
    @ActivityCallback private void picked(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) { call.reject("지도 선택을 취소했어요."); return; }
        android.net.Uri uri = result.getData().getData();
        getBridge().execute(() -> {
            try (InputStream input = getContext().getContentResolver().openInputStream(uri)) {
                if (input == null) throw new IOException("지도 파일을 열지 못했어요.");
                String id = new MapFiles(getContext().getFilesDir()).copy(input);
                call.resolve(new JSObject().put("id", id));
            } catch (Exception error) { call.reject(error.getMessage(), error); }
        });
    }
    @PluginMethod public void download(PluginCall call) {
        getBridge().execute(() -> {
            HttpURLConnection connection = null;
            try {
                URL url = new URL(call.getString("url", ""));
                if (!"https".equals(url.getProtocol())) throw new IOException("HTTPS 지도 주소만 사용할 수 있어요.");
                connection = (HttpURLConnection)url.openConnection();
                connection.setInstanceFollowRedirects(false); connection.setConnectTimeout(20000); connection.setReadTimeout(30000);
                connection.setRequestProperty("User-Agent", "RunRiver-OfflineMaps/1.0");
                if (connection.getResponseCode() != 200) throw new IOException("지도를 다운로드하지 못했어요. 연결을 확인해주세요.");
                long length = connection.getContentLengthLong();
                if (length > MapFiles.MAX_BYTES) throw new IOException("지도 크기가 200MB를 넘어요.");
                try (InputStream input = connection.getInputStream()) {
                    String id = new MapFiles(getContext().getFilesDir()).copy(input, call.getString("sha256"));
                    call.resolve(new JSObject().put("id", id));
                }
            } catch (Exception error) { call.reject(error.getMessage(), error); }
            finally { if (connection != null) connection.disconnect(); }
        });
    }
    @PluginMethod public void list(PluginCall call) {
        getBridge().execute(() -> {
            try {
                JSONArray maps = new JSONArray();
                for (File file : new MapFiles(getContext().getFilesDir()).list()) maps.put(new JSONObject().put("id", file.getName().replace(".pmtiles", "")).put("size", file.length()));
                call.resolve(new JSObject().put("maps", maps));
            } catch (Exception error) { call.reject(error.getMessage(), error); }
        });
    }
    @PluginMethod public void read(PluginCall call) {
        getBridge().execute(() -> {
            try {
                byte[] bytes = new MapFiles(getContext().getFilesDir()).read(call.getString("id"), call.getLong("offset", -1L), call.getInt("length", -1));
                call.resolve(new JSObject().put("base64", Base64.encodeToString(bytes, Base64.NO_WRAP)));
            } catch (Exception error) { call.reject(error.getMessage(), error); }
        });
    }
    @PluginMethod public void delete(PluginCall call) {
        getBridge().execute(() -> {
            try { new MapFiles(getContext().getFilesDir()).delete(call.getString("id")); call.resolve(); }
            catch (Exception error) { call.reject(error.getMessage(), error); }
        });
    }
}
