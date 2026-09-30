import SwiftUI
import WebKit

struct HealthWebView: UIViewRepresentable {
    let manager: HealthKitManager

    func makeCoordinator() -> Coordinator {
        Coordinator(manager: manager)
    }

    func makeUIView(context: Context) -> WKWebView {
        let controller = WKUserContentController()
        controller.add(context.coordinator.healthBridge, name: "charlieHealth")
        controller.add(context.coordinator.runBridge, name: "charlieRun")

        let configuration = WKWebViewConfiguration()
        configuration.userContentController = controller
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        configuration.websiteDataStore = .default()

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = true
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.isOpaque = false
        webView.backgroundColor = .clear

        context.coordinator.healthBridge.webView = webView
        context.coordinator.runBridge.webView = webView

        if let url = URL(string: "https://charlie-training.vercel.app") {
            webView.load(URLRequest(
                url: url,
                cachePolicy: .reloadRevalidatingCacheData,
                timeoutInterval: 30
            ))
        }

        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    static func dismantleUIView(_ uiView: WKWebView, coordinator: Coordinator) {
        uiView.configuration.userContentController.removeScriptMessageHandler(forName: "charlieHealth")
        uiView.configuration.userContentController.removeScriptMessageHandler(forName: "charlieRun")
    }

    @MainActor
    final class Coordinator: NSObject, WKNavigationDelegate {
        let healthBridge: HealthKitBridge
        let runManager: RunTrackingManager
        let runBridge: RunTrackingBridge

        init(manager: HealthKitManager) {
            self.healthBridge = HealthKitBridge(manager: manager)
            self.runManager = RunTrackingManager()
            self.runBridge = RunTrackingBridge(manager: runManager)
        }

        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
        ) {
            guard let url = navigationAction.request.url else {
                decisionHandler(.cancel)
                return
            }

            if ["http", "https", "about"].contains(url.scheme?.lowercased() ?? "") {
                decisionHandler(.allow)
            } else {
                UIApplication.shared.open(url)
                decisionHandler(.cancel)
            }
        }
    }
}
