package io.fourtwenty.wallet

import android.app.Activity
import android.os.Debug
import android.view.WindowManager
import java.io.File

data class AndroidDeviceSecuritySignals420(
    val rooted: Boolean,
    val debuggerAttached: Boolean,
    val screenCaptureBlocked: Boolean,
)

object AndroidDeviceSecurity420 {
    private val rootIndicators = listOf(
        "/system/app/Superuser.apk",
        "/system/xbin/su",
        "/system/bin/su",
        "/sbin/su",
    )

    fun inspect(activity: Activity): AndroidDeviceSecuritySignals420 {
        val rooted = rootIndicators.any { File(it).exists() }
        val debuggerAttached = Debug.isDebuggerConnected() || Debug.waitingForDebugger()
        return AndroidDeviceSecuritySignals420(
            rooted = rooted,
            debuggerAttached = debuggerAttached,
            screenCaptureBlocked = true,
        )
    }

    fun enablePrivacyShield(activity: Activity) {
        activity.window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
    }

    fun onBackground(activity: Activity, onLocalLock: () -> Unit) {
        enablePrivacyShield(activity)
        onLocalLock()
    }

    // Device signals are local risk inputs only. They never grant or revoke SmartAccount420 authority.
}
