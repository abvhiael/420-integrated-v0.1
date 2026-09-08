import SwiftUI

struct Wallet420DesignSystem {
    static let backgroundLight = Color(red: 244 / 255, green: 247 / 255, blue: 243 / 255)
    static let backgroundDark = Color(red: 14 / 255, green: 21 / 255, blue: 17 / 255)
    static let surfaceLight = Color.white
    static let surfaceDark = Color(red: 21 / 255, green: 31 / 255, blue: 25 / 255)
    static let textPrimaryLight = Color(red: 19 / 255, green: 32 / 255, blue: 24 / 255)
    static let textPrimaryDark = Color(red: 242 / 255, green: 246 / 255, blue: 242 / 255)
    static let textSecondaryLight = Color(red: 82 / 255, green: 97 / 255, blue: 88 / 255)
    static let textSecondaryDark = Color(red: 169 / 255, green: 184 / 255, blue: 174 / 255)
    static let brandPrimaryLight = Color(red: 23 / 255, green: 107 / 255, blue: 58 / 255)
    static let brandPrimaryDark = Color(red: 101 / 255, green: 200 / 255, blue: 135 / 255)

    static let spacingSmall: CGFloat = 8
    static let spacingMedium: CGFloat = 16
    static let spacingLarge: CGFloat = 24
    static let spacingXLarge: CGFloat = 32
    static let cornerRadiusMedium: CGFloat = 14
    static let minimumTouchTarget: CGFloat = 44
}

struct Wallet420SurfaceModifier: ViewModifier {
    @Environment(\.colorScheme) private var colorScheme

    func body(content: Content) -> some View {
        content
            .foregroundStyle(colorScheme == .dark ? Wallet420DesignSystem.textPrimaryDark : Wallet420DesignSystem.textPrimaryLight)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(colorScheme == .dark ? Wallet420DesignSystem.backgroundDark : Wallet420DesignSystem.backgroundLight)
    }
}

struct Wallet420PrimaryButtonStyle: ButtonStyle {
    @Environment(\.colorScheme) private var colorScheme

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 14, weight: .semibold))
            .frame(minHeight: Wallet420DesignSystem.minimumTouchTarget)
            .padding(.horizontal, Wallet420DesignSystem.spacingMedium)
            .background(colorScheme == .dark ? Wallet420DesignSystem.brandPrimaryDark : Wallet420DesignSystem.brandPrimaryLight)
            .foregroundStyle(colorScheme == .dark ? Wallet420DesignSystem.backgroundDark : Color.white)
            .clipShape(RoundedRectangle(cornerRadius: Wallet420DesignSystem.cornerRadiusMedium, style: .continuous))
            .opacity(configuration.isPressed ? 0.82 : 1)
    }
}

extension View {
    func wallet420Surface() -> some View {
        modifier(Wallet420SurfaceModifier())
    }
}
