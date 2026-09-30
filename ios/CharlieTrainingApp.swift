import SwiftUI

@main
struct CharlieTrainingApp: App {
    @StateObject private var health = HealthKitManager()

    var body: some Scene {
        WindowGroup {
            HealthWebView(manager: health)
                .ignoresSafeArea()
        }
    }
}
