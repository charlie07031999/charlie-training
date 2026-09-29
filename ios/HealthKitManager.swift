import Foundation
import HealthKit

@MainActor
final class HealthKitManager: ObservableObject {
    private let store = HKHealthStore()

    @Published private(set) var isAuthorized = false

    private var sleepType: HKCategoryType {
        HKObjectType.categoryType(forIdentifier: .sleepAnalysis)!
    }

    private var weightType: HKQuantityType {
        HKObjectType.quantityType(forIdentifier: .bodyMass)!
    }

    private var heartRateType: HKQuantityType {
        HKObjectType.quantityType(forIdentifier: .heartRate)!
    }

    private var activeEnergyType: HKQuantityType {
        HKObjectType.quantityType(forIdentifier: .activeEnergyBurned)!
    }

    private var stepType: HKQuantityType {
        HKObjectType.quantityType(forIdentifier: .stepCount)!
    }

    func requestAuthorization() async throws {
        guard HKHealthStore.isHealthDataAvailable() else {
            throw HealthKitError.unavailable
        }

        let read: Set<HKObjectType> = [
            sleepType,
            weightType,
            heartRateType,
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
        isAuthorized = true
    }

    func recentSleep(since start: Date) async throws -> [HKCategorySample] {
        try await withCheckedThrowingContinuation { continuation in
            let predicate = HKQuery.predicateForSamples(withStart: start, end: Date(), options: .strictEndDate)
            let sort = NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: false)
            let query = HKSampleQuery(sampleType: sleepType, predicate: predicate, limit: 100, sortDescriptors: [sort]) { _, samples, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }
                continuation.resume(returning: (samples as? [HKCategorySample]) ?? [])
            }
            store.execute(query)
        }
    }

    func latestWeight() async throws -> HKQuantitySample? {
        try await withCheckedThrowingContinuation { continuation in
            let sort = NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)
            let query = HKSampleQuery(sampleType: weightType, predicate: nil, limit: 1, sortDescriptors: [sort]) { _, samples, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }
                continuation.resume(returning: samples?.first as? HKQuantitySample)
            }
            store.execute(query)
        }
    }

    func saveWeight(kilograms: Double, at date: Date = Date()) async throws {
        let quantity = HKQuantity(unit: .gramUnit(with: .kilo), doubleValue: kilograms)
        let sample = HKQuantitySample(type: weightType, quantity: quantity, start: date, end: date)
        try await store.save(sample)
    }

    func saveSleep(start: Date, end: Date) async throws {
        let sample = HKCategorySample(
            type: sleepType,
            value: HKCategoryValueSleepAnalysis.asleepUnspecified.rawValue,
            start: start,
            end: end
        )
        try await store.save(sample)
    }

    func saveWorkout(
        activityType: HKWorkoutActivityType,
        start: Date,
        end: Date,
        activeEnergyKcal: Double? = nil
    ) async throws {
        let configuration = HKWorkoutConfiguration()
        configuration.activityType = activityType

        let builder = HKWorkoutBuilder(healthStore: store, configuration: configuration, device: .local())
        try await builder.beginCollection(at: start)

        if let activeEnergyKcal {
            let quantity = HKQuantity(unit: .kilocalorie(), doubleValue: activeEnergyKcal)
            let sample = HKQuantitySample(type: activeEnergyType, quantity: quantity, start: start, end: end)
            try await builder.addSamples([sample])
        }

        try await builder.endCollection(at: end)
        _ = try await builder.finishWorkout()
    }
}

enum HealthKitError: Error {
    case unavailable
}
