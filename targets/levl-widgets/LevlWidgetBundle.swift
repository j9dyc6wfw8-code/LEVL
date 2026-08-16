import SwiftUI
import WidgetKit

// The extension's entry point. Live Activities are gated on 16.2 so the
// extension still installs and the home screen widget still works on iOS 15.
@main
struct LevlWidgetBundle: WidgetBundle {
  var body: some Widget {
    LevlTodayWidget()
    if #available(iOS 16.2, *) {
      LevlWorkoutLiveActivity()
    }
  }
}
