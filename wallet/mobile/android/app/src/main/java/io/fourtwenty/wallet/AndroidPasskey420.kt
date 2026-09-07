package io.fourtwenty.wallet

import android.app.Activity
import androidx.credentials.CreateCredentialCancellationException
import androidx.credentials.CreateCredentialException
import androidx.credentials.CreatePublicKeyCredentialRequest
import androidx.credentials.CreatePublicKeyCredentialResponse
import androidx.credentials.CredentialManager
import androidx.credentials.GetCredentialCancellationException
import androidx.credentials.GetCredentialException
import androidx.credentials.GetCredentialRequest
import androidx.credentials.GetPublicKeyCredentialOption
import androidx.credentials.PublicKeyCredential
import org.json.JSONObject

/**
 * W11.3 Android passkey adapter.
 *
 * The shared Wallet Core owns WebAuthn/PK42 semantics. Android only mediates the
 * platform credential ceremony and returns the canonical WebAuthn response JSON.
 */
class AndroidPasskey420(private val activity: Activity) {
    private val credentialManager = CredentialManager.create(activity)

    suspend fun create(requestJson: String): String {
        validateCreationRequest(requestJson)
        return try {
            val response = credentialManager.createCredential(
                context = activity,
                request = CreatePublicKeyCredentialRequest(requestJson = requestJson),
            )
            val created = response as? CreatePublicKeyCredentialResponse
                ?: throw Passkey420Exception.UnexpectedCredential
            validateCanonicalResponse(created.registrationResponseJson, registration = true)
        } catch (_: CreateCredentialCancellationException) {
            throw Passkey420Exception.Cancelled
        } catch (error: CreateCredentialException) {
            throw Passkey420Exception.PlatformFailure(error.type)
        }
    }

    suspend fun get(requestJson: String): String {
        validateAssertionRequest(requestJson)
        return try {
            val response = credentialManager.getCredential(
                context = activity,
                request = GetCredentialRequest(
                    credentialOptions = listOf(
                        GetPublicKeyCredentialOption(requestJson = requestJson),
                    ),
                ),
            )
            val credential = response.credential as? PublicKeyCredential
                ?: throw Passkey420Exception.UnexpectedCredential
            validateCanonicalResponse(credential.authenticationResponseJson, registration = false)
        } catch (_: GetCredentialCancellationException) {
            throw Passkey420Exception.Cancelled
        } catch (error: GetCredentialException) {
            throw Passkey420Exception.PlatformFailure(error.type)
        }
    }

    private fun validateCreationRequest(requestJson: String) {
        require(requestJson.isNotBlank()) { "passkey creation request is required" }
        val root = JSONObject(requestJson)
        validateRpId(root.getJSONObject("rp").getString("id"))
        require(root.getString("challenge").isNotBlank()) { "passkey challenge is required" }
        require(root.getJSONObject("user").getString("id").isNotBlank()) { "passkey user id is required" }
    }

    private fun validateAssertionRequest(requestJson: String) {
        require(requestJson.isNotBlank()) { "passkey assertion request is required" }
        val root = JSONObject(requestJson)
        validateRpId(root.getString("rpId"))
        require(root.getString("challenge").isNotBlank()) { "passkey challenge is required" }
    }

    private fun validateRpId(rpId: String) {
        require(rpId.isNotBlank()) { "relying-party id is required" }
        require(!rpId.contains("://") && !rpId.contains('/') && !rpId.contains(':')) {
            "relying-party id must be a hostname, not an origin or URL"
        }
        require(rpId.split('.').all { it.isNotBlank() }) { "relying-party id is malformed" }
    }

    private fun validateCanonicalResponse(responseJson: String, registration: Boolean): String {
        val root = JSONObject(responseJson)
        require(root.getString("type") == "public-key") { "unexpected WebAuthn credential type" }
        require(root.getString("id").isNotBlank()) { "credential id is required" }
        require(root.getString("rawId").isNotBlank()) { "raw credential id is required" }
        val response = root.getJSONObject("response")
        require(response.getString("clientDataJSON").isNotBlank()) { "clientDataJSON is required" }
        if (registration) {
            require(response.has("attestationObject")) { "attestationObject is required" }
        } else {
            require(response.getString("authenticatorData").isNotBlank()) { "authenticatorData is required" }
            require(response.getString("signature").isNotBlank()) { "signature is required" }
        }
        return responseJson
    }
}

sealed class Passkey420Exception(message: String) : Exception(message) {
    data object Cancelled : Passkey420Exception("passkey ceremony cancelled")
    data object UnexpectedCredential : Passkey420Exception("unexpected passkey credential response")
    data class PlatformFailure(val code: String) : Passkey420Exception("passkey platform failure: $code")
}
