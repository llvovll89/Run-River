import Capacitor
import CoreLocation
import UniformTypeIdentifiers
import UIKit

@objc(NativeRunPlugin)
public final class NativeRunPlugin: CAPPlugin, CAPBridgedPlugin, CLLocationManagerDelegate, UIDocumentPickerDelegate {
    public let identifier = "NativeRunPlugin"
    public let jsName = "NativeRun"
    public let pluginMethods: [CAPPluginMethod] = ["start", "snapshot", "pause", "resume", "finish", "acknowledge", "saveGpx"].map { CAPPluginMethod(name: $0, returnType: CAPPluginReturnPromise) }
    private let manager = CLLocationManager()
    private var recorder: HikingRecorder?
    private var failure: Error?
    private var permissionCall: CAPPluginCall?
    private var permissionAction: (() throws -> Void)?
    private var timer: Timer?
    private var exportCall: CAPPluginCall?
    private var exportURL: URL?
    public override func load() {
        manager.delegate = self
        manager.activityType = .fitness
        manager.desiredAccuracy = kCLLocationAccuracyBest
        manager.distanceFilter = kCLDistanceFilterNone
        manager.pausesLocationUpdatesAutomatically = false
        manager.allowsBackgroundLocationUpdates = true
        manager.showsBackgroundLocationIndicator = true
        do {
            let url = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true).appendingPathComponent("Hiking/recording.sqlite")
            recorder = try HikingRecorder(store: RunStore(url: url))
        } catch { failure = error }
        NotificationCenter.default.addObserver(self, selector: #selector(background), name: UIApplication.didEnterBackgroundNotification, object: nil)
    }
    deinit { timer?.invalidate(); NotificationCenter.default.removeObserver(self) }
    private func run(_ call: CAPPluginCall, action: @escaping (HikingRecorder) throws -> Void) {
        DispatchQueue.main.async {
            do {
                guard let recorder = self.recorder else { throw self.failure ?? HikingError.message("기록 저장소를 열 수 없어요.") }
                try action(recorder)
                call.resolve()
            } catch { call.reject(error.localizedDescription) }
        }
    }
    private func authorized(_ call: CAPPluginCall, action: @escaping () throws -> Void) {
        guard permissionCall == nil else { call.reject("위치 권한 확인 중이에요."); return }
        guard CLLocationManager.locationServicesEnabled() else { call.reject("설정에서 위치 서비스를 켜주세요."); return }
        switch manager.authorizationStatus {
        case .authorizedAlways, .authorizedWhenInUse:
            do {
                guard manager.accuracyAuthorization == .fullAccuracy else { throw HikingError.message("아이폰 설정에서 Run River의 정확한 위치를 켜주세요.") }
                try action(); beginUpdates(); call.resolve()
            } catch { call.reject(error.localizedDescription) }
        case .notDetermined:
            permissionCall = call; permissionAction = action; manager.requestWhenInUseAuthorization()
        default: call.reject("설정에서 Run River 위치 권한과 정확한 위치를 켜주세요.")
        }
    }
    private func beginUpdates() {
        manager.startUpdatingLocation()
        timer?.invalidate()
        // Only a checkpoint aid. Core Location callbacks do the background recording.
        timer = Timer.scheduledTimer(withTimeInterval: 5, repeats: true) { [weak self] _ in
            guard let self else { return }
            do { try self.recorder?.checkpoint() } catch { self.stopOnError(error.localizedDescription) }
        }
    }
    private func stopUpdates() { manager.stopUpdatingLocation(); timer?.invalidate(); timer = nil }
    private func stopOnError(_ message: String) { recorder?.fail(message); stopUpdates() }
    @objc private func background() { do { try recorder?.checkpoint() } catch { stopOnError(error.localizedDescription) } }
    @objc public func start(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let config = call.getObject("config"), let recorder = self.recorder else { call.reject(self.failure?.localizedDescription ?? "운동 설정을 확인해주세요."); return }
            self.authorized(call) { try recorder.start(config: config) }
        }
    }
    @objc public func resume(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let recorder = self.recorder else { call.reject("기록 저장소를 열 수 없어요."); return }
            self.authorized(call) { try recorder.resume() }
        }
    }
    @objc public func snapshot(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            do {
                guard let recorder = self.recorder else { throw self.failure ?? HikingError.message("기록 저장소를 열 수 없어요.") }
                call.resolve(["run": try recorder.snapshot() as Any? ?? NSNull()])
            } catch { self.stopOnError(error.localizedDescription); call.reject(error.localizedDescription) }
        }
    }
    @objc public func pause(_ call: CAPPluginCall) { run(call) { try $0.pause(); self.stopUpdates() } }
    @objc public func finish(_ call: CAPPluginCall) { run(call) { try $0.pause(finished: true); self.stopUpdates() } }
    @objc public func acknowledge(_ call: CAPPluginCall) { run(call) { try $0.acknowledge(call.getString("runId") ?? "") } }
    public func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        if let call = permissionCall, manager.authorizationStatus != .notDetermined {
            let action = permissionAction!; permissionCall = nil; permissionAction = nil
            authorized(call, action: action)
        } else if recorder?.recording == true {
            if manager.authorizationStatus == .denied || manager.authorizationStatus == .restricted {
                stopOnError("위치 권한이 해제되어 기록을 일시정지했어요.")
            } else if manager.accuracyAuthorization != .fullAccuracy {
                stopOnError("정확한 위치가 꺼져 기록을 일시정지했어요. 아이폰 설정을 확인해주세요.")
            }
        }
    }
    public func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        do { for location in locations { try recorder?.accept(location) } } catch { stopOnError(error.localizedDescription) }
    }
    public func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        if (error as? CLError)?.code == .denied { stopOnError("위치 권한을 확인하고 기록을 재개해주세요.") }
    }
    @objc public func saveGpx(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard self.exportCall == nil, let gpx = call.getString("gpx"), gpx.utf8.count <= 20_000_000, let controller = self.bridge?.viewController else { call.reject("GPX 파일을 저장할 수 없어요."); return }
            do {
                // Expose a local destination in Files even on a fresh device with
                // no iCloud account or other document-provider apps installed.
                let documents = try FileManager.default.url(for: .documentDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
                try FileManager.default.createDirectory(at: documents.appendingPathComponent("GPX"), withIntermediateDirectories: true)
                let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
                try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
                let name = URL(fileURLWithPath: call.getString("filename") ?? "hiking.gpx").lastPathComponent
                let url = directory.appendingPathComponent(name.hasSuffix(".gpx") ? name : "hiking.gpx")
                try Data(gpx.utf8).write(to: url, options: .atomic)
                self.exportCall = call; self.exportURL = url
                let picker = UIDocumentPickerViewController(forExporting: [url], asCopy: true)
                picker.directoryURL = documents.appendingPathComponent("GPX")
                picker.delegate = self; controller.present(picker, animated: true)
            } catch { call.reject(error.localizedDescription) }
        }
    }
    private func clearExport() { if let url = exportURL { try? FileManager.default.removeItem(at: url.deletingLastPathComponent()) }; exportURL = nil; exportCall = nil }
    public func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) { exportCall?.resolve(); clearExport() }
    public func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) { exportCall?.reject("GPX 저장을 취소했어요."); clearExport() }
}
