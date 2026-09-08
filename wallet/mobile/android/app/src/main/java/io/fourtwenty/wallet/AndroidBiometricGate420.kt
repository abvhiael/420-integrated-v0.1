package io.fourtwenty.wallet

import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.fragment.app.FragmentActivity
import java.util.concurrent.Executor
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlinx.coroutines.suspendCancellableCoroutine

/** Local user-presence gate only. This never signs and never changes canonical authority. */
class AndroidBiometricGate420(
    private val activity: FragmentActivity,
    private val executor: Executor,
) {
    fun isAvailable(): Boolean {
        val result = BiometricManager.from(activity).canAuthenticate(
            BiometricManager.Authenticators.BIOMETRIC_STRONG or
                BiometricManager.Authenticators.DEVICE_CREDENTIAL,
        )
        return result == BiometricManager.BIOMETRIC_SUCCESS
    }

    suspend fun authorize(reason: String): Boolean = suspendCancellableCoroutine { continuation ->
        require(reason.isNotBlank()) { "biometric authorization reason is required" }

        val prompt = BiometricPrompt(
            activity,
            executor,
            object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    if (continuation.isActive) continuation.resume(true)
                }

                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                    if (continuation.isActive) {
                        if (errorCode == BiometricPrompt.ERROR_USER_CANCELED ||
                            errorCode == BiometricPrompt.ERROR_NEGATIVE_BUTTON ||
                            errorCode == BiometricPrompt.ERROR_CANCELED
                        ) {
                            continuation.resume(false)
                        } else {
                            continuation.resumeWithException(
                                IllegalStateException("biometric authorization failed: $errString"),
                            )
                        }
                    }
                }
            },
        )

        prompt.authenticate(
            BiometricPrompt.PromptInfo.Builder()
                .setTitle("420 Wallet authorization")
                .setSubtitle(reason)
                .setAllowedAuthenticators(
                    BiometricManager.Authenticators.BIOMETRIC_STRONG or
                        BiometricManager.Authenticators.DEVICE_CREDENTIAL,
                )
                .build(),
        )

        continuation.invokeOnCancellation { prompt.cancelAuthentication() }
    }
}
