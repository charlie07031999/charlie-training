import Foundation
import WebKit

@MainActor
final class RunTrackingBridge: NSObject, WKScriptMessageHandler {
    private let manager: RunTrackingManager
    weak var webView: WKWebView?

    init(manager: RunTrackingManager) {
        self.manager = manager
    }

    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        guard message.name == "charlieRun",
              let body = message.body as? [String: Any],
              let requestId = body["requestId"] as? String,
              let action = body["action"] as? String else {
            return
        }

        Task {
            do {
                let snapshot: NativeRunSnapshotDTO

                switch action {
                case "status":
                    snapshot = manager.snapshot()
                case "prepare":
                    snapshot = manager.prepare()
                case "start":
                    snapshot = manager.start()
                case "pause":
                    snapshot = manager.pause()
                case "resume":
                    snapshot = manager.resume()
                case "finish":
                    snapshot = manager.finish()
                case "reset":
                    snapshot = manager.reset()
                default:
                    throw RunBridgeError.unknownAction(action)
                }

                try await resolve(requestId, data: snapshot)
            } catch {
                await reject(requestId, error: error)
            }
        }
    }

    private func resolve<T: Encodable>(_ requestId: String, data: T) async throws {
        let encoded = try JSONEncoder().encode(data)
        let object = try JSONSerialization.jsonObject(with: encoded)
        let response: [String: Any] = [
            "requestId": requestId,
            "ok": true,
            "data": object
        ]
        try await send(response)
    }

    private func reject(_ requestId: String, error: Error) async {
        let response: [String: Any] = [
            "requestId": requestId,
            "ok": false,
            "error": String(describing: error)
        ]
        try? await send(response)
    }

    private func send(_ response: [String: Any]) async throws {
        guard let webView else { return }
        let data = try JSONSerialization.data(withJSONObject: response)
        guard let json = String(data: data, encoding: .utf8) else { return }
        _ = try await webView.evaluateJavaScript("window.__charlieRunResolve(\(json));")
    }
}

enum RunBridgeError: Error {
    case unknownAction(String)
}
