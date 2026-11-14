package com.runriver.app;

import static org.junit.Assert.*;
import android.Manifest;
import android.app.Application;
import android.content.Context;
import android.content.Intent;
import android.location.Location;
import android.location.LocationManager;
import android.os.SystemClock;
import java.time.Duration;
import org.json.JSONObject;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.android.controller.ServiceController;
import org.robolectric.annotation.Config;
import org.robolectric.shadows.ShadowSystemClock;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = 28)
public class RunLocationServiceTest {
    private ServiceController<RunLocationService> controller;
    private RunLocationService service;

    @Before public void start() throws Exception {
        ShadowSystemClock.advanceBy(Duration.ofSeconds(1));
        Application app = RuntimeEnvironment.getApplication();
        app.deleteDatabase("run-river.db");
        Shadows.shadowOf(app).grantPermissions(Manifest.permission.ACCESS_FINE_LOCATION);
        LocationManager manager = (LocationManager)app.getSystemService(Context.LOCATION_SERVICE);
        Shadows.shadowOf(manager).setProviderEnabled(LocationManager.GPS_PROVIDER, true);
        try (RunStore store = new RunStore(app)) {
            store.save(new JSONObject().put("config", new JSONObject().put("runId", "native-test").put("activityType", "walking"))
                .put("status", "paused").put("elapsedMs", 0).put("distanceKm", 0), null);
        }
        controller = Robolectric.buildService(RunLocationService.class).create();
        service = controller.get();
        service.onStartCommand(new Intent(app, RunLocationService.class), 0, 1);
    }
    @After public void stop() { controller.destroy(); }

    private Location fix(double latitude) {
        Location fix = new Location(LocationManager.GPS_PROVIDER);
        fix.setLatitude(latitude); fix.setLongitude(127); fix.setAccuracy(5);
        fix.setTime(System.currentTimeMillis()); fix.setElapsedRealtimeNanos(SystemClock.elapsedRealtimeNanos());
        return fix;
    }

    @Test public void gpsPersistsWithoutWebViewAndPauseStopsAccumulation() throws Exception {
        service.onLocationChanged(fix(37.6));
        ShadowSystemClock.advanceBy(Duration.ofSeconds(5));
        service.onLocationChanged(fix(37.6001));
        try (RunStore store = new RunStore(service)) {
            assertEquals(2, store.points().length());
            assertTrue(store.state().getDouble("distanceKm") > 0.01);
        }
        service.pause();
        long elapsed = service.snapshot().getLong("elapsedMs");
        ShadowSystemClock.advanceBy(Duration.ofMinutes(2));
        service.onLocationChanged(fix(37.601));
        assertEquals(elapsed, service.snapshot().getLong("elapsedMs"));
        try (RunStore store = new RunStore(service)) {
            assertEquals("paused", store.state().getString("status"));
            assertEquals(2, store.points().length());
        }
    }

    @Test public void longGapReanchorsInsteadOfInventingDistance() throws Exception {
        service.onLocationChanged(fix(37.6));
        ShadowSystemClock.advanceBy(Duration.ofSeconds(40));
        service.onLocationChanged(fix(37.61));
        assertEquals(0, service.snapshot().getDouble("distanceKm"), 0.000001);
        ShadowSystemClock.advanceBy(Duration.ofSeconds(5));
        service.onLocationChanged(fix(37.6101));
        assertTrue(service.snapshot().getDouble("distanceKm") > 0.01);
    }
}
