import {test} from "node:test";
import assert from "node:assert/strict";
import {distanceToCourseMeters, buildGpx} from "../src/lib/hiking";
import {canSyncActivity, activityLabel} from "../src/lib/activities";

test("sparse GPX samples do not cause a false off-course warning on the segment", () => {
    const course = [{lat: 37.6, lng: 127}, {lat: 37.62, lng: 127}];
    assert.ok(distanceToCourseMeters({lat: 37.61, lng: 127}, course) < 0.01);
    const away = distanceToCourseMeters({lat: 37.61, lng: 127.002}, course);
    assert.ok(away > 170 && away < 180);
    assert.ok(Number.isFinite(distanceToCourseMeters({lat: 37.6, lng: 127}, [course[0], course[0]])));
});

test("GPX export escapes names and preserves altitude, time, and GPS gaps", () => {
    const xml = buildGpx("산 & <길>", [
        {lat: 37.6, lng: 127, timestamp: 1700000000000, altitude_m: 300},
        {lat: 37.6001, lng: 127, timestamp: 1700000002000},
        {lat: 37.61, lng: 127, timestamp: 1700000042000, segment_start: true},
    ]);
    assert.ok(xml.includes("산 &amp; &lt;길&gt;"));
    assert.ok(xml.includes("<ele>300</ele>"));
    assert.ok(xml.includes("<time>2023-11-14T22:13:20.000Z</time>"));
    assert.equal((xml.match(/<trkseg>/g) ?? []).length, 2);
    assert.throws(() => buildGpx("broken", [{lat: NaN, lng: 127}]));
});

test("hiking cloud sync remains disabled until the schema deployment is explicitly enabled", () => {
    const previous = process.env.NEXT_PUBLIC_HIKING_SYNC;
    try {
        delete process.env.NEXT_PUBLIC_HIKING_SYNC;
        assert.equal(canSyncActivity("hiking"), false);
        assert.equal(canSyncActivity("running"), true);
        assert.equal(activityLabel("hiking"), "하이킹");
        process.env.NEXT_PUBLIC_HIKING_SYNC = "1";
        assert.equal(canSyncActivity("hiking"), true);
    } finally {
        if (previous === undefined) delete process.env.NEXT_PUBLIC_HIKING_SYNC;
        else process.env.NEXT_PUBLIC_HIKING_SYNC = previous;
    }
});
