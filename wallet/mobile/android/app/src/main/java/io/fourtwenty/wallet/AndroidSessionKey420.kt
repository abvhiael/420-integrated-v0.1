package io.fourtwenty.wallet

import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.security.keystore.KeyPermanentlyInvalidatedException
import android.security.keystore.StrongBoxUnavailableException
import android.security.keystore.UserNotAuthenticatedException
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.Signature
import java.security.spec.ECGenParameterSpec

/**
 * W11.2 device-local session signer.
 *
 * Private keys are generated inside AndroidKeyStore and are never exported.
 * StrongBox is preferred when available; devices without StrongBox fall back to
 * the platform hardware/TEE-backed AndroidKeyStore implementation.
 * Keys are version-namespaced and require the device to be unlocked on API 28+.
 */
class AndroidSessionKey420 {
    private val keyStore: KeyStore = KeyStore.getInstance(KEYSTORE).apply { load(null) }

    fun ensure(alias: String): ByteArray {
        val storageAlias = storageAlias(alias)
        migrateLegacyAlias(alias)
        if (!keyStore.containsAlias(storageAlias)) generate(storageAlias)
        return publicKey(alias)
    }

    fun publicKey(alias: String): ByteArray {
        val certificate = keyStore.getCertificate(storageAlias(alias))
            ?: throw SessionKeyUnavailable420("session key is unavailable or invalidated")
        return certificate.publicKey.encoded
    }

    fun signHash(alias: String, hash: ByteArray): ByteArray {
        require(hash.isNotEmpty()) { "hash is required" }
        val entry = keyStore.getEntry(storageAlias(alias), null) as? KeyStore.PrivateKeyEntry
            ?: throw SessionKeyUnavailable420("session key is unavailable or invalidated")
        return try {
            Signature.getInstance("NONEwithECDSA").run {
                initSign(entry.privateKey)
                update(hash)
                sign()
            }
        } catch (error: KeyPermanentlyInvalidatedException) {
            throw SessionKeyUnavailable420("session key was permanently invalidated", error)
        } catch (error: UserNotAuthenticatedException) {
            throw SessionKeyLocked420("device must be unlocked before session signing", error)
        }
    }

    fun rotate(alias: String): ByteArray {
        invalidate(alias)
        return ensure(alias)
    }

    fun invalidate(alias: String) {
        val storageAlias = storageAlias(alias)
        if (keyStore.containsAlias(storageAlias)) keyStore.deleteEntry(storageAlias)
        if (keyStore.containsAlias(alias)) keyStore.deleteEntry(alias)
    }

    fun keyVersion(): Int = KEY_VERSION

    private fun generate(storageAlias: String) {
        val generator = KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC, KEYSTORE)
        val base = KeyGenParameterSpec.Builder(
            storageAlias,
            KeyProperties.PURPOSE_SIGN or KeyProperties.PURPOSE_VERIFY,
        )
            .setAlgorithmParameterSpec(ECGenParameterSpec("secp256r1"))
            .setDigests(KeyProperties.DIGEST_NONE, KeyProperties.DIGEST_SHA256)
            .setUserAuthenticationRequired(false)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            base.setUnlockedDeviceRequired(true)
            try {
                generator.initialize(base.setIsStrongBoxBacked(true).build())
                generator.generateKeyPair()
                return
            } catch (_: StrongBoxUnavailableException) {
                // Fall through to AndroidKeyStore / TEE-backed generation.
            } catch (_: IllegalArgumentException) {
                // Some devices expose AndroidKeyStore without StrongBox support.
            }
        }

        generator.initialize(base.setIsStrongBoxBacked(false).build())
        generator.generateKeyPair()
    }

    private fun migrateLegacyAlias(alias: String) {
        val storageAlias = storageAlias(alias)
        if (keyStore.containsAlias(storageAlias)) return
        // W11.2 never exports or copies legacy private material. A legacy alias is
        // invalidated and replaced with a fresh versioned hardware-backed key.
        if (keyStore.containsAlias(alias)) keyStore.deleteEntry(alias)
    }

    private fun storageAlias(alias: String): String {
        require(alias.isNotBlank()) { "session key alias is required" }
        return "$ALIAS_PREFIX$alias"
    }

    private companion object {
        const val KEYSTORE = "AndroidKeyStore"
        const val KEY_VERSION = 1
        const val ALIAS_PREFIX = "wallet420.session.v1."
    }
}

class SessionKeyUnavailable420(message: String, cause: Throwable? = null) : IllegalStateException(message, cause)
class SessionKeyLocked420(message: String, cause: Throwable? = null) : IllegalStateException(message, cause)
