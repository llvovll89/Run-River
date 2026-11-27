import {test} from "node:test";
import assert from "node:assert/strict";
import {sanitizeNextPath} from "../src/lib/safeRedirect";
import {dayKey} from "../src/lib/utils";

test("login redirect keeps same-origin paths", () => {
    assert.equal(sanitizeNextPath("/history"), "/history");
    assert.equal(sanitizeNextPath("/result?id=abc#map"), "/result?id=abc#map");
    assert.equal(sanitizeNextPath(null), "/");
});

test("login redirect blocks paths the URL parser resolves to another host", () => {
    for (const value of ["//evil.com", "/\\evil.com", "/\t/evil.com", "/\\/evil.com", "https://evil.com", "evil.com", "javascript:alert(1)"]) {
        assert.equal(sanitizeNextPath(value), "/", JSON.stringify(value));
    }
});

test("records are grouped by KST day, not UTC day", () => {
    // KST 2026-11-27 07:30 = UTC 2026-11-26 22:30
    assert.equal(dayKey("2026-11-26T22:30:00.000Z"), "2026-11-27");
    // KST 2026-11-27 23:59 = UTC 2026-11-27 14:59
    assert.equal(dayKey("2026-11-27T14:59:00.000Z"), "2026-11-27");
    assert.equal(dayKey("2026-11-27T15:00:00.000Z"), "2026-11-28");
});
