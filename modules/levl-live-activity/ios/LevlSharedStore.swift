import Foundation

// ============================================================================
// LEVL — LevlSharedStore
//
// The one narrow channel between the app and its widget. Compiled into both
// targets so the keys can never drift.
//
// Widgets run in a separate process and cannot see AsyncStorage, Supabase or
// anything else the app uses. They read a small snapshot the app writes to a
// shared App Group container after every meaningful change.
//
// WHAT GOES IN HERE: only what a home screen widget shows — level, streaks,
// today's plan, whether the Check In is done. Nothing private, nothing from
// HealthKit, no photographs. Health data in particular must never leave the
// app's own sandbox, and a widget snapshot is the classic way that happens by
// accident.
// ============================================================================

public enum LevlSharedStore {

  public static let appGroup = "group.com.matteo.ascend"
  private static let key = "levl.today.v1"

  public struct Today: Codable {
    public var level: Int
    public var title: String
    public var rank: String
    public var levelPct: Int
    public var trainingStreak: Int
    public var checkInStreak: Int
    public var checkedInToday: Bool
    public var nextWorkoutName: String?
    public var nextWorkoutFirstExercise: String?
    public var todaysSets: Int
    public var updatedAt: Date

    public init(level: Int = 1, title: String = "", rank: String = "",
                levelPct: Int = 0, trainingStreak: Int = 0, checkInStreak: Int = 0,
                checkedInToday: Bool = false, nextWorkoutName: String? = nil,
                nextWorkoutFirstExercise: String? = nil, todaysSets: Int = 0,
                updatedAt: Date = Date()) {
      self.level = level
      self.title = title
      self.rank = rank
      self.levelPct = levelPct
      self.trainingStreak = trainingStreak
      self.checkInStreak = checkInStreak
      self.checkedInToday = checkedInToday
      self.nextWorkoutName = nextWorkoutName
      self.nextWorkoutFirstExercise = nextWorkoutFirstExercise
      self.todaysSets = todaysSets
      self.updatedAt = updatedAt
    }
  }

  private static var defaults: UserDefaults? {
    UserDefaults(suiteName: appGroup)
  }

  public static func write(_ today: Today) {
    guard let defaults, let data = try? JSONEncoder().encode(today) else { return }
    defaults.set(data, forKey: key)
  }

  /// Returns a default-shaped snapshot rather than nil so the widget always has
  /// something sensible to render — a blank widget looks broken.
  public static func read() -> Today {
    guard let defaults,
          let data = defaults.data(forKey: key),
          let today = try? JSONDecoder().decode(Today.self, from: data) else {
      return Today()
    }
    return today
  }
}
