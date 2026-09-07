package io.fourtwenty.wallet

/**
 * W11 native implementation boundary consumed by the shared mobile Wallet Core.
 * Implementations must keep RPC as read/transport only and keep signing local.
 */
interface NativeWalletBridge420 {
    suspend fun rpc(method: String, paramsJson: String = "[]"): String
    suspend fun secureGet(key: String): ByteArray?
    suspend fun secureSet(key: String, value: ByteArray)
    suspend fun secureDelete(key: String)
    suspend fun createPasskey(requestJson: String): String
    suspend fun getPasskey(requestJson: String): String
    suspend fun signSessionHash(alias: String, hash: ByteArray): ByteArray
    suspend fun submitTransaction(requestJson: String): String
    fun openExternalUrl(url: String)
    fun onResume(listener: () -> Unit): AutoCloseable
    fun onPause(listener: () -> Unit): AutoCloseable
}
