package io.fourtwenty.wallet

import kotlinx.coroutines.delay
import org.json.JSONArray
import org.json.JSONObject

/** W11.4 guarded UserOperation submission boundary for owner/recovery/session flows. */
class AndroidTransactionSubmitter420(
    private val transport: AndroidRpcTransport420,
    private val securityContext: () -> NativeSecurityContext420,
) {
    suspend fun submit(requestJson: String): String {
        val request = JSONObject(requestJson)
        val kind = request.getString("kind")
        require(kind in setOf("owner", "recovery", "session")) { "unsupported transaction authority kind" }
        val current = securityContext()
        require(request.getString("chainId") == current.chainId) { "chain drift detected" }
        require(request.getString("account").equals(current.account, ignoreCase = true)) { "account drift detected" }
        require(request.getLong("authorizationEpoch") == current.authorizationEpoch) { "authorization epoch drift detected" }
        val userOperation = request.getJSONObject("userOperation")
        val entryPoint = request.getString("entryPoint")
        require(entryPoint.startsWith("0x") && entryPoint.length == 42) { "entryPoint address required" }

        val send = transport.rpc(
            "eth_sendUserOperation",
            JSONArray().put(userOperation).put(entryPoint).toString(),
        )
        val userOpHash = JSONObject(send).optString("result")
        require(userOpHash.startsWith("0x") && userOpHash.length == 66) { "invalid UserOperation hash" }
        return JSONObject()
            .put("userOpHash", userOpHash)
            .put("receipt", pollReceipt(userOpHash))
            .toString()
    }

    private suspend fun pollReceipt(userOpHash: String): Any {
        repeat(30) {
            val raw = transport.rpc(
                "eth_getUserOperationReceipt",
                JSONArray().put(userOpHash).toString(),
            )
            val result = JSONObject(raw).opt("result")
            if (result != null && result != JSONObject.NULL) return result
            delay(1_000)
        }
        return JSONObject.NULL
    }
}

data class NativeSecurityContext420(
    val chainId: String,
    val account: String,
    val authorizationEpoch: Long,
)
