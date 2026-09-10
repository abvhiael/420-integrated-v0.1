import fs from 'node:fs';

const tokens = JSON.parse(fs.readFileSync(new URL('./design/design-tokens.json', import.meta.url)));
const android = fs.readFileSync(new URL('./android/app/src/main/java/io/fourtwenty/wallet/Wallet420DesignSystem.kt', import.meta.url), 'utf8');
const ios = fs.readFileSync(new URL('./ios/Wallet420/Wallet420DesignSystem.swift', import.meta.url), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(tokens.schemaVersion === 1, 'unsupported design token schema');
assert(tokens.brand === '420 Wallet', 'brand token drift');
assert(tokens.authority.presentationOnly === true, 'design system must remain presentation-only');
assert(tokens.authority.maySign === false, 'design system must never sign');
assert(tokens.authority.mayRecover === false, 'design system must never recover accounts');
assert(tokens.authority.mayGrantCapabilities === false, 'design system must never grant capabilities');
assert(tokens.accessibility.minimumTouchTarget >= 44, 'minimum touch target must be at least 44dp/pt');
assert(tokens.accessibility.minimumBodyText >= 16, 'minimum body text must be at least 16sp/pt');
assert(tokens.accessibility.supportsReducedMotion === true, 'reduced motion must remain a design-system requirement');
assert(tokens.accessibility.supportsDynamicType === true, 'dynamic type must remain a design-system requirement');

for (const mode of ['light', 'dark']) {
  for (const role of ['background', 'surface', 'textPrimary', 'textSecondary', 'brandPrimary', 'brandOnPrimary', 'accent', 'border', 'success', 'warning', 'danger']) {
    assert(/^#[0-9A-F]{6}$/i.test(tokens.color[mode][role]), `invalid ${mode} ${role} color token`);
  }
}

for (const marker of ['MIN_TOUCH_TARGET_DP = 44', 'LIGHT_PRIMARY = "#176B3A"', 'DARK_PRIMARY = "#65C887"']) {
  assert(android.includes(marker), `Android design token parity missing: ${marker}`);
}
for (const marker of ['minimumTouchTarget: CGFloat = 44', 'brandPrimaryLight', 'brandPrimaryDark', 'Wallet420SurfaceModifier']) {
  assert(ios.includes(marker), `iOS design token parity missing: ${marker}`);
}

const forbidden = /(private[_-]?key|seed phrase|mnemonic|recovery secret|session secret)/i;
assert(!forbidden.test(JSON.stringify(tokens)), 'design tokens must not contain wallet secrets');

console.log('W13.1 design system parity check passed');
