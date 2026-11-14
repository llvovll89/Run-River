package com.runriver.app;

import static org.junit.Assert.*;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;
import org.json.JSONObject;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = 35)
public class RunStoreTest {
    @Before public void reset() { RuntimeEnvironment.getApplication().deleteDatabase("run-river.db"); }

    @Test public void committedStateAndFixSurviveReopening() throws Exception {
        try (RunStore store = new RunStore(RuntimeEnvironment.getApplication())) {
            store.save(new JSONObject().put("status", "recording").put("config", new JSONObject().put("runId", "run-1")), new JSONObject().put("lat", 37.6).put("lng", 127));
        }
        try (RunStore store = new RunStore(RuntimeEnvironment.getApplication())) {
            assertEquals("recording", store.state().getString("status"));
            assertEquals(1, store.points().length());
            assertEquals(37.6, store.points().getJSONObject(0).getDouble("lat"), 0.000001);
        }
    }

    @Test public void activeOrWrongRunCannotBeDeleted() throws Exception {
        try (RunStore store = new RunStore(RuntimeEnvironment.getApplication())) {
            JSONObject state = new JSONObject().put("status", "paused").put("config", new JSONObject().put("runId", "run-1"));
            store.save(state, new JSONObject().put("lat", 37));
            assertThrows(IllegalStateException.class, () -> store.clear("run-1"));
            state.put("status", "finished"); store.save(state, null);
            assertThrows(IllegalStateException.class, () -> store.clear("other-run"));
            assertEquals(1, store.points().length());
            store.clear("run-1");
            assertNull(store.state()); assertEquals(0, store.points().length());
        }
    }

    @Test public void checkpointDoesNotDuplicatePoints() throws Exception {
        try (RunStore store = new RunStore(RuntimeEnvironment.getApplication())) {
            JSONObject state = new JSONObject().put("elapsedMs", 2000);
            store.save(state, new JSONObject().put("lat", 37));
            state.put("elapsedMs", 7000); store.save(state, null);
            assertEquals(7000, store.state().getLong("elapsedMs"));
            assertEquals(1, store.points().length());
        }
    }

    @Test public void legacyDatabaseUpgradePreservesConfigAndPoints() throws Exception {
        android.content.Context context = RuntimeEnvironment.getApplication();
        try (android.database.sqlite.SQLiteDatabase db = context.openOrCreateDatabase("run-river.db", 0, null)) {
            db.execSQL("CREATE TABLE session (id INTEGER PRIMARY KEY CHECK(id=1), json TEXT NOT NULL)");
            db.execSQL("CREATE TABLE fixes (id INTEGER PRIMARY KEY AUTOINCREMENT, json TEXT NOT NULL)");
            JSONObject legacy = new JSONObject().put("status", "paused").put("elapsedMs", 12000)
                .put("config", new JSONObject().put("runId", "legacy-run"));
            db.execSQL("INSERT INTO session VALUES(1,?)", new Object[]{legacy.toString()});
            db.execSQL("INSERT INTO fixes(json) VALUES(?)", new Object[]{new JSONObject().put("lat", 37.6).toString()});
            db.setVersion(1);
        }
        try (RunStore store = new RunStore(context)) {
            assertEquals("legacy-run", store.state().getJSONObject("config").getString("runId"));
            assertEquals(12000, store.state().getLong("elapsedMs"));
            assertEquals(1, store.points().length());
            try (android.database.Cursor cursor = store.getReadableDatabase().rawQuery("SELECT json FROM session", null)) {
                assertTrue(cursor.moveToFirst());
                assertFalse(new JSONObject(cursor.getString(0)).has("config"));
            }
        }
    }
}
