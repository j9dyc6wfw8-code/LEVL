import ExpoModulesCore
import AVFoundation
import UIKit

// ============================================================================
// LEVL — LevlDualCameraView
//
// The live preview. On multi-cam hardware it shows both feeds at once: the rear
// camera edge to edge with the selfie floating in a corner, which is exactly
// what the resulting Check In looks like. On older hardware only the active
// camera has a feed, so the corner shows a placeholder instead of pretending.
//
// The layout mirrors the posted card on purpose — what you frame is what you
// get, with no surprise on the preview screen.
// ============================================================================

final class LevlDualCameraView: ExpoView {

  private let controller = DualCameraController()

  let onReady = EventDispatcher()
  let onCameraError = EventDispatcher()

  private let inset = CGRect(x: 0, y: 0, width: 0, height: 0)
  private var pipContainer = UIView()
  private var isStarted = false

  /// 'rear' or 'front' — which feed fills the frame.
  var primary: String = "rear" {
    didSet { setNeedsLayout() }
  }

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    clipsToBounds = true
    backgroundColor = .black

    pipContainer.backgroundColor = UIColor(white: 0.07, alpha: 1)
    pipContainer.layer.cornerRadius = 18
    pipContainer.layer.cornerCurve = .continuous
    pipContainer.layer.borderWidth = 2
    pipContainer.layer.borderColor = UIColor(white: 1, alpha: 0.65).cgColor
    pipContainer.clipsToBounds = true
    pipContainer.layer.shadowColor = UIColor.black.cgColor
    pipContainer.layer.shadowOpacity = 0.5
    pipContainer.layer.shadowRadius = 12
    pipContainer.layer.shadowOffset = CGSize(width: 0, height: 6)
    addSubview(pipContainer)

    controller.onReady = { [weak self] multiCam in
      guard let self else { return }
      self.attachLayers()
      self.onReady(["simultaneous": multiCam])
    }
    controller.onError = { [weak self] err in
      self?.onCameraError(["code": err.code, "message": err.errorDescription ?? "Camera error"])
    }
  }

  // --------------------------------------------------------------------------

  func start() {
    guard !isStarted else { return }
    isStarted = true
    controller.start()
  }

  func stop() {
    isStarted = false
    controller.stop()
  }

  func capture(_ promise: Promise) {
    controller.capture { result in
      switch result {
      case .success(let shot):
        promise.resolve([
          "front": shot.frontURL.absoluteString,
          "rear": shot.rearURL.absoluteString,
          "simultaneous": shot.simultaneous,
          "gapMs": shot.gapMs,
        ])
      case .failure(let err):
        promise.reject(err.code, err.errorDescription ?? "Capture failed")
      }
    }
  }

  // Leaving the screen must release the hardware. Without this the camera stays
  // warm, the green privacy dot stays lit, and reopening eventually fails.
  override func willMove(toWindow newWindow: UIWindow?) {
    super.willMove(toWindow: newWindow)
    if newWindow == nil { stop() }
  }

  deinit { controller.stop() }

  // --------------------------------------------------------------------------

  private func attachLayers() {
    DispatchQueue.main.async { [weak self] in
      guard let self else { return }
      if let back = self.controller.backPreviewLayer, back.superlayer == nil {
        self.layer.insertSublayer(back, at: 0)
      }
      if let front = self.controller.frontPreviewLayer, front.superlayer == nil {
        self.pipContainer.layer.insertSublayer(front, at: 0)
      }
      self.setNeedsLayout()
      self.layoutIfNeeded()
    }
  }

  override func layoutSubviews() {
    super.layoutSubviews()

    let pipW = min(bounds.width * 0.30, 132)
    let pipH = pipW * 4.0 / 3.0
    let margin: CGFloat = 14
    let pipFrame = CGRect(x: bounds.maxX - pipW - margin,
                          y: margin,
                          width: pipW, height: pipH)

    // Whichever feed is "primary" fills the frame; the other takes the corner.
    let frontIsPrimary = (primary == "front")
    let fullLayer = frontIsPrimary ? controller.frontPreviewLayer : controller.backPreviewLayer
    let pipLayer  = frontIsPrimary ? controller.backPreviewLayer  : controller.frontPreviewLayer

    CATransaction.begin()
    CATransaction.setDisableActions(true)

    if let fullLayer {
      if fullLayer.superlayer !== layer {
        fullLayer.removeFromSuperlayer()
        layer.insertSublayer(fullLayer, at: 0)
      }
      fullLayer.frame = bounds
    }
    if let pipLayer {
      if pipLayer.superlayer !== pipContainer.layer {
        pipLayer.removeFromSuperlayer()
        pipContainer.layer.insertSublayer(pipLayer, at: 0)
      }
      pipLayer.frame = CGRect(origin: .zero, size: pipFrame.size)
    }

    pipContainer.frame = pipFrame
    // Nothing to show in the corner on single-camera hardware — hide the panel
    // rather than leaving an empty black rectangle floating over the preview.
    pipContainer.isHidden = (pipLayer == nil)
    bringSubviewToFront(pipContainer)

    CATransaction.commit()
  }
}
