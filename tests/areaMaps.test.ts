import {test} from "node:test";
import assert from "node:assert/strict";
import {PMTiles, type Source} from "pmtiles";
import {AREA_MAX_TILES, areaTiles, buildPmtiles, countAreaTiles, coveredBounds, type AreaTile, type Bounds} from "../src/lib/areaMaps";

class MemorySource implements Source {
    constructor(private bytes: Uint8Array) {}
    getKey() { return "memory"; }
    async getBytes(offset: number, length: number) { return {data: this.bytes.slice(offset, offset + length).buffer}; }
}

const bukhansan: Bounds = [126.95, 37.63, 127.02, 37.70];

test("area tiles cover the box at every saved zoom", () => {
    const tiles = areaTiles(bukhansan);
    assert.equal(tiles.length, countAreaTiles(bukhansan));
    assert.ok(tiles.length < AREA_MAX_TILES);
    assert.deepEqual([...new Set(tiles.map(tile => tile.z))], [8, 9, 10, 11, 12, 13, 14]);
    const [west, south, east, north] = coveredBounds(bukhansan);
    assert.ok(west <= 126.95 && south <= 37.63 && east >= 127.02 && north >= 37.70);
    // Zoomed far out (all of Korea) is refused by the caller's limit.
    assert.ok(countAreaTiles([124, 33, 131, 39]) > AREA_MAX_TILES);
});

for (const count of [5, 3000]) test(`PMTiles written for ${count} tiles reads back every tile`, async () => {
    const tiles: AreaTile[] = [];
    for (let i = 0; tiles.length < count; i++) {
        const z = 14, x = 13960 + (i % 60), y = 6330 + Math.floor(i / 60);
        tiles.push({z, x, y, data: new TextEncoder().encode(`tile ${z}/${x}/${y}`)});
    }
    const archive = buildPmtiles([...tiles].reverse(), {bounds: bukhansan, minZoom: 8, maxZoom: 14, tileCompression: "none", metadata: {name: "t", vector_layers: [{id: "transportation"}]}});
    const reader = new PMTiles(new MemorySource(archive));
    const header = await reader.getHeader();
    assert.equal(header.specVersion, 3);
    assert.equal(header.maxZoom, 14);
    assert.equal(header.numAddressedTiles, count);
    assert.ok(Math.abs(header.minLon - 126.95) < 1e-6 && Math.abs(header.maxLat - 37.70) < 1e-6);
    assert.deepEqual(await reader.getMetadata(), {name: "t", vector_layers: [{id: "transportation"}]});
    for (const tile of [tiles[0], tiles[Math.floor(count / 2)], tiles.at(-1)!]) {
        const read = await reader.getZxy(tile.z, tile.x, tile.y);
        assert.equal(new TextDecoder().decode(read!.data), `tile ${tile.z}/${tile.x}/${tile.y}`);
    }
    assert.equal(await reader.getZxy(14, 1, 1), undefined);
});
