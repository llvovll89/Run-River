import Capacitor
import UniformTypeIdentifiers

@objc(NativeMapsPlugin)
public final class NativeMapsPlugin: CAPPlugin, CAPBridgedPlugin, UIDocumentPickerDelegate, URLSessionDownloadDelegate {
    public let identifier = "NativeMapsPlugin"
    public let jsName = "NativeMaps"
    public let pluginMethods: [CAPPluginMethod] = ["pick", "download", "list", "read", "delete"].map { CAPPluginMethod(name: $0, returnType: CAPPluginReturnPromise) }
    private var files: MapFiles?
    private var failure: Error?
    private let queue = DispatchQueue(label: "com.runriver.maps")
    private var pickerCall: CAPPluginCall?
    private var downloadCall: CAPPluginCall?
    private var downloadHash: String?
    private var session: URLSession?
    private var downloadError: String?
    public override func load() {
        do {
            let root = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
            files = try MapFiles(directory: root.appendingPathComponent("OfflineMaps"))
        } catch { failure = error }
    }
    private func perform(_ call: CAPPluginCall, action: @escaping (MapFiles) throws -> [String: Any]) {
        queue.async {
            do {
                guard let files = self.files else { throw self.failure ?? HikingError.message("지도 저장소를 열 수 없어요.") }
                call.resolve(try action(files))
            } catch { call.reject(error.localizedDescription) }
        }
    }
    @objc public func list(_ call: CAPPluginCall) { perform(call) { ["maps": try $0.list()] } }
    @objc public func read(_ call: CAPPluginCall) {
        perform(call) { files in
            guard let id = call.getString("id"), let offset = call.getInt("offset"), let length = call.getInt("length") else { throw HikingError.message("지도 읽기 범위를 확인해주세요.") }
            return ["base64": try files.read(id: id, offset: offset, length: length).base64EncodedString()]
        }
    }
    @objc public func delete(_ call: CAPPluginCall) { perform(call) { try $0.remove(call.getString("id") ?? ""); return [:] } }
    @objc public func pick(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard self.pickerCall == nil, let controller = self.bridge?.viewController else { call.reject("파일 선택 창이 열려 있어요."); return }
            self.pickerCall = call
            let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.data], asCopy: false)
            picker.allowsMultipleSelection = false; picker.delegate = self
            controller.present(picker, animated: true)
        }
    }
    public func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) { pickerCall?.reject("지도 가져오기를 취소했어요."); pickerCall = nil }
    public func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        guard let call = pickerCall else { return }; pickerCall = nil
        guard let url = urls.first else { call.reject("지도 파일을 선택해주세요."); return }
        perform(call) { files in
            let scoped = url.startAccessingSecurityScopedResource()
            defer { if scoped { url.stopAccessingSecurityScopedResource() } }
            return ["id": try files.importFile(url)]
        }
    }
    @objc public func download(_ call: CAPPluginCall) {
        queue.async {
            guard self.downloadCall == nil else { call.reject("지도를 다운로드하고 있어요."); return }
            guard let raw = call.getString("url"), let url = URL(string: raw), url.scheme == "https", url.host != nil, url.user == nil, url.password == nil else { call.reject("HTTPS 지도 주소를 사용해주세요."); return }
            self.downloadCall = call; self.downloadHash = call.getString("sha256"); self.downloadError = nil
            let config = URLSessionConfiguration.ephemeral
            config.timeoutIntervalForRequest = 60; config.timeoutIntervalForResource = 600
            let delegateQueue = OperationQueue(); delegateQueue.maxConcurrentOperationCount = 1; delegateQueue.underlyingQueue = self.queue
            self.session = URLSession(configuration: config, delegate: self, delegateQueue: delegateQueue)
            self.session?.downloadTask(with: url).resume()
        }
    }
    public func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
    public func urlSession(_ session: URLSession, downloadTask: URLSessionDownloadTask, didWriteData bytesWritten: Int64, totalBytesWritten: Int64, totalBytesExpectedToWrite: Int64) {
        if totalBytesWritten > MapFiles.maxBytes || totalBytesExpectedToWrite > MapFiles.maxBytes { downloadError = "200MB 이하 지도를 사용해주세요."; downloadTask.cancel() }
    }
    public func urlSession(_ session: URLSession, downloadTask: URLSessionDownloadTask, didFinishDownloadingTo location: URL) {
        do {
            guard let response = downloadTask.response as? HTTPURLResponse, response.statusCode == 200, let files else { throw HikingError.message("지도 다운로드에 실패했어요.") }
            let id = try files.importFile(location, sha256: downloadHash)
            downloadCall?.resolve(["id": id]); downloadCall = nil
        } catch { downloadError = error.localizedDescription }
    }
    public func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        if let call = downloadCall { call.reject(downloadError ?? error?.localizedDescription ?? "지도 다운로드에 실패했어요.") }
        downloadCall = nil; downloadHash = nil; self.session = nil; session.finishTasksAndInvalidate()
    }
}
