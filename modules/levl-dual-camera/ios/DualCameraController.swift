import AVFoundation
import UIKit

// ============================================================================
// LEVL — DualCameraController
//
// Captures the two halves of a Check In: what you are looking at, and you.
//
// TWO REAL PATHS, NEVER A PRETEND ONE
//
//   SIMULTANEOUS — on hardware that supports AVCaptureMultiCamSession (A12 and
//   later, so iPhone XS/XR onwards) both cameras run in one session with their
//   own photo outputs. Both capture requests are issued back to back on the
//   session queue, so the two frames are milliseconds apart. This is the real
//   thing: two perspectives on the same moment.
//
//   SEQUENTIAL — everything older runs a normal single-camera session and
//   swaps inputs between the two shots. That swap costs roughly 250-500 ms.
//
// The result ALWAYS reports which path ran and the measured gap between the two
// frames. Nothing here claims a simultaneous capture it did not perform.
//
// A note on the multi-cam wiring: AVCaptureMultiCamSession must not be built
// with the implicit addInput/addOutput helpers — those form connections
// automatically and will bind the wrong devices together. Every input, output
// and preview layer below is added "WithNoConnections" and wired by hand.
// ============================================================================

enum DualCameraError: Error, LocalizedError {
  case permissionDenied
  case unavailable(String)
  case captureFailed(String)
  case cancelled

  var errorDescription: String? {
    switch self {
    case .permissionDenied: return "Camera access is off for LEVL."
    case .unavailable(let why): return why
    case .captureFailed(let why): return why
    case .cancelled: return "Capture cancelled."
    }
  }

  var code: String {
    switch self {
    case .permissionDenied: return "ERR_CAMERA_PERMISSION"
    case .unavailable: return "ERR_CAMERA_UNAVAILABLE"
    case .captureFailed: return "ERR_CAPTURE_FAILED"
    case .cancelled: return "ERR_CAPTURE_CANCELLED"
    }
  }
}

struct DualCaptureResult {
  let frontURL: URL
  let rearURL: URL
  let simultaneous: Bool
  let gapMs: Int
}

final class DualCameraController: NSObject {

  // Everything touching the session happens here. AVFoundation is not thread
  // safe and configuration on the main thread stutters the UI.
  private let sessionQueue = DispatchQueue(label: "app.levl.dualcamera.session")

  private var session: AVCaptureSession?
  private var isMultiCam = false

  private var backInput: AVCaptureDeviceInput?
  private var frontInput: AVCaptureDeviceInput?
  private var backOutput: AVCapturePhotoOutput?
  private var frontOutput: AVCapturePhotoOutput?

  private(set) var backPreviewLayer: AVCaptureVideoPreviewLayer?
  private(set) var frontPreviewLayer: AVCaptureVideoPreviewLayer?

  // One delegate object per in-flight photo, retained until it reports back.
  private var pending: [Int64: PhotoDelegate] = [:]

  var onReady: ((Bool) -> Void)?
  var onError: ((DualCameraError) -> Void)?

  static var isMultiCamSupported: Bool {
    AVCaptureMultiCamSession.isMultiCamSupported
  }

  static var authorizationStatus: String {
    switch AVCaptureDevice.authorizationStatus(for: .video) {
    case .authorized: return "granted"
    case .denied: return "denied"
    case .restricted: return "restricted"
    case .notDetermined: return "undetermined"
    @unknown default: return "undetermined"
    }
  }

  static func requestAccess(_ done: @escaping (Bool) -> Void) {
    AVCaptureDevice.requestAccess(for: .video) { ok in
      DispatchQueue.main.async { done(ok) }
    }
  }

  // --------------------------------------------------------------------------
  // Lifecycle
  // --------------------------------------------------------------------------

  func start() {
    sessionQueue.async { [weak self] in
      guard let self else { return }
      guard AVCaptureDevice.authorizationStatus(for: .video) == .authorized else {
        self.report(.permissionDenied); return
      }
      if self.session != nil {
        self.session?.startRunning()
        self.notifyReady()
        return
      }
      do {
        if Self.isMultiCamSupported {
          try self.configureMultiCam()
        } else {
          try self.configureSingleCam()
        }
        self.session?.startRunning()
        self.notifyReady()
      } catch let err as DualCameraError {
        self.report(err)
      } catch {
        self.report(.unavailable(error.localizedDescription))
      }
    }
  }

  // Tear the session down completely. A daily social feature opens and closes
  // this screen constantly; holding the hardware after leaving would drain the
  // battery, keep the privacy indicator lit, and eventually refuse to restart.
  func stop() {
    sessionQueue.async { [weak self] in
      guard let self else { return }
      self.session?.stopRunning()
      if let session = self.session {
        session.beginConfiguration()
        session.inputs.forEach { session.removeInput($0) }
        session.outputs.forEach { session.removeOutput($0) }
        session.commitConfiguration()
      }
      self.pending.removeAll()
      self.backInput = nil; self.frontInput = nil
      self.backOutput = nil; self.frontOutput = nil
      DispatchQueue.main.async {
        self.backPreviewLayer?.removeFromSuperlayer()
        self.frontPreviewLayer?.removeFromSuperlayer()
        self.backPreviewLayer = nil
        self.frontPreviewLayer = nil
      }
      self.session = nil
    }
  }

  private func notifyReady() {
    let multi = self.isMultiCam
    DispatchQueue.main.async { [weak self] in self?.onReady?(multi) }
  }

  private func report(_ err: DualCameraError) {
    DispatchQueue.main.async { [weak self] in self?.onError?(err) }
  }

  // --------------------------------------------------------------------------
  // Configuration — multi-cam
  // --------------------------------------------------------------------------

  private func configureMultiCam() throws {
    let session = AVCaptureMultiCamSession()
    self.session = session
    self.isMultiCam = true

    session.beginConfiguration()
    defer { session.commitConfiguration() }

    guard let back = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back),
          let front = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .front) else {
      throw DualCameraError.unavailable("This device is missing a front or rear camera.")
    }

    let backIn = try AVCaptureDeviceInput(device: back)
    let frontIn = try AVCaptureDeviceInput(device: front)
    guard session.canAddInput(backIn), session.canAddInput(frontIn) else {
      throw DualCameraError.unavailable("Both cameras could not be started together.")
    }
    session.addInputWithNoConnections(backIn)
    session.addInputWithNoConnections(frontIn)
    self.backInput = backIn
    self.frontInput = frontIn

    let backOut = AVCapturePhotoOutput()
    let frontOut = AVCapturePhotoOutput()
    guard session.canAddOutput(backOut), session.canAddOutput(frontOut) else {
      throw DualCameraError.unavailable("Both cameras could not be started together.")
    }
    session.addOutputWithNoConnections(backOut)
    session.addOutputWithNoConnections(frontOut)
    self.backOutput = backOut
    self.frontOutput = frontOut

    // Wire each camera to its own photo output explicitly.
    try connect(input: backIn, device: back, to: backOut, in: session, mirrored: false)
    try connect(input: frontIn, device: front, to: frontOut, in: session, mirrored: true)

    // Previews, also connected by hand.
    let backLayer = AVCaptureVideoPreviewLayer()
    backLayer.setSessionWithNoConnection(session)
    backLayer.videoGravity = .resizeAspectFill
    let frontLayer = AVCaptureVideoPreviewLayer()
    frontLayer.setSessionWithNoConnection(session)
    frontLayer.videoGravity = .resizeAspectFill

    if let backPort = backIn.ports(for: .video, sourceDeviceType: back.deviceType, sourceDevicePosition: .back).first {
      let c = AVCaptureConnection(inputPort: backPort, videoPreviewLayer: backLayer)
      if session.canAddConnection(c) { session.addConnection(c) }
    }
    if let frontPort = frontIn.ports(for: .video, sourceDeviceType: front.deviceType, sourceDevicePosition: .front).first {
      let c = AVCaptureConnection(inputPort: frontPort, videoPreviewLayer: frontLayer)
      // The selfie preview is mirrored so it behaves like a mirror, which is
      // what everyone expects when looking at themselves.
      if c.isVideoMirroringSupported {
        c.automaticallyAdjustsVideoMirroring = false
        c.isVideoMirrored = true
      }
      if session.canAddConnection(c) { session.addConnection(c) }
    }

    DispatchQueue.main.async { [weak self] in
      self?.backPreviewLayer = backLayer
      self?.frontPreviewLayer = frontLayer
    }
  }

  private func connect(input: AVCaptureDeviceInput,
                       device: AVCaptureDevice,
                       to output: AVCapturePhotoOutput,
                       in session: AVCaptureSession,
                       mirrored: Bool) throws {
    guard let port = input.ports(for: .video,
                                 sourceDeviceType: device.deviceType,
                                 sourceDevicePosition: device.position).first else {
      throw DualCameraError.unavailable("Camera could not be connected.")
    }
    let connection = AVCaptureConnection(inputPorts: [port], output: output)
    if connection.isVideoMirroringSupported {
      connection.automaticallyAdjustsVideoMirroring = false
      // The SAVED selfie is not mirrored, even though the preview is. A
      // mirrored photo shows text and logos backwards, which looks like a bug.
      connection.isVideoMirrored = false
    }
    guard session.canAddConnection(connection) else {
      throw DualCameraError.unavailable("Camera could not be connected.")
    }
    session.addConnection(connection)
  }

  // --------------------------------------------------------------------------
  // Configuration — single camera fallback
  // --------------------------------------------------------------------------

  private func configureSingleCam() throws {
    let session = AVCaptureSession()
    self.session = session
    self.isMultiCam = false

    session.beginConfiguration()
    session.sessionPreset = .photo

    guard let back = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back) else {
      throw DualCameraError.unavailable("This device has no rear camera.")
    }
    let backIn = try AVCaptureDeviceInput(device: back)
    guard session.canAddInput(backIn) else {
      throw DualCameraError.unavailable("The camera is in use by another app.")
    }
    session.addInput(backIn)
    self.backInput = backIn

    let out = AVCapturePhotoOutput()
    guard session.canAddOutput(out) else {
      throw DualCameraError.unavailable("The camera could not be started.")
    }
    session.addOutput(out)
    self.backOutput = out
    self.frontOutput = out   // the same output serves both shots here

    session.commitConfiguration()

    let layer = AVCaptureVideoPreviewLayer(session: session)
    layer.videoGravity = .resizeAspectFill
    DispatchQueue.main.async { [weak self] in
      self?.backPreviewLayer = layer
      self?.frontPreviewLayer = nil
    }
  }

  // --------------------------------------------------------------------------
  // Capture
  // --------------------------------------------------------------------------

  func capture(completion: @escaping (Result<DualCaptureResult, DualCameraError>) -> Void) {
    sessionQueue.async { [weak self] in
      guard let self, let session = self.session, session.isRunning else {
        completion(.failure(.unavailable("The camera is not running."))); return
      }
      if self.isMultiCam {
        self.captureSimultaneous(completion: completion)
      } else {
        self.captureSequential(completion: completion)
      }
    }
  }

  private func captureSimultaneous(completion: @escaping (Result<DualCaptureResult, DualCameraError>) -> Void) {
    guard let backOut = backOutput, let frontOut = frontOutput else {
      completion(.failure(.captureFailed("Cameras are not ready."))); return
    }

    let group = DispatchGroup()
    var rearData: Data?
    var frontData: Data?
    var rearAt: CFTimeInterval = 0
    var frontAt: CFTimeInterval = 0
    var failure: String?

    group.enter()
    shoot(on: backOut, flashAllowed: true) { data, at, err in
      rearData = data; rearAt = at
      if let err { failure = failure ?? err }
      group.leave()
    }
    group.enter()
    // No flash on the selfie side: a screen-flash on a multi-cam capture fires
    // while the rear shot is still exposing and ruins both frames.
    shoot(on: frontOut, flashAllowed: false) { data, at, err in
      frontData = data; frontAt = at
      if let err { failure = failure ?? err }
      group.leave()
    }

    group.notify(queue: sessionQueue) { [weak self] in
      guard let self else { return }
      guard let rear = rearData, let front = frontData else {
        completion(.failure(.captureFailed(failure ?? "One of the cameras did not return a photo.")))
        return
      }
      do {
        let rearURL = try self.write(rear, name: "rear")
        let frontURL = try self.write(front, name: "front")
        let gap = Int((abs(rearAt - frontAt) * 1000).rounded())
        completion(.success(DualCaptureResult(frontURL: frontURL, rearURL: rearURL,
                                              simultaneous: true, gapMs: gap)))
      } catch {
        completion(.failure(.captureFailed(error.localizedDescription)))
      }
    }
  }

  // Rear, then swap the input and take the selfie immediately. The swap is the
  // only slow part, and it is measured rather than estimated.
  private func captureSequential(completion: @escaping (Result<DualCaptureResult, DualCameraError>) -> Void) {
    guard let out = backOutput, let session = session else {
      completion(.failure(.captureFailed("Camera is not ready."))); return
    }

    shoot(on: out, flashAllowed: true) { [weak self] rearData, rearAt, rearErr in
      guard let self else { return }
      guard let rear = rearData else {
        completion(.failure(.captureFailed(rearErr ?? "The rear photo failed.")))
        return
      }

      // Swap to the front camera.
      guard let front = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .front) else {
        completion(.failure(.unavailable("This device has no front camera.")))
        return
      }
      do {
        session.beginConfiguration()
        if let current = self.backInput { session.removeInput(current) }
        let frontIn = try AVCaptureDeviceInput(device: front)
        guard session.canAddInput(frontIn) else {
          session.commitConfiguration()
          completion(.failure(.captureFailed("The front camera could not be started.")))
          return
        }
        session.addInput(frontIn)
        self.frontInput = frontIn
        if let connection = out.connection(with: .video), connection.isVideoMirroringSupported {
          connection.automaticallyAdjustsVideoMirroring = false
          connection.isVideoMirrored = false
        }
        session.commitConfiguration()
      } catch {
        completion(.failure(.captureFailed(error.localizedDescription)))
        return
      }

      self.shoot(on: out, flashAllowed: false) { frontData, frontAt, frontErr in
        // Put the rear camera back so the preview is live again the moment the
        // user chooses to retake.
        self.restoreRearInput()

        guard let frontImage = frontData else {
          completion(.failure(.captureFailed(frontErr ?? "The selfie failed.")))
          return
        }
        do {
          let rearURL = try self.write(rear, name: "rear")
          let frontURL = try self.write(frontImage, name: "front")
          let gap = Int(((frontAt - rearAt) * 1000).rounded())
          completion(.success(DualCaptureResult(frontURL: frontURL, rearURL: rearURL,
                                                simultaneous: false, gapMs: max(0, gap))))
        } catch {
          completion(.failure(.captureFailed(error.localizedDescription)))
        }
      }
    }
  }

  private func restoreRearInput() {
    guard let session = session,
          let back = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back) else { return }
    session.beginConfiguration()
    if let front = frontInput { session.removeInput(front); frontInput = nil }
    if let backIn = try? AVCaptureDeviceInput(device: back), session.canAddInput(backIn) {
      session.addInput(backIn)
      backInput = backIn
    }
    session.commitConfiguration()
  }

  private func shoot(on output: AVCapturePhotoOutput,
                     flashAllowed: Bool,
                     done: @escaping (Data?, CFTimeInterval, String?) -> Void) {
    let settings = AVCapturePhotoSettings(format: [AVVideoCodecKey: AVVideoCodecType.jpeg])
    settings.flashMode = .off
    // No location is attached, ever. AVFoundation only embeds GPS if we hand it
    // a CLLocation, and LEVL never asks for one — a Check In should not publish
    // where somebody trains.
    if #available(iOS 16.0, *) {
      settings.maxPhotoDimensions = output.maxPhotoDimensions
    }

    let delegate = PhotoDelegate { [weak self] data, at, err in
      guard let self else { return }
      self.sessionQueue.async { self.pending[settings.uniqueID] = nil }
      done(data, at, err)
    }
    pending[settings.uniqueID] = delegate
    output.capturePhoto(with: settings, delegate: delegate)
  }

  private func write(_ data: Data, name: String) throws -> URL {
    let dir = FileManager.default.temporaryDirectory.appendingPathComponent("levl-checkin", isDirectory: true)
    try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    let url = dir.appendingPathComponent("\(name)-\(UUID().uuidString).jpg")
    try data.write(to: url, options: .atomic)
    return url
  }
}

// One capture, one delegate. AVCapturePhotoOutput holds the delegate weakly, so
// the controller keeps it alive in `pending` until the callback fires.
private final class PhotoDelegate: NSObject, AVCapturePhotoCaptureDelegate {
  private let done: (Data?, CFTimeInterval, String?) -> Void
  init(done: @escaping (Data?, CFTimeInterval, String?) -> Void) { self.done = done }

  func photoOutput(_ output: AVCapturePhotoOutput,
                   didFinishProcessingPhoto photo: AVCapturePhoto,
                   error: Error?) {
    let at = CACurrentMediaTime()
    if let error {
      done(nil, at, error.localizedDescription); return
    }
    done(photo.fileDataRepresentation(), at, nil)
  }
}
