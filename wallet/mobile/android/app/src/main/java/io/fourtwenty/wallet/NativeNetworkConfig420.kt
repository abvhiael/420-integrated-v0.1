package io.fourtwenty.wallet

import android.content.Context
import org.json.JSONObject

/**
 * Configuration-only native network registry for W11.4.
 * Endpoints are supplied by build/runtime configuration; no signing authority lives here.
 */
data class NativeNetwork420(val chainId: String, val rpcUrl: String)

class NativeNetworkConfig420 private constructor(
    val networks: Map<String, NativeNetwork420>,
) {
    fun endpoints(): Map<String, String> = networks.mapValues { it.value.rpcUrl }

    companion object {
        fun fromJson(json: String): NativeNetworkConfig420 {
            val root = JSONObject(json)
            val entries = root.getJSONArray("networks")
            val resolved = linkedMapOf<String, NativeNetwork420>()
            for (index in 0 until entries.length()) {
                val item = entries.getJSONObject(index)
                val chainId = normalizeChainId(item.getString("chainId"))
                val rpcUrl = item.getString("rpcUrl")
                require(rpcUrl.startsWith("https://", ignoreCase = true)) { "RPC endpoint must use HTTPS" }
                require(URL420.isValidHttpsEndpoint(rpcUrl)) { "RPC endpoint is malformed" }
                require(chainId !in resolved) { "duplicate chain id" }
                resolved[chainId] = NativeNetwork420(chainId, rpcUrl)
            }
            require(resolved.isNotEmpty()) { "at least one network is required" }
            return NativeNetworkConfig420(resolved)
        }

        fun fromAsset(context: Context, assetName: String = "wallet-networks.json"): NativeNetworkConfig420 {
            val json = context.assets.open(assetName).bufferedReader().use { it.readText() }
            return fromJson(json)
        }

        fun normalizeChainId(value: String): String {
            val trimmed = value.trim().lowercase()
            require(Regex("^0x[0-9a-f]+$").matches(trimmed)) { "chain id must be canonical hex" }
            return "0x" + trimmed.removePrefix("0x").trimStart('0').ifEmpty { "0" }
        }
    }
}

private object URL420 {
    fun isValidHttpsEndpoint(value: String): Boolean = try {
        val url = java.net.URL(value)
        url.protocol.equals("https", ignoreCase = true) && !url.host.isNullOrBlank() && url.userInfo == null
    } catch (_: Exception) {
        false
    }
}
