import {test} from "node:test";
import assert from "node:assert/strict";
import {evaluateDistanceSample, shouldAutoResume} from "../src/lib/gpsFilter";

const run = {accuracyMeters: 10, activityType: "running" as const};

test("a normal 1-second running step is counted", () => {
    assert.equal(evaluateDistanceSample({...run, distanceKm: 0.003, deltaSeconds: 1}), "accept");
});

test("a sudden jump within a few seconds is ignored", () => {
    assert.equal(evaluateDistanceSample({...run, distanceKm: 0.08, deltaSeconds: 2}), "reject");
});

test("distance after a short GPS dropout is still counted (no fixed 50m cap)", () => {
    // 12km/h로 20초 = 약 67m: 예전에는 50m 상한 때문에 이후 기록이 영구히 멈췄다
    assert.equal(evaluateDistanceSample({...run, distanceKm: 0.067, deltaSeconds: 20}), "accept");
});

test("an implausible point from a stale anchor re-anchors instead of blocking forever", () => {
    // 걷기 상한(9km/h)을 계속 넘는 이동: 오래된 기준점이면 기준점만 옮긴다
    const walk = {accuracyMeters: 10, activityType: "walking" as const};
    assert.equal(evaluateDistanceSample({...walk, distanceKm: 0.2, deltaSeconds: 10}), "reject");
    assert.equal(evaluateDistanceSample({...walk, distanceKm: 0.5, deltaSeconds: 40}), "reanchor");
});

test("inaccurate or non-moving samples are ignored", () => {
    assert.equal(evaluateDistanceSample({...run, distanceKm: 0.003, deltaSeconds: 1, accuracyMeters: 60}), "reject");
    assert.equal(evaluateDistanceSample({...run, distanceKm: 0.0005, deltaSeconds: 1}), "reject");
    assert.equal(evaluateDistanceSample({...run, distanceKm: 0.003, deltaSeconds: 0}), "reject");
});

test("auto-resume needs consecutive fast samples or real displacement", () => {
    const base = {resumeSpeedMs: 1.2, displacementKm: 0, accuracyMeters: 10};
    assert.equal(shouldAutoResume({...base, speedSamples: [1.5]}), false);
    assert.equal(shouldAutoResume({...base, speedSamples: [0.3, 1.5]}), false);
    assert.equal(shouldAutoResume({...base, speedSamples: [1.4, 1.5]}), true);
    assert.equal(shouldAutoResume({...base, speedSamples: [], displacementKm: 0.025}), true);
});

test("GPS jitter within the accuracy radius does not auto-resume", () => {
    assert.equal(shouldAutoResume({resumeSpeedMs: 1.2, speedSamples: [], displacementKm: 0.025, accuracyMeters: 35}), false);
});
