import Foundation

#if canImport(ActivityKit)
import ActivityKit

// ============================================================================
// LEVL — LevlWorkoutAttributes
//
// The contract between the app and the Live Activity. This file is compiled
// into BOTH targets, so there is exactly one definition and the two can never
// drift apart.
//
// A note on what is NOT here: there are no controls. Tapping the Live Activity
// deep-links straight into the set you are on, and that is the whole
// interaction. Buttons for completing sets or nudging weights would mean
// logging a workout from a glanceable surface, which is a good way to log the
// wrong thing.
// ============================================================================

@available(iOS 16.2, *)
public struct LevlWorkoutAttributes: ActivityAttributes {

  public struct ContentState: Codable, Hashable {
    /// What is being trained right now, e.g. "Bench Press".
    public var exercise: String
    /// 1-based set number, and the planned total when a Workout Day is running.
    public var setNumber: Int
    public var totalSets: Int?

    /// When the current rest ends. Nil means "not resting".
    /// SwiftUI counts this down locally, so the countdown stays smooth without
    /// the app pushing an update every second.
    public var restEndsAt: Date?

    public var startedAt: Date

    /// The set just completed, and the target for the next one. Either may be
    /// absent — nothing is invented to fill the space.
    public var lastWeight: Double?
    public var lastReps: Int?
    public var nextWeight: Double?
    public var nextReps: Int?

    public var unit: String
    public var xpEarned: Int

    /// Set true for a few seconds right after a personal record, which flips
    /// the presentation to the PR state and then reverts.
    public var isPR: Bool

    /// Concise duel status, e.g. "+340 up". Surfaced only when there is an
    /// active duel, and never at the same time as a PR.
    public var duelNote: String?

    public init(exercise: String, setNumber: Int, totalSets: Int? = nil,
                restEndsAt: Date? = nil, startedAt: Date,
                lastWeight: Double? = nil, lastReps: Int? = nil,
                nextWeight: Double? = nil, nextReps: Int? = nil,
                unit: String = "kg", xpEarned: Int = 0,
                isPR: Bool = false, duelNote: String? = nil) {
      self.exercise = exercise
      self.setNumber = setNumber
      self.totalSets = totalSets
      self.restEndsAt = restEndsAt
      self.startedAt = startedAt
      self.lastWeight = lastWeight
      self.lastReps = lastReps
      self.nextWeight = nextWeight
      self.nextReps = nextReps
      self.unit = unit
      self.xpEarned = xpEarned
      self.isPR = isPR
      self.duelNote = duelNote
    }
  }

  /// Fixed for the lifetime of the workout.
  public var workoutName: String
  public var sessionId: String

  public init(workoutName: String, sessionId: String) {
    self.workoutName = workoutName
    self.sessionId = sessionId
  }
}

// Formatting shared by every surface, so the lock screen and the Dynamic
// Island can never disagree about how a load is written.
@available(iOS 16.2, *)
public extension LevlWorkoutAttributes.ContentState {

  var isResting: Bool {
    guard let restEndsAt else { return false }
    return restEndsAt > Date()
  }

  var setLabel: String {
    if let total = totalSets, total > 0 { return "Set \(setNumber) of \(total)" }
    return "Set \(setNumber)"
  }

  var setLabelShort: String {
    if let total = totalSets, total > 0 { return "\(setNumber)/\(total)" }
    return "Set \(setNumber)"
  }

  func load(_ weight: Double?, _ reps: Int?) -> String? {
    guard let reps, reps > 0 else { return nil }
    guard let weight, weight > 0 else { return "\(reps) reps" }
    let rounded = weight.rounded() == weight
      ? String(Int(weight))
      : String(format: "%.1f", weight)
    return "\(rounded) \(unit) × \(reps)"
  }

  var lastLoad: String? { load(lastWeight, lastReps) }
  var nextLoad: String? { load(nextWeight, nextReps) }
}
#endif
