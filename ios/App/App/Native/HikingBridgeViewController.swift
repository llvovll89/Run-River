import Capacitor

struct HikingRouter: Router {
    var basePath = ""
    private let pages: Set<String> = ["running", "result", "history", "settings", "auth", "auth/callback", "local-history", "maps", "hiking"]
    func route(for path: String) -> String {
        let page = path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        if pages.contains(page) { return basePath + "/" + page + "/index.html" }
        if page.isEmpty { return basePath + "/index.html" }
        // Never turn a missing chunk, asset or arbitrary path into the home document.
        guard !page.split(separator: "/").contains("..") else { return basePath + "/404.html" }
        return basePath + "/" + page
    }
}

@objc(HikingBridgeViewController)
final class HikingBridgeViewController: CAPBridgeViewController {
    override func router() -> any Router { HikingRouter() }
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(NativeRunPlugin())
        bridge?.registerPluginInstance(NativeMapsPlugin())
    }
}
