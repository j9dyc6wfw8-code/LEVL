import SwiftUI
import WidgetKit
import ActivityKit

// ============================================================================
// LEVL — Workout Live Activity (Lock Screen + Dynamic Island)
//
// THE RULE THIS FILE IS BUILT AROUND: one idea per state.
//
// A workout has plenty of numbers — set, rest, load, duration, XP, PRs, duel
// standing — and showing them all at once turns a glanceable surface into a
// dashboard you have to read. So each presentation picks the ONE thing that
// matters at that moment:
//
//     resting      → the countdown
//     just PR'd    → the PR
//     working      → which set you are on
//
// The expanded view is the only place that adds context, and even there it
// stops at previous/next load and elapsed time.
//
// Countdowns use Text(timerInterval:) so iOS animates them locally. Pushing a
// new content state every second would drain the battery and get the activity
// throttled by the system.
// ============================================================================

private let levlGold = Color(red: 1.0, green: 0.788, blue: 0.2)     // #ffc933
private let levlGreen = Color(red: 0.184, green: 0.890, blue: 0.608) // #2fe39b
private let levlInk = Color(red: 0.055, green: 0.063, blue: 0.086)   // #0e1016

@available(iOS 16.2, *)
struct LevlWorkoutLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: LevlWorkoutAttributes.self) { context in
      LockScreenView(attributes: context.attributes, state: context.state)
        .activityBackgroundTint(levlInk)
        .activitySystemActionForegroundColor(levlGold)

    } dynamicIsland: { context in
      let state = context.state

      return DynamicIsland {
        // ---- Expanded ----------------------------------------------------
        DynamicIslandExpandedRegion(.leading) {
          VStack(alignment: .leading, spacing: 2) {
            Text(state.exercise)
              .font(.system(size: 15, weight: .semibold))
              .foregroundStyle(.white)
              .lineLimit(1)
            Text(state.setLabel)
              .font(.system(size: 12, weight: .medium))
              .foregroundStyle(.white.opacity(0.6))
          }
          .padding(.leading, 4)
        }

        DynamicIslandExpandedRegion(.trailing) {
          VStack(alignment: .trailing, spacing: 2) {
            if state.isPR {
              Text("NEW PR")
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(levlGreen)
              Text(state.lastLoad ?? "")
                .font(.system(size: 15, weight: .semibold).monospacedDigit())
                .foregroundStyle(.white)
            } else if let restEndsAt = state.restEndsAt, state.isResting {
              Text("REST")
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(.white.opacity(0.5))
              Text(timerInterval: Date()...restEndsAt, countsDown: true)
                .font(.system(size: 19, weight: .semibold).monospacedDigit())
                .foregroundStyle(levlGold)
                .frame(width: 62, alignment: .trailing)
            } else {
              Text("ELAPSED")
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(.white.opacity(0.5))
              Text(timerInterval: state.startedAt...Date.distantFuture, countsDown: false)
                .font(.system(size: 17, weight: .semibold).monospacedDigit())
                .foregroundStyle(.white)
                .frame(width: 62, alignment: .trailing)
            }
          }
          .padding(.trailing, 4)
        }

        DynamicIslandExpandedRegion(.bottom) {
          HStack(spacing: 14) {
            if let last = state.lastLoad {
              StatColumn(label: "PREVIOUS", value: last)
            }
            if let next = state.nextLoad {
              StatColumn(label: "NEXT", value: next)
            }
            Spacer(minLength: 0)
            // The duel line appears only when there IS a duel, and never
            // alongside a PR — two celebrations at once read as neither.
            if let duel = state.duelNote, !state.isPR {
              StatColumn(label: "DUEL", value: duel, tint: levlGold)
            } else if state.xpEarned > 0 {
              StatColumn(label: "XP", value: "+\(state.xpEarned)", tint: levlGold)
            }
          }
          .padding(.top, 2)
          .padding(.horizontal, 4)
        }

      } compactLeading: {
        // ---- Compact -------------------------------------------------------
        Image(systemName: state.isPR ? "arrow.up.circle.fill" : "dumbbell.fill")
          .foregroundStyle(state.isPR ? levlGreen : levlGold)

      } compactTrailing: {
        if let restEndsAt = state.restEndsAt, state.isResting {
          Text(timerInterval: Date()...restEndsAt, countsDown: true)
            .font(.system(size: 14, weight: .semibold).monospacedDigit())
            .foregroundStyle(levlGold)
            .frame(width: 44)
        } else {
          Text(state.setLabelShort)
            .font(.system(size: 13, weight: .semibold).monospacedDigit())
            .foregroundStyle(.white)
        }

      } minimal: {
        if let restEndsAt = state.restEndsAt, state.isResting {
          Text(timerInterval: Date()...restEndsAt, countsDown: true)
            .font(.system(size: 12, weight: .semibold).monospacedDigit())
            .foregroundStyle(levlGold)
            .frame(width: 34)
        } else {
          Image(systemName: "dumbbell.fill").foregroundStyle(levlGold)
        }
      }
      // Tapping anywhere lands on the exact set in progress, not the home
      // screen. The session id travels in the URL so the app can restore state.
      .widgetURL(URL(string: "levl://workout/\(context.attributes.sessionId)"))
      .keylineTint(levlGold)
    }
  }
}

// ---------------------------------------------------------------------------

@available(iOS 16.2, *)
private struct StatColumn: View {
  let label: String
  let value: String
  var tint: Color = .white

  var body: some View {
    VStack(alignment: .leading, spacing: 1) {
      Text(label)
        .font(.system(size: 9, weight: .bold))
        .foregroundStyle(.white.opacity(0.45))
      Text(value)
        .font(.system(size: 13, weight: .semibold).monospacedDigit())
        .foregroundStyle(tint)
        .lineLimit(1)
    }
  }
}

// ---------------------------------------------------------------------------
// Lock screen — the roomiest presentation, so it can carry a little more than
// the Dynamic Island. Still one focal point: whatever is in the big type is the
// thing you glanced down to check.
// ---------------------------------------------------------------------------

@available(iOS 16.2, *)
private struct LockScreenView: View {
  let attributes: LevlWorkoutAttributes
  let state: LevlWorkoutAttributes.ContentState

  var body: some View {
    VStack(alignment: .leading, spacing: 0) {

      HStack(spacing: 6) {
        Text("LEVL")
          .font(.system(size: 11, weight: .heavy))
          .tracking(2.2)
          .foregroundStyle(levlGold)
        Text(attributes.workoutName.uppercased())
          .font(.system(size: 11, weight: .semibold))
          .tracking(1.0)
          .foregroundStyle(.white.opacity(0.45))
          .lineLimit(1)
        Spacer(minLength: 0)
        if state.xpEarned > 0 {
          Text("+\(state.xpEarned) XP")
            .font(.system(size: 11, weight: .semibold).monospacedDigit())
            .foregroundStyle(levlGold)
        }
      }

      HStack(alignment: .top, spacing: 12) {
        VStack(alignment: .leading, spacing: 3) {
          Text(state.isPR ? "NEW PERSONAL RECORD" : state.exercise)
            .font(.system(size: state.isPR ? 13 : 22, weight: state.isPR ? .bold : .semibold))
            .foregroundStyle(state.isPR ? levlGreen : .white)
            .lineLimit(1)
            .minimumScaleFactor(0.8)

          if state.isPR, let load = state.lastLoad {
            Text(load)
              .font(.system(size: 22, weight: .semibold).monospacedDigit())
              .foregroundStyle(.white)
          } else {
            Text(state.setLabel)
              .font(.system(size: 14, weight: .medium))
              .foregroundStyle(.white.opacity(0.6))
            if let load = state.lastLoad {
              Text(load)
                .font(.system(size: 15, weight: .semibold).monospacedDigit())
                .foregroundStyle(.white.opacity(0.85))
            }
          }
        }

        Spacer(minLength: 0)

        VStack(alignment: .trailing, spacing: 2) {
          if let restEndsAt = state.restEndsAt, state.isResting {
            Text("REST")
              .font(.system(size: 10, weight: .bold))
              .tracking(1.0)
              .foregroundStyle(.white.opacity(0.45))
            Text(timerInterval: Date()...restEndsAt, countsDown: true)
              .font(.system(size: 30, weight: .semibold).monospacedDigit())
              .foregroundStyle(levlGold)
              .frame(width: 104, alignment: .trailing)
          } else {
            Text("WORKOUT")
              .font(.system(size: 10, weight: .bold))
              .tracking(1.0)
              .foregroundStyle(.white.opacity(0.45))
            Text(timerInterval: state.startedAt...Date.distantFuture, countsDown: false)
              .font(.system(size: 26, weight: .semibold).monospacedDigit())
              .foregroundStyle(.white)
              .frame(width: 104, alignment: .trailing)
          }
        }
      }
      .padding(.top, 8)

      if let next = state.nextLoad, !state.isPR {
        Text("Next  \(next)")
          .font(.system(size: 12, weight: .medium).monospacedDigit())
          .foregroundStyle(.white.opacity(0.45))
          .padding(.top, 6)
      }
    }
    .padding(14)
  }
}
