// Build-time only. esbuild packages the official MV3 service-worker SDK locally.
// No remote JavaScript is loaded by the extension at runtime.
import TrezorConnect from '@trezor/connect-webextension';
export default TrezorConnect;
