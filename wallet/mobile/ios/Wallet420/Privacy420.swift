import Foundation
import UIKit

/// W11.8 presentation-only clipboard policy. Never place secrets or signing material on the clipboard.
enum Privacy420 {
    static func copyPublicValue(_ value: String) {
        guard !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        UIPasteboard.general.setItems(
            [[UTTypePlainText: value]],
            options: [
                .localOnly: true,
                .expirationDate: Date().addingTimeInterval(60),
            ]
        )
    }

    static func clear() {
        UIPasteboard.general.items = []
    }

    private static let UTTypePlainText = "public.utf8-plain-text"
}
