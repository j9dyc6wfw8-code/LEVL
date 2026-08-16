import ExpoModulesCore
import Foundation
#if canImport(ActivityKit)
import ActivityKit
#endif
#if canImport(WidgetKit)
import WidgetKit
#endif

// ============================================================================
// LEVL — LevlLiveActivityModule
//
// Drives the workout Live Activity, and writes the home screen widget snapshot.
//
// LIFECYCLE IS THE WHOLE JOB HERE. A Live Activity that outlives its workout is
// worse than none at all — it sits on the Lock Screen counting up from a
// session that ended hours ago. So:
//
//   • `start` adopts any activity this app already has running for the same
//     session instead of stacking a second one.
//   • `start` also ENDS any stale activity from a previous session, which is
//     what recovers the app being force-quit mid-workout.
//   • `end` is immediate (.immediate), not "dismiss after a while".
//   • `endAll` runs at launch so a crash can never leave a zombie behind.
//
// Everything is gated on iOS 16.2 and on the user's system-wide Live Activities
// switch. Older devices and opted-out users get a clean `false`, never an error.
// ============================================================================

public class LevlLiveActivityModule: Module {

  public func definition() -> ModuleDefinition {
    Name("LevlLiveActivity")

    Function("isSupported") { () -> Bool in
      #if canImport(ActivityKit)
      if #available(iOS 16.2, *) {
        return ActivityAuthorizationInfo().areActivitiesEnabled
      }
      #endif
      return false
    }

    // Distinguishes "this iPhone is too old" from "you switched it off in
    // Settings", so the app can offer the right explanation.
    Function("getAvailability") { () -> [String: Any] in
      #if canImport(ActivityKit)
      if #available(iOS 16.2, *) {
        return [
          "osSupported": true,
          "enabled": ActivityAuthorizationInfo().areActivitiesEnabled,
        ]
      }
      #endif
      return ["osSupported": false, "enabled": false]
    }

    AsyncFunction("start") { (options: [String: Any], promise: Promise) in
      #if canImport(ActivityKit)
      if #available(iOS 16.2, *) {
        LiveActivityBridge.shared.start(options: options, promise: promise)
        return
      }
      #endif
      promise.resolve(nil)
    }

    AsyncFunction("update") { (options: [String: Any], promise: Promise) in
      #if canImport(ActivityKit)
      if #available(iOS 16.2, *) {
        LiveActivityBridge.shared.update(options: options, promise: promise)
        return
      }
      #endif
      promise.resolve(false)
    }

    AsyncFunction("end") { (promise: Promise) in
      #if canImport(ActivityKit)
      if #available(iOS 16.2, *) {
        LiveActivityBridge.shared.end(promise: promise)
        return
      }
      #endif
      promise.resolve(false)
    }

    // Called at launch. Clears anything a crash or force-quit left behind.
    AsyncFunction("endAll") { (promise: Promise) in
      #if canImport(ActivityKit)
      if #available(iOS 16.2, *) {
        LiveActivityBridge.shared.endAll(promise: promise)
        return
      }
      #endif
      promise.resolve(0)
    }

    /// The session id of a currently running activity, if any. The app uses it
    /// to decide whether to resume a workout after being killed.
    // A Home Screen Quick Action, App Intent or Siri phrase that fired before
    // the JS router existed. Reading it consumes it, so it never fires twice.
    Function("takePendingRoute") { () -> String? in
      LevlAppDelegateSubscriber.takePendingRoute()
    }

    Function("currentSessionId") { () -> String? in
      #if canImport(ActivityKit)
      if #available(iOS 16.2, *) {
        return Activity<LevlWorkoutAttributes>.activities.first?.attributes.sessionId
      }
      #endif
      return nil
    }

    // ---- Home screen widget snapshot ------------------------------------
    Function("setTodaySnapshot") { (payload: [String: Any]) -> Void in
      let today = LevlSharedStore.Today(
        level: payload["level"] as? Int ?? 1,
        title: payload["title"] as? String ?? "",
        rank: payload["rank"] as? String ?? "",
        levelPct: payload["levelPct"] as? Int ?? 0,
        trainingStreak: payload["trainingStreak"] as? Int ?? 0,
        checkInStreak: payload["checkInStreak"] as? Int ?? 0,
        checkedInToday: payload["checkedInToday"] as? Bool ?? false,
        nextWorkoutName: payload["nextWorkoutName"] as? String,
        nextWorkoutFirstExercise: payload["nextWorkoutFirstExercise"] as? String,
        todaysSets: payload["todaysSets"] as? Int ?? 0,
        updatedAt: Date()
      )
      LevlSharedStore.write(today)
      #if canImport(WidgetKit)
      if #available(iOS 14.0, *) {
        WidgetCenter.shared.reloadTimelines(ofKind: "LevlTodayWidget")
      }
      #endif
    }
  }
}

// ---------------------------------------------------------------------------

#if canImport(ActivityKit)
@available(iOS 16.2, *)
final class LiveActivityBridge {
  static let shared = LiveActivityBridge()
  private init() {}

  private var activity: Activity<LevlWorkoutAttributes>?

  private func contentState(from o: [String: Any]) -> LevlWorkoutAttributes.ContentState {
    // Rest is sent as SECONDS REMAINING and converted to an absolute end date
    // here. SwiftUI then counts it down locally, so a running rest timer costs
    // zero further updates — which matters, because ActivityKit throttles apps
    // that push frequently.
    var restEndsAt: Date?
    if let seconds = o["restSeconds"] as? Double, seconds > 0 {
      restEndsAt = Date().addingTimeInterval(seconds)
    } else if let ms = o["restEndsAtMs"] as? Double, ms > 0 {
      restEndsAt = Date(timeIntervalSince1970: ms / 1000)
    }

    let startedAt: Date = {
      if let ms = o["startedAtMs"] as? Double, ms > 0 {
        return Date(timeIntervalSince1970: ms / 1000)
      }
      return Date()
    }()

    return LevlWorkoutAttributes.ContentState(
      exercise: o["exercise"] as? String ?? "Workout",
      setNumber: o["setNumber"] as? Int ?? 1,
      totalSets: o["totalSets"] as? Int,
      restEndsAt: restEndsAt,
      startedAt: startedAt,
      lastWeight: o["lastWeight"] as? Double,
      lastReps: o["lastReps"] as? Int,
      nextWeight: o["nextWeight"] as? Double,
      nextReps: o["nextReps"] as? Int,
      unit: o["unit"] as? String ?? "kg",
      xpEarned: o["xpEarned"] as? Int ?? 0,
      isPR: o["isPR"] as? Bool ?? false,
      duelNote: o["duelNote"] as? String
    )
  }

  func start(options: [String: Any], promise: Promise) {
    guard ActivityAuthorizationInfo().areActivitiesEnabled else {
      promise.resolve(nil); return
    }
    let sessionId = options["sessionId"] as? String ?? UUID().uuidString
    let workoutName = options["workoutName"] as? String ?? "Training"

    // Already running for this session? Update it rather than stacking.
    if let existing = Activity<LevlWorkoutAttributes>.activities
        .first(where: { $0.attributes.sessionId == sessionId }) {
      activity = existing
      Task {
        await existing.update(ActivityContent(state: contentState(from: options), staleDate: nil))
        promise.resolve(existing.id)
      }
      return
    }

    // Anything from an earlier session is stale — end it before starting.
    Task {
      for old in Activity<LevlWorkoutAttributes>.activities {
        await old.end(nil, dismissalPolicy: .immediate)
      }
      do {
        let started = try Activity.request(
          attributes: LevlWorkoutAttributes(workoutName: workoutName, sessionId: sessionId),
          content: ActivityContent(state: self.contentState(from: options), staleDate: nil),
          pushType: nil
        )
        self.activity = started
        promise.resolve(started.id)
      } catch {
        // A refusal here is normal (too many activities, user opted out) and
        // must never break the workout itself.
        promise.resolve(nil)
      }
    }
  }

  func update(options: [String: Any], promise: Promise) {
    let live = activity ?? Activity<LevlWorkoutAttributes>.activities.first
    guard let live else { promise.resolve(false); return }
    activity = live
    Task {
      // A stale date tells iOS to grey the activity out if the app goes quiet,
      // rather than showing numbers that stopped being true an hour ago.
      let stale = Date().addingTimeInterval(60 * 60)
      await live.update(ActivityContent(state: contentState(from: options), staleDate: stale))
      promise.resolve(true)
    }
  }

  func end(promise: Promise) {
    let live = activity ?? Activity<LevlWorkoutAttributes>.activities.first
    guard let live else { promise.resolve(false); return }
    Task {
      await live.end(nil, dismissalPolicy: .immediate)
      self.activity = nil
      promise.resolve(true)
    }
  }

  func endAll(promise: Promise) {
    Task {
      var n = 0
      for old in Activity<LevlWorkoutAttributes>.activities {
        await old.end(nil, dismissalPolicy: .immediate)
        n += 1
      }
      self.activity = nil
      promise.resolve(n)
    }
  }
}
#endif
