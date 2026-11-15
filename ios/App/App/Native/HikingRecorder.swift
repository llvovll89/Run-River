import Foundation
import CoreLocation

final class HikingRecorder {
    let store: RunStore
    private(set) var state: [String: Any]?
    private var previous: CLLocation?
    private var altitude: Double?
    private var started: TimeInterval?
    private var elapsedBase: Double = 0
    private let uptime: () -> TimeInterval
    init(store: RunStore, uptime: @escaping () -> TimeInterval = { ProcessInfo.processInfo.systemUptime }) throws {
        self.store = store
        self.uptime = uptime
        state = try store.state()
        // A terminated app cannot account for missing GPS; recover its last durable checkpoint paused.
        if state?["status"] as? String == "recording" {
            state?["status"] = "paused"
            state?["error"] = "앱이 종료되어 기록을 일시정지했어요. 위치를 확인하고 재개해주세요."
            try store.save(state!)
        }
    }
    var recording: Bool { state?["status"] as? String == "recording" }
    func start(config: [String: Any]) throws {
        guard state == nil, let id = config["runId"] as? String, !id.isEmpty else { throw HikingError.message("남아 있는 기록을 먼저 저장해주세요.") }
        guard config["intervalPreset"] == nil || config["intervalPreset"] is NSNull else { throw HikingError.message("네이티브 기록은 거리·시간·목적지 운동을 지원해요.") }
        let initial: [String: Any] = ["config": config, "status": "recording", "elapsedMs": 0.0, "distanceKm": 0.0, "elevationGain": 0.0, "elevationLoss": 0.0]
        try store.save(initial)
        state = initial; elapsedBase = 0; started = uptime(); previous = nil; altitude = nil
    }
    private func tick() { if let started { state?["elapsedMs"] = elapsedBase + max(0, uptime() - started) * 1000 } }
    func checkpoint() throws { tick(); if let state { try store.save(state) } }
    func pause(finished: Bool = false) throws {
        guard state != nil else { throw HikingError.message("진행 중인 기록이 없어요.") }
        tick()
        var next = state!
        next["status"] = finished ? "finished" : "paused"
        try store.save(next)
        state = next; started = nil; previous = nil; altitude = nil
    }
    func resume() throws {
        guard state?["status"] as? String == "paused" else { throw HikingError.message("일시정지한 기록만 재개할 수 있어요.") }
        var next = state!; next["status"] = "recording"; next.removeValue(forKey: "error")
        try store.save(next)
        state = next; elapsedBase = next["elapsedMs"] as? Double ?? 0; started = uptime(); previous = nil; altitude = nil
    }
    func fail(_ message: String) {
        tick(); state?["status"] = "paused"; state?["error"] = message
        started = nil; previous = nil; altitude = nil
        if let state { try? store.save(state) }
    }
    func snapshot() throws -> [String: Any]? {
        try checkpoint()
        guard var result = state else { return nil }
        result["trackPoints"] = try store.points()
        return result
    }
    func acknowledge(_ id: String) throws { try store.clear(runId: id); state = nil }
    func accept(_ location: CLLocation, now: Date = Date()) throws {
        guard recording, CLLocationCoordinate2DIsValid(location.coordinate), location.horizontalAccuracy >= 0, location.horizontalAccuracy <= 40,
              now.timeIntervalSince(location.timestamp) <= 30, now.timeIntervalSince(location.timestamp) >= -5 else { return }
        if let previous, location.timestamp <= previous.timestamp { return }
        tick()
        var next = state!
        next["position"] = ["lat": location.coordinate.latitude, "lng": location.coordinate.longitude]
        next["accuracy"] = location.horizontalAccuracy
        next["lastFixAt"] = location.timestamp.timeIntervalSince1970 * 1000
        let gap = previous.map { location.timestamp.timeIntervalSince($0.timestamp) } ?? .infinity
        var segment = previous == nil || gap > 30
        let meters = previous.map { location.distance(from: $0) } ?? 0
        let config = next["config"] as? [String: Any] ?? [:]
        let maxSpeed = config["activityType"] as? String == "running" ? 25.0 : 9.0
        if !segment, meters >= 1, (meters > 50 || meters / max(gap, 0.001) * 3.6 > maxSpeed) { return }
        if !segment, meters < 1 { try store.save(next); state = next; return }
        if gap > 30 { segment = true; altitude = nil }
        next["distanceKm"] = (next["distanceKm"] as? Double ?? 0) + (segment ? 0 : meters / 1000)
        var point: [String: Any] = ["lat": location.coordinate.latitude, "lng": location.coordinate.longitude, "timestamp": location.timestamp.timeIntervalSince1970 * 1000, "distance_km": next["distanceKm"]!, "elapsed_seconds": floor((next["elapsedMs"] as? Double ?? 0) / 1000)]
        if segment { point["segment_start"] = true }
        if location.verticalAccuracy >= 0, location.verticalAccuracy <= 15 {
            let height = location.altitude
            point["altitude_m"] = height; next["currentAltitude"] = height
            if next["startAltitude"] == nil { next["startAltitude"] = height }
            if let altitude {
                let delta = height - altitude
                if abs(delta) >= 3 {
                    if abs(delta) <= 20 {
                        let key = delta > 0 ? "elevationGain" : "elevationLoss"
                        next[key] = (next[key] as? Double ?? 0) + abs(delta)
                    }
                    self.altitude = height
                }
            } else { altitude = height }
        }
        try store.save(next, point: point)
        state = next; previous = location
    }
}
