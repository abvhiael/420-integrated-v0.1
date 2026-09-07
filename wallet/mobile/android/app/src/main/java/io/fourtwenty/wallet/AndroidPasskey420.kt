package io.fourtwenty.wallet

import android.app.Activity
import androidx.credentials.CreatePublicKeyCredentialRequest
import androidx.credentials.CreatePublicKeyCredentialResponse
import androidx.credentials.CredentialManager
import androidx.credentials.GetCredentialRequest
import androidx.credentials.GetPublicKeyCredentialOption
import androidx.credentials.PublicKeyCredential

/**
 * W11.3 Android passkey adapter.
 *
 * The shared Wallet Core owns WebAuthn/PK42 semantics. Android only mediates the
 * platform credential ceremony and returns the canonical WebAuthn response JSON.
 */
class AndroidPasskey420(private val activity: Activity) {
    private val credentialManager = CredentialManager.create(activity)

    suspend fun create(requestJson: String): String {
        require(requestJson.isNotBlank()) { "passkey creation request is required" }
        val response = credentialManager.createCredential(
            context = activity,
            request = CreatePublicKeyCredentialRequest(requestJson = requestJson),
        )
        val created = response as? CreatePublicKeyCredentialResponse
            ?: throw IllegalStateException("unexpected passkey creation response")
        return created.registrationResponseJson
    }

    suspend fun get(requestJson: String): String {
        require(requestJson.isNotBlank()) { "passkey assertion request is required" }
        val response = credentialManager.getCredential(
            context = activity,
            request = GetCredentialRequest(
                credentialOptions = listOf(
                    GetPublicKeyCredentialOption(requestJson = requestJson),
                ),
            ),
        )
        val credential = response.credential as? PublicKeyCredential
            ?: throw IllegalStateException("unexpected passkey assertion response")
        return credential.authenticationResponseJson
    }
}
