package io.fourtwenty.wallet

import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.security.keystore.StrongBoxUnavailableException
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
 */
class AndroidSessionKey420 {
    private val keyStore: KeyStore = KeyStore.getInstance(KEYSTORE).apply { load(null) }

    fun ensure(alias: String): ByteArray {
        require(alias.isNotBlank()) { "session key alias is required" }
        if (!keyStore.containsAlias(alias)) generate(alias)
        return publicKey(alias)
    }

    fun publicKey(alias: String): ByteArray {
        val certificate = keyStore.getCertificate(alias)
            ?: throw IllegalStateException("session key is unavailable or invalidated")
        return certificate.publicKey.encoded
    }

    fun signHash(alias: String, hash: ByteArray): ByteArray {
        require(hash.isNotEmpty()) { "hash is required" }
        val entry = keyStore.getEntry(alias, null) as? KeyStore.PrivateKeyEntry
            ?: throw IllegalStateException("session key is unavailable or invalidated")
        return Signature.getInstance("NONEwithECDSA").run {
            initSign(entry.privateKey)
            update(hash)
            sign()
        }
    }

    fun rotate(alias: String): ByteArray {
        invalidate(alias)
        generate(alias)
        return publicKey(alias)
    }

    fun invalidate(alias: String) {
        if (keyStore.containsAlias(alias)) keyStore.deleteEntry(alias)
    }

    private fun generate(alias: String) {
        val generator = KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC, KEYSTORE)
        val base = KeyGenParameterSpec.Builder(
            alias,
            KeyProperties.PURPOSE_SIGN or KeyProperties.PURPOSE_VERIFY,
        )
            .setAlgorithmParameterSpec(ECGenParameterSpec("secp256r1"))
            .setDigests(KeyProperties.DIGEST_NONE, KeyProperties.DIGEST_SHA256)
            .setUserAuthenticationRequired(false)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
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

    private companion object {
        const val KEYSTORE = "AndroidKeyStore"
    }
}
