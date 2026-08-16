import ExpoModulesCore
import AVFoundation

// ============================================================================
// LEVL — LevlDualCameraModule
//
// The JS-facing surface. Deliberately tiny: capability, permission, a view, and
// one capture call that resolves to a predictable structure or rejects with a
// typed code. Everything a caller needs to branch on is in the result.
// ============================================================================

public class LevlDualCameraModule: Module {
  public func definition() -> ModuleDefinition {
    Name("LevlDualCamera")

    Constants([
      // Whether this hardware can genuinely run both cameras at once. The JS
      // layer uses it to choose the capture copy, never to fake the capability.
      "isSimultaneousSupported": AVCaptureMultiCamSession.isMultiCamSupported,
    ])

    Function("getPermissionStatus") { () -> String in
      DualCameraController.authorizationStatus
    }

    AsyncFunction("requestPermission") { (promise: Promise) in
      DualCameraController.requestAccess { granted in
        promise.resolve(granted ? "granted" : "denied")
      }
    }

    View(LevlDualCameraView.self) {
      Events("onReady", "onCameraError")

      Prop("primary") { (view: LevlDualCameraView, value: String) in
        view.primary = (value == "front") ? "front" : "rear"
      }

      Prop("active") { (view: LevlDualCameraView, value: Bool) in
        if value { view.start() } else { view.stop() }
      }

      AsyncFunction("capture") { (view: LevlDualCameraView, promise: Promise) in
        view.capture(promise)
      }
    }
  }
}
