import SwiftUI
import WidgetKit

// ============================================================================
// LEVL — Today widget
//
// ONE widget, in two sizes. The brief asked for one or two excellent widgets
// rather than a dozen, and everything a LEVL user wants from the home screen
// fits in a single question: where am I, and what is left today?
//
//   small   level ring, streak, and whether today is done
//   medium  the same plus what to train next
//
// It reads the App Group snapshot the app writes. No network, no HealthKit, no
// photographs — a widget's contents are visible on a locked device.
// ============================================================================

private let levlGold = Color(red: 1.0, green: 0.788, blue: 0.2)
private let levlGreen = Color(red: 0.184, green: 0.890, blue: 0.608)
private let levlBG = Color(red: 0.055, green: 0.063, blue: 0.086)
private let levlPanel = Color(red: 0.094, green: 0.110, blue: 0.153)

struct LevlTodayEntry: TimelineEntry {
  let date: Date
  let today: LevlSharedStore.Today
}

struct LevlTodayProvider: TimelineProvider {
  func placeholder(in context: Context) -> LevlTodayEntry {
    LevlTodayEntry(date: Date(), today: LevlSharedStore.Today(
      level: 27, title: "Iron Veteran", rank: "Gold II", levelPct: 62,
      trainingStreak: 12, checkInStreak: 8, checkedInToday: true,
      nextWorkoutName: "Push", nextWorkoutFirstExercise: "Bench Press", todaysSets: 14))
  }

  func getSnapshot(in context: Context, completion: @escaping (LevlTodayEntry) -> Void) {
    completion(LevlTodayEntry(date: Date(), today: LevlSharedStore.read()))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<LevlTodayEntry>) -> Void) {
    let entry = LevlTodayEntry(date: Date(), today: LevlSharedStore.read())
    // The app reloads timelines itself whenever the snapshot changes, so this
    // refresh is only a safety net for the day rolling over.
    let next = Calendar.current.date(byAdding: .hour, value: 1, to: Date()) ?? Date().addingTimeInterval(3600)
    completion(Timeline(entries: [entry], policy: .after(next)))
  }
}

// ---------------------------------------------------------------------------

struct LevlTodayWidgetView: View {
  @Environment(\.widgetFamily) private var family
  let entry: LevlTodayEntry

  var body: some View {
    switch family {
    case .systemMedium: MediumView(today: entry.today)
    default:            SmallView(today: entry.today)
    }
  }
}

private struct LevelRing: View {
  let level: Int
  let pct: Int

  var body: some View {
    ZStack {
      Circle()
        .stroke(Color.white.opacity(0.12), lineWidth: 5)
      Circle()
        .trim(from: 0, to: max(0.02, min(1, Double(pct) / 100)))
        .stroke(levlGold, style: StrokeStyle(lineWidth: 5, lineCap: .round))
        .rotationEffect(.degrees(-90))
      VStack(spacing: -1) {
        Text("LV")
          .font(.system(size: 8, weight: .bold))
          .foregroundStyle(.white.opacity(0.5))
        Text("\(level)")
          .font(.system(size: 21, weight: .bold).monospacedDigit())
          .foregroundStyle(.white)
      }
    }
  }
}

private struct StatusChip: View {
  let done: Bool
  var body: some View {
    HStack(spacing: 4) {
      Image(systemName: done ? "checkmark.circle.fill" : "camera.fill")
        .font(.system(size: 10, weight: .bold))
      Text(done ? "Checked in" : "Check In")
        .font(.system(size: 11, weight: .semibold))
    }
    .foregroundStyle(done ? levlGreen : levlGold)
    .padding(.horizontal, 8)
    .padding(.vertical, 4)
    .background(
      Capsule().fill((done ? levlGreen : levlGold).opacity(0.14))
    )
  }
}

private struct SmallView: View {
  let today: LevlSharedStore.Today

  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      HStack {
        Text("LEVL")
          .font(.system(size: 10, weight: .heavy)).tracking(2)
          .foregroundStyle(levlGold)
        Spacer()
        if today.trainingStreak > 0 {
          Text("\(today.trainingStreak)d")
            .font(.system(size: 11, weight: .bold).monospacedDigit())
            .foregroundStyle(.white.opacity(0.55))
        }
      }
      Spacer(minLength: 4)
      HStack(spacing: 10) {
        LevelRing(level: today.level, pct: today.levelPct).frame(width: 52, height: 52)
        VStack(alignment: .leading, spacing: 1) {
          Text(today.rank.isEmpty ? "Unranked" : today.rank)
            .font(.system(size: 12, weight: .semibold))
            .foregroundStyle(.white)
            .lineLimit(1)
          Text(today.title)
            .font(.system(size: 10, weight: .medium))
            .foregroundStyle(.white.opacity(0.5))
            .lineLimit(1)
        }
      }
      Spacer(minLength: 6)
      StatusChip(done: today.checkedInToday)
    }
    .padding(12)
    .widgetURL(URL(string: today.checkedInToday ? "levl://social" : "levl://check-in"))
  }
}

private struct MediumView: View {
  let today: LevlSharedStore.Today

  var body: some View {
    HStack(spacing: 14) {
      VStack(alignment: .leading, spacing: 6) {
        Text("LEVL")
          .font(.system(size: 10, weight: .heavy)).tracking(2)
          .foregroundStyle(levlGold)
        LevelRing(level: today.level, pct: today.levelPct).frame(width: 56, height: 56)
        Text(today.rank.isEmpty ? "Unranked" : today.rank)
          .font(.system(size: 11, weight: .semibold))
          .foregroundStyle(.white.opacity(0.75))
          .lineLimit(1)
      }

      Rectangle().fill(Color.white.opacity(0.08)).frame(width: 1)

      VStack(alignment: .leading, spacing: 7) {
        if let workout = today.nextWorkoutName, !workout.isEmpty {
          VStack(alignment: .leading, spacing: 1) {
            Text("NEXT")
              .font(.system(size: 9, weight: .bold)).tracking(0.8)
              .foregroundStyle(.white.opacity(0.4))
            Text(workout)
              .font(.system(size: 17, weight: .semibold))
              .foregroundStyle(.white)
              .lineLimit(1)
            if let first = today.nextWorkoutFirstExercise, !first.isEmpty {
              Text(first)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(.white.opacity(0.5))
                .lineLimit(1)
            }
          }
        } else if today.todaysSets > 0 {
          VStack(alignment: .leading, spacing: 1) {
            Text("TODAY")
              .font(.system(size: 9, weight: .bold)).tracking(0.8)
              .foregroundStyle(.white.opacity(0.4))
            Text("\(today.todaysSets) sets logged")
              .font(.system(size: 17, weight: .semibold).monospacedDigit())
              .foregroundStyle(.white)
          }
        } else {
          VStack(alignment: .leading, spacing: 1) {
            Text("TODAY")
              .font(.system(size: 9, weight: .bold)).tracking(0.8)
              .foregroundStyle(.white.opacity(0.4))
            Text("Nothing logged yet")
              .font(.system(size: 16, weight: .semibold))
              .foregroundStyle(.white.opacity(0.8))
          }
        }

        HStack(spacing: 8) {
          if today.checkInStreak > 0 {
            Label("\(today.checkInStreak)", systemImage: "flame.fill")
              .font(.system(size: 11, weight: .semibold).monospacedDigit())
              .foregroundStyle(levlGold)
          }
          StatusChip(done: today.checkedInToday)
        }
        Spacer(minLength: 0)
      }
      Spacer(minLength: 0)
    }
    .padding(14)
    .widgetURL(URL(string: "levl://train"))
  }
}

// ---------------------------------------------------------------------------

struct LevlTodayWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "LevlTodayWidget", provider: LevlTodayProvider()) { entry in
      if #available(iOS 17.0, *) {
        LevlTodayWidgetView(entry: entry)
          .containerBackground(for: .widget) {
            LinearGradient(colors: [levlPanel, levlBG], startPoint: .top, endPoint: .bottom)
          }
      } else {
        ZStack {
          LinearGradient(colors: [levlPanel, levlBG], startPoint: .top, endPoint: .bottom)
          LevlTodayWidgetView(entry: entry)
        }
      }
    }
    .configurationDisplayName("LEVL Today")
    .description("Your level, streak and what to train next.")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}
