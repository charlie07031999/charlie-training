import SwiftUI

@main
struct CharlieTrainingApp: App {
    @StateObject private var health = HealthKitManager()

    var body: some Scene {
        WindowGroup {
            HealthWebView(manager: health)
                .ignoresSafeArea()
                .onOpenURL { url in
                    guard url.scheme?.lowercased() == "charlietraining",
                          url.host?.lowercased() == "health" else { return }

                    Task { @MainActor in
                        _ = try? await health.requestAuthorization()
                    }
                }
        }
    }
}
