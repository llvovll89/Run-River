package com.runriver.app;

import android.Manifest;
import android.content.Intent;
import android.os.Build;
import com.getcapacitor.*;
import com.getcapacitor.annotation.*;
import org.json.JSONObject;
import java.util.UUID;
import androidx.activity.result.ActivityResult;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

@CapacitorPlugin(name = "NativeRun", permissions = {
    @Permission(alias = "location", strings = {Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION}),
    @Permission(alias = "notifications", strings = {Manifest.permission.POST_NOTIFICATIONS})
})
public final class NativeRunPlugin extends Plugin {
    @PluginMethod public void saveGpx(PluginCall call) {
        String xml = call.getString("gpx", "");
        String filename = call.getString("filename", "run-river.gpx");
        if (xml.isEmpty() || xml.length() > 5 * 1024 * 1024 || !filename.matches("[a-zA-Z0-9._-]{1,120}\\.gpx")) {
            call.reject("내보낼 GPX 파일을 확인해주세요."); return;
        }
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT).setType("application/gpx+xml")
            .addCategory(Intent.CATEGORY_OPENABLE).putExtra(Intent.EXTRA_TITLE, filename);
        startActivityForResult(call, intent, "gpxDestination");
    }
    @ActivityCallback private void gpxDestination(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != android.app.Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            call.reject("GPX 저장을 취소했어요."); return;
        }
        android.net.Uri destination = result.getData().getData();
        getBridge().execute(() -> {
            try (OutputStream output = getContext().getContentResolver().openOutputStream(destination, "wt")) {
                if (output == null) throw new java.io.IOException("선택한 위치에 GPX를 저장하지 못했어요.");
                output.write(call.getString("gpx", "").getBytes(StandardCharsets.UTF_8));
                output.flush(); call.resolve();
            } catch (Exception error) { call.reject(error.getMessage(), error); }
        });
    }
    @PluginMethod public void start(PluginCall call) {
        if (getPermissionState("location") != PermissionState.GRANTED ||
            (Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") == PermissionState.PROMPT)) {
            String[] aliases = Build.VERSION.SDK_INT >= 33 ? new String[]{"location", "notifications"} : new String[]{"location"};
            requestPermissionForAliases(aliases, call, "locationGranted"); return;
        }
        startGranted(call);
    }
    @PermissionCallback private void locationGranted(PluginCall call) {
        if (getPermissionState("location") != PermissionState.GRANTED) { call.reject("정확한 위치 권한을 허용해주세요."); return; }
        startGranted(call);
    }
    private void startGranted(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try (RunStore store = new RunStore(getContext())) {
                JSONObject old = store.state();
                if (old != null) throw new IllegalStateException("진행 중이거나 아직 내보내지 않은 운동이 있어요. 먼저 복구해주세요.");
                JSObject config = call.getObject("config");
                if (config == null || config.optJSONObject("startPoint") == null) throw new IllegalArgumentException("운동 설정이 없어요.");
                String type = config.optString("activityType");
                if (!"running".equals(type) && !"walking".equals(type) && !"hiking".equals(type)) throw new IllegalArgumentException("지원하지 않는 운동 종류입니다.");
                if (config.has("intervalPreset")) throw new IllegalArgumentException("네이티브 인터벌 기록은 아직 지원하지 않아요. 거리·시간 목표를 선택해주세요.");
                if (!config.has("runId")) config.put("runId", UUID.randomUUID().toString());
                store.save(new JSONObject().put("config", config).put("status", "paused").put("elapsedMs", 0)
                    .put("distanceKm", 0).put("elevationGain", 0).put("elevationLoss", 0).put("updatedAt", System.currentTimeMillis()), null);
                launch(); call.resolve();
            } catch (Exception error) { call.reject(error.getMessage(), error); }
        });
    }
    private void launch() {
        Intent intent = new Intent(getContext(), RunLocationService.class);
        if (Build.VERSION.SDK_INT >= 26) getContext().startForegroundService(intent);
        else getContext().startService(intent);
    }
    @PluginMethod public void resume(PluginCall call) {
        if (getPermissionState("location") != PermissionState.GRANTED) { requestPermissionForAlias("location", call, "resumeGranted"); return; }
        resumeGranted(call);
    }
    @PermissionCallback private void resumeGranted(PluginCall call) {
        if (getPermissionState("location") != PermissionState.GRANTED) { call.reject("정확한 위치 권한을 허용해주세요."); return; }
        getActivity().runOnUiThread(() -> {
            try (RunStore store = new RunStore(getContext())) {
                JSONObject state = store.state();
                if (state == null || "finished".equals(state.optString("status"))) throw new IllegalStateException("재개할 운동이 없어요.");
                launch(); call.resolve();
            } catch (Exception error) { call.reject(error.getMessage(), error); }
        });
    }
    @PluginMethod public void pause(PluginCall call) { change(call, false); }
    @PluginMethod public void finish(PluginCall call) { change(call, true); }
    private void change(PluginCall call, boolean finish) {
        getActivity().runOnUiThread(() -> {
            try (RunStore store = new RunStore(getContext())) {
                if (RunLocationService.instance != null) RunLocationService.instance.pause();
                JSONObject state = store.state();
                if (state == null) throw new IllegalStateException("운동 기록이 없어요.");
                state.put("status", finish ? "finished" : "paused"); store.save(state, null); call.resolve();
            } catch (Exception error) { call.reject(error.getMessage(), error); }
        });
    }
    @PluginMethod public void snapshot(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try (RunStore store = new RunStore(getContext())) {
                JSONObject state = RunLocationService.instance != null ? RunLocationService.instance.snapshot() : store.state();
                if (state != null && RunLocationService.instance == null && "recording".equals(state.optString("status"))) {
                    // A killed process cannot claim that its missing time was tracked.
                    state.put("status", "paused").put("error", "앱이 중단되어 마지막 저장 지점에서 일시정지했어요."); store.save(state, null);
                }
                JSObject result = new JSObject();
                if (state != null) { state.put("trackPoints", store.points()); result.put("run", state); }
                else result.put("run", JSONObject.NULL);
                call.resolve(result);
            } catch (Exception error) { call.reject(error.getMessage(), error); }
        });
    }
    @PluginMethod public void acknowledge(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try (RunStore store = new RunStore(getContext())) { store.clear(call.getString("runId", "")); call.resolve(); }
            catch (Exception error) { call.reject(error.getMessage(), error); }
        });
    }
}
