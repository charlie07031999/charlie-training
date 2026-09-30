import Foundation
import WebKit

@MainActor
final class HealthKitBridge: NSObject, WKScriptMessageHandler {
    private let manager: HealthKitManager
    weak var webView: WKWebView?

    private let iso = ISO8601DateFormatter()

    init(manager: HealthKitManager) {
        self.manager = manager
    }

    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        guard message.name == "charlieHealth",
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
                    try await resolve(requestId, data: manager.status())

                case "authorize":
                    let status = try await manager.requestAuthorization()
                    try await resolve(requestId, data: status)

                case "snapshot":
                    let days = payload["days"] as? Int ?? 30
                    let snapshot = try await manager.snapshot(days: days)
                    try await resolve(requestId, data: snapshot)

                case "writeWeight":
                    guard let kilograms = number(payload["kilograms"]),
                          let recordedAtString = payload["recordedAt"] as? String,
                          let recordedAt = iso.date(from: recordedAtString) else {
                        throw HealthKitError.invalidPayload
                    }
                    let externalId = try await manager.writeWeight(
                        kilograms: kilograms,
                        recordedAt: recordedAt,
                        sourceId: payload["sourceId"] as? String
                    )
                    try await resolve(requestId, object: ["externalId": externalId])

                case "writeSleep":
                    guard let startString = payload["start"] as? String,
                          let endString = payload["end"] as? String,
                          let start = iso.date(from: startString),
                          let end = iso.date(from: endString) else {
                        throw HealthKitError.invalidPayload
                    }
                    let externalId = try await manager.writeSleep(
                        start: start,
                        end: end,
                        sourceId: payload["sourceId"] as? String
                    )
                    try await resolve(requestId, object: ["externalId": externalId])

                case "writeWorkout":
                    guard let startString = payload["start"] as? String,
                          let endString = payload["end"] as? String,
                          let start = iso.date(from: startString),
                          let end = iso.date(from: endString),
                          let kind = payload["workoutKind"] as? String,
                          let clientSessionId = payload["clientSessionId"] as? String else {
                        throw HealthKitError.invalidPayload
                    }

                    let externalId = try await manager.writeWorkout(
                        kind: kind,
                        start: start,
                        end: end,
                        clientSessionId: clientSessionId,
                        activeEnergyKcal: number(payload["activeEnergyKcal"]),
                        distanceMeters: number(payload["distanceMeters"])
                    )
                    try await resolve(requestId, object: ["externalId": externalId])

                default:
                    throw BridgeError.unknownAction(action)
                }
            } catch {
                await reject(requestId, error: error)
            }
        }
    }

    private func number(_ value: Any?) -> Double? {
        if let value = value as? Double { return value }
        if let value = value as? Int { return Double(value) }
        if let value = value as? NSNumber { return value.doubleValue }
        return nil
    }

    private func resolve<T: Encodable>(_ requestId: String, data: T) async throws {
        let encoded = try JSONEncoder().encode(data)
        let object = try JSONSerialization.jsonObject(with: encoded)
        try await resolve(requestId, object: object)
    }

    private func resolve(_ requestId: String, object: Any) async throws {
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
        _ = try await webView.evaluateJavaScript("window.__charlieHealthResolve(\(json));")
    }
}

enum BridgeError: Error {
    case unknownAction(String)
}
