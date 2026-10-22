import Foundation
import UserNotifications
import WebKit

@MainActor
final class LocalNotificationBridge: NSObject, WKScriptMessageHandler {
    weak var webView: WKWebView?
    private let center = UNUserNotificationCenter.current()
    private let restIdentifier = "charlie-rest-finished"

    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        guard message.name == "charlieNotifications",
              let body = message.body as? [String: Any],
              let requestId = body["requestId"] as? String,
              let action = body["action"] as? String else {
            return
        }

        let payload = body["payload"] as? [String: Any] ?? [:]

        Task {
            do {
                switch action {
                case "status":
                    let settings = await center.notificationSettings()
                    try await resolve(requestId, data: statusPayload(settings))
                case "authorize":
                    _ = try await center.requestAuthorization(options: [.alert, .sound, .badge])
                    let settings = await center.notificationSettings()
                    try await resolve(requestId, data: statusPayload(settings))
                case "scheduleRest":
                    guard let dueAt = payload["dueAt"] as? Double else {
                        throw NotificationBridgeError.invalidPayload
                    }
                    try await scheduleRest(dueAtMilliseconds: dueAt)
                    let settings = await center.notificationSettings()
                    try await resolve(requestId, data: statusPayload(settings))
                case "cancelRest":
                    center.removePendingNotificationRequests(withIdentifiers: [restIdentifier])
                    center.removeDeliveredNotifications(withIdentifiers: [restIdentifier])
                    let settings = await center.notificationSettings()
                    try await resolve(requestId, data: statusPayload(settings))
                default:
                    throw NotificationBridgeError.unknownAction(action)
                }
            } catch {
                await reject(requestId, error: error)
            }
        }
    }

    private func scheduleRest(dueAtMilliseconds: Double) async throws {
        let settings = await center.notificationSettings()
        guard settings.authorizationStatus == .authorized ||
              settings.authorizationStatus == .provisional ||
              settings.authorizationStatus == .ephemeral else {
            throw NotificationBridgeError.notAuthorized
        }

        center.removePendingNotificationRequests(withIdentifiers: [restIdentifier])
        center.removeDeliveredNotifications(withIdentifiers: [restIdentifier])

        let content = UNMutableNotificationContent()
        content.title = "Repos terminé"
        content.body = "Prochaine série. Repars proprement."
        content.sound = .default
        content.threadIdentifier = "charlie-training-rest"

        let dueAt = Date(timeIntervalSince1970: dueAtMilliseconds / 1000)
        let interval = max(1, dueAt.timeIntervalSinceNow)
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: interval, repeats: false)
        let request = UNNotificationRequest(
            identifier: restIdentifier,
            content: content,
            trigger: trigger
        )

        try await center.add(request)
    }

    private func statusPayload(_ settings: UNNotificationSettings) -> [String: Any] {
        let authorization: String
        switch settings.authorizationStatus {
        case .authorized, .provisional, .ephemeral:
            authorization = "granted"
        case .denied:
            authorization = "denied"
        case .notDetermined:
            authorization = "default"
        @unknown default:
            authorization = "default"
        }

        return [
            "available": true,
            "authorization": authorization
        ]
    }

    private func resolve(_ requestId: String, data: [String: Any]) async throws {
        try await send([
            "requestId": requestId,
            "ok": true,
            "data": data
        ])
    }

    private func reject(_ requestId: String, error: Error) async {
        try? await send([
            "requestId": requestId,
            "ok": false,
            "error": String(describing: error)
        ])
    }

    private func send(_ response: [String: Any]) async throws {
        guard let webView else { return }
        let data = try JSONSerialization.data(withJSONObject: response)
        guard let json = String(data: data, encoding: .utf8) else { return }
        _ = try await webView.evaluateJavaScript("window.__charlieNotificationsResolve(\(json));")
    }
}

enum NotificationBridgeError: Error {
    case invalidPayload
    case notAuthorized
    case unknownAction(String)
}
