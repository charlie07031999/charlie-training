import Foundation
import HealthKit
import UIKit

struct HealthBridgeStatus: Codable {
    let available: Bool
    let authorizationRequested: Bool
    let writeAuthorization: [String:String]
    let deviceId: String
}

struct HealthWeightDTO: Codable {
    let externalId: String
    let recordedAt: String
    let kilograms: Double
}

struct HealthSleepDTO: Codable {
    let externalId: String
    let start: String
    let end: String
}

struct HealthWorkoutDTO: Codable {
    let externalId: String
    let start: String
    let end: String
    let activityType: UInt
    let activityName: String
    let durationSeconds: Double
    let activeEnergyKcal: Double?
    let distanceMeters: Double?
    let clientSessionId: String?
}

struct HealthDailyDTO: Codable {
    let date: String
    let steps: Double?
    let activeEnergyKcal: Double?
    let averageHeartRateBpm: Double?
    let restingHeartRateBpm: Double?
}

struct HealthSnapshotDTO: Codable {
    let generatedAt: String
    let weights: [HealthWeightDTO]
    let sleepSessions: [HealthSleepDTO]
    let workouts: [HealthWorkoutDTO]
    let daily: [HealthDailyDTO]
}

@MainActor
final class HealthKitManager: ObservableObject {
    private let store = HKHealthStore()
    private let iso = ISO8601DateFormatter()
    private let authorizationFlagKey = "charlie.health.authorizationRequested"

    private let sourceIdKey = "CharlieTrainingSourceId"
    private let clientSessionIdKey = "CharlieTrainingClientSessionId"

    private var sleepType: HKCategoryType {
        HKObjectType.categoryType(forIdentifier: .sleepAnalysis)!
    }

    private var weightType: HKQuantityType {
        HKObjectType.quantityType(forIdentifier: .bodyMass)!
    }

    private var heartRateType: HKQuantityType {
        HKObjectType.quantityType(forIdentifier: .heartRate)!
    }

    private var restingHeartRateType: HKQuantityType {
        HKObjectType.quantityType(forIdentifier: .restingHeartRate)!
    }

    private var activeEnergyType: HKQuantityType {
        HKObjectType.quantityType(forIdentifier: .activeEnergyBurned)!
    }

    private var stepType: HKQuantityType {
        HKObjectType.quantityType(forIdentifier: .stepCount)!
    }

    var deviceId: String {
        UIDevice.current.identifierForVendor?.uuidString ?? "ios-device"
    }

    func status() -> HealthBridgeStatus {
        HealthBridgeStatus(
            available: HKHealthStore.isHealthDataAvailable(),
            authorizationRequested: UserDefaults.standard.bool(forKey: authorizationFlagKey),
            writeAuthorization: [
                "sleep": authString(store.authorizationStatus(for: sleepType)),
                "weight": authString(store.authorizationStatus(for: weightType)),
                "activeEnergy": authString(store.authorizationStatus(for: activeEnergyType)),
                "workouts": authString(store.authorizationStatus(for: HKObjectType.workoutType()))
            ],
            deviceId: deviceId
        )
    }

    func requestAuthorization() async throws -> HealthBridgeStatus {
        guard HKHealthStore.isHealthDataAvailable() else {
            throw HealthKitError.unavailable
        }

        let read: Set<HKObjectType> = [
            sleepType,
            weightType,
            heartRateType,
            restingHeartRateType,
            activeEnergyType,
            stepType,
            HKObjectType.workoutType()
        ]

        let share: Set<HKSampleType> = [
            sleepType,
            weightType,
            activeEnergyType,
            HKObjectType.workoutType()
        ]

        try await store.requestAuthorization(toShare: share, read: read)
        UserDefaults.standard.set(true, forKey: authorizationFlagKey)
        return status()
    }

    func snapshot(days: Int) async throws -> HealthSnapshotDTO {
        let boundedDays = max(1, min(days, 365))
        let start = Calendar.current.date(byAdding: .day, value: -boundedDays, to: Date()) ?? Date().addingTimeInterval(-30 * 86400)

        async let weightsTask = recentWeights(since: start)
        async let sleepsTask = recentSleepSessions(since: start)
        async let workoutsTask = recentWorkouts(since: start)
        async let dailyTask = dailyMetrics(since: start)

        return try await HealthSnapshotDTO(
            generatedAt: iso.string(from: Date()),
            weights: weightsTask,
            sleepSessions: sleepsTask,
            workouts: workoutsTask,
            daily: dailyTask
        )
    }

    func writeWeight(kilograms: Double, recordedAt: Date, sourceId: String?) async throws -> String {
        let quantity = HKQuantity(unit: .gramUnit(with: .kilo), doubleValue: kilograms)
        var metadata: [String:Any] = [HKMetadataKeyWasUserEntered: true]
        if let sourceId { metadata[sourceIdKey] = sourceId }

        let sample = HKQuantitySample(
            type: weightType,
            quantity: quantity,
            start: recordedAt,
            end: recordedAt,
            metadata: metadata
        )
        try await store.save(sample)
        return sample.uuid.uuidString
    }

    func writeSleep(start: Date, end: Date, sourceId: String?) async throws -> String {
        guard end > start else { throw HealthKitError.invalidPayload }

        var metadata: [String:Any] = [:]
        if let sourceId { metadata[sourceIdKey] = sourceId }

        let sample = HKCategorySample(
            type: sleepType,
            value: HKCategoryValueSleepAnalysis.asleepUnspecified.rawValue,
            start: start,
            end: end,
            metadata: metadata
        )
        try await store.save(sample)
        return sample.uuid.uuidString
    }

    func writeWorkout(
        kind: String,
        start: Date,
        end: Date,
        clientSessionId: String,
        activeEnergyKcal: Double?,
        distanceMeters: Double?
    ) async throws -> String {
        guard end > start else { throw HealthKitError.invalidPayload }

        let configuration = HKWorkoutConfiguration()
        configuration.activityType = activityType(for: kind)
        if kind == "running" || kind == "walking" || kind == "cycling" {
            configuration.locationType = .outdoor
        }

        let builder = HKWorkoutBuilder(
            healthStore: store,
            configuration: configuration,
            device: .local()
        )

        try await builder.beginCollection(at: start)
        try await builder.addMetadata([
            HKMetadataKeyWorkoutBrandName: "Charlie Training",
            clientSessionIdKey: clientSessionId
        ])

        var samples: [HKSample] = []

        if let activeEnergyKcal, activeEnergyKcal > 0 {
            let quantity = HKQuantity(unit: .kilocalorie(), doubleValue: activeEnergyKcal)
            samples.append(HKQuantitySample(
                type: activeEnergyType,
                quantity: quantity,
                start: start,
                end: end
            ))
        }

        if let distanceMeters, distanceMeters > 0 {
            let identifier: HKQuantityTypeIdentifier? = {
                switch kind {
                case "running", "walking": return .distanceWalkingRunning
                case "cycling": return .distanceCycling
                default: return nil
                }
            }()
            if let identifier,
               let distanceType = HKObjectType.quantityType(forIdentifier: identifier) {
                let quantity = HKQuantity(unit: .meter(), doubleValue: distanceMeters)
                samples.append(HKQuantitySample(
                    type: distanceType,
                    quantity: quantity,
                    start: start,
                    end: end
                ))
            }
        }

        if !samples.isEmpty {
            try await builder.addSamples(samples)
        }

        try await builder.endCollection(at: end)
        let workout = try await builder.finishWorkout()
        guard let workout else { throw HealthKitError.writeFailed }
        return workout.uuid.uuidString
    }

    private func recentWeights(since start: Date) async throws -> [HealthWeightDTO] {
        let samples = try await querySamples(
            type: weightType,
            start: start,
            limit: 500
        ) as? [HKQuantitySample] ?? []

        let unit = HKUnit.gramUnit(with: .kilo)
        return samples.map {
            HealthWeightDTO(
                externalId: $0.uuid.uuidString,
                recordedAt: iso.string(from: $0.startDate),
                kilograms: $0.quantity.doubleValue(for: unit)
            )
        }
    }

    private func recentSleepSessions(since start: Date) async throws -> [HealthSleepDTO] {
        let raw = try await querySamples(
            type: sleepType,
            start: start,
            limit: 2000
        ) as? [HKCategorySample] ?? []

        let asleepValues: Set<Int> = [
            HKCategoryValueSleepAnalysis.asleepUnspecified.rawValue,
            HKCategoryValueSleepAnalysis.asleepCore.rawValue,
            HKCategoryValueSleepAnalysis.asleepDeep.rawValue,
            HKCategoryValueSleepAnalysis.asleepREM.rawValue
        ]

        let samples = raw
            .filter { asleepValues.contains($0.value) }
            .sorted { $0.startDate < $1.startDate }

        guard !samples.isEmpty else { return [] }

        struct Episode {
            var firstId: String
            var start: Date
            var end: Date
        }

        var episodes: [Episode] = []
        let maxGap: TimeInterval = 3 * 3600

        for sample in samples {
            if var last = episodes.last,
               sample.startDate.timeIntervalSince(last.end) <= maxGap {
                episodes.removeLast()
                last.start = min(last.start, sample.startDate)
                last.end = max(last.end, sample.endDate)
                episodes.append(last)
            } else {
                episodes.append(Episode(
                    firstId: sample.uuid.uuidString,
                    start: sample.startDate,
                    end: sample.endDate
                ))
            }
        }

        return episodes
            .filter { $0.end.timeIntervalSince($0.start) >= 30 * 60 }
            .map {
                HealthSleepDTO(
                    externalId: "sleep-" + $0.firstId,
                    start: iso.string(from: $0.start),
                    end: iso.string(from: $0.end)
                )
            }
    }

    private func recentWorkouts(since start: Date) async throws -> [HealthWorkoutDTO] {
        let samples = try await querySamples(
            type: HKObjectType.workoutType(),
            start: start,
            limit: 500
        ) as? [HKWorkout] ?? []

        return samples.map { workout in
            let activity = workout.workoutActivityType
            return HealthWorkoutDTO(
                externalId: workout.uuid.uuidString,
                start: iso.string(from: workout.startDate),
                end: iso.string(from: workout.endDate),
                activityType: activity.rawValue,
                activityName: activityName(activity),
                durationSeconds: workout.duration,
                activeEnergyKcal: workout.totalEnergyBurned?.doubleValue(for: .kilocalorie()),
                distanceMeters: workout.totalDistance?.doubleValue(for: .meter()),
                clientSessionId: workout.metadata?[clientSessionIdKey] as? String
            )
        }
    }

    private func dailyMetrics(since start: Date) async throws -> [HealthDailyDTO] {
        async let steps = statistics(type: stepType, start: start, options: .cumulativeSum)
        async let energy = statistics(type: activeEnergyType, start: start, options: .cumulativeSum)
        async let hr = statistics(type: heartRateType, start: start, options: .discreteAverage)
        async let resting = statistics(type: restingHeartRateType, start: start, options: .discreteAverage)

        let stepStats = try await steps
        let energyStats = try await energy
        let hrStats = try await hr
        let restingStats = try await resting

        let calendar = Calendar.current
        let startDay = calendar.startOfDay(for: start)
        let endDay = calendar.startOfDay(for: Date())
        let formatter = DateFormatter()
        formatter.calendar = calendar
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"

        var rows: [HealthDailyDTO] = []
        var day = startDay

        while day <= endDay {
            let next = calendar.date(byAdding: .day, value: 1, to: day) ?? day.addingTimeInterval(86400)

            func stat(_ collection: HKStatisticsCollection) -> HKStatistics? {
                collection.statistics().first {
                    $0.startDate >= day && $0.startDate < next
                }
            }

            let stepsValue = stat(stepStats)?.sumQuantity()?.doubleValue(for: .count())
            let energyValue = stat(energyStats)?.sumQuantity()?.doubleValue(for: .kilocalorie())
            let hrUnit = HKUnit.count().unitDivided(by: .minute())
            let hrValue = stat(hrStats)?.averageQuantity()?.doubleValue(for: hrUnit)
            let restingValue = stat(restingStats)?.averageQuantity()?.doubleValue(for: hrUnit)

            if stepsValue != nil || energyValue != nil || hrValue != nil || restingValue != nil {
                rows.append(HealthDailyDTO(
                    date: formatter.string(from: day),
                    steps: stepsValue,
                    activeEnergyKcal: energyValue,
                    averageHeartRateBpm: hrValue,
                    restingHeartRateBpm: restingValue
                ))
            }

            day = next
        }

        return rows
    }

    private func querySamples(
        type: HKSampleType,
        start: Date,
        limit: Int
    ) async throws -> [HKSample] {
        try await withCheckedThrowingContinuation { continuation in
            let predicate = HKQuery.predicateForSamples(
                withStart: start,
                end: Date(),
                options: .strictEndDate
            )
            let sort = NSSortDescriptor(
                key: HKSampleSortIdentifierStartDate,
                ascending: false
            )
            let query = HKSampleQuery(
                sampleType: type,
                predicate: predicate,
                limit: limit,
                sortDescriptors: [sort]
            ) { _, samples, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }
                continuation.resume(returning: samples ?? [])
            }
            store.execute(query)
        }
    }

    private func statistics(
        type: HKQuantityType,
        start: Date,
        options: HKStatisticsOptions
    ) async throws -> HKStatisticsCollection {
        try await withCheckedThrowingContinuation { continuation in
            let calendar = Calendar.current
            let anchor = calendar.startOfDay(for: start)
            let predicate = HKQuery.predicateForSamples(
                withStart: anchor,
                end: Date(),
                options: .strictStartDate
            )
            let query = HKStatisticsCollectionQuery(
                quantityType: type,
                quantitySamplePredicate: predicate,
                options: options,
                anchorDate: anchor,
                intervalComponents: DateComponents(day: 1)
            )
            query.initialResultsHandler = { _, collection, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }
                guard let collection else {
                    continuation.resume(throwing: HealthKitError.queryFailed)
                    return
                }
                continuation.resume(returning: collection)
            }
            store.execute(query)
        }
    }

    private func authString(_ status: HKAuthorizationStatus) -> String {
        switch status {
        case .notDetermined: return "notDetermined"
        case .sharingDenied: return "sharingDenied"
        case .sharingAuthorized: return "sharingAuthorized"
        @unknown default: return "notDetermined"
        }
    }

    private func activityType(for kind: String) -> HKWorkoutActivityType {
        switch kind {
        case "running": return .running
        case "walking": return .walking
        case "cycling": return .cycling
        case "strength": return .traditionalStrengthTraining
        default: return .other
        }
    }

    private func activityName(_ type: HKWorkoutActivityType) -> String {
        switch type {
        case .running: return "Running"
        case .walking: return "Walking"
        case .cycling: return "Cycling"
        case .traditionalStrengthTraining: return "Strength Training"
        case .functionalStrengthTraining: return "Functional Strength Training"
        case .highIntensityIntervalTraining: return "HIIT"
        case .coreTraining: return "Core Training"
        case .flexibility: return "Flexibility"
        default: return "Workout"
        }
    }
}

enum HealthKitError: Error {
    case unavailable
    case invalidPayload
    case queryFailed
    case writeFailed
}
