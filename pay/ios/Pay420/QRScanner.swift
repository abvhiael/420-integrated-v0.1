import AVFoundation
import SwiftUI

struct QRScanner: UIViewControllerRepresentable {
    let result: (Result<String, ScanError>) -> Void

    enum ScanError: Error { case unavailable }

    func makeUIViewController(context: Context) -> CameraController {
        CameraController(result: result)
    }

    func updateUIViewController(_ controller: CameraController, context: Context) {}

    static func dismantleUIViewController(_ controller: CameraController, coordinator: ()) {
        controller.stop()
    }

    final class CameraController: UIViewController, AVCaptureMetadataOutputObjectsDelegate {
        private let session = AVCaptureSession()
        private let queue = DispatchQueue(label: "io.fourtwenty.pay.camera")
        private var preview: AVCaptureVideoPreviewLayer?
        private var completed = false
        private let result: (Result<String, ScanError>) -> Void

        init(result: @escaping (Result<String, ScanError>) -> Void) {
            self.result = result
            super.init(nibName: nil, bundle: nil)
        }

        required init?(coder: NSCoder) { return nil }

        override func viewDidLoad() {
            super.viewDidLoad()
            view.backgroundColor = .black
            AVCaptureDevice.requestAccess(for: .video) { [weak self] granted in
                DispatchQueue.main.async {
                    guard let self, !self.completed else { return }
                    if granted { self.start() }
                    else { self.finish(.failure(.unavailable)) }
                }
            }
        }

        private func start() {
            let layer = AVCaptureVideoPreviewLayer(session: session)
            layer.videoGravity = .resizeAspectFill
            layer.frame = view.bounds
            view.layer.addSublayer(layer)
            preview = layer
            queue.async { [self, session] in
                guard let camera = AVCaptureDevice.default(for: .video),
                      let input = try? AVCaptureDeviceInput(device: camera),
                      session.canAddInput(input) else {
                    DispatchQueue.main.async { self.finish(.failure(.unavailable)) }
                    return
                }
                session.addInput(input)
                let output = AVCaptureMetadataOutput()
                guard session.canAddOutput(output) else {
                    DispatchQueue.main.async { self.finish(.failure(.unavailable)) }
                    return
                }
                session.addOutput(output)
                guard output.availableMetadataObjectTypes.contains(.qr) else {
                    DispatchQueue.main.async { self.finish(.failure(.unavailable)) }
                    return
                }
                output.setMetadataObjectsDelegate(self, queue: .main)
                output.metadataObjectTypes = [.qr]
                session.startRunning()
            }
        }

        override func viewDidLayoutSubviews() {
            super.viewDidLayoutSubviews()
            preview?.frame = view.bounds
        }

        func metadataOutput(_ output: AVCaptureMetadataOutput, didOutput metadataObjects: [AVMetadataObject],
                            from connection: AVCaptureConnection) {
            guard let code = metadataObjects.compactMap({ ($0 as? AVMetadataMachineReadableCodeObject)?.stringValue }).first
            else { return }
            finish(.success(code))
        }

        private func finish(_ value: Result<String, ScanError>) {
            guard !completed else { return }
            stop()
            result(value)
        }

        func stop() {
            completed = true
            let active = session
            queue.async { if active.isRunning { active.stopRunning() } }
        }
    }
}
