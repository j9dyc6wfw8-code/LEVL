import ExpoModulesCore
import UIKit

// ============================================================================
// LEVL — Home Screen Quick Actions
//
// Long-pressing the app icon offers Start Workout / Check In / Active Duel. iOS
// delivers the chosen action to the UIApplicationDelegate, not through the URL
// system, so it needs a small native hop to become a route the JS router
// understands.
//
// Two delivery paths, because iOS uses both:
//   COLD LAUNCH  the shortcut arrives in launchOptions before any JS exists, so
//                it is parked and collected once the router is ready.
//   WARM LAUNCH  the app is already running and the delegate method fires, so
//                the route is emitted immediately.
//
// The same parking spot also serves App Intents and Siri, which cannot open a
// URL directly from an extension: they write a route into the shared App Group
// and iOS foregrounds the app, which then picks it up here.
// ============================================================================

public class LevlAppDelegateSubscriber: ExpoAppDelegateSubscriber {

  static let pendingKey = "levl.pendingRoute"
  private static var parked: String?

  /// Route captured before JS was ready, if any. Reading it clears it, so a
  /// shortcut can never fire twice.
  public static func takePendingRoute() -> String? {
    if let parked {
      Self.parked = nil
      return parked
    }
    // Anything an App Intent or Siri left in the shared container.
    if let defaults = UserDefaults(suiteName: LevlSharedStore.appGroup),
       let route = defaults.string(forKey: pendingKey) {
      defaults.removeObject(forKey: pendingKey)
      return route
    }
    return nil
  }

  static func park(_ route: String?) {
    guard let route, !route.isEmpty else { return }
    parked = route
    NotificationCenter.default.post(
      name: Notification.Name("LevlShortcutRoute"), object: nil, userInfo: ["route": route])
  }

  private static func route(from item: UIApplicationShortcutItem) -> String? {
    if let url = item.userInfo?["url"] as? String { return url }
    switch item.type {
    case "app.levl.start-workout": return "levl://train"
    case "app.levl.check-in":      return "levl://check-in"
    case "app.levl.active-duel":   return "levl://compete/duels"
    default: return nil
    }
  }

  public func application(_ application: UIApplication,
                          didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
    if let item = launchOptions?[.shortcutItem] as? UIApplicationShortcutItem {
      Self.park(Self.route(from: item))
    }
    return true
  }

  public func application(_ application: UIApplication,
                          performActionFor shortcutItem: UIApplicationShortcutItem,
                          completionHandler: @escaping (Bool) -> Void) {
    let route = Self.route(from: shortcutItem)
    Self.park(route)
    completionHandler(route != nil)
  }
}
