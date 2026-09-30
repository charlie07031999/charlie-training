import CoreLocation
import Foundation
import UIKit

struct NativeRunPointDTO: Codable {
    let lat: Double
    let lng: Double
    let altitude: Double?
    let accuracy: Double
    let speedMps: Double?
    let timestamp: Double
    let elapsedSeconds: Int
}

struct NativeRunSnapshotDTO: Codable {
    let available: Bool
    let status: String
    let authorization: String
    let startedAt: Double?
    let finishedAt: Double?
    let pausedMs: Double
    let pauseStartedAt: Double?
    let gpsAccuracy: Double?
    let points: [NativeRunPointDTO]
    let distanceMeters: Double
    let elevationGainM: Double
    let elapsedSeconds: Int
}

@MainActor
final class RunTrackingManager: NSObject, CLLocationManagerDelegate {
    private let locationManager = CLLocationManager()
    private let storageKey = "charlie.nativeRun.v1"

    private var statusValue = "idle"
    private var startedAt: Date?
    private var finishedAt: Date?
    private var pausedMs: Double = 0
    private var pauseStartedAt: Date?
    private var points: [NativeRunPointDTO] = []
    private var distanceMeters: Double = 0
    private var elevationGainM: Double = 0
    private var gpsAccuracy: Double?
    private var lastAcceptedLocation: CLLocation?
    private var previewLocation: CLLocation?
    private var updatesSincePersist = 0

    override init() {
        super.init()
        locationManager.delegate = self
        locationManager.activityType = .fitness
        locationManager.desiredAccuracy = kCLLocationAccuracyBest
        locationManager.distanceFilter = 2
        locationManager.pausesLocationUpdatesAutomatically = false
        locationManager.showsBackgroundLocationIndicator = true
        restore()
        if statusValue == "running" || statusValue == "locating" || statusValue == "ready" {
            startLocationUpdatesIfAuthorized()
        }
    }

    func snapshot() -> NativeRunSnapshotDTO {
        NativeRunSnapshotDTO(
            available: CLLocationManager.locationServicesEnabled(),
            status: statusValue,
            authorization: authorizationString(locationManager.authorizationStatus),
            startedAt: startedAt.map(milliseconds),
            finishedAt: finishedAt.map(milliseconds),
            pausedMs: pausedMs,
            pauseStartedAt: pauseStartedAt.map(milliseconds),
            gpsAccuracy: gpsAccuracy,
            points: points,
            distanceMeters: distanceMeters,
            elevationGainM: elevationGainM,
            elapsedSeconds: elapsedSeconds()
        )
    }

    func prepare() -> NativeRunSnapshotDTO {
        guard CLLocationManager.locationServicesEnabled() else {
            statusValue = "idle"
            persist(force: true)
            return snapshot()
        }

        finishedAt = nil
        statusValue = "locating"

        switch locationManager.authorizationStatus {
        case .notDetermined:
            locationManager.requestWhenInUseAuthorization()
        case .authorizedWhenInUse, .authorizedAlways:
            startLocationUpdatesIfAuthorized()
        case .denied, .restricted:
            statusValue = "idle"
        @unknown default:
            statusValue = "idle"
        }

        persist(force: true)
        return snapshot()
    }

    func start() -> NativeRunSnapshotDTO {
        let now = Date()
        startedAt = now
        finishedAt = nil
        pausedMs = 0
        pauseStartedAt = nil
        points = []
        distanceMeters = 0
        elevationGainM = 0
        lastAcceptedLocation = nil
        statusValue = "running"
        startLocationUpdatesIfAuthorized()

        if let previewLocation, valid(previewLocation) {
            append(previewLocation)
        }

        persist(force: true)
        return snapshot()
    }

    func pause() -> NativeRunSnapshotDTO {
        guard statusValue == "running" else { return snapshot() }
        pauseStartedAt = Date()
        statusValue = "paused"
        persist(force: true)
        return snapshot()
    }

    func resume() -> NativeRunSnapshotDTO {
        guard statusValue == "paused" else { return snapshot() }
        if let pauseStartedAt {
            pausedMs += max(0, Date().timeIntervalSince(pauseStartedAt) * 1000)
        }
        self.pauseStartedAt = nil
        statusValue = "running"
        startLocationUpdatesIfAuthorized()
        persist(force: true)
        return snapshot()
    }

    func finish() -> NativeRunSnapshotDTO {
        guard startedAt != nil else { return snapshot() }

        let now = Date()
        if statusValue == "paused", let pauseStartedAt {
            pausedMs += max(0, now.timeIntervalSince(pauseStartedAt) * 1000)
        }

        self.pauseStartedAt = nil
        finishedAt = now
        statusValue = "finished"
        locationManager.stopUpdatingLocation()
        persist(force: true)
        return snapshot()
    }

    func reset() -> NativeRunSnapshotDTO {
        locationManager.stopUpdatingLocation()
        statusValue = "idle"
        startedAt = nil
        finishedAt = nil
        pausedMs = 0
        pauseStartedAt = nil
        points = []
        distanceMeters = 0
        elevationGainM = 0
        gpsAccuracy = nil
        lastAcceptedLocation = nil
        previewLocation = nil
        UserDefaults.standard.removeObject(forKey: storageKey)
        return snapshot()
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        switch manager.authorizationStatus {
        case .authorizedWhenInUse, .authorizedAlways:
            if statusValue == "locating" || statusValue == "ready" || statusValue == "running" {
                startLocationUpdatesIfAuthorized()
            }
        case .denied, .restricted:
            if statusValue == "locating" || statusValue == "ready" {
                statusValue = "idle"
            }
            persist(force: true)
        case .notDetermined:
            break
        @unknown default:
            break
        }
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else { return }
        gpsAccuracy = location.horizontalAccuracy > 0 ? location.horizontalAccuracy : nil

        guard valid(location) else { return }
        previewLocation = location

        if statusValue == "locating" {
            statusValue = "ready"
            persist(force: true)
            return
        }

        guard statusValue == "running", startedAt != nil else { return }
        append(location)
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        if let clError = error as? CLError, clError.code == .locationUnknown {
            return
        }
    }

    private func startLocationUpdatesIfAuthorized() {
        guard locationManager.authorizationStatus == .authorizedWhenInUse ||
              locationManager.authorizationStatus == .authorizedAlways else {
            return
        }
        locationManager.allowsBackgroundLocationUpdates = true
        locationManager.startUpdatingLocation()
    }

    private func valid(_ location: CLLocation) -> Bool {
        location.horizontalAccuracy >= 0 &&
        location.horizontalAccuracy <= 65 &&
        abs(location.timestamp.timeIntervalSinceNow) < 20
    }

    private func append(_ location: CLLocation) {
        guard let startedAt else { return }

        if let last = lastAcceptedLocation {
            let dt = max(0.001, location.timestamp.timeIntervalSince(last.timestamp))
            let segment = location.distance(from: last)
            let impliedSpeed = segment / dt
            if impliedSpeed > 15 || segment > 250 { return }
            if segment < 1.2 && dt < 5 { return }

            distanceMeters += max(0, segment)

            if location.verticalAccuracy >= 0,
               location.verticalAccuracy <= 20,
               last.verticalAccuracy >= 0,
               last.verticalAccuracy <= 20 {
                let delta = location.altitude - last.altitude
                if delta > 1 && delta < 12 { elevationGainM += delta }
            }
        }

        let elapsed = max(
            0,
            Int(
                (
                    location.timestamp.timeIntervalSince(startedAt) * 1000 -
                    pausedMs -
                    currentPauseMilliseconds(at: location.timestamp)
                ) / 1000
            )
        )

        points.append(
            NativeRunPointDTO(
                lat: location.coordinate.latitude,
                lng: location.coordinate.longitude,
                altitude: location.verticalAccuracy >= 0 ? location.altitude : nil,
                accuracy: location.horizontalAccuracy,
                speedMps: location.speed >= 0 ? location.speed : nil,
                timestamp: milliseconds(location.timestamp),
                elapsedSeconds: elapsed
            )
        )

        if points.count > 8000 {
            points.removeFirst(points.count - 8000)
        }

        lastAcceptedLocation = location
        updatesSincePersist += 1
        persist(force: updatesSincePersist >= 8)
    }

    private func elapsedSeconds() -> Int {
        guard let startedAt else { return 0 }
        let end = finishedAt ?? Date()
        let activeMs = max(
            0,
            end.timeIntervalSince(startedAt) * 1000 -
            pausedMs -
            currentPauseMilliseconds(at: end)
        )
        return Int(activeMs / 1000)
    }

    private func currentPauseMilliseconds(at date: Date) -> Double {
        guard statusValue == "paused", let pauseStartedAt else { return 0 }
        return max(0, date.timeIntervalSince(pauseStartedAt) * 1000)
    }

    private func milliseconds(_ date: Date) -> Double {
        date.timeIntervalSince1970 * 1000
    }

    private func authorizationString(_ status: CLAuthorizationStatus) -> String {
        switch status {
        case .notDetermined: return "notDetermined"
        case .restricted: return "restricted"
        case .denied: return "denied"
        case .authorizedAlways: return "authorizedAlways"
        case .authorizedWhenInUse: return "authorizedWhenInUse"
        @unknown default: return "unknown"
        }
    }

    private struct StoredRun: Codable {
        let status: String
        let startedAt: Date?
        let finishedAt: Date?
        let pausedMs: Double
        let pauseStartedAt: Date?
        let points: [NativeRunPointDTO]
        let distanceMeters: Double
        let elevationGainM: Double
        let gpsAccuracy: Double?
    }

    private func persist(force: Bool) {
        guard force else { return }
        updatesSincePersist = 0
        let stored = StoredRun(
            status: statusValue,
            startedAt: startedAt,
            finishedAt: finishedAt,
            pausedMs: pausedMs,
            pauseStartedAt: pauseStartedAt,
            points: points,
            distanceMeters: distanceMeters,
            elevationGainM: elevationGainM,
            gpsAccuracy: gpsAccuracy
        )
        if let data = try? JSONEncoder().encode(stored) {
            UserDefaults.standard.set(data, forKey: storageKey)
        }
    }

    private func restore() {
        guard let data = UserDefaults.standard.data(forKey: storageKey),
              let stored = try? JSONDecoder().decode(StoredRun.self, from: data) else {
            return
        }

        statusValue = stored.status
        startedAt = stored.startedAt
        finishedAt = stored.finishedAt
        pausedMs = stored.pausedMs
        pauseStartedAt = stored.pauseStartedAt
        points = stored.points
        distanceMeters = stored.distanceMeters
        elevationGainM = stored.elevationGainM
        gpsAccuracy = stored.gpsAccuracy

        if let last = points.last {
            lastAcceptedLocation = CLLocation(
                coordinate: CLLocationCoordinate2D(latitude: last.lat, longitude: last.lng),
                altitude: last.altitude ?? 0,
                horizontalAccuracy: last.accuracy,
                verticalAccuracy: last.altitude == nil ? -1 : 10,
                timestamp: Date(timeIntervalSince1970: last.timestamp / 1000)
            )
        }
    }
}
