import XCTest
import CoreLocation
import WebKit
import UIKit
@testable import App

final class HikingTests: XCTestCase {
    var directory: URL!
    override func setUpWithError() throws {
        directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    }
    override func tearDownWithError() throws { try FileManager.default.removeItem(at: directory) }
    func store() throws -> RunStore { try RunStore(url: directory.appendingPathComponent("run.sqlite")) }
    let config: [String: Any] = ["runId": "ios-test", "activityType": "hiking", "startPoint": ["lat": 37.66, "lng": 126.98], "courseOverlay": ["type": "FeatureCollection", "features": []]]
    func fix(_ latitude: Double, at time: Date, accuracy: Double = 5, altitude: Double = 100) -> CLLocation {
        CLLocation(coordinate: CLLocationCoordinate2D(latitude: latitude, longitude: 126.98), altitude: altitude, horizontalAccuracy: accuracy, verticalAccuracy: 5, timestamp: time)
    }
    func testGPSFilteringSegmentsAndDurableRecovery() throws {
        var uptime = 100.0
        let recorder = try HikingRecorder(store: store(), uptime: { uptime })
        try recorder.start(config: config)
        let now = Date()
        try recorder.accept(fix(37.66, at: now), now: now)
        uptime += 10
        try recorder.accept(fix(37.6601, at: now.addingTimeInterval(10), altitude: 104), now: now.addingTimeInterval(10))
        let distance = try XCTUnwrap(recorder.state?["distanceKm"] as? Double)
        XCTAssertGreaterThan(distance, 0.010); XCTAssertLessThan(distance, 0.012)
        try recorder.accept(fix(37.67, at: now.addingTimeInterval(11)), now: now.addingTimeInterval(11)) // impossible jump
        try recorder.accept(fix(37.68, at: now.addingTimeInterval(12), accuracy: 100), now: now.addingTimeInterval(12))
        try recorder.accept(fix(37.68, at: now.addingTimeInterval(-60)), now: now)
        uptime += 50
        try recorder.accept(fix(37.69, at: now.addingTimeInterval(60)), now: now.addingTimeInterval(60)) // no connecting distance
        XCTAssertEqual(recorder.state?["distanceKm"] as? Double, distance)
        XCTAssertEqual(recorder.state?["elevationGain"] as? Double, 4)
        XCTAssertEqual(try recorder.store.points().count, 3)
        XCTAssertEqual(try recorder.store.points().last?["segment_start"] as? Bool, true)
        let recovered = try HikingRecorder(store: store())
        XCTAssertEqual(recovered.state?["status"] as? String, "paused")
        XCTAssertEqual(recovered.state?["elapsedMs"] as? Double, 60000)
        XCTAssertEqual((recovered.state?["config"] as? [String: Any])?["runId"] as? String, "ios-test")
        XCTAssertThrowsError(try recovered.acknowledge("ios-test"))
        try recovered.pause(finished: true)
        XCTAssertThrowsError(try recovered.acknowledge("wrong-id"))
        try recovered.acknowledge("ios-test")
        XCTAssertNil(try recovered.store.state()); XCTAssertTrue(try recovered.store.points().isEmpty)
    }
    func testPauseExcludesPausedTimeAndResumedGap() throws {
        var uptime = 0.0
        let recorder = try HikingRecorder(store: store(), uptime: { uptime })
        try recorder.start(config: config)
        let now = Date()
        try recorder.accept(fix(37.66, at: now), now: now)
        uptime = 10; try recorder.pause()
        uptime = 100; try recorder.resume()
        uptime = 105
        try recorder.accept(fix(37.67, at: now.addingTimeInterval(105)), now: now.addingTimeInterval(105))
        let result = try XCTUnwrap(recorder.snapshot())
        XCTAssertEqual(result["elapsedMs"] as? Double, 15000)
        XCTAssertEqual(result["distanceKm"] as? Double, 0)
        XCTAssertThrowsError(try recorder.start(config: config))
    }
    func testNativeMapsAtomicImportRangesAndChecksum() throws {
        let files = try MapFiles(directory: directory.appendingPathComponent("maps"))
        var data = Data(repeating: 0, count: 512)
        data.replaceSubrange(0..<8, with: Data("PMTiles".utf8) + [3]); data[99] = 1
        let source = directory.appendingPathComponent("map.pmtiles")
        try data.write(to: source)
        XCTAssertThrowsError(try files.importFile(source, sha256: "wrong"))
        XCTAssertTrue(try files.list().isEmpty)
        XCTAssertTrue(try FileManager.default.contentsOfDirectory(atPath: files.directory.path).isEmpty)
        let id = try files.importFile(source)
        XCTAssertEqual(try files.read(id: id, offset: 0, length: 8), data.prefix(8))
        XCTAssertEqual(try files.read(id: id, offset: 510, length: 10).count, 2)
        XCTAssertThrowsError(try files.read(id: id, offset: -1, length: 1))
        XCTAssertThrowsError(try files.read(id: id, offset: 512, length: 1))
        XCTAssertThrowsError(try files.read(id: "../escape", offset: 0, length: 1))
        try Data("bad".utf8).write(to: source)
        XCTAssertThrowsError(try files.importFile(source))
        XCTAssertEqual(try files.list().count, 1)
        try files.remove(id); XCTAssertTrue(try files.list().isEmpty)
    }
    func testStaticRouterPreservesPagesAndDoesNotMaskMissingAssets() {
        var router = HikingRouter(); router.basePath = "/bundle"
        for page in ["hiking", "maps", "running", "result", "local-history", "auth/callback"] {
            XCTAssertEqual(router.route(for: "/\(page)/"), "/bundle/\(page)/index.html")
        }
        XCTAssertEqual(router.route(for: "/_next/missing.js"), "/bundle/_next/missing.js")
        XCTAssertEqual(router.route(for: "/../secret"), "/bundle/404.html")
    }
    @MainActor
    func testRealWKWebViewLoadsHikingAndCallsSwiftPlugins() async throws {
        let scene = try XCTUnwrap(UIApplication.shared.connectedScenes.first as? UIWindowScene)
        let controller = try XCTUnwrap(scene.windows.first(where: { $0.isKeyWindow })?.rootViewController as? HikingBridgeViewController)
        let webView = try XCTUnwrap(controller.webView)
        webView.load(URLRequest(url: URL(string: "capacitor://localhost/hiking/")!))
        var loaded = false
        for _ in 0..<100 {
            if let text = try? await webView.evaluateJavaScript("document.body.innerText"), let text = text as? String, text.contains("현재 위치에서 하이킹 시작") { loaded = true; break }
            try await Task.sleep(nanoseconds: 200_000_000)
        }
        XCTAssertTrue(loaded, "WKWebView must load the bundled hiking page, rather than the home fallback")
        let platform = try await webView.evaluateJavaScript("window.Capacitor.getPlatform()") as? String
        XCTAssertEqual(platform, "ios")
        let result = try await webView.callAsyncJavaScript("return await window.Capacitor.nativePromise('NativeRun', 'snapshot', {})", arguments: [:], in: nil, contentWorld: .page) as? [String: Any]
        XCTAssertNotNil(result)
        let root = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
        let maps = try MapFiles(directory: root.appendingPathComponent("OfflineMaps"))
        var data = Data(repeating: 0, count: 512)
        data.replaceSubrange(0..<8, with: Data("PMTiles".utf8) + [3]); data[99] = 1
        let source = directory.appendingPathComponent("bridge.pmtiles"); try data.write(to: source)
        let id = try maps.importFile(source)
        defer { try? maps.remove(id) }
        let listed = try await webView.callAsyncJavaScript("return await window.Capacitor.nativePromise('NativeMaps', 'list', {})", arguments: [:], in: nil, contentWorld: .page) as? [String: Any]
        XCTAssertTrue((listed?["maps"] as? [[String: Any]])?.contains(where: { $0["id"] as? String == id }) == true)
        let read = try await webView.callAsyncJavaScript("return await window.Capacitor.nativePromise('NativeMaps', 'read', {id, offset: 0, length: 8})", arguments: ["id": id], in: nil, contentWorld: .page) as? [String: Any]
        XCTAssertEqual(read?["base64"] as? String, data.prefix(8).base64EncodedString())
    }
}
