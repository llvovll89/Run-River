import {test} from "node:test";
import assert from "node:assert/strict";
import {zipSync, strToU8} from "fflate";
import {extractKmz} from "../src/lib/kmz";

test("KMZ prefers root doc.kml and ignores binary attachments", () => {
    const data = zipSync({"doc.kml": strToU8("<kml>선택</kml>"), "other.kml": strToU8("other"), "images/large.png": new Uint8Array(6 * 1024 * 1024)});
    assert.equal(extractKmz(data), "<kml>선택</kml>");
});
test("KMZ accepts one nested KML but rejects ambiguous or missing documents", () => {
    assert.equal(extractKmz(zipSync({"folder/map.kml": strToU8("<kml/>")})), "<kml/>");
    assert.throws(() => extractKmz(zipSync({"a.kml": strToU8("a"), "b.kml": strToU8("b")})), /doc.kml/);
    assert.throws(() => extractKmz(zipSync({"image.png": new Uint8Array(10)})), /KML/);
});
test("KMZ bounds decompressed documents and archive entry count", () => {
    assert.throws(() => extractKmz(zipSync({"doc.kml": strToU8("a".repeat(5 * 1024 * 1024 + 1))})), /5MB/);
    const entries = Object.fromEntries(Array.from({length: 201}, (_, index) => [`${index}.txt`, new Uint8Array()]));
    assert.throws(() => extractKmz(zipSync(entries)), /200/);
});
test("KMZ rejects traversal paths, truncated ZIPs, invalid UTF-8 and oversized archives", () => {
    assert.throws(() => extractKmz(zipSync({"../doc.kml": strToU8("<kml/>")})), /경로/);
    const archive = zipSync({"doc.kml": strToU8("<kml/>")});
    assert.throws(() => extractKmz(archive.subarray(0, archive.length - 5)), /손상/);
    assert.throws(() => extractKmz(zipSync({"doc.kml": new Uint8Array([255, 254, 255])})), /UTF-8/);
    assert.throws(() => extractKmz(new Uint8Array(10 * 1024 * 1024 + 1)), /10MB/);
});
