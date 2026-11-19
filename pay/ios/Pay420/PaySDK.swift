import Combine
import Foundation
import WebKit

@MainActor
final class PaySDK: NSObject, ObservableObject, WKNavigationDelegate {
    @Published private(set) var ready = false
    private var web: WKWebView?
    private var localPage: URL?

    func load() {
        guard web == nil, let page = Bundle.main.url(forResource: "review", withExtension: "html", subdirectory: "Generated")
        else { return }
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .nonPersistent()
        let view = WKWebView(frame: .zero, configuration: config)
        localPage = page
        view.navigationDelegate = self
        web = view
        view.loadFileURL(page, allowingReadAccessTo: page.deletingLastPathComponent())
    }

    func webView(_ view: WKWebView, decidePolicyFor action: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        decisionHandler(action.targetFrame?.isMainFrame == true && action.request.url == localPage ? .allow : .cancel)
    }

    func webView(_ view: WKWebView, didFinish navigation: WKNavigation!) {
        ready = view.url == localPage
    }

    func webViewWebContentProcessDidTerminate(_ view: WKWebView) {
        ready = false
        web = nil
        load()
    }

    func review(_ input: String, deployment: PayDeployment) async -> URL? {
        guard ready, deployment.configured, input.utf8.count <= 1024, let web else { return nil }
        let arguments = ["input": input.trimmingCharacters(in: .whitespacesAndNewlines),
                         "host": deployment.payHost, "chain": deployment.chainID]
        do {
            let result = try await web.callAsyncJavaScript("return reviewPay420(input, host, chain);",
                arguments: arguments, in: nil, contentWorld: .page)
            if let raw = result as? String, let url = URL(string: raw), PayLinks.hosted(url, on: deployment.payHost) {
                return url
            }
        } catch {}
        return nil
    }
}
