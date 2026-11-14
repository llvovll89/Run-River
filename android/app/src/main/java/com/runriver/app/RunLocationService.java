package com.runriver.app;

import android.app.*;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.location.*;
import android.os.*;
import androidx.core.app.NotificationCompat;
import org.json.JSONObject;

/** Started from a visible activity, with a persistent notification. Never auto-restarts. */
public final class RunLocationService extends Service implements LocationListener {
    static RunLocationService instance;
    private static final int NOTIFICATION_ID = 1201;
    private RunStore store;
    private LocationManager manager;
    private JSONObject state;
    private Location anchor;
    private double altitudeAnchor = Double.NaN;
    private long elapsedBase;
    private long segmentStart;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable checkpoint = new Runnable() {
        @Override public void run() {
            if (state == null || !"recording".equals(state.optString("status"))) return;
            try { save(null); handler.postDelayed(this, 5000); }
            catch (Exception error) { fail(error); }
        }
    };

    @Override public void onCreate() {
        super.onCreate(); instance = this;
        store = new RunStore(this);
        manager = (LocationManager)getSystemService(LOCATION_SERVICE);
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        try {
            state = store.state();
            if (state == null || "finished".equals(state.optString("status"))) { stopSelf(); return START_NOT_STICKY; }
            NotificationManager notifications = (NotificationManager)getSystemService(NOTIFICATION_SERVICE);
            if (Build.VERSION.SDK_INT >= 26) notifications.createNotificationChannel(new NotificationChannel("run-recording", "운동 위치 기록", NotificationManager.IMPORTANCE_LOW));
            Intent open = new Intent(this, MainActivity.class);
            PendingIntent pending = PendingIntent.getActivity(this, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            Intent pause = new Intent(this, RunLocationService.class).setAction("pause");
            PendingIntent pauseIntent = PendingIntent.getService(this, 1, pause, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            Notification notification = new NotificationCompat.Builder(this, "run-recording")
                .setSmallIcon(android.R.drawable.ic_menu_mylocation).setContentTitle("Run River · 위치 기록 중")
                .setContentText("화면을 꺼도 기기에 기록합니다. 눌러서 운동으로 돌아가기")
                .setContentIntent(pending).setOngoing(true).addAction(0, "일시정지", pauseIntent).build();
            if (Build.VERSION.SDK_INT >= 29) startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
            else startForeground(NOTIFICATION_ID, notification);
            // Repeated start commands must not create a second GPS subscription.
            if ("pause".equals(intent == null ? null : intent.getAction())) { pause(); return START_NOT_STICKY; }
            if (segmentStart == 0) resume();
        } catch (Exception error) { fail(error); }
        return START_NOT_STICKY;
    }

    void resume() throws Exception {
        if (!manager.isProviderEnabled(LocationManager.GPS_PROVIDER)) throw new IllegalStateException("GPS 위치 서비스를 켜주세요.");
        elapsedBase = state.optLong("elapsedMs"); segmentStart = SystemClock.elapsedRealtime();
        anchor = null; altitudeAnchor = Double.NaN;
        state.put("status", "recording").put("error", JSONObject.NULL);
        save(null);
        manager.requestLocationUpdates(LocationManager.GPS_PROVIDER, 2000, 0, this, Looper.getMainLooper());
        handler.removeCallbacks(checkpoint); handler.postDelayed(checkpoint, 5000);
    }

    void pause() throws Exception {
        if (state == null) state = store.state();
        if (state != null && !"finished".equals(state.optString("status"))) {
            save(null); segmentStart = 0;
            state.put("status", "paused"); store.save(state, null);
        }
        manager.removeUpdates(this); handler.removeCallbacks(checkpoint);
        stopForeground(STOP_FOREGROUND_REMOVE); stopSelf();
    }

    JSONObject snapshot() throws Exception {
        JSONObject copy = new JSONObject(state.toString());
        if (segmentStart != 0) copy.put("elapsedMs", elapsedBase + SystemClock.elapsedRealtime() - segmentStart);
        return copy;
    }

    private void save(JSONObject point) throws Exception {
        if (segmentStart != 0) state.put("elapsedMs", elapsedBase + SystemClock.elapsedRealtime() - segmentStart);
        state.put("updatedAt", System.currentTimeMillis());
        store.save(state, point);
    }

    @Override public void onLocationChanged(Location fix) {
        if (segmentStart == 0) return;
        try {
            if (!fix.hasAccuracy() || fix.getAccuracy() > 40 || !Double.isFinite(fix.getLatitude()) || !Double.isFinite(fix.getLongitude())) return;
            // Reject old or out-of-order fixes. A gap is re-anchored, never filled with an estimate.
            if (Math.abs(SystemClock.elapsedRealtimeNanos() - fix.getElapsedRealtimeNanos()) > 30_000_000_000L) return;
            state.put("lastFixAt", fix.getTime()).put("accuracy", fix.getAccuracy());
            double distance = state.optDouble("distanceKm", 0);
            if (anchor != null) {
                double seconds = (fix.getElapsedRealtimeNanos() - anchor.getElapsedRealtimeNanos()) / 1e9;
                if (seconds <= 0) return;
                float meters = anchor.distanceTo(fix);
                if (seconds > 30) { anchor = null; altitudeAnchor = Double.NaN; }
                else {
                    double maxSpeed = "running".equals(state.getJSONObject("config").optString("activityType")) ? 25 : 9;
                    if (meters < 1 || meters > 50 || meters / seconds * 3.6 > maxSpeed) { save(null); return; }
                    distance += meters / 1000d;
                }
            }
            boolean newSegment = anchor == null;
            anchor = new Location(fix);
            state.put("distanceKm", distance);
            JSONObject point = new JSONObject().put("lat", fix.getLatitude()).put("lng", fix.getLongitude())
                .put("timestamp", fix.getTime()).put("distance_km", distance)
                .put("elapsed_seconds", snapshot().optLong("elapsedMs") / 1000)
                .put("altitude_m", JSONObject.NULL).put("segment_start", newSegment);
            if (fix.hasAltitude() && (Build.VERSION.SDK_INT < 26 || !fix.hasVerticalAccuracy() || fix.getVerticalAccuracyMeters() <= 15)) {
                double altitude = fix.getAltitude();
                if (Double.isFinite(altitude)) {
                    point.put("altitude_m", altitude); state.put("currentAltitude", altitude);
                    if (!state.has("startAltitude")) state.put("startAltitude", altitude);
                    if (Double.isFinite(altitudeAnchor)) {
                        double delta = altitude - altitudeAnchor;
                        if (Math.abs(delta) >= 3 && Math.abs(delta) <= 20) {
                            String key = delta > 0 ? "elevationGain" : "elevationLoss";
                            state.put(key, state.optDouble(key) + Math.abs(delta)); altitudeAnchor = altitude;
                        } else if (Math.abs(delta) > 20) altitudeAnchor = altitude;
                    } else altitudeAnchor = altitude;
                }
            }
            state.put("position", new JSONObject().put("lat", fix.getLatitude()).put("lng", fix.getLongitude()))
                .put("accuracy", fix.getAccuracy()).put("lastFixAt", fix.getTime());
            save(point);
        } catch (Exception error) { fail(error); }
    }

    @Override public void onProviderDisabled(String provider) { fail(new IllegalStateException("GPS가 꺼져 기록을 일시정지했어요. 위치 서비스를 켜고 재개해주세요.")); }
    @Override public void onProviderEnabled(String provider) {}
    @Override public void onStatusChanged(String provider, int status, Bundle extras) {}

    private void fail(Exception error) {
        try { if (state != null) { state.put("error", error.getMessage()); pause(); } }
        catch (Exception ignored) { /* Existing committed SQLite data is retained on disk-full. */ }
        if (manager != null) manager.removeUpdates(this);
        handler.removeCallbacks(checkpoint); segmentStart = 0;
        stopForeground(STOP_FOREGROUND_REMOVE); stopSelf();
    }

    @Override public void onDestroy() {
        try { if (segmentStart != 0) pause(); } catch (Exception ignored) {}
        manager.removeUpdates(this); handler.removeCallbacks(checkpoint); instance = null; store.close();
        super.onDestroy();
    }
    @Override public IBinder onBind(Intent intent) { return null; }
}
