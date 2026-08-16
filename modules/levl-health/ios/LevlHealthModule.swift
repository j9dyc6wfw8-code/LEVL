import ExpoModulesCore
import Foundation
#if canImport(HealthKit)
import HealthKit
#endif

// ============================================================================
// LEVL — LevlHealthModule
//
// Apple Health, for CONTEXT ONLY.
//
// Nothing read here awards XP, moves a stat, changes a rank or affects a duel.
// That is a deliberate product rule, not an oversight: LEVL's ladder is built
// on training logged inside LEVL, and letting a step count feed it would make
// the ladder unfalsifiable. Health data is shown alongside your training and
// never scored, never uploaded, and never attached to a Check In.
//
// TWO THINGS APPLE'S API MAKES AWKWARD, HANDLED HERE:
//
//   1. YOU CANNOT ASK WHETHER READ ACCESS WAS GRANTED. authorizationStatus()
//      only reports WRITE permissions; for reads Apple deliberately returns
//      .notDetermined so an app cannot infer that a user hid a data type. So
//      "connected" is determined by actually attempting a read: if a query
//      returns data, we have access. A denied type quietly yields nothing,
//      which is exactly how it is meant to behave — partial permission must
//      never look like a failure.
//
//   2. WRITING A WORKOUT TWICE. Re-syncing must not create duplicate workouts
//      in Health, so every workout LEVL saves carries its session id in
//      metadata and is checked for before writing.
// ============================================================================

public class LevlHealthModule: Module {

  #if canImport(HealthKit)
  private let store = HKHealthStore()
  #endif

  public func definition() -> ModuleDefinition {
    Name("LevlHealth")

    Function("isAvailable") { () -> Bool in
      #if canImport(HealthKit)
      return HKHealthStore.isHealthDataAvailable()
      #else
      return false
      #endif
    }

    // Ask for everything LEVL can use, in one sheet, at a moment the user has
    // chosen. Never called at launch — see the Health onboarding card.
    AsyncFunction("requestAuthorization") { (promise: Promise) in
      #if canImport(HealthKit)
      guard HKHealthStore.isHealthDataAvailable() else {
        promise.resolve(["available": false, "requested": false]); return
      }
      var read = Set<HKObjectType>()
      for id in Self.readQuantityIds {
        if let t = HKQuantityType.quantityType(forIdentifier: id) { read.insert(t) }
      }
      if let sleep = HKCategoryType.categoryType(forIdentifier: .sleepAnalysis) { read.insert(sleep) }
      read.insert(HKObjectType.workoutType())

      var write = Set<HKSampleType>()
      write.insert(HKObjectType.workoutType())
      if let energy = HKQuantityType.quantityType(forIdentifier: .activeEnergyBurned) { write.insert(energy) }

      self.store.requestAuthorization(toShare: write, read: read) { ok, err in
        promise.resolve([
          "available": true,
          "requested": ok,
          "error": err?.localizedDescription as Any,
        ])
      }
      #else
      promise.resolve(["available": false, "requested": false])
      #endif
    }

    // Today's context. Every field is INDEPENDENTLY optional — a user who
    // shared steps but hid heart rate gets steps, not an error.
    AsyncFunction("readToday") { (promise: Promise) in
      #if canImport(HealthKit)
      guard HKHealthStore.isHealthDataAvailable() else { promise.resolve([:]); return }
      self.readToday { promise.resolve($0) }
      #else
      promise.resolve([:])
      #endif
    }

    // Save a completed LEVL workout to Health.
    //
    // Calorie estimates are NOT invented. If the caller has no measured energy
    // figure, none is written — a made-up number pollutes a health record that
    // other apps and, potentially, clinicians read.
    AsyncFunction("saveWorkout") { (options: [String: Any], promise: Promise) in
      #if canImport(HealthKit)
      guard HKHealthStore.isHealthDataAvailable() else {
        promise.resolve(["saved": false, "reason": "unavailable"]); return
      }
      self.saveWorkout(options, promise: promise)
      #else
      promise.resolve(["saved": false, "reason": "unavailable"])
      #endif
    }
  }

  // --------------------------------------------------------------------------

  #if canImport(HealthKit)

  private static let readQuantityIds: [HKQuantityTypeIdentifier] = [
    .stepCount,
    .activeEnergyBurned,
    .heartRate,
    .restingHeartRate,
    .bodyMass,
    .bodyFatPercentage,
    .vo2Max,
    .appleExerciseTime,
  ]

  private func readToday(_ done: @escaping ([String: Any]) -> Void) {
    let cal = Calendar.current
    let start = cal.startOfDay(for: Date())
    let predicate = HKQuery.predicateForSamples(withStart: start, end: Date(), options: .strictStartDate)

    var out: [String: Any] = [:]
    let group = DispatchGroup()
    let lock = NSLock()
    let put: (String, Any?) -> Void = { key, value in
      guard let value else { return }
      lock.lock(); out[key] = value; lock.unlock()
    }

    // --- cumulative sums for today ---
    let sums: [(HKQuantityTypeIdentifier, HKUnit, String)] = [
      (.stepCount, .count(), "steps"),
      (.activeEnergyBurned, .kilocalorie(), "activeEnergy"),
      (.appleExerciseTime, .minute(), "exerciseMinutes"),
    ]
    for (id, unit, key) in sums {
      guard let type = HKQuantityType.quantityType(forIdentifier: id) else { continue }
      group.enter()
      let q = HKStatisticsQuery(quantityType: type, quantitySamplePredicate: predicate,
                                options: .cumulativeSum) { _, stats, _ in
        put(key, stats?.sumQuantity()?.doubleValue(for: unit).rounded())
        group.leave()
      }
      store.execute(q)
    }

    // --- most recent single readings (not necessarily from today) ---
    let latest: [(HKQuantityTypeIdentifier, HKUnit, String)] = [
      (.restingHeartRate, HKUnit.count().unitDivided(by: .minute()), "restingHeartRate"),
      (.bodyMass, .gramUnit(with: .kilo), "bodyMassKg"),
      (.bodyFatPercentage, .percent(), "bodyFatPercent"),
      (.vo2Max, HKUnit(from: "ml/kg*min"), "vo2Max"),
    ]
    for (id, unit, key) in latest {
      guard let type = HKQuantityType.quantityType(forIdentifier: id) else { continue }
      group.enter()
      let sort = NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)
      let q = HKSampleQuery(sampleType: type, predicate: nil, limit: 1, sortDescriptors: [sort]) { _, samples, _ in
        if let s = samples?.first as? HKQuantitySample {
          var v = s.quantity.doubleValue(for: unit)
          if key == "bodyFatPercent" { v *= 100 }
          put(key, (v * 10).rounded() / 10)
          put(key + "Date", s.endDate.timeIntervalSince1970 * 1000)
        }
        group.leave()
      }
      store.execute(q)
    }

    // --- last night's sleep ---
    // "Last night" runs from 6pm yesterday, so a normal bedtime is captured
    // whichever side of midnight it falls on.
    if let sleepType = HKCategoryType.categoryType(forIdentifier: .sleepAnalysis) {
      group.enter()
      let from = cal.date(byAdding: .hour, value: -18, to: start) ?? start.addingTimeInterval(-64800)
      let sleepPredicate = HKQuery.predicateForSamples(withStart: from, end: Date(), options: [])
      let q = HKSampleQuery(sampleType: sleepType, predicate: sleepPredicate,
                            limit: HKObjectQueryNoLimit, sortDescriptors: nil) { _, samples, _ in
        var seconds: Double = 0
        for s in (samples as? [HKCategorySample]) ?? [] {
          // Count only genuinely asleep states. "In bed" includes reading and
          // lying awake, and reporting that as sleep would be misleading.
          let asleep: Bool
          if #available(iOS 16.0, *) {
            asleep = [HKCategoryValueSleepAnalysis.asleepCore.rawValue,
                      HKCategoryValueSleepAnalysis.asleepDeep.rawValue,
                      HKCategoryValueSleepAnalysis.asleepREM.rawValue,
                      HKCategoryValueSleepAnalysis.asleepUnspecified.rawValue].contains(s.value)
          } else {
            asleep = s.value == HKCategoryValueSleepAnalysis.asleep.rawValue
          }
          if asleep { seconds += s.endDate.timeIntervalSince(s.startDate) }
        }
        if seconds > 0 { put("sleepMinutes", (seconds / 60).rounded()) }
        group.leave()
      }
      store.execute(q)
    }

    group.notify(queue: .main) { done(out) }
  }

  // --------------------------------------------------------------------------

  private static let sessionKey = "LEVLSessionId"

  private func saveWorkout(_ o: [String: Any], promise: Promise) {
    guard let sessionId = o["sessionId"] as? String, !sessionId.isEmpty else {
      promise.resolve(["saved": false, "reason": "missing-session"]); return
    }
    let startMs = o["startedAtMs"] as? Double ?? 0
    let endMs = o["endedAtMs"] as? Double ?? 0
    guard startMs > 0, endMs > startMs else {
      promise.resolve(["saved": false, "reason": "bad-window"]); return
    }
    let start = Date(timeIntervalSince1970: startMs / 1000)
    let end = Date(timeIntervalSince1970: endMs / 1000)

    // Duplicate guard: look for a workout already carrying this session id.
    let predicate = HKQuery.predicateForObjects(
      withMetadataKey: Self.sessionKey, operatorType: .equalTo, value: sessionId)
    let existing = HKSampleQuery(sampleType: HKObjectType.workoutType(), predicate: predicate,
                                 limit: 1, sortDescriptors: nil) { [weak self] _, samples, _ in
      guard let self else { return }
      if let found = samples?.first, found.startDate == found.startDate {
        promise.resolve(["saved": false, "reason": "duplicate"]); return
      }
      self.writeWorkout(sessionId: sessionId, start: start, end: end, options: o, promise: promise)
    }
    store.execute(existing)
  }

  private func writeWorkout(sessionId: String, start: Date, end: Date,
                            options o: [String: Any], promise: Promise) {
    let activity: HKWorkoutActivityType = {
      switch (o["activity"] as? String ?? "strength") {
      case "cardio":       return .running
      case "cycling":      return .cycling
      case "rowing":       return .rowing
      case "swimming":     return .swimming
      case "hiit":         return .highIntensityIntervalTraining
      case "martialArts":  return .martialArts
      case "yoga":         return .yoga
      case "flexibility":  return .flexibility
      case "walking":      return .walking
      default:             return .traditionalStrengthTraining
      }
    }()

    var metadata: [String: Any] = [
      Self.sessionKey: sessionId,
      HKMetadataKeyWasUserEntered: true,   // logged by hand in LEVL, not measured
    ]
    if let name = o["workoutName"] as? String, !name.isEmpty {
      metadata[HKMetadataKeyWorkoutBrandName] = name
    }

    // Energy is written ONLY when the caller genuinely has a figure. LEVL does
    // not model calorie burn, so in practice this stays absent rather than
    // writing a fabricated number into somebody's health record.
    var energy: HKQuantity?
    if let kcal = o["activeEnergyKcal"] as? Double, kcal > 0 {
      energy = HKQuantity(unit: .kilocalorie(), doubleValue: kcal)
    }

    if #available(iOS 17.0, *) {
      // HKWorkout's initialisers are deprecated from iOS 17; the builder is the
      // supported path and is what Apple's own apps use.
      let config = HKWorkoutConfiguration()
      config.activityType = activity
      let builder = HKWorkoutBuilder(healthStore: store, configuration: config, device: .local())
      builder.beginCollection(withStart: start) { ok, err in
        guard ok else {
          promise.resolve(["saved": false, "reason": err?.localizedDescription ?? "begin-failed"]); return
        }
        let finish = {
          builder.addMetadata(metadata) { _, _ in
            builder.endCollection(withEnd: end) { done, endErr in
              guard done else {
                promise.resolve(["saved": false, "reason": endErr?.localizedDescription ?? "end-failed"]); return
              }
              builder.finishWorkout { workout, finishErr in
                promise.resolve([
                  "saved": workout != nil,
                  "reason": finishErr?.localizedDescription as Any,
                ])
              }
            }
          }
        }
        if let energy, let type = HKQuantityType.quantityType(forIdentifier: .activeEnergyBurned) {
          let sample = HKQuantitySample(type: type, quantity: energy, start: start, end: end)
          builder.add([sample]) { _, _ in finish() }
        } else {
          finish()
        }
      }
    } else {
      let workout = HKWorkout(activityType: activity, start: start, end: end,
                              duration: end.timeIntervalSince(start),
                              totalEnergyBurned: energy, totalDistance: nil,
                              metadata: metadata)
      store.save(workout) { ok, err in
        promise.resolve(["saved": ok, "reason": err?.localizedDescription as Any])
      }
    }
  }
  #endif
}
