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
}
