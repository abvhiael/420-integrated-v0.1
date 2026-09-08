package io.fourtwenty.wallet

/**
 * W11.9 native qualification fixture. This mirrors the canonical mobile
 * authority boundary; it does not grant authority itself.
 */
object AndroidAuthorityPolicy420 {
    const val canonicalAccountAuthority = "SmartAccount420"
    const val canonicalCapabilityAuthority = "CapabilityRegistry420"
    const val rpcRole = "read_transport_only"
    const val nativeClientIsCanonicalAuthority = false
    const val remoteSignerAllowed = false
    const val exportablePrivateKeyAllowed = false

    private val allowedRpcMethods = setOf(
        "eth_chainId",
        "eth_call",
        "eth_estimateGas",
        "eth_getBalance",
        "eth_getCode",
        "eth_getTransactionCount",
        "eth_getBlockByNumber",
        "eth_getLogs",
        "eth_sendUserOperation",
        "eth_getUserOperationReceipt",
        "eth_estimateUserOperationGas",
    )

    fun rpcMethodAllowed(method: String): Boolean = allowedRpcMethods.contains(method)

    fun endpointAllowed(value: String): Boolean = try {
        val uri = java.net.URI(value)
        uri.scheme == "https" && !uri.host.isNullOrBlank() && uri.userInfo == null
    } catch (_: Exception) {
        false
    }
}
